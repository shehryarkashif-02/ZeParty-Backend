# ZeParty Dynamic Asset Management Architecture Specification

## 1. Overview
The **ZeParty Dynamic Asset System** provides dynamic catalog management for virtual assets, animated SVGA gifts, video assets, audio sound effects, avatar frames, entrance bubbles, noble titles, and name colors.

---

## 2. Universal Asset Data Schema (`Asset` & `Gift`)

Every virtual item or gift in the database is defined with universal asset fields:

* **`id`**: Unique asset identifier.
* **`name`**: Display title (e.g., "Golden Dragon Entrance", "VIP 12 Crown Frame").
* **`assetCategory`**: `GIFT`, `FRAME`, `ENTRY_EFFECT`, `CHAT_BUBBLE`, `BADGE`, `VEHICLE`, `SOUND_EFFECT`.
* **`assetSubcategory`**: `STATIC`, `ANIMATED_SVGA`, `MP4_VIDEO`, `MP3_AUDIO`.
* **`thumbnailUrl`**: Static preview image URL.
* **`staticFileUrl`**: Static PNG/SVG asset URL.
* **`animationFileUrl`**: SVGA / Lottie animation file URL.
* **`videoFileUrl`**: High-resolution video file URL (for full-screen video gifts).
* **`audioFileUrl`**: Audio playback URL (MP3/WAV).
* **`durationSeconds`**: Animation / sound duration (e.g., 5.0 seconds).
* **`defaultVolumePercent`**: Audio volume level (0% to 100%).
* **`priceCoins`**: Purchasing price in user coins.
* **`coinValue`**: Gift coin value for financial split calculations.
* **`isFullScreen`**: Boolean flag indicating if gift triggers full-screen animation overlay.
* **`isComboSupported`**: Boolean flag allowing rapid multi-gift combos ($x2, x5, x100$).
* **`roomAvailability`**: `BOTH` (Live & Audio), `LIVE_ONLY` (Video streams), `AUDIO_ONLY` (Party rooms).
* **`minVipLevelRequired`**: VIP rank unlock constraint (0 to 12).
* **`minNobleRankRequired`**: Noble rank unlock constraint (`KNIGHT`, `BARON`, `VISCOUNT`, `EARL`, `MARQUIS`, `DUKE`, `KING`).
* **`status`**: `ACTIVE`, `DRAFT`, `DEPRECATED`.

---

## 3. Dynamic Asset Lifecycle & Mobile Pre-Caching

```text
Admin Uploads Asset in /admin/assets
       │
       ▼
[Validate Asset Dimensions] (e.g., Banners 700x200 px, SVGA < 5MB)
       │
       ▼
[Save to Object Storage (S3 / OSS)] ───► Deliver via CDN
       │
       ▼
[Create Asset Prisma Record]
       │
       ▼
[Mobile Client Sync] ───► Pre-cache SVGA / Audio assets on app startup
```
