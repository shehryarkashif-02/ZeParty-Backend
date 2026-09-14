import prisma from '../config/database.js';
import redisClient from '../config/redis.js';
import configurationRepository from '../repositories/configuration.repository.js';

export const EXACT_15_DAYS_MS = 15 * 24 * 60 * 60 * 1000; // 1,296,000,000 ms

/**
 * Calculates the exact timestamp 15 x 24 hours from the given date.
 */
export function calculateRestoreTimestamp(fromDate = new Date()) {
  return new Date(fromDate.getTime() + EXACT_15_DAYS_MS);
}

/**
 * Executes a sweep of all disabled configurations and restores those whose 15-day window has expired.
 * Thread-safe and idempotent: conditional update prevents duplicate restoration.
 */
export async function restoreExpiredConfigurations(currentDate = new Date()) {
  const expiredConfigs = await configurationRepository.findExpiredDisabledConfigs(currentDate);

  if (!expiredConfigs || expiredConfigs.length === 0) {
    return {
      restoredCount: 0,
      restoredKeys: [],
    };
  }

  const restoredKeys = [];

  for (const config of expiredConfigs) {
    // Atomically restore state in database
    const restored = await configurationRepository.restoreExpiredConfig(config.key);

    if (restored) {
      restoredKeys.push(config.key);

      // Invalidate Redis cache
      try {
        if (redisClient.isOpen) {
          await redisClient.del(`policy:config:${config.key.toUpperCase()}`);
        }
      } catch {
        // Safe fallback
      }

      // Record automated system audit log
      await prisma.auditLog.create({
        data: {
          adminId: 'system-auto-restore',
          adminName: 'System Auto-Restore Automation Engine',
          action: 'AUTO_RESTORE_EXECUTED',
          targetEntity: 'PolicyConfiguration',
          targetEntityId: restored.id,
          beforeStateJson: {
            status: 'DISABLED',
            disabledAt: config.disabledAt,
            autoRestoreAt: config.autoRestoreAt,
          },
          afterStateJson: {
            status: 'ACTIVE',
            restoredAt: currentDate.toISOString(),
          },
          reason: '15-day auto-restore duration (15 x 24h) elapsed; automatically re-enabled setting.',
          ipAddress: '127.0.0.1',
        },
      }).catch(() => {});
    }
  }

  return {
    restoredCount: restoredKeys.length,
    restoredKeys,
  };
}

/**
 * Manually triggered auto-restore sweep (e.g. from admin trigger endpoint or startup recovery).
 */
export async function manualTrigger({ adminId, isOwner = false, ipAddress } = {}) {
  const result = await restoreExpiredConfigurations();

  if (adminId) {
    await prisma.auditLog.create({
      data: {
        adminId,
        adminName: isOwner ? 'Root Owner' : 'Administrator',
        action: 'MANUAL_RESTORE_TRIGGERED',
        targetEntity: 'ScheduledJob',
        targetEntityId: 'auto-restore-sweep',
        afterStateJson: result,
        reason: 'Manual execution of 15-day auto-restore policy sweep',
        ipAddress,
      },
    }).catch(() => {});
  }

  return result;
}

export default {
  EXACT_15_DAYS_MS,
  calculateRestoreTimestamp,
  restoreExpiredConfigurations,
  manualTrigger,
};
