import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import userRepository from '../repositories/user.repository.js';
import { SOCKET_ERRORS } from './socket.constants.js';

/**
 * Socket.IO connection authentication middleware using the authoritative JWT authentication system.
 * 
 * Extracts JWT from handshake auth token or authorization header.
 * Verifies token signature, expiration, and user account status.
 * Rejects banned, suspended, or inactive users.
 */
export async function socketAuthMiddleware(socket, next, customUserLookup = null) {
  try {
    let token = socket.handshake.auth?.token;

    if (!token && socket.handshake.headers?.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = authHeader;
      }
    }

    if (!token || typeof token !== 'string') {
      const err = new Error('Authentication required for socket connection');
      err.data = { code: SOCKET_ERRORS.UNAUTHORIZED };
      return next(err);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (jwtErr) {
      const err = new Error(
        jwtErr.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid authentication token'
      );
      err.data = { code: SOCKET_ERRORS.UNAUTHORIZED, reason: jwtErr.name };
      return next(err);
    }

    const userId = decoded.userId || decoded.id;
    if (!userId) {
      const err = new Error('Malformed token payload: missing user identifier');
      err.data = { code: SOCKET_ERRORS.UNAUTHORIZED };
      return next(err);
    }

    // Look up user to verify active account status
    let user;
    if (customUserLookup) {
      if (typeof customUserLookup.findUserById === 'function') {
        user = await customUserLookup.findUserById(userId);
      } else if (customUserLookup.user && typeof customUserLookup.user.findUnique === 'function') {
        user = await customUserLookup.user.findUnique({ where: { id: userId } });
      } else if (typeof customUserLookup === 'function') {
        user = await customUserLookup(userId);
      }
    } else {
      user = await userRepository.findUserById(userId);
    }

    if (!user) {
      const err = new Error('User account not found');
      err.data = { code: SOCKET_ERRORS.UNAUTHORIZED };
      return next(err);
    }

    if (user.status !== 'ACTIVE') {
      const err = new Error(`Account is ${user.status.toLowerCase()}. Access denied.`);
      err.data = { code: SOCKET_ERRORS.USER_NOT_ACTIVE, status: user.status };
      return next(err);
    }

    // Attach authenticated identity to socket
    socket.user = {
      id: user.id,
      userId: user.id,
      username: user.username,
      displayName: user.profile?.displayName || user.username,
      avatarUrl: user.profile?.avatarUrl || null,
      status: user.status,
      isAdmin: decoded.isAdmin || false,
      isOwner: decoded.isOwner || false,
      role: decoded.role || null,
    };

    socket.userId = user.id;

    return next();
  } catch (err) {
    const error = new Error('Internal authentication error during socket handshake');
    error.data = { code: SOCKET_ERRORS.INTERNAL_ERROR };
    return next(error);
  }
}

export default socketAuthMiddleware;
