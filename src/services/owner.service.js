import prisma from '../config/database.js';
import adminRepository from '../repositories/admin.repository.js';
import ownerGrantRepository from '../repositories/ownerGrant.repository.js';
import { hashPassword } from '../utils/crypto.util.js';

async function logOwnerAction({ ownerId, action, targetEntity, targetEntityId, beforeStateJson, afterStateJson, reason, ipAddress }) {
  const owner = await adminRepository.findById(ownerId);
  return await prisma.auditLog.create({
    data: {
      adminId: ownerId,
      adminName: owner ? owner.name : 'Owner',
      action,
      targetEntity,
      targetEntityId: targetEntityId || null,
      beforeStateJson: beforeStateJson ? JSON.parse(JSON.stringify(beforeStateJson)) : null,
      afterStateJson: afterStateJson ? JSON.parse(JSON.stringify(afterStateJson)) : null,
      reason: reason || 'Owner Governance Action',
      ipAddress: ipAddress || '127.0.0.1',
    },
  });
}

export async function getAdministrators({ ownerId }) {
  const owner = await adminRepository.findById(ownerId);
  if (!owner || !owner.isOwner) {
    const error = new Error('Access denied. Owner privilege required.');
    error.status = 403;
    error.code = 'OWNER_PRIVILEGE_REQUIRED';
    throw error;
  }
  const admins = await adminRepository.findAll({ includeOwner: true });
  return admins.map(sanitizeAdminOutput);
}

export async function createAdministrator({ ownerId, name, username, email, password, isSuperAdmin = false, roleId, modules = [], ipAddress }) {
  const owner = await adminRepository.findById(ownerId);
  if (!owner || !owner.isOwner) {
    const error = new Error('Access denied. Owner privilege required.');
    error.status = 403;
    error.code = 'OWNER_PRIVILEGE_REQUIRED';
    throw error;
  }

  const existing = await adminRepository.findByUsernameOrEmail(username);
  if (existing) {
    const error = new Error('Administrator with this username or email already exists.');
    error.status = 400;
    error.code = 'ADMIN_EXISTS';
    throw error;
  }

  const passwordHash = await hashPassword(password);
  const createdAdmin = await adminRepository.createAdmin({
    name,
    username,
    email: email.toLowerCase(),
    passwordHash,
    isSuperAdmin: Boolean(isSuperAdmin),
    isOwner: false,
    roleId: roleId || null,
    status: 'ACTIVE',
  });

  if (modules && modules.length > 0) {
    await ownerGrantRepository.setModuleAccess(createdAdmin.id, modules, ownerId);
  }

  await logOwnerAction({
    ownerId,
    action: 'OWNER_CREATED_ADMIN',
    targetEntity: 'Admin',
    targetEntityId: createdAdmin.id,
    afterStateJson: { name, username, email, isSuperAdmin, roleId, modules },
    ipAddress,
  });

  const refreshed = await adminRepository.findById(createdAdmin.id);
  return sanitizeAdminOutput(refreshed);
}

export async function updateAdministrator({ ownerId, adminId, name, username, email, status, roleId, isSuperAdmin, ipAddress }) {
  const owner = await adminRepository.findById(ownerId);
  if (!owner || !owner.isOwner) {
    const error = new Error('Access denied. Owner privilege required.');
    error.status = 403;
    error.code = 'OWNER_PRIVILEGE_REQUIRED';
    throw error;
  }

  const targetAdmin = await adminRepository.findById(adminId);
  if (!targetAdmin) {
    const error = new Error('Target administrator not found.');
    error.status = 404;
    error.code = 'ADMIN_NOT_FOUND';
    throw error;
  }

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (username !== undefined) updateData.username = username;
  if (email !== undefined) updateData.email = email.toLowerCase();
  if (status !== undefined) updateData.status = status;
  if (roleId !== undefined) updateData.roleId = roleId;
  if (isSuperAdmin !== undefined) updateData.isSuperAdmin = Boolean(isSuperAdmin);

  const updated = await adminRepository.updateAdmin(adminId, updateData);

  const actionName = status === 'SUSPENDED' ? 'OWNER_SUSPENDED_ADMIN' : status === 'ACTIVE' ? 'OWNER_REACTIVATED_ADMIN' : 'OWNER_UPDATED_ADMIN';

  await logOwnerAction({
    ownerId,
    action: actionName,
    targetEntity: 'Admin',
    targetEntityId: adminId,
    beforeStateJson: sanitizeAdminOutput(targetAdmin),
    afterStateJson: sanitizeAdminOutput(updated),
    ipAddress,
  });

  return sanitizeAdminOutput(updated);
}

