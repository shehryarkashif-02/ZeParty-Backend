import crypto from 'crypto';
import PaymentAdapterInterface from './paymentAdapter.interface.js';

export class StripeAdapter extends PaymentAdapterInterface {
  async createPaymentIntent({ orderId, amountUSD, currency = 'USD', metadata = {} }) {
    const amountInCents = Math.round(Number(amountUSD) * 100);
    const mockGatewayTxId = `pi_${crypto.randomBytes(12).toString('hex')}`;
    const mockClientSecret = `${mockGatewayTxId}_secret_${crypto.randomBytes(16).toString('hex')}`;

    return {
      gatewayTxId: mockGatewayTxId,
      clientSecret: mockClientSecret,
      amountUSD: Number(amountUSD),
      currency: currency.toUpperCase(),
      metadata: {
        ...metadata,
        orderId,
        amountInCents,
      },
    };
  }

  async verifyWebhookSignature({ rawBody, signature, webhookSecret }) {
    if (!signature || !webhookSecret) return false;

    try {
      // Signature header format: "t=1492774577,v1=5257a869e7ecebeda32affa62cd493d83ce733f1fc7363eeac5c03160a0a0f2d"
      const items = signature.split(',').reduce((acc, item) => {
        const [k, v] = item.trim().split('=');
        if (k && v) acc[k] = v;
        return acc;
      }, {});

      const timestamp = items.t;
      const expectedSignature = items.v1;

      if (!timestamp || !expectedSignature) {
        // Direct HMAC match fallback if plain hex passed
        const hmac = crypto.createHmac('sha256', webhookSecret).update(String(rawBody)).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(hmac, 'utf8'), Buffer.from(signature, 'utf8'));
      }

      const payloadToSign = `${timestamp}.${typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody)}`;
      const computedHmac = crypto.createHmac('sha256', webhookSecret).update(payloadToSign).digest('hex');

      if (computedHmac.length !== expectedSignature.length) return false;
      return crypto.timingSafeEqual(Buffer.from(computedHmac, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
    } catch {
      return false;
    }
  }

  parseWebhookEvent(payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const type = data.type || 'unknown';
    const isSuccessful = type === 'payment_intent.succeeded' || type === 'checkout.session.completed';
    const obj = data.data?.object || data;
    const gatewayTxId = obj.id || obj.payment_intent || data.gatewayTxId;
    const amountUSD = obj.amount ? obj.amount / 100 : undefined;

    return {
      eventType: type,
      isSuccessful,
      gatewayTxId,
      amountUSD,
      metadata: obj.metadata || {},
    };
  }

  async verifyPaymentStatus(gatewayTxId) {
    return {
      isPaid: true,
      status: 'succeeded',
      gatewayTxId,
    };
  }
}

export default StripeAdapter;
