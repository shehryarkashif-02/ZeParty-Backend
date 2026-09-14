import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requirePermission } from '../src/middlewares/requirePermission.js';

describe('Phase 8 Support Ticket RBAC Suite', () => {
  it('allows administrator with view_support permission to access support queue', async () => {
    let nextCalled = false;
    const req = {
      auth: {
        userId: 'admin-supp-1',
        isAdmin: true,
      },
      admin: {
        id: 'admin-supp-1',
        name: 'Support Agent',
        role: {
          permissions: [
            { permissionId: 'view_support' },
            { permissionId: 'manage_support' },
          ],
        },
      },
    };
    const res = {};
    const next = () => { nextCalled = true; };

    const middleware = requirePermission('view_support');
    await middleware(req, res, next);

    assert.strictEqual(nextCalled, true);
  });

  it('rejects admin lacking manage_support permission when mutating ticket status', async () => {
    let statusCode = null;
    let responseBody = null;

    const req = {
      auth: {
        userId: 'admin-readonly',
        isAdmin: true,
      },
      admin: {
        id: 'admin-readonly',
        name: 'Readonly Admin',
        role: {
          permissions: [
            { permissionId: 'view_support' },
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

    const middleware = requirePermission('manage_support');
    await middleware(req, res, next);

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(responseBody.error.code, 'FORBIDDEN');
  });
});
