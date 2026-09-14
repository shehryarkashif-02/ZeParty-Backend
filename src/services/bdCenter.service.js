import crypto from 'crypto';
import prisma from '../config/database.js';
import bdCenterRepository from '../repositories/bdCenter.repository.js';
import hostRepository from '../repositories/host.repository.js';

async function logAudit({ adminId, adminName, action, targetEntity, targetEntityId, beforeStateJson, afterStateJson, reason, ipAddress }, db = prisma) {
  try {
    await db.auditLog.create({
      data: {
        adminId: adminId || 'SYSTEM',
        adminName: adminName || 'System',
        action,
        targetEntity,
        targetEntityId: targetEntityId || null,
        beforeStateJson: beforeStateJson ? JSON.parse(JSON.stringify(beforeStateJson)) : null,
        afterStateJson: afterStateJson ? JSON.parse(JSON.stringify(afterStateJson)) : null,
        reason: reason || null,
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to write audit log in bdCenter.service:', err);
  }
}

export async function createBDCenter(data, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const center = await bdCenterRepository.createBDCenter(data, db);

  await logAudit({
    adminId,
    adminName,
    action: 'BD_CENTER_CREATED',
    targetEntity: 'BDCenter',
    targetEntityId: center.id,
    afterStateJson: {
      centerName: center.centerName,
      regionCode: center.regionCode,
      managerUserId: center.managerUserId,
      currentTier: center.currentTier,
      baseSalaryUSD: center.baseSalaryUSD,
    },
    ipAddress,
  }, db);

  return center;
}

export async function updateBDCenter(id, updates, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const center = await bdCenterRepository.findBDCenterById(id, db);
  if (!center) {
    const error = new Error('BD Center not found');
    error.statusCode = 404;
    error.code = 'BD_CENTER_NOT_FOUND';
    throw error;
  }

  const updated = await bdCenterRepository.updateBDCenter(id, updates, db);

  await logAudit({
    adminId,
    adminName,
    action: 'BD_CENTER_UPDATED',
    targetEntity: 'BDCenter',
    targetEntityId: id,
    beforeStateJson: {
      centerName: center.centerName,
      currentTier: center.currentTier,
      baseSalaryUSD: center.baseSalaryUSD,
    },
    afterStateJson: updates,
    ipAddress,
  }, db);

  return updated;
}

export async function getBDCenterDetails(id, db = prisma) {
  const center = await bdCenterRepository.findBDCenterById(id, db);
  if (!center) {
    const error = new Error('BD Center not found');
    error.statusCode = 404;
    error.code = 'BD_CENTER_NOT_FOUND';
    throw error;
  }

  const calculatedDiamonds = await bdCenterRepository.calculateGroupDiamonds(id, db);

  return {
    ...center,
    totalGroupDiamondsMonth: calculatedDiamonds.toString(),
  };
}

export async function sendBDInvite({ bdCenterId, targetUserId }, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const center = await bdCenterRepository.findBDCenterById(bdCenterId, db);
  if (!center) {
    const error = new Error('BD Center not found');
    error.statusCode = 404;
    error.code = 'BD_CENTER_NOT_FOUND';
    throw error;
  }

  const existingPending = await bdCenterRepository.findPendingInvite(bdCenterId, targetUserId, db);
  if (existingPending) {
    const error = new Error('Target user already has a pending invitation for this BD Center');
    error.statusCode = 409;
    error.code = 'PENDING_INVITE_EXISTS';
    throw error;
  }

  // Cryptographically secure invitation code
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  const invitationCode = `BDC-${center.regionCode}-${randomSuffix}`;

  const invite = await bdCenterRepository.createInvite({
    bdCenterId,
    targetUserId,
    invitationCode,
  }, db);

  await logAudit({
    adminId,
    adminName,
    action: 'BD_INVITE_SENT',
    targetEntity: 'BDInvite',
    targetEntityId: invite.id,
    afterStateJson: { bdCenterId, targetUserId, invitationCode },
    ipAddress,
  }, db);

  return invite;
}

export async function validateInviteCode(invitationCode, db = prisma) {
  const invite = await bdCenterRepository.findInviteByCode(invitationCode, db);
  if (!invite) {
    const error = new Error('Invalid invitation code');
    error.statusCode = 404;
    error.code = 'INVITE_NOT_FOUND';
    throw error;
  }

  if (invite.status !== 'PENDING') {
    const error = new Error(`Invitation is no longer valid (status: ${invite.status})`);
    error.statusCode = 400;
    error.code = 'INVITE_NOT_ACTIVE';
    throw error;
  }

  return invite;
}

export async function acceptBDInvite(invitationCode, userId, { ipAddress } = {}, db = prisma) {
  const invite = await validateInviteCode(invitationCode, db);

  if (invite.targetUserId !== userId) {
    const error = new Error('This invitation code was issued to a different user');
    error.statusCode = 403;
    error.code = 'INVITE_USER_MISMATCH';
    throw error;
  }

  const result = await db.$transaction(async (tx) => {
    const updatedInvite = await bdCenterRepository.updateInvite(
      invite.id,
      {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      tx
    );

    // Update user status
    await tx.user.update({
      where: { id: userId },
      data: { userType: 'BD_AGENT' },
    });

    // If host profile exists, bind to BD Center
    const host = await hostRepository.findHostProfileByUserId(userId, tx);
    if (host) {
      await hostRepository.updateHostProfile(host.id, { bdCenterId: invite.bdCenterId }, tx);
    }

    return updatedInvite;
  });

  await logAudit({
    adminId: userId,
    adminName: 'User',
    action: 'BD_INVITE_ACCEPTED',
    targetEntity: 'BDInvite',
    targetEntityId: invite.id,
    beforeStateJson: { status: 'PENDING' },
    afterStateJson: { status: 'ACCEPTED', bdCenterId: invite.bdCenterId },
    ipAddress,
  }, db);

  return result;
}

export default {
  createBDCenter,
  updateBDCenter,
  getBDCenterDetails,
  sendBDInvite,
  validateInviteCode,
  acceptBDInvite,
};
