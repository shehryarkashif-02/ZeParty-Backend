import sessionRepository from '../repositories/session.repository.js';
import adminRepository from '../repositories/admin.repository.js';
import tokenService from './token.service.js';
import { hashToken } from '../utils/crypto.util.js';

export async function createSession({ userId, userType = 'USER', roleId = null, isAdmin = false, ipAddress, userAgent }) {
  const { rawToken, tokenHash, expiresAt } = tokenService.generateRefreshToken();

  const session = await sessionRepository.createSession({
    userId,
    refreshTokenHash: tokenHash,
    ipAddress,
    userAgent,
    expiresAt,
  });

  const accessToken = tokenService.generateAccessToken({
    userId,
    sessionId: session.id,
    userType,
    roleId,
    isAdmin,
  });

  return {
    sessionId: session.id,
    accessToken,
    refreshToken: rawToken,
    expiresAt: session.expiresAt,
  };
}

export async function rotateRefreshToken({ refreshToken, ipAddress, userAgent }) {
  if (!refreshToken) {
    const error = new Error('Refresh token is required');
    error.status = 400;
    error.code = 'TOKEN_INVALID';
    throw error;
  }

  const tokenHash = hashToken(refreshToken);
  const session = await sessionRepository.findActiveSessionByRefreshTokenHash(tokenHash);

  if (!session) {
    const error = new Error('Invalid or expired refresh token');
    error.status = 401;
    error.code = 'TOKEN_INVALID';
    throw error;
  }

  if (session.revokedAt) {
    const error = new Error('Authentication session has been revoked');
    error.status = 401;
    error.code = 'SESSION_REVOKED';
    throw error;
  }

  if (new Date() > new Date(session.expiresAt)) {
    await sessionRepository.revokeSession(session.id);
    const error = new Error('Refresh token has expired');
    error.status = 401;
    error.code = 'TOKEN_EXPIRED';
    throw error;
  }

  // Determine whether session.userId belongs to an Admin identity
  const admin = await adminRepository.findById(session.userId);
  let isAdmin = false;
  let userType = 'USER';
  let roleId = null;

  if (admin) {
    if (admin.status !== 'ACTIVE') {
      await sessionRepository.revokeSession(session.id);
      const error = new Error('Admin account is suspended or inactive.');
      error.status = 403;
      error.code = 'ACCOUNT_SUSPENDED';
      throw error;
    }
    isAdmin = true;
    userType = 'ADMIN';
    roleId = admin.roleId || (admin.isOwner ? 'owner' : (admin.isSuperAdmin ? 'super_admin' : null));
  } else {
    // Verify standard user account status
    if (session.user && session.user.status !== 'ACTIVE') {
      await sessionRepository.revokeSession(session.id);
      const error = new Error(`Account is ${session.user.status.toLowerCase()}`);
      error.status = 403;
      error.code = session.user.status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_BANNED';
      throw error;
    }
    userType = session.user?.userType || 'USER';
  }

  // Token Rotation: Generate new token pair and update session
  const newTokens = tokenService.generateRefreshToken();

  await sessionRepository.rotateSessionToken(
    session.id,
    newTokens.tokenHash,
    newTokens.expiresAt
  );

  const newAccessToken = tokenService.generateAccessToken({
    userId: session.userId,
    sessionId: session.id,
    userType,
    roleId,
    isAdmin,
  });

  return {
    sessionId: session.id,
    accessToken: newAccessToken,
    refreshToken: newTokens.rawToken,
    expiresAt: newTokens.expiresAt,
  };
}

export async function revokeSession(sessionId) {
  if (!sessionId) return null;
  return await sessionRepository.revokeSession(sessionId);
}

export default {
  createSession,
  rotateRefreshToken,
  revokeSession,
};
