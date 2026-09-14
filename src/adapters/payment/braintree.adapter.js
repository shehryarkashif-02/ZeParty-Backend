import crypto from 'crypto';
import PaymentAdapterInterface from './paymentAdapter.interface.js';

export class BraintreeAdapter extends PaymentAdapterInterface {
  async createPaymentIntent({ orderId, amountUSD, currency = 'USD', metadata = {} }) {
    const mockGatewayTxId = `bt_tx_${crypto.randomBytes(12).toString('hex')}`;
    const clientToken = `bt_client_token_${crypto.randomBytes(24).toString('hex')}`;

    return {
      gatewayTxId: mockGatewayTxId,
      clientSecret: clientToken,
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
    const kind = data.kind || data.type || 'unknown';
    const isSuccessful = kind === 'transaction_settled' || kind === 'subscription_charged_successfully';
    const gatewayTxId = data.subject?.id || data.gatewayTxId || data.id;

    return {
      eventType: kind,
      isSuccessful,
      gatewayTxId,
      metadata: {},
    };
  }

  async verifyPaymentStatus(gatewayTxId) {
    return {
      isPaid: true,
      status: 'settled',
      gatewayTxId,
    };
  }
}

export default BraintreeAdapter;
