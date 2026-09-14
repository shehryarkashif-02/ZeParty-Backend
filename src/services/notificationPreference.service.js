import preferenceRepository from '../repositories/notificationPreference.repository.js';
import prisma from '../config/database.js';

/**
 * Retrieves notification preferences for a user.
 */
export async function getUserPreferences(userId, db = prisma) {
  if (!userId) {
    const err = new Error('User ID is required');
    err.statusCode = 400;
    err.code = 'INVALID_USER_ID';
    throw err;
  }

  return await preferenceRepository.findByUserId(userId, db);
}

/**
 * Updates notification preferences for a user.
 */
export async function updateUserPreferences(userId, preferencesData, db = prisma) {
  if (!userId) {
    const err = new Error('User ID is required');
    err.statusCode = 400;
    err.code = 'INVALID_USER_ID';
    throw err;
  }

  return await preferenceRepository.upsertPreferences(userId, preferencesData, db);
}

/**
 * Checks if a specific notification category is enabled in the user's preferences.
 */
export async function isCategoryEnabled(userId, categoryOrType, db = prisma) {
  if (!userId || !categoryOrType) return true;

  const key = String(categoryOrType).toLowerCase();
  const preferences = await preferenceRepository.findByUserId(userId, db);

  // Map known types to preference keys
  const mapping = {
    system: 'system',
    social: 'social',
    follower: 'social',
    like: 'social',
    comment: 'social',
    live: 'live',
    invitation: 'live',
    call: 'live',
    pk: 'pk',
    games: 'games',
    events: 'events',
    finance: 'finance',
    recharge: 'finance',
    wallet: 'finance',
    withdrawal: 'finance',
    settlement: 'finance',
    moderation: 'moderation',
    support: 'support',
    marketing: 'marketing',
  };

  const preferenceField = mapping[key] || 'system';
  return preferences[preferenceField] !== false;
}

export default {
  getUserPreferences,
  updateUserPreferences,
  isCategoryEnabled,
};
