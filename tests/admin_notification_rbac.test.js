import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requirePermission } from '../src/middlewares/requirePermission.js';

describe('Phase 9 Admin Notification Permission Enforcement Suite', () => {
  it('allows authorized admin with view_notifications to access broadcast queue', async () => {
    let nextCalled = false;
    const req = {
      auth: {
        userId: 'admin-viewer',
        isAdmin: true,
      },
      admin: {
        id: 'admin-viewer',
        name: 'Viewer Admin',
        role: {
          permissions: [
            { permissionId: 'view_notifications' },
          ],
        },
      },
    };
    const res = {};
    const next = () => { nextCalled = true; };

    const middleware = requirePermission('view_notifications');
    await middleware(req, res, next);

    assert.strictEqual(nextCalled, true);
  });

  it('rejects unauthorized admin lacking view_notifications permission with 403', async () => {
    let statusCode = null;
    let responseBody = null;

    const req = {
      auth: {
        userId: 'admin-host-mod',
        isAdmin: true,
      },
      admin: {
        id: 'admin-host-mod',
        name: 'Host Moderator',
        role: {
          permissions: [
            { permissionId: 'view_hosts' },
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

    const middleware = requirePermission('view_notifications');
    await middleware(req, res, next);

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(responseBody.error.code, 'FORBIDDEN');
  });
});
