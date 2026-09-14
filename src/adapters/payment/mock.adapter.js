import crypto from 'crypto';
import PaymentAdapterInterface from './paymentAdapter.interface.js';

export class MockPaymentAdapter extends PaymentAdapterInterface {
  async createPaymentIntent({ orderId, amountUSD, currency = 'USD', metadata = {} }) {
    const mockGatewayTxId = `mock_tx_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    return {
      gatewayTxId: mockGatewayTxId,
      clientSecret: `mock_secret_${mockGatewayTxId}`,
      checkoutUrl: `https://payments.zeparty.com/mock-checkout?tx=${mockGatewayTxId}`,
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
      const computed = crypto.createHmac('sha256', webhookSecret).update(String(rawBody)).digest('hex');
      if (computed.length !== signature.length) return false;
      return crypto.timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(signature, 'utf8'));
    } catch {
      return false;
    }
  }

  parseWebhookEvent(payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const eventType = data.event || data.type || 'payment.success';
    const isSuccessful = eventType === 'payment.success' || data.status === 'COMPLETED';
    const gatewayTxId = data.gatewayTxId || data.txId || data.id;
    const amountUSD = data.amountUSD ? Number(data.amountUSD) : undefined;

    return {
      eventType,
      isSuccessful,
      gatewayTxId,
      amountUSD,
      metadata: data.metadata || {},
    };
  }

  async verifyPaymentStatus(gatewayTxId) {
    return {
      isPaid: true,
      status: 'SUCCESS',
      gatewayTxId,
    };
  }
}

export default MockPaymentAdapter;
