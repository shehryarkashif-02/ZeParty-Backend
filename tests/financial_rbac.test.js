import { describe, it } from 'node:test';
import assert from 'node:assert';
import requirePermission from '../src/middlewares/requirePermission.js';
import { ALL_CANONICAL_PERMISSIONS } from '../src/constants/permissions.js';

describe('Phase 3 Financial RBAC & Authorization Suite', () => {
  const financialPermissions = [
    'view_ledger',
    'view_finance',
    'manage_balances',
    'view_recharge_plans',
    'manage_recharge_plans',
    'view_offline_recharge',
    'approve_offline_recharge',
    'view_withdrawals',
    'approve_withdrawals',
    'reject_withdrawals',
    'view_refunds',
    'approve_refunds',
    'view_chargebacks',
    'reseller_corrections',
    'issue_coins',
    'view_settings',
    'manage_settings',
  ];

  it('verifies that all Phase 3 financial permissions exist in Canonical Permission definitions', () => {
    for (const permId of financialPermissions) {
      assert.ok(
        ALL_CANONICAL_PERMISSIONS.includes(permId),
        `Expected canonical permission "${permId}" to be defined`
      );
    }
  });

  it('Root Owner automatically bypasses all financial permission checks', async () => {
    const middleware = requirePermission('manage_balances');
    const req = {
      auth: {
        userId: 'owner-id',
        isAdmin: true,
        isOwner: true,
        permissions: [],
      },
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    const res = {};

    await middleware(req, res, next);
    assert.strictEqual(nextCalled, true);
  });

  it('Authorized admin with specific financial permission passes check', async () => {
    const middleware = requirePermission('approve_offline_recharge');
    const req = {
      auth: {
        userId: {
          id: 'finance-admin-id',
          isOwner: false,
          isSuperAdmin: false,
          role: {
            permissions: [{ permissionId: 'approve_offline_recharge' }, { permissionId: 'view_offline_recharge' }],
          },
        },
        isAdmin: true,
        isOwner: false,
      },
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    const res = {};

    await middleware(req, res, next);
    assert.strictEqual(nextCalled, true);
  });

  it('Unauthorized admin receives 403 Forbidden', async () => {
    const middleware = requirePermission('approve_offline_recharge');
    const req = {
      auth: {
        userId: {
          id: 'content-mod-id',
          isOwner: false,
          isSuperAdmin: false,
          role: {
            permissions: [{ permissionId: 'view_banners' }, { permissionId: 'view_rooms' }],
          },
        },
        isAdmin: true,
        isOwner: false,
      },
    };
    let statusCode = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => { jsonBody = body; },
        };
      },
    };
    const next = () => {};

    await middleware(req, res, next);
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(jsonBody.error.code, 'FORBIDDEN');
  });

  it('Unauthenticated user receives 401 Unauthorized', async () => {
    const middleware = requirePermission('approve_offline_recharge');
    const req = {
      auth: null,
    };
    let statusCode = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => { jsonBody = body; },
        };
      },
    };
    const next = () => {};

    await middleware(req, res, next);
    assert.strictEqual(statusCode, 401);
    assert.strictEqual(jsonBody.error.code, 'UNAUTHORIZED');
  });
});
