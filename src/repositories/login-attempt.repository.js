import prisma from '../config/database.js';

export async function recordLoginAttempt(
  { identifier, ipAddress, userAgent, isSuccessful, failureReason = null },
  db = prisma
) {
  return await db.loginAttempt.create({
    data: {
      identifier,
      ipAddress,
      userAgent,
      isSuccessful,
      failureReason,
    },
  });
}

export default {
  recordLoginAttempt,
};
