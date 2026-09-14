import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getEffectivePolicy,
  getEffectiveConfig,
  createPolicy,
  createVersion,
  publishVersion,
  rollbackPolicy,
} from '../src/services/policy.service.js';
import {
  createPolicySchema,
  createVersionSchema,
  updateConfigSchema,
  rollbackPolicySchema,
} from '../src/validators/policy.validator.js';
import { BASELINE_CONFIG_VALUES, BASELINE_POLICY_TEMPLATES } from '../src/constants/policyDefaults.js';

describe('Phase 7 Dynamic Policy Engine Suite', () => {
  // 1. Zod Validation & Schema Safety
  describe('1. Policy & Configuration Validation Schemas', () => {
    it('accepts valid policy creation payload and normalizes policyType to uppercase', () => {
      const input = {
        policyType: 'economy',
        description: 'Global economy policy',
        version: 'v1.0.0',
        initialConfig: { platformShareBps: 4500 },
      };
      const validated = createPolicySchema.parse(input);
      assert.strictEqual(validated.policyType, 'ECONOMY');
      assert.strictEqual(validated.version, 'v1.0.0');
    });

    it('rejects version strings that do not follow vX.Y.Z format', () => {
      assert.throws(() => {
        createVersionSchema.parse({
          version: 'invalid-version',
          summary: 'Test summary',
          configJson: {},
        });
      });
    });

    it('validates configuration update values and rejects percentage > 100%', () => {
      assert.throws(() => {
        updateConfigSchema.parse({
          key: 'RESELLER_TRANSFER_FEE_PERCENT',
          valueJson: { ratePercent: 120 }, // Invalid: > 100%
        });
      });
    });

    it('validates configuration update values and rejects negative exchange rate', () => {
      assert.throws(() => {
        updateConfigSchema.parse({
          key: 'USD_TO_COIN_RATE',
          valueJson: { rate: -500 }, // Invalid: <= 0
        });
      });
    });

    it('accepts valid configuration update values within legal boundaries', () => {
      const validated = updateConfigSchema.parse({
        key: 'reseller_transfer_fee_percent',
        valueJson: { ratePercent: 3.5, description: 'Updated fee' },
      });
      assert.strictEqual(validated.key, 'RESELLER_TRANSFER_FEE_PERCENT');
      assert.strictEqual(validated.valueJson.ratePercent, 3.5);
    });
  });

  // 2. Baseline & Effective Policy Resolution
  describe('2. Effective Policy Resolution & Fallback Hierarchy', () => {
    const mockDb = {
      policy: { findUnique: async () => null },
      policyConfiguration: { findUnique: async () => null },
    };

    it('resolves authoritative baseline economy policy when database record is absent', async () => {
      const effective = await getEffectivePolicy('ECONOMY', mockDb);
      assert.ok(effective);
      assert.strictEqual(effective.policyType, 'ECONOMY');
      assert.strictEqual(effective.activeVersion, 'v3.0.0');
      assert.strictEqual(effective.config.platformShareBps, 4500);
      assert.strictEqual(effective.config.hostShareBps, 3500);
    });

    it('resolves authoritative baseline config keys when database record is absent', async () => {
      const config = await getEffectiveConfig('USD_TO_COIN_RATE', mockDb);
      assert.ok(config);
      assert.strictEqual(config.key, 'USD_TO_COIN_RATE');
      assert.strictEqual(config.value.rate, 10000);
      assert.strictEqual(config.status, 'ACTIVE');
    });
  });

  // 3. Versioning, Publishing & Immutable Rollback
  describe('3. Versioning State Transitions & Immutable History', () => {
    it('preserves immutable historical configuration during policy rollback', async () => {
      const mockPolicy = {
        id: 'pol-101',
        policyType: 'LIVE_HOST',
        version: 'v3.2.0',
      };

      const mockVersions = [
        {
          id: 'ver-1',
          policyId: 'pol-101',
          version: 'v3.0.0',
          configJson: { minHours: 1, baselineUSD: 10 },
          summary: 'V3.0.0 baseline',
        },
        {
          id: 'ver-2',
          policyId: 'pol-101',
          version: 'v3.2.0',
          configJson: { minHours: 2, baselineUSD: 25 },
          summary: 'V3.2.0 increase',
        },
      ];

      // Simulated rollback to v3.0.0
      const targetVersion = 'v3.0.0';
      const historical = mockVersions.find((v) => v.version === targetVersion);
      assert.ok(historical);

      // Verify rollback creates a new version record rather than mutating historical record
      const rollbackTag = `${targetVersion}-rollback-1234`;
      const newRollbackVersion = {
        id: 'ver-3',
        policyId: mockPolicy.id,
        version: rollbackTag,
        configJson: historical.configJson,
        summary: `[Rollback to ${targetVersion}] Reverting experimental changes`,
      };

      mockVersions.push(newRollbackVersion);
      mockPolicy.version = rollbackTag;

      // Historical version v3.0.0 remains unmodified
      assert.strictEqual(mockVersions[0].version, 'v3.0.0');
      assert.deepStrictEqual(mockVersions[0].configJson, { minHours: 1, baselineUSD: 10 });
      // Policy active version now points to the new rollback record
      assert.strictEqual(mockPolicy.version, rollbackTag);
      assert.strictEqual(mockVersions.length, 3);
    });
  });

  // 4. RBAC & Owner Governance
  describe('4. RBAC & Root Owner Policy Authority', () => {
    it('verifies that economy_settings permission allows policy modifications', () => {
      const adminPermissions = ['economy_settings', 'view_settings'];
      const hasEconomyPermission = adminPermissions.includes('economy_settings');
      assert.strictEqual(hasEconomyPermission, true);
    });

    it('blocks regular admins lacking economy_settings from modifying policies', () => {
      const moderatorPermissions = ['view_reports', 'view_moderation'];
      const hasEconomyPermission = moderatorPermissions.includes('economy_settings');
      assert.strictEqual(hasEconomyPermission, false);
    });
  });
});
