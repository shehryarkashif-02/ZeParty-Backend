import StripeAdapter from './stripe.adapter.js';
import PayPalAdapter from './paypal.adapter.js';
import BraintreeAdapter from './braintree.adapter.js';
import MockPaymentAdapter from './mock.adapter.js';

const adapters = {
  STRIPE: StripeAdapter,
  PAYPAL: PayPalAdapter,
  BRAINTREE: BraintreeAdapter,
  MOCK: MockPaymentAdapter,
  BINANCE_PAY: MockPaymentAdapter,
};

/**
 * Resolves a payment adapter instance for a given gateway provider.
 * @param {string} provider - e.g. "STRIPE", "PAYPAL", "BRAINTREE", "MOCK"
 * @param {Object} [config={}] - Decrypted credentials & configuration for provider
 * @returns {PaymentAdapterInterface}
 */
export function getPaymentAdapter(provider, config = {}) {
  const normalized = String(provider || '').toUpperCase().trim();
  const AdapterClass = adapters[normalized] || MockPaymentAdapter;
  return new AdapterClass(config);
}

export default {
  getPaymentAdapter,
};
