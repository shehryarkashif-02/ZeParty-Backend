# ZeParty Authentication & RBAC Architecture Specification

## 1. Overview
The **ZeParty Shared Backend** enforces strict, stateless **JSON Web Token (JWT)** authentication and independent **Role-Based Access Control (RBAC)** authorization. 

> [!IMPORTANT]
> The backend **NEVER** trusts permissions claimed by the frontend. The React Admin Dashboard and Flutter Mobile App permissions are UI-only flags. The backend independently validates every JWT, evaluates role permissions, checks two-stage approval status, and logs administrative actions.

---

## 2. Authentication Lifecycle

### Dual Token Architecture
1. **Access Token**: Short-lived JWT (15-minute expiration) signed with `JWT_SECRET`. Carries user ID, session ID, user type, and role ID. Passed in HTTP headers as `Authorization: Bearer <access_token>`.
2. **Refresh Token**: Long-lived token (7-day expiration) stored securely in `UserSession` table and returned in HttpOnly cookies. Used via `POST /api/auth/refresh`.

### Authentication Endpoints (Implemented in Phase 3)
* **`POST /api/v1/auth/request-otp`** (Alias: `/api/auth/otp/send`): Validates phone format, applies Redis rate-limiting, generates a 6-digit numeric OTP, hashes the code using SHA-256 into `OTPVerification`, and dispatches via configured provider (`mock` or SMS).
* **`POST /api/v1/auth/verify-otp`** (Alias: `/api/auth/otp/verify`): Verifies OTP hash within 5-minute window, enforces single-use & 5-attempt ceiling, auto-provisions new `User` & `UserProfile` & `Wallet` if first time, records `UserDevice`, registers `UserSession`, issues access JWT + refresh token, and logs `LoginAttempt`.
* **`POST /api/v1/auth/refresh`**: Performs refresh token rotation — verifies active non-revoked session, checks account status, invalidates used refresh token, issues new access token + new refresh token, and blocks replay attacks.
* **`POST /api/v1/auth/logout`**: Revokes the active `UserSession` record (`revokedAt = now()`), immediately invalidating subsequent refresh requests.
* **`GET /api/v1/auth/me`**: Protected endpoint returning authenticated `User` profile & wallet envelope or `Admin` session.
* **`POST /api/v1/auth/admin/login`**: Authenticates portal administrators via `Admin` model credentials (`usernameOrEmail` + bcrypt `passwordHash`), verifies active status, creates `UserSession`, and returns administrative token + permissions envelope.

---

## 3. RBAC Permission Matrix (73 Canonical Permissions across 10 Modules)

The backend implements exactly the **73 canonical permissions** across 10 functional modules and 7 pre-configured administrative roles defined in `permissions.js`:

```text
                               ┌───────────────────────────┐
                               │       Root Owner          │ (Full Authority, Bypass & Supervision)
                               └─────────────┬─────────────┘
                                             │
                               ┌─────────────▼─────────────┐
                               │       Super Admin         │ (ALL 73 Permissions, '*')
                               └─────────────┬─────────────┘
                                             │
    ┌────────────────┬───────────────────────┼───────────────────────┬────────────────┐
    │                │                       │                       │                │
┌───▼────────────┐ ┌─▼──────────────┐ ┌──────▼──────────────┐ ┌──────▼──────────┐ ┌───▼───────────┐
│ Finance Admin  │ │  Host Admin    │ │   Agency Admin    │ │   Moderator    │ │ Content Admin │
│ (22 Perms)     │ │  (11 Perms)    │ │   (8 Perms)       │ │   (16 Perms)   │ │ (19 Perms)    │
└────────────────┘ └────────────────┘ └───────────────────┘ └────────────────┘ └──────┬────────┘
                                                                                       │
                                                                                ┌──────▼────────┐
                                                                                │ Support Admin │
                                                                                │ (10 Perms)    │
                                                                                └───────────────┘
```

