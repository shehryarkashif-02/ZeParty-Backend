import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createRechargePlanSchema,
  updateRechargePlanSchema,
} from '../src/validators/finance.validator.js';
import rechargeRepository from '../src/repositories/recharge.repository.js';
import rechargeService from '../src/services/recharge.service.js';

describe('Phase 3 Recharge Plans Specification Suite', () => {
  describe('1. Recharge Plan Validation Schemas', () => {
    it('validates legitimate plan creation payload', () => {
      const valid = {
        coinAmount: 100000,
        priceUSD: 9.99,
        bonusCoins: 5000,
        badgeText: 'Popular',
        isActive: true,
      };

      const parsed = createRechargePlanSchema.parse(valid);
      assert.strictEqual(parsed.coinAmount, 100000);
      assert.strictEqual(parsed.priceUSD, 9.99);
      assert.strictEqual(parsed.bonusCoins, 5000);
      assert.strictEqual(parsed.badgeText, 'Popular');
      assert.strictEqual(parsed.isActive, true);
    });

    it('rejects plan creation with negative or zero price/coins', () => {
      assert.throws(() => {
        createRechargePlanSchema.parse({
          coinAmount: 0,
          priceUSD: 10,
        });
      });

      assert.throws(() => {
        createRechargePlanSchema.parse({
          coinAmount: 1000,
          priceUSD: -5,
        });
      });
    });

    it('validates partial update payload', () => {
      const updatePayload = {
        priceUSD: 12.99,
        isActive: false,
      };

      const parsed = updateRechargePlanSchema.parse(updatePayload);
      assert.strictEqual(parsed.priceUSD, 12.99);
      assert.strictEqual(parsed.isActive, false);
    });
  });

  describe('2. Recharge Plan Service Operations', () => {
    it('getRechargePlans filters inactive plans for public consumers', async () => {
      const mockPlans = [
        { id: 'p-1', coinAmount: 10000n, priceUSD: '1.00', bonusCoins: 0n, isActive: true },
        { id: 'p-2', coinAmount: 50000n, priceUSD: '5.00', bonusCoins: 2000n, isActive: false },
        { id: 'p-3', coinAmount: 100000n, priceUSD: '10.00', bonusCoins: 5000n, isActive: true },
      ];

      const originalFind = rechargeRepository.findAllPlans;
      rechargeRepository.findAllPlans = async ({ includeInactive }) => {
        return includeInactive ? mockPlans : mockPlans.filter((p) => p.isActive);
      };

      try {
        const publicPlans = await rechargeService.getRechargePlans({ includeInactive: false });
        assert.strictEqual(publicPlans.length, 2);
        assert.strictEqual(publicPlans[0].coinAmount, '10000');
        assert.strictEqual(publicPlans[1].coinAmount, '100000');

        const adminPlans = await rechargeService.getRechargePlans({ includeInactive: true });
        assert.strictEqual(adminPlans.length, 3);
      } finally {
        rechargeRepository.findAllPlans = originalFind;
      }
    });

    it('createRechargePlan persists plan and returns sanitized BigInt data', async () => {
      const planData = {
        coinAmount: 250000,
        priceUSD: 25.0,
        bonusCoins: 15000,
        badgeText: 'Best Value',
        isActive: true,
      };

      const originalCreate = rechargeRepository.createPlan;
      rechargeRepository.createPlan = async (data) => ({
        id: 'plan-new-99',
        coinAmount: BigInt(data.coinAmount),
        priceUSD: String(data.priceUSD),
        bonusCoins: BigInt(data.bonusCoins),
        badgeText: data.badgeText,
        isActive: data.isActive,
        createdAt: new Date(),
      });

      try {
        const created = await rechargeService.createRechargePlan(planData, 'admin-1', false, '127.0.0.1');
        assert.strictEqual(created.id, 'plan-new-99');
        assert.strictEqual(created.coinAmount, '250000');
        assert.strictEqual(created.bonusCoins, '15000');
        assert.strictEqual(created.badgeText, 'Best Value');
      } finally {
        rechargeRepository.createPlan = originalCreate;
      }
    });
  });
});
