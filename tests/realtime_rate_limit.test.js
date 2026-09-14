import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkSocketRateLimit, withRateLimit } from '../src/socket/rateLimiter.socket.js';
import { SOCKET_ERRORS } from '../src/socket/socket.constants.js';

describe('Phase 4 — Realtime Socket Rate Limiter Specification Suite', () => {
  it('allows actions within the specified rate limit threshold', async () => {
    const socketId = `sock_rl_${Date.now()}_1`;
    const action = 'SEAT_CLICK';

    // Limit 3 per 1000ms
    const r1 = await checkSocketRateLimit(socketId, action, 3, 1000);
    const r2 = await checkSocketRateLimit(socketId, action, 3, 1000);
    const r3 = await checkSocketRateLimit(socketId, action, 3, 1000);

    assert.strictEqual(r1.allowed, true);
    assert.strictEqual(r2.allowed, true);
    assert.strictEqual(r3.allowed, true);
  });

  it('blocks actions exceeding the rate limit threshold with retryAfter info', async () => {
    const socketId = `sock_rl_${Date.now()}_2`;
    const action = 'FAST_SPAM';

    // Limit 2 per 1000ms
    await checkSocketRateLimit(socketId, action, 2, 1000);
    await checkSocketRateLimit(socketId, action, 2, 1000);

    const rBlocked = await checkSocketRateLimit(socketId, action, 2, 1000);
    assert.strictEqual(rBlocked.allowed, false);
    assert.ok(rBlocked.retryAfterMs > 0);
  });

  it('wraps handler with withRateLimit and emits error when exceeded', async () => {
    const socketId = `sock_rl_wrap_${Date.now()}`;
    let handlerCalled = 0;
    let errorResponse = null;

    const mockSocket = {
      id: socketId,
      emit: (event, payload) => {
        errorResponse = payload;
      },
    };

    const targetHandler = async () => {
      handlerCalled += 1;
    };

    const wrappedHandler = withRateLimit('WRAPPED_TEST', 1, 1000, targetHandler);

    // Call 1: Allowed
    await wrappedHandler(mockSocket, {}, () => {});
    assert.strictEqual(handlerCalled, 1);

    // Call 2: Rate limited
    await wrappedHandler(mockSocket, {}, (err) => {
      errorResponse = err;
    });
    assert.strictEqual(handlerCalled, 1);
    assert.strictEqual(errorResponse?.success, false);
    assert.strictEqual(errorResponse?.error?.code, SOCKET_ERRORS.RATE_LIMIT_EXCEEDED);
  });
});
