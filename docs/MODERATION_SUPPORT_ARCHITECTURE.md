# Phase 8 — Moderation, Safety, Restrictions & Customer Support Architecture

## 1. Executive Summary

Phase 8 establishes the authoritative **Trust & Safety, Content Moderation, Dynamic Restrictions & Customer Support subsystem** in the ZeParty backend.

In accordance with ZeParty's core architectural tenets:
1. **Server-Side Authority (Zero Client Trust)**: All penalty enforcements, report lifecycles, and restriction expiry calculations are evaluated strictly on the backend.
2. **Server-Side Dynamic Expiration**: Restriction expiration is dynamically calculated via PostgreSQL query filters (`expiresAt IS NULL OR expiresAt > NOW()`) rather than brittle cron-based status mutations.
3. **Data Isolation & Internal Security**: Administrative notes (`isInternalNote: true`) and internal moderation metadata are filtered from mobile consumer APIs and only exposed to authorized Admin Portal sessions with RBAC permissions (`view_support`, `manage_support`, `view_moderation`, `action_moderation`).
4. **Realtime Distribution**: Instant notifications for suspensions, bans, report updates, and support messages are distributed via Socket.IO rooms (`user:<userId>`).

---

## 2. Core Entities & Schema Architecture

```
[ User ] <-------------------- [ Report ] (reporter / reported)
   |                              |
   | (1:N)                        | (triggers action)
   v                              v
[ Restriction ] <--------- [ ModerationAction ]
(MUTE, BAN, ROOM_BAN, etc.)       |
                                  v
[ SupportTicket ] <------- [ SupportTicketMessage ] (User & Admin replies)
```

### 2.1 Database Models
- **`Report`**: Captures user reports across multiple target entity types (`USER`, `ROOM`, `POST`, `COMMENT`, `DIRECT_MESSAGE`). Supports deduplication of active unresolved reports from the same reporter.
- **`Restriction`**: Authoritative penalty record with start timestamp, expiration timestamp, active status, and restriction type (`MUTE`, `BAN`, `ROOM_BAN`, `POST_RESTRICT`, `STREAM_RESTRICT`, `DIRECT_MESSAGE_RESTRICT`, `GIFT_RESTRICT`).
- **`ModerationAction`**: Administrative action record logging warning, mute, ban, unban, content deletion, or report resolution with full audit trail.
- **`SupportTicket`**: Customer service issue lifecycle (`OPEN`, `IN_PROGRESS`, `WAITING_ON_USER`, `RESOLVED`, `CLOSED`) with priority, category, and assignment.
- **`SupportTicketMessage`**: Threaded conversation history supporting user messages, admin replies, and staff-only internal notes.

---

## 3. Enforcement & Middlewares

### 3.1 `checkUserRestriction(restrictionType)`
Verifies whether a user has an active restriction before performing restricted actions (e.g. creating posts, sending chat messages, gifting, entering live rooms).

### 3.2 Account Status Guard
Checks user account status (`ACTIVE`, `SUSPENDED`, `BANNED`) on every authenticated request and immediately revokes access if an account is restricted.

---

## 4. API Endpoints

### 4.1 Mobile Client Endpoints (`/api/v1`)
- `POST /reports` — Submit report with entity reference and reason.
- `GET /reports/my` — List user's own submitted reports.
- `GET /reports/:id` — View own report status (IDOR protected).
- `POST /support/tickets` — Create support ticket with initial message.
- `GET /support/tickets` — List user's support tickets.
- `GET /support/tickets/:id` — View ticket details and messages (internal notes stripped).
- `POST /support/tickets/:id/messages` — Reply to support ticket.

### 4.2 Admin Portal Endpoints (`/api/v1/admin`)
- `GET /admin/reports` — List and filter moderation report queue.
- `POST /admin/reports/:id/assign` — Assign report to moderator.
- `POST /admin/reports/:id/resolve` — Resolve or dismiss report and optionally apply penalties.
- `GET /admin/restrictions` — View active & historical user restrictions.
- `POST /admin/restrictions` — Apply manual penalty restriction.
- `DELETE /admin/restrictions/:id` — Lift restriction prematurely.
- `POST /admin/moderation/action` — Execute direct moderation action (warn, mute, ban, remove content).
- `GET /admin/support/tickets` — List support ticket backlog.
- `GET /admin/support/tickets/:id` — View full ticket details including internal notes.
- `PATCH /admin/support/tickets/:id` — Update ticket status, priority, or assignment.
- `POST /admin/support/tickets/:id/messages` — Post reply or internal staff note.
