import policyService from './policy.service.js';
import prisma from '../config/database.js';

/**
 * Payroll & Commission Authoritative Calculation Engine
 * 
 * Strict Financial Invariants:
 * 1. Integer Precision: Coins and Diamonds use BigInt.
 * 2. Deterministic Money Math: Standard rate is 10,000 Diamonds/Coins per 1.00 USD.
 * 3. Authoritative Policy: Derives rates strictly from server policies (never user input).
 */

const DIAMONDS_PER_USD = 10000n;
const COINS_PER_USD = 10000n;

/**
 * Converts BigInt diamonds to rounded 2-decimal USD string/float.
 */
export function diamondsToUSD(diamonds) {
  const big = BigInt(diamonds || 0n);
  const cents = (big * 100n) / DIAMONDS_PER_USD;
  return Number(cents) / 100;
}

/**
 * Converts BigInt coins to rounded 2-decimal USD string/float.
 */
export function coinsToUSD(coins) {
  const big = BigInt(coins || 0n);
  const cents = (big * 100n) / COINS_PER_USD;
  return Number(cents) / 100;
}

/**
 * Calculates Host Earnings and Payroll for a settlement period.
 * 
 * @param {Object} params
 * @param {Object} params.hostProfile - HostProfile record with user
 * @param {Array<Object>} params.giftTransactions - Eligible gift transactions in period
 * @param {number} [params.liveHours] - Total verified streaming hours
 * @param {number} [params.daysAchieved] - Total verified active streaming days
 * @param {Object} [params.policyConfig] - Effective LIVE_HOST or AUDIO_HOST policy
 */
export async function calculateHostPayroll({
  hostProfile,
  giftTransactions = [],
  liveHours = null,
  daysAchieved = null,
  policyConfig = null,
  db = prisma,
}) {
  if (!hostProfile) {
    throw new Error('hostProfile is required for host payroll calculation');
  }

  // 1. Resolve Policy
  let policy = policyConfig;
  if (!policy) {
    const policyType = hostProfile.hostType === 'AUDIO_HOST' ? 'AUDIO_HOST' : 'LIVE_HOST';
    const effective = await policyService.getEffectivePolicy(policyType, db);
    policy = effective?.config || {};
  }

  const policyVersion = policy.version || 'v3.0.0';

  // 2. Aggregate Gifting Diamonds from verified GiftTransactions
  let totalDiamonds = 0n;
  const allocations = [];

  for (const tx of giftTransactions) {
    if (tx.recipientUserId === hostProfile.userId) {
      const diamonds = BigInt(tx.hostDiamonds || 0n);
      totalDiamonds += diamonds;
      allocations.push({
        sourceTransactionType: 'GIFT_TRANSACTION',
        sourceTransactionId: tx.id,
        amountCoinsOrDiamonds: diamonds,
        amountUSD: diamondsToUSD(diamonds),
      });
    }
  }

  const giftingUSD = diamondsToUSD(totalDiamonds);

  // 3. Evaluate Base Salary Targets
  let baseSalaryUSD = 0.0;
  const tiers = policy.tiers || [];
  const minDailyHours = policy.minDailyHours || 1;
  const minDaysPerMonth = policy.minDaysPerMonth || 10;

  const actualHours = Number(liveHours !== null ? liveHours : (hostProfile.totalLiveHoursMonth ?? 0));
  const actualDays = Number(daysAchieved !== null ? daysAchieved : (hostProfile.targetDaysAchieved ?? 0));

  // Find the highest qualified tier
  if (actualDays >= minDaysPerMonth && actualHours >= minDailyHours * actualDays) {
    for (const tier of tiers) {
      const tierTarget = BigInt(tier.targetDiamonds || tier.targetCoins || 0);
      if (totalDiamonds >= tierTarget) {
        const tierSalary = Number(tier.basicSalaryUSD || tier.dailyRewardUSD || 0);
        if (tierSalary > baseSalaryUSD) {
          baseSalaryUSD = tierSalary;
        }
      }
    }
  }

  if (baseSalaryUSD > 0) {
    allocations.push({
      sourceTransactionType: 'BASE_SALARY',
      sourceTransactionId: `BASE_SALARY_${hostProfile.id}_${policyVersion}`,
      amountCoinsOrDiamonds: BigInt(Math.round(baseSalaryUSD * 10000)),
      amountUSD: baseSalaryUSD,
    });
  }

  const grossEarningsUSD = Number((giftingUSD + baseSalaryUSD).toFixed(2));
  const deductionsUSD = 0.0;
  const adjustmentsUSD = 0.0;
  const netPayableUSD = grossEarningsUSD;

  return {
    recipientType: 'HOST',
    recipientId: hostProfile.id,
    userId: hostProfile.userId,
    grossDiamondsOrCoins: totalDiamonds,
    giftingUSD,
    baseSalaryUSD,
    grossEarningsUSD,
    deductionsUSD,
    adjustmentsUSD,
    netPayableUSD,
    policyVersion,
    liveHours: actualHours,
    daysAchieved: actualDays,
    allocations,
  };
}

/**
 * Calculates Agency Commission for a settlement period.
 * 
 * @param {Object} params
 * @param {Object} params.agency - Agency record
 * @param {Array<Object>} params.hostPayrollResults - List of host payroll outputs under agency
 * @param {Array<Object>} params.giftTransactions - Gifting transactions
 */
