# ZeParty Database Architecture & Implemented Prisma Schema

## 1. Executive Summary & Overview
This document represents the finalized, production-ready database architecture for the single, shared **ZeParty Backend**. It maps out the exact **PostgreSQL** schema implemented via **Prisma ORM** (`backend/prisma/schema.prisma`) and seeded via `backend/prisma/seed.js`.

The schema provides strict data integrity, referential integrity, double-entry financial accounting (`WalletLedger`), two-stage administrative approvals (`AdminApproval`), full RBAC enforcement (all 73 canonical permissions across 10 modules), and dynamic configuration engines.

---

## 2. Implemented Database Models (63 Models Across 14 Domains)

```text
                                 ┌───────────────────────┐
                                 │         User          │
                                 └───────────┬───────────┘
                                             │
      ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
      │                  │                   │                   │                  │
┌─────▼─────┐     ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐    ┌──────▼──────┐
│  Profile  │     │   Session   │     │   Device    │     │   Wallet    │    │ HostProfile │
└───────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘    └─────────────┘
                                                                 │
                                                          ┌──────▼──────┐
                                                          │WalletLedger │
                                                          └─────────────┘
```

### Complete Model Inventory (63 Models Across 14 Domains):
1. **Identity & Auth (7)**: `User`, `UserProfile`, `UserSession`, `UserDevice`, `OTPVerification`, `LoginAttempt`, `SystemInitCheck`.
2. **Admin & Governance (11)**: `Admin`, `AdminModuleAccess`, `OwnerGrant`, `AdminPermissionOverride`, `Team`, `TeamMember`, `Role`, `Permission`, `RolePermission`, `AdminApproval`, `AuditLog`.
3. **Hosts & Creators (3)**: `HostProfile`, `HostApplication`, `HostLevelConfig`.
4. **Agencies (2)**: `Agency`, `AgencyMember`.
5. **BD Centers (2)**: `BDCenter`, `BDInvite`.
6. **Resellers & Merchants (2)**: `CoinSeller`, `Merchant`.
7. **Wallets & Finance (7)**: `Wallet`, `WalletLedger` (immutable double-entry), `RechargePlan`, `OnlineRecharge`, `OfflineRecharge`, `WithdrawalRequest`, `CoinRefund`.
8. **P2P Escrow (1)**: `P2PEscrowOrder`.
9. **Rooms & Real-Time (3)**: `Room`, `RoomSeat`, `RoomModeration`.
10. **Virtual Gifts (2)**: `Gift`, `GiftTransaction`.
11. **Dynamic Assets (2)**: `Asset`, `UserAsset`.
12. **Mini-Games & PK (5)**: `Game`, `GameConfig`, `GameRound`, `GameTransaction`, `PKEvent`.
13. **Social & Messaging (6)**: `Post`, `Comment`, `Like`, `Follow`, `Message`, `Notification`.
14. **Moderation, Support & Policies (10)**: `SupportTicket`, `Report`, `ModerationAction`, `Restriction`, `BlockedDevice`, `BlockedIP`, `Policy`, `PolicyVersion`, `PolicyConfiguration`, `PaymentProvider`.

---

## 3. Implemented Enums List (33 Enums)
* `UserStatus`, `UserType`, `OTPPurpose`, `HostType`, `HostStatus`, `AgencyType`, `AgencyStatus`, `BDTier`, `BDInviteStatus`, `CoinSellerStatus`, `MerchantStatus`, `WalletLedgerType`, `RechargeStatus`, `OfflineRechargeStatus`, `WithdrawalStatus`, `CoinRefundStatus`, `EscrowStatus`, `RoomType`, `RoomCategory`, `RoomStatus`, `GiftCategory`, `AssetType`, `AssetSubcategory`, `RoomAvailability`, `GameKey`, `GameRoundStatus`, `PKStatus`, `ReportStatus`, `SupportTicketStatus`, `AdminStatus`, `AdminApprovalStatus`, `ModerationActionType`, `RestrictionType`.

---

## 4. Seeding Strategy (`backend/prisma/seed.js`)
The seed script is **100% idempotent** and seeds:
1. **73 Canonical RBAC Permissions** across 10 modules from `src/constants/permissions.js`.
2. **7 Default Admin Roles**: `super_admin`, `finance_admin`, `host_admin`, `agency_admin`, `moderator`, `content_admin`, `support_admin`.
3. **RolePermission Mappings** connecting each role to its exact permission set.
4. **Default Admin Accounts**: Super Admin, Owner, Finance Admin, Host Admin, and Restricted Admin accounts.
