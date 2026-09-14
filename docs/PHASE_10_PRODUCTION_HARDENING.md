# Phase 10 — Production Hardening & Observability Specification

## 1. Executive Summary
Phase 10 hardens the complete ZeParty backend against production vulnerabilities, high-concurrency races, data leaks, and failure cascades without altering the established domain architecture.

---

## 2. Hardening Measures Implemented

### 2.1 Request Tracing & Correlation IDs (`x-request-id`)
- Every HTTP request receives an RFC 4122 UUID v4 correlation ID via `crypto.randomUUID()`.
- If the incoming client supplies `x-request-id`, it is preserved and propagated across all log statements, database queries, and response headers.
- Enables end-to-end tracing from mobile app/admin portal to backend logs.

### 2.2 Sensitive Data Redaction in Logs (Pino)
- The structured logging pipeline automatically scrubs sensitive fields before writing to stdout/disk:
  - `req.headers.authorization`
  - `req.headers.cookie`
  - `password`, `pin`, `otp`, `code`
  - `cardNumber`, `cvv`, `pan`, `accountNumber`
  - `fcmToken`, `deviceToken`, `refreshToken`, `secretKey`, `token`
- Prevents accidental credential leaks to log aggregators (Datadog, CloudWatch, Loki).

### 2.3 Idempotency & Replay Protection
- Standardized `Idempotency-Key` header handling across critical mutation routes (financial transactions, gift sending, recharge orders, settlement approvals).
- Atomic check-and-set via Redis / PostgreSQL ensures duplicate clicks under network latency yield identical cached results without duplicating financial debits.

### 2.4 Error Handling & Information Leakage Prevention
- Production error handlers strip stack traces, internal database schema details, and file paths.
- Responses conform strictly to standard error envelop format:
  ```json
  {
    "success": false,
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "User not found",
      "details": null
    },
    "meta": {
      "requestId": "123e4567-e89b-12d3-a456-426614174000",
      "timestamp": "2026-09-08T11:45:00.000Z"
    }
  }
  ```

### 2.5 Failure Isolation & Non-Blocking Post-Commit Side Effects
- Asynchronous side-effects (Socket.IO broadcasts, FCM push notifications, email alerts) are scheduled strictly **after** database transactions commit.
- Failures in third-party services (FCM delivery timeout, Firebase downtime) are caught, logged, and isolated — they **never** roll back committed financial transactions or core business entities.

### 2.6 Server-Side RBAC & IDOR Defense
- Client-supplied identity claims are never trusted blindly.
- Resource ownership is strictly checked against the authenticated user ID (`req.user.id`).
- Admin endpoints require active status, token validity, and explicit server-side permission resolution via `requirePermission` middleware.
- Owner role (`isOwner: true` or `*` permission) maintains authoritative bypass capabilities.
