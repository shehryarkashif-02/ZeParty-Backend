import prisma from '../config/database.js';

export const DEFAULT_PREFERENCES = {
  social: true,
  live: true,
  pk: true,
  games: true,
  events: true,
  finance: true,
  moderation: true,
  support: true,
  marketing: true,
  system: true,
};

/**
 * Retrieves notification preferences for a user, returning defaults if no row exists.
 */
export async function findByUserId(userId, db = prisma) {
  if (!userId) return null;

  const pref = await db.notificationPreference.findUnique({
    where: { userId },
  });

  if (!pref) {
    return {
      userId,
      ...DEFAULT_PREFERENCES,
    };
  }

  return pref;
}

/**
 * Upserts notification preferences for a user.
 */
export async function upsertPreferences(userId, data = {}, db = prisma) {
  const payload = {
    ...(data.social !== undefined ? { social: Boolean(data.social) } : {}),
    ...(data.live !== undefined ? { live: Boolean(data.live) } : {}),
    ...(data.pk !== undefined ? { pk: Boolean(data.pk) } : {}),
    ...(data.games !== undefined ? { games: Boolean(data.games) } : {}),
    ...(data.events !== undefined ? { events: Boolean(data.events) } : {}),
    ...(data.finance !== undefined ? { finance: Boolean(data.finance) } : {}),
    ...(data.moderation !== undefined ? { moderation: Boolean(data.moderation) } : {}),
    ...(data.support !== undefined ? { support: Boolean(data.support) } : {}),
    ...(data.marketing !== undefined ? { marketing: Boolean(data.marketing) } : {}),
    ...(data.system !== undefined ? { system: Boolean(data.system) } : {}),
  };

  return await db.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      ...DEFAULT_PREFERENCES,
      ...payload,
    },
    update: payload,
  });
}

export default {
  DEFAULT_PREFERENCES,
  findByUserId,
  upsertPreferences,
};
