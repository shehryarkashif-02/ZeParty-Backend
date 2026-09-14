import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  hashPayload,
  checkIdempotency,
  setInProgress,
  storeResult,
  clearLock,
} from '../src/utils/idempotency.util.js';

describe('Phase 3 Financial Idempotency & Distributed Lock Suite', () => {
  it('prevents duplicate financial mutations and returns cached result on replay', async () => {
    const key = `fin-idemp-test-${Date.now()}-${Math.random()}`;
    const payload = { targetUserId: 'u-1', amount: '10000', asset: 'COINS' };
    const pHash = hashPayload(payload);

    // Initial check returns NEW
    const check1 = await checkIdempotency(key, pHash);
    assert.strictEqual(check1.state, 'NEW');

    // Acquire lock
    await setInProgress(key, pHash);

    // Concurrent request returns IN_PROGRESS
    const check2 = await checkIdempotency(key, pHash);
    assert.strictEqual(check2.state, 'IN_PROGRESS');

    // Store completed result
    const mockResult = { success: true, referenceId: 'TXN-998811' };
    await storeResult(key, pHash, 200, mockResult);

    // Subsequent request returns COMPLETED with identical body
    const check3 = await checkIdempotency(key, pHash);
    assert.strictEqual(check3.state, 'COMPLETED');
    assert.strictEqual(check3.statusCode, 200);
    const body = check3.responseBody || check3.body;
    assert.strictEqual(body.referenceId, 'TXN-998811');
  });

  it('detects payload conflict when same key is submitted with different parameters', async () => {
    const key = `conflict-key-${Date.now()}`;
    const payloadA = { amount: 500, user: 'u1' };
    const payloadB = { amount: 1000, user: 'u1' };

    const hashA = hashPayload(payloadA);
    const hashB = hashPayload(payloadB);

    await setInProgress(key, hashA);

    const checkConflict = await checkIdempotency(key, hashB);
    assert.strictEqual(checkConflict.state, 'CONFLICT');
  });

  it('allows lock clearing on error to permit retries', async () => {
    const key = `retry-key-${Date.now()}`;
    const pHash = hashPayload({ retry: true });

    await setInProgress(key, pHash);
    await clearLock(key);

    const check = await checkIdempotency(key, pHash);
    assert.strictEqual(check.state, 'NEW');
  });
});
