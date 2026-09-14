import prisma from '../config/database.js';
import adminRepository from '../repositories/admin.repository.js';
import teamRepository from '../repositories/team.repository.js';
import { calculateEffectivePermissions } from '../services/effectivePermissions.service.js';
import { hashPassword } from '../utils/crypto.util.js';

async function logAudit({ adminId, adminName, action, targetEntity, targetEntityId, beforeStateJson, afterStateJson, reason, ipAddress }) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId || 'SYSTEM',
        adminName: adminName || 'System',
        action,
        targetEntity,
        targetEntityId: targetEntityId || null,
        beforeStateJson: beforeStateJson ? JSON.parse(JSON.stringify(beforeStateJson)) : null,
        afterStateJson: afterStateJson ? JSON.parse(JSON.stringify(afterStateJson)) : null,
        reason: reason || null,
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

function sanitizeAdmin(admin) {
  if (!admin) return null;
  const { passwordHash, ...rest } = admin;
  return rest;
}

export async function getAdmins(req, res, next) {
  try {
    const isOwner = Boolean(req.auth?.isOwner);
    const { search, roleId, status } = req.query;

    const admins = await adminRepository.findAll({
      includeOwner: isOwner,
      search: search || '',
      roleId: roleId || '',
      status: status || '',
    });

    return res.status(200).json({
      success: true,
      message: 'Administrators list retrieved successfully',
      data: admins.map(sanitizeAdmin),
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminById(req, res, next) {
  try {
    const isOwner = Boolean(req.auth?.isOwner);
    const { id } = req.params;

    const admin = await adminRepository.findById(id, { includeOwner: isOwner });
    if (!admin) {
      // Check if target is actually Owner to log audit attempt
      const rawAdmin = await prisma.admin.findUnique({ where: { id } });
      if (rawAdmin && rawAdmin.isOwner && !isOwner) {
        await logAudit({
          adminId: req.auth.userId,
          adminName: req.admin?.name,
          action: 'UNAUTHORIZED_OWNER_EXPOSURE_ATTEMPT',
          targetEntity: 'Admin',
          targetEntityId: id,
          reason: 'Non-owner attempted to access Owner details by ID',
          ipAddress: req.ip || req.headers['x-forwarded-for'],
        });
      }

      return res.status(404).json({
        success: false,
        message: 'Administrator not found',
        error: { code: 'ADMIN_NOT_FOUND' },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Administrator details retrieved',
      data: sanitizeAdmin(admin),
    });
  } catch (err) {
    next(err);
  }
}

export async function createAdmin(req, res, next) {
  try {
    const requesterIsOwner = Boolean(req.auth?.isOwner);
    const { name, username, email, password, roleId, status, isOwner: reqIsOwner, isSuperAdmin: reqIsSuperAdmin } = req.body;

    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    // Privilege escalation checks
    if (reqIsOwner || reqIsSuperAdmin || req.body.role === 'OWNER' || roleId === 'owner') {
      if (!requesterIsOwner) {
        await logAudit({
          adminId: req.auth.userId,
          adminName: req.admin?.name,
          action: 'UNAUTHORIZED_PRIVILEGE_ESCALATION_ATTEMPT',
          targetEntity: 'Admin',
          reason: 'Attempted to set isOwner/isSuperAdmin/OWNER role without authority',
          ipAddress,
        });

        return res.status(403).json({
          success: false,
          message: 'Privilege escalation attempt rejected.',
          error: { code: 'PRIVILEGE_ESCALATION_ATTEMPT' },
        });
      }
    }

    // Permission delegation check for role assignment
    if (roleId && !requesterIsOwner) {
      const targetRole = await prisma.role.findUnique({
        where: { id: roleId },
        include: { permissions: true },
      });

      if (targetRole) {
        const requesterEffective = await calculateEffectivePermissions(req.auth.userId);
        const requesterPerms = requesterEffective.permissions || [];

        const rolePermIds = targetRole.permissions.map((p) => p.permissionId);
        const hasUnpossessed = rolePermIds.some(
          (p) => !requesterPerms.includes('*') && !requesterPerms.includes(p)
        );

        if (hasUnpossessed) {
          await logAudit({
            adminId: req.auth.userId,
            adminName: req.admin?.name,
            action: 'UNAUTHORIZED_PERMISSION_DELEGATION_ATTEMPT',
            targetEntity: 'Role',
            targetEntityId: roleId,
            reason: 'Attempted to assign role containing permissions outside requester authority',
            ipAddress,
          });

          return res.status(403).json({
            success: false,
            message: 'Permission delegation error: Cannot assign role containing permissions outside your authority.',
            error: { code: 'UNAUTHORIZED_DELEGATION' },
          });
        }
      }
    }

    const existing = await adminRepository.findByUsernameOrEmail(username, { includeOwner: true });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Administrator with this username or email already exists.',
        error: { code: 'ADMIN_EXISTS' },
      });
    }

    const passwordHash = await hashPassword(password || 'AdminSecret123!');
    const created = await adminRepository.createAdmin({
      name,
      username,
      email: email ? email.toLowerCase() : `${username}@zeparty.app`,
      passwordHash,
      status: status || 'ACTIVE',
      isSuperAdmin: requesterIsOwner ? Boolean(reqIsSuperAdmin) : false,
      isOwner: false,
      roleId: roleId || null,
    });

    await logAudit({
      adminId: req.auth.userId,
      adminName: req.admin?.name,
      action: 'ADMIN_CREATED',
      targetEntity: 'Admin',
      targetEntityId: created.id,
      afterStateJson: { name, username, email, roleId, status },
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Administrator account created successfully',
      data: sanitizeAdmin(created),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAdmin(req, res, next) {
  try {
    const requesterIsOwner = Boolean(req.auth?.isOwner);
    const { id } = req.params;
    const { name, username, email, status, roleId, isOwner: reqIsOwner, isSuperAdmin: reqIsSuperAdmin } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const targetAdmin = await prisma.admin.findUnique({ where: { id } });
    if (!targetAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Target administrator not found.',
        error: { code: 'ADMIN_NOT_FOUND' },
      });
    }

    // Owner protection
    if (targetAdmin.isOwner && !requesterIsOwner) {
      await logAudit({
        adminId: req.auth.userId,
        adminName: req.admin?.name,
        action: 'OWNER_MODIFICATION_ATTEMPT',
        targetEntity: 'Admin',
        targetEntityId: id,
        reason: 'Non-owner attempted to modify Owner account',
        ipAddress,
      });

      return res.status(403).json({
        success: false,
        message: 'Action prohibited: Owner account cannot be modified by non-owner.',
        error: { code: 'FORBIDDEN_OWNER_PROTECTION' },
      });
    }

    // Privilege escalation check
    if (reqIsOwner !== undefined || reqIsSuperAdmin !== undefined || req.body.role === 'OWNER') {
      if (!requesterIsOwner) {
        await logAudit({
          adminId: req.auth.userId,
          adminName: req.admin?.name,
          action: 'UNAUTHORIZED_PRIVILEGE_ESCALATION_ATTEMPT',
          targetEntity: 'Admin',
          targetEntityId: id,
          reason: 'Attempted to tamper isOwner/isSuperAdmin field',
          ipAddress,
        });

        return res.status(403).json({
          success: false,
          message: 'Privilege escalation attempt rejected.',
          error: { code: 'PRIVILEGE_ESCALATION_ATTEMPT' },
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (status !== undefined) updateData.status = status;
    if (roleId !== undefined) updateData.roleId = roleId;
    if (requesterIsOwner && reqIsSuperAdmin !== undefined) updateData.isSuperAdmin = Boolean(reqIsSuperAdmin);

    const updated = await adminRepository.updateAdmin(id, updateData);

    await logAudit({
      adminId: req.auth.userId,
      adminName: req.admin?.name,
      action: 'ADMIN_UPDATED',
      targetEntity: 'Admin',
      targetEntityId: id,
      beforeStateJson: { name: targetAdmin.name, status: targetAdmin.status, roleId: targetAdmin.roleId },
      afterStateJson: updateData,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Administrator account updated successfully',
      data: sanitizeAdmin(updated),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminStatus(req, res, next) {
  try {
    const requesterIsOwner = Boolean(req.auth?.isOwner);
    const { id } = req.params;
    const { status } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const targetAdmin = await prisma.admin.findUnique({ where: { id } });
    if (!targetAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Target administrator not found.',
        error: { code: 'ADMIN_NOT_FOUND' },
      });
    }

    if (targetAdmin.isOwner) {
      await logAudit({
        adminId: req.auth.userId,
        adminName: req.admin?.name,
        action: 'OWNER_DISABLE_ATTEMPT',
        targetEntity: 'Admin',
        targetEntityId: id,
        reason: 'Attempted to change status of Owner account',
        ipAddress,
      });

      return res.status(403).json({
        success: false,
        message: 'Action prohibited: Owner account status cannot be altered.',
        error: { code: 'FORBIDDEN_OWNER_PROTECTION' },
      });
    }

    const updated = await adminRepository.updateAdmin(id, { status });

    await logAudit({
      adminId: req.auth.userId,
      adminName: req.admin?.name,
      action: 'ADMIN_STATUS_CHANGED',
      targetEntity: 'Admin',
      targetEntityId: id,
      beforeStateJson: { status: targetAdmin.status },
      afterStateJson: { status },
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: `Administrator status updated to ${status}`,
      data: sanitizeAdmin(updated),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdmin(req, res, next) {
  try {
    const requesterIsOwner = Boolean(req.auth?.isOwner);
    const { id } = req.params;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const targetAdmin = await prisma.admin.findUnique({ where: { id } });
    if (!targetAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Target administrator not found.',
        error: { code: 'ADMIN_NOT_FOUND' },
      });
    }

    if (targetAdmin.isOwner) {
      await logAudit({
        adminId: req.auth.userId,
        adminName: req.admin?.name,
        action: 'OWNER_DELETE_ATTEMPT',
        targetEntity: 'Admin',
        targetEntityId: id,
        reason: 'Attempted to delete Owner account',
        ipAddress,
      });

      return res.status(403).json({
        success: false,
        message: 'Action prohibited: Owner account cannot be deleted.',
        error: { code: 'FORBIDDEN_OWNER_PROTECTION' },
      });
    }

    await adminRepository.deleteAdmin(id);

    await logAudit({
      adminId: req.auth.userId,
      adminName: req.admin?.name,
      action: 'ADMIN_DELETED',
      targetEntity: 'Admin',
      targetEntityId: id,
      beforeStateJson: { name: targetAdmin.name, username: targetAdmin.username },
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Administrator account deleted successfully',
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

// ROLES & PERMISSIONS
export async function getRoles(req, res, next) {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystemRole: r.isSystemRole,
      isSuperAdmin: r.id === 'super_admin' || r.name.toLowerCase().includes('super admin'),
      permissions: r.permissions.map((p) => p.permissionId),
    }));

    return res.status(200).json({
      success: true,
      message: 'Roles retrieved successfully',
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
}

export async function createRole(req, res, next) {
  try {
    const requesterIsOwner = Boolean(req.auth?.isOwner);
    const { name, description, permissions = [] } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    // Permission Delegation Check for Role Creation
    if (!requesterIsOwner) {
      const requesterEffective = await calculateEffectivePermissions(req.auth.userId);
      const requesterPerms = requesterEffective.permissions || [];

      const hasUnauthorized = permissions.some(
        (p) => !requesterPerms.includes('*') && !requesterPerms.includes(p)
      );

      if (hasUnauthorized) {
        await logAudit({
          adminId: req.auth.userId,
          adminName: req.admin?.name,
          action: 'UNAUTHORIZED_ROLE_CREATION_ATTEMPT',
          targetEntity: 'Role',
          reason: `Attempted to create role '${name}' with permissions outside authority`,
          ipAddress,
        });

        return res.status(403).json({
          success: false,
          message: 'Cannot create role containing permissions beyond your authority.',
          error: { code: 'UNAUTHORIZED_ROLE_CREATION' },
        });
      }
    }

    const createdRole = await prisma.role.create({
      data: {
        name,
        description,
        isSystemRole: false,
        permissions: {
          create: permissions.map((pId) => ({
            permission: { connect: { id: pId } },
          })),
        },
      },
      include: {
        permissions: true,
      },
    });

    await logAudit({
      adminId: req.auth.userId,
      adminName: req.admin?.name,
      action: 'ROLE_CREATED',
      targetEntity: 'Role',
      targetEntityId: createdRole.id,
      afterStateJson: { name, description, permissions },
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: {
        id: createdRole.id,
        name: createdRole.name,
        description: createdRole.description,
        permissions: createdRole.permissions.map((p) => p.permissionId),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateRole(req, res, next) {
  try {
    const requesterIsOwner = Boolean(req.auth?.isOwner);
    const { id } = req.params;
    const { name, description, permissions } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found.',
        error: { code: 'ROLE_NOT_FOUND' },
      });
    }

    // Permission Delegation Check
    if (permissions && Array.isArray(permissions) && !requesterIsOwner) {
      const requesterEffective = await calculateEffectivePermissions(req.auth.userId);
      const requesterPerms = requesterEffective.permissions || [];

      const hasUnauthorized = permissions.some(
        (p) => !requesterPerms.includes('*') && !requesterPerms.includes(p)
      );

      if (hasUnauthorized) {
        await logAudit({
          adminId: req.auth.userId,
          adminName: req.admin?.name,
          action: 'UNAUTHORIZED_ROLE_MODIFICATION_ATTEMPT',
          targetEntity: 'Role',
          targetEntityId: id,
          reason: 'Attempted to add permissions to role outside requester authority',
          ipAddress,
        });

        return res.status(403).json({
          success: false,
          message: 'Cannot assign permissions to role beyond your authority.',
          error: { code: 'UNAUTHORIZED_ROLE_MODIFICATION' },
        });
      }
    }

    if (permissions && Array.isArray(permissions)) {
      await prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await prisma.rolePermission.createMany({
        data: permissions.map((pId) => ({ roleId: id, permissionId: pId })),
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const updatedRole = await prisma.role.update({
      where: { id },
      data: updateData,
      include: { permissions: true },
    });

    await logAudit({
      adminId: req.auth.userId,
      adminName: req.admin?.name,
      action: 'ROLE_UPDATED',
      targetEntity: 'Role',
      targetEntityId: id,
      afterStateJson: { name, description, permissions },
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Role permissions updated successfully',
      data: {
        id: updatedRole.id,
        name: updatedRole.name,
        description: updatedRole.description,
        permissions: updatedRole.permissions.map((p) => p.permissionId),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getPermissions(req, res, next) {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: { module: 'asc' },
    });

    return res.status(200).json({
      success: true,
      message: 'Permissions list retrieved successfully',
      data: permissions,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminPermissions(req, res, next) {
  try {
    const isOwner = Boolean(req.auth?.isOwner);
    const { id } = req.params;

    const admin = await adminRepository.findById(id, { includeOwner: isOwner });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found',
        error: { code: 'ADMIN_NOT_FOUND' },
      });
    }

    const effective = await calculateEffectivePermissions(admin.id);
    return res.status(200).json({
      success: true,
      data: effective,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminPermissions(req, res, next) {
  try {
    const requesterIsOwner = Boolean(req.auth?.isOwner);
    const { id } = req.params;
    const { grants = [], revocations = [] } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const targetAdmin = await prisma.admin.findUnique({ where: { id } });
    if (!targetAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Administrator not found',
        error: { code: 'ADMIN_NOT_FOUND' },
      });
    }

    if (targetAdmin.isOwner && !requesterIsOwner) {
      await logAudit({
        adminId: req.auth.userId,
        adminName: req.admin?.name,
        action: 'OWNER_PERMISSION_MODIFICATION_ATTEMPT',
        targetEntity: 'Admin',
        targetEntityId: id,
        reason: 'Attempted to modify Owner permissions',
        ipAddress,
      });

      return res.status(403).json({
        success: false,
        message: 'Action prohibited: Owner permissions cannot be modified by non-owner.',
        error: { code: 'FORBIDDEN_OWNER_PROTECTION' },
      });
    }

    // Permission Delegation Check on Grants
    if (grants.length > 0 && !requesterIsOwner) {
      const requesterEffective = await calculateEffectivePermissions(req.auth.userId);
      const requesterPerms = requesterEffective.permissions || [];

      const hasUnauthorized = grants.some(
        (p) => !requesterPerms.includes('*') && !requesterPerms.includes(p)
      );

      if (hasUnauthorized) {
        await logAudit({
          adminId: req.auth.userId,
          adminName: req.admin?.name,
          action: 'UNAUTHORIZED_PERMISSION_GRANT_ATTEMPT',
          targetEntity: 'Admin',
          targetEntityId: id,
          reason: 'Attempted to grant permissions outside authority',
          ipAddress,
        });

        return res.status(403).json({
          success: false,
          message: 'Cannot grant permissions beyond your authority.',
          error: { code: 'UNAUTHORIZED_GRANT' },
        });
      }
    }

    // Apply Overrides
    for (const pId of grants) {
      await prisma.adminPermissionOverride.upsert({
        where: { adminId_permissionId: { adminId: id, permissionId: pId } },
        update: { overrideType: 'GRANT', grantedBy: req.auth.userId },
        create: { adminId: id, permissionId: pId, overrideType: 'GRANT', grantedBy: req.auth.userId },
      });
    }

    for (const pId of revocations) {
      await prisma.adminPermissionOverride.upsert({
        where: { adminId_permissionId: { adminId: id, permissionId: pId } },
        update: { overrideType: 'REVOKE', grantedBy: req.auth.userId },
        create: { adminId: id, permissionId: pId, overrideType: 'REVOKE', grantedBy: req.auth.userId },
      });
    }

    await logAudit({
      adminId: req.auth.userId,
      adminName: req.admin?.name,
      action: 'PERMISSION_OVERRIDDEN',
      targetEntity: 'Admin',
      targetEntityId: id,
      afterStateJson: { grants, revocations },
      ipAddress,
    });

    const updatedEffective = await calculateEffectivePermissions(id);
    return res.status(200).json({
      success: true,
      message: 'Admin permissions updated successfully',
      data: updatedEffective,
    });
  } catch (err) {
    next(err);
  }
}

// TEAMS
export async function getTeams(req, res, next) {
  try {
    const isOwner = Boolean(req.auth?.isOwner);
    const teams = await teamRepository.findAllTeams();

    const sanitized = teams.map((t) => ({
      ...t,
      members: t.members
        .filter((m) => isOwner || !m.admin.isOwner)
        .map((m) => ({
          id: m.id,
          adminId: m.adminId,
          roleInTeam: m.roleInTeam,
          name: m.admin.name,
          username: m.admin.username,
          email: m.admin.email,
        })),
    }));

    return res.status(200).json({
      success: true,
      message: 'Teams retrieved successfully',
      data: sanitized,
    });
  } catch (err) {
    next(err);
  }
}

export async function createTeam(req, res, next) {
  try {
    const { name, description } = req.body;
    const created = await teamRepository.createTeam({ name, description });

    await logAudit({
      adminId: req.auth.userId,
      adminName: req.admin?.name,
      action: 'TEAM_CREATED',
      targetEntity: 'Team',
      targetEntityId: created.id,
      afterStateJson: { name, description },
      ipAddress: req.ip || req.headers['x-forwarded-for'],
    });

    return res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: created,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateTeam(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const updated = await teamRepository.updateTeam(id, { name, description });

    await logAudit({
      adminId: req.auth.userId,
      adminName: req.admin?.name,
      action: 'TEAM_UPDATED',
      targetEntity: 'Team',
      targetEntityId: id,
      afterStateJson: { name, description },
      ipAddress: req.ip || req.headers['x-forwarded-for'],
    });

    return res.status(200).json({
      success: true,
      message: 'Team updated successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteTeam(req, res, next) {
  try {
    const { id } = req.params;
    await teamRepository.deleteTeam(id);

    await logAudit({
      adminId: req.auth.userId,
      adminName: req.admin?.name,
      action: 'TEAM_DELETED',
      targetEntity: 'Team',
      targetEntityId: id,
      ipAddress: req.ip || req.headers['x-forwarded-for'],
    });

    return res.status(200).json({
      success: true,
      message: 'Team deleted successfully',
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function addTeamMember(req, res, next) {
  try {
    const { id: teamId } = req.params;
    const { adminId, roleInTeam } = req.body;

    const member = await teamRepository.addTeamMember({ teamId, adminId, roleInTeam });

    await logAudit({
      adminId: req.auth.userId,
      adminName: req.admin?.name,
      action: 'TEAM_MEMBER_ADDED',
      targetEntity: 'Team',
      targetEntityId: teamId,
      afterStateJson: { adminId, roleInTeam },
      ipAddress: req.ip || req.headers['x-forwarded-for'],
    });

    return res.status(200).json({
      success: true,
      message: 'Team member added successfully',
      data: member,
    });
  } catch (err) {
    next(err);
  }
}

export async function removeTeamMember(req, res, next) {
  try {
    const { id: teamId, adminId } = req.params;

    await teamRepository.removeTeamMember({ teamId, adminId });

    await logAudit({
      adminId: req.auth.userId,
      adminName: req.admin?.name,
      action: 'TEAM_MEMBER_REMOVED',
      targetEntity: 'Team',
      targetEntityId: teamId,
      afterStateJson: { removedAdminId: adminId },
      ipAddress: req.ip || req.headers['x-forwarded-for'],
    });

    return res.status(200).json({
      success: true,
      message: 'Team member removed successfully',
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      action = '',
      targetEntity = '',
      module = '',
      targetEntityId = '',
      targetId = '',
      targetType = '',
      adminId = '',
      operatorId = '',
      dateFrom = '',
      dateTo = '',
      startDate = '',
      endDate = '',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    const effectiveModule = targetEntity || module || targetType;
    if (effectiveModule && effectiveModule !== 'ALL' && effectiveModule !== 'All Modules') {
      where.targetEntity = { contains: effectiveModule, mode: 'insensitive' };
    }

    const effectiveTargetId = targetEntityId || targetId;
    if (effectiveTargetId) {
      where.targetEntityId = effectiveTargetId;
    }

    const effectiveAdminId = adminId || operatorId;
    if (effectiveAdminId) {
      where.adminId = effectiveAdminId;
    }

    const effectiveDateFrom = dateFrom || startDate;
    const effectiveDateTo = dateTo || endDate;
    if (effectiveDateFrom || effectiveDateTo) {
      where.createdAt = {};
      if (effectiveDateFrom) {
        where.createdAt.gte = new Date(effectiveDateFrom);
      }
      if (effectiveDateTo) {
        where.createdAt.lte = new Date(effectiveDateTo);
      }
    }

    if (search) {
      where.OR = [
        { adminName: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { targetEntity: { contains: search, mode: 'insensitive' } },
        { targetEntityId: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        take: limitNum,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Audit logs retrieved successfully',
      data: logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogById(req, res, next) {
  try {
    const { id } = req.params;
    const log = await prisma.auditLog.findUnique({
      where: { id },
    });
    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Audit log entry not found',
        error: { code: 'NOT_FOUND' },
      });
    }
    return res.status(200).json({
      success: true,
      data: log,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  updateAdminStatus,
  deleteAdmin,
  getRoles,
  createRole,
  updateRole,
  getPermissions,
  getAdminPermissions,
  updateAdminPermissions,
  getTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  getAuditLogs,
  getAuditLogById,
};


