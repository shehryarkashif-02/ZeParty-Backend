/**
 * ZeParty Canonical Permissions & RBAC Hierarchy
 * Single Authoritative Source of Truth for the entire Backend
 * Exactly 73 Permissions across 10 Modules and 7 Default Roles
 */

export const MODULE_PERMISSIONS = [
  {
    module: 'users',
    label: 'USER MANAGEMENT',
    description: 'User profile lookups, bans, suspensions, balance adjustments, and device sessions',
    permissions: [
      { id: 'view_users', label: 'View Users' },
      { id: 'view_user_details', label: 'View User Details' },
      { id: 'edit_users', label: 'Edit Users' },
      { id: 'suspend_users', label: 'Suspend Users' },
      { id: 'ban_users', label: 'Ban Users' },
      { id: 'delete_user_posts', label: 'Delete User Posts' },
      { id: 'manage_balances', label: 'Adjust Balances' },
      { id: 'grant_user_props', label: 'Grant Special Props' },
      { id: 'manage_user_devices', label: 'Manage Devices & Sessions' },
    ],
  },
  {
    module: 'hosts_agencies',
    label: 'HOSTS & AGENCIES',
    description: 'Host verification applications, multi-tier agency networks, and BD center salaries',
    permissions: [
      { id: 'view_hosts', label: 'View Hosts' },
      { id: 'review_hosts', label: 'Review Host Applications' },
      { id: 'approve_reject_hosts', label: 'Approve/Reject Hosts' },
      { id: 'view_agencies', label: 'View Agencies' },
      { id: 'review_agencies', label: 'Review Agencies' },
      { id: 'approve_reject_agencies', label: 'Approve/Reject Agencies' },
      { id: 'manage_agency_finance', label: 'Manage Agency Finance' },
      { id: 'manage_bd_centers', label: 'Manage BD Centers' },
    ],
  },
  {
    module: 'live_rooms',
    label: 'LIVE ROOMS & PK',
    description: 'Active video/audio streaming rooms, cover image management, and PK event schedules',
    permissions: [
      { id: 'view_live_rooms', label: 'View Live Rooms' },
      { id: 'view_room_details', label: 'View Room Details' },
      { id: 'moderation_actions', label: 'Room Moderation Actions' },
      { id: 'delete_room_dp', label: 'Delete Room DP' },
      { id: 'view_pk_events', label: 'View PK & Events' },
      { id: 'manage_pk_events', label: 'Manage PK & Events' },
    ],
  },
  {
    module: 'resellers_merchants',
    label: 'RESELLERS & MERCHANTS',
    description: 'Authorized P2P coin resellers, credit limits, merchant accounts, and coin issuance',
    permissions: [
      { id: 'view_sellers', label: 'View Resellers' },
      { id: 'manage_sellers', label: 'Manage Resellers' },
      { id: 'view_merchants', label: 'View Merchants' },
      { id: 'manage_merchants', label: 'Manage Merchants' },
      { id: 'issue_coins', label: 'Issue Coins' },
    ],
  },
  {
    module: 'monetization_finance',
    label: 'RECHARGE & WITHDRAWALS',
    description: 'Recharge packages, bank transfer receipts, host withdrawals, and transaction ledger',
    permissions: [
      { id: 'view_recharge_plans', label: 'View Recharge Plans' },
      { id: 'manage_recharge_plans', label: 'Manage Recharge Plans' },
      { id: 'view_offline_recharge', label: 'Review Offline Recharge' },
      { id: 'approve_offline_recharge', label: 'Approve Offline Recharge' },
      { id: 'view_withdrawals', label: 'Review Withdrawals' },
      { id: 'approve_withdrawals', label: 'Approve Withdrawals' },
      { id: 'reject_withdrawals', label: 'Reject Withdrawals' },
      { id: 'view_finance', label: 'View Finance & Revenue' },
      { id: 'view_ledger', label: 'View Transaction Ledger' },
    ],
  },
  {
    module: 'refunds_risk',
    label: 'REFUNDS, CORRECTIONS & RISK',
    description: 'Double recharge refunds, store disputes, reseller balance corrections, and chargebacks',
    permissions: [
      { id: 'view_refunds', label: 'View Refund Requests' },
      { id: 'approve_refunds', label: 'Approve Refunds' },
      { id: 'reseller_corrections', label: 'Reseller Coin Correction' },
      { id: 'view_chargebacks', label: 'View Chargebacks' },
      { id: 'view_fraud_risk', label: 'View Fraud & Risk Center' },
      { id: 'take_risk_actions', label: 'Take Risk Freeze Actions' },
    ],
  },
  {
    module: 'economy_catalog',
    label: 'VIRTUAL ECONOMY & STORE',
    description: 'Virtual gift catalog, VIP perks, dynamic avatar store, mini-games, and revenue split',
    permissions: [
      { id: 'view_gifts', label: 'View Gifts' },
      { id: 'manage_gifts', label: 'Manage Gifts' },
      { id: 'view_vip_store', label: 'View VIP Store' },
      { id: 'manage_vip_store', label: 'Manage VIP Store' },
      { id: 'view_store', label: 'View Virtual Store' },
      { id: 'manage_store', label: 'Manage Store Items' },
      { id: 'view_games', label: 'View Games' },
      { id: 'manage_games', label: 'Manage Games' },
      { id: 'economy_settings', label: 'Manage Economy & Policy Settings' },
    ],
  },
  {
    module: 'content_communications',
    label: 'BANNERS & COMMUNICATIONS',
    description: 'Homepage banners, global announcements, and targeted push notifications',
    permissions: [
      { id: 'view_banners', label: 'View Banners' },
      { id: 'manage_banners', label: 'Manage Banners' },
      { id: 'view_announcements', label: 'View Announcements' },
      { id: 'manage_announcements', label: 'Manage Announcements' },
      { id: 'view_notifications', label: 'View Notifications' },
      { id: 'manage_notifications', label: 'Manage Notifications' },
    ],
  },
  {
    module: 'moderation_support',
    label: 'MODERATION & SUPPORT',
    description: 'User violation reports, moderation restrictions, chat keywords, and customer support tickets',
    permissions: [
      { id: 'view_reports', label: 'View Reports' },
      { id: 'view_moderation', label: 'View Moderation' },
      { id: 'action_moderation', label: 'Action Moderation Cases' },
      { id: 'manage_restrictions', label: 'Manage User Restrictions' },
      { id: 'view_chat', label: 'View Chat Moderation' },
      { id: 'view_support', label: 'View Support Tickets' },
      { id: 'manage_support', label: 'Manage Support Tickets' },
    ],
  },
  {
    module: 'governance_system',
    label: 'SYSTEM & GOVERNANCE',
    description: 'Administrator accounts, role assignments, audit logs, system health, and data exports',
    permissions: [
      { id: 'view_admins', label: 'View Admins & Roles' },
      { id: 'manage_admins', label: 'Manage Admin Accounts' },
      { id: 'manage_roles', label: 'Manage Roles & Permissions' },
      { id: 'view_audit_logs', label: 'View Audit Logs' },
      { id: 'view_settings', label: 'View System Settings' },
      { id: 'manage_settings', label: 'Manage System Settings' },
      { id: 'view_system_health', label: 'View System Health & Logs' },
      { id: 'export_data', label: 'Export Data (CSV/XLSX)' },
    ],
  },
];

