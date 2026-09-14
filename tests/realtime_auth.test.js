import { describe, it } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import env from '../src/config/env.js';
import { socketAuthMiddleware } from '../src/socket/auth.js';
import { SOCKET_ERRORS } from '../src/socket/socket.constants.js';

describe('Phase 4 — Realtime Socket Authentication Specification Suite', () => {
  const mockActiveUser = {
    id: 'user_active_123',
    username: 'realtime_user',
    displayName: 'Realtime Tester',
    role: 'USER',
    status: 'ACTIVE',
    avatarUrl: 'https://cdn.zeparty.app/avatars/user.png',
  };

  const mockSuspendedUser = {
    id: 'user_suspended_456',
    username: 'banned_user',
    displayName: 'Suspended User',
    role: 'USER',
    status: 'SUSPENDED',
  };

  it('authenticates valid JWT token in handshake.auth and attaches user to socket', async () => {
    const validToken = jwt.sign(
      { userId: mockActiveUser.id, role: mockActiveUser.role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const mockSocket = {
      handshake: {
        auth: { token: validToken },
        headers: {},
      },
      join: () => {},
    };

    const mockDb = {
      findUserById: async (id) => {
        if (id === mockActiveUser.id) return mockActiveUser;
        return null;
      },
    };

    let nextError = null;
    await socketAuthMiddleware(mockSocket, (err) => {
      nextError = err;
    }, mockDb);

    assert.strictEqual(nextError, undefined);
    assert.strictEqual(mockSocket.userId, mockActiveUser.id);
    assert.strictEqual(mockSocket.user.username, 'realtime_user');
    assert.strictEqual(mockSocket.user.status, 'ACTIVE');
  });

  it('authenticates token in handshake.headers.authorization with Bearer prefix', async () => {
    const validToken = jwt.sign(
      { userId: mockActiveUser.id, role: mockActiveUser.role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const mockSocket = {
      handshake: {
        auth: {},
        headers: { authorization: `Bearer ${validToken}` },
      },
      join: () => {},
    };

    const mockDb = {
      findUserById: async () => mockActiveUser,
    };

    let nextError = null;
    await socketAuthMiddleware(mockSocket, (err) => {
      nextError = err;
    }, mockDb);

    assert.strictEqual(nextError, undefined);
    assert.strictEqual(mockSocket.userId, mockActiveUser.id);
  });

  it('rejects connection when no token is provided', async () => {
    const mockSocket = {
      handshake: {
        auth: {},
        headers: {},
      },
    };

    let nextError = null;
    await socketAuthMiddleware(mockSocket, (err) => {
      nextError = err;
    });

    assert.ok(nextError);
    assert.strictEqual(nextError.data?.code, SOCKET_ERRORS.UNAUTHORIZED);
  });

  it('rejects connection when JWT token is invalid or expired', async () => {
    const mockSocket = {
      handshake: {
        auth: { token: 'invalid.jwt.token' },
        headers: {},
      },
    };

    let nextError = null;
    await socketAuthMiddleware(mockSocket, (err) => {
      nextError = err;
    });

    assert.ok(nextError);
    assert.strictEqual(nextError.data?.code, SOCKET_ERRORS.UNAUTHORIZED);
  });

  it('rejects connection when user does not exist in database', async () => {
    const validToken = jwt.sign(
      { userId: 'non_existent_user', role: 'USER' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const mockSocket = {
      handshake: {
        auth: { token: validToken },
        headers: {},
      },
    };

    const mockDb = {
      findUserById: async () => null,
    };

    let nextError = null;
    await socketAuthMiddleware(mockSocket, (err) => {
      nextError = err;
    }, mockDb);

    assert.ok(nextError);
    assert.strictEqual(nextError.data?.code, SOCKET_ERRORS.UNAUTHORIZED);
  });

  it('rejects connection when user status is SUSPENDED or BANNED', async () => {
    const validToken = jwt.sign(
      { userId: mockSuspendedUser.id, role: mockSuspendedUser.role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const mockSocket = {
      handshake: {
        auth: { token: validToken },
        headers: {},
      },
    };

    const mockDb = {
      findUserById: async () => mockSuspendedUser,
    };

    let nextError = null;
    await socketAuthMiddleware(mockSocket, (err) => {
      nextError = err;
    }, mockDb);

    assert.ok(nextError);
    assert.strictEqual(nextError.data?.code, SOCKET_ERRORS.USER_NOT_ACTIVE);
  });
});
