import prisma from '../config/database.js';

export async function findAll(db = prisma) {
  return await db.policyConfiguration.findMany({
    orderBy: { key: 'asc' },
  });
}

export async function findByKey(key, db = prisma) {
  if (!key) return null;
  return await db.policyConfiguration.findUnique({
    where: { key: key.toUpperCase() },
  });
}

export async function upsertConfig(
  { key, valueJson, status = 'ACTIVE' },
  db = prisma
) {
  const normKey = key.toUpperCase();
  return await db.policyConfiguration.upsert({
    where: { key: normKey },
    update: {
      valueJson,
      status,
    },
    create: {
      key: normKey,
      valueJson,
      status,
    },
  });
}

export async function updateStatus(
  key,
  { status, disabledAt = null, autoRestoreAt = null },
  db = prisma
) {
  const normKey = key.toUpperCase();
  return await db.policyConfiguration.update({
    where: { key: normKey },
    data: {
      status,
      disabledAt,
      autoRestoreAt,
    },
  });
}

/**
 * Finds all configurations that are currently DISABLED and whose autoRestoreAt timestamp has passed.
 */
export async function findExpiredDisabledConfigs(
  currentDate = new Date(),
  db = prisma
) {
  return await db.policyConfiguration.findMany({
    where: {
      status: 'DISABLED',
      autoRestoreAt: {
        lte: currentDate,
      },
    },
  });
}

/**
 * Atomically restores a disabled configuration back to ACTIVE status.
 * Returns the updated record, or null if the record was already restored.
 */
export async function restoreExpiredConfig(key, db = prisma) {
  const normKey = key.toUpperCase();
  try {
    return await db.policyConfiguration.update({
      where: {
        key: normKey,
        status: 'DISABLED',
      },
      data: {
        status: 'ACTIVE',
        disabledAt: null,
        autoRestoreAt: null,
      },
    });
  } catch (err) {
    // If status was already ACTIVE or record changed concurrently
    return null;
  }
}

export default {
  findAll,
  findByKey,
  upsertConfig,
  updateStatus,
  findExpiredDisabledConfigs,
  restoreExpiredConfig,
};
