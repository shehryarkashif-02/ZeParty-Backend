# ZeParty — Realtime Socket.IO Integration Contract

## 1. Overview & Architecture
ZeParty uses Socket.IO for realtime bidirectional event streaming across live rooms, social interactions, notifications, customer support, and administrative moderation.

- **Authoritative Database**: PostgreSQL (Prisma ORM) is the single source of truth.
- **Ephemeral State**: Redis is used for ephemeral seat presence and Socket.IO adapter scaling (`@socket.io/redis-adapter`).
- **Post-Commit Emission Rule**: All socket events are emitted strictly AFTER database transactions successfully commit. Socket delivery failures never roll back committed state.

---

## 2. Authentication & Connection Lifecycle
- **Endpoint**: `/socket.io/`
- **Transport**: `websocket`, `polling` (fallback)
- **Handshake Auth**:
  ```json
  {
    "auth": {
      "token": "<jwt_access_token>"
    }
  }
  ```
- **Connection Security**:
  - Handshake verifies JWT signature using `JWT_SECRET`.
  - User status is verified (`ACTIVE`). Suspended or banned users are rejected with `ACCOUNT_RESTRICTED`.
  - Authenticated socket is joined to user-specific private namespace: `user:<userId>`.

---

## 3. Namespace & Room Topology
| Room Pattern | Purpose | Join / Leave Trigger |
| :--- | :--- | :--- |
| `user:<userId>` | Private user room (notifications, moderation, balance) | Auto-joined upon successful socket connection |
| `room:<roomId>` | Public live voice/video room (seats, gifts, chat, viewer count) | Client emits `room:join` / `room:leave` |
| `ticket:<ticketId>` | Support ticket live message updates | Joined by ticket owner and assigned admin |
| `global` | Platform-wide broadcasts (announcements, banners) | Auto-joined on connect |

---

## 4. Socket.IO Event Specification

### 4.1 Live Room Events (`room:<roomId>`)
| Event Name | Direction | Payload Contract | Description |
| :--- | :--- | :--- | :--- |
| `room:join` | Client -> Server | `{ "roomId": "string", "password": "string|null" }` | Request to join room stream |
| `room:leave` | Client -> Server | `{ "roomId": "string" }` | Request to leave room stream |
| `room:user_joined` | Server -> Room | `{ "roomId": "string", "userId": "string", "user": { ... } }` | Broadcast when new viewer joins |
| `room:user_left` | Server -> Room | `{ "roomId": "string", "userId": "string" }` | Broadcast when viewer leaves |
| `room:seat_occupied` | Server -> Room | `{ "roomId": "string", "seatIndex": number, "userId": "string", "user": { ... } }` | Broadcast when user takes seat |
| `room:seat_released` | Server -> Room | `{ "roomId": "string", "seatIndex": number, "userId": "string" }` | Broadcast when user leaves or kicked from seat |
| `room:seat_muted` | Server -> Room | `{ "roomId": "string", "seatIndex": number, "isMuted": boolean }` | Host/moderator mutes seat audio |
| `room:gift_sent` | Server -> Room | `{ "roomId": "string", "senderId": "string", "recipientId": "string", "giftId": "string", "quantity": number, "totalCoins": number, "transactionId": "string" }` | Realtime gift animation broadcast |
| `room:viewer_count` | Server -> Room | `{ "roomId": "string", "viewerCount": number }` | Realtime room audience count update |
| `room:closed` | Server -> Room | `{ "roomId": "string", "closedAt": "ISO8601" }` | Host closes live stream |

### 4.2 Social Events (`user:<userId>` / `global`)
| Event Name | Direction | Room | Payload Contract | Description |
| :--- | :--- | :--- | :--- | :--- |
| `post:created` | Server -> Global | `global` | `{ "postId": "string", "authorId": "string", "visibility": "PUBLIC" }` | Public feed live post update |
| `post:liked` | Server -> User | `user:<postAuthorId>` | `{ "postId": "string", "likerId": "string", "totalLikes": number }` | Author receives like realtime notification |
| `post:deleted` | Server -> Global | `global` | `{ "postId": "string" }` | Realtime removal of deleted/moderated post |
| `follow:created` | Server -> User | `user:<targetUserId>` | `{ "followerId": "string", "followerName": "string" }` | Realtime follower notification |

### 4.3 Notification Events (`user:<userId>`)
| Event Name | Direction | Room | Payload Contract | Description |
| :--- | :--- | :--- | :--- | :--- |
| `notification:new` | Server -> User | `user:<userId>` | `{ "id": "string", "title": "string", "body": "string", "type": "string", "category": "string", "data": {}, "isRead": false, "createdAt": "ISO8601" }` | Instant notification delivery to active device |

### 4.4 Financial Events (`user:<userId>`)
| Event Name | Direction | Room | Payload Contract | Description |
| :--- | :--- | :--- | :--- | :--- |
| `wallet:balance_updated` | Server -> User | `user:<userId>` | `{ "coinBalance": "string", "diamondBalance": "string" }` | Instant wallet balance sync |
| `settlement:paid` | Server -> User | `user:<userId>` | `{ "settlementId": "string", "amountUSD": "string", "paidAt": "ISO8601" }` | Agency/Host settlement notification |

### 4.5 Support Ticket Events (`ticket:<ticketId>` / `user:<userId>`)
| Event Name | Direction | Room | Payload Contract | Description |
| :--- | :--- | :--- | :--- | :--- |
| `ticket:message` | Server -> Ticket | `ticket:<ticketId>` | `{ "ticketId": "string", "messageId": "string", "senderType": "USER\|ADMIN", "content": "string", "createdAt": "ISO8601" }` | Realtime support conversation thread |
| `ticket:status_changed` | Server -> User | `user:<ticketOwnerId>` | `{ "ticketId": "string", "status": "RESOLVED\|CLOSED", "updatedAt": "ISO8601" }` | Support ticket state transition alert |

### 4.6 Moderation & Restriction Events (`user:<userId>`)
| Event Name | Direction | Room | Payload Contract | Description |
| :--- | :--- | :--- | :--- | :--- |
| `moderation:action` | Server -> User | `user:<userId>` | `{ "action": "BAN\|SUSPEND\|MUTE", "reason": "string", "expiresAt": "ISO8601\|null" }` | Enforces client-side immediate disconnection or restricted UI |
