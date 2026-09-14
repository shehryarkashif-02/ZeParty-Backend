import prisma from '../config/database.js';

/**
 * Creates a new pending AdminApproval request record.
 */
export async function createApproval(
  { requesterId, module, actionType, beforeStateJson = null, payloadStateJson },
  db = prisma
) {
  return await db.adminApproval.create({
    data: {
      requesterId,
      module,
      actionType,
      beforeStateJson,
      payloadStateJson,
      status: 'PENDING',
    },
    include: {
      requester: {
        select: { id: true, name: true, username: true },
      },
    },
  });
}

/**
 * Finds an approval request by ID with requester and reviewer details.
 */
export async function findById(id, db = prisma) {
  if (!id) return null;
  return await db.adminApproval.findUnique({
    where: { id },
    include: {
      requester: {
        select: { id: true, name: true, username: true },
      },
      approver: {
        select: { id: true, name: true, username: true },
      },
    },
  });
}

/**
 * Retrieves paginated approval requests with optional status and module filters.
 */
export async function findAll(
  { status, module, requesterId, page = 1, limit = 20 },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;
  if (module) where.module = module;
  if (requesterId) where.requesterId = requesterId;

  const skip = (Math.max(1, page) - 1) * limit;

  return await db.adminApproval.findMany({
    where,
    include: {
      requester: {
        select: { id: true, name: true, username: true },
      },
      approver: {
        select: { id: true, name: true, username: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
}

/**
 * Counts approval requests matching filters.
 */
export async function countAll(
  { status, module, requesterId },
  db = prisma
) {
  const where = {};
  if (status) where.status = status;
  if (module) where.module = module;
  if (requesterId) where.requesterId = requesterId;

  return await db.adminApproval.count({ where });
}

/**
 * Updates approval request status (e.g. to APPROVED or REJECTED).
 */
export async function updateStatus(
  id,
  { status, approverId, rejectionReason = null, auditLogId = null },
  db = prisma
) {
  return await db.adminApproval.update({
    where: { id },
    data: {
      status,
      approverId,
      rejectionReason,
      auditLogId,
    },
    include: {
      requester: {
        select: { id: true, name: true, username: true },
      },
      approver: {
        select: { id: true, name: true, username: true },
      },
    },
  });
}

export default {
  createApproval,
  findById,
  findAll,
  countAll,
  updateStatus,
};
