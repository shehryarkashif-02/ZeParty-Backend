# ZeParty Backend — Phase 10 Pre-Implementation Codebase Audit

**Audit Date:** September 3, 2026  
**Audited Target:** Phase 10 — Online & Offline Recharge / Coin Purchase Ecosystem  
**Repository:** `d:\PROJECTS\Ze-Party\backend`  
**Current Branch:** `main`  
**Audit Type:** Strict, Read-Only Codebase & Specification Audit  
**Status:** **PARTIALLY IMPLEMENTED / SCAFFOLDED (Readiness: 40.0 / 100)**

---

## 1. Executive Summary

```text
┌──────────────────────────────────────────────────────────────────┐
│ Phase 10 Overall Status: PARTIALLY IMPLEMENTED / SCAFFOLDED      │
│ Overall Readiness: 40.0 / 100                                    │
│ Database Readiness: 65 / 100 (Core models exist, fields missing) │
│ Backend Core Financial Foundation: 95 / 100 (Phase 6 Ledger)     │
│ Admin APIs Readiness: 50 / 100 (Recharge & Offline scaffolded)   │
│ Mobile / User APIs Readiness: 10 / 100 (Missing endpoints)       │
│ Payment Provider Gateway Engine: 15 / 100 (No provider model)   │
│ Automated Test Coverage for Phase 10: 0 / 100 (0 tests)          │
│ Baseline Regression Tests: 117 / 117 PASSING (0 Failures)        │
└──────────────────────────────────────────────────────────────────┘
```

