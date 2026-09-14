import adminRepository from '../repositories/admin.repository.js';
import ownerGrantRepository from '../repositories/ownerGrant.repository.js';

export const ALL_SYSTEM_MODULES = [
  'dashboard',
  'approvals',
  'users',
  'wallet',
  'hosts',
  'agencies',
  'bd-centers',
  'live-rooms',
  'room-pins',
  'coin-sellers',
  'merchants',
  'recharge-plans',
  'online-recharge',
  'offline-recharge',
  'withdrawals',
  'transactions',
  'finance',
  'coin-refunds',
  'reseller-corrections',
  'refund-requests',
  'chargebacks',
  'risk',
  'assets',
  'gifts',
  'emojis',
  'vip-store',
  'items',
  'store',
  'games',
  'economy',
  'pk-events',
  'rankings',
  'referrals',
  'banners',
  'announcements',
  'room-theme-approval',
  'notifications',
  'moderation',
  'restrictions',
  'chat',
  'support',
  'reports',
  'teams-roles',
  'audit-logs',
  'settings',
  'localization',
  'payment-providers',
  'api-logs',
  'system-health',
  'app-config',
  'backups',
  'privacy',
  'policy-versioning',
  'jobs',
];

export async function calculateEffectivePermissions(adminId) {
  const admin = typeof adminId === 'object' ? adminId : await adminRepository.findById(adminId);
  if (!admin) {
    return { modules: [], permissions: [], canApprove: false, isOwner: false };
  }

  if (admin.isOwner) {
    return {
      isOwner: true,
      isSuperAdmin: true,
      modules: [...ALL_SYSTEM_MODULES, 'owner-control'],
      permissions: ['*'],
      canApprove: true,
    };
  }

  // Calculate Modules
  let effectiveModules = [];
  const moduleAccessRecords = admin.moduleAccess || [];
  if (moduleAccessRecords.length > 0) {
    effectiveModules = moduleAccessRecords.map((m) => m.module);
  } else if (admin.isSuperAdmin) {
    effectiveModules = [...ALL_SYSTEM_MODULES];
  } else {
    // Infer default modules from role permissions if no explicit moduleAccess configured
    effectiveModules = inferModulesFromRolePermissions(admin.role);
  }

  // Ensure owner-control is NEVER in effectiveModules for non-Owner
  effectiveModules = effectiveModules.filter((m) => m !== 'owner-control');

  // Calculate Action Permissions
  let effectivePermissions = new Set();

  if (admin.isSuperAdmin) {
    effectivePermissions.add('*');
  } else if (admin.role && admin.role.permissions) {
    admin.role.permissions.forEach((rp) => {
      if (rp.permissionId) {
        effectivePermissions.add(rp.permissionId);
      }
    });
  }

  // Apply Direct Permission Overrides (AdminPermissionOverride)
  const overrides = admin.permissionOverrides || [];
  overrides.forEach((override) => {
    if (override.overrideType === 'GRANT' && override.permissionId) {
      effectivePermissions.add(override.permissionId);
    } else if (override.overrideType === 'REVOKE' && override.permissionId) {
      effectivePermissions.delete(override.permissionId);
    }
  });

  // Apply Owner Grants and Revocations (OwnerGrant)
  const grants = admin.ownerGrants || [];
  grants.forEach((grant) => {
    if (grant.status === 'ACTIVE') {
      if (grant.grantType === 'PERMISSION_GRANT' && grant.permissionId) {
        effectivePermissions.add(grant.permissionId);
      } else if (grant.grantType === 'PERMISSION_REVOKE' && grant.permissionId) {
        effectivePermissions.delete(grant.permissionId);
      }
    }
  });

  // Calculate Approval Authority
  let canApprove = Boolean(admin.isSuperAdmin);
  const approvalGrant = grants.find(
    (g) => g.status === 'ACTIVE' && (g.grantType === 'APPROVAL_AUTHORITY' || g.canApprove)
  );
  if (approvalGrant) {
    canApprove = true;
  }

  return {
    isOwner: false,
    isSuperAdmin: Boolean(admin.isSuperAdmin),
    modules: effectiveModules,
    permissions: Array.from(effectivePermissions),
    canApprove,
  };
}

function inferModulesFromRolePermissions(role) {
  if (!role || !role.permissions) return ['dashboard'];
  const permIds = role.permissions.map((p) => p.permissionId);

  const modules = new Set(['dashboard']);

  if (permIds.some((p) => p.includes('user'))) modules.add('users');
  if (permIds.some((p) => p.includes('host'))) modules.add('hosts');
  if (permIds.some((p) => p.includes('agency'))) modules.add('agencies');
  if (permIds.some((p) => p.includes('seller') || p.includes('reseller'))) modules.add('coin-sellers');
  if (permIds.some((p) => p.includes('merchant'))) modules.add('merchants');
  if (permIds.some((p) => p.includes('recharge'))) {
    modules.add('recharge-plans');
    modules.add('online-recharge');
    modules.add('offline-recharge');
  }
  if (permIds.some((p) => p.includes('withdrawal'))) modules.add('withdrawals');
  if (permIds.some((p) => p.includes('finance') || p.includes('ledger') || p.includes('revenue'))) {
    modules.add('finance');
    modules.add('transactions');
    modules.add('wallet');
  }
  if (permIds.some((p) => p.includes('gift'))) modules.add('gifts');
  if (permIds.some((p) => p.includes('asset') || p.includes('store'))) modules.add('assets');
  if (permIds.some((p) => p.includes('game'))) modules.add('games');
  if (permIds.some((p) => p.includes('pk'))) modules.add('pk-events');
  if (permIds.some((p) => p.includes('moderation') || p.includes('report') || p.includes('restriction'))) {
    modules.add('moderation');
    modules.add('restrictions');
  }
  if (permIds.some((p) => p.includes('support'))) modules.add('support');
  if (permIds.some((p) => p.includes('admin') || p.includes('team') || p.includes('role'))) {
    modules.add('teams-roles');
    modules.add('audit-logs');
  }

  return Array.from(modules);
}

export default {
  ALL_SYSTEM_MODULES,
  calculateEffectivePermissions,
};
