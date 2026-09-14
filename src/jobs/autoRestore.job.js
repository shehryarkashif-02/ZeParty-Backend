import crypto from 'crypto';
import redisClient from '../config/redis.js';
import autoRestoreService from '../services/autoRestore.service.js';

let intervalTimer = null;
const LOCK_KEY = 'lock:auto_restore_sweep';
const LOCK_TTL_MS = 30000; // 30 seconds

/**
 * Runs a single sweep with distributed Redis locking to prevent overlapping executions
 * across multiple backend instances.
 */
export async function runAutoRestoreSweep() {
  const workerId = crypto.randomUUID();
  let lockAcquired = false;

  try {
    if (redisClient.isOpen) {
      // Acquire distributed lock with NX (only if not exists) and PX (millisecond TTL)
      const res = await redisClient.set(LOCK_KEY, workerId, {
        NX: true,
        PX: LOCK_TTL_MS,
      });
      lockAcquired = res === 'OK';
    } else {
      // In standalone / test environments without active Redis cluster, proceed safely
      lockAcquired = true;
    }

    if (!lockAcquired) {
      return { skipped: true, reason: 'LOCKED_BY_ANOTHER_INSTANCE' };
    }

    const result = await autoRestoreService.restoreExpiredConfigurations();
    return result;
  } catch (err) {
    console.error('⚠️ Auto-restore background sweep error:', err.message);
    return { error: err.message };
  } finally {
    if (lockAcquired && redisClient.isOpen) {
      try {
        const currentLockVal = await redisClient.get(LOCK_KEY);
        if (currentLockVal === workerId) {
          await redisClient.del(LOCK_KEY);
        }
      } catch {
        // Safe lock expiration fallback
      }
    }
  }
}

let isRecovering = false;

/**
 * Runs immediate startup recovery sweep on server boot.
 */
export async function runStartupRecoverySweep() {
  if (isRecovering) {
    return;
  }
  isRecovering = true;
  console.log('🔄 Executing 15-day auto-restore startup recovery sweep...');
  try {
    const result = await runAutoRestoreSweep();
    if (result?.restoredCount > 0) {
      console.log(`✅ Auto-restore startup recovery completed: ${result.restoredCount} configurations restored.`);
    } else {
      console.log('✅ Auto-restore startup recovery completed: 0 expired configurations.');
    }
    return result;
  } catch (err) {
    console.error('⚠️ Startup recovery sweep failed:', err.message);
  } finally {
    isRecovering = false;
  }
}

/**
 * Initializes recurring background scheduler.
 */
export function startAutoRestoreScheduler({ intervalMs = 60000 } = {}) {
  if (intervalTimer) {
    clearInterval(intervalTimer);
  }

  // Periodic interval runner
  intervalTimer = setInterval(() => {
    runAutoRestoreSweep().catch(() => {});
  }, intervalMs);

  return intervalTimer;
}

export function stopAutoRestoreScheduler() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}

export default {
  runAutoRestoreSweep,
  runStartupRecoverySweep,
  startAutoRestoreScheduler,
  stopAutoRestoreScheduler,
};
