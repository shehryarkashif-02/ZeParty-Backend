# ZeParty — Full Codebase Audit Report

## 1. Executive Summary
This document represents the Phase 1 Codebase Audit of the **ZeParty** monorepo repository (`d:\PROJECTS\Ze-Party`). The repository houses three core software pillars:
1. **React 19 Admin Frontend** (`Admin Frontend/`)
2. **Flutter Mobile Application** (`mobile app/`)
3. **Shared Node.js + Express.js Backend** (`backend/`)

The goal of the audit is to inspect every file, module, state provider, mock store, and route across all three pillars to establish an implementation-ready blueprint for the single, shared production backend.

---

## 2. Shared Backend Inspection (`backend/`)

### Infrastructure & Core Packages
* **Runtime**: Node.js ES Modules (`"type": "module"` in `package.json`).
* **Framework**: Express.js `^4.19.2`.
* **Database ORM**: Prisma `^6.0.0` configured for PostgreSQL (`DATABASE_URL`). Schema exists at `prisma/schema.prisma` currently hosting `SystemInitCheck` table.
* **In-Memory Store / Caching**: Redis `^4.6.14` configured in `src/config/redis.js`.
* **Logging**: Pino HTTP logger (`pino: ^9.1.0`, `pino-http: ^10.1.0`) with sensitive key redaction for authorization headers, passwords, tokens, and OTPs.
* **Security & Middleware**: Helmet `^7.1.0` for HTTP headers, CORS `cors: ^2.8.5` configured for dynamic environment origins, and body parsers with 10MB limits.
* **Validation**: Zod `^3.23.8`.
* **Health Endpoints**:
  * `GET /api/health/ping` — Process ping returning 200 OK.
  * `GET /api/health` — Complete status check querying PostgreSQL via Prisma `SELECT 1` and Redis `PING`.

### Folder Audit & Current Status
| Folder Path | Current Contents | Implementation Status |
| :--- | :--- | :--- |
| `backend/prisma/` | `schema.prisma` | Initialized (PostgreSQL provider, `SystemInitCheck` model). Needs full entity expansion. |
| `backend/src/config/` | `database.js`, `env.js`, `redis.js` | Fully implemented (Prisma singleton, Redis client, dotenv environment validation). |
| `backend/src/constants/` | `.gitkeep` | Empty placeholder. |
| `backend/src/controllers/` | `.gitkeep` | Empty placeholder. |
| `backend/src/jobs/` | `.gitkeep` | Empty placeholder. |
| `backend/src/middlewares/` | `.gitkeep` | Empty placeholder. |
| `backend/src/models/` | `.gitkeep` | Empty placeholder. |
| `backend/src/repositories/`| `.gitkeep` | Empty placeholder. |
| `backend/src/routes/` | `index.js` | Initialized (`/health`, `/health/ping`). Needs router modules. |
| `backend/src/services/` | `.gitkeep` | Empty placeholder. |
| `backend/src/sockets/` | `.gitkeep` | Empty placeholder. |
| `backend/src/utils/` | `.gitkeep` | Empty placeholder. |
| `backend/src/validators/` | `.gitkeep` | Empty placeholder. |
| `backend/src/app.js` | `app.js` | Fully implemented (Express setup, Helmet, CORS, Pino HTTP, error handlers). |
| `backend/src/server.js` | `server.js` | Fully implemented (HTTP server listener, database connect, Redis connect, SIGTERM/SIGINT graceful shutdown). |

---

## 3. Admin Frontend Audit (`Admin Frontend/`)

### Core Architecture & State Management
* **Framework**: React `19.2.8` built with Vite `8.2.0` and Tailwind CSS V4.
* **Routing**: React Router DOM `^7.18.2` managing 59 administrative views.
* **Authentication Context**: `AuthContext.jsx` manages session rehydration via `localStorage` (`zeparty_admin_session`) and admin login/logout state.
* **RBAC Permission Context**: `PermissionContext.jsx` enforces 61 granular permissions (`MODULE_PERMISSIONS` in `teamsRoles.mock.js`) across 7 pre-configured admin roles (`super_admin`, `finance_admin`, `host_admin`, `agency_admin`, `moderator`, `content_admin`, `support_admin`).
* **Audit Log Context**: `AuditLogContext.jsx` logs write operations executed by administrators.
* **HTTP Service Layer**: Axios client configured in `src/services/api.js` with Bearer token interceptors and global 401 handling.

### Admin Module Inventory & Backend Dependencies
All 59 admin pages currently rely on local mock datasets (`src/mocks/`) and mock service wrappers (`src/services/modules/`). Every module requires real REST API endpoints, RBAC checks, audit logging, and where applicable, two-stage approval workflows (`AdminApproval`).

---

## 4. Flutter Mobile App Audit (`mobile app/`)

### Core Architecture & State Management
* **Framework**: Flutter SDK with Dart `^3.12.2`.
* **State Management**: Provider (`^6.1.5+1`) with **21 feature providers** coordinating UI logic (`lib/providers/`).
* **Streaming & RTC**: `agora_rtc_engine: ^6.5.4` integrated via `AgoraRtcService` (`lib/core/services/agora_rtc_service.dart`).
* **Media Controls**: `camera: ^0.11.1`, `image_picker: ^1.1.2`, `video_player: ^2.9.2`, `record: ^7.1.1`.
* **Local Repositories**:
  * `BackendRepository` (`lib/core/repositories/backend_repository.dart`): In-memory store for short videos, chat, user profiles, and notifications.
  * `LocalPartyRepository` (`lib/core/repositories/local_party_repository.dart`): Simulated WebSockets stream and 8-seat audio room state.
  * `WalletRepository` (`lib/core/repositories/wallet_repository.dart`): Simulated coin/diamond balances, spending, and cashouts.
  * `DummyData` (`lib/core/constants/dummy_data.dart`): Static dataset simulating users, gifts, rooms, and outfits.

### Network Client Gap
* The mobile app currently lacks an HTTP client dependency (such as `dio` or `http`) in `pubspec.yaml`. All network interfaces are simulated in-memory.

---

## 5. Architectural Gap Summary

1. **Database Schema Gap**: Prisma schema needs model definitions for all entities mapped across Admin Frontend and Mobile App.
2. **REST API Gap**: Express route controllers must be created to replace frontend mock services.
3. **Real-time WebSockets Gap**: Socket.IO server must be integrated into `backend/src/sockets/` for live seat states, gifting broadcasts, and chat.
4. **Security & RBAC Gap**: Backend must independently validate JWT tokens, permission scopes, and admin roles.
5. **Mobile Network Client Gap**: `dio` or `http` must be added to Flutter's `pubspec.yaml` to connect providers to the backend APIs.
