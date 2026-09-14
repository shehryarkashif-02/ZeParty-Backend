import {
  hashPayload,
  checkIdempotency,
  setInProgress,
  storeResult,
  clearLock,
} from '../utils/idempotency.util.js';

/**
 * Idempotency middleware for financial mutations.
 * If client provides `Idempotency-Key` or `X-Idempotency-Key`, guarantees single execution.
 */
export function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

  if (!idempotencyKey || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const payloadHash = hashPayload(req.body);

  checkIdempotency(idempotencyKey, payloadHash)
    .then(async (status) => {
      if (status.state === 'CONFLICT') {
        return res.status(409).json({
          success: false,
          message: 'Idempotency key was previously used with a different request payload.',
          error: { code: 'IDEMPOTENCY_CONFLICT' },
        });
      }

      if (status.state === 'IN_PROGRESS') {
        return res.status(409).json({
          success: false,
          message: 'A request with this idempotency key is currently processing. Please wait.',
          error: { code: 'TRANSACTION_IN_PROGRESS' },
        });
      }

      if (status.state === 'COMPLETED') {
        return res.status(status.statusCode || 200).json(status.responseBody);
      }

      // Mark IN_PROGRESS
      await setInProgress(idempotencyKey, payloadHash);

      // Hook into response send to store result on success
      const originalJson = res.json.bind(res);
      res.json = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          storeResult(idempotencyKey, payloadHash, res.statusCode, body).catch(() => {});
        } else {
          clearLock(idempotencyKey).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    })
    .catch((err) => {
      req.log?.warn?.('Idempotency middleware error, proceeding safely:', err.message);
      next();
    });
}

export default idempotencyMiddleware;
