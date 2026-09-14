import { describe, it } from 'node:test';
import assert from 'node:assert';
import { submitReportSchema } from '../src/validators/report.validator.js';
import { createTicketSchema, replyTicketSchema } from '../src/validators/support.validator.js';

describe('Phase 8 Moderation & Support Rate Limiting & Validation Suite', () => {
  it('rejects oversized report payload or empty violation type', () => {
    assert.throws(() => {
      submitReportSchema.parse({
        violationType: '',
      });
    });

    assert.throws(() => {
      submitReportSchema.parse({
        violationType: 'SPAM',
        description: 'a'.repeat(1001), // Max 1000
      });
    });
  });

  it('rejects ticket creation with empty subject or empty message', () => {
    assert.throws(() => {
      createTicketSchema.parse({
        subject: '',
        message: 'Hello',
      });
    });

    assert.throws(() => {
      createTicketSchema.parse({
        subject: 'Valid Subject',
        message: 'bad', // Min 5, length 3 should throw
      });
    });
  });

  it('rejects empty ticket reply message', () => {
    assert.throws(() => {
      replyTicketSchema.parse({
        message: '',
      });
    });
  });
});
