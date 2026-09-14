import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Generate a cryptographically secure random numeric OTP code.
 * Default length is 6 digits.
 */
export function generateOtpCode(length = 6) {
  const digits = '0123456789';
  let otp = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[bytes[i] % 10];
  }
  return otp;
}

/**
 * SHA-256 hash for secure server-side storage of OTPs and Refresh Tokens.
 */
export function hashToken(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Generate a secure random token hex string (e.g. for refresh tokens).
 */
export function generateRandomToken(bytesLength = 32) {
  return crypto.randomBytes(bytesLength).toString('hex');
}

/**
 * Hash a plain password string using bcrypt.
 */
export async function hashPassword(password, saltRounds = 10) {
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compare a plain password against a bcrypt hash.
 */
export async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  return await bcrypt.compare(password, hash);
}

export default {
  generateOtpCode,
  hashToken,
  generateRandomToken,
  hashPassword,
  comparePassword,
};
