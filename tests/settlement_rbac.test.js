import { describe, it } from 'node:test';
import assert from 'node:assert';
import requirePermission from '../src/middlewares/requirePermission.js';

describe('Phase 5 Settlement RBAC & Permission Enforcement Suite', () => {
  it('allows access when administrator holds manage_agency_finance permission', async () => {
    const middleware = requirePermission('manage_agency_finance');

    const req = {
      auth: {
        userId: {
          id: 'admin-finance-01',
          isOwner: false,
          isSuperAdmin: false,
          role: {
            permissions: [{ permissionId: 'manage_agency_finance' }, { permissionId: 'view_finance' }],
          },
        },
        isAdmin: true,
        isOwner: false,
      },
    };

    let nextCalled = false;
    const res = {};

    await middleware(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
  });

  it('denies access when administrator lacks required settlement permissions', async () => {
    const middleware = requirePermission('manage_agency_finance');

    const req = {
      auth: {
        userId: {
          id: 'admin-limited-01',
          isOwner: false,
          isSuperAdmin: false,
          role: {
            permissions: [{ permissionId: 'view_banners' }, { permissionId: 'view_users' }],
          },
        },
        isAdmin: true,
        isOwner: false,
      },
    };

    let statusCode = null;
    let jsonBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return {
          json(body) {
            jsonBody = body;
          },
        };
      },
    };

    await middleware(req, res, () => {});

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(jsonBody.error.code, 'FORBIDDEN');
  });

  it('unconditionally grants access to Root Owner', async () => {
    const middleware = requirePermission('manage_agency_finance');

    const req = {
      auth: {
        userId: 'admin-root',
        isAdmin: true,
        isOwner: true, // Master Root Owner
        permissions: [],
      },
    };

    let nextCalled = false;
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };

    await middleware(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
  });
});
