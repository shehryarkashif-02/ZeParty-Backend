# ZeParty Flutter Mobile App — Feature-to-API Mapping Blueprint

## 1. Overview
This blueprint maps every Flutter feature module (`mobile app/lib/features/`), Provider (`lib/providers/`), and simulated repository (`lib/core/repositories/`) to its corresponding REST API endpoints, WebSockets events, database entities, and native integrations (Agora RTC / FCM).

---

## 2. Flutter Feature Module Mapping Inventory (29 Modules)

| Mobile Feature Module | Flutter Provider Class | Current Simulated Data Source | Future REST API Endpoint | Real-time WebSockets / Agora Requirements | Prisma DB Entity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`auth/`** | `AuthProvider` | Local storage mock check | `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/otp/send` | None | `User`, `OTPVerification`, `UserDevice` |
| **`home/`** | `LiveProvider` | `dummy_data.dart` | `GET /api/rooms/trending`, `GET /api/banners/active` | `room_list_update` | `Room`, `Asset` |
| **`explore/`** | `RegionProvider` | Hard-coded country list | `GET /api/rooms?region=XYZ` | None | `Room` |
| **`search/`** | `LiveProvider` | Local filter array | `GET /api/search?q=query` | None | `User`, `Room` |
| **`live/`** | `LiveProvider` | `LocalPartyRepository` | `POST /api/rooms`, `GET /api/rooms/:id` | **Agora RTC Video Channel**, `room_chat_message` | `Room`, `User`, `GiftTransaction` |
| **`party_room/`** | `LivePartyProvider` | `LocalPartyRepository` (Simulated 8 seats) | `GET /api/rooms/:id/seats`, `POST /api/rooms/:id/seats/join` | **Agora RTC Audio**, `seat_state_change`, `mic_status_change` | `Room`, `RoomSeat`, `User` |
| **`pk_battle/`** | `LivePartyProvider` | Simulated 5-min timer | `GET /api/pk/active/:roomId` | `pk_score_update`, `pk_timer_sync` | `PKEvent`, `Room` |
| **`messages/`** | `MessagingProvider` | `BackendRepository` | `GET /api/messages/conversations`, `POST /api/messages/send` | `direct_message_received` | `Conversation`, `Message` |
| **`wallet/`** | `WalletProvider` | `WalletRepository` ($45K coins dev) | `GET /api/wallet/balance`, `GET /api/wallet/transactions` | `wallet_balance_updated` | `Wallet`, `WalletLedger` |
| **`recharge/`** | `CumulativeRechargeProvider` | Simulated recharge callback | `GET /api/recharge/plans`, `POST /api/recharge/offline` | `recharge_approved_notification` | `RechargePlan`, `OfflineRecharge`, `OnlineRecharge` |
| **`withdrawal/`** | `WalletProvider` | Local array append | `POST /api/withdrawals` | `withdrawal_status_updated` | `WithdrawalRequest`, `WalletLedger` |
| **`coin_marketplace/`**| `SellerProvider` | Simulated local escrow locks | `GET /api/p2p/orders`, `POST /api/p2p/orders/lock` | `p2p_escrow_status_change` | `P2PEscrowOrder`, `CoinSeller` |
| **`seller/`** | `SellerProvider` | Local balance math | `GET /api/sellers/dashboard` | None | `CoinSeller`, `WalletLedger` |
| **`bd_center/`** | `BDCenterProvider` | In-memory 5-tier salary scale | `GET /api/bd-centers/my-performance` | None | `BDCenter`, `BDInvite`, `Agency` |
| **`agency/`** | `HostAgencyProvider` | In-memory agency list | `GET /api/agencies/my-agency` | None | `Agency`, `AgencyMember`, `HostProfile` |
| **`host/`** | `HostAgencyProvider` | Local application state | `POST /api/hosts/apply`, `GET /api/hosts/my-stats` | None | `HostProfile`, `HostApplication` |
| **`games/`** | `GameProvider` | Simulated spin / rocket timer | `GET /api/games/config`, `POST /api/games/play` | `game_round_started`, `game_multipliers_tick` | `Game`, `GameConfig`, `GameRound` |
| **`vip/`** | `VipProvider` | Hard-coded perks | `GET /api/store/vip`, `POST /api/store/vip/subscribe` | `vip_badge_equipped` | `Asset`, `UserAsset` |
| **`svip/`** | `SvipProvider` | In-memory 12-tier ride array | `GET /api/store/svip` | `svip_entrance_broadcast` | `Asset`, `UserAsset` |
| **`aristocracy/`**| `NobleProvider` | In-memory noble titles | `GET /api/store/noble` | `noble_banner_broadcast` | `Asset`, `UserAsset` |
| **`store/`** | `StoreProvider` | Local virtual items array | `GET /api/store/catalog`, `POST /api/store/buy` | None | `Asset`, `UserAsset` |
| **`leaderboard/`**| `LiveProvider` | `dummy_data.dart` top list | `GET /api/leaderboards?period=daily` | `leaderboard_rank_change` | `User`, `HostProfile` |
| **`rewards/`** | `MysteryProvider` | Local claim toggle | `POST /api/rewards/checkin` | None | `WalletLedger` |
| **`notifications/`**| `NotificationProvider` | `BackendRepository` | `GET /api/notifications` | **FCM Push Notification** | `Notification` |
| **`social/`** | `SocialProvider` | Local post cards array | `GET /api/social/posts`, `POST /api/social/posts` | `post_liked` | `Post`, `Comment` |
| **`calls/`** | `CallProvider` | Local RTC wrapper | `POST /api/calls/initiate` | **Agora RTC 1-on-1 Audio/Video Call** | `User` |
| **`settings/`** | `AuthProvider` | SharedPreferences key-value | `GET /api/users/me/settings`, `PUT /api/users/me` | None | `User`, `UserDevice` |
| **`admin/`** | `AuthProvider` | Local flag check | `GET /api/admin/mobile-access` | None | `Admin` |

---

## 3. Simulated Repository Replacement Blueprint

1. **`lib/core/repositories/backend_repository.dart`**: Replace in-memory array data structures with `ApiBackendRepository` calling `/api/social/posts`, `/api/notifications`, and `/api/messages`.
2. **`lib/core/repositories/local_party_repository.dart`**: Replace simulated WebSockets timers with `SocketPartyRepository` listening to Socket.IO room events (`seat_state_change`, `gift_broadcast`, `mic_muted`).
3. **`lib/core/repositories/wallet_repository.dart`**: Replace `LocalWalletRepository` (45,000 coins dev hardcode) with `ApiWalletRepository` consuming `/api/wallet/balance` and `/api/wallet/transactions`.
