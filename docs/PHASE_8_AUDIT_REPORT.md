# ZeParty Backend — Phase 8 Pre-Implementation Codebase Audit Report

**Document Title**: ZeParty Backend — Phase 8 Pre-Audit: Hosts, Agencies, BD Centers & Resellers  
**Audit Target**: Phase 8 — Creator Hosts, Multi-Tier Agencies, Regional BD Centers & Coin Resellers  
**Repository Location**: `d:\PROJECTS\Ze-Party\backend`  
**Audit Date**: September 3, 2026  
**Auditor**: Antigravity AI (DeepMind Advanced Coding Assistant)  
**Audit Mode**: Strict Read-Only Code-Level Codebase Audit (Zero Code Modification / Zero Schema Alteration)

---

## 1. Executive Summary

```text
┌─────────────────────────────────────────────────────────┐
│ Phase 8 Overall Status: SCAFFOLDED / NOT IMPLEMENTED    │
│ Estimated Completion:   27 / 100                        │
├─────────────────────────────────────────────────────────┤
│ • Database & Prisma Models:     85% (Models declared)   │
│ • RBAC Permissions & Roles:     85% (Canonical IDs set) │
│ • Policy Defaults & Templates:  80% (Phase 7 baseline)  │
│ • Financial Engine Foundation:  25% (Phase 6 ledger ready│
│ • Repositories (DAL):            0% (0 of 5 exist)      │
│ • Services & Business Logic:     0% (0 of 5 exist)      │
│ • Controllers & Endpoints:       0% (0 of 5 exist)      │
│ • Zod Input Validators:          0% (0 of 5 exist)      │
│ • Automated Phase 8 Tests:       0% (0 tests written)   │
└─────────────────────────────────────────────────────────┘
```

A comprehensive, code-level inspection of the ZeParty backend (`backend/src/`, `backend/prisma/`, `backend/docs/`), Admin Frontend (`Admin Frontend/src/`), and Flutter Mobile client (`mobile app/lib/`) was conducted to evaluate the exact readiness of **Phase 8: Hosts, Agencies, BD Centers & Resellers**.

### Key Audit Findings
1. **Schema & Model Foundation Exists**: The 9 core database models (`HostProfile`, `HostApplication`, `HostLevelConfig`, `Agency`, `AgencyMember`, `BDCenter`, `BDInvite`, `CoinSeller`, `Merchant`) are fully declared in `backend/prisma/schema.prisma`.
2. **Canonical RBAC Ready**: All 14 Phase 8 RBAC permissions across the `hosts_agencies`, `resellers_merchants`, and `refunds_risk` modules are defined in `src/constants/permissions.js` and assigned to default roles (`host_admin`, `agency_admin`, `super_admin`).
3. **Application Layer Completely Missing**: Zero repositories, zero domain services, zero controllers, zero routes, zero validators, and zero automated tests exist in `backend/src/` or `backend/tests/` for Phase 8 entities.
4. **Mock Business Logic in Frontend**: Both the React Admin Portal (`Admin Frontend/src/services/modules/`) and Flutter Mobile client (`mobile app/lib/providers/`) currently rely on rich in-memory mock state and dummy stores for host approvals, agency member bindings, BD invitations, 5-tier salary projections, and reseller coin allocations.

---

## 2. Authoritative Specification Baseline

The following architectural specifications govern the Phase 8 implementation:

