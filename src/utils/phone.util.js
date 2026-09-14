/**
 * Normalizes phone numbers to standard E.164 format (+[country][number]).
 * Strips non-digit characters except leading plus sign.
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

export default {
  normalizePhone,
};
