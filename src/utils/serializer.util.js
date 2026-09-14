/**
 * ZeParty Global Serialization Utility
 * 
 * Provides safe serialization for:
 * 1. BigInt values (coins, diamonds, experience points) -> string representation
 * 2. Prisma Decimal / Decimal.js objects (fiat currency amounts) -> string representation
 * 3. Handles nested objects, arrays, Maps, Sets, and prevents circular reference errors
 */

/**
 * Checks if a value is a Prisma/Decimal.js instance
 */
function isDecimal(value) {
  if (!value || typeof value !== 'object') return false;
  return (
    value.isDecimal === true ||
    (typeof value.toFixed === 'function' &&
     typeof value.toNumber === 'function' &&
     typeof value.toString === 'function' &&
     typeof value === 'object' &&
     !(value instanceof Date))
  );
}

/**
 * Recursively sanitizes any data structure converting BigInt and Decimal into JSON-safe strings.
 * 
 * @param {any} data - Input data structure
 * @param {WeakSet} [seen] - Set of visited objects to prevent circular loops
 * @returns {any} JSON-safe sanitized data
 */
export function serializeData(data, seen = new WeakSet()) {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle BigInt
  if (typeof data === 'bigint') {
    return data.toString();
  }

  // Handle Primitives
  if (typeof data !== 'object') {
    return data;
  }

  // Handle Dates (keep as Date or ISO string)
  if (data instanceof Date) {
    return data;
  }

  // Handle Prisma / Decimal.js objects
  if (isDecimal(data)) {
    return data.toString();
  }

  // Prevent Circular References
  if (seen.has(data)) {
    return '[Circular]';
  }
  seen.add(data);

  // Handle Arrays
  if (Array.isArray(data)) {
    return data.map((item) => serializeData(item, seen));
  }

  // Handle Sets
  if (data instanceof Set) {
    return Array.from(data).map((item) => serializeData(item, seen));
  }

  // Handle Maps
  if (data instanceof Map) {
    const obj = {};
    for (const [key, value] of data.entries()) {
      obj[String(key)] = serializeData(value, seen);
    }
    return obj;
  }

  // Handle Plain Objects and Class instances
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = serializeData(value, seen);
  }

  return result;
}

/**
 * Express Middleware that intercepts res.json to automatically serialize
 * BigInt and Decimal values before JSON stringification.
 */
export function serializerMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    try {
      const sanitized = serializeData(body);
      return originalJson(sanitized);
    } catch (err) {
      if (req.log) {
        req.log.warn({ err }, 'Serialization middleware fallback triggered');
      }
      return originalJson(body);
    }
  };

  next();
}

export default {
  serializeData,
  serializerMiddleware,
};
