# ZeParty Backend — Ordered Implementation Roadmap (Phases 0–15)

## 1. Overview & Phased Execution Strategy

This document outlines the ordered implementation roadmap for transitioning **ZeParty** from Phase 1 (Audit & Architecture Blueprint) to full production launch. Each phase depends logically on preceding foundations (e.g., Database ORM $\rightarrow$ Auth $\rightarrow$ RBAC $\rightarrow$ Wallet Ledger $\rightarrow$ APIs $\rightarrow$ Frontend/Mobile Integration).

---

## 2. Master Implementation Phasing Table

| Phase | Phase Title | Objectives & Deliverables | Core Dependencies | Verification Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | Existing Codebase Audit | Initial repository audit and folder exploration. | Monorepo structure | Completed |
| **Phase 1** | Architecture & Contracts Blueprint | Deep code inspection and 13 technical blueprint documents in `backend/docs/`. | Phase 0 audit | Approved Phase 1 Deliverables |
| **Phase 2** | Database & Schema Foundation | Expand `schema.prisma` with 40+ models (`User`, `Wallet`, `Room`, `Gift`, etc.) and run Prisma migrations. | Phase 1 schema blueprint | Prisma Client generated & test DB connection OK |
| **Phase 3** | Authentication & User Management | Implement JWT auth, bcrypt password hashing, SMS OTP verification, and user profile APIs (`/api/auth`, `/api/users`). | Phase 2 database | Unit tests pass for login, OTP, and JWT validation |
| **Phase 4** | RBAC & Permissions Enforcement | Implement 73-permission RBAC middleware (`requirePermission`), role assignments, and admin management (`/api/admin/roles`). | Phase 3 authentication | Admin role guards block unauthorized access |
| **Phase 5** | Wallet, Immutable Ledger & Approval Engine | Implement `WalletLedger`, atomic transaction processing, two-stage approval workflow (`AdminApproval`), and `/api/wallet` endpoints. | Phase 4 RBAC | Double-entry ledger math verifies zero variance |
| **Phase 6** | Dynamic Policy Engine | Implement database-driven policy models (`Policy`, `PolicyVersion`) for hosts, agencies, resellers, and 15-day auto-restore cron jobs. | Phase 5 financial core | Policy updates dynamically reflect in calculations |
| **Phase 7** | Hosts, Agencies, BD & Merchants | Implement Live Host & Audio Host applications, agency networks, BD Centers salary projections, and reseller allocations. | Phase 6 policies | Host applications & BD tier projections functional |
| **Phase 8** | Dynamic Assets, Gifts & Store Catalog | Implement virtual gift catalog, SVGA dynamic asset schema, VIP/SVIP/Noble stores, and `/api/gifts`, `/api/store` endpoints. | Phase 5 wallet ledger | Gift catalog returns assets with SVGA URLs |
| **Phase 9** | Recharge, Withdrawals & Finance | Implement online payment gateway webhooks (Stripe/PayPal), offline bank slip approvals, host cashouts, and finance APIs. | Phase 8 gifts & wallet | Bank recharge approval credits coins & logs audit |
| **Phase 10**| Rooms, WebSockets, Agora & PK Battles | Implement Socket.IO WebSockets server, Redis room state cache, secure Agora RTC token generator (`/api/rooms/agora-token`), and PK timers. | Phase 8 dynamic assets | Socket.IO broadcasts gifting & seat changes |
| **Phase 11**| Mini-Games, Economy & Dynamic House Edge| Implement mini-games engine (Slots, Rocket, Wheel, Dice), Zod prize probability configuration, and dynamic House Edge calculation ($1 - \sum p_i \cdot payout_i$). | Phase 5 wallet ledger | House Edge recalculates dynamically on config change |
| **Phase 12**| Notifications, Social, Moderation & Support | Implement FCM push notification service, user post feeds, room moderation filters, user reports, and support ticket inbox. | Phase 3 auth & users | FCM notification pushes successfully to device |
| **Phase 13**| React Admin Frontend Integration | Connect Axios service modules in `Admin Frontend/src/services/` to Express controllers, replacing mock data. | Phase 2 to Phase 12 APIs | All 59 Admin Dashboard pages operate with backend |
| **Phase 14**| Flutter Mobile App Integration | Add `dio`/`http` to Flutter `pubspec.yaml`, connect 21 Providers to REST APIs and Socket.IO, replacing in-memory repositories. | Phase 13 Admin APIs | Mobile app streams, sends gifts & trades P2P via API |
| **Phase 15**| Security Audit, Load Testing & Production Launch | Perform security vulnerability scans, load test Socket.IO / Redis servers, setup production CI/CD, and launch backend. | Phase 14 Mobile integration | Zero high-severity vulnerabilities & pass load test |
