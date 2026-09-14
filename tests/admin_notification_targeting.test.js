import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveTargetUserIds } from '../src/services/adminNotification.service.js';

describe('Phase 9 Admin Audience Segmentation & Targeting Suite', () => {
  it('correctly resolves VIP Users segment based on VIP Level', async () => {
    const mockDb = {
      userProfile: {
        findMany: async ({ where }) => {
          assert.strictEqual(where.vipLevel.gt, 0);
          return [{ userId: 'usr-vip-1' }, { userId: 'usr-vip-2' }];
        },
      },
    };

    const targetIds = await resolveTargetUserIds('VIP Users', [], mockDb);
    assert.deepStrictEqual(targetIds, ['usr-vip-1', 'usr-vip-2']);
  });

  it('correctly resolves Hosts segment based on host status', async () => {
    const mockDb = {
      user: {
        findMany: async ({ where }) => {
          assert.strictEqual(where.status, 'ACTIVE');
          return [{ id: 'usr-host-1' }, { id: 'usr-host-2' }];
        },
      },
    };

    const targetIds = await resolveTargetUserIds('Hosts Only', [], mockDb);
    assert.deepStrictEqual(targetIds, ['usr-host-1', 'usr-host-2']);
  });

  it('correctly passes explicit Selected Users segment', async () => {
    const customList = ['usr-custom-1', 'usr-custom-2', 'usr-custom-3'];
    const targetIds = await resolveTargetUserIds('Selected Users', customList, {});
    assert.deepStrictEqual(targetIds, customList);
  });
});
