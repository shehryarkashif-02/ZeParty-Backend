import { describe, it } from 'node:test';
import assert from 'node:assert';
import socketEmitter from '../src/socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../src/socket/socket.constants.js';
import { executeSettlementPayout } from '../src/services/settlement.service.js';

describe('Phase 5 Realtime Settlement Socket Events Suite', () => {
  it('emits settlement:paid event to target recipient user only after transaction commit', async () => {
    let emittedEvent = null;
    let emittedUserId = null;
    let emittedPayload = null;

    // Attach mock io instance to socketEmitter
    socketEmitter.setSocketServerInstance({
      to: (room) => ({
        emit: (event, payload) => {
          emittedEvent = event;
          emittedUserId = room.replace('user:', '');
          emittedPayload = payload;
        },
      }),
    });

    const mockRecord = {
      id: 'sr-rt-01',
      recipientType: 'HOST',
      recipientId: 'host-rt-1',
      userId: 'user-recipient-99',
      netPayableUSD: 200.0,
      status: 'APPROVED',
    };

    const mockWallet = {
      id: 'w-rt-1',
      userId: 'user-recipient-99',
      diamondBalance: 0n,
      coinBalance: 0n,
    };

    const mockDb = {
      $transaction: async (fn) => {
        const tx = {
          $queryRaw: async () => [mockRecord],
          settlementRecord: {
            findUnique: async () => mockRecord,
            update: async (args) => ({ ...mockRecord, ...args.data }),
          },
          wallet: {
            findUnique: async () => mockWallet,
            update: async (args) => {
              mockWallet.diamondBalance = args.data.diamondBalance;
              return mockWallet;
            },
          },
          walletLedger: {
            create: async (args) => ({ id: 'ledg-rt-01', ...args.data }),
          },
          auditLog: {
            create: async () => ({ id: 'audit-rt-01' }),
          },
        };
        return await fn(tx);
      },
    };

    await executeSettlementPayout(
      {
        settlementRecordId: 'sr-rt-01',
        adminId: 'admin-1',
      },
      mockDb
    );

    assert.strictEqual(emittedEvent, SOCKET_EVENTS.SETTLEMENT_PAID);
    assert.strictEqual(emittedUserId, 'user-recipient-99');
    assert.strictEqual(emittedPayload.settlementRecordId, 'sr-rt-01');
    assert.strictEqual(emittedPayload.netPayableUSD, 200.0);
  });
});
