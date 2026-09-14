import { describe, it } from 'node:test';
import assert from 'node:assert';
import socketEmitter from '../src/socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../src/socket/socket.constants.js';
import { applyRestriction, liftRestriction } from '../src/services/restriction.service.js';
import { submitReport } from '../src/services/report.service.js';

describe('Phase 8 Moderation Realtime Socket Events Suite', () => {
  it('emits moderation:ban event to user room on account ban', async () => {
    let targetRoom = null;
    let emittedEvent = null;
    let emittedPayload = null;

    socketEmitter.setSocketServerInstance({
      to: (room) => ({
        emit: (event, payload) => {
          targetRoom = room;
          emittedEvent = event;
          emittedPayload = payload;
        },
      }),
      emit: () => {},
    });

    const mockDb = {
      restriction: {
        create: async (args) => ({ id: 'rst-sock-1', ...args.data }),
      },
      user: {
        findUnique: async () => ({ id: 'usr-banned-target', status: 'ACTIVE' }),
        update: async (args) => ({ id: 'usr-banned-target', ...args.data }),
      },
      auditLog: {
        create: async () => ({ id: 'audit-sock-1' }),
      },
    };

    await applyRestriction(
      {
        userId: 'usr-banned-target',
        targetId: 'usr-banned-target',
        type: 'BAN',
        reason: 'Severe violation of community safety',
      },
      mockDb
    );

    assert.strictEqual(targetRoom, 'user:usr-banned-target');
    assert.strictEqual(emittedEvent, SOCKET_EVENTS.MODERATION_BAN);
    assert.strictEqual(emittedPayload.type, 'BAN');
  });

  it('emits report:created event globally to all admin listeners', async () => {
    let globalEvent = null;
    let globalPayload = null;

    socketEmitter.setSocketServerInstance({
      emit: (event, payload) => {
        globalEvent = event;
        globalPayload = payload;
      },
      to: () => ({ emit: () => {} }),
    });

    const mockDb = {
      report: {
        findFirst: async () => null,
        create: async (args) => ({
          id: 'rep-sock-1',
          ...args.data,
          createdAt: new Date(),
        }),
      },
    };

    await submitReport(
      {
        reporterUserId: 'usr-1',
        reportedUserId: 'usr-2',
        violationType: 'HARASSMENT',
      },
      {},
      mockDb
    );

    assert.strictEqual(globalEvent, SOCKET_EVENTS.REPORT_CREATED);
    assert.strictEqual(globalPayload.reportId, 'rep-sock-1');
  });
});
