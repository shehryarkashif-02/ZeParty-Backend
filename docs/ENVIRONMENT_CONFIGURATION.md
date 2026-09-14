# ZeParty Backend — Environment Configuration Guide

## 1. Overview & Validation Rules
The ZeParty backend strictly validates all environment variables at startup using `Zod` in `src/config/env.js`. If any required configuration is missing or malformed, the process logs structured validation errors and exits immediately (`process.exit(1)`).

---

## 2. Environment Variables Specification

| Variable Name | Type / Format | Default | Required in Production | Description |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | `enum('development','production','test')` | `development` | Yes | Application execution environment |
| `PORT` | `number` | `5000` | No | HTTP server port |
| `DATABASE_URL` | `postgresql://...` URL | None | **Yes** | Authoritative PostgreSQL connection string |
| `REDIS_URL` | `redis://...` URL | None | **Yes** | Ephemeral Redis cache and PubSub connection URL |
| `CORS_ORIGIN` | `string` (comma-separated or single) | `http://localhost:5173` | **Yes** | Allowed CORS origins for Admin Portal & Web App |
| `JWT_SECRET` | `string (min: 16 chars)` | `super-secret-...` | **Yes (Override)** | Master secret for JWT signing and verification |
| `JWT_EXPIRES_IN` | `string` | `15m` | No | Short-lived access token expiration duration |
| `REFRESH_TOKEN_EXPIRES_IN` | `string` | `7d` | No | Refresh token validity window |
| `OTP_PROVIDER` | `enum('mock','twilio','aws_sns')` | `mock` | **Yes (`twilio`/`aws_sns`)** | SMS OTP provider for user authentication |
| `OTP_EXPIRY_SECONDS` | `number` | `300` | No | OTP expiration window (5 minutes) |
| `OTP_MAX_ATTEMPTS` | `number` | `5` | No | Maximum incorrect OTP verification attempts before lockout |
| `OTP_RATE_LIMIT_MAX` | `number` | `5` | No | Maximum OTP request limit per phone number per window |
| `PAYMENT_ENCRYPTION_KEY` | `string (min: 16 chars)` | `zeparty-payment-...` | **Yes (Override)** | AES-256 key for securing payment transaction tokens |
| `OTP_ENCRYPTION_KEY` | `string (min: 16 chars)` | `zeparty-otp-...` | **Yes (Override)** | Key for encrypting OTP codes at rest in Redis/Postgres |
| `AGORA_APP_ID` | `string (32 hex chars)` | Mock ID | **Yes** | Agora RTC Application ID for live audio/video |
| `AGORA_APP_CERTIFICATE` | `string (32 hex chars)` | Mock Cert | **Yes** | Agora Application Certificate for token generation |
| `AGORA_TOKEN_EXPIRY_SECONDS` | `number (60 - 86400)` | `3600` | No | Agora RTC token TTL in seconds |
| `AGORA_MOCK_MODE` | `boolean` | `false` | No | Set `true` in CI/test environments to bypass Agora RTC builder |
| `SOCKET_CORS_ORIGIN` | `string` | `http://localhost:5173` | **Yes** | Allowed origins for Socket.IO realtime connection |
| `SOCKET_REDIS_ENABLED` | `boolean` | `true` | No | Enables Redis adapter for multi-instance Socket.IO clustering |

---

## 3. Production Deployment Checklist
1. **Secrets Management**: Replace default `JWT_SECRET`, `PAYMENT_ENCRYPTION_KEY`, and `OTP_ENCRYPTION_KEY` with high-entropy cryptographic strings (>= 64 hex characters).
2. **Database Pooling**: Ensure `DATABASE_URL` contains `connection_limit=20&pool_timeout=10` or uses an external connection pooler (e.g. PgBouncer / Supabase Pooler).
3. **Redis Sizing**: Ensure Redis instance supports high-frequency key expiry (`volatile-ttl`) for seat presence and rate-limiting.
4. **CORS Configuration**: Restrict `CORS_ORIGIN` and `SOCKET_CORS_ORIGIN` to official production web app and admin portal domains.
5. **Agora Credentials**: Configure real Agora App ID and Certificate in Agora Console; ensure token expiry is tuned to room session lengths.
