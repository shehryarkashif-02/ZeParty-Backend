# ZeParty Backend — Keep vs Modify vs Rebuild Analysis

## 1. Overview & Strategy

This document provides a strict component-by-component classification of the existing `backend/` codebase. The core principle of Phase 1 is **preservation of useful infrastructure**. Components that are correctly implemented will be **KEPT**, partially implemented infrastructure will be **MODIFIED**, and incomplete mock/placeholder layers will be **REBUILT** with production implementations.

---

## 2. Infrastructure Component Assessment Table

| Existing Backend Component | Current Path | Current Condition | Classification | Technical Rationale | Future Action / Replacement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Express Application Core** | `src/app.js` | Fully configured with Helmet, CORS, body parsers, Pino HTTP, 404, and global error handlers. | **KEEP** | Standard Express configuration adhering to Node.js best practices. | Retain as master application setup. Add route modules as they are created. |
| **Server Listener & Graceful Shutdown** | `src/server.js` | Implements process startup, Prisma connection, Redis connection, and graceful shutdown handlers for SIGINT/SIGTERM. | **KEEP** | Production-ready process lifecycle and connection management. | Retain as entry point (`npm start` / `npm run dev`). |
| **Environment Configuration** | `src/config/env.js`, `.env`, `.env.example` | Centralized environment variable validation using Dotenv. | **KEEP + MODIFY** | Clean configuration pattern. Needs additional environment variables for JWT secrets, Agora credentials, FCM keys, and S3 storage. | Add `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, `AWS_S3_BUCKET`, etc. |
| **Database ORM Setup** | `src/config/database.js`, `prisma/schema.prisma` | Singleton Prisma client configured with PostgreSQL provider (`DATABASE_URL`). Schema contains `SystemInitCheck`. | **KEEP + MODIFY** | Database connection baseline is solid. Schema needs complete entity models definition. | Retain client singleton. Expand `schema.prisma` with 40+ production models and execute migrations. |
| **Redis In-Memory Store Client** | `src/config/redis.js` | Redis client initialization and event logging (`error`, `connect`). | **KEEP** | Clean async Redis client initialization. | Retain as shared caching & real-time pub/sub client. |
| **Pino Request Logger** | `src/app.js` (Pino HTTP middleware) | Configured with log level rules and key redaction for authorization, passwords, tokens, and OTPs. | **KEEP** | Essential security and diagnostic logging. | Retain as primary HTTP request logger. |
| **Security (Helmet & CORS)** | `src/app.js` | Helmet headers and environment-controlled CORS origins configured. | **KEEP** | Provides core security headers and cross-origin access control. | Retain security middlewares. |
| **API Router & Health Check** | `src/routes/index.js` | Implements `/health/ping` and comprehensive `/health` checking PostgreSQL and Redis connection status. | **KEEP + MODIFY** | Excellent health monitoring. Needs registration of modular route entry points (`/auth`, `/users`, `/wallet`, etc.). | Add sub-router mount points to `index.js`. |
| **Package Manifest & Dependencies** | `package.json` | Express, Prisma, Redis, Pino, Zod, Helmet, CORS, Nodemon configured. | **KEEP + MODIFY** | Stack matches specified technology requirements. Missing JWT and bcrypt packages. | Add `jsonwebtoken`, `bcryptjs`, `socket.io`, `@agora/rtctokenbuilder`. |
| **Route Controllers** | `src/controllers/` | Empty folder containing `.gitkeep`. | **REBUILD** | No business logic implemented yet. | Create modular controllers (`authController.js`, `userController.js`, `walletController.js`, etc.). |
| **Middlewares (Auth, RBAC, Approval)** | `src/middlewares/` | Empty folder containing `.gitkeep`. | **REBUILD** | Missing JWT authentication guards, permission checks, rate limiters, and approval interceptors. | Implement `authenticateToken.js`, `requirePermission.js`, `requireApproval.js`, `rateLimiter.js`. |
| **Data Models / Schemas** | `src/models/` | Empty folder containing `.gitkeep`. | **REBUILD** | Business entities exist only as mock arrays in frontend/mobile repos. | Define Prisma entity extensions, data mappers, and response transformers. |
| **Repositories / DAL** | `src/repositories/` | Empty folder containing `.gitkeep`. | **REBUILD** | Data access layer not implemented. | Create Prisma repository wrappers (`userRepository.js`, `walletRepository.js`, `roomRepository.js`). |
| **Services Layer** | `src/services/` | Empty folder containing `.gitkeep`. | **REBUILD** | Core business services (Agora token generation, transaction ledger processing, gifting splits) not implemented. | Implement `authService.js`, `agoraService.js`, `ledgerService.js`, `giftingService.js`, `approvalService.js`. |
| **WebSockets Handlers** | `src/sockets/` | Empty folder containing `.gitkeep`. | **REBUILD** | Real-time WebSockets event server not initialized. | Implement Socket.IO server handling room seats, chat messages, gift animations, and PK battle synchronization. |
| **Cron / Scheduled Jobs** | `src/jobs/` | Empty folder containing `.gitkeep`. | **REBUILD** | Scheduled background tasks (15-day policy auto-restoration, daily host target resets, leaderboard payouts) not implemented. | Implement cron jobs using `node-cron` or Bull queue schedulers. |
| **Validation Schemas** | `src/validators/` | Empty folder containing `.gitkeep`. | **REBUILD** | Request validation schemas not implemented. | Create Zod schemas for all API endpoint request bodies and parameters. |

---

## 3. Summary of Keep vs Rebuild Strategy

1. **Preserve (KEEP)**: Core Express server setup, process listener, graceful shutdown handlers, Redis client, Pino logger, Helmet, CORS, and Prisma client singleton.
2. **Expand (KEEP + MODIFY)**: Environment variables config, database schema file, API router entry point, and package dependencies.
3. **Build (REBUILD)**: Controllers, Services, Repositories, Middlewares, Sockets, Jobs, Validators, and Database Models.
