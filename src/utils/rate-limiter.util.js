import redisClient from '../config/redis.js';

const memoryStore = new Map();

/**
 * Redis-backed Rate Limiter with graceful in-memory fallback.
 * Limits the number of attempts for a given key within a window in seconds.
 * 
 * @param {Object} options
 * @param {string} options.key - Unique key (e.g. `rate:otp:phone:+1234567890`)
 * @param {number} options.limit - Max allowed occurrences (e.g. 5)
 * @param {number} options.windowSeconds - Time window in seconds (e.g. 300)
 * @returns {Promise<{ allowed: boolean, remaining: number, resetSeconds: number }>}
 */
export async function checkRateLimit({ key, limit = 5, windowSeconds = 300 }) {
  try {
    if (redisClient.isOpen) {
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, windowSeconds);
      }
      const ttl = await redisClient.ttl(key);
      const allowed = current <= limit;
      return {
        allowed,
        remaining: Math.max(0, limit - current),
        resetSeconds: ttl > 0 ? ttl : windowSeconds,
      };
    }
  } catch (err) {
    console.warn(`[RateLimiter] Redis error for key ${key}, using in-memory fallback:`, err.message);
  }

  // In-memory fallback
  const now = Date.now();
  const entry = memoryStore.get(key) || { count: 0, expiresAt: now + windowSeconds * 1000 };

  if (now > entry.expiresAt) {
    entry.count = 1;
    entry.expiresAt = now + windowSeconds * 1000;
  } else {
    entry.count += 1;
  }

  memoryStore.set(key, entry);

  const allowed = entry.count <= limit;
  const resetSeconds = Math.ceil((entry.expiresAt - now) / 1000);

  return {
    allowed,
    remaining: Math.max(0, limit - entry.count),
    resetSeconds: Math.max(0, resetSeconds),
  };
}

export default {
  checkRateLimit,
};
