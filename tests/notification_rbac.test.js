import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requirePermission } from '../src/middlewares/requirePermission.js';

describe('Phase 9 Notification RBAC Suite', () => {
  it('allows administrator with manage_notifications permission to broadcast', async () => {
    let nextCalled = false;
    const req = {
      auth: {
        userId: 'admin-comm-1',
        isAdmin: true,
      },
      admin: {
        id: 'admin-comm-1',
        name: 'Communications Officer',
        role: {
          permissions: [
            { permissionId: 'view_notifications' },
            { permissionId: 'manage_notifications' },
          ],
        },
      },
    };
    const res = {};
    const next = () => { nextCalled = true; };

    const middleware = requirePermission('manage_notifications');
    await middleware(req, res, next);

    assert.strictEqual(nextCalled, true);
  });

  it('rejects admin lacking manage_notifications permission with 403', async () => {
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
            { permissionId: 'view_notifications' },
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

    const middleware = requirePermission('manage_notifications');
    await middleware(req, res, next);

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(responseBody.error.code, 'FORBIDDEN');
  });
});
