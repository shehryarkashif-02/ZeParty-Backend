import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requireNoRestriction } from '../src/middlewares/restriction.middleware.js';

describe('Phase 8 Account Ban & Suspension Enforcement Suite', () => {
  it('blocks BANNED user with 403 ACCOUNT_BANNED', async () => {
    let statusCode = null;
    let responseBody = null;

    const req = {
      user: {
        id: 'usr-banned',
        status: 'BANNED',
      },
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => { responseBody = body; },
        };
      },
    };
    const next = () => {};

    const middleware = requireNoRestriction('POST_BLOCK');
    await middleware(req, res, next);

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(responseBody.error.code, 'ACCOUNT_BANNED');
  });

  it('blocks SUSPENDED user with 403 ACCOUNT_SUSPENDED', async () => {
    let statusCode = null;
    let responseBody = null;

    const req = {
      user: {
        id: 'usr-suspended',
        status: 'SUSPENDED',
      },
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => { responseBody = body; },
        };
      },
    };
    const next = () => {};

    const middleware = requireNoRestriction('CHAT_BLOCK');
    await middleware(req, res, next);

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(responseBody.error.code, 'ACCOUNT_SUSPENDED');
  });

  it('blocks ACTIVE user if specific feature restriction is active', async () => {
    let statusCode = null;
    let responseBody = null;

    const req = {
      user: {
        id: 'usr-active-with-mute',
        status: 'ACTIVE',
      },
      db: {
        restriction: {
          findFirst: async () => ({
            id: 'rst-chat-1',
            type: 'CHAT_BLOCK',
            reason: 'Offensive language in live chat',
            expiresAt: new Date(Date.now() + 3600000),
          }),
        },
      },
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => { responseBody = body; },
        };
      },
    };
    const next = () => {};

    const middleware = requireNoRestriction('CHAT_BLOCK');
    await middleware(req, res, next);

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(responseBody.error.code, 'FORBIDDEN_RESTRICTED');
  });

  it('allows unrestricted ACTIVE user to proceed', async () => {
    let nextCalled = false;

    const req = {
      user: {
        id: 'usr-clean',
        status: 'ACTIVE',
      },
      db: {
        restriction: {
          findFirst: async () => null,
        },
      },
    };
    const res = {};
    const next = () => { nextCalled = true; };

    const middleware = requireNoRestriction('POST_BLOCK');
    await middleware(req, res, next);

    assert.strictEqual(nextCalled, true);
  });
});
