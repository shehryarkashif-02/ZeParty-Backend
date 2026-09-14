import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  hashPayload,
  checkIdempotency,
  setInProgress,
  storeResult,
} from '../src/utils/idempotency.util.js';

describe('Phase 5 Settlement Idempotency & Replay Protection Suite', () => {
  it('protects settlement payment execution from duplicate execution on replay', async () => {
    const key = `settlement-pay-idemp-${Date.now()}`;
    const payload = { settlementRecordId: 'sr-idemp-01' };
    const pHash = hashPayload(payload);

    // Initial check
    const check1 = await checkIdempotency(key, pHash);
    assert.strictEqual(check1.state, 'NEW');

    // Acquire lock
    await setInProgress(key, pHash);

    // Save success response
    const mockResponse = {
      success: true,
      message: 'Settlement payout executed successfully.',
      data: { referenceId: 'SETTLE-771122' },
    };
    await storeResult(key, pHash, 200, mockResponse);

    // Replayed request returns cached response
    const check2 = await checkIdempotency(key, pHash);
    assert.strictEqual(check2.state, 'COMPLETED');
    const body = check2.responseBody || check2.body;
    assert.strictEqual(body.data.referenceId, 'SETTLE-771122');
  });

  it('detects parameter conflict on duplicate calculation requests', async () => {
    const key = `settlement-calc-conflict-${Date.now()}`;
    const payloadA = { periodCode: '2026-08-W1', entityType: 'HOST' };
    const payloadB = { periodCode: '2026-08-W1', entityType: 'AGENCY' }; // Different entityType

    const hashA = hashPayload(payloadA);
    const hashB = hashPayload(payloadB);

    await setInProgress(key, hashA);

    const check = await checkIdempotency(key, hashB);
    assert.strictEqual(check.state, 'CONFLICT');
  });
});
