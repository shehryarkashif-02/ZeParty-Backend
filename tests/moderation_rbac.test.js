import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requirePermission } from '../src/middlewares/requirePermission.js';

describe('Phase 8 Moderation RBAC Suite', () => {
  it('allows moderator holding action_moderation permission to access moderation actions', async () => {
    let nextCalled = false;
    const req = {
      auth: {
        userId: 'admin-mod-1',
        isAdmin: true,
      },
      admin: {
        id: 'admin-mod-1',
        name: 'Moderator Alpha',
        role: {
          permissions: [
            { permissionId: 'view_moderation' },
            { permissionId: 'action_moderation' },
          ],
        },
      },
    };
    const res = {};
    const next = () => { nextCalled = true; };

    const middleware = requirePermission('action_moderation');
    await middleware(req, res, next);

    assert.strictEqual(nextCalled, true);
  });

  it('blocks admin lacking action_moderation permission with 403', async () => {
    let statusCode = null;
    let responseBody = null;

    const req = {
      auth: {
        userId: 'admin-view-only',
        isAdmin: true,
      },
      admin: {
        id: 'admin-view-only',
        name: 'Viewer Admin',
        role: {
          permissions: [
            { permissionId: 'view_moderation' },
          ],
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

    const middleware = requirePermission('action_moderation');
    await middleware(req, res, next);

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(responseBody.error.code, 'FORBIDDEN');
  });
});
