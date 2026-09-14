import crypto from 'crypto';

/**
 * Generates unique, cryptographically random financial transaction and reference identifiers.
 *
 * @param {string} prefix - Reference category prefix (e.g. 'TXN', 'OFF', 'WD', 'REF', 'ADJ', 'APP')
 * @returns {string} Unique reference ID (e.g. 'TXN-9f8a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c')
 */
export function generateReference(prefix = 'TXN') {
  const uuid = crypto.randomUUID();
  return `${prefix.toUpperCase()}-${uuid}`;
}

export default {
  generateReference,
};
