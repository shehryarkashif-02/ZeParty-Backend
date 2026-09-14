# ZeParty Dynamic Policy Engine & 15-Day Auto-Restore Specification

## 1. Overview
The **ZeParty Dynamic Policy Engine** manages platform business policies, host compensation target tiers, reseller margins, dynamic exchange rates, and administrative feature configurations via database-driven, auditable, and versioned Prisma models (`Policy`, `PolicyVersion`, `PolicyConfiguration`).

All financial mutations, conversions, and approval thresholds resolve dynamically through the policy resolution engine with deterministic fallback to authoritative constants in `src/constants/policyDefaults.js`.

---

## 2. Policy Resolution & Lifecycle Architecture

### 2.1 Resolution Flow
```text
Client / Service Request
           │
           ▼
[Check Redis Cache (TTL: 1h)]
  ├── Hit  ──► Return Cached JSON
  └── Miss ──► Query Database (Prisma)
                 ├── Record Found  ──► Cache in Redis & Return Effective Config
                 └── Record Absent ──► Fallback to Authoritative Defaults in policyDefaults.js
```

### 2.2 Versioning & Immutable Rollback
1. **Drafting**: New policy configurations are drafted via `createVersion()` (`POST /api/v1/admin/policies/:id/versions`).
2. **Publishing**: `publishVersion()` atomically updates `Policy.version`, sets the active version tag, invalidates Redis caches, and writes an audit log.
3. **Rollback**: `rollbackPolicy()` loads historical `PolicyVersion.configJson`, creates a **new immutable rollback version record** (`${targetVersion}-rollback-${timestamp}`), and sets it active. Historical versions are never mutated.

---

## 3. Dynamic Configuration & 15-Day Auto-Restore

### 3.1 15-Day Exact Arithmetic
* **Exact Duration**: `15 * 24 * 60 * 60 * 1000` ms = **1,296,000,000 milliseconds** (UTC).
* **Disable Trigger**: Setting a feature/rate switch OFF sets `status = 'DISABLED'`, `disabledAt = now`, `autoRestoreAt = now + 15 * 24h`.

### 3.2 Concurrency & Distributed Scheduler
```text
Background Scheduler (Every 60s) / Server Boot
           │
           ▼
[Acquire Redis Distributed Lock: 'lock:auto_restore_sweep']
  ├── Lock Not Acquired ──► Skip sweep (handled by another instance)
  └── Lock Acquired ────►
           │
           ▼
[Query Expired Configurations: status == 'DISABLED' AND autoRestoreAt <= now()]
           │
           ▼
[Conditional Atomic DB Update: UPDATE WHERE key = ? AND status = 'DISABLED']
           │
           ▼
[Invalidate Redis Cache & Emit 'AUTO_RESTORE_EXECUTED' Audit Log]
           │
           ▼
[Safe Release Redis Lock]
```

---

## 4. Canonical Policy Domains & Configuration Keys

### 4.1 Policy Domains
* `ECONOMY`: Revenue split (45% Platform, 35% Host, 12% Agency, 8% Room), baseline rates.
* `LIVE_HOST`: 25-level target matrix, 1h daily streaming, 15-day payout cycle.
* `AUDIO_HOST`: Social audio tiers (30K, 60K, 100K, 350K target tiers).
* `RESELLER`: Reseller packages ($50, $200, $1,000, $5,000 tiers).
* `MERCHANT`: Merchant portal fee ($3,000), margin limit (20%), monthly quota ($1,000).
* `MANAGER`: Regional manager requirements ($1,000 baseline, $2,000 cap).

### 4.2 Configuration Keys
* `USD_TO_COIN_RATE`: 10,000 Coins / 1 USD
* `DIAMOND_TO_USD_RATE`: 10,000 Diamonds / 1 USD
* `RESELLER_TRANSFER_FEE_PERCENT`: 2.5%
* `HOST_TRANSFER_FEE_PERCENT`: 5.0%
* `MIN_WITHDRAWAL_USD`: $10.00
* `MAX_WITHDRAWAL_DAILY_USD`: $5,000.00
* `APPROVAL_THRESHOLD_USD`: $100.00
* `APPROVAL_THRESHOLD_COINS`: 1,000,000 Coins

---

## 5. REST API Endpoints & RBAC Guards

| Method | Endpoint | Required Permission | Description |
| :---: | :--- | :---: | :--- |
| `GET` | `/api/v1/admin/policies` | `view_settings` | List all platform policies |
| `GET` | `/api/v1/admin/policies/effective/:policyType` | `view_settings` | Get active effective policy configuration |
| `GET` | `/api/v1/admin/policies/:id` | `view_settings` | Get policy details and version history |
| `POST` | `/api/v1/admin/policies` | `economy_settings` | Create a new policy domain |
| `GET` | `/api/v1/admin/policies/:id/versions` | `view_settings` | Paginated policy version history |
| `POST` | `/api/v1/admin/policies/:id/versions` | `economy_settings` | Draft a new policy version |
| `POST` | `/api/v1/admin/policies/:id/versions/:versionId/publish` | `economy_settings` | Atomically activate a policy version |
| `POST` | `/api/v1/admin/policies/:id/rollback` | `economy_settings` | Roll back policy to historical version |
| `GET` | `/api/v1/admin/economy/configs` | `view_settings` | List all dynamic key-value configurations |
| `GET` | `/api/v1/admin/economy/configs/:key` | `view_settings` | Get effective configuration for a key |
| `PUT` | `/api/v1/admin/economy/configs/:key` | `economy_settings` | Update configuration value |
| `POST` | `/api/v1/admin/economy/configs/:key/disable` | `economy_settings` | Disable setting with 15-day auto-restore |
| `POST` | `/api/v1/admin/economy/configs/:key/restore` | `economy_settings` | Manually restore disabled setting |
| `POST` | `/api/v1/admin/jobs/auto-restore/trigger` | `manage_settings` | Manually trigger auto-restore sweep |
