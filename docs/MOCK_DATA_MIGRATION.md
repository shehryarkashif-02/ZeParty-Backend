# ZeParty Mock Data Migration & Database Replacement Inventory

## 1. Overview
Both the React Admin Dashboard and Flutter Mobile App currently rely on static JavaScript/Dart arrays, simulated repository stores, and hard-coded mock objects. This document inventories every mock dataset, identifies what it simulates, defines its database replacement, and ranks its migration priority.

---

## 2. Admin Dashboard Mock Inventory (`Admin Frontend/src/mocks/`)

| Mock File Path | What It Simulates | Future Database Replacement | Migration Priority |
| :--- | :--- | :--- | :--- |
| `src/mocks/bdCenterFull.mock.js` | 15-day BD salary matrices, active BD centers, recruitment invitation lists. | `BDCenter`, `BDInvite`, `BDLevel`, `Agency` | **High (Phase 7)** |
| `src/mocks/users.mock.js` | User directory profile rows, wallet balances, account statuses, device IDs. | `User`, `UserProfile`, `UserDevice`, `Wallet` | **Critical (Phase 3)** |
| `src/mocks/hosts.mock.js` | Active Live Host directory, monthly diamond earnings, streaming hours, host levels. | `HostProfile`, `HostApplication`, `HostLevelConfig` | **High (Phase 7)** |
| `src/mocks/agencies.mock.js` | Multi-tier agency networks, active host counts, commission percentages. | `Agency`, `AgencyMember`, `AgencyLevel` | **High (Phase 7)** |
| `src/mocks/gifts.mock.js` | Virtual gift items catalog, coin prices, SVGA animation URLs, revenue split ratios. | `Gift`, `GiftCategory` | **High (Phase 8)** |
| `src/mocks/posts.mock.js` | Admin promotional post directory and community feed entries. | `Post`, `Comment` | **Medium (Phase 12)**|
| `src/mocks/exchangeRates.mock.js` | Regional currency exchange overrides (USD to local fiat rates). | `PolicyConfiguration` | **High (Phase 6)** |
| `src/mocks/transferRates.mock.js` | Authorized Reseller profit margins and commission tiers. | `CoinSeller`, `PolicyConfiguration` | **High (Phase 7)** |
| `src/mocks/teamsRoles.mock.js` | Admin account directory, roles matrix (`MOCK_ROLES`), and 61 permission IDs. | `Admin`, `Role`, `Permission`, `RolePermission` | **Critical (Phase 4)** |
| `src/mocks/policyConfig.mock.js` | Master policy toggles for Live Hosts, Audio Hosts, Resellers, and Merchants. | `Policy`, `PolicyVersion`, `PolicyConfiguration` | **High (Phase 6)** |
| `src/mocks/coinRefunds.mock.js` | Double recharge disputes & coin refund processing ledger. | `CoinRefund`, `WalletLedger` | **High (Phase 5)** |
| `src/mocks/policies/liveHostPolicy.mock.js` | 25-tier Live Host diamond targets, basic salaries ($5 to $5,000), 1h daily streams. | `HostLevelConfig` | **High (Phase 6)** |
| `src/mocks/policies/audioHostPolicy.mock.js` | Audio Host coin targets, 2h daily audio room hosting requirements. | `HostLevelConfig` | **High (Phase 6)** |
| `src/mocks/policies/coinsSellerPolicy.mock.js` | Authorized coin reseller packages ($300, $500, $1,000 tiers). | `PolicyConfiguration` | **High (Phase 6)** |

---

## 3. Flutter Mobile App Mock Inventory (`mobile app/`)

| Mock Location | What It Simulates | Future Backend Replacement | Migration Priority |
| :--- | :--- | :--- | :--- |
| `lib/core/constants/dummy_data.dart` | `currentUser`, `popularUsers`, `shortVideos`, `liveRooms`, `gifts`, `medals`, `outfits`. | `User`, `Room`, `Gift`, `Asset` Prisma tables | **Critical (Phases 3, 8, 10)** |
| `lib/core/repositories/backend_repository.dart` | In-memory notifications list, direct message threads, user feeds. | `/api/social/posts`, `/api/notifications`, `/api/messages` | **Medium (Phase 12)** |
| `lib/core/repositories/local_party_repository.dart` | Simulated WebSockets audio room feeds, seat mutes, speaker mic locks. | Socket.IO room gateway + Redis room state cache | **Critical (Phase 10)** |
| `lib/core/repositories/wallet_repository.dart` | Simulated balance ($45,000 coins dev), manual array spend/recharge logic. | `/api/wallet/balance`, `/api/wallet/transactions` | **Critical (Phase 5)** |
| `lib/core/services/agora_rtc_service.dart` | Hardcoded `appId = "YOUR_AGORA_APP_ID"` and missing dynamic RTC token generation. | `/api/rooms/agora-token` endpoint | **Critical (Phase 10)** |
| Simulated streaming viewer count timers | Pseudo-random viewer increment intervals in live streaming view. | Redis room viewer set `SCARD room:viewers` | **High (Phase 10)** |

---

## 4. Strict Preservation Rule
All mock files listed above **must remain intact** during Phase 1 through Phase 12. They will only be swapped out during Phase 13 (Admin Frontend integration) and Phase 14 (Flutter API integration).
