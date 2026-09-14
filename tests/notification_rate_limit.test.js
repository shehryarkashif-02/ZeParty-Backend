import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  registerDeviceSchema,
  refreshTokenSchema,
  broadcastNotificationSchema,
} from '../src/validators/notification.validator.js';

describe('Phase 9 Notification Validation & Input Bounds Suite', () => {
  it('rejects empty device token on registration', () => {
    assert.throws(() => {
      registerDeviceSchema.parse({
        deviceToken: '',
      });
    });
  });

  it('rejects invalid platform identifier on registration', () => {
    assert.throws(() => {
      registerDeviceSchema.parse({
        deviceToken: 'valid-token',
        platform: 'playstation',
      });
    });
  });

  it('rejects broadcast with empty title or oversized body', () => {
    assert.throws(() => {
      broadcastNotificationSchema.parse({
        title: '',
        body: 'Valid message body',
      });
    });

    assert.throws(() => {
      broadcastNotificationSchema.parse({
        title: 'Valid Title',
        body: 'a'.repeat(1001), // Max 1000
      });
    });
  });
});
