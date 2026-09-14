import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import prisma from '../src/config/database.js';
import { hashPassword } from '../src/utils/crypto.util.js';
import ownerService from '../src/services/owner.service.js';
import adminRepository from '../src/repositories/admin.repository.js';
import effectivePermissionsService from '../src/services/effectivePermissions.service.js';
import { requireOwner } from '../src/middlewares/requireOwner.js';
import { adminLogin } from '../src/services/auth.service.js';

describe('Phase 4 Owner / Root Admin Security Integration Suite', () => {
  const testIp = '127.0.0.1';
  const testUserAgent = 'ZeParty-Owner-Test/1.0';

  const ownerUsername = 'rootowner_' + Math.floor(Math.random() * 10000);
  const ownerPassword = 'OwnerSecretPassword999!';

  const superAdminUsername = 'superadmin_' + Math.floor(Math.random() * 10000);
  const superAdminPassword = 'SuperAdminPassword123!';

  const normalAdminUsername = 'normaladmin_' + Math.floor(Math.random() * 10000);
  const normalAdminPassword = 'NormalAdminPassword123!';

  let ownerAdmin, superAdmin, normalAdmin;

  before(async () => {
    const ownerPasswordHash = await hashPassword(ownerPassword);
    const superAdminPasswordHash = await hashPassword(superAdminPassword);
    const normalAdminPasswordHash = await hashPassword(normalAdminPassword);

    ownerAdmin = await prisma.admin.create({
      data: {
        name: 'Hidden Root Owner',
        username: ownerUsername,
        email: `${ownerUsername}@zeparty.app`,
        passwordHash: ownerPasswordHash,
        status: 'ACTIVE',
        isSuperAdmin: true,
        isOwner: true,
      },
    });

    superAdmin = await prisma.admin.create({
      data: {
        name: 'Normal Super Admin',
        username: superAdminUsername,
        email: `${superAdminUsername}@zeparty.app`,
        passwordHash: superAdminPasswordHash,
        status: 'ACTIVE',
        isSuperAdmin: true,
        isOwner: false,
      },
    });

    normalAdmin = await prisma.admin.create({
      data: {
        name: 'Normal Host Admin',
        username: normalAdminUsername,
        email: `${normalAdminUsername}@zeparty.app`,
        passwordHash: normalAdminPasswordHash,
        status: 'ACTIVE',
        isSuperAdmin: false,
        isOwner: false,
      },
    });
  });

  after(async () => {
    if (normalAdmin) await prisma.admin.delete({ where: { id: normalAdmin.id } }).catch(() => {});
    if (superAdmin) await prisma.admin.delete({ where: { id: superAdmin.id } }).catch(() => {});
    if (ownerAdmin) await prisma.admin.delete({ where: { id: ownerAdmin.id } }).catch(() => {});
    if (ownerAdmin) await prisma.user.delete({ where: { id: ownerAdmin.id } }).catch(() => {});
    if (superAdmin) await prisma.user.delete({ where: { id: superAdmin.id } }).catch(() => {});
    if (normalAdmin) await prisma.user.delete({ where: { id: normalAdmin.id } }).catch(() => {});
  });

  it('1. Owner login via unified admin login service', async () => {
    const ownerAuthResult = await adminLogin({
      usernameOrEmail: ownerUsername,
      password: ownerPassword,
      ipAddress: testIp,
      userAgent: testUserAgent,
    });
    assert.strictEqual(ownerAuthResult.admin.isOwner, true);
    assert.ok(ownerAuthResult.accessToken);
  });

  it('2. Owner Invisibility Safeguard in standard queries', async () => {
    const standardAdminsList = await adminRepository.findAll({ includeOwner: false });
    const containsOwner = standardAdminsList.some((a) => a.id === ownerAdmin.id || a.isOwner);
    assert.strictEqual(containsOwner, false);
  });

  it('3. Unified Login for Owner retains root claims', async () => {
    const unifiedAuthResult = await adminLogin({
      usernameOrEmail: ownerUsername,
      password: ownerPassword,
      ipAddress: testIp,
      userAgent: testUserAgent,
    });
    assert.strictEqual(unifiedAuthResult.admin.isOwner, true);
  });

  it('4. Super Admin Privilege Boundary: requireOwner blocks non-owner', () => {
    const mockReqSuperAdmin = { admin: superAdmin };
    let superAdminRejected = false;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 403 && data.error?.code === 'OWNER_PRIVILEGE_REQUIRED') {
            superAdminRejected = true;
          }
        },
      }),
    };

    requireOwner(mockReqSuperAdmin, mockRes, () => {
      assert.fail('requireOwner should not have called next() for superAdmin');
    });

    assert.strictEqual(superAdminRejected, true);
  });

  it('5. Two-Level Access Model & Effective Permissions', async () => {
    const targetModules = ['hosts', 'agencies', 'coin-sellers'];
    await ownerService.setModuleAccess({
      ownerId: ownerAdmin.id,
      adminId: normalAdmin.id,
      modules: targetModules,
      ipAddress: testIp,
    });

    await ownerService.grantDirectPermission({
      ownerId: ownerAdmin.id,
      adminId: normalAdmin.id,
      permissionId: 'hosts.approve',
      reason: 'Owner Test Grant',
      ipAddress: testIp,
    });

    await ownerService.revokeDirectPermission({
      ownerId: ownerAdmin.id,
      adminId: normalAdmin.id,
      permissionId: 'hosts.delete',
      reason: 'Owner Test Revocation',
      ipAddress: testIp,
    });

    const effective = await effectivePermissionsService.calculateEffectivePermissions(normalAdmin.id);
    assert.deepStrictEqual(effective.modules.sort(), targetModules.sort());
    assert.strictEqual(effective.permissions.includes('hosts.approve'), true);
    assert.strictEqual(effective.permissions.includes('hosts.delete'), false);
    assert.strictEqual(effective.modules.includes('owner-control'), false);
  });

  it('6. Owner Governance over Super Admin status', async () => {
    const suspendedSuperAdmin = await ownerService.updateAdministrator({
      ownerId: ownerAdmin.id,
      adminId: superAdmin.id,
      status: 'SUSPENDED',
      ipAddress: testIp,
    });
    assert.strictEqual(suspendedSuperAdmin.status, 'SUSPENDED');

    const reactivatedSuperAdmin = await ownerService.updateAdministrator({
      ownerId: ownerAdmin.id,
      adminId: superAdmin.id,
      status: 'ACTIVE',
      ipAddress: testIp,
    });
    assert.strictEqual(reactivatedSuperAdmin.status, 'ACTIVE');
  });

  it('7. Owner Governance Audit Trail is recorded', async () => {
    const auditLogs = await ownerService.getOwnerAuditLogs({ ownerId: ownerAdmin.id, limit: 10 });
    const hasCreatedAction = auditLogs.some((l) => l.action === 'OWNER_GRANTED_MODULE');
    assert.strictEqual(hasCreatedAction, true);
  });
});
