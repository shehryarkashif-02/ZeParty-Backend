/**
 * Deterministic Revenue Split Utility for ZeParty Virtual Economy
 *
 * Enforces the canonical platform revenue split:
 * - Platform Cut: 45.0% (4500 bps)
 * - Host Diamonds: 35.0% (3500 bps)
 * - Agency Commission: 12.0% (1200 bps)
 * - Room Owner Incentive: 8.0% (800 bps)
 * Total: 100.0% (10000 bps)
 *
 * Uses BigInt integer arithmetic with zero floating-point drift.
 * Any integer division remainder is assigned deterministically to the platform.
 */

export const REVENUE_SPLIT_BPS = {
  PLATFORM: 4500n, // 45%
  HOST: 3500n,     // 35%
  AGENCY: 1200n,   // 12%
  ROOM: 800n,      // 8%
  TOTAL: 10000n,   // 100%
};

/**
 * Calculates the exact allocation of a coin gift amount across all 4 platform stakeholders.
 *
 * @param {bigint|number|string} coinAmount - The gift coin value
 * @returns {{
 *   platformCoins: bigint,
 *   hostDiamonds: bigint,
 *   agencyCoins: bigint,
 *   roomCoins: bigint,
 *   totalAllocated: bigint,
 *   originalCoins: bigint
 * }}
 */
export function calculateRevenueSplit(coinAmount) {
  const coins = BigInt(coinAmount);
  if (coins <= 0n) {
    throw new Error('Coin amount must be positive for revenue split calculation');
  }

  let platformCoins = (coins * REVENUE_SPLIT_BPS.PLATFORM) / REVENUE_SPLIT_BPS.TOTAL;
  const hostDiamonds = (coins * REVENUE_SPLIT_BPS.HOST) / REVENUE_SPLIT_BPS.TOTAL;
  const agencyCoins = (coins * REVENUE_SPLIT_BPS.AGENCY) / REVENUE_SPLIT_BPS.TOTAL;
  const roomCoins = (coins * REVENUE_SPLIT_BPS.ROOM) / REVENUE_SPLIT_BPS.TOTAL;

  // Reconcile remainder caused by integer division to ensure exact balance
  const sumAllocated = platformCoins + hostDiamonds + agencyCoins + roomCoins;
  const remainder = coins - sumAllocated;
  if (remainder > 0n) {
    platformCoins += remainder;
  }

  return {
    platformCoins,
    hostDiamonds,
    agencyCoins,
    roomCoins,
    totalAllocated: platformCoins + hostDiamonds + agencyCoins + roomCoins,
    originalCoins: coins,
  };
}

export default {
  REVENUE_SPLIT_BPS,
  calculateRevenueSplit,
};
