import redisClient from '../config/redis.js';
import { SOCKET_ERRORS } from './socket.constants.js';

const inMemoryRateLimits = new Map(); // key -> { count, resetAt }

/**
 * Checks if a socket action from a user is within the allowed rate limit.
 * 
 * @param {string} userId - Authenticated user identifier
 * @param {string} action - Action identifier (e.g. 'GIFT', 'SEAT', 'JOIN')
 * @param {number} [maxAllowed=10] - Max requests in time window
 * @param {number} [windowMs=1000] - Window duration in milliseconds
 * @returns {Promise<boolean>} True if allowed, false if rate limited
 */
export async function checkSocketRateLimit(userIdOrSocketId, action, maxAllowed = 10, windowMs = 1000) {
  if (!userIdOrSocketId) return { allowed: true, remaining: maxAllowed, retryAfterMs: 0 };

  const key = `ratelimit:socket:${userIdOrSocketId}:${action}`;
  const now = Date.now();

  if (redisClient.isOpen) {
    try {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.pExpire(key, windowMs);
      }
      const allowed = count <= maxAllowed;
      const ttl = await redisClient.pTTL(key);
      return {
        allowed,
        remaining: Math.max(0, maxAllowed - count),
        retryAfterMs: allowed ? 0 : Math.max(0, ttl),
      };
    } catch (err) {
      // Fallback to in-memory
    }
  }

  // In-memory rate limiting fallback
  const record = inMemoryRateLimits.get(key);
  if (!record || now > record.resetAt) {
    inMemoryRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxAllowed - 1,
      retryAfterMs: 0,
    };
  }

  record.count += 1;
  const allowed = record.count <= maxAllowed;
  const retryAfterMs = allowed ? 0 : Math.max(0, record.resetAt - now);

  return {
    allowed,
    remaining: Math.max(0, maxAllowed - record.count),
    retryAfterMs,
  };
}

/**
 * Wraps a socket event handler with rate limiting.
 */
export function withRateLimit(action, maxAllowed, windowMs, handler) {
  return async function (socket, data, callback) {
    const rateKey = socket.userId || socket.id;
    const limit = await checkSocketRateLimit(rateKey, action, maxAllowed, windowMs);
    if (!limit.allowed) {
      const errResponse = {
        success: false,
        error: {
          code: SOCKET_ERRORS.RATE_LIMIT_EXCEEDED,
          message: `Too many ${action.toLowerCase()} requests. Please wait.`,
          retryAfterMs: limit.retryAfterMs,
        },
      };
      if (typeof callback === 'function') {
        return callback(errResponse);
      }
      socket.emit('error', errResponse);
      return;
    }
    return await handler(socket, data, callback);
  };
}

export default {
  checkSocketRateLimit,
  withRateLimit,
};
