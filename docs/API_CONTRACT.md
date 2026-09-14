# ZeParty Backend — API Contract Blueprint Specification

## 1. Executive Summary
This document specifies the master REST API blueprint for the shared **ZeParty** backend. All endpoints return standardized JSON envelopes, support dynamic pagination (`?page=1&limit=20`), enforce strict HTTP status codes, and mandate JSON Web Token (JWT) bearer authentication headers (`Authorization: Bearer <token>`).

---

## 2. Standard Response Envelope Formats

### Success Response Envelope (200 OK / 201 Created)
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 142,
    "totalPages": 8
  }
}
```

### Error Response Envelope (400 / 401 / 403 / 404 / 422 / 500)
```json
{
  "success": false,
  "message": "Human-readable error explanation",
  "error": {
    "code": "ERROR_CODE_CONSTANT",
    "details": [ ... ]
  }
}
```

---

## 3. Core API Endpoint Blueprint (Grouped by Module)

### Group 1: Authentication & Health (`/api/auth`, `/api/health`)
* **`GET /api/health`**: Public. Verifies database and Redis status.
* **`POST /api/auth/register`**: Mobile. User signup (phone/email, password, DOB age check).
* **`POST /api/auth/otp/send`**: Mobile. Requests 4-digit SMS OTP verification code.
* **`POST /api/auth/otp/verify`**: Mobile. Verifies SMS OTP code.
* **`POST /api/auth/login`**: Mobile. Authenticates user account. Returns `{ token, refreshToken, user }`.
* **`POST /api/auth/admin/login`**: Admin Dashboard. Authenticates admin session. Returns `{ token, admin: { id, role, permissions } }`.
* **`POST /api/auth/refresh`**: Shared. Exchanges refresh token for new access token.
* **`POST /api/auth/logout`**: Shared. Invalidates active user/admin session token.

### Group 2: User Directory & Accounts (`/api/users`)
* **`GET /api/users`**: Admin (`view_users`). Search & filter user directory.
* **`GET /api/users/:id`**: Admin (`view_user_details`) / Mobile (self). Returns complete profile details, balances, and active session.
* **`PUT /api/users/:id/status`**: Admin (`suspend_users` / `ban_users`). Bans or suspends user account. (Requires Audit Log).
* **`POST /api/users/:id/balance`**: Admin (`manage_balances`). Adjusts coin balance. (Requires `AdminApproval` if amount > $100 & Audit Log).

### Group 3: Wallets & Immutable Ledger (`/api/wallet`)
* **`GET /api/wallet/balance`**: Mobile. Returns current coin, diamond, and locked escrow balances.
* **`GET /api/wallet/transactions`**: Mobile / Admin (`view_ledger`). Paginated transaction ledger list.
* **`POST /api/wallet/diamonds/exchange`**: Mobile. Swaps host diamonds to user coins using platform exchange rate.
* **`POST /api/wallet/diamonds/transfer`**: Mobile. Transfers diamonds to another host ID.

### Group 4: Recharge & Cashout Withdrawals (`/api/recharge`, `/api/withdrawals`)
* **`GET /api/recharge/plans`**: Mobile / Admin (`view_recharge_plans`). Lists available coin purchase packages.
* **`POST /api/recharge/offline`**: Mobile. Submits offline bank recharge receipt photo and transaction reference.
* **`GET /api/recharge/offline`**: Admin (`view_offline_recharge`). Returns queue of pending bank deposit slips.
* **`PUT /api/recharge/offline/:id`**: Admin (`approve_offline_recharge`). Approves or rejects deposit slip. (Triggers coin credit & Audit Log).
* **`POST /api/withdrawals`**: Mobile. Submits diamond cashout withdrawal request.
* **`GET /api/withdrawals`**: Admin (`view_withdrawals`). Returns pending host cashout requests list.
* **`PUT /api/withdrawals/:id`**: Admin (`approve_withdrawals` / `reject_withdrawals`). Approves payout or rejects request (re-crediting diamonds).

### Group 5: Hosts, Agencies & BD Centers (`/api/hosts`, `/api/agencies`, `/api/bd-centers`)
* **`GET /api/hosts`**: Admin (`view_hosts`). Lists active Live Video Hosts and Social Audio Hosts.
* **`POST /api/hosts/apply`**: Mobile. Submits host verification application (ID photos, video sample, hostType: `LIVE_HOST`/`AUDIO_HOST`).
* **`PUT /api/hosts/applications/:id`**: Admin (`approve_reject_hosts`). Approves or rejects host application.
* **`GET /api/agencies`**: Admin (`view_agencies`). Lists agencies, linked hosts, and monthly diamond performance.
* **`GET /api/bd-centers`**: Admin (`manage_bd_centers`). Lists BD Centers, agency networks, and 5-tier salary projections.

### Group 6: Live & Audio Rooms (`/api/rooms`)
* **`GET /api/rooms`**: Mobile / Admin (`view_live_rooms`). Active video stream feeds and audio party rooms.
* **`POST /api/rooms`**: Mobile. Creates stream or party room. Generates secure Agora RTC token.
* **`DELETE /api/rooms/:id/cover`**: Admin (`delete_room_dp`). Removes inappropriate room cover photo without deleting room entity.
* **`POST /api/rooms/:id/seats/join`**: Mobile. Requests 1 of 8 micro-seats in audio party room.
* **`PUT /api/rooms/:id/seats/:seatIndex`**: Mobile / Admin (`moderation_actions`). Mutes, locks, or kicks speaker from seat.

### Group 7: Virtual Gifts & Asset Store (`/api/gifts`, `/api/assets`, `/api/store`)
* **`GET /api/gifts`**: Mobile / Admin (`view_gifts`). Catalog of virtual gifts (SVGA assets, coin prices).
* **`POST /api/gifts/send`**: Mobile. Executes real-time gift transaction (calculates 45/35/12/8 revenue splits and broadcasts SVGA animation via WebSockets).
* **`GET /api/assets`**: Mobile / Admin (`view_store`). Avatar frames, entrance vehicles, noble badges.

### Group 8: Mini-Games & Dynamic House Edge (`/api/games`)
* **`GET /api/games/config`**: Mobile / Admin (`view_games`). Lists active games, computed RTP, and House Edge.
* **`PUT /api/games/:id/config`**: Admin (`manage_games`). Updates prize probabilities & payouts. Automatically recalculates House Edge ($ 1 - \sum p_i \cdot payout_i $). (Requires `AdminApproval`).
* **`POST /api/games/play`**: Mobile. Executes game round bet (Slots, Rocket cashout, Wheel spin).

### Group 9: Admin Approvals & Audit Governance (`/api/admin`)
* **`GET /api/admin/approvals`**: Admin (`view_admins`). Pending administrative approval tasks queue.
* **`PUT /api/admin/approvals/:id`**: Admin (`manage_admins`). Approves or rejects pending admin action request.
* **`GET /api/admin/audit-logs`**: Admin (`view_audit_logs`). Searchable audit log of administrative write actions.
