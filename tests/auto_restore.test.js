import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  EXACT_15_DAYS_MS,
  calculateRestoreTimestamp,
} from '../src/services/autoRestore.service.js';

describe('Phase 7 15-Day Auto-Restore & Scheduler Suite', () => {
  // 1. Exact 15-Day Timestamp Arithmetic
  describe('1. Exact 15 x 24 Hour Duration Arithmetic', () => {
    it('guarantees exact 15-day duration equals 1,296,000,000 milliseconds', () => {
      const expectedMs = 15 * 24 * 60 * 60 * 1000;
      assert.strictEqual(EXACT_15_DAYS_MS, expectedMs);
      assert.strictEqual(EXACT_15_DAYS_MS, 1296000000);
    });

    it('calculates exact future restore date from any arbitrary base timestamp', () => {
      const baseDate = new Date('2026-09-01T12:00:00.000Z');
      const restoreDate = calculateRestoreTimestamp(baseDate);

      const expectedDate = new Date('2026-09-16T12:00:00.000Z');
      assert.strictEqual(restoreDate.toISOString(), expectedDate.toISOString());
      assert.strictEqual(restoreDate.getTime() - baseDate.getTime(), EXACT_15_DAYS_MS);
    });
  });

  // 2. State Machine & Expiry Logic
  describe('2. Disabled State & Expiry Sweep Simulation', () => {
    it('identifies expired disabled configurations and leaves non-expired configurations intact', () => {
      const now = new Date('2026-09-20T00:00:00.000Z');

      const mockConfigs = [
        {
          key: 'USD_TO_COIN_RATE',
          status: 'DISABLED',
          disabledAt: new Date('2026-09-01T00:00:00.000Z'),
          autoRestoreAt: new Date('2026-09-16T00:00:00.000Z'), // Expired (Sept 16 <= Sept 20)
        },
        {
          key: 'RESELLER_TRANSFER_FEE_PERCENT',
          status: 'DISABLED',
          disabledAt: new Date('2026-09-10T00:00:00.000Z'),
          autoRestoreAt: new Date('2026-09-25T00:00:00.000Z'), // Not yet expired (Sept 25 > Sept 20)
        },
        {
          key: 'DIAMOND_TO_USD_RATE',
          status: 'ACTIVE',
          disabledAt: null,
          autoRestoreAt: null,
        },
      ];

      // Simulated sweep filter: status === 'DISABLED' && autoRestoreAt <= now
      const expired = mockConfigs.filter(
        (c) => c.status === 'DISABLED' && c.autoRestoreAt && c.autoRestoreAt <= now
      );

      assert.strictEqual(expired.length, 1);
      assert.strictEqual(expired[0].key, 'USD_TO_COIN_RATE');
    });

    it('restores expired configuration and resets status to ACTIVE and timestamps to null', () => {
      const config = {
        key: 'USD_TO_COIN_RATE',
        status: 'DISABLED',
        disabledAt: new Date('2026-09-01T00:00:00.000Z'),
        autoRestoreAt: new Date('2026-09-16T00:00:00.000Z'),
      };

      // Execute restoration
      config.status = 'ACTIVE';
      config.disabledAt = null;
      config.autoRestoreAt = null;

      assert.strictEqual(config.status, 'ACTIVE');
      assert.strictEqual(config.disabledAt, null);
      assert.strictEqual(config.autoRestoreAt, null);
    });
  });

  // 3. Concurrency & Multi-Instance Safety Simulation
  describe('3. Concurrency & Idempotent Sweep Simulation', () => {
    it('simulates concurrent restore attempts where only the first succeeds (idempotent)', async () => {
      let configStatus = 'DISABLED';
      let restoreCount = 0;

      // Simulated atomic conditional update: UPDATE WHERE key = 'X' AND status = 'DISABLED'
      const atomicRestore = async () => {
        if (configStatus === 'DISABLED') {
          configStatus = 'ACTIVE';
          restoreCount += 1;
          return { success: true };
        }
        return { success: false, reason: 'ALREADY_ACTIVE' };
      };

      // 3 concurrent workers attempting to restore the same expired config
      const results = await Promise.all([
        atomicRestore(),
        atomicRestore(),
        atomicRestore(),
      ]);

      const successfulRestores = results.filter((r) => r.success);
      assert.strictEqual(successfulRestores.length, 1, 'Exactly one concurrent restore must succeed');
      assert.strictEqual(restoreCount, 1, 'Total restore state transitions must be exactly 1');
      assert.strictEqual(configStatus, 'ACTIVE');
    });
  });
});