export const ALL_CANONICAL_PERMISSIONS = MODULE_PERMISSIONS.flatMap((m) =>
  m.permissions.map((p) => p.id)
);

export const DEFAULT_ROLES = [
  {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Unrestricted master administrative access across all portal modules, economy policies, and governance.',
    isSystemRole: true,
    permissions: ALL_CANONICAL_PERMISSIONS,
  },
  {
    id: 'finance_admin',
    name: 'Finance Admin',
    description: 'Full control over recharge, withdrawals, resellers, merchants, transaction ledger, and finance.',
    isSystemRole: true,
    permissions: [
      'view_users', 'view_user_details', 'manage_balances',
      'view_sellers', 'manage_sellers', 'view_merchants', 'manage_merchants', 'issue_coins',
      'view_recharge_plans', 'manage_recharge_plans', 'view_offline_recharge', 'approve_offline_recharge',
      'view_withdrawals', 'approve_withdrawals', 'reject_withdrawals', 'view_finance', 'view_ledger',
      'view_refunds', 'approve_refunds', 'reseller_corrections', 'view_chargebacks',
      'view_audit_logs', 'export_data',
    ],
  },
  {
    id: 'host_admin',
    name: 'Host Admin',
    description: 'Manages host applications, host performance, live hosts, and live room verification.',
    isSystemRole: true,
    permissions: [
      'view_users', 'view_user_details', 'edit_users',
      'view_hosts', 'review_hosts', 'approve_reject_hosts',
      'view_agencies', 'view_live_rooms', 'view_room_details',
      'view_pk_events', 'view_audit_logs',
    ],
  },
  {
    id: 'agency_admin',
    name: 'Agency Admin',
    description: 'Manages agency applications, host assignments, agency commissions, and settlements.',
    isSystemRole: true,
    permissions: [
      'view_users', 'view_user_details',
      'view_hosts', 'view_agencies', 'review_agencies', 'approve_reject_agencies', 'manage_agency_finance',
      'view_audit_logs',
    ],
  },
  {
    id: 'moderator',
    name: 'Moderator',
    description: 'Full moderation oversight for user accounts, live rooms, user reports, and bans.',
    isSystemRole: true,
    permissions: [
      'view_users', 'view_user_details', 'suspend_users', 'ban_users', 'manage_user_devices',
      'view_live_rooms', 'view_room_details', 'moderation_actions',
      'view_reports', 'view_moderation', 'action_moderation', 'manage_restrictions', 'view_chat',
      'view_fraud_risk', 'take_risk_actions', 'view_audit_logs',
    ],
  },
  {
    id: 'content_admin',
    name: 'Content Admin',
    description: 'Manages virtual gifts, store catalog, banners, announcements, PK events, and minigames.',
    isSystemRole: true,
    permissions: [
      'view_users', 'view_user_details', 'grant_user_props',
      'view_gifts', 'manage_gifts', 'view_vip_store', 'manage_vip_store', 'view_store', 'manage_store',
      'view_games', 'manage_games', 'view_banners', 'manage_banners',
      'view_announcements', 'manage_announcements', 'view_notifications', 'manage_notifications',
      'view_pk_events', 'manage_pk_events', 'view_audit_logs',
    ],
  },
  {
    id: 'support_admin',
    name: 'Support Admin',
    description: 'Customer service, user lookup, ticket escalation, and user inquiry resolution.',
    isSystemRole: true,
    permissions: [
      'view_users', 'view_user_details',
      'view_hosts', 'view_agencies', 'view_live_rooms',
      'view_recharge_plans', 'view_withdrawals',
      'view_support', 'manage_support', 'view_audit_logs',
    ],
  },
];

export default {
  MODULE_PERMISSIONS,
  ALL_CANONICAL_PERMISSIONS,
  DEFAULT_ROLES,
};
