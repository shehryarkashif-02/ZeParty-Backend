import crypto from 'crypto';
import redisClient from '../config/redis.js';

const inMemoryIdempotencyStore = new Map();

/**
 * Generates a SHA-256 hash of a request payload to detect conflicting requests
 * submitted with the same Idempotency-Key.
 */
export function hashPayload(payload) {
  if (!payload || Object.keys(payload).length === 0) return '';
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Checks the status of an idempotency key.
 *
 * @param {string} key - The client-provided idempotency key (e.g. from `Idempotency-Key` header)
 * @param {string} payloadHash - SHA-256 hash of the request body
 * @returns {Promise<{
 *   state: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CONFLICT',
 *   statusCode?: number,
 *   responseBody?: any
 * }>}
 */
export async function checkIdempotency(key, payloadHash) {
  if (!key) return { state: 'NEW' };

  const storageKey = `idempotency:${key}`;

  try {
    if (redisClient.isOpen) {
      const raw = await redisClient.get(storageKey);
      if (raw) {
        const record = JSON.parse(raw);
        if (record.payloadHash !== payloadHash) {
          return { state: 'CONFLICT' };
        }
        if (record.state === 'IN_PROGRESS') {
          return { state: 'IN_PROGRESS' };
        }
        return {
          state: 'COMPLETED',
          statusCode: record.statusCode,
          responseBody: record.responseBody,
        };
      }
    }
  } catch (err) {
    // Redis read failure fallback to in-memory store
  }

  const memoryRecord = inMemoryIdempotencyStore.get(storageKey);
  if (memoryRecord) {
    if (Date.now() > memoryRecord.expiresAt) {
      inMemoryIdempotencyStore.delete(storageKey);
      return { state: 'NEW' };
    }
    if (memoryRecord.payloadHash !== payloadHash) {
      return { state: 'CONFLICT' };
    }
    if (memoryRecord.state === 'IN_PROGRESS') {
      return { state: 'IN_PROGRESS' };
    }
    return {
      state: 'COMPLETED',
      statusCode: memoryRecord.statusCode,
      responseBody: memoryRecord.responseBody,
    };
  }

  return { state: 'NEW' };
}

/**
 * Marks an idempotency key as IN_PROGRESS (distributed lock) during execution.
 */
export async function setInProgress(key, payloadHash, ttlSeconds = 60) {
  if (!key) return;
  const storageKey = `idempotency:${key}`;
  const record = { state: 'IN_PROGRESS', payloadHash, createdAt: Date.now() };

  try {
    if (redisClient.isOpen) {
      await redisClient.set(storageKey, JSON.stringify(record), { EX: ttlSeconds });
      return;
    }
  } catch (err) {
    // Redis write failure fallback
  }

  inMemoryIdempotencyStore.set(storageKey, {
    ...record,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Stores the final result of an idempotent operation.
 */
export async function storeResult(key, payloadHash, statusCode, responseBody, ttlSeconds = 86400) {
  if (!key) return;
  const storageKey = `idempotency:${key}`;
  const record = {
    state: 'COMPLETED',
    payloadHash,
    statusCode,
    responseBody,
    completedAt: Date.now(),
  };

  try {
    if (redisClient.isOpen) {
      await redisClient.set(storageKey, JSON.stringify(record), { EX: ttlSeconds });
      return;
    }
  } catch (err) {
    // Fallback to memory
  }

  inMemoryIdempotencyStore.set(storageKey, {
    ...record,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Clears an in-progress lock if an operation fails before completion.
 */
export async function clearLock(key) {
  if (!key) return;
  const storageKey = `idempotency:${key}`;

  try {
    if (redisClient.isOpen) {
      await redisClient.del(storageKey);
      return;
    }
  } catch (err) {
    // Fallback
  }

  inMemoryIdempotencyStore.delete(storageKey);
}

export default {
  hashPayload,
  checkIdempotency,
  setInProgress,
  storeResult,
  clearLock,
};