The ZeParty backend possesses an exceptional financial, double-entry ledger, and approval foundation completed in Phases 4 through 9. For Phase 10 (Online & Offline Recharge / Coin Purchase Ecosystem), the database already defines core entities (`RechargePlan`, `OnlineRecharge`, `OfflineRecharge`, `WithdrawalRequest`, `CoinRefund`, `Wallet`, `WalletLedger`, `AdminApproval`), and an initial scaffold of admin recharge plan management and offline recharge approval exists in [`src/services/recharge.service.js`](file:///d:/PROJECTS/Ze-Party/backend/src/services/recharge.service.js).

However, Phase 10 is currently **incomplete for production**:
1. **No User-Facing Recharge Endpoints**: Mobile users cannot fetch active recharge packages, submit offline payment proof with bank receipts, or initiate online payment checkouts.
2. **Missing Payment Provider Infrastructure**: There is no `PaymentProvider` model in `schema.prisma` to configure gateways (Stripe, PayPal, Binance Pay, EasyPaisa, JazzCash), manage processing fees, mask API secrets, or route webhook callbacks.
3. **Missing Webhook & Verification Pipelines**: No callback/webhook handlers exist for online recharge gateways to verify digital signatures, enforce idempotency, and execute atomic double-entry coin credits.
4. **Prisma Schema Gaps**: Key fields are missing across `RechargePlan` (`name`, `targetCountry`, `isFeatured`, `displayOrder`), `OnlineRecharge` (`planId`, `bonusCoins`, `completedAt`, `paymentMetadata`, `failureReason`), and `OfflineRecharge` (`coinsRequested`, `coinsCredited`, `paymentMethod`, `rejectionReason`, `approvalId`).
5. **No Dedicated Test Suites**: There are zero automated unit or integration tests for online gateway flows, webhook processing, offline deposit submissions, and payment failure edge cases.

---

## 2. Current Repository State

* **Repository Path**: `d:\PROJECTS\Ze-Party\backend`
* **Node Environment**: Node.js v20+ ES Modules (`"type": "module"`)
* **Core Frameworks**: Express.js 4.21.2, Prisma ORM 6.0.0, PostgreSQL, Redis (ioredis), Pino Logger, Zod 3.24.1.
* **Database Models**: 38 models defined in `prisma/schema.prisma`.
* **RBAC Engine**: 73 canonical permissions across 10 modules, 7 default system roles, dynamic overrides, and Root Owner invisibility.
* **Automated Test Suite**: 117 automated tests passing across 12 test suites (0 failures).

---

## 3. Completed Phase Verification (Phases 0–9)

| Phase | Subsystem | Verified State |
| :--- | :--- | :--- |
| **Phase 0** | Codebase Audit & Repository Structure | ✅ **VERIFIED** |
| **Phase 1** | System Architecture & Foundation | ✅ **VERIFIED** |
| **Phase 2** | Prisma Database Architecture (38 Models) | ✅ **VERIFIED** |
| **Phase 3** | Authentication Architecture | ✅ **VERIFIED** |
| **Phase 4** | Auth Implementation (OTP, JWT, Sessions) | ✅ **VERIFIED (18 Tests Passing)** |
| **Phase 5** | RBAC, Permissions (73) & Owner Governance | ✅ **VERIFIED (20 Tests Passing)** |
| **Phase 6** | Wallet, Double-Entry Ledger & Approvals | ✅ **VERIFIED (19 Tests Passing)** |
| **Phase 7** | Dynamic Policy Engine & 15-Day Auto-Restore | ✅ **VERIFIED (15 Tests Passing)** |
| **Phase 8** | Hosts, Agencies, BD Centers & Resellers | ✅ **VERIFIED (23 Tests Passing)** |
| **Phase 9** | Dynamic Assets, Virtual Gifts & Store Catalog | ✅ **VERIFIED (22 Tests Passing)** |

---

## 4. Phase 10 Scope & Boundaries

Phase 10 encompasses the complete fiat-to-coin onboarding ecosystem:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 10 IN-SCOPE DOMAINS                         │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ 1. Recharge Plan Catalog      │ Package management, pricing, bonus coins,   │
│                               │ country-specific targeting, active toggling │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 2. Online Recharge Pipeline   │ Payment intent creation, gateway selection, │
│                               │ webhook/callback ingestion, signature auth, │
│                               │ atomic coin crediting via LedgerService     │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 3. Offline Recharge Engine    │ User deposit submission, receipt upload,    │
│                               │ admin verification, approval/rejection,     │
│                               │ two-stage maker-checker (> $100 threshold)  │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 4. Payment Provider Gateway   │ Gateway registry (Stripe, PayPal, Crypto),  │
│    Configuration              │ credential masking, fee calculation, limits │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 5. Double-Entry Accounting    │ Immutable ledger posting (RECHARGE), BigInt │
│                               │ precision, row locking (SELECT FOR UPDATE)  │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 6. User Transaction History   │ Personal deposit & recharge audit trail     │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

---

## 5. Database Schema Audit

### 5.1 Existing Models in `prisma/schema.prisma`

#### Model 1: `RechargePlan`
```prisma
model RechargePlan {
  id         String   @id @default(uuid())
  coinAmount BigInt
  priceUSD   Decimal  @db.Decimal(10, 2)
  bonusCoins BigInt   @default(0)
  badgeText  String?
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
}
```
* **Audit Assessment**: Needs `name` (String), `targetCountry` (String @default("GLOBAL")), `isFeatured` (Boolean @default(false)), `displayOrder` (Int @default(0)), and `updatedAt` (DateTime @updatedAt).

#### Model 2: `OnlineRecharge`
```prisma
model OnlineRecharge {
  id            String         @id @default(uuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  gateway       String // "STRIPE", "BRAINTREE", "PAYPAL"
  gatewayTxId   String         @unique
  amountUSD     Decimal        @db.Decimal(10, 2)
  coinsCredited BigInt
  status        RechargeStatus @default(PENDING)
  createdAt     DateTime       @default(now())

  @@index([userId])
}
```
* **Audit Assessment**: Needs `planId` (String?), `currency` (String @default("USD")), `bonusCoins` (BigInt @default(0)), `completedAt` (DateTime?), `idempotencyKey` (String?), `paymentMetadata` (Json?), `failureReason` (String?), and index on `[status]`.

#### Model 3: `OfflineRecharge`
```prisma
model OfflineRecharge {
  id              String                @id @default(uuid())
  userId          String
  user            User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  amountUSD       Decimal               @db.Decimal(10, 2)
  bankName        String
  receiptPhotoUrl String
  transactionRef  String                @unique
  status          OfflineRechargeStatus @default(PENDING)
  reviewerAdminId String?
  reviewedAt      DateTime?
  createdAt       DateTime              @default(now())

  @@index([userId])
  @@index([status])
}
```
* **Audit Assessment**: Needs `coinsRequested` (BigInt @default(0)), `coinsCredited` (BigInt @default(0)), `planId` (String?), `paymentMethod` (String @default("BANK_TRANSFER")), `rejectionReason` (String?), and `approvalId` (String?).

### 5.2 Missing Models

#### Missing Model: `PaymentProvider`
A dedicated table is required to support dynamic admin gateway management (`/admin/payment-providers`):
```prisma
model PaymentProvider {
  id                    String   @id @default(uuid())
  name                  String   // e.g. "Stripe Payments"
  code                  String   @unique // e.g. "STRIPE", "PAYPAL", "BINANCE_PAY", "EASYPAISA", "JAZZCASH"
  processingFeePercent  Decimal  @default(0.00) @db.Decimal(5, 2)
  fixedFeeUSD           Decimal  @default(0.00) @db.Decimal(10, 2)
  minLimitUSD           Decimal  @default(1.00) @db.Decimal(10, 2)
  maxLimitUSD           Decimal  @default(5000.00) @db.Decimal(10, 2)
  apiKeyEncrypted       String?
  secretKeyEncrypted    String?
  webhookSecretEncrypted String?
  supportedCountries    String[] @default(["GLOBAL"])
  isActive              Boolean  @default(true)
  displayOrder          Int      @default(0)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([isActive])
}
```

---

## 6. Financial Foundation & Double-Entry Ledger Integration

Phase 10 directly integrates with the robust financial foundation from Phase 6:

```text
Payment Ingested (Online Webhook / Offline Approved)
           │
           ▼
[Row-Level Lock: walletRepository.findWithLock(wallet.id, tx)]
           │
           ▼
[LedgerService.postTransaction]
  ├── Operations:
  │     walletId: userWallet.id
  │     coinDelta: plan.coinAmount + plan.bonusCoins
  │     usdDelta: plan.priceUSD
  │     rechargedDeltaUSD: plan.priceUSD
  ├── TransactionType: RECHARGE
  └── ReferenceId: gatewayTxId or transactionRef
           │
           ▼
[Wallet Balance Mutated: coinBalance += coinsCredited, totalRechargedUSD += amountUSD]
           │
           ▼
[WalletLedger Record Persisted with Immutable balanceBefore & balanceAfter JSON]
```

* **Zero Floating-Point Financials**: Coin amounts and bonuses use `BigInt`. USD values use `Decimal(10, 2)`.
* **Idempotency Guard**: Both online callbacks and offline reviews use `Idempotency-Key` or unique transaction references to prevent double-crediting.
* **Non-destructive Audit Trail**: Failed payments or rejected deposits never delete or edit ledger entries.

---

## 7. Online Recharge Subsystem Audit

### 7.1 Existing State
* Scaffolded model `OnlineRecharge` in `schema.prisma`.
* No services, controllers, or route endpoints exist for online checkout or payment callbacks.

### 7.2 Implementation Requirements for Phase 10
1. **Create Payment Intent (`POST /api/v1/recharge/online/create-intent`)**:
   * Validates `planId` and `gatewayCode`.
   * Server derives coin amount, bonus coins, and USD price.
   * Generates a unique `gatewayTxId` / order reference.
   * Creates an `OnlineRecharge` record in `PENDING` state.
   * Returns client checkout tokens or payment redirect URLs.
2. **Gateway Webhook / Callback (`POST /api/v1/recharge/online/callback/:gateway`)**:
   * Validates gateway cryptographic signature (HMAC-SHA256).
   * Locates `OnlineRecharge` record by `gatewayTxId`.
   * If already `SUCCESS`, returns idempotent 200 OK without double crediting.
   * Executes atomic Prisma transaction locking user wallet, posting ledger credit (`RECHARGE`), and updating status to `SUCCESS`.
   * If payment failed, marks status `FAILED` with `failureReason`.
3. **Admin Online Recharge Monitoring (`GET /api/v1/admin/recharge/online`)**:
   * Paginated listing of online recharge transactions with filter by status, gateway, user ID, and date range.

---

## 8. Offline Recharge Subsystem Audit

### 8.1 Existing State
* `recharge.service.js` contains `getOfflineRecharges`, `approveOfflineRecharge`, and `rejectOfflineRecharge`.
* `finance.controller.js` and `finance.routes.js` expose admin endpoints:
  * `GET /api/v1/admin/recharge/offline`
  * `POST /api/v1/admin/recharge/offline/:id/approve`
  * `POST /api/v1/admin/recharge/offline/:id/reject`

### 8.2 Gaps & Missing Logic
1. **Missing User Submission API (`POST /api/v1/recharge/offline`)**:
   * Users cannot currently submit offline recharge requests with `amountUSD`, `bankName`, `receiptPhotoUrl`, and `transactionRef`.
2. **Missing Calculation of Coins**:
   * Current `approveOfflineRecharge` calculates coins on the fly using `COINS_PER_USD` rather than storing the requested coins snapshot or linked `RechargePlan`.
3. **Approval Threshold & Maker-Checker Integration**:
   * When an offline recharge exceeds the `$100 USD` financial threshold, it must check if the admin has approval authority or route through `AdminApproval`.
4. **Self-Approval Prohibition**:
   * Prevent admins from approving their own offline deposits.

---

## 9. Recharge Package Catalog Audit

### 9.1 Existing State
* `RechargePlan` model exists in `schema.prisma`.
* Admin CRUD exists in `recharge.service.js`, `finance.controller.js`, and `finance.routes.js`:
  * `GET /api/v1/admin/recharge/plans` (`view_recharge_plans`)
  * `POST /api/v1/admin/recharge/plans` (`manage_recharge_plans`)
  * `PATCH /api/v1/admin/recharge/plans/:id` (`manage_recharge_plans`)

### 9.2 Gaps
* **Missing Public/Mobile Endpoint**: Mobile apps need a public/authenticated `GET /api/v1/recharge/plans` endpoint returning active packages sorted by display order.
* **Missing Soft Delete / Toggle**: Need `DELETE /api/v1/admin/recharge/plans/:id` to deactivate plans.
* **Country Filtering**: Target country filtering (`targetCountry: 'GLOBAL' | 'US' | 'PK' | ...`) for local currency pricing.

---

## 10. Payment Provider Configuration Audit

### 10.1 Existing State
* Frontend mock page exists in `Admin Frontend/src/pages/admin/PaymentProvidersPage.jsx`.
* No backend model, repository, service, controller, or route exists.

### 10.2 Implementation Requirements for Phase 10
* Create `PaymentProvider` model in `schema.prisma`.
* Create `src/repositories/paymentProvider.repository.js`.
* Create `src/services/paymentProvider.service.js` with credential encryption/masking.
* Expose endpoints:
  * `GET /api/v1/admin/payment-providers` (`view_settings`)
  * `PUT /api/v1/admin/payment-providers/:id` (`edit_settings`)
  * `GET /api/v1/recharge/providers` (Public/Mobile active gateways list)

---

## 11. Merchant & Reseller Financial Economics Audit

In Phase 8, `CoinSeller` (Reseller) and `Merchant` entities were implemented.
* Resellers receive coins via administrative `reseller-corrections` or direct balance allocations (`RESELLER_ALLOCATION`).
* For Phase 10:
  * Resellers and Merchants can purchase coins via standard recharge packages or custom merchant quotas.
  * Coin balances credited to resellers populate `sellerBalanceCoins` or `coinBalance` depending on whether they are acting as end-users or bulk distributors.
  * All ledger entries remain isolated and fully auditable.

---

## 12. Dynamic Policy Engine Integration

Phase 10 integrates with Phase 7 [`policyService`](file:///d:/PROJECTS/Ze-Party/backend/src/services/policy.service.js):
* `USD_TO_COIN_RATE`: Dynamically resolves base coin exchange rate (default: `10000` coins per `1.00 USD`).
* `RECHARGE_LIMITS`: Resolves minimum deposit ($0.99) and maximum single deposit ($5,000.00).
* `APPROVAL_THRESHOLDS`: Resolves the USD threshold ($100.00) above which manual adjustments and offline deposits require Maker-Checker approvals.

---

## 13. RBAC & Root Owner Governance

Phase 10 permissions already defined in [`src/constants/permissions.js`](file:///d:/PROJECTS/Ze-Party/backend/src/constants/permissions.js):
* `view_recharge_plans`: Browse admin recharge plans.
* `manage_recharge_plans`: Create, edit, toggle recharge plans.
* `view_offline_recharge`: List pending and historical offline deposit requests.
* `approve_offline_recharge`: Review, approve, and credit offline bank deposits.
* `view_finance`: Access platform financial summary statistics.
* `view_ledger`: Inspect master transaction ledger.
* `view_settings` / `edit_settings`: Administer payment provider gateways.
* **Root Owner Rule**: Root Owner (`isOwner = true`) possesses universal wildcard authority and can override approval constraints if necessary.

---

## 14. Audit Logging Conventions

All state mutations in Phase 10 must emit `AuditLog` records with before/after state snapshots:
* `RECHARGE_PLAN_CREATED`
* `RECHARGE_PLAN_UPDATED`
* `RECHARGE_PLAN_DEACTIVATED`
* `OFFLINE_RECHARGE_SUBMITTED`
* `OFFLINE_RECHARGE_APPROVED`
* `OFFLINE_RECHARGE_REJECTED`
* `ONLINE_RECHARGE_INITIATED`
* `ONLINE_RECHARGE_COMPLETED`
* `ONLINE_RECHARGE_FAILED`
* `PAYMENT_PROVIDER_UPDATED`

---

## 15. Security & IDOR Defense

1. **Server-Side Financial Derivation**: Clients never submit coin amounts or exchange rates. The server queries the authoritative `RechargePlan` or dynamic policy engine.
2. **Strict IDOR Protection**: Users can only query their own recharge records (`where: { userId: req.auth.userId }`).
3. **Webhook Cryptographic Signatures**: Online payment callbacks verify cryptographic HMAC signatures before processing.
4. **Credential Masking**: Admin responses for payment providers must never return raw API secret keys (masked as `••••••••1102`).
5. **Maker-Checker Enforcement**: An admin cannot approve their own offline recharge deposit.

---

## 16. Concurrency & Idempotency Audit

* **Row Locking**: User wallet rows must be locked using PostgreSQL `SELECT FOR UPDATE` (`walletRepository.findWithLock`) inside transactions before crediting balances.
* **Idempotency Keys**: Online callbacks and user recharge submissions must pass through `idempotency` middleware using `Idempotency-Key` headers or database unique constraints (`gatewayTxId`, `transactionRef`).
* **Double-Credit Prevention**: An offline recharge request can only transition from `PENDING` $\rightarrow$ `APPROVED` once. Repeated approval attempts throw `ALREADY_PROCESSED` (400).

---

## 17. REST API Contract Inventory for Phase 10

| Method | Endpoint | Actor | Permission / Auth | Description | Status |
| :---: | :--- | :---: | :---: | :--- | :---: |
| `GET` | `/api/v1/admin/recharge/plans` | Admin | `view_recharge_plans` | List all recharge plans (active & inactive) | ⚠️ Partial |
| `POST` | `/api/v1/admin/recharge/plans` | Admin | `manage_recharge_plans` | Create a new recharge plan | ⚠️ Partial |
| `PUT` | `/api/v1/admin/recharge/plans/:id` | Admin | `manage_recharge_plans` | Update recharge plan details/pricing | ⚠️ Partial |
| `DELETE` | `/api/v1/admin/recharge/plans/:id` | Admin | `manage_recharge_plans` | Soft-deactivate a recharge plan | ❌ Missing |
| `GET` | `/api/v1/admin/recharge/offline` | Admin | `view_offline_recharge` | List offline deposit requests with status filter | ⚠️ Partial |
| `POST` | `/api/v1/admin/recharge/offline/:id/approve` | Admin | `approve_offline_recharge` | Approve offline deposit & credit coins (Idempotent) | ⚠️ Partial |
| `POST` | `/api/v1/admin/recharge/offline/:id/reject` | Admin | `approve_offline_recharge` | Reject offline deposit with reason | ⚠️ Partial |
| `GET` | `/api/v1/admin/recharge/online` | Admin | `view_recharge_plans` | List online recharge transactions | ❌ Missing |
| `GET` | `/api/v1/admin/payment-providers` | Admin | `view_settings` | List configured payment gateways | ❌ Missing |
| `PUT` | `/api/v1/admin/payment-providers/:id` | Admin | `edit_settings` | Update gateway fees, limits & credentials | ❌ Missing |
| `GET` | `/api/v1/recharge/plans` | Public / User | None | Browse active recharge packages | ❌ Missing |
| `GET` | `/api/v1/recharge/providers` | Public / User | None | List active payment gateways for checkout | ❌ Missing |
| `POST` | `/api/v1/recharge/online/create-intent` | User | Authenticated | Create online payment intent/checkout | ❌ Missing |
| `POST` | `/api/v1/recharge/online/callback/:gateway` | System | Signature Auth | Ingest webhook callback & credit coins | ❌ Missing |
| `POST` | `/api/v1/recharge/offline` | User | Authenticated | Submit offline deposit request with receipt | ❌ Missing |
| `GET` | `/api/v1/recharge/history` | User | Authenticated | Get authenticated user's recharge history | ❌ Missing |

---

## 18. Proposed Phase 10 Implementation Structure

When implementing Phase 10, the following file architecture should be created/updated:

```text
src/
├── validators/
│   ├── recharge.validator.js         (NEW: Zod schemas for plans, online checkout, offline deposits)
│   └── paymentProvider.validator.js  (NEW: Zod schemas for gateway configuration)
├── repositories/
│   ├── recharge.repository.js        (UPDATE: Extend with online queries, plan deletion, user history)
│   └── paymentProvider.repository.js (NEW: PaymentProvider CRUD and active gateway lookups)
├── services/
│   ├── recharge.service.js           (UPDATE: Complete online intent, webhook, and user submission logic)
│   └── paymentProvider.service.js    (NEW: Provider credential masking and fee resolution)
├── controllers/
│   ├── recharge.controller.js        (NEW: User and admin recharge HTTP request handlers)
│   └── paymentProvider.controller.js (NEW: Gateway configuration handlers)
├── routes/
│   ├── recharge.routes.js            (NEW: Consolidated user & admin recharge routes)
│   └── paymentProvider.routes.js     (NEW: Admin gateway management routes)
tests/
├── recharge_online.test.js           (NEW: Online intents, webhooks, signature verification, ledger credits)
├── recharge_offline.test.js          (NEW: Deposit submission, maker-checker approvals, rejections)
└── payment_providers.test.js         (NEW: Gateway configuration, credential masking, limit checks)
```

---

## 19. Out-of-Scope Items for Phase 10

The following must **NOT** be implemented during Phase 10:
* **Phase 11**: Real-time WebSockets room state, Agora RTC video/audio streaming, PK battle event timers.
* **Phase 12**: Casino mini-games, dynamic RTP, rocket multipliers, game bets.
* **Phase 13**: Social posts, feed comments, direct messaging, FCM push notifications.
* **Phase 14**: Admin Frontend React Axios modifications.
* **Phase 15**: Flutter Mobile Dart Dio modifications.
* **Phase 16**: Production server deployments, SSL certificates, penetration testing.

---

## 20. Implementation Order & Recommendations

1. **Step 1: Schema Updates**:
   * Add `PaymentProvider` model to `prisma/schema.prisma`.
   * Add missing fields to `RechargePlan`, `OnlineRecharge`, and `OfflineRecharge`.
   * Run `prisma generate` to update client types.
2. **Step 2: Validators**:
   * Create `src/validators/recharge.validator.js` and `src/validators/paymentProvider.validator.js`.
3. **Step 3: Repositories**:
   * Create `src/repositories/paymentProvider.repository.js` and update `src/repositories/recharge.repository.js`.
4. **Step 4: Services**:
   * Create `src/services/paymentProvider.service.js`.
   * Extend `src/services/recharge.service.js` with online payment intent creation, webhook processing, signature verification, user offline deposit submission, and user recharge history.
5. **Step 5: Controllers & Routes**:
   * Create `src/controllers/recharge.controller.js` and `src/controllers/paymentProvider.controller.js`.
   * Create `src/routes/recharge.routes.js` and `src/routes/paymentProvider.routes.js`, mounting them in `src/routes/index.js`.
6. **Step 6: Database Seeding**:
   * Seed baseline `RechargePlan` packages ($0.99, $4.99, $9.99, $39.99, $99.99) and default `PaymentProvider` records (Stripe, PayPal, Binance Pay, EasyPaisa, JazzCash).
7. **Step 7: Automated Tests**:
   * Create `tests/recharge_online.test.js`, `tests/recharge_offline.test.js`, and `tests/payment_providers.test.js`.
   * Verify 100% pass across all existing (117) and new Phase 10 tests.

---

## 21. Final Readiness Score

```text
Phase 10 Readiness: 40.0 / 100
Status: PARTIALLY IMPLEMENTED / SCAFFOLDED
```

**Score Rationale**: The underlying double-entry ledger (`LedgerService`), row-locking wallet repository (`WalletRepository`), maker-checker approval engine (`ApprovalService`), and administrative permissions are completely ready. However, the user-facing mobile recharge APIs, online gateway webhook ingestion engine, `PaymentProvider` configuration model, and automated test coverage must be implemented to achieve production readiness.
