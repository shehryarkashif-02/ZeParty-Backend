/**
 * Base Interface for Payment Provider Adapters in ZeParty.
 * Defines standard contract for intent creation, webhook signature verification,
 * event parsing, and status queries.
 */
export class PaymentAdapterInterface {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Creates a payment intent or checkout order with the provider.
   * @param {Object} params
   * @param {string} params.orderId - Internal recharge transaction ID
   * @param {number} params.amountUSD - Price in USD
   * @param {string} [params.currency='USD'] - ISO currency code
   * @param {Object} [params.metadata] - Additional tracking metadata
   * @returns {Promise<{ gatewayTxId: string, clientSecret?: string, checkoutUrl?: string, metadata?: Object }>}
   */
  async createPaymentIntent(params) {
    throw new Error('createPaymentIntent must be implemented by adapter subclass.');
  }

  /**
   * Cryptographically verifies the provider's incoming webhook signature.
   * @param {Object} params
   * @param {string|Buffer} params.rawBody - Raw webhook request body
   * @param {string} params.signature - Signature header from provider
   * @param {string} params.webhookSecret - Decrypted webhook signing secret
   * @returns {Promise<boolean>}
   */
  async verifyWebhookSignature(params) {
    throw new Error('verifyWebhookSignature must be implemented by adapter subclass.');
  }

  /**
   * Parses and normalizes the webhook payload into a standardized event structure.
   * @param {Object} payload - Raw or JSON-parsed webhook body
   * @returns {{ eventType: string, isSuccessful: boolean, gatewayTxId: string, amountUSD?: number, metadata?: Object }}
   */
  parseWebhookEvent(payload) {
    throw new Error('parseWebhookEvent must be implemented by adapter subclass.');
  }

  /**
   * Directly verifies the status of a transaction against the provider API.
   * @param {string} gatewayTxId - Provider transaction/order reference
   * @returns {Promise<{ isPaid: boolean, status: string, amountUSD?: number }>}
   */
  async verifyPaymentStatus(gatewayTxId) {
    throw new Error('verifyPaymentStatus must be implemented by adapter subclass.');
  }
}

export default PaymentAdapterInterface;