export async function setModuleAccess({ ownerId, adminId, modules = [], ipAddress }) {
  const owner = await adminRepository.findById(ownerId);
  if (!owner || !owner.isOwner) {
    const error = new Error('Access denied. Owner privilege required.');
    error.status = 403;
    error.code = 'OWNER_PRIVILEGE_REQUIRED';
    throw error;
  }

  const targetAdmin = await adminRepository.findById(adminId);
  if (!targetAdmin) {
    const error = new Error('Target administrator not found.');
    error.status = 404;
    error.code = 'ADMIN_NOT_FOUND';
    throw error;
  }

  const updatedAccess = await ownerGrantRepository.setModuleAccess(adminId, modules, ownerId);

  await logOwnerAction({
    ownerId,
    action: 'OWNER_GRANTED_MODULE',
    targetEntity: 'AdminModuleAccess',
    targetEntityId: adminId,
    afterStateJson: { modules },
    ipAddress,
  });

  return updatedAccess;
}

export async function grantDirectPermission({ ownerId, adminId, permissionId, reason, ipAddress }) {
  const owner = await adminRepository.findById(ownerId);
  if (!owner || !owner.isOwner) {
    const error = new Error('Access denied. Owner privilege required.');
    error.status = 403;
    error.code = 'OWNER_PRIVILEGE_REQUIRED';
    throw error;
  }

  const grant = await ownerGrantRepository.createOwnerGrant({
    adminId,
    grantType: 'PERMISSION_GRANT',
    permissionId,
    grantedBy: ownerId,
    reason: reason || 'Owner Direct Grant',
    status: 'ACTIVE',
  });

  await logOwnerAction({
    ownerId,
    action: 'OWNER_GRANTED_PERMISSION',
    targetEntity: 'OwnerGrant',
    targetEntityId: grant.id,
    afterStateJson: { adminId, permissionId, reason },
    ipAddress,
  });

  return grant;
}

export async function revokeDirectPermission({ ownerId, adminId, permissionId, reason, ipAddress }) {
  const owner = await adminRepository.findById(ownerId);
  if (!owner || !owner.isOwner) {
    const error = new Error('Access denied. Owner privilege required.');
    error.status = 403;
    error.code = 'OWNER_PRIVILEGE_REQUIRED';
    throw error;
  }

  const grant = await ownerGrantRepository.createOwnerGrant({
    adminId,
    grantType: 'PERMISSION_REVOKE',
    permissionId,
    grantedBy: ownerId,
    reason: reason || 'Owner Explicit Revocation',
    status: 'ACTIVE',
  });

  await logOwnerAction({
    ownerId,
    action: 'OWNER_REVOKED_PERMISSION',
    targetEntity: 'OwnerGrant',
    targetEntityId: grant.id,
    afterStateJson: { adminId, permissionId, reason },
    ipAddress,
  });

  return grant;
}

export async function setApprovalAuthority({ ownerId, adminId, canApprove, reason, ipAddress }) {
  const owner = await adminRepository.findById(ownerId);
  if (!owner || !owner.isOwner) {
    const error = new Error('Access denied. Owner privilege required.');
    error.status = 403;
    error.code = 'OWNER_PRIVILEGE_REQUIRED';
    throw error;
  }

  const grant = await ownerGrantRepository.createOwnerGrant({
    adminId,
    grantType: 'APPROVAL_AUTHORITY',
    canApprove: Boolean(canApprove),
    grantedBy: ownerId,
    reason: reason || 'Owner Approval Authority Assignment',
    status: 'ACTIVE',
  });

  await logOwnerAction({
    ownerId,
    action: 'OWNER_CHANGED_APPROVAL_AUTHORITY',
    targetEntity: 'OwnerGrant',
    targetEntityId: grant.id,
    afterStateJson: { adminId, canApprove, reason },
    ipAddress,
  });

  return grant;
}

export async function getOwnerAuditLogs({ ownerId, limit = 100, offset = 0 }) {
  const owner = await adminRepository.findById(ownerId);
  if (!owner || !owner.isOwner) {
    const error = new Error('Access denied. Owner privilege required.');
    error.status = 403;
    error.code = 'OWNER_PRIVILEGE_REQUIRED';
    throw error;
  }

  return await prisma.auditLog.findMany({
    take: Number(limit),
    skip: Number(offset),
    orderBy: { createdAt: 'desc' },
  });
}

function sanitizeAdminOutput(admin) {
  if (!admin) return null;
  const { passwordHash, ...safeAdmin } = admin;
  return safeAdmin;
}

export default {
  getAdministrators,
  createAdministrator,
  updateAdministrator,
  setModuleAccess,
  grantDirectPermission,
  revokeDirectPermission,
  setApprovalAuthority,
  getOwnerAuditLogs,
};
