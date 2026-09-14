# ZeParty Wallet & Financial System Architecture Specification

## 1. Overview
The financial subsystem of the **ZeParty Shared Backend** handles all coin purchases, virtual gifting, host diamond earnings, P2P escrow trading, cashout withdrawals, reseller allocations, and administrative balance corrections.

> [!CAUTION]
> **Strict Financial Rule**: Financial balance operations MUST NEVER be implemented as direct SQL `UPDATE` balance queries. All balance alterations MUST execute within atomic database transactions, write an immutable entry to `WalletLedger`, generate audit logs, and trigger administrative approval workflows where financial limits are exceeded.

---

## 2. Immutable Ledger State Machine

Every user wallet is backed by an **immutable double-entry ledger** (`WalletLedger` table):

$$\text{Balance}_{\text{New}} = \text{Balance}_{\text{Previous}} + \Delta_{\text{Amount}}$$

### Wallet Ledger Schema Fields
* `id` (UUID Primary Key)
* `walletId` (Foreign Key to `Wallet`)
* `transactionType`: `RECHARGE`, `GIFT_SENT`, `GIFT_RECEIVED`, `WITHDRAWAL`, `P2P_ESCROW_LOCK`, `P2P_ESCROW_RELEASE`, `ADMIN_ADJUSTMENT`, `SWAP`, `RESELLER_ALLOCATION`.
* `coinDelta` (Integer: + / - coins)
* `diamondDelta` (BigInt: + / - diamonds)
* `usdDelta` (Decimal: + / - USD equivalent)
* `balanceBefore` (JSON: `{ coins, diamonds, sellerCoins, escrowLocked }`)
* `balanceAfter` (JSON: `{ coins, diamonds, sellerCoins, escrowLocked }`)
* `referenceId` (Transaction / Order ID)
* `createdAt` (Timestamp)

---

## 3. Financial Transaction Workflows

### Workflow A: Virtual Gifting Split Processing (Real-Time)
When a mobile user sends a 10,000 Coin gift in a Live/Audio Room:
1. **Prisma Transaction Start**:
   * Atomically verify sender `coinBalance >= 10000`.
   * Debit sender coins: `coinBalance -= 10000`. Create `WalletLedger` entry (`GIFT_SENT`).
2. **Revenue Split Calculation**:
   * Platform Revenue (45%): $4,500\text{ coins}$ ($\rightarrow$ Platform Liability Reduced).
   * Host Diamonds (35%): $3,500\text{ diamonds}$ credited to streamer (`HostProfile`). Create `WalletLedger` entry (`GIFT_RECEIVED`).
   * Agency Commission (12%): $1,200\text{ coins}$ credited to linked `Agency` balance ledger.
   * Room Owner Incentive (8%): $800\text{ coins}$ credited to `Room` owner.
3. **Commit & WebSockets Broadcast**: Commit database transaction and broadcast gift animation payload via Socket.IO.

```text
[Mobile Client: Send Gift] 
       │
       ▼
[Prisma $transaction] ───► 1. Debit Sender (10,000 Coins) ───► Ledger: GIFT_SENT
       │
       ├─────────────────► 2. Credit Host (3,500 Diamonds) ───► Ledger: GIFT_RECEIVED
       │
       ├─────────────────► 3. Credit Agency (1,200 Coins) ──► Ledger: AGENCY_COMMISSION
       │
       └─────────────────► 4. Credit Room Owner (800 Coins) ──► Ledger: ROOM_REWARD
       │
       ▼
[Socket.IO Broadcast] ───► SVGA Gift Animation to Room Viewers
```

### Workflow B: P2P Coin Trading & Escrow Locking
1. Seller creates offer $\rightarrow$ Backend locks seller coins in `escrowLockedCoins`.
2. Buyer transfers fiat money to seller bank account $\rightarrow$ Uploads payment proof receipt.
3. Seller confirms receipt $\rightarrow$ Backend executes `releaseLockedCoins()`, debiting `escrowLockedCoins` and crediting buyer `coinBalance`.
4. If seller fails to confirm within 30 minutes $\rightarrow$ Buyer files dispute, routing case to Admin Dispute Center (`/admin/coin-sellers`).

---

## 4. Two-Stage Administrative Approval Workflow (`AdminApproval`)

Sensitive financial actions executed by administrators require two-stage approval:

```text
Admin Requests Action (e.g., $500 Coin Credit)
       │
       ▼
[Financial Threshold Check] ─── (Amount > $100 threshold)
       │
       ▼
[Create AdminApproval Record] (status = PENDING)
       │
       ▼
[Notify Finance Super Admin]
       │
       ▼
[Approver Review in /admin/approvals]
       │
       ├──► APPROVED ───► Execute Transaction ──► Ledger Entry ──► Audit Log
       │
       └──► REJECTED ───► Mark Rejected ───────► Notify Requester ─► Audit Log
```

### Operations Requiring Two-Stage Approval
1. Manual coin/diamond adjustments exceeding $100 USD equivalent.
2. Host diamond withdrawal approvals (`/admin/withdrawals`).
3. Reseller credit allocations & balance write-offs (`/admin/reseller-corrections`).
4. Economy revenue split modifications (`/admin/economy`).
5. Mini-game RTP & payout configuration changes (`/admin/games`).
