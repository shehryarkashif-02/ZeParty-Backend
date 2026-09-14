# ZeParty Admin Frontend — Page-to-API Mapping Blueprint

## 1. Overview
This blueprint maps every page in the React Admin Dashboard (`Admin Frontend/src/pages/admin/`) to its exact backend REST API endpoint, required HTTP method, RBAC permission ID, database model dependency, two-stage approval requirement, and audit log emission rules.

---

## 2. Admin Page Mapping Inventory (59 Pages)

| Admin Page Component | Route Path | Required Permission ID | Backend Endpoint | HTTP Method | Database Entities | Approval Required? | Audit Log? | Financial Impact? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `Dashboard.jsx` | `/admin` | *None (Authenticated Admin)* | `/api/admin/dashboard/stats` | GET | `User`, `Room`, `Transaction`, `OfflineRecharge` | No | No | No |
| `UsersPage.jsx` | `/admin/users` | `view_users` | `/api/users` | GET / PUT | `User`, `UserProfile`, `UserDevice` | No (Status) | Yes | Indirect |
| `UserDetailPage.jsx` | `/admin/users/:id` | `view_user_details` | `/api/users/:id` | GET / PUT / POST | `User`, `Wallet`, `WalletLedger`, `UserSession` | Yes (> $100) | Yes | Direct |
| `WalletPage.jsx` | `/admin/wallet` | `view_ledger` | `/api/wallet/ledger` | GET | `Wallet`, `WalletLedger`, `Transaction` | No | No | Indirect |
| `LiveRoomsPage.jsx` | `/admin/live-rooms` | `view_live_rooms` | `/api/rooms` | GET / DELETE | `Room`, `RoomSeat`, `User` | No | Yes | No |
| `LiveRoomDetailPage.jsx` | `/admin/live-rooms/:id` | `view_room_details` | `/api/rooms/:id` | GET / DELETE | `Room`, `RoomSeat`, `GiftTransaction` | No | Yes (DP delete) | No |
| `RoomPinManagementPage.jsx` | `/admin/room-pin-management` | `view_live_rooms` | `/api/rooms/pinned` | GET / PUT | `Room` | No | Yes | Indirect |
| `GiftsPage.jsx` | `/admin/gifts` | `view_gifts` | `/api/gifts` | GET / POST / PUT / DELETE | `Gift`, `GiftCategory` | No | Yes | Direct |
| `EmojiManagementPage.jsx` | `/admin/emojis` | `view_gifts` | `/api/emojis` | GET / POST / DELETE | `Asset` | No | Yes | No |
| `HostsPage.jsx` | `/admin/hosts` | `view_hosts` | `/api/hosts` | GET / PUT | `HostProfile`, `HostApplication`, `HostLevelConfig` | Yes (Tier edits) | Yes | Direct |
| `AgenciesPage.jsx` | `/admin/agencies` | `view_agencies` | `/api/agencies` | GET / POST / PUT | `Agency`, `AgencyMember`, `HostProfile` | Yes | Yes | Direct |
| `BDCentersPage.jsx` | `/admin/bd-centers` | `manage_bd_centers` | `/api/bd-centers` | GET / POST / PUT | `BDCenter`, `BDInvite`, `Agency` | Yes | Yes | Direct |
| `CoinSellersPage.jsx` | `/admin/coin-sellers` | `view_sellers` | `/api/sellers` | GET / POST / PUT | `CoinSeller`, `P2PEscrowOrder` | Yes (Credit limit) | Yes | Direct |
| `MerchantsPage.jsx` | `/admin/merchants` | `view_merchants` | `/api/merchants` | GET / POST / PUT | `Merchant` | Yes | Yes | Direct |
| `RechargePlansPage.jsx` | `/admin/recharge-plans` | `view_recharge_plans` | `/api/recharge/plans` | GET / POST / PUT / DELETE | `RechargePlan` | No | Yes | Direct |
| `OnlineRechargePage.jsx` | `/admin/recharge-online` | `view_recharge_plans` | `/api/recharge/online` | GET | `OnlineRecharge`, `User` | No | No | Indirect |
| `OfflineRechargePage.jsx` | `/admin/offline-recharge` | `view_offline_recharge` | `/api/recharge/offline/:id` | GET / PUT | `OfflineRecharge`, `Wallet`, `WalletLedger` | No | Yes | Direct (+) |
| `WithdrawalsPage.jsx` | `/admin/withdrawals` | `view_withdrawals` | `/api/withdrawals/:id` | GET / PUT | `WithdrawalRequest`, `Wallet`, `WalletLedger` | No | Yes | Direct (-) |
| `TransactionLedgerPage.jsx` | `/admin/transactions` | `view_ledger` | `/api/transactions` | GET | `WalletLedger`, `User` | No | No | Indirect |
| `FinancePage.jsx` | `/admin/finance` | `view_finance` | `/api/finance/summary` | GET | `WalletLedger`, `OnlineRecharge`, `WithdrawalRequest` | No | No | Indirect |
| `CoinRefundCenterPage.jsx` | `/admin/coin-refunds` | `view_refunds` | `/api/refunds/coins` | GET / POST | `CoinRefund`, `Wallet`, `WalletLedger` | Yes | Yes | Direct |
| `ResellerCorrectionsPage.jsx` | `/admin/reseller-corrections` | `reseller_corrections` | `/api/sellers/corrections` | GET / POST | `CoinSeller`, `WalletLedger` | Yes | Yes | Direct |
| `RefundRequestsPage.jsx` | `/admin/refund-requests` | `view_refunds` | `/api/refunds/fiat` | GET / PUT | `CoinRefund`, `OnlineRecharge` | Yes | Yes | Direct |
| `ChargebacksPage.jsx` | `/admin/chargebacks` | `view_chargebacks` | `/api/chargebacks` | GET / POST | `User`, `Wallet`, `UserDevice` | No | Yes | Direct |
| `FraudRiskPage.jsx` | `/admin/risk` | `view_fraud_risk` | `/api/risk/flags` | GET / POST | `UserDevice`, `UserSession` | No | Yes | No |
| `RestrictionsPage.jsx` | `/admin/restrictions` | `manage_restrictions` | `/api/restrictions` | GET / POST / DELETE | `RoomModeration`, `UserDevice` | No | Yes | No |
| `AssetsPage.jsx` | `/admin/assets` | `view_store` | `/api/assets` | GET / POST / PUT / DELETE | `Asset`, `UserAsset` | No | Yes | Direct |
| `VIPStorePage.jsx` | `/admin/vip-store` | `view_vip_store` | `/api/store/vip` | GET / PUT | `Asset` | No | Yes | Direct |
| `VirtualItemsPage.jsx` | `/admin/items` | `view_store` | `/api/store/items` | GET / POST / PUT | `Asset` | No | Yes | Direct |
| `StorePage.jsx` | `/admin/store` | `view_store` | `/api/store/catalog` | GET / POST / PUT | `Asset` | No | Yes | Direct |
| `GamesPage.jsx` | `/admin/games` | `view_games` | `/api/games/config` | GET / PUT | `Game`, `GameConfig` | **Yes (RTP/Payout)** | Yes | Direct |
| `EconomySettingsPage.jsx` | `/admin/economy` | `economy_settings` | `/api/economy/policy` | GET / PUT | `Policy`, `PolicyVersion` | **Yes (Split ratio)**| Yes | Direct |
| `PKEventsPage.jsx` | `/admin/pk-events` | `view_pk_events` | `/api/pk/events` | GET / POST / PUT | `PKEvent`, `Room` | No | Yes | Indirect |
| `RankingsPage.jsx` | `/admin/rankings` | `view_users` | `/api/rankings` | GET / POST | `HostProfile`, `User` | No | Yes | Indirect |
| `LeaderboardsPage.jsx` | `/admin/leaderboards` | `view_users` | `/api/leaderboards` | GET / POST | `User`, `HostProfile` | No | Yes | Direct |
| `ReferralsPage.jsx` | `/admin/referrals` | `view_users` | `/api/referrals` | GET | `User` | No | Yes | Indirect |
| `BannersPage.jsx` | `/admin/banners` | `view_banners` | `/api/banners` | GET / POST / DELETE | `Asset` | No | Yes | No |
| `AnnouncementsPage.jsx` | `/admin/announcements` | `view_announcements` | `/api/announcements` | GET / POST / DELETE | `Notification` | No | Yes | No |
| `RoomThemeApprovalPage.jsx` | `/admin/room-theme-approval` | `view_live_rooms` | `/api/rooms/themes/pending` | GET / PUT | `Asset`, `Room` | No | Yes | No |
| `NotificationsPage.jsx` | `/admin/notifications` | `view_notifications` | `/api/notifications/push` | GET / POST | `Notification`, `NotificationTemplate` | No | Yes | No |
| `ModerationPage.jsx` | `/admin/moderation` | `view_moderation` | `/api/moderation/cases` | GET / PUT | `Report`, `RoomModeration` | No | Yes | No |
| `ChatModerationPage.jsx` | `/admin/chat` | `view_chat` | `/api/moderation/keywords` | GET / POST / DELETE | `RoomModeration` | No | Yes | No |
| `ReportsPage.jsx` | `/admin/reports` | `view_reports` | `/api/reports` | GET / PUT | `Report`, `User` | No | Yes | No |
| `SupportPage.jsx` | `/admin/support` | `view_support` | `/api/support/tickets` | GET / POST / PUT | `SupportTicket` | No | Yes | No |
| `ApprovalsPage.jsx` | `/admin/approvals` | `view_admins` | `/api/admin/approvals` | GET / PUT | `AdminApproval`, `AuditLog` | No | Yes | Direct |
| `TeamsRolesPage.jsx` | `/admin/teams-roles` | `view_admins` | `/api/admin/roles` | GET / POST / PUT | `Admin`, `Role`, `Permission` | Yes (Role permissions) | Yes | Indirect |
| `AuditLogsPage.jsx` | `/admin/audit-logs` | `view_audit_logs` | `/api/admin/audit-logs` | GET | `AuditLog`, `Admin` | No | No | No |
| `SettingsPage.jsx` | `/admin/settings` | `view_settings` | `/api/system/settings` | GET / PUT | `PolicyConfiguration` | Yes | Yes | Indirect |
| `LocalizationPage.jsx` | `/admin/localization` | `view_settings` | `/api/system/localization` | GET / PUT | `PolicyConfiguration` | No | Yes | No |
| `PaymentProvidersPage.jsx` | `/admin/payment-providers` | `view_settings` | `/api/system/payment-providers`| GET / PUT | `PaymentProvider` | Yes | Yes | Direct |
| `ApiLogsPage.jsx` | `/admin/api-logs` | `view_system_health` | `/api/system/api-logs` | GET / POST | `AuditLog` | No | No | No |
| `SystemHealthPage.jsx` | `/admin/system-health` | `view_system_health` | `/api/health` | GET | `Admin` | No | No | No |
| `AppConfigPage.jsx` | `/admin/app-config` | `view_settings` | `/api/system/config` | GET / PUT | `PolicyConfiguration` | No | Yes | No |
| `BackupsPage.jsx` | `/admin/backups` | `view_settings` | `/api/system/backups` | GET / POST | `AuditLog` | No | Yes | No |
| `PrivacyCompliancePage.jsx` | `/admin/privacy` | `view_settings` | `/api/privacy/export` | GET / POST | `User` | No | Yes | No |
| `PolicyVersioningPage.jsx` | `/admin/policy-versioning` | `view_settings` | `/api/policies/versions` | GET / POST | `PolicyVersion` | Yes | Yes | Indirect |
| `ScheduledJobsPage.jsx` | `/admin/jobs` | `view_settings` | `/api/system/jobs` | GET / POST | `AuditLog` | No | Yes | Indirect |
| `ProfilePage.jsx` | `/admin/profile` | *None* | `/api/admin/profile` | GET / PUT | `Admin` | No | Yes | No |
| `ComingSoon.jsx` | — | *None* | N/A | — | — | No | No | No |
