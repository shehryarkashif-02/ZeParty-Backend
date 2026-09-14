# ZeParty Real-Time Architecture Specification (Socket.IO, Redis, Agora RTC)

## 1. Overview
ZeParty requires sub-second real-time communication for live audio/video streaming, 8-seat party room coordination, microphone locking/muting, real-time virtual gifting broadcasts, instant messaging, and inter-room PK battle countdown timers. 

The real-time layer utilizes three complementary technologies:
1. **Socket.IO**: Real-time bidirectional WebSockets event server (`backend/src/sockets/`).
2. **Redis In-Memory Store**: Pub/Sub message broker and ephemeral room state cache (`backend/src/config/redis.js`).
3. **Agora RTC Engine**: Real-time audio/video streaming media server using secure backend token generation.

---

## 2. Real-Time Topology & Event Flow

```text
[Flutter Mobile Client A]              [Backend Socket.IO Gateway]             [Flutter Mobile Client B]
          │                                        │                                       │
          ├─── emit("join_room", roomId) ─────────►│                                       │
          │                                        ├─── Redis: HSET room:123 viewers ─────┤
          │                                        │                                       │
          ├─── emit("send_gift", payload) ────────►│                                       │
          │                                        ├─── Execute Prisma Gifting Split ──────┤
          │                                        │                                       │
          │◄── broadcast("gift_received") ─────────┴──────────────────────────────────────►│
```

---

## 3. WebSockets Event Blueprint

### A. Room & Seat State Events (`/sockets/room.socket.js`)
* `join_room` / `leave_room`: Manages active room participant connection list in Redis (`SCARD room:123:viewers`).
* `seat_request`: Mobile user requests 1 of 8 micro-seats in audio party room.
* `seat_state_change`: Server broadcasts updated seat assignments to all room viewers.
* `mic_status_change`: Mutes or unlocks microphone seat.

### B. Virtual Gifting Events (`/sockets/gift.socket.js`)
* `send_gift`: Mobile user sends virtual gift.
* `gift_received`: Broadcasts animated gift payload (SVGA URL, sender name, recipient name, gift count) to room viewers.
* `global_marquee_gift`: Broadcasts marquee banner alert across all active platform rooms for high-value luxury gifts (> 50,000 coins).

### C. Inter-Room PK Battle Events (`/sockets/pk.socket.js`)
* `pk_start`: Initiates 5-minute PK battle between Room A and Room B.
* `pk_score_update`: Pushes real-time score updates to both rooms as gifts are received by Host A or Host B.
* `pk_ended`: Synchronizes final match results and declares winner.

---

## 4. Secure Agora Token Generation Blueprint

> [!SECURITY]
> Agora App Credentials (`AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`) MUST NEVER be stored in the Flutter mobile application. The backend generates secure, temporary RTC tokens.

### Agora Token Endpoint: `POST /api/rooms/agora-token`
* **Request**: `{ roomId: "room_123", role: "publisher" | "subscriber" }`.
* **Backend Processing**:
  * Verifies user JWT bearer token.
  * Validates user permission to publish (checks if host or seated speaker in audio room).
  * Uses `@agora/rtctokenbuilder` (`RtcTokenBuilder.buildTokenWithUid`) to generate token with 24-hour expiration.
* **Response**: `{ token: "0069a7c...", channelName: "room_123", uid: 45892 }`.