| Specification Document | Section / Domain | Mandated Contracts for Phase 8 |
| :--- | :--- | :--- |
| [`docs/DATABASE_ARCHITECTURE.md`](file:///d:/PROJECTS/Ze-Party/backend/docs/DATABASE_ARCHITECTURE.md) | Domains D, E, F | Defines schema relations for `HostProfile`, `HostApplication`, `HostLevelConfig`, `Agency`, `AgencyMember`, `BDCenter`, `BDInvite`, `CoinSeller`, and `Merchant`. |
| [`docs/POLICY_ENGINE.md`](file:///d:/PROJECTS/Ze-Party/backend/docs/POLICY_ENGINE.md) | Section 2 | Defines Creator Host 25-level target matrix, Social Audio Creator tiers, BD Center salary tiers, and Coin Reseller packages. |
| [`docs/API_CONTRACT.md`](file:///d:/PROJECTS/Ze-Party/backend/docs/API_CONTRACT.md) | Group 5 | Outlines `/api/v1/hosts`, `/api/v1/agencies`, `/api/v1/bd-centers`, and application review workflows. |
| [`docs/ADMIN_API_MAPPING.md`](file:///d:/PROJECTS/Ze-Party/backend/docs/ADMIN_API_MAPPING.md) | Pages 21–25, 33 | Maps `HostsPage`, `AgenciesPage`, `BDCentersPage`, `CoinSellersPage`, and `MerchantsPage` to backend endpoints and permissions. |
| [`src/constants/policyDefaults.js`](file:///d:/PROJECTS/Ze-Party/backend/src/constants/policyDefaults.js) | Templates & Keys | Authoritative baseline templates for `LIVE_HOST`, `AUDIO_HOST`, `RESELLER`, `MERCHANT`, `MANAGER`, and `RESELLER_TRANSFER_FEE_PERCENT`. |

---

## 3. Database & Schema Audit

### 3.1 Model Inventory in `backend/prisma/schema.prisma`

```prisma
// Domain D & E: Hosts, Agencies & BD Centers
model HostProfile {
  id                       String     @id @default(uuid())
  userId                   String     @unique
  user                     User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  hostType                 HostType   @default(LIVE_HOST)
  hostStatus               HostStatus @default(APPLIED)
  hostLevel                Int        @default(1)
  agencyId                 String?
  agency                   Agency?    @relation(fields: [agencyId], references: [id])
  bdCenterId               String?
  bdCenter                 BDCenter?  @relation(fields: [bdCenterId], references: [id])
  totalLiveHoursMonth      Float      @default(0.0)
  totalDiamondsEarnedMonth BigInt     @default(0)
  targetDaysAchieved       Int        @default(0)
  createdAt                DateTime   @default(now())
  updatedAt                DateTime   @updatedAt

  agencyMemberships AgencyMember[]
  pkEventsAsHostA   PKEvent[]      @relation("PKHostA")
  pkEventsAsHostB   PKEvent[]      @relation("PKHostB")

  @@index([hostStatus])
  @@index([hostType])
}

model HostApplication {
  id              String     @id @default(uuid())
  userId          String
  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  hostType        HostType
  idCardFrontUrl  String
  idCardBackUrl   String
  videoSampleUrl  String?
  status          HostStatus @default(APPLIED)
  reviewerAdminId String?
  rejectionReason String?
  reviewedAt      DateTime?
  createdAt       DateTime   @default(now())

  @@index([userId])
  @@index([status])
}

model HostLevelConfig {
  id                   String   @id @default(uuid())
  level                Int
  hostType             HostType
  targetDiamonds       BigInt
  basicSalaryUSD       Decimal  @db.Decimal(12, 2)
  dailyHoursRequired   Float
  daysRequiredPerMonth Int
  createdAt            DateTime @default(now())

  @@unique([level, hostType])
}

model Agency {
  id             String       @id @default(uuid())
  agencyName     String
  agencyCode     String       @unique
  agencyType     AgencyType   @default(LIVE_AGENCY)
  ownerUserId    String
  owner          User         @relation("AgencyOwner", fields: [ownerUserId], references: [id])
  bdCenterId     String?
  bdCenter       BDCenter?    @relation(fields: [bdCenterId], references: [id])
  commissionRate Float        @default(20.0)
  status         AgencyStatus @default(ACTIVE)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  hosts   HostProfile[]
  members AgencyMember[]

  @@index([status])
}

model AgencyMember {
  id            String       @id @default(uuid())
  agencyId      String
  agency        Agency       @relation(fields: [agencyId], references: [id], onDelete: Cascade)
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  hostProfileId String?
  hostProfile   HostProfile? @relation(fields: [hostProfileId], references: [id])
  joinedAt      DateTime     @default(now())

  @@unique([agencyId, userId])
}

model BDCenter {
  id                      String   @id @default(uuid())
  centerName              String
  regionCode              String   @default("US")
  managerUserId           String
  manager                 User     @relation("BDManager", fields: [managerUserId], references: [id])
  currentTier             BDTier   @default(BRONZE)
  baseSalaryUSD           Decimal  @default(500.00) @db.Decimal(12, 2)
  totalGroupDiamondsMonth BigInt   @default(0)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  agencies Agency[]
  hosts    HostProfile[]
  invites  BDInvite[]
}

model BDInvite {
  id             String         @id @default(uuid())
  bdCenterId     String
  bdCenter       BDCenter       @relation(fields: [bdCenterId], references: [id], onDelete: Cascade)
  targetUserId   String
  targetUser     User           @relation(fields: [targetUserId], references: [id], onDelete: Cascade)
  invitationCode String         @unique
  status         BDInviteStatus @default(PENDING)
  sentAt         DateTime       @default(now())
  acceptedAt     DateTime?
}

// Domain F: Resellers & Merchants
model CoinSeller {
  id                   String           @id @default(uuid())
  userId               String           @unique
  user                 User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  businessName         String
  resellerBalanceCoins BigInt           @default(0)
  profitMarginPercent  Float            @default(10.0)
  creditLimitUSD       Decimal          @default(1000.00) @db.Decimal(12, 2)
  sellerStatus         CoinSellerStatus @default(ACTIVE)
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt

  p2pOrders P2PEscrowOrder[]
}

model Merchant {
  id                String         @id @default(uuid())
  userId            String         @unique
  user              User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  companyName       String
  apiKeyHash        String         @unique
  apiSecretHash     String
  monthlyQuotaCoins BigInt         @default(1000000)
  totalSpentUSD     Decimal        @default(0.00) @db.Decimal(14, 2)
  status            MerchantStatus @default(ACTIVE)
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
}
```

### 3.2 Detailed Model Inspection & Schema Quality Analysis

| Model | Exists | Primary Key | Foreign Keys & Cascade Rules | Constraints & Indexes | Financial Types | Timestamps | Schema Evaluation |
| :--- | :---: | :---: | :--- | :--- | :--- | :---: | :--- |
| **`HostProfile`** | ✅ | `id` (UUID) | `userId` $\rightarrow$ `User` (Cascade), `agencyId` $\rightarrow$ `Agency`, `bdCenterId` $\rightarrow$ `BDCenter` | `@unique([userId])`, `@index([hostStatus])`, `@index([hostType])` | `totalDiamondsEarnedMonth` (BigInt) | `createdAt`, `updatedAt` | Structurally sound. |
| **`HostApplication`** | ✅ | `id` (UUID) | `userId` $\rightarrow$ `User` (Cascade) | `@index([userId])`, `@index([status])` | N/A | `createdAt`, `reviewedAt` | Structurally sound. |
| **`HostLevelConfig`** | ✅ | `id` (UUID) | None | `@unique([level, hostType])` | `targetDiamonds` (BigInt), `basicSalaryUSD` (Decimal 12,2) | `createdAt` | Structurally sound. |
| **`Agency`** | ✅ | `id` (UUID) | `ownerUserId` $\rightarrow$ `User`, `bdCenterId` $\rightarrow$ `BDCenter` | `@unique([agencyCode])`, `@index([status])` | `commissionRate` (Float) | `createdAt`, `updatedAt` | Structurally sound. |
| **`AgencyMember`** | ✅ | `id` (UUID) | `agencyId` $\rightarrow$ `Agency` (Cascade), `userId` $\rightarrow$ `User` (Cascade), `hostProfileId` $\rightarrow$ `HostProfile` | `@unique([agencyId, userId])` | N/A | `joinedAt` | Recommended: `@@index([userId])`. |
| **`BDCenter`** | ✅ | `id` (UUID) | `managerUserId` $\rightarrow$ `User` | None on manager (multiple centers per manager permitted) | `baseSalaryUSD` (Decimal 12,2), `totalGroupDiamondsMonth` (BigInt) | `createdAt`, `updatedAt` | Structurally sound. |
| **`BDInvite`** | ✅ | `id` (UUID) | `bdCenterId` $\rightarrow$ `BDCenter` (Cascade), `targetUserId` $\rightarrow$ `User` (Cascade) | `@unique([invitationCode])` | N/A | `sentAt`, `acceptedAt` | Recommended: `@@index([bdCenterId, status])`. |
| **`CoinSeller`** | ✅ | `id` (UUID) | `userId` $\rightarrow$ `User` (Cascade) | `@unique([userId])` | `resellerBalanceCoins` (BigInt), `creditLimitUSD` (Decimal 12,2) | `createdAt`, `updatedAt` | Structurally sound. |
| **`Merchant`** | ✅ | `id` (UUID) | `userId` $\rightarrow$ `User` (Cascade) | `@unique([userId])`, `@unique([apiKeyHash])` | `monthlyQuotaCoins` (BigInt), `totalSpentUSD` (Decimal 14,2) | `createdAt`, `updatedAt` | Structurally sound. |

---

## 4. Prisma Migration Status

* **Current State**: `schema.prisma` is valid and compiled.
* **Migration Synchronization**: All 9 Phase 8 models are present in `schema.prisma`.
* **Database State**: On fresh database initialization, `prisma migrate` or `prisma db push` generates the corresponding tables cleanly.
* **Non-Destructive Constraint**: No breaking schema modifications are required for Phase 8.

---

## 5. Seed Data Audit (`backend/prisma/seed.js`)

* **Existing Seed Elements**:
  * Roles: `host_admin` (Permissions: `view_hosts`, `review_hosts`, `approve_reject_hosts`, `view_agencies`, `review_agencies`, `approve_reject_agencies`), `agency_admin`.
  * Accounts: `dev-host-001` (`hostadmin`), `dev-restricted-001` (`restrictedadmin`).
  * Phase 7 Policy Templates: `LIVE_HOST` (25 levels matrix), `AUDIO_HOST` (4 tiers), `RESELLER` (4 package tiers), `MERCHANT` portal configurations.
* **Missing Seed Elements**:
  * No default `HostLevelConfig` database rows seeded.
  * No sample `Agency` or `AgencyMember` records seeded.
  * No sample `BDCenter` records seeded.
  * No sample `CoinSeller` or `Merchant` accounts seeded.

---

## 6. Backend Source Code Audit

| Component | Target Location | Existence | Status | Details |
| :--- | :--- | :---: | :---: | :--- |
| **Host Repository** | `src/repositories/host.repository.js` | ❌ `NO` | `MISSING` | No DAL for `HostProfile`, `HostApplication`, `HostLevelConfig`. |
| **Agency Repository** | `src/repositories/agency.repository.js` | ❌ `NO` | `MISSING` | No DAL for `Agency`, `AgencyMember`. |
| **BD Center Repository** | `src/repositories/bdCenter.repository.js` | ❌ `NO` | `MISSING` | No DAL for `BDCenter`, `BDInvite`. |
| **Seller Repository** | `src/repositories/seller.repository.js` | ❌ `NO` | `MISSING` | No DAL for `CoinSeller`. |
| **Merchant Repository** | `src/repositories/merchant.repository.js` | ❌ `NO` | `MISSING` | No DAL for `Merchant`. |
| **Host Service** | `src/services/host.service.js` | ❌ `NO` | `MISSING` | No application logic for applications, review, level progression, or performance tracking. |
| **Agency Service** | `src/services/agency.service.js` | ❌ `NO` | `MISSING` | No application logic for agency creation, host binding/transfers, or commission distribution. |
| **BD Center Service** | `src/services/bdCenter.service.js` | ❌ `NO` | `MISSING` | No application logic for BD tiers, invite generation/acceptance, or salary projection. |
| **Seller Service** | `src/services/seller.service.js` | ❌ `NO` | `MISSING` | No application logic for coin allocation, credit limits, or seller balance ledger posting. |
| **Merchant Service** | `src/services/merchant.service.js` | ❌ `NO` | `MISSING` | No application logic for API key generation/hashing or quota management. |
| **Host Controller** | `src/controllers/host.controller.js` | ❌ `NO` | `MISSING` | No HTTP request handlers for host endpoints. |
| **Agency Controller** | `src/controllers/agency.controller.js` | ❌ `NO` | `MISSING` | No HTTP request handlers for agency endpoints. |
| **BD Center Controller** | `src/controllers/bdCenter.controller.js` | ❌ `NO` | `MISSING` | No HTTP request handlers for BD Center endpoints. |
| **Seller Controller** | `src/controllers/seller.controller.js` | ❌ `NO` | `MISSING` | No HTTP request handlers for coin seller endpoints. |
| **Merchant Controller** | `src/controllers/merchant.controller.js` | ❌ `NO` | `MISSING` | No HTTP request handlers for merchant endpoints. |
| **Phase 8 Routes** | `src/routes/host.routes.js`, etc. | ❌ `NO` | `MISSING` | Zero Phase 8 routes mounted in `src/routes/index.js`. |
| **Phase 8 Validators** | `src/validators/host.validator.js`, etc. | ❌ `NO` | `MISSING` | No Zod schemas for applications, approvals, agency binding, BD invites, or seller quotas. |

---

## 7. API Contract & Endpoint Gap Analysis

### 7.1 Admin API Endpoints Required

| Method | Endpoint | Required Permission | Service / DAL Status | Gap Description |
| :---: | :--- | :---: | :---: | :--- |
| `GET` | `/api/v1/admin/hosts` | `view_hosts` | ❌ `MISSING` | Lists active and applied hosts with search, status, and type filters. |
| `GET` | `/api/v1/admin/hosts/:id` | `view_hosts` | ❌ `MISSING` | Returns host profile, performance stats, and agency history. |
| `GET` | `/api/v1/admin/hosts/applications` | `review_hosts` | ❌ `MISSING` | Returns pending host applications queue. |
| `PUT` | `/api/v1/admin/hosts/applications/:id` | `approve_reject_hosts` | ❌ `MISSING` | Approves or rejects host application; auto-provisions `HostProfile`. |
| `PUT` | `/api/v1/admin/hosts/:id/status` | `approve_reject_hosts` | ❌ `MISSING` | Suspends, activates, or updates host profile status. |
| `GET` | `/api/v1/admin/agencies` | `view_agencies` | ❌ `MISSING` | Lists agencies, member host counts, and performance. |
| `POST` | `/api/v1/admin/agencies` | `approve_reject_agencies` | ❌ `MISSING` | Creates a new agency with code, owner, and commission rate. |
| `GET` | `/api/v1/admin/agencies/:id` | `view_agencies` | ❌ `MISSING` | Returns agency details, member hosts list, and revenue stats. |
| `PUT` | `/api/v1/admin/agencies/:id` | `approve_reject_agencies` | ❌ `MISSING` | Updates agency commission rate, BD association, or status. |
| `POST` | `/api/v1/admin/agencies/:id/transfer-host` | `approve_reject_agencies` | ❌ `MISSING` | Transfers a host from one agency to another with audit history. |
| `GET` | `/api/v1/admin/bd-centers` | `manage_bd_centers` | ❌ `MISSING` | Lists BD Centers, tier progression, agencies count, and volume. |
| `POST` | `/api/v1/admin/bd-centers` | `manage_bd_centers` | ❌ `MISSING` | Creates a new regional BD Center and assigns a manager. |
| `GET` | `/api/v1/admin/bd-centers/:id` | `manage_bd_centers` | ❌ `MISSING` | Returns BD Center details, managed agencies, and salary tier. |
| `PUT` | `/api/v1/admin/bd-centers/:id` | `manage_bd_centers` | ❌ `MISSING` | Updates BD Center region, tier, base salary, or status. |
| `GET` | `/api/v1/admin/sellers` | `view_sellers` | ❌ `MISSING` | Lists authorized coin sellers, balances, margins, and limits. |
| `POST` | `/api/v1/admin/sellers` | `manage_sellers` | ❌ `MISSING` | Onboards a new coin seller account. |
| `PUT` | `/api/v1/admin/sellers/:id/status` | `manage_sellers` | ❌ `MISSING` | Toggles seller status (`ACTIVE` $\leftrightarrow$ `SUSPENDED`). |
| `POST` | `/api/v1/admin/sellers/:id/allocate` | `issue_coins` | ❌ `MISSING` | Allocates bulk coins to reseller balance with ledger debit/credit. |
| `POST` | `/api/v1/admin/sellers/:id/correct` | `reseller_corrections` | ❌ `MISSING` | Corrects seller balance discrepancies (maker-checker guarded). |
| `GET` | `/api/v1/admin/merchants` | `view_merchants` | ❌ `MISSING` | Lists merchant accounts, monthly quotas, and spent volume. |
| `POST` | `/api/v1/admin/merchants` | `manage_merchants` | ❌ `MISSING` | Creates merchant account, generates API credentials. |

### 7.2 Mobile / Public API Endpoints Required

| Method | Endpoint | Auth Required | Service / DAL Status | Gap Description |
| :---: | :--- | :---: | :---: | :--- |
| `POST` | `/api/v1/hosts/apply` | User JWT | ❌ `MISSING` | Mobile user submits host verification application. |
| `GET` | `/api/v1/hosts/profile` | User JWT | ❌ `MISSING` | Returns active host's own profile, level, targets, and diamond stats. |
| `GET` | `/api/v1/agencies/public` | User JWT | ❌ `MISSING` | Public agency directory for hosts seeking representation. |
| `POST` | `/api/v1/agencies/join` | User JWT | ❌ `MISSING` | Host requests to join an agency via agency code. |
| `GET` | `/api/v1/bd-centers/invite/:code`| User JWT | ❌ `MISSING` | Validates BD invitation code for agent/host recruitment. |
| `POST` | `/api/v1/bd-centers/invite/accept`| User JWT | ❌ `MISSING` | Accepts BD invitation code and binds user to BD Center. |
| `GET` | `/api/v1/sellers/public` | Optional | ❌ `MISSING` | Directory of verified P2P coin sellers for users. |

---

## 8. Host Domain Audit

* **Profile Management**: `HostProfile` model is ready. Logic to update live streaming hours (`totalLiveHoursMonth`), diamond counts (`totalDiamondsEarnedMonth`), and target days is missing.
* **Application Lifecycle**: `HostApplication` tracks `APPLIED`, `ACTIVE`, `SUSPENDED`, `REJECTED`. Review flow must atomically update `HostApplication.status = 'ACTIVE'`, create a `HostProfile` record, update `User.userType = 'HOST'`, and emit an audit log.
* **Host Levels Matrix**: 25-level target matrix exists in `policyDefaults.js` (`BASELINE_POLICY_TEMPLATES.LIVE_HOST`). Runtime evaluation logic linking monthly diamond totals to basic salary payout is missing.

---

## 9. Agency Domain Audit

* **Agency Structure**: `Agency` and `AgencyMember` models support multi-host rosters.
* **Commission Handling**: `Agency.commissionRate` defaults to $20.0\%$. In gifting transactions, revenue split logic in `src/utils/split.util.js` allocates $12\%$ to agency commission. A reconciliation layer between agency default commission and platform split is needed.
* **Host Agency Transfers**: When a host transfers between agencies, `AgencyMember` must be updated atomically and historical binding logged.

---

## 10. BD Center Domain Audit

* **BD Center Structure**: `BDCenter` represents regional growth hubs with 5 tiers (`BRONZE`, `SILVER`, `GOLD`, `PLATINUM`, `DIAMOND`) and base salaries from $\$500$ to $\$7,500$ USD.
* **Invitations**: `BDInvite` uses unique alphanumeric invitation codes (`invitationCode`). Acceptance logic to bind target users to managed agencies/hosts under the BD Center is missing.
* **Monthly Group Performance**: Logic aggregating diamonds earned by all agencies and hosts under a BD Center (`totalGroupDiamondsMonth`) is missing.

---

## 11. Reseller & Coin Seller Audit

* **Reseller Structure**: `CoinSeller` model contains `resellerBalanceCoins`, `profitMarginPercent`, `creditLimitUSD`, and `sellerStatus`.
* **Double-Entry Coin Allocation**: When the platform issues/allocates coins to a seller:
  * Platform treasury debits coin stock;
  * `Wallet.sellerBalanceCoins` or `CoinSeller.resellerBalanceCoins` is credited;
  * Must post to `WalletLedger` with `transactionType: 'RESELLER_ALLOCATION'`;
  * If allocated amount $\ge 1,000,000$ coins ($\$100$ USD), two-stage approval (`approval.service.js`) must be triggered.
* **Transfer Fee Policy**: Resolves `policyService.getEffectiveConfig('RESELLER_TRANSFER_FEE_PERCENT')` ($2.5\%$ baseline).

---

## 12. Merchant Domain Audit

* **Scope Classification**: `Merchant` represents B2B enterprise coin purchase and API integration.
* **Phase 8 Scope**: Core Merchant CRUD, status management, and credential generation (`apiKeyHash`, `apiSecretHash`) belong to Phase 8.
* **Future Scope**: External B2B API gateway authentication middleware and third-party webhook dispatch belong to Phase 10 / B2B integration.

---

## 13. Financial Integration Audit

Phase 6 double-entry financial architecture must be preserved:

```text
Financial Mutation (e.g. Reseller Allocation, Host Bonus Payout)
           │
           ▼
[Check Approval Threshold via requiresApproval()]
  ├── Exceeds Threshold ($100 / 1M Coins) ──► Create AdminApproval Request (PENDING)
  └── Within Threshold ────────────────────► Execute Atomic Double-Entry Ledger Posting
                                                │
                                                ▼
                                    [PostgreSQL Row-Lock (findWithLock)]
                                                │
                                                ▼
                                    [ledgerService.postTransaction()]
                                                │
                                                ▼
                                    [Emit AuditLog Entry]
```

* **Financial Type Safety**: All coin and diamond amounts must strictly use `BigInt`. USD amounts must strictly use `Decimal` ($12,2$ or $14,2$).
* **Row-Level Locking**: Any mutation touching seller balances or host diamonds must use `walletRepository.findWithLock(walletId, tx)`.

---

## 14. Policy Engine Integration Audit

Phase 8 domain services must dynamically consume Phase 7 policy configurations:

| Policy Value | Phase 7 Config Key / Policy Type | Fallback Baseline in `policyDefaults.js` |
| :--- | :--- | :--- |
| **Live Host Target Matrix** | `policyService.getEffectivePolicy('LIVE_HOST')` | 25-level target matrix ($120\text{K}$ to $50\text{M}$ diamonds) |
| **Audio Host Tier Matrix** | `policyService.getEffectivePolicy('AUDIO_HOST')` | 4 tiers ($30\text{K}$, $60\text{K}$, $100\text{K}$, $350\text{K}$ coins) |
| **Reseller Transfer Fee** | `policyService.getEffectiveConfig('RESELLER_TRANSFER_FEE_PERCENT')` | $2.5\%$ commission |
| **Host Transfer Fee** | `policyService.getEffectiveConfig('HOST_TRANSFER_FEE_PERCENT')` | $5.0\%$ commission |
| **Reseller Packages** | `policyService.getEffectivePolicy('RESELLER')` | Silver, Gold, Platinum, VIP Master packages |
| **Merchant Policy** | `policyService.getEffectivePolicy('MERCHANT')` | $\$3,000$ portal fee, $20\%$ margin limit |
| **BD Manager Policy** | `policyService.getEffectivePolicy('MANAGER')` | $\$1,000$ baseline, $\$2,000$ cap |

---

## 15. RBAC & Owner Governance Audit

### Canonical Permission Mapping
* `view_hosts`, `review_hosts`, `approve_reject_hosts` $\rightarrow$ Host management.
* `view_agencies`, `review_agencies`, `approve_reject_agencies`, `manage_agency_finance` $\rightarrow$ Agency management.
* `manage_bd_centers` $\rightarrow$ BD Center management.
* `view_sellers`, `manage_sellers`, `issue_coins`, `reseller_corrections` $\rightarrow$ Reseller management.
* `view_merchants`, `manage_merchants` $\rightarrow$ Merchant management.

### Root Owner Invariants
* Root Owner (`isOwner: true`) possesses unconditional master approval and wildcard authority across all Phase 8 endpoints.
* Regular administrators cannot elevate themselves to agency owners or BD managers without appropriate RBAC permissions.

---

## 16. Validation Audit

* **Missing Validators**: `src/validators/` lacks validation schemas for:
  * Host applications (ID card image URLs, video sample URL, valid `hostType`).
  * Host reviews (`status: 'ACTIVE' | 'REJECTED'`, rejection reason string).
  * Agency creation (agency code formatting, owner user ID, commission percentage $0\% - 100\%$).
  * Host agency transfers (source and destination agency IDs, transfer reason).
  * BD Center creation and updates (region code, valid `BDTier`, base salary decimal).
  * BD Invites (valid target user ID, invitation code generation).
  * Coin Seller creation & coin allocations (positive BigInt coin amounts, credit limit decimals).
  * Merchant creation (valid company name, quota BigInt).

---

## 17. Audit Logging

Every state-changing administrative action in Phase 8 must write an `AuditLog` record:

* `HOST_APPLICATION_SUBMITTED`, `HOST_APPLICATION_APPROVED`, `HOST_APPLICATION_REJECTED`
* `HOST_STATUS_UPDATED`, `HOST_LEVEL_UPDATED`
* `AGENCY_CREATED`, `AGENCY_UPDATED`, `AGENCY_MEMBER_BOUND`, `AGENCY_MEMBER_TRANSFERRED`
* `BD_CENTER_CREATED`, `BD_CENTER_UPDATED`, `BD_INVITE_SENT`, `BD_INVITE_ACCEPTED`
* `COIN_SELLER_CREATED`, `COIN_SELLER_STATUS_UPDATED`, `SELLER_COINS_ALLOCATED`, `SELLER_BALANCE_CORRECTED`
* `MERCHANT_CREATED`, `MERCHANT_STATUS_UPDATED`, `MERCHANT_QUOTA_UPDATED`

---

## 18. Concurrency & Security Audit

1. **Duplicate Host Applications**: Must enforce unique constraint or active check preventing multiple pending applications per user.
2. **Duplicate Agency Memberships**: `AgencyMember` has `@@unique([agencyId, userId])`; must also enforce that a host cannot be actively bound to multiple conflicting agencies simultaneously.
3. **Reseller Coin Allocation Race Conditions**: High-volume coin transfers must execute inside `prisma.$transaction` with row-level locks on `Wallet`.
4. **Idempotency**: Coin allocations and balance corrections must enforce `Idempotency-Key` headers via existing `src/middlewares/idempotency.js`.

---

## 19. Tests Audit

* **Current Phase 0–7 Test Suite**: **72/72 tests passing** (`auth_unit.test.js`, `rbac_security.test.js`, `wallet_ledger.test.js`, `approval_workflow.test.js`, `policy_engine.test.js`, `auto_restore.test.js`).
* **Existing Phase 8 Tests**: **0 tests written**.
* **Required Phase 8 Test Coverage**:
  * Host application submission, validation, approval, and rejection.
  * Agency creation, unique code enforcement, and host binding/transfers.
  * BD Center tier assignment, invitation code lifecycle, and salary projection.
  * Coin Seller onboarding, bulk coin allocation ledger posting, and maker-checker approval triggers.
  * RBAC permission enforcement and Root Owner authority.

---

## 20. Frontend Mock vs Backend Gap Analysis

| Domain | Frontend Mock Location | Frontend Capability / Expectation | Backend Implementation State |
| :--- | :--- | :--- | :--- |
| **Hosts** | `Admin Frontend/src/mocks/hosts.mock.js` | 25-level target matrices, audio vs live filters, application approval/rejection modal. | 🟠 Model declared; DAL & API missing. |
| **Agencies** | `Admin Frontend/src/mocks/hosts.mock.js` | Agency code search, member host lists, agency transfer modal with reason. | 🟠 Model declared; DAL & API missing. |
| **BD Centers** | `Admin Frontend/src/mocks/bdCenters.mock.js` | 5 salary tiers (Bronze to Diamond), regional manager cards, invite generators. | 🟠 Model declared; DAL & API missing. |
| **Coin Sellers** | `Admin Frontend/src/mocks/coinSellers.mock.js` | Reseller balances, quota allocation modal, status toggle switch. | 🟠 Model declared; DAL & API missing. |
| **Mobile BD** | `mobile app/lib/providers/bd_center_provider.dart` | Mobile BD invitation sending, agent rosters, salary history cards. | 🟠 Model declared; DAL & API missing. |
| **Mobile Seller**| `mobile app/lib/providers/seller_provider.dart` | P2P direct coin distribution, offline recharge approval queue. | 🟠 Model declared; DAL & API missing. |

---

## 21. Phase 8 Completion Matrix

| Area / Subsystem | Status | Evidence in Codebase | Existing Files | Missing Work |
| :--- | :---: | :--- | :--- | :--- |
| **1. HostProfile Model** | ✅ `COMPLETE` | `schema.prisma:551-574` | `schema.prisma` | None. |
| **2. HostApplication Model** | ✅ `COMPLETE` | `schema.prisma:576-592` | `schema.prisma` | None. |
| **3. HostLevelConfig Model** | ✅ `COMPLETE` | `schema.prisma:594-605` | `schema.prisma` | None. |
| **4. Agency Model** | ✅ `COMPLETE` | `schema.prisma:607-625` | `schema.prisma` | None. |
| **5. AgencyMember Model** | ✅ `COMPLETE` | `schema.prisma:627-638` | `schema.prisma` | Add `@@index([userId])`. |
| **6. BDCenter Model** | ✅ `COMPLETE` | `schema.prisma:640-656` | `schema.prisma` | None. |
| **7. BDInvite Model** | ✅ `COMPLETE` | `schema.prisma:657-667` | `schema.prisma` | Add `@@index([bdCenterId, status])`. |
| **8. CoinSeller Model** | ✅ `COMPLETE` | `schema.prisma:673-686` | `schema.prisma` | None. |
| **9. Merchant Model** | ✅ `COMPLETE` | `schema.prisma:688-700` | `schema.prisma` | None. |
| **10. Seed Data** | 🟡 `PARTIAL` | `prisma/seed.js:215-265` | `seed.js`, `policyDefaults.js` | Seed sample host configs, agencies, BD centers, and sellers. |
| **11. Repositories (DAL)** | ❌ `MISSING` | `src/repositories/` | None | Create `host`, `agency`, `bdCenter`, `seller`, `merchant` repositories. |
| **12. Domain Services** | ❌ `MISSING` | `src/services/` | None | Create `host`, `agency`, `bdCenter`, `seller`, `merchant` services. |
| **13. Controllers** | ❌ `MISSING` | `src/controllers/` | None | Create `host`, `agency`, `bdCenter`, `seller`, `merchant` controllers. |
| **14. Routes & Routers** | ❌ `MISSING` | `src/routes/` | None | Create and mount Phase 8 routes in `src/routes/index.js`. |
| **15. Zod Validators** | ❌ `MISSING` | `src/validators/` | None | Create `host`, `agency`, `bdCenter`, `seller`, `merchant` validators. |
| **16. RBAC Enforcement** | ✅ `COMPLETE` | `src/constants/permissions.js` | `permissions.js`, `requirePermission.js` | Wire canonical permission guards to Phase 8 routes. |
| **17. Owner Governance** | ✅ `COMPLETE` | `src/services/owner.service.js` | `owner.service.js`, `requireOwner.js` | Protect privileged administrative mutations. |
| **18. Financial Integration** | 🟡 `PARTIAL` | `src/services/ledger.service.js` | `ledger.service.js`, `approval.service.js` | Connect reseller coin allocations to double-entry ledger. |
| **19. Policy Integration** | ✅ `COMPLETE` | `src/services/policy.service.js` | `policy.service.js`, `policyDefaults.js` | Consume dynamic policy templates for host levels & reseller rates. |
| **20. Audit Logging** | 🟡 `PARTIAL` | `src/services/policy.service.js` | `AuditLog` model | Hook Phase 8 write actions to audit log table. |
| **21. Concurrency Safety** | 🟡 `PARTIAL` | `src/middlewares/idempotency.js` | `idempotency.js`, `wallet.repository.js` | Enforce idempotency and row locks on coin allocations. |
| **22. Automated Tests** | ❌ `MISSING` | `tests/` | None | Create `tests/host_agency.test.js`, `tests/bd_reseller.test.js`. |
| **23. Documentation** | ✅ `COMPLETE` | `backend/docs/` | `DATABASE_ARCHITECTURE.md`, etc. | Update roadmap and API mappings upon completion. |

---

## 22. Completion Score Breakdown

```text
┌──────────────────────────────────────────────┬───────────────┐
│ Evaluation Dimension (Weight)                │ Score         │
├──────────────────────────────────────────────┼───────────────┤
│ 1. Database Schema & Prisma Models (15%)     │  85 / 100     │
│ 2. Database Seeder Baseline (5%)             │  20 / 100     │
│ 3. Repositories / DAL (10%)                  │   0 / 100     │
│ 4. Domain Services & Business Logic (20%)    │   0 / 100     │
│ 5. Controllers & Request Handlers (10%)      │   0 / 100     │
│ 6. REST API Routes & Router Mounting (10%)   │   0 / 100     │
│ 7. Zod Input Validation (5%)                 │   0 / 100     │
│ 8. RBAC & Owner Governance Foundation (10%)  │  85 / 100     │
│ 9. Financial & Policy Integration (5%)       │  50 / 100     │
│ 10. Audit Logging Integration (3%)           │  25 / 100     │
│ 11. Automated Test Suites (5%)               │   0 / 100     │
│ 12. Technical Documentation (2%)             │  85 / 100     │
├──────────────────────────────────────────────┼───────────────┤
│ OVERALL PHASE 8 READINESS SCORE              │  27 / 100     │
└──────────────────────────────────────────────┴───────────────┘
```

**Scoring Rationale**: The data architecture, canonical RBAC permissions, and Phase 7 policy templates provide a solid **$27\%$** baseline. However, the complete absence of DAL repositories, domain services, controllers, routes, input validators, and automated tests means Phase 8 application logic is currently **$0\%$ implemented**.

---

## 23. Critical Findings

### 🔴 Critical (Must be built in Phase 8)
1. **Zero Phase 8 Repositories & Services**: No backend application code exists to perform CRUD, application review, agency membership binding, BD invitation validation, or reseller coin issuance.
2. **Missing Input Validation**: Without Zod schemas, endpoints could accept malformed ID card URLs, invalid commission percentages ($> 100\%$), negative coin allocations, or duplicate agency codes.
3. **Reseller Coin Allocation Ledger Wiring**: Reseller bulk coin allocations must be wired to `ledger.service.js` with row-level wallet locks and maker-checker approval triggers for amounts $\ge 1,000,000$ coins.

### 🟠 Major (Architecture & integrity gaps)
4. **Missing Index Optimization**: `AgencyMember` needs `@@index([userId])` and `BDInvite` needs `@@index([bdCenterId, status])` for fast relationship lookups.
5. **Host Application Review State Atomicity**: Approving a host application must atomically transition `HostApplication.status = 'ACTIVE'`, create `HostProfile`, and update `User.userType = 'HOST'` within a single PostgreSQL transaction.

### 🟡 Minor (Data & cosmetic gaps)
6. **Missing Sample Seed Records**: `seed.js` needs sample host tiers, agency codes, and BD Center records for development environment testing.

### 🟢 Complete (Verified existing foundations)
7. **Prisma Models & Enums**: `HostProfile`, `Agency`, `BDCenter`, `CoinSeller`, `Merchant`, and all 8 associated enums are valid and ready.
8. **RBAC & Governance**: All 14 canonical permissions and default roles (`host_admin`, `agency_admin`, `super_admin`) are operational.
9. **Policy Engine Integration**: Phase 7 policy templates for `LIVE_HOST`, `AUDIO_HOST`, `RESELLER`, and `MERCHANT` are seeded and resolvable via `policy.service.js`.

---

## 24. Phase 8 Boundary Enforcement

To maintain architectural isolation, the following features belong to later phases and **must NOT be implemented in Phase 8**:
* **Virtual Gift Catalog & SVGA Animations** $\rightarrow$ Phase 9
* **Dynamic Avatar Frames & VIP Store** $\rightarrow$ Phase 9
* **Payment Gateway Webhooks (Stripe / PayPal / Braintree)** $\rightarrow$ Phase 10
* **Agora RTC Streaming Tokens & Socket.IO Rooms** $\rightarrow$ Phase 11
* **Mini-Games (Slots, Rocket, Wheel) & House Edge** $\rightarrow$ Phase 12
* **FCM Push Notifications & User Social Feeds** $\rightarrow$ Phase 13
* **Admin Frontend Axios Integration** $\rightarrow$ Phase 14
* **Flutter Mobile Dio Integration** $\rightarrow$ Phase 15

---

## 25. Recommended Phase 8 Implementation Sequence

When authorized to implement Phase 8, execute in the following dependency-aware order:

```text
Step 1: Schema Minor Index Optimization & Seeder Update
        ├── Add @@index([userId]) to AgencyMember & @@index([bdCenterId, status]) to BDInvite
        └── Seed sample HostLevelConfig, Agency, BDCenter, and CoinSeller records in prisma/seed.js

Step 2: Zod Input Validation Layer
        ├── Create src/validators/host.validator.js (Applications, reviews, profile updates)
        ├── Create src/validators/agency.validator.js (Agency creation, binding, transfers)
        ├── Create src/validators/bdCenter.validator.js (BD Centers, invites, tier updates)
        └── Create src/validators/seller.validator.js (Seller onboarding, coin allocations)

Step 3: Repositories (DAL)
        ├── Create src/repositories/host.repository.js
        ├── Create src/repositories/agency.repository.js
        ├── Create src/repositories/bdCenter.repository.js
        └── Create src/repositories/seller.repository.js

Step 4: Domain Services & Financial Integration
        ├── Create src/services/host.service.js (Application review, target resolution)
        ├── Create src/services/agency.service.js (Agency lifecycle, host binding/transfers)
        ├── Create src/services/bdCenter.service.js (BD management, invite lifecycle, salary stats)
        └── Create src/services/seller.service.js (Coin allocations via ledgerService, maker-checker integration)

Step 5: Controllers & Routes Layer
        ├── Create src/controllers/host.controller.js, agency.controller.js, bdCenter.controller.js, seller.controller.js
        ├── Create src/routes/host.routes.js, agency.routes.js, bdCenter.routes.js, seller.routes.js
        └── Mount all Phase 8 routes in src/routes/index.js

Step 6: Automated Testing & Verification
        ├── Create tests/host_agency.test.js (Host applications, reviews, agency binding/transfers, RBAC)
        ├── Create tests/bd_reseller.test.js (BD invites, seller coin allocations, ledger posting, maker-checker)
        └── Run full test suite regression (all 72+ tests passing)
```
