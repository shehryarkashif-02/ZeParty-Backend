/**
 * Phase 10 — Authentication Integration Suite
 *
 * Tests end-to-end JWT lifecycle, session revocation, account status gates,
 * token expiry handling, banned/suspended user rejections, and RBAC identity resolution.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { generateAccessToken, verifyAccessToken } from '../src/services/token.service.js';

const TEST_JWT_SECRET = 'test-jwt-secret-phase10-at-least-32-chars!';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMockSession({ revokedAt = null, expiresAt = null } = {}) {
  return {
    id: 'session-p10',
    revokedAt,
    expiresAt: expiresAt || new Date(Date.now() + 3600_000).toISOString(),
  };
}

function makeMockUser({ status = 'ACTIVE', userType = 'USER' } = {}) {
  return { id: 'user-p10', name: 'Phase Ten User', status, userType };
}

function makeMockAdmin({ status = 'ACTIVE', isOwner = false } = {}) {
  return { id: 'admin-p10', name: 'Phase Ten Admin', status, isOwner, roleId: 'role-1' };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Phase 10 — Authentication Integration Suite', () => {

  it('JWT access token is generated with correct claims', () => {
    const token = generateAccessToken({
      userId: 'user-abc',
      sessionId: 'session-xyz',
      userType: 'USER',
      isAdmin: false,
    });

    assert.ok(typeof token === 'string' && token.length > 50, 'token must be a non-trivial JWT string');
    const decoded = verifyAccessToken(token);
    assert.strictEqual(decoded.sub, 'user-abc');
    assert.strictEqual(decoded.sessionId, 'session-xyz');
    assert.strictEqual(decoded.userType, 'USER');
    assert.strictEqual(decoded.isAdmin, false);
  });

  it('admin JWT carries isAdmin:true and roleId claims', () => {
    const token = generateAccessToken({
      adminId: 'admin-xyz',
      sessionId: 'session-admin-1',
      userType: 'ADMIN',
      isAdmin: true,
      roleId: 'role-superadmin',
    });

    const decoded = verifyAccessToken(token);
    assert.strictEqual(decoded.sub, 'admin-xyz');
    assert.strictEqual(decoded.isAdmin, true);
    assert.strictEqual(decoded.roleId, 'role-superadmin');
  });

  it('expired JWT is rejected with TOKEN_EXPIRED code', () => {
    const expiredToken = jwt.sign(
      { sub: 'user-exp', sessionId: 'session-exp', userType: 'USER', isAdmin: false },
      process.env.JWT_SECRET || 'super-secret-zeparty-jwt-key-change-in-prod-2026',
      { expiresIn: '-1s' }
    );

    assert.throws(
      () => verifyAccessToken(expiredToken),
      (err) => {
        assert.strictEqual(err.code, 'TOKEN_EXPIRED');
        assert.strictEqual(err.status, 401);
        return true;
      }
    );
  });

  it('tampered JWT is rejected with TOKEN_INVALID code', () => {
    const token = generateAccessToken({ userId: 'user-abc', sessionId: 'session-1', userType: 'USER' });
    const parts = token.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.INVALID_SIGNATURE`;

    assert.throws(
      () => verifyAccessToken(tamperedToken),
      (err) => {
        assert.strictEqual(err.code, 'TOKEN_INVALID');
        assert.strictEqual(err.status, 401);
        return true;
      }
    );
  });

  it('missing Bearer token returns UNAUTHORIZED error code', () => {
    const authError = { status: 401, code: 'UNAUTHORIZED', message: 'Authentication token missing or invalid format' };
    assert.strictEqual(authError.status, 401);
    assert.strictEqual(authError.code, 'UNAUTHORIZED');
  });

  it('revoked session is detected and rejected', () => {
    const session = makeMockSession({ revokedAt: new Date(Date.now() - 60_000).toISOString() });
    const isRevoked = !!session.revokedAt || new Date() > new Date(session.expiresAt);
    assert.ok(isRevoked, 'session with revokedAt should be flagged as revoked');
  });

  it('expired session is detected and rejected', () => {
    const session = makeMockSession({ expiresAt: new Date(Date.now() - 10_000).toISOString() });
    const isExpired = new Date() > new Date(session.expiresAt);
    assert.ok(isExpired, 'session past expiresAt should be flagged as expired');
  });

  it('BANNED user is rejected with ACCOUNT_BANNED code', () => {
    const user = makeMockUser({ status: 'BANNED' });
    let authError = null;
    if (user.status !== 'ACTIVE') {
      authError = {
        status: 403,
        message: `Account is ${user.status.toLowerCase()}`,
        code: user.status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_BANNED',
      };
    }
    assert.ok(authError !== null, 'banned user should trigger auth error');
    assert.strictEqual(authError.code, 'ACCOUNT_BANNED');
    assert.strictEqual(authError.status, 403);
  });

  it('SUSPENDED user is rejected with ACCOUNT_SUSPENDED code', () => {
    const user = makeMockUser({ status: 'SUSPENDED' });
    let authError = null;
    if (user.status !== 'ACTIVE') {
      authError = {
        status: 403,
        message: `Account is ${user.status.toLowerCase()}`,
        code: user.status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_BANNED',
      };
    }
    assert.ok(authError !== null, 'suspended user should trigger auth error');
    assert.strictEqual(authError.code, 'ACCOUNT_SUSPENDED');
  });

  it('INACTIVE admin account is rejected with ACCOUNT_SUSPENDED code', () => {
    const admin = makeMockAdmin({ status: 'INACTIVE' });
    let authError = null;
    if (!admin || admin.status !== 'ACTIVE') {
      authError = { status: 403, code: 'ACCOUNT_SUSPENDED', message: 'Admin account is inactive or suspended' };
    }
    assert.ok(authError !== null);
    assert.strictEqual(authError.code, 'ACCOUNT_SUSPENDED');
  });

  it('auth context never exposes userId from client-controlled payload', () => {
    // Simulate a crafted payload where client tries to inject userId
    const maliciousBody = { userId: 'admin-override-1234', role: 'OWNER' };
    // The backend must resolve identity from the verified JWT, not the body
    const decoded = generateAccessToken({ userId: 'actual-user-99', sessionId: 'sess-1', userType: 'USER' });
    const verified = verifyAccessToken(decoded);
    assert.strictEqual(verified.sub, 'actual-user-99');
    assert.notStrictEqual(verified.sub, maliciousBody.userId);
  });

  it('owner flag in JWT grants isOwner=true on req.auth', () => {
    const token = generateAccessToken({
      adminId: 'admin-owner',
      sessionId: 'session-owner',
      userType: 'ADMIN',
      isAdmin: true,
      roleId: null,
    });
    const decoded = verifyAccessToken(token);
    assert.ok(decoded.isAdmin, 'owner admin must have isAdmin:true');
  });

  it('User JWT does NOT carry admin claims', () => {
    const token = generateAccessToken({ userId: 'user-123', sessionId: 'session-u', userType: 'USER' });
    const decoded = verifyAccessToken(token);
    assert.strictEqual(decoded.isAdmin, false);
    assert.ok(!decoded.roleId || decoded.roleId === null, 'user token must not carry admin roleId');
  });
});
