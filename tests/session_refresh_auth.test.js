import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import tokenService from '../src/services/token.service.js';
import sessionService from '../src/services/session.service.js';

describe('Admin Authentication & Token Rotation Tests', () => {
  test('TokenService generates and verifies admin access tokens with claims', () => {
    const adminId = 'admin-test-uuid-123';
    const sessionId = 'session-test-uuid-456';
    const token = tokenService.generateAccessToken({
      userId: adminId,
      sessionId,
      userType: 'ADMIN',
      roleId: 'super_admin',
      isAdmin: true,
    });

    assert.ok(token, 'Access token must be generated');
    const decoded = tokenService.verifyAccessToken(token);
    assert.equal(decoded.sub, adminId);
    assert.equal(decoded.sessionId, sessionId);
    assert.equal(decoded.userType, 'ADMIN');
    assert.equal(decoded.roleId, 'super_admin');
    assert.equal(decoded.isAdmin, true);
  });

  test('TokenService generates standard user tokens without admin claims', () => {
    const userId = 'user-test-uuid-789';
    const sessionId = 'session-test-uuid-999';
    const token = tokenService.generateAccessToken({
      userId,
      sessionId,
      userType: 'USER',
      roleId: null,
      isAdmin: false,
    });

    assert.ok(token, 'Access token must be generated');
    const decoded = tokenService.verifyAccessToken(token);
    assert.equal(decoded.sub, userId);
    assert.equal(decoded.sessionId, sessionId);
    assert.equal(decoded.userType, 'USER');
    assert.equal(decoded.roleId, null);
    assert.equal(decoded.isAdmin, false);
  });

  test('TokenService rejects expired tokens with 401 TOKEN_EXPIRED', () => {
    // Generate an immediately expired token using raw jwt
    import('jsonwebtoken').then(({ default: jwt }) => {
      import('../src/config/env.js').then(({ default: env }) => {
        const expiredToken = jwt.sign(
          { sub: 'test', sessionId: 's1', userType: 'ADMIN', isAdmin: true },
          env.JWT_SECRET,
          { expiresIn: '-1s' }
        );

        assert.throws(
          () => tokenService.verifyAccessToken(expiredToken),
          (err) => err.status === 401 && err.code === 'TOKEN_EXPIRED'
        );
      });
    });
  });
});
