import ownerService from '../services/owner.service.js';
import effectivePermissionsService from '../services/effectivePermissions.service.js';

export async function getAdministrators(req, res, next) {
  try {
    const ownerId = req.auth.userId;
    const admins = await ownerService.getAdministrators({ ownerId });
    return res.status(200).json({
      success: true,
      data: admins,
    });
  } catch (error) {
    next(error);
  }
}

export async function createAdministrator(req, res, next) {
  try {
    const ownerId = req.auth.userId;
    const { name, username, email, password, isSuperAdmin, roleId, modules } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const newAdmin = await ownerService.createAdministrator({
      ownerId,
      name,
      username,
      email,
      password,
      isSuperAdmin,
      roleId,
      modules,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Administrator created successfully by Owner.',
      data: newAdmin,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAdministrator(req, res, next) {
  try {
    const ownerId = req.auth.userId;
    const adminId = req.params.id;
    const { name, username, email, status, roleId, isSuperAdmin } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const updated = await ownerService.updateAdministrator({
      ownerId,
      adminId,
      name,
      username,
      email,
      status,
      roleId,
      isSuperAdmin,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Administrator updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function setModuleAccess(req, res, next) {
  try {
    const ownerId = req.auth.userId;
    const adminId = req.params.id;
    const { modules } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const updatedAccess = await ownerService.setModuleAccess({
      ownerId,
      adminId,
      modules,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Module access updated successfully.',
      data: updatedAccess,
    });
  } catch (error) {
    next(error);
  }
}

export async function grantPermission(req, res, next) {
  try {
    const ownerId = req.auth.userId;
    const adminId = req.params.id;
    const { permissionId, reason } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const grant = await ownerService.grantDirectPermission({
      ownerId,
      adminId,
      permissionId,
      reason,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Direct permission granted successfully.',
      data: grant,
    });
  } catch (error) {
    next(error);
  }
}

export async function revokePermission(req, res, next) {
  try {
    const ownerId = req.auth.userId;
    const adminId = req.params.id;
    const { permissionId, reason } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const grant = await ownerService.revokeDirectPermission({
      ownerId,
      adminId,
      permissionId,
      reason,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Direct permission revoked successfully.',
      data: grant,
    });
  } catch (error) {
    next(error);
  }
}

export async function setApprovalAuthority(req, res, next) {
  try {
    const ownerId = req.auth.userId;
    const adminId = req.params.id;
    const { canApprove, reason } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const grant = await ownerService.setApprovalAuthority({
      ownerId,
      adminId,
      canApprove,
      reason,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Approval authority updated successfully.',
      data: grant,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const ownerId = req.auth.userId;
    const { limit = 100, offset = 0 } = req.query;
    const logs = await ownerService.getOwnerAuditLogs({ ownerId, limit, offset });
    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}

export async function getEffectivePermissionsForAdmin(req, res, next) {
  try {
    const adminId = req.params.id;
    const effective = await effectivePermissionsService.calculateEffectivePermissions(adminId);
    return res.status(200).json({
      success: true,
      data: effective,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getAdministrators,
  createAdministrator,
  updateAdministrator,
  setModuleAccess,
  grantPermission,
  revokePermission,
  setApprovalAuthority,
  getAuditLogs,
  getEffectivePermissionsForAdmin,
};
