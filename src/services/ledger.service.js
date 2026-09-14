import prisma from '../config/database.js';
import walletRepository from '../repositories/wallet.repository.js';
import ledgerRepository from '../repositories/ledger.repository.js';
import { generateReference } from '../utils/reference.util.js';
import { calculateRevenueSplit } from '../utils/split.util.js';

/**
 * Core Accounting Engine for ZeParty Backend.
 *
 * Enforces mandatory accounting invariants:
 * 1. Atomicity: All balance mutations and ledger postings occur in a single Prisma transaction.
 * 2. Immutable Ledger: Append-only records with before/after state snapshots.
 * 3. Non-Negative Spendable Balances: Throws INSUFFICIENT_BALANCE if balance drops below 0.
 * 4. Integer Unit Precision: BigInt used for coins and diamonds.
 * 5. Deterministic Reconciliation: Every transaction is tracked by a unique reference ID.
 */

/**
 * Executes an atomic batch of balance modifications and associated ledger postings.
 *
 * @param {Object} params
 * @param {Array<Object>} params.operations - List of ledger operations to execute
 * @param {string} [params.referenceId] - Unique financial transaction reference
 * @param {string} params.transactionType - Enum value from WalletLedgerType
 * @param {Object} [params.db] - Optional existing transaction client
 */
export async function postTransaction({
  operations = [],
  referenceId = null,
  transactionType = 'ADMIN_ADJUSTMENT',
  db = prisma,
}) {
  if (!operations || operations.length === 0) {
    const error = new Error('Transaction requires at least one ledger operation.');
    error.status = 400;
    error.code = 'EMPTY_TRANSACTION';
    throw error;
  }

  const refId = referenceId || generateReference('TXN');

  const executeInsideTransaction = async (tx) => {
    const results = [];

    for (const op of operations) {
      const {
        walletId,
        coinDelta = 0n,
        diamondDelta = 0n,
        sellerDelta = 0n,
        escrowDelta = 0n,
        usdDelta = 0.0,
        rechargedDeltaUSD = 0,
        withdrawnDeltaUSD = 0,
      } = op;

      if (!walletId) {
        const error = new Error('Every operation requires a valid walletId');
        error.status = 400;
        error.code = 'INVALID_WALLET_ID';
        throw error;
      }

      // 1. Lock and fetch wallet row
      const wallet = await walletRepository.findWithLock(walletId, tx);
      if (!wallet) {
        const error = new Error(`Wallet not found for ID: ${walletId}`);
        error.status = 404;
        error.code = 'WALLET_NOT_FOUND';
        throw error;
      }

      const currentCoins = BigInt(wallet.coinBalance ?? 0n);
      const currentDiamonds = BigInt(wallet.diamondBalance ?? 0n);
      const currentSellerCoins = BigInt(wallet.sellerBalanceCoins ?? 0n);
      const currentEscrowLocked = BigInt(wallet.escrowLockedCoins ?? 0n);

      const balanceBefore = {
        coins: currentCoins.toString(),
        diamonds: currentDiamonds.toString(),
        sellerCoins: currentSellerCoins.toString(),
        escrowLocked: currentEscrowLocked.toString(),
      };

      // 2. Compute new balances
      const cDelta = BigInt(coinDelta ?? 0n);
      const dDelta = BigInt(diamondDelta ?? 0n);
      const sDelta = BigInt(sellerDelta ?? 0n);
      const eDelta = BigInt(escrowDelta ?? 0n);

      const newCoinBalance = currentCoins + cDelta;
      const newDiamondBalance = currentDiamonds + dDelta;
      const newSellerBalanceCoins = currentSellerCoins + sDelta;
      const newEscrowLockedCoins = currentEscrowLocked + eDelta;

      // 3. Assert Non-Negative Balance Invariants
      if (newCoinBalance < 0n) {
        const error = new Error(`Insufficient coin balance. Current: ${currentCoins}, Attempted Debit: ${-cDelta}`);
        error.status = 400;
        error.code = 'INSUFFICIENT_BALANCE';
        throw error;
      }

      if (newDiamondBalance < 0n) {
        const error = new Error(`Insufficient diamond balance. Current: ${currentDiamonds}, Attempted Debit: ${-dDelta}`);
        error.status = 400;
        error.code = 'INSUFFICIENT_DIAMONDS';
        throw error;
      }

      if (newSellerBalanceCoins < 0n) {
        const error = new Error('Insufficient reseller coin balance');
        error.status = 400;
        error.code = 'INSUFFICIENT_SELLER_COINS';
        throw error;
      }

      if (newEscrowLockedCoins < 0n) {
        const error = new Error('Insufficient locked escrow balance');
        error.status = 400;
        error.code = 'INSUFFICIENT_ESCROW_COINS';
        throw error;
      }

      const balanceAfter = {
        coins: newCoinBalance.toString(),
        diamonds: newDiamondBalance.toString(),
        sellerCoins: newSellerBalanceCoins.toString(),
        escrowLocked: newEscrowLockedCoins.toString(),
      };

      // 4. Update wallet balances
      await walletRepository.updateBalances(
        {
          walletId,
          newCoinBalance,
          newDiamondBalance,
          newSellerBalanceCoins,
          newEscrowLockedCoins,
          rechargedDeltaUSD,
          withdrawnDeltaUSD,
        },
        tx
      );

      // 5. Create immutable append-only ledger entry
      const ledgerEntry = await ledgerRepository.createEntry(
        {
          walletId,
          transactionType,
          coinDelta: cDelta,
          diamondDelta: dDelta,
          usdDelta,
          balanceBefore,
          balanceAfter,
          referenceId: refId,
        },
        tx
      );

      results.push({
        walletId,
        balanceBefore,
        balanceAfter,
        ledgerEntryId: ledgerEntry.id,
      });
    }

    return {
      referenceId: refId,
      transactionType,
      results,
    };
  };

  // If running with custom db/mock or inside an active transaction, execute directly
  if (db && db !== prisma) {
    return await executeInsideTransaction(db);
  }

  return await prisma.$transaction(async (tx) => {
    return await executeInsideTransaction(tx);
  });
}

