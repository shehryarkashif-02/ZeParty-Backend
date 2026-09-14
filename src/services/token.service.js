import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { generateRandomToken, hashToken } from '../utils/crypto.util.js';

/**
 * Generate short-lived JWT access token carrying essential claims.
 */
export function generateAccessToken(payload) {
  const claims = {
    sub: payload.userId || payload.adminId,
    sessionId: payload.sessionId,
    userType: payload.userType || (payload.isAdmin ? 'ADMIN' : 'USER'),
    roleId: payload.roleId || null,
    isAdmin: Boolean(payload.isAdmin),
  };

  return jwt.sign(claims, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/**
 * Verify access token claims against env JWT_SECRET.
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new Error('Access token has expired');
      error.status = 401;
      error.code = 'TOKEN_EXPIRED';
      throw error;
    }
    const error = new Error('Invalid authentication token');
    error.status = 401;
    error.code = 'TOKEN_INVALID';
    throw error;
  }
}

/**
 * Generate long-lived opaque refresh token and its server-side SHA256 hash.
 */
export function generateRefreshToken() {
  const rawToken = generateRandomToken(40);
  const tokenHash = hashToken(rawToken);
  
  // Calculate expiration date (7 days default)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

export default {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
};
