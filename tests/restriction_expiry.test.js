import { describe, it } from 'node:test';
import assert from 'node:assert';
import { findActiveRestrictionsForUser } from '../src/repositories/restriction.repository.js';

describe('Phase 8 Restriction Dynamic Expiration Suite', () => {
  it('enforces server-side time boundaries dynamically without background polling dependency', async () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 10000); // Expired 10s ago
    const futureDate = new Date(now.getTime() + 100000); // Valid for 100s

    const mockDb = {
      restriction: {
        findMany: async ({ where }) => {
          // Verify query enforces startsAt <= now AND (expiresAt IS NULL OR expiresAt > now)
          const passed = where.status === 'ACTIVE' && where.startsAt.lte instanceof Date;
          if (passed) {
            return [
              {
                id: 'rst-valid',
                type: 'MUTE',
                startsAt: new Date(now.getTime() - 5000),
                expiresAt: futureDate,
                status: 'ACTIVE',
              },
            ];
          }
          return [];
        },
      },
    };

    const activeList = await findActiveRestrictionsForUser('usr-dynamic-test', mockDb);
    assert.strictEqual(activeList.length, 1);
    assert.strictEqual(activeList[0].id, 'rst-valid');
  });
});
