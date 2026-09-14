import { calculateEffectivePermissions } from '../services/effectivePermissions.service.js';
import prisma from '../config/database.js';

function normalizePermissionString(str) {
  if (!str) return [];
  const s = str.toLowerCase().trim();
  const variants = [s];

  // If dot notation e.g. "admins.view" -> add "view_admins", "admins_view"
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length === 2) {
      variants.push(`${parts[1]}_${parts[0]}`); // "view_admins"
      variants.push(`${parts[0]}_${parts[1]}`); // "admins_view"
    }
  }

  // If snake_case e.g. "view_admins" -> add "admins.view", "view.admins"
  if (s.includes('_')) {
    const parts = s.split('_');
    if (parts.length === 2) {
      variants.push(`${parts[1]}.${parts[0]}`); // "admins.view"
      variants.push(`${parts[0]}.${parts[1]}`); // "view.admins"
    }
  }

  return variants;
}

function matchesPermission(grantedPerm, reqPerm) {
  if (!grantedPerm || !reqPerm) return false;
  if (grantedPerm === '*') return true;
  
  const grantedVariants = normalizePermissionString(grantedPerm);
  const reqVariants = normalizePermissionString(reqPerm);

  return reqVariants.some((r) => grantedVariants.includes(r));
}

export function requirePermission(requiredPermission) {
  return async (req, res, next) => {
    try {
      if (!req.auth || !req.auth.isAdmin) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required for administrative resources',
          error: { code: 'UNAUTHORIZED' },
        });
      }

      if (!requiredPermission || typeof requiredPermission !== 'string' || requiredPermission.trim() === '') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Malformed or missing permission requirement',
          error: { code: 'FORBIDDEN' },
        });
      }

      if (req.auth.isOwner) {
        return next();
      }

      const effective = await calculateEffectivePermissions(req.admin || req.auth.userId);

      if (effective.isOwner) {
        return next();
      }

      const userPermissions = effective.permissions || [];

      const hasAccess =
        userPermissions.includes('*') ||
        userPermissions.some((p) => matchesPermission(p, requiredPermission));

      if (!hasAccess) {
        try {
          const adminIdentifier = typeof req.auth?.userId === 'object' ? (req.auth.userId?.id || 'ADMIN') : String(req.auth?.userId || 'ADMIN');
          await prisma.auditLog.create({
            data: {
              adminId: adminIdentifier,
              adminName: req.admin?.name || 'Admin',
              action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
              targetEntity: 'API_ENDPOINT',
              targetEntityId: req.originalUrl || 'API',
              reason: `Attempted access to protected endpoint requiring permission: ${requiredPermission}`,
              ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1',
            },
          }).catch(() => {});
        } catch (auditErr) {
          // Gracefully suppress logging error during tests
        }

        return res.status(403).json({
          success: false,
          message: `Access denied. Permission required: ${requiredPermission}`,
          error: { code: 'FORBIDDEN', requiredPermission },
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export default requirePermission;
