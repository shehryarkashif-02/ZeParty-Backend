import prisma from '../config/database.js';
import agencyRepository from '../repositories/agency.repository.js';
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
    console.error('Failed to write audit log in agency.service:', err);
  }
}

export async function createAgency(data, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const existingCode = await agencyRepository.findAgencyByCode(data.agencyCode, db);
  if (existingCode) {
    const error = new Error(`Agency code "${data.agencyCode}" is already in use`);
    error.statusCode = 409;
    error.code = 'AGENCY_CODE_ALREADY_EXISTS';
    throw error;
  }

  const agency = await agencyRepository.createAgency(data, db);

  await logAudit({
    adminId,
    adminName,
    action: 'AGENCY_CREATED',
    targetEntity: 'Agency',
    targetEntityId: agency.id,
    afterStateJson: {
      agencyName: agency.agencyName,
      agencyCode: agency.agencyCode,
      ownerUserId: agency.ownerUserId,
      commissionRate: agency.commissionRate,
    },
    ipAddress,
  }, db);

  return agency;
}

export async function updateAgency(id, updates, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const agency = await agencyRepository.findAgencyById(id, db);
  if (!agency) {
    const error = new Error('Agency not found');
    error.statusCode = 404;
    error.code = 'AGENCY_NOT_FOUND';
    throw error;
  }

  const updatedAgency = await agencyRepository.updateAgency(id, updates, db);

  await logAudit({
    adminId,
    adminName,
    action: 'AGENCY_UPDATED',
    targetEntity: 'Agency',
    targetEntityId: id,
    beforeStateJson: {
      agencyName: agency.agencyName,
      commissionRate: agency.commissionRate,
      status: agency.status,
    },
    afterStateJson: updates,
    ipAddress,
  }, db);

  return updatedAgency;
}

export async function getAgencyDetails(id, db = prisma) {
  const agency = await agencyRepository.findAgencyById(id, db);
  if (!agency) {
    const error = new Error('Agency not found');
    error.statusCode = 404;
    error.code = 'AGENCY_NOT_FOUND';
    throw error;
  }
  return agency;
}

export async function bindHostToAgency({ agencyId, hostProfileId }, { adminId, adminName, ipAddress } = {}, db = prisma) {
  const agency = await agencyRepository.findAgencyById(agencyId, db);
  if (!agency) {
    const error = new Error('Agency not found');
    error.statusCode = 404;
    error.code = 'AGENCY_NOT_FOUND';
    throw error;
  }

  if (agency.status !== 'ACTIVE') {
    const error = new Error('Cannot bind host to an inactive/suspended agency');
    error.statusCode = 400;
    error.code = 'AGENCY_NOT_ACTIVE';
    throw error;
  }

  const host = await hostRepository.findHostProfileById(hostProfileId, db);
  if (!host) {
    const error = new Error('Host profile not found');
    error.statusCode = 404;
    error.code = 'HOST_NOT_FOUND';
    throw error;
  }

  const existingMember = await agencyRepository.findMember(agencyId, host.userId, db);
  if (existingMember) {
    const error = new Error('Host is already a member of this agency');
    error.statusCode = 409;
    error.code = 'ALREADY_AGENCY_MEMBER';
    throw error;
  }

  const member = await db.$transaction(async (tx) => {
    const newMember = await agencyRepository.addMember({
      agencyId,
      userId: host.userId,
      hostProfileId,
    }, tx);

    await hostRepository.updateHostProfile(hostProfileId, { agencyId }, tx);
    return newMember;
  });

  await logAudit({
    adminId,
    adminName,
    action: 'AGENCY_MEMBER_BOUND',
    targetEntity: 'AgencyMember',
    targetEntityId: member.id,
    afterStateJson: { agencyId, hostProfileId, userId: host.userId },
    ipAddress,
  }, db);

  return member;
}

export async function transferHostBetweenAgencies(
  { hostProfileId, fromAgencyId, toAgencyId, reason },
  { adminId, adminName, ipAddress } = {},
  db = prisma
) {
  if (fromAgencyId === toAgencyId) {
    const error = new Error('Source agency and destination agency cannot be the same');
    error.statusCode = 400;
    error.code = 'SAME_AGENCY_TRANSFER';
    throw error;
  }

  const destAgency = await agencyRepository.findAgencyById(toAgencyId, db);
  if (!destAgency || destAgency.status !== 'ACTIVE') {
    const error = new Error('Destination agency does not exist or is not active');
    error.statusCode = 404;
    error.code = 'INVALID_DESTINATION_AGENCY';
    throw error;
  }

  const host = await hostRepository.findHostProfileById(hostProfileId, db);
  if (!host) {
    const error = new Error('Host profile not found');
    error.statusCode = 404;
    error.code = 'HOST_NOT_FOUND';
    throw error;
  }

  const transferredMember = await db.$transaction(async (tx) => {
    return await agencyRepository.transferHostMembership(
      hostProfileId,
      fromAgencyId,
      toAgencyId,
      host.userId,
      tx
    );
  });

  await logAudit({
    adminId,
    adminName,
    action: 'AGENCY_MEMBER_TRANSFERRED',
    targetEntity: 'HostProfile',
    targetEntityId: hostProfileId,
    beforeStateJson: { agencyId: fromAgencyId },
    afterStateJson: { agencyId: toAgencyId },
    reason,
    ipAddress,
  }, db);

  return transferredMember;
}

export default {
  createAgency,
  updateAgency,
  getAgencyDetails,
  bindHostToAgency,
  transferHostBetweenAgencies,
};
