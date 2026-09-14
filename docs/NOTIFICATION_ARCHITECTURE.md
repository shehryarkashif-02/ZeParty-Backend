# ZeParty Backend — Phase 9: Notifications, FCM Push & Communication Delivery Architecture

## 1. Executive Summary

Phase 9 implements the authoritative **Notifications, FCM Push & Communication Delivery Infrastructure** in the ZeParty backend.

### Governing Architectural Tenets
1. **PostgreSQL is Authoritative**: Durable notification history, unread counters, and read/unread state are maintained in PostgreSQL. Push notifications are delivery channels, not data stores.
2. **Zero Coupled Failures**: Asynchronous push delivery (FCM) and network latency never block, corrupt, or roll back committed financial/social business transactions (e.g. gift sending, following, ticket replies).
3. **Multi-Device Registration**: Each user can register multiple active devices (`Android`, `iOS`, `Web`) with token refresh and automatic cleanup of invalid/unregistered tokens.
4. **Server-Authoritative Preferences**: User category notification preferences (`social`, `live`, `pk`, `games`, `events`, `finance`, `moderation`, `support`, `marketing`, `system`) are checked server-side before persisting or dispatching notifications.
5. **Audience Segmentation & Admin Broadcasts**: Target audience resolution (`All Users`, `Active Users`, `VIP Users`, `Hosts Only`, `Selected Users`) is strictly executed on the server and guarded by RBAC permissions (`view_notifications`, `manage_notifications`).
6. **Realtime Socket.IO Integration**: Connected mobile clients receive immediate in-app alerts via `user:<userId>` socket rooms (`notification:new`, `notification:read`, `notification:read_all`).

---

## 2. Notification Pipeline Flow

```text
[ Business Domain Event (Gift, Follow, PK, Settlement, Support) ]
                     │
                     ▼
          [ Database Transaction Commits ]
                     │
                     ▼
      [ notificationService.sendNotification ]
                     │
                     ├── 1. Check User Notification Preferences
                     ├── 2. Idempotency Check (sourceType + sourceId)
                     ├── 3. Persist Notification to PostgreSQL
                     │
                     ├── 4. Socket.IO Realtime Dispatch (user:<userId>)
                     │      └── Event: notification:new
                     │
                     └── 5. Asynchronous FCM Push Dispatch
                            ├── Lookup Active Device Tokens (userDevice)
                            ├── Multicast via FCMAdapter (sendMulticast)
                            └── Auto-cleanup of Invalid / Expired Tokens
```

---

## 3. Database Schema Architecture

```prisma
model UserDevice {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceToken String?
  platform    String   // "android", "ios", "web"
  macAddress  String?
  deviceModel String?
  appVersion  String?
  isActive    Boolean  @default(true)
  isBlocked   Boolean  @default(false)
  lastSeenAt  DateTime @default(now())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, deviceToken])
  @@index([userId, isActive])
  @@index([deviceToken])
}

model NotificationPreference {
  id         String   @id @default(uuid())
  userId     String   @unique
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  social     Boolean  @default(true)
  live       Boolean  @default(true)
  pk         Boolean  @default(true)
  games      Boolean  @default(true)
  events     Boolean  @default(true)
  finance    Boolean  @default(true)
  moderation Boolean  @default(true)
  support    Boolean  @default(true)
  marketing  Boolean  @default(true)
  system     Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([userId])
}

model Notification {
  id             String    @id @default(uuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  title          String
  body           String
  type           String    // "SYSTEM", "SOCIAL", "GIFT", "PK", "LIVE", "FINANCE", "MODERATION", "SUPPORT", "MARKETING"
  category       String?   // "Follower", "Gift", "Invitation", "Call", "Recharge", "System", etc.
  dataJson       Json?     // Deep link and entity payload
  sourceType     String?   // "POST", "ROOM", "TRANSACTION", "TICKET", "REPORT", "CAMPAIGN"
  sourceId       String?   // Underlying entity ID
  isRead         Boolean   @default(false)
  readAt         DateTime?
  deliveryStatus String    @default("DELIVERED") // "PENDING", "DELIVERED", "FAILED", "SIMULATED"
  createdAt      DateTime  @default(now())

  @@index([userId, isRead, createdAt(sort: Desc)])
  @@index([userId, type])
  @@index([sourceType, sourceId])
}

model NotificationBroadcast {
  id             String   @id @default(uuid())
  adminId        String?
  admin          Admin?   @relation("AdminNotificationBroadcasts", fields: [adminId], references: [id])
  title          String
  body           String
  type           String   @default("Push") // "Push", "Promotional", "Transactional"
  audience       String   @default("All Users") // "All Users", "Active Users", "VIP Users", "Hosts Only"
  recipientCount Int      @default(0)
  status         String   @default("SENT") // "DRAFT", "SCHEDULED", "SENDING", "SENT", "FAILED", "CANCELLED"
  metadataJson   Json?
  sentAt         DateTime @default(now())
  createdAt      DateTime @default(now())

  @@index([adminId])
  @@index([status, createdAt(sort: Desc)])
}
```

---

## 4. API Endpoints

### 4.1 Mobile Client Endpoints (`/api/v1/notifications`)
- `POST /devices` — Register active device token.
- `POST /devices/refresh` — Refresh FCM token.
- `DELETE /devices/:id` — Unregister device (IDOR protected).
- `GET /preferences` — View notification category preferences.
- `PUT /preferences` — Update notification preferences.
- `GET /` — List notification history (cursor pagination).
- `GET /unread-count` — Authoritative unread count.
- `PATCH /:id/read` — Mark notification as read.
- `PATCH /read-all` — Mark all notifications as read.
- `DELETE /:id` — Delete notification record.

### 4.2 Admin Portal Endpoints (`/api/v1/admin/notifications`)
- `GET /` — List broadcast campaigns (`view_notifications`).
- `POST /broadcast` — Send broadcast campaign (`manage_notifications`).
- `GET /:id` — Get campaign details (`view_notifications`).

---

## 5. Security & IDOR Defenses
1. All consumer routes derive `userId` strictly from authenticated JWT (`req.auth.userId`).
2. Device unregistration and notification state updates verify ownership before mutating database state.
3. Tokens are marked inactive and cleaned up when Firebase returns unregistered token codes (`messaging/registration-token-not-registered`).
4. Sensitive secrets (wallet balances, passwords, OTPs) are prohibited in push notification payloads.
