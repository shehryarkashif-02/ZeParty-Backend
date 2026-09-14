/**
 * Single Authoritative Source of Truth for ZeParty Policy Defaults & Baseline Configurations.
 *
 * All rates and percentages use exact integer representation or basis points (bps):
 * - 100 bps = 1.0%
 * - 10,000 bps = 100.0%
 * - 1 USD = 10,000 Coins
 * - 10,000 Diamonds = 1.00 USD
 */

export const CANONICAL_POLICY_TYPES = [
  'ECONOMY',
  'LIVE_HOST',
  'AUDIO_HOST',
  'RESELLER',
  'MERCHANT',
  'MANAGER',
];

export const CANONICAL_CONFIG_KEYS = [
  'USD_TO_COIN_RATE',
  'DIAMOND_TO_USD_RATE',
  'RESELLER_TRANSFER_FEE_PERCENT',
  'HOST_TRANSFER_FEE_PERCENT',
  'MIN_WITHDRAWAL_USD',
  'MAX_WITHDRAWAL_DAILY_USD',
  'APPROVAL_THRESHOLD_USD',
  'APPROVAL_THRESHOLD_COINS',
];

export const BASELINE_CONFIG_VALUES = {
  USD_TO_COIN_RATE: {
    rate: 10000,
    unit: 'Coins / 1 USD',
    description: 'Standard USD to coin purchase conversion rate',
  },
  DIAMOND_TO_USD_RATE: {
    rate: 10000,
    unit: 'Diamonds / 1 USD',
    description: 'Standard diamond to USD host cashout rate',
  },
  RESELLER_TRANSFER_FEE_PERCENT: {
    ratePercent: 2.5,
    description: 'Percentage commission fee for reseller coin allocations',
  },
  HOST_TRANSFER_FEE_PERCENT: {
    ratePercent: 5.0,
    description: 'Percentage commission fee for host-to-host coin transfers',
  },
  MIN_WITHDRAWAL_USD: {
    amountUSD: 10.0,
    description: 'Minimum withdrawal amount in USD',
  },
  MAX_WITHDRAWAL_DAILY_USD: {
    amountUSD: 5000.0,
    description: 'Maximum daily withdrawal threshold in USD per host',
  },
  APPROVAL_THRESHOLD_USD: {
    amountUSD: 100.0,
    description: 'Financial threshold requiring two-stage maker-checker approval',
  },
  APPROVAL_THRESHOLD_COINS: {
    amountCoins: '1000000',
    description: 'Coin threshold requiring two-stage maker-checker approval',
  },
};

export const BASELINE_POLICY_TEMPLATES = {
  ECONOMY: {
    policyType: 'ECONOMY',
    version: 'v3.0.0',
    description: 'Master Platform Virtual Economy, Revenue Sharing & Conversion Standards',
    config: {
      version: 'v3.0.0',
      platformShareBps: 4500, // 45.0%
      hostShareBps: 3500,     // 35.0%
      agencyShareBps: 1200,   // 12.0%
      roomRewardBps: 800,     // 8.0%
      coinToDiamondExchangeRate: 1.0,
      coinRateUSD: 10000,
      diamondRateUSD: 10000,
      status: 'ACTIVE',
    },
  },
  LIVE_HOST: {
    policyType: 'LIVE_HOST',
    version: 'v3.0.0',
    description: 'Creator Video Live Streaming 25-Level Target Matrix & Salary Policy',
    config: {
      version: 'v3.0.0',
      minDailyHours: 1,
      minDaysPerMonth: 10,
      payoutCycleDays: 15,
      tiers: [
        { level: 1, targetDiamonds: 25000, durationDays: 10, basicSalaryUSD: 2.0 },
        { level: 2, targetDiamonds: 50000, durationDays: 10, basicSalaryUSD: 4.0 },
        { level: 3, targetDiamonds: 100000, durationDays: 10, basicSalaryUSD: 8.0 },
        { level: 4, targetDiamonds: 250000, durationDays: 10, basicSalaryUSD: 20.0 },
        { level: 5, targetDiamonds: 500000, durationDays: 8, basicSalaryUSD: 40.0 },
        { level: 6, targetDiamonds: 1000000, durationDays: 8, basicSalaryUSD: 80.0 },
        { level: 7, targetDiamonds: 2500000, durationDays: 8, basicSalaryUSD: 200.0 },
        { level: 8, targetDiamonds: 5000000, durationDays: 5, basicSalaryUSD: 400.0 },
        { level: 9, targetDiamonds: 10000000, durationDays: 5, basicSalaryUSD: 800.0 },
        { level: 10, targetDiamonds: 20000000, durationDays: 5, basicSalaryUSD: 1600.0 },
        { level: 25, targetDiamonds: 50000000, durationDays: 5, basicSalaryUSD: 4500.0 },
      ],
    },
  },
  AUDIO_HOST: {
    policyType: 'AUDIO_HOST',
    version: 'v3.0.0',
    description: 'Social Audio Party Room Host Rewards & Commission Policy',
    config: {
      version: 'v3.0.0',
      minDailyHours: 2,
      tiers: [
        { tierName: '30K Audio Tier', targetCoins: 30000, dailyRewardUSD: 0.8, agencyProfitUSD: 0.15 },
        { tierName: '60K Audio Tier', targetCoins: 60000, dailyRewardUSD: 1.6, agencyProfitUSD: 0.3 },
        { tierName: '100K Audio Tier', targetCoins: 100000, dailyRewardUSD: 2.8, agencyProfitUSD: 0.5 },
        { tierName: '350K Audio Tier', targetCoins: 350000, dailyRewardUSD: 9.5, agencyProfitUSD: 1.7 },
      ],
    },
  },
  RESELLER: {
    policyType: 'RESELLER',
    version: 'v3.0.0',
    description: 'Authorized P2P Coin Reseller Packages & Margins',
    config: {
      version: 'v3.0.0',
      packages: [
        { tierName: 'Silver Reseller Tier', priceUSD: 50, totalCoins: 525000, profitPercent: 8 },
        { tierName: 'Gold Reseller Tier', priceUSD: 200, totalCoins: 2160000, profitPercent: 10 },
        { tierName: 'Platinum Reseller Tier', priceUSD: 1000, totalCoins: 11200000, profitPercent: 12 },
        { tierName: 'VIP Master Reseller Tier', priceUSD: 5000, totalCoins: 58000000, profitPercent: 15 },
      ],
    },
  },
};

export default {
  CANONICAL_POLICY_TYPES,
  CANONICAL_CONFIG_KEYS,
  BASELINE_CONFIG_VALUES,
  BASELINE_POLICY_TEMPLATES,
};
