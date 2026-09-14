import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createTicket, replyToTicket, updateTicketStatus, getTicketDetails } from '../src/services/support.service.js';

describe('Phase 8 Customer Support Ticket Suite', () => {
  it('creates ticket with initial user message and default OPEN status', async () => {
    let createdTicket = null;
    let initialMessage = null;

    const mockDb = {
      supportTicket: {
        create: async (args) => {
          createdTicket = {
            id: 'tkt-001',
            ...args.data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return createdTicket;
        },
      },
      supportTicketMessage: {
        create: async (args) => {
          initialMessage = { id: 'msg-001', ...args.data };
          return initialMessage;
        },
      },
    };

    const ticket = await createTicket(
      {
        userId: 'usr-customer-1',
        subject: 'Recharge failed on PayPal',
        message: 'My card was charged but coins were not credited.',
        category: 'PAYMENT',
        priority: 'HIGH',
      },
      {},
      mockDb
    );

    assert.strictEqual(ticket.id, 'tkt-001');
    assert.strictEqual(ticket.status, 'OPEN');
    assert.strictEqual(ticket.category, 'PAYMENT');
    assert.strictEqual(ticket.priority, 'HIGH');
    assert.strictEqual(initialMessage.ticketId, 'tkt-001');
    assert.strictEqual(initialMessage.senderType, 'USER');
  });

  it('allows user and admin replies, updating ticket conversation and status', async () => {
    const mockTicket = {
      id: 'tkt-002',
      userId: 'usr-customer-1',
      subject: 'Inquiry',
      status: 'OPEN',
    };

    let updatedStatus = null;
    let adminReply = null;

    const mockDb = {
      supportTicket: {
        findUnique: async () => mockTicket,
        update: async (args) => {
          updatedStatus = args.data.status;
          return { ...mockTicket, ...args.data };
        },
      },
      supportTicketMessage: {
        create: async (args) => {
          adminReply = { id: 'msg-002', ...args.data, createdAt: new Date() };
          return adminReply;
        },
      },
      auditLog: {
        create: async () => ({ id: 'audit-001' }),
      },
    };

    // Admin replies to customer
    const reply = await replyToTicket(
      'tkt-002',
      {
        senderType: 'ADMIN',
        senderId: 'admin-supp-1',
        message: 'We are investigating your issue. Please provide transaction ID.',
        isInternalNote: false,
      },
      { adminName: 'Support Agent Bob' },
      mockDb
    );

    assert.strictEqual(reply.id, 'msg-002');
    assert.strictEqual(reply.senderType, 'ADMIN');
    assert.strictEqual(updatedStatus, 'WAITING_ON_USER');
  });

  it('segregates internal administrative notes from user view', async () => {
    const mockMessages = [
      { id: 'm-1', message: 'User question', isInternalNote: false, createdAt: new Date() },
      { id: 'm-2', message: 'INTERNAL NOTE: Suspicious payment profile', isInternalNote: true, createdAt: new Date() },
    ];

    const mockDb = {
      supportTicket: {
        findUnique: async ({ include }) => {
          const filtered = include.messages.where.isInternalNote === false
            ? mockMessages.filter((m) => !m.isInternalNote)
            : mockMessages;
          return {
            id: 'tkt-003',
            userId: 'usr-customer-1',
            messages: filtered,
          };
        },
      },
    };

    // Customer views ticket
    const userView = await getTicketDetails(
      'tkt-003',
      { userId: 'usr-customer-1', isAdmin: false },
      mockDb
    );
    assert.strictEqual(userView.messages.length, 1);
    assert.strictEqual(userView.messages[0].isInternalNote, false);

    // Admin views ticket
    const adminView = await getTicketDetails(
      'tkt-003',
      { userId: 'admin-1', isAdmin: true },
      mockDb
    );
    assert.strictEqual(adminView.messages.length, 2);
  });
});
