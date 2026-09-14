# Phase 10 API Integration Audit & Contract Verification

## 1. Overview & Objective
This document details the comprehensive end-to-end API contract audit conducted across the ZeParty platform:
- **Authoritative Backend API**: Express.js, Prisma 6.0, PostgreSQL, Redis, Socket.IO, Firebase Admin.
- **Admin Portal**: React 18 SPA (`Admin Frontend/src/`).
- **Mobile Client**: Flutter cross-platform mobile application (`mobile app/lib/`).

The audit verifies route signatures, HTTP methods, request bodies, query parameters, authorization requirements, pagination paradigms, ID/timestamp formats, BigInt/Decimal serialization, and mock classifications.

---

## 2. Mock Classification Registry

| Mock File / Module | Location | Classification | Production Replacement Status / Notes |
|---|---|---|---|
| `approvals.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/approvals` endpoints. Real DB approval states verified. |
| `auditLogs.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/audit-logs`. Authoritative PostgreSQL AuditLog records queried. |
| `banners.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/banners` and `/api/v1/banners/active`. |
| `bdCenters.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/bd-centers` and `/api/v1/bd-centers`. |
| `coinRefunds.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/chargebacks` and `/api/v1/finance/refunds`. |
| `comms.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/notifications/broadcast` and `/api/v1/admin/announcements`. |
| `dashboard.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/economy/summary` & `/api/v1/admin/moderation/stats`. |
| `exchangeRates.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/policies/exchange-rates`. |
| `finance.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/settlements` and `/api/v1/admin/payment-providers`. |
| `gifts.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/gifts` and `/api/v1/gifts`. |
| `hosts.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/hosts` and `/api/v1/hosts`. |
| `liveRooms.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/rooms` and `/api/v1/rooms`. |
| `moderation.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/moderation/queue`, `/api/v1/admin/reports`, `/api/v1/admin/restrictions`. |
| `posts.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/posts` and `/api/v1/posts`. |
| `reports.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/reports` and `/api/v1/reports`. |
| `store.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/store` and `/api/v1/store`. |
| `support.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/support/tickets` and `/api/v1/support/tickets`. |
| `teamsRoles.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/admin/roles` and `/api/v1/admin/admins`. |
| `wallet.mock.js` | `Admin Frontend/src/mocks` | `STALE_PRODUCTION_INTEGRATION` | Replaced with `/api/v1/wallet/me` and `/api/v1/wallet/transactions`. |
| `local_party_repository.dart` | `mobile app/lib/core/repositories` | `DEVELOPMENT_MOCK` | Standalone local storage for offline state; backend API integration wired via `api_client.dart`. |
| `fcmAdapter` mock fallback | `backend/src/adapters/fcm.adapter.js` | `LEGITIMATE_TEST_MOCK` | Explicit `FCM_MOCK_MODE=true` simulates cloud messaging receipts when Firebase credentials are omitted in testing. |

---

## 3. End-to-End API Contract Verification Matrix

### 3.1 Authentication & Identity Subsystem
| Endpoint | Method | Backend Contract | Admin Expectation | Mobile Expectation | Verification Status |
|---|---|---|---|---|---|
| `/api/v1/auth/register` | `POST` | Body: `{ phone, password, name, role? }` -> Envelope `{ success, data: { user, accessToken, refreshToken } }` | N/A | Auth register screen | **VERIFIED** |
| `/api/v1/auth/login` | `POST` | Body: `{ phone, password }` -> Envelope `{ success, data: { user, accessToken, refreshToken } }` | Admin login page | User login flow | **VERIFIED** |
| `/api/v1/auth/refresh` | `POST` | Body: `{ refreshToken }` -> Envelope `{ success, data: { accessToken, refreshToken } }` | Token refresh interceptor | Auto-refresh interceptor | **VERIFIED** |
| `/api/v1/auth/logout` | `POST` | Headers: `Bearer <token>` -> Envelope `{ success: true, message }` | Header session purge | Session purge | **VERIFIED** |
| `/api/v1/users/me` | `GET` | Headers: `Bearer <token>` -> Envelope `{ success, data: UserProfile }` | Admin profile | Current user profile | **VERIFIED** |

### 3.2 Wallet & Financial Transactions Subsystem
| Endpoint | Method | Backend Contract | Admin Expectation | Mobile Expectation | Verification Status |
|---|---|---|---|---|---|
| `/api/v1/wallet/me` | `GET` | Headers: `Bearer <token>` -> `{ success, data: { coinsBalance, diamondsBalance, isLocked } }` | User detail modal | Wallet balance screen | **VERIFIED** |
| `/api/v1/wallet/transactions` | `GET` | Query: `?cursor=&limit=&type=` -> `{ success, data: items[], meta: { nextCursor } }` | Transaction ledger | Wallet history list | **VERIFIED** |
| `/api/v1/recharge/orders` | `POST` | Body: `{ planId, paymentProviderId }` -> `{ success, data: { orderId, paymentUrl, reference } }` | N/A | Payment sheet init | **VERIFIED** |
| `/api/v1/recharge/offline/submit` | `POST` | Body: `{ planId, slipUrl, sellerId }` -> `{ success, data: OfflineOrder }` | Offline approval queue | Slip upload flow | **VERIFIED** |
| `/api/v1/gifts/send` | `POST` | Body: `{ giftId, roomId, recipientId, quantity }` -> `{ success, data: { transactionId, balance } }` | Gift activity monitor | Live room gift bar | **VERIFIED** |

