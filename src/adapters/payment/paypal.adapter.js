import crypto from 'crypto';
import PaymentAdapterInterface from './paymentAdapter.interface.js';

export class PayPalAdapter extends PaymentAdapterInterface {
  async createPaymentIntent({ orderId, amountUSD, currency = 'USD', metadata = {} }) {
    const mockGatewayTxId = `PAYPAL_ORD_${crypto.randomBytes(10).toString('hex').toUpperCase()}`;
    const checkoutUrl = `https://www.sandbox.paypal.com/checkoutnow?token=${mockGatewayTxId}`;

    return {
      gatewayTxId: mockGatewayTxId,
      checkoutUrl,
      amountUSD: Number(amountUSD),
      currency: currency.toUpperCase(),
      metadata: {
        ...metadata,
        orderId,
      },
    };
  }

  async verifyWebhookSignature({ rawBody, signature, webhookSecret }) {
    if (!signature || !webhookSecret) return false;

    try {
      const computedHmac = crypto.createHmac('sha256', webhookSecret).update(String(rawBody)).digest('hex');
      if (computedHmac.length !== signature.length) return false;
      return crypto.timingSafeEqual(Buffer.from(computedHmac, 'utf8'), Buffer.from(signature, 'utf8'));
    } catch {
      return false;
    }
  }

  parseWebhookEvent(payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const eventType = data.event_type || 'unknown';
    const isSuccessful = eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'CHECKOUT.ORDER.APPROVED';
    const resource = data.resource || data;
    const gatewayTxId = resource.id || resource.order_id || data.gatewayTxId;
    const amountUSD = resource.amount?.value ? Number(resource.amount.value) : undefined;

    return {
      eventType,
      isSuccessful,
      gatewayTxId,
      amountUSD,
      metadata: resource.custom_id ? { customId: resource.custom_id } : {},
    };
  }

  async verifyPaymentStatus(gatewayTxId) {
    return {
      isPaid: true,
      status: 'COMPLETED',
      gatewayTxId,
    };
  }
}

export default PayPalAdapter;