/**
 * Executes a direct balance adjustment for an individual user wallet.
 */
export async function executeDirectAdjustment({
  walletId,
  asset, // 'COINS' | 'DIAMONDS'
  direction, // 'CREDIT' | 'DEBIT'
  amount,
  reason,
  referenceId = null,
  db = prisma,
}) {
  const bigAmount = BigInt(amount);
  if (bigAmount <= 0n) {
    const error = new Error('Adjustment amount must be greater than zero');
    error.status = 400;
    error.code = 'INVALID_AMOUNT';
    throw error;
  }

  const delta = direction === 'CREDIT' ? bigAmount : -bigAmount;
  const coinDelta = asset === 'COINS' ? delta : 0n;
  const diamondDelta = asset === 'DIAMONDS' ? delta : 0n;

  const ref = referenceId || generateReference('ADJ');

  return await postTransaction({
    operations: [
      {
        walletId,
        coinDelta,
        diamondDelta,
      },
    ],
    referenceId: ref,
    transactionType: 'ADMIN_ADJUSTMENT',
    db,
  });
}

/**
 * Executes a balanced double-entry transfer between two wallets.
 */
export async function executeDoubleEntryTransfer({
  sourceWalletId,
  destinationWalletId,
  asset = 'COINS',
  amount,
  transactionType = 'SWAP',
  referenceId = null,
  db = prisma,
}) {
  const bigAmount = BigInt(amount);
  if (bigAmount <= 0n) {
    const error = new Error('Transfer amount must be greater than zero');
    error.status = 400;
    error.code = 'INVALID_AMOUNT';
    throw error;
  }

  if (sourceWalletId === destinationWalletId) {
    const error = new Error('Source and destination wallets cannot be identical');
    error.status = 400;
    error.code = 'SAME_WALLET_TRANSFER';
    throw error;
  }

  const ref = referenceId || generateReference('TXN');

  const debitDelta = -bigAmount;
  const creditDelta = bigAmount;

  return await postTransaction({
    operations: [
      {
        walletId: sourceWalletId,
        coinDelta: asset === 'COINS' ? debitDelta : 0n,
        diamondDelta: asset === 'DIAMONDS' ? debitDelta : 0n,
      },
      {
        walletId: destinationWalletId,
        coinDelta: asset === 'COINS' ? creditDelta : 0n,
        diamondDelta: asset === 'DIAMONDS' ? creditDelta : 0n,
      },
    ],
    referenceId: ref,
    transactionType,
    db,
  });
}

/**
 * Executes a multi-party revenue split posting for virtual gifting.
 */
export async function executeRevenueSplitPosting({
  senderWalletId,
  hostWalletId,
  agencyWalletId = null,
  roomWalletId = null,
  coinAmount,
  referenceId = null,
  db = prisma,
}) {
  const split = calculateRevenueSplit(coinAmount);
  const ref = referenceId || generateReference('GIFT');

  const operations = [
    // 1. Debit sender coins
    {
      walletId: senderWalletId,
      coinDelta: -split.originalCoins,
    },
    // 2. Credit host diamonds (1:1 conversion rate with coins)
    {
      walletId: hostWalletId,
      diamondDelta: split.hostDiamonds,
    },
  ];

  if (agencyWalletId && split.agencyCoins > 0n) {
    operations.push({
      walletId: agencyWalletId,
      coinDelta: split.agencyCoins,
    });
  }

  if (roomWalletId && split.roomCoins > 0n) {
    operations.push({
      walletId: roomWalletId,
      coinDelta: split.roomCoins,
    });
  }

  return await postTransaction({
    operations,
    referenceId: ref,
    transactionType: 'GIFT_SENT',
    db,
  });
}

export default {
  postTransaction,
  executeDirectAdjustment,
  executeDoubleEntryTransfer,
  executeRevenueSplitPosting,
};
