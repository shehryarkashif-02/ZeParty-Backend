import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizePhone } from '../src/utils/phone.util.js';
import { generateOtpCode, hashToken, generateRandomToken, hashPassword, comparePassword } from '../src/utils/crypto.util.js';
import { generateAccessToken, verifyAccessToken, generateRefreshToken } from '../src/services/token.service.js';
import { checkRateLimit } from '../src/utils/rate-limiter.util.js';
import {
  requestOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  adminLoginSchema,
} from '../src/validators/auth.validator.js';

describe('Phase 4 Authentication & Security Unit Specification Suite', () => {
  // 1. Phone Normalization (E.164)
  describe('1. Phone Number Normalization', () => {
    it('normalizes standard international phone number with plus sign', () => {
      assert.strictEqual(normalizePhone('+15551234567'), '+15551234567');
    });

    it('adds leading plus sign if missing', () => {
      assert.strictEqual(normalizePhone('15551234567'), '+15551234567');
    });

    it('strips dashes, spaces, parentheses, and letters', () => {
      assert.strictEqual(normalizePhone('+1 (555) 123-4567 Ext. 8'), '+155512345678');
    });

    it('handles empty or null inputs safely', () => {
      assert.strictEqual(normalizePhone(''), '');
      assert.strictEqual(normalizePhone(null), '');
    });
  });

  // 2. Cryptographic OTP Generation & Hashing
  describe('2. Cryptographically Secure OTP Generation & Hashing', () => {
    it('generates 6-digit numeric OTP code using CSPRNG', () => {
      const otp = generateOtpCode(6);
      assert.strictEqual(otp.length, 6);
      assert.match(otp, /^\d{6}$/);
    });

    it('generates unique random OTP codes across iterations', () => {
      const set = new Set();
      for (let i = 0; i < 50; i++) {
        set.add(generateOtpCode(6));
      }
      assert.ok(set.size > 45, 'OTP generator should produce high entropy codes');
    });

    it('hashes OTP code using SHA-256 for secure persistence', () => {
      const otp = '123456';
      const hash1 = hashToken(otp);
      const hash2 = hashToken(otp);
      assert.strictEqual(hash1.length, 64);
      assert.strictEqual(hash1, hash2);
      assert.notStrictEqual(hash1, otp);
    });

    it('returns null when hashing empty or null tokens', () => {
      assert.strictEqual(hashToken(''), null);
      assert.strictEqual(hashToken(null), null);
    });
  });

  // 3. JWT Access & Refresh Token Lifecycle
  describe('3. JWT Access & Refresh Token Lifecycle', () => {
    it('generates valid JWT access token carrying all required claims', () => {
      const payload = {
        userId: 'test-user-001',
        sessionId: 'session-xyz-123',
        userType: 'USER',
        isAdmin: false,
      };
      const token = generateAccessToken(payload);
      assert.ok(typeof token === 'string' && token.length > 20);

      const decoded = verifyAccessToken(token);
      assert.strictEqual(decoded.sub, 'test-user-001');
      assert.strictEqual(decoded.sessionId, 'session-xyz-123');
      assert.strictEqual(decoded.userType, 'USER');
      assert.strictEqual(decoded.isAdmin, false);
      assert.ok(decoded.exp > decoded.iat);
    });

    it('generates valid Admin token carrying admin and role claims', () => {
      const payload = {
        adminId: 'admin-001',
        sessionId: 'admin-session-456',
        userType: 'ADMIN',
        roleId: 'finance_admin',
        isAdmin: true,
      };
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);
      assert.strictEqual(decoded.sub, 'admin-001');
      assert.strictEqual(decoded.roleId, 'finance_admin');
      assert.strictEqual(decoded.isAdmin, true);
    });

    it('rejects tampered or forged JWT tokens with 401 error', () => {
      const validToken = generateAccessToken({ userId: 'user-1' });
      const tamperedToken = validToken.slice(0, -5) + 'abcde';
      assert.throws(() => {
        verifyAccessToken(tamperedToken);
      }, (err) => err.code === 'TOKEN_INVALID' && err.status === 401);
    });

    it('generates cryptographically secure refresh token with SHA-256 hash and 7-day expiry', () => {
      const { rawToken, tokenHash, expiresAt } = generateRefreshToken();
      assert.ok(rawToken.length >= 64);
      assert.strictEqual(tokenHash, hashToken(rawToken));
      const sevenDaysFromNow = Date.now() + 6 * 24 * 60 * 60 * 1000;
      assert.ok(new Date(expiresAt).getTime() > sevenDaysFromNow);
    });
  });

  // 4. In-Memory / Redis Rate Limiter
  describe('4. Rate Limiter Security Logic', () => {
    it('allows requests within limit and blocks subsequent requests exceeding limit', async () => {
      const testKey = `test:rate:${Date.now()}:${Math.random()}`;
      const limit = 3;

      const r1 = await checkRateLimit({ key: testKey, limit, windowSeconds: 60 });
      assert.strictEqual(r1.allowed, true);
      assert.strictEqual(r1.remaining, 2);

      const r2 = await checkRateLimit({ key: testKey, limit, windowSeconds: 60 });
      assert.strictEqual(r2.allowed, true);
      assert.strictEqual(r2.remaining, 1);

      const r3 = await checkRateLimit({ key: testKey, limit, windowSeconds: 60 });
      assert.strictEqual(r3.allowed, true);
      assert.strictEqual(r3.remaining, 0);

      const r4 = await checkRateLimit({ key: testKey, limit, windowSeconds: 60 });
      assert.strictEqual(r4.allowed, false);
      assert.strictEqual(r4.remaining, 0);
    });
  });

  // 5. Password Hashing & Verification
  describe('5. Password Hashing & Bcrypt Verification', () => {
    it('hashes passwords securely using bcrypt', async () => {
      const plain = 'SuperSecretPass123!';
      const hash = await hashPassword(plain, 10);
      assert.ok(hash.startsWith('$2'));
      assert.notStrictEqual(hash, plain);

      const match = await comparePassword(plain, hash);
      assert.strictEqual(match, true);

      const mismatch = await comparePassword('WrongPassword', hash);
      assert.strictEqual(mismatch, false);
    });

    it('handles empty or null passwords safely', async () => {
      const match = await comparePassword('', '$2a$10$invalidhash');
      assert.strictEqual(match, false);
    });
  });

  // 6. Zod Validation Schemas
  describe('6. Zod Validation Schemas', () => {
    it('validates requestOtpSchema correctly and rejects invalid phone', () => {
      const valid = requestOtpSchema.parse({ phone: '+15551234567', purpose: 'LOGIN' });
      assert.strictEqual(valid.phone, '+15551234567');
      assert.strictEqual(valid.purpose, 'LOGIN');

      assert.throws(() => {
        requestOtpSchema.parse({ phone: '12' }); // Too short
      });
    });

    it('validates verifyOtpSchema correctly and enforces 6-digit code', () => {
      const valid = verifyOtpSchema.parse({
        phone: '+15551234567',
        code: '123456',
        purpose: 'LOGIN',
      });
      assert.strictEqual(valid.code, '123456');

      assert.throws(() => {
        verifyOtpSchema.parse({ phone: '+15551234567', code: '12345' }); // 5 digits
      });
      assert.throws(() => {
        verifyOtpSchema.parse({ phone: '+15551234567', code: '1234567' }); // 7 digits
      });
    });

    it('validates adminLoginSchema and enforces non-empty credentials', () => {
      const valid = adminLoginSchema.parse({
        usernameOrEmail: 'superadmin',
        password: 'adminPassword123',
      });
      assert.strictEqual(valid.usernameOrEmail, 'superadmin');

      assert.throws(() => {
        adminLoginSchema.parse({ usernameOrEmail: '', password: '123' });
      });
      assert.throws(() => {
        adminLoginSchema.parse({ usernameOrEmail: 'superadmin', password: '' });
      });
    });
  });
});