export async function calculateAgencyCommissions({
  agency,
  hostPayrollResults = [],
  giftTransactions = [],
  policyConfig = null,
  db = prisma,
}) {
  if (!agency) {
    throw new Error('agency is required for agency commission calculation');
  }

  let economyPolicy = policyConfig;
  if (!economyPolicy) {
    const effective = await policyService.getEffectivePolicy('ECONOMY', db);
    economyPolicy = effective?.config || {};
  }

  const policyVersion = economyPolicy.version || 'v3.0.0';
  const commissionRatePercent = Number(agency.commissionRate ?? 20.0);

  let totalHostDiamonds = 0n;
  for (const hostRes of hostPayrollResults) {
    totalHostDiamonds += BigInt(hostRes.grossDiamondsOrCoins || 0n);
  }

  // Agency commission calculated from total host gifting turnover
  // 20% of host gifting diamonds in USD equivalent
  const hostGiftingUSD = diamondsToUSD(totalHostDiamonds);
  const commissionUSD = Number(((hostGiftingUSD * commissionRatePercent) / 100).toFixed(2));
  const commissionCoins = BigInt(Math.round(commissionUSD * 10000));

  const allocations = [];
  if (commissionUSD > 0) {
    allocations.push({
      sourceTransactionType: 'AGENCY_COMMISSION',
      sourceTransactionId: `AGENCY_COMMISSION_${agency.id}_${policyVersion}`,
      amountCoinsOrDiamonds: commissionCoins,
      amountUSD: commissionUSD,
    });
  }

  const grossEarningsUSD = commissionUSD;
  const deductionsUSD = 0.0;
  const adjustmentsUSD = 0.0;
  const netPayableUSD = commissionUSD;

  return {
    recipientType: 'AGENCY',
    recipientId: agency.id,
    userId: agency.ownerUserId,
    grossDiamondsOrCoins: commissionCoins,
    commissionUSD,
    grossEarningsUSD,
    deductionsUSD,
    adjustmentsUSD,
    netPayableUSD,
    policyVersion,
    hostCount: hostPayrollResults.length,
    allocations,
  };
}

/**
 * Calculates BD Center Settlement for a period.
 * 
 * @param {Object} params
 * @param {Object} params.bdCenter - BDCenter record
 * @param {Array<Object>} params.agencyResults - Agency commission results under BD
 * @param {Array<Object>} params.directHostResults - Direct host payroll results under BD
 */
export async function calculateBDCenterSettlement({
  bdCenter,
  agencyResults = [],
  directHostResults = [],
  policyConfig = null,
}) {
  if (!bdCenter) {
    throw new Error('bdCenter is required for BD Center settlement calculation');
  }

  const policyVersion = policyConfig?.version || 'v3.0.0';

  // 1. Base Salary by BDTier
  const tierSalaries = {
    BRONZE: 500.0,
    SILVER: 1000.0,
    GOLD: 2000.0,
    PLATINUM: 4000.0,
    DIAMOND: 8000.0,
  };

  const baseSalaryUSD = Number(bdCenter.baseSalaryUSD ?? tierSalaries[bdCenter.currentTier] ?? 500.0);

  // 2. Aggregate Group Volume
  let totalGroupDiamonds = 0n;
  for (const host of directHostResults) {
    totalGroupDiamonds += BigInt(host.grossDiamondsOrCoins || 0n);
  }
  for (const ag of agencyResults) {
    totalGroupDiamonds += BigInt(ag.grossDiamondsOrCoins || 0n);
  }

  // 3. Performance Bonus (e.g., 2% on group volume if above $5,000 USD)
  const groupUSD = diamondsToUSD(totalGroupDiamonds);
  let performanceBonusUSD = 0.0;
  if (groupUSD >= 5000.0) {
    performanceBonusUSD = Number((groupUSD * 0.02).toFixed(2));
  }

  const grossEarningsUSD = Number((baseSalaryUSD + performanceBonusUSD).toFixed(2));
  const deductionsUSD = 0.0;
  const adjustmentsUSD = 0.0;
  const netPayableUSD = grossEarningsUSD;

  const allocations = [
    {
      sourceTransactionType: 'BD_BASE_SALARY',
      sourceTransactionId: `BD_BASE_${bdCenter.id}_${policyVersion}`,
      amountCoinsOrDiamonds: BigInt(Math.round(baseSalaryUSD * 10000)),
      amountUSD: baseSalaryUSD,
    },
  ];

  if (performanceBonusUSD > 0) {
    allocations.push({
      sourceTransactionType: 'BD_BONUS',
      sourceTransactionId: `BD_BONUS_${bdCenter.id}_${policyVersion}`,
      amountCoinsOrDiamonds: BigInt(Math.round(performanceBonusUSD * 10000)),
      amountUSD: performanceBonusUSD,
    });
  }

  return {
    recipientType: 'BD_CENTER',
    recipientId: bdCenter.id,
    userId: bdCenter.managerUserId,
    grossDiamondsOrCoins: totalGroupDiamonds,
    baseSalaryUSD,
    performanceBonusUSD,
    grossEarningsUSD,
    deductionsUSD,
    adjustmentsUSD,
    netPayableUSD,
    policyVersion,
    allocations,
  };
}

export default {
  diamondsToUSD,
  coinsToUSD,
  calculateHostPayroll,
  calculateAgencyCommissions,
  calculateBDCenterSettlement,
};