### The 10 Canonical Modules (73 Permissions):
1. **`users` (9)**: `view_users`, `view_user_details`, `edit_users`, `suspend_users`, `ban_users`, `delete_user_posts`, `manage_balances`, `grant_user_props`, `manage_user_devices`.
2. **`hosts_agencies` (8)**: `view_hosts`, `review_hosts`, `approve_reject_hosts`, `view_agencies`, `review_agencies`, `approve_reject_agencies`, `manage_agency_finance`, `manage_bd_centers`.
3. **`live_rooms` (6)**: `view_live_rooms`, `view_room_details`, `moderation_actions`, `delete_room_dp`, `view_pk_events`, `manage_pk_events`.
4. **`resellers_merchants` (5)**: `view_sellers`, `manage_sellers`, `view_merchants`, `manage_merchants`, `issue_coins`.
5. **`monetization_finance` (9)**: `view_recharge_plans`, `manage_recharge_plans`, `view_offline_recharge`, `approve_offline_recharge`, `view_withdrawals`, `approve_withdrawals`, `reject_withdrawals`, `view_finance`, `view_ledger`.
6. **`refunds_risk` (6)**: `view_refunds`, `approve_refunds`, `reseller_corrections`, `view_chargebacks`, `view_fraud_risk`, `take_risk_actions`.
7. **`economy_catalog` (9)**: `view_gifts`, `manage_gifts`, `view_vip_store`, `manage_vip_store`, `view_store`, `manage_store`, `view_games`, `manage_games`, `economy_settings`.
8. **`content_communications` (6)**: `view_banners`, `manage_banners`, `view_announcements`, `manage_announcements`, `view_notifications`, `manage_notifications`.
9. **`moderation_support` (7)**: `view_reports`, `view_moderation`, `action_moderation`, `manage_restrictions`, `view_chat`, `view_support`, `manage_support`.
10. **`governance_system` (8)**: `view_admins`, `manage_admins`, `manage_roles`, `view_audit_logs`, `view_settings`, `manage_settings`, `view_system_health`, `export_data`.

### Role Permission Mapping Matrix
1. **`super_admin`**: All 73 canonical permissions (`*`).
2. **`finance_admin`**: `view_users`, `view_user_details`, `manage_balances`, `view_sellers`, `manage_sellers`, `view_merchants`, `manage_merchants`, `issue_coins`, `view_recharge_plans`, `manage_recharge_plans`, `view_offline_recharge`, `approve_offline_recharge`, `view_withdrawals`, `approve_withdrawals`, `reject_withdrawals`, `view_finance`, `view_ledger`, `view_refunds`, `approve_refunds`, `reseller_corrections`, `view_chargebacks`, `view_audit_logs`, `export_data`.
3. **`host_admin`**: `view_users`, `view_user_details`, `edit_users`, `view_hosts`, `review_hosts`, `approve_reject_hosts`, `view_agencies`, `view_live_rooms`, `view_room_details`, `view_pk_events`, `view_audit_logs`.
4. **`agency_admin`**: `view_users`, `view_user_details`, `view_hosts`, `view_agencies`, `review_agencies`, `approve_reject_agencies`, `manage_agency_finance`, `view_audit_logs`.
5. **`moderator`**: `view_users`, `view_user_details`, `suspend_users`, `ban_users`, `manage_user_devices`, `view_live_rooms`, `view_room_details`, `moderation_actions`, `view_reports`, `view_moderation`, `action_moderation`, `manage_restrictions`, `view_chat`, `view_fraud_risk`, `take_risk_actions`, `view_audit_logs`.
6. **`content_admin`**: `view_users`, `view_user_details`, `grant_user_props`, `view_gifts`, `manage_gifts`, `view_vip_store`, `manage_vip_store`, `view_store`, `manage_store`, `view_games`, `manage_games`, `view_banners`, `manage_banners`, `view_announcements`, `manage_announcements`, `view_notifications`, `manage_notifications`, `view_pk_events`, `manage_pk_events`, `view_audit_logs`.
7. **`support_admin`**: `view_users`, `view_user_details`, `view_hosts`, `view_agencies`, `view_live_rooms`, `view_recharge_plans`, `view_withdrawals`, `view_support`, `manage_support`, `view_audit_logs`.

---

## 4. Backend Route Middleware Pipeline

```text
[HTTP Request]
     │
     ▼
[authenticateToken] ─── (Validates JWT Bearer Header, populates req.user / req.admin)
     │
     ▼
[requirePermission('manage_balances')] ─── (Verifies admin possesses required permission ID)
     │
     ▼
[requireApprovalIfThreshold] ─── (Checks if financial change > $100 requires AdminApproval record)
     │
     ▼
[Route Controller] ─── (Executes business logic inside Prisma $transaction)
     │
     ▼
[auditLogger] ─── (Writes diff entry to AuditLog database table)
     │
     ▼
[JSON Response]
```
