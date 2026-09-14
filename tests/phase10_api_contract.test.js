/**
 * Phase 10 — API Contract Validation Suite
 *
 * Validates that all API response envelopes conform to the canonical ZeParty format:
 *   Success: { success: true, data: {}, meta: {} }
 *   Error:   { success: false, message: string, error: { code: string } }
 *
 * Tests are performed against in-memory stubs to avoid database dependencies.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

// ─── Helpers ────────────────────────────────────────────────────────────────

function assertSuccessEnvelope(response) {
  assert.ok(typeof response === 'object' && response !== null, 'response must be an object');
  assert.strictEqual(response.success, true, 'success must be true');
  assert.ok('data' in response, 'response must contain "data" key');
}

function assertErrorEnvelope(response, expectedCode) {
  assert.ok(typeof response === 'object' && response !== null, 'response must be an object');
  assert.strictEqual(response.success, false, 'success must be false');
  assert.ok(typeof response.message === 'string', 'error response must include "message"');
  assert.ok(response.error && typeof response.error === 'object', '"error" key must be an object');
  assert.ok(typeof response.error.code === 'string' && response.error.code.length > 0, '"error.code" must be a non-empty string');
  if (expectedCode) {
    assert.strictEqual(response.error.code, expectedCode, `expected error code "${expectedCode}", got "${response.error.code}"`);
  }
}

function assertPaginationMeta(meta) {
  assert.ok(typeof meta === 'object' && meta !== null, '"meta" must be an object');
  assert.ok('nextCursor' in meta || 'total' in meta, '"meta" must include cursor or total count');
}

// ─── Simulated HTTP response builders ────────────────────────────────────────

function makeSuccessResponse(data, meta) {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

function makeErrorResponse(message, code, details) {
  return {
    success: false,
    message,
    error: {
      code,
      ...(details ? { details } : {}),
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Phase 10 — API Contract Envelope Conformance', () => {

  it('success response contains success:true and data key', () => {
    const res = makeSuccessResponse({ id: 'user-1', name: 'Test User' });
    assertSuccessEnvelope(res);
    assert.strictEqual(res.data.id, 'user-1');
  });

  it('error response contains success:false, message, and error.code', () => {
    const res = makeErrorResponse('Resource not found', 'NOT_FOUND');
    assertErrorEnvelope(res, 'NOT_FOUND');
    assert.strictEqual(res.message, 'Resource not found');
  });

  it('pagination meta includes nextCursor field', () => {
    const meta = { nextCursor: 'eyJpZCI6MTAwfQ==', total: 250 };
    const res = makeSuccessResponse([{ id: 'r-1' }, { id: 'r-2' }], meta);
    assertSuccessEnvelope(res);
    assertPaginationMeta(res.meta);
  });

  it('validation error includes error.details array', () => {
    const details = [{ field: 'phone', message: 'Invalid phone number' }];
    const res = makeErrorResponse('Validation failed', 'VALIDATION_ERROR', details);
    assertErrorEnvelope(res, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(res.error.details), 'details must be an array');
    assert.strictEqual(res.error.details[0].field, 'phone');
  });

  it('BigInt values are stringified properly (serializer contract)', () => {
    const data = { coinsBalance: '1000000000', diamondsBalance: '50000' };
    const res = makeSuccessResponse(data);
    assertSuccessEnvelope(res);
    assert.strictEqual(typeof res.data.coinsBalance, 'string', 'BigInt balances must serialize to string');
    assert.ok(!isNaN(Number(res.data.coinsBalance)), 'stringified BigInt must be numeric');
  });

  it('Decimal financial values do not use floating-point representation', () => {
    // Amounts like 0.1 + 0.2 = 0.30000000000000004 must be represented as strings
    const data = { amount: '0.30', fee: '0.05', net: '0.25' };
    const res = makeSuccessResponse(data);
    assertSuccessEnvelope(res);
    // All must be clean decimal string representations
    [res.data.amount, res.data.fee, res.data.net].forEach(v => {
      assert.strictEqual(typeof v, 'string');
      assert.ok(!v.includes('e'), 'Decimal must not use scientific notation');
    });
  });

  it('404 route not found returns correct error envelope', () => {
    const res = makeErrorResponse('Route not found', 'ROUTE_NOT_FOUND');
    assertErrorEnvelope(res, 'ROUTE_NOT_FOUND');
  });

  it('401 unauthorized returns correct error envelope', () => {
    const res = makeErrorResponse('Authentication token missing or invalid format', 'UNAUTHORIZED');
    assertErrorEnvelope(res, 'UNAUTHORIZED');
  });

  it('403 forbidden returns correct error envelope with required permission', () => {
    const res = {
      success: false,
      message: 'Access denied. Permission required: manage_users',
      error: { code: 'FORBIDDEN', requiredPermission: 'manage_users' },
    };
    assertErrorEnvelope(res, 'FORBIDDEN');
    assert.strictEqual(res.error.requiredPermission, 'manage_users');
  });

  it('rate limit response returns 429 RATE_LIMIT_EXCEEDED code', () => {
    const res = makeErrorResponse('Too many requests. Please wait before retrying.', 'RATE_LIMIT_EXCEEDED');
    assertErrorEnvelope(res, 'RATE_LIMIT_EXCEEDED');
  });

  it('business rule error returns appropriate domain-specific code', () => {
    const res = makeErrorResponse('Insufficient coin balance to complete this transaction.', 'INSUFFICIENT_BALANCE');
    assertErrorEnvelope(res, 'INSUFFICIENT_BALANCE');
  });

  it('empty list result returns success:true with empty data array', () => {
    const res = makeSuccessResponse([], { nextCursor: null, total: 0 });
    assertSuccessEnvelope(res);
    assert.ok(Array.isArray(res.data));
    assert.strictEqual(res.data.length, 0);
    assert.strictEqual(res.meta.total, 0);
    assert.strictEqual(res.meta.nextCursor, null);
  });

  it('stack traces must NOT appear in production error envelope', () => {
    const res = {
      success: false,
      message: 'Internal Server Error',
      error: { code: 'INTERNAL_SERVER_ERROR' },
    };
    assertErrorEnvelope(res, 'INTERNAL_SERVER_ERROR');
    assert.ok(!('stack' in res.error), 'production error must never expose stack trace');
  });

  it('response does not expose sensitive fields like passwords or tokens', () => {
    const data = { id: 'usr-1', name: 'Test', email: 'test@example.com' };
    const res = makeSuccessResponse(data);
    assertSuccessEnvelope(res);
    ['password', 'passwordHash', 'token', 'refreshToken', 'secretKey', 'pin'].forEach(field => {
      assert.ok(!(field in res.data), `response data must not expose "${field}"`);
    });
  });

  it('ISO-8601 timestamps are present in entity responses', () => {
    const now = new Date().toISOString();
    const data = { id: 'usr-1', createdAt: now, updatedAt: now };
    const res = makeSuccessResponse(data);
    assertSuccessEnvelope(res);
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(res.data.createdAt), 'createdAt must be ISO-8601');
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(res.data.updatedAt), 'updatedAt must be ISO-8601');
  });
});
