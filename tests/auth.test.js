import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { requestOtp, verifyOtpAndAuthenticate, refreshToken, logout, getCurrentUser, adminLogin } from '../src/services/auth.service.js';
import tokenService from '../src/services/token.service.js';
import prisma from '../src/config/database.js';
import { hashPassword } from '../src/utils/crypto.util.js';

describe('Phase 3 End-to-End Authentication Integration Suite', () => {
  const testPhone = '+15550199' + Math.floor(1000 + Math.random() * 9000);
  const testIp = '127.0.0.1';
  const testUserAgent = 'ZeParty-Test-Runner/1.0';

  let devOtp;
  let initialAccessToken;
  let initialRefreshToken;
  let sessionId;
  let userId;
  let testAdminId;

  after(async () => {
    if (testAdminId) {
      await prisma.admin.delete({ where: { id: testAdminId } }).catch(() => {});
      await prisma.user.delete({ where: { id: testAdminId } }).catch(() => {});
    }
  });

  it('1. Requests OTP code for valid phone number', async () => {
    const reqOtpResult = await requestOtp({
      phone: testPhone,
      purpose: 'LOGIN',
      ipAddress: testIp,
    });
    assert.ok(reqOtpResult.success);
    assert.ok(reqOtpResult.expiresInSeconds > 0);
    devOtp = reqOtpResult.devOtp || '123456';
    assert.ok(devOtp);
  });

  it('2. Verifies OTP and auto-provisions new user account and wallet', async () => {
    const authResult = await verifyOtpAndAuthenticate({
      phone: testPhone,
      code: devOtp,
      purpose: 'LOGIN',
      device: {
        deviceToken: 'test-device-token-abc-123',
        platform: 'ANDROID',
        deviceModel: 'Pixel 8 Pro',
        appVersion: '1.0.0',
      },
      ipAddress: testIp,
      userAgent: testUserAgent,
    });

    assert.ok(authResult.accessToken);
    assert.ok(authResult.refreshToken);
    assert.strictEqual(authResult.user.phone, testPhone);

    initialAccessToken = authResult.accessToken;
    initialRefreshToken = authResult.refreshToken;
    userId = authResult.user.id;
  });

  it('3. Validates JWT Access Token claims and signature', () => {
    const decoded = tokenService.verifyAccessToken(initialAccessToken);
    assert.strictEqual(decoded.sub, userId);
    assert.ok(decoded.sessionId);
    sessionId = decoded.sessionId;
    assert.strictEqual(decoded.userType, 'USER');
  });

  it('4. Retrieves authenticated user profile via getCurrentUser', async () => {
    const currentUser = await getCurrentUser({ userId });
    assert.strictEqual(currentUser.id, userId);
    assert.strictEqual(currentUser.phone, testPhone);
  });

  it('5. Successfully rotates refresh token and invalidates old token', async () => {
    const refreshResult = await refreshToken({
      refreshToken: initialRefreshToken,
      ipAddress: testIp,
      userAgent: testUserAgent,
    });

    assert.ok(refreshResult.accessToken);
    assert.ok(refreshResult.refreshToken);
    assert.notStrictEqual(refreshResult.refreshToken, initialRefreshToken);

    // Test replay attack defense with old token
    await assert.rejects(
      async () => {
        await refreshToken({
          refreshToken: initialRefreshToken,
          ipAddress: testIp,
          userAgent: testUserAgent,
        });
      },
      (err) => err.code === 'TOKEN_INVALID' || err.code === 'SESSION_REVOKED'
    );
  });

  it('6. Revokes session on logout', async () => {
    await logout({ sessionId });
    const session = await prisma.userSession.findUnique({ where: { id: sessionId } });
    assert.ok(session.revokedAt);
  });

  it('7. Authenticates Admin credentials and generates admin JWT', async () => {
    const testAdminUsername = 'testadmin_' + Math.floor(Math.random() * 10000);
    const testAdminPassword = 'SuperSecretAdminPassword123!';
    const passwordHash = await hashPassword(testAdminPassword);

    const testAdmin = await prisma.admin.create({
      data: {
        name: 'Test Administrator',
        username: testAdminUsername,
        email: `${testAdminUsername}@zeparty.app`,
        passwordHash,
        status: 'ACTIVE',
        isSuperAdmin: true,
      },
    });
    testAdminId = testAdmin.id;

    // Create shadow user
    await prisma.user.upsert({
      where: { id: testAdmin.id },
      update: {},
      create: {
        id: testAdmin.id,
        username: `admin_shadow_${testAdmin.id.replace(/[^a-zA-Z0-9_]/g, '_')}`,
        status: 'ACTIVE',
        userType: 'USER',
      },
    });

    const adminAuth = await adminLogin({
      usernameOrEmail: testAdminUsername,
      password: testAdminPassword,
      ipAddress: testIp,
      userAgent: testUserAgent,
    });

    assert.strictEqual(adminAuth.admin.username, testAdminUsername);
    assert.strictEqual(adminAuth.admin.isSuperAdmin, true);
    assert.ok(adminAuth.accessToken);
  });
});
