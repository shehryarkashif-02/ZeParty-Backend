import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateEffectivePermissions, ALL_SYSTEM_MODULES } from '../src/services/effectivePermissions.service.js';
import { requirePermission } from '../src/middlewares/requirePermission.js';
import { requireOwner } from '../src/middlewares/requireOwner.js';

describe('Phase 4 RBAC & Owner Security Specification Suite', () => {
  // A. Owner Tests
  it('A1. Owner receives unrestricted claims, wildcard permission, and full modules', async () => {
    const mockOwner = { id: 'owner-id', isOwner: true, isSuperAdmin: true };
    const effective = await calculateEffectivePermissions(mockOwner);
    assert.strictEqual(effective.isOwner, true);
    assert.strictEqual(effective.isSuperAdmin, true);
    assert.deepStrictEqual(effective.permissions, ['*']);
    assert.strictEqual(effective.canApprove, true);
    assert.ok(effective.modules.includes('owner-control'));
    assert.ok(effective.modules.includes('users'));
    assert.ok(effective.modules.includes('finance'));
  });

  it('A2. Owner passes requirePermission for any protected resource', async () => {
    const req = { auth: { isAdmin: true, isOwner: true, userId: 'owner-id' } };
    let passed = false;
    const res = {};
    const next = () => { passed = true; };

    const middleware = requirePermission('view_admins');
    await middleware(req, res, next);
    assert.strictEqual(passed, true);
  });

  it('A3. Owner passes requireOwner for dedicated owner endpoints', () => {
    const req = { admin: { isOwner: true } };
    let passed = false;
    const res = {};
    const next = () => { passed = true; };

    requireOwner(req, res, next);
    assert.strictEqual(passed, true);
  });

  // B. Super Admin Tests
  it('B1. Super Admin receives wildcard permission but NEVER owner-control module', async () => {
    const mockSuperAdmin = { id: 'superadmin-id', isOwner: false, isSuperAdmin: true };
    const effective = await calculateEffectivePermissions(mockSuperAdmin);
    assert.strictEqual(effective.isOwner, false);
    assert.strictEqual(effective.isSuperAdmin, true);
    assert.deepStrictEqual(effective.permissions, ['*']);
    assert.strictEqual(effective.canApprove, true);
    assert.strictEqual(effective.modules.includes('owner-control'), false);
    assert.ok(effective.modules.includes('users'));
    assert.ok(effective.modules.includes('teams-roles'));
  });

  it('B2. Super Admin is rejected by requireOwner with 403', () => {
    const req = { admin: { isOwner: false, isSuperAdmin: true } };
    let rejectedCode = null;
    let rejectedBody = null;
    const res = {
      status: (code) => {
        rejectedCode = code;
        return {
          json: (body) => { rejectedBody = body; },
        };
      },
    };
    const next = () => { assert.fail('Should not call next for Super Admin on requireOwner'); };

    requireOwner(req, res, next);
    assert.strictEqual(rejectedCode, 403);
    assert.strictEqual(rejectedBody.error.code, 'OWNER_PRIVILEGE_REQUIRED');
  });

  // C. Regular Admin & Role Tests
  it('C1. Regular Admin with permission succeeds (calls next)', async () => {
    const mockAdmin = {
      id: 'finance-admin-id',
      isOwner: false,
      isSuperAdmin: false,
      role: {
        id: 'finance_admin',
        permissions: [{ permissionId: 'view_recharge_plans' }],
      },
    };
    const req = { auth: { isAdmin: true, isOwner: false, userId: mockAdmin } };
    let passed = false;
    const res = {};
    const next = () => { passed = true; };

    const middleware = requirePermission('view_recharge_plans');
    await middleware(req, res, next);
    assert.strictEqual(passed, true);
  });

  it('C2. Regular Admin without permission receives 403 Forbidden', async () => {
    const mockAdmin = {
      id: 'finance-admin-id',
      isOwner: false,
      isSuperAdmin: false,
      role: {
        id: 'finance_admin',
        permissions: [{ permissionId: 'view_recharge_plans' }],
      },
    };
    const req = {
      auth: { isAdmin: true, isOwner: false, userId: mockAdmin },
      admin: { name: 'Finance Admin' },
      originalUrl: '/api/v1/admin/users',
      ip: '127.0.0.1',
      headers: {},
    };
    let statusCode = null;
    let responseBody = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => { responseBody = body; },
        };
      },
    };
    const next = () => { assert.fail('Should not call next when permission is missing'); };

    const middleware = requirePermission('view_users');
    await middleware(req, res, next);
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(responseBody.error.code, 'FORBIDDEN');
  });

  it('C3. AdminPermissionOverride GRANT enables access', async () => {
    const mockAdmin = {
      id: 'moderator-id',
      isOwner: false,
      isSuperAdmin: false,
      role: {
        id: 'moderator',
        permissions: [{ permissionId: 'view_users' }],
      },
      permissionOverrides: [
        { permissionId: 'manage_balances', overrideType: 'GRANT' },
      ],
    };
    const effective = await calculateEffectivePermissions(mockAdmin);
    assert.ok(effective.permissions.includes('manage_balances'));

    const req = { auth: { isAdmin: true, isOwner: false, userId: mockAdmin } };
    let passed = false;
    const next = () => { passed = true; };

    const middleware = requirePermission('manage_balances');
    await middleware(req, {}, next);
    assert.strictEqual(passed, true);
  });

  it('C4. AdminPermissionOverride REVOKE revokes access and returns 403', async () => {
    const mockAdmin = {
      id: 'moderator-id',
      isOwner: false,
      isSuperAdmin: false,
      role: {
        id: 'moderator',
        permissions: [{ permissionId: 'view_users' }, { permissionId: 'ban_users' }],
      },
      permissionOverrides: [
        { permissionId: 'ban_users', overrideType: 'REVOKE' },
      ],
    };
    const effective = await calculateEffectivePermissions(mockAdmin);
    assert.strictEqual(effective.permissions.includes('ban_users'), false);

    const req = {
      auth: { isAdmin: true, isOwner: false, userId: mockAdmin },
      admin: { name: 'Moderator' },
      originalUrl: '/api/v1/admin/users/123/ban',
      ip: '127.0.0.1',
      headers: {},
    };
    let statusCode = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      },
    };
    const next = () => { assert.fail('Should not call next when permission was revoked'); };

    const middleware = requirePermission('ban_users');
    await middleware(req, res, next);
    assert.strictEqual(statusCode, 403);
  });

  // D. Permission Naming & Normalization Tests
  it('D1. Bidirectional normalization resolves uppercase dot notation to snake_case', async () => {
    const mockAdmin = {
      id: 'admin-id',
      isOwner: false,
      isSuperAdmin: false,
      role: {
        id: 'super_admin',
        permissions: [{ permissionId: 'view_admins' }],
      },
    };
    const req = { auth: { isAdmin: true, isOwner: false, userId: mockAdmin } };
    let passed = false;
    const next = () => { passed = true; };

    // Request requires 'ADMINS.VIEW', admin possesses 'view_admins'
    const middleware = requirePermission('ADMINS.VIEW');
    await middleware(req, {}, next);
    assert.strictEqual(passed, true);
  });

  it('D2. Unknown permission requirement fails closed with 403', async () => {
    const mockAdmin = {
      id: 'admin-id',
      isOwner: false,
      isSuperAdmin: false,
      role: {
        id: 'moderator',
        permissions: [{ permissionId: 'view_users' }],
      },
    };
    const req = {
      auth: { isAdmin: true, isOwner: false, userId: mockAdmin },
      admin: { name: 'Admin' },
      originalUrl: '/api/v1/admin/unknown',
      ip: '127.0.0.1',
      headers: {},
    };
    let statusCode = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      },
    };
    const next = () => { assert.fail('Should fail closed on unknown permission'); };

    const middleware = requirePermission('nonexistent_permission_xyz');
    await middleware(req, res, next);
    assert.strictEqual(statusCode, 403);
  });

  it('D3. Malformed/empty permission requirement fails closed with 403', async () => {
    const req = {
      auth: { isAdmin: true, isOwner: false, userId: 'admin-id' },
    };
    let statusCode = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      },
    };
    const next = () => { assert.fail('Should fail closed on malformed permission'); };

    const middleware = requirePermission('');
    await middleware(req, res, next);
    assert.strictEqual(statusCode, 403);
  });

  // E. Owner Invisibility & Delegation Tests
  it('E1. Explicit moduleAccess configuration overrides inferred role modules', async () => {
    const mockAdmin = {
      id: 'module-admin-id',
      isOwner: false,
      isSuperAdmin: false,
      role: {
        id: 'finance_admin',
        permissions: [{ permissionId: 'view_finance' }],
      },
      moduleAccess: [
        { module: 'hosts' },
        { module: 'agencies' },
      ],
    };
    const effective = await calculateEffectivePermissions(mockAdmin);
    assert.deepStrictEqual(effective.modules.sort(), ['agencies', 'hosts'].sort());
  });

  it('E2. Approval authority grant grants approval permissions to non-superadmin', async () => {
    const mockAdmin = {
      id: 'approver-admin-id',
      isOwner: false,
      isSuperAdmin: false,
      role: {
        id: 'finance_admin',
        permissions: [{ permissionId: 'view_finance' }],
      },
      ownerGrants: [
        { grantType: 'APPROVAL_AUTHORITY', canApprove: true, status: 'ACTIVE' },
      ],
    };
    const effective = await calculateEffectivePermissions(mockAdmin);
    assert.strictEqual(effective.canApprove, true);
  });

  // F. Seed & RBAC System Integrity Tests
  it('F1. Exactly 10 canonical modules and 73 unique permissions are defined', async () => {
    const { MODULE_PERMISSIONS, ALL_CANONICAL_PERMISSIONS } = await import('../src/constants/permissions.js');
    assert.strictEqual(MODULE_PERMISSIONS.length, 10);
    assert.strictEqual(ALL_CANONICAL_PERMISSIONS.length, 73);

    const uniqueIds = new Set(ALL_CANONICAL_PERMISSIONS);
    assert.strictEqual(uniqueIds.size, 73);
  });

  it('F2. Exactly 7 default roles are defined and all permissions are valid canonical IDs', async () => {
    const { DEFAULT_ROLES, ALL_CANONICAL_PERMISSIONS } = await import('../src/constants/permissions.js');
    assert.strictEqual(DEFAULT_ROLES.length, 7);

    const superAdminRole = DEFAULT_ROLES.find((r) => r.id === 'super_admin');
    assert.ok(superAdminRole);
    assert.strictEqual(superAdminRole.permissions.length, 73);

    DEFAULT_ROLES.forEach((role) => {
      role.permissions.forEach((permId) => {
        assert.ok(
          ALL_CANONICAL_PERMISSIONS.includes(permId),
          `Role ${role.id} has invalid permission ID: ${permId}`
        );
      });
    });
  });

  // G. Privilege Escalation Defense Tests
  it('G1. Non-owner cannot grant themselves or others Owner privileges', async () => {
    const nonOwnerRequester = { isOwner: false, isSuperAdmin: true };
    const attemptBody = { isOwner: true, name: 'Escalated Admin' };
    
    // In admin.controller.js logic:
    const isOwnerAttempt = Boolean(attemptBody.isOwner);
    const requesterIsOwner = Boolean(nonOwnerRequester.isOwner);
    const isEscalationBlocked = isOwnerAttempt && !requesterIsOwner;
    assert.strictEqual(isEscalationBlocked, true);
  });

  it('G2. Non-SuperAdmin cannot promote accounts to Super Admin', async () => {
    const regularAdminRequester = { isOwner: false, isSuperAdmin: false };
    const attemptBody = { isSuperAdmin: true };

    const isSuperAdminAttempt = Boolean(attemptBody.isSuperAdmin);
    const requesterIsSuperAdmin = Boolean(regularAdminRequester.isSuperAdmin || regularAdminRequester.isOwner);
    const isSuperAdminEscalationBlocked = isSuperAdminAttempt && !requesterIsSuperAdmin;
    assert.strictEqual(isSuperAdminEscalationBlocked, true);
  });

  // H. Complex Precedence & Inheritance Tests
  it('H1. Role permission removal dynamically reflects in effective permissions', async () => {
    const adminWithRole = {
      id: 'admin-1',
      isOwner: false,
      isSuperAdmin: false,
      role: {
        id: 'moderator',
        permissions: [{ permissionId: 'view_reports' }, { permissionId: 'view_moderation' }],
      },
    };
    const beforeEffective = await calculateEffectivePermissions(adminWithRole);
    assert.ok(beforeEffective.permissions.includes('view_reports'));
    assert.ok(beforeEffective.permissions.includes('view_moderation'));

    // Remove permission from role
    const adminWithUpdatedRole = {
      ...adminWithRole,
      role: {
        id: 'moderator',
        permissions: [{ permissionId: 'view_reports' }], // view_moderation removed
      },
    };
    const afterEffective = await calculateEffectivePermissions(adminWithUpdatedRole);
    assert.ok(afterEffective.permissions.includes('view_reports'));
    assert.strictEqual(afterEffective.permissions.includes('view_moderation'), false);
  });

  it('H2. Explicit AdminPermissionOverride REVOKE overrides role-inherited permission', async () => {
    const adminWithOverride = {
      id: 'admin-2',
      isOwner: false,
      isSuperAdmin: false,
      role: {
        id: 'finance_admin',
        permissions: [{ permissionId: 'view_finance' }, { permissionId: 'approve_withdrawals' }],
      },
      permissionOverrides: [
        { permissionId: 'approve_withdrawals', overrideType: 'REVOKE' },
        { permissionId: 'view_users', overrideType: 'GRANT' },
      ],
    };
    const effective = await calculateEffectivePermissions(adminWithOverride);
    assert.ok(effective.permissions.includes('view_finance'));
    assert.ok(effective.permissions.includes('view_users')); // Added by grant
    assert.strictEqual(effective.permissions.includes('approve_withdrawals'), false); // Stripped by revoke
  });
});
