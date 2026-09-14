/**
 * Utility for safe serialization of BigInt and Prisma Decimal values
 * into strings to prevent JSON.stringify crashes and precision loss.
 */

export function sanitizeFinancial(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  // Handle Prisma Decimal or objects with toString methods for numerics
  if (typeof obj === 'object' && obj.isDecimal) {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeFinancial(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'bigint') {
        sanitized[key] = value.toString();
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else if (value && typeof value === 'object' && value.isDecimal) {
        sanitized[key] = value.toString();
      } else if (value && typeof value === 'object') {
        sanitized[key] = sanitizeFinancial(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return obj;
}

export default {
  sanitizeFinancial,
};