### 3.3 Live Rooms & Realtime Subsystem
| Endpoint | Method | Backend Contract | Admin Expectation | Mobile Expectation | Verification Status |
|---|---|---|---|---|---|
| `/api/v1/rooms` | `POST` | Body: `{ title, topic, isPrivate, password? }` -> `{ success, data: LiveRoom }` | Admin room manager | Start live flow | **VERIFIED** |
| `/api/v1/rooms` | `GET` | Query: `?cursor=&limit=&status=ACTIVE` -> `{ success, data: LiveRoom[], meta }` | Active rooms table | Explore/Home feed | **VERIFIED** |
| `/api/v1/rooms/:id/join` | `POST` | Headers: `Bearer <token>` -> `{ success, data: { room, agoraToken, role } }` | Room inspection | Room enter screen | **VERIFIED** |
| `/api/v1/rooms/:id/seats/:seatIndex/take` | `POST` | Headers: `Bearer <token>` -> `{ success, data: SeatState }` | Seat monitor | Take mic button | **VERIFIED** |
| `/api/v1/rooms/:id/close` | `POST` | Host or Admin with `manage_rooms` -> `{ success: true }` | Force close action | End broadcast button | **VERIFIED** |

### 3.4 Social & Community Subsystem
| Endpoint | Method | Backend Contract | Admin Expectation | Mobile Expectation | Verification Status |
|---|---|---|---|---|---|
| `/api/v1/posts` | `POST` | Body: `{ content, mediaUrls?, visibility }` -> `{ success, data: Post }` | Feed management | Create post screen | **VERIFIED** |
| `/api/v1/feed` | `GET` | Query: `?cursor=&limit=&feedType=FOLLOWING|DISCOVER` -> `{ success, data: Post[], meta }` | N/A | Social timeline | **VERIFIED** |
| `/api/v1/posts/:id/like` | `POST` | Headers: `Bearer <token>` -> `{ success, data: { liked: true, likeCount } }` | Post metrics | Like heart button | **VERIFIED** |
| `/api/v1/posts/:id/comments` | `POST` | Body: `{ content }` -> `{ success, data: Comment }` | Moderation queue | Comment input | **VERIFIED** |
| `/api/v1/social/users/:id/follow` | `POST` | Headers: `Bearer <token>` -> `{ success, data: { following: true } }` | Relationship graph | Follow button | **VERIFIED** |

### 3.5 Moderation, Safety & Support Subsystem
| Endpoint | Method | Backend Contract | Admin Expectation | Mobile Expectation | Verification Status |
|---|---|---|---|---|---|
| `/api/v1/reports` | `POST` | Body: `{ targetType, targetId, reason, description, evidenceUrls }` -> `{ success, data: Report }` | Reports queue | In-app report dialog | **VERIFIED** |
| `/api/v1/admin/moderation/actions` | `POST` | Body: `{ targetUserId, actionType, durationSeconds, reason }` -> `{ success, data: Sanction }` | Sanction panel | N/A (Server enforced) | **VERIFIED** |
| `/api/v1/admin/restrictions` | `GET` | Query: `?userId=&isActive=true` -> `{ success, data: Restriction[] }` | Restrictions table | N/A | **VERIFIED** |
| `/api/v1/support/tickets` | `POST` | Body: `{ subject, message, category, attachments }` -> `{ success, data: Ticket }` | Support desk inbox | Help center ticket form | **VERIFIED** |
| `/api/v1/support/tickets/:id/messages`| `POST` | Body: `{ content, attachments }` -> `{ success, data: TicketMessage }` | Support chat thread | Ticket reply screen | **VERIFIED** |

### 3.6 Notifications & FCM Subsystem
| Endpoint | Method | Backend Contract | Admin Expectation | Mobile Expectation | Verification Status |
|---|---|---|---|---|---|
| `/api/v1/notifications/devices` | `POST` | Body: `{ deviceToken, platform, appVersion, deviceModel }` -> `{ success, data: Device }` | Device analytics | FCM init handshake | **VERIFIED** |
| `/api/v1/notifications` | `GET` | Query: `?cursor=&limit=&category=` -> `{ success, data: Notification[], meta: { unreadCount } }` | User alerts review | Notification center | **VERIFIED** |
| `/api/v1/notifications/:id/read` | `POST` | Headers: `Bearer <token>` -> `{ success, data: { readAt } }` | N/A | Notification tap | **VERIFIED** |
| `/api/v1/notifications/preferences` | `PUT` | Body: `{ social, live, pk, games, finance, marketing }` -> `{ success, data: Preferences }` | User config viewer | Push settings screen | **VERIFIED** |
| `/api/v1/admin/notifications/broadcast`| `POST` | Body: `{ title, body, audience, data? }` -> `{ success, data: BroadcastReceipt }` | Push campaign studio | Background receiver | **VERIFIED** |

---

## 4. Contract Envelope & Type Standardization
1. **Success Envelope**:
   ```json
   {
     "success": true,
     "data": { ... },
     "meta": { "nextCursor": "...", "total": 100 }
   }
   ```
2. **Error Envelope**:
   ```json
   {
     "success": false,
     "message": "Human readable error description",
     "error": {
       "code": "SPECIFIC_ERROR_CODE",
       "details": [ ... ]
     }
   }
   ```
3. **Data Type Serialization**:
   - `BigInt` (e.g. coin micro-units) and `Decimal` values are serialized to standard numerical strings/numbers via `serializerMiddleware`.
   - ISO-8601 UTC timestamps are consistently emitted across all responses (`YYYY-MM-DDTHH:mm:ss.sssZ`).
