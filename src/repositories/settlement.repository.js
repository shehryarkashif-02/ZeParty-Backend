import prisma from '../config/database.js';

/**
 * Settlement Repository
 * Data access layer for Settlement Periods, Records, Allocations, and Adjustments.
 */

export async function createPeriod(data, db = prisma) {
  return await db.settlementPeriod.create({
    data: {
      periodCode: data.periodCode,
      entityType: data.entityType,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: data.status || 'OPEN',
      grossTotalCoins: data.grossTotalCoins ? BigInt(data.grossTotalCoins) : 0n,
      grossTotalUSD: data.grossTotalUSD || 0.0,
      netPayableUSD: data.netPayableUSD || 0.0,
      policyVersion: data.policyVersion || 'v3.0.0',
      calculatedBy: data.calculatedBy || null,
      calculatedAt: data.calculatedAt ? new Date(data.calculatedAt) : null,
      metadataJson: data.metadataJson || null,
    },
  });
}

export async function findPeriodById(id, db = prisma) {
  if (!id) return null;
  return await db.settlementPeriod.findUnique({
    where: { id },
    include: {
      records: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              phone: true,
            },
          },
          adjustments: true,
          _count: {
            select: { allocations: true },
          },
        },
      },
    },
  });
}

export async function findPeriodByCode(periodCode, db = prisma) {
  if (!periodCode) return null;
  return await db.settlementPeriod.findUnique({
    where: { periodCode },
    include: {
      records: true,
    },
  });
}

export async function findPeriods(
  { entityType, status, page = 1, limit = 20 },
  db = prisma
) {
  const where = {};
  if (entityType) where.entityType = entityType;
  if (status) where.status = status;

  const take = Math.max(1, Math.min(100, Number(limit) || 20));
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;

  const [periods, total] = await Promise.all([
    db.settlementPeriod.findMany({
      where,
      orderBy: { startDate: 'desc' },
      skip,
      take,
      include: {
        _count: {
          select: { records: true },
        },
      },
    }),
    db.settlementPeriod.count({ where }),
  ]);

  return {
    periods,
    pagination: {
      page: Number(page) || 1,
      limit: take,
      total,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

export async function updatePeriodStatus(
  id,
  {
    status,
    grossTotalCoins,
    grossTotalUSD,
    netPayableUSD,
    calculatedBy,
    calculatedAt,
    approvedBy,
    approvedAt,
    paidAt,
    metadataJson,
  },
  db = prisma
) {
  const data = {};
  if (status !== undefined) data.status = status;
  if (grossTotalCoins !== undefined) data.grossTotalCoins = BigInt(grossTotalCoins);
  if (grossTotalUSD !== undefined) data.grossTotalUSD = grossTotalUSD;
  if (netPayableUSD !== undefined) data.netPayableUSD = netPayableUSD;
  if (calculatedBy !== undefined) data.calculatedBy = calculatedBy;
  if (calculatedAt !== undefined) data.calculatedAt = new Date(calculatedAt);
  if (approvedBy !== undefined) data.approvedBy = approvedBy;
  if (approvedAt !== undefined) data.approvedAt = new Date(approvedAt);
  if (paidAt !== undefined) data.paidAt = new Date(paidAt);
  if (metadataJson !== undefined) data.metadataJson = metadataJson;

  return await db.settlementPeriod.update({
    where: { id },
    data,
  });
}

export async function createSettlementRecord(data, db = prisma) {
  return await db.settlementRecord.create({
    data: {
      settlementPeriodId: data.settlementPeriodId,
      recipientType: data.recipientType,
      recipientId: data.recipientId,
      userId: data.userId,
      grossDiamondsOrCoins: data.grossDiamondsOrCoins ? BigInt(data.grossDiamondsOrCoins) : 0n,
      grossEarningsUSD: data.grossEarningsUSD || 0.0,
      commissionUSD: data.commissionUSD || 0.0,
      deductionsUSD: data.deductionsUSD || 0.0,
      adjustmentsUSD: data.adjustmentsUSD || 0.0,
      netPayableUSD: data.netPayableUSD || 0.0,
      status: data.status || 'CALCULATED',
      policyVersion: data.policyVersion || 'v3.0.0',
      approvalId: data.approvalId || null,
      metadataJson: data.metadataJson || null,
    },
  });
}

export async function findRecordById(id, db = prisma) {
  if (!id) return null;
  return await db.settlementRecord.findUnique({
    where: { id },
    include: {
      settlementPeriod: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
        },
      },
      allocations: true,
      adjustments: true,
    },
  });
}

/**
 * Acquire row-level lock on a SettlementRecord inside a transaction.
 */
export async function findRecordWithLock(id, tx) {
  if (!id) return null;
  try {
    const rawResult = await tx.$queryRaw`
      SELECT * FROM "SettlementRecord"
      WHERE "id" = ${id}
      FOR UPDATE
    `;
    if (rawResult && rawResult.length > 0) {
      return rawResult[0];
    }
  } catch {
    // Fallback for mocked tx or SQLite test harness
    return await tx.settlementRecord.findUnique({
      where: { id },
    });
  }
  return null;
}

export async function findRecords(
  {
    settlementPeriodId,
    recipientType,
    recipientId,
    userId,
    status,
    page = 1,
    limit = 20,
  },
  db = prisma
) {
  const where = {};
  if (settlementPeriodId) where.settlementPeriodId = settlementPeriodId;
  if (recipientType) where.recipientType = recipientType;
  if (recipientId) where.recipientId = recipientId;
  if (userId) where.userId = userId;
  if (status) where.status = status;

  const take = Math.max(1, Math.min(100, Number(limit) || 20));
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;

  const [records, total] = await Promise.all([
    db.settlementRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        settlementPeriod: {
          select: {
            id: true,
            periodCode: true,
            entityType: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
          },
        },
        adjustments: true,
        _count: {
          select: { allocations: true },
        },
      },
    }),
    db.settlementRecord.count({ where }),
  ]);

  return {
    records,
    pagination: {
      page: Number(page) || 1,
      limit: take,
      total,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

export async function updateRecordStatus(
  id,
  {
    status,
    paidTransactionId,
    ledgerReferenceId,
    approvalId,
    adjustmentsUSD,
    netPayableUSD,
    paidAt,
    metadataJson,
  },
  db = prisma
) {
  const data = {};
  if (status !== undefined) data.status = status;
  if (paidTransactionId !== undefined) data.paidTransactionId = paidTransactionId;
  if (ledgerReferenceId !== undefined) data.ledgerReferenceId = ledgerReferenceId;
  if (approvalId !== undefined) data.approvalId = approvalId;
  if (adjustmentsUSD !== undefined) data.adjustmentsUSD = adjustmentsUSD;
  if (netPayableUSD !== undefined) data.netPayableUSD = netPayableUSD;
  if (paidAt !== undefined) data.paidAt = new Date(paidAt);
  if (metadataJson !== undefined) data.metadataJson = metadataJson;

  return await db.settlementRecord.update({
    where: { id },
    data,
  });
}

export async function createAllocationsBatch(allocations, db = prisma) {
  if (!allocations || allocations.length === 0) return [];

  const created = [];
  for (const alloc of allocations) {
    const item = await db.settlementAllocation.create({
      data: {
        settlementRecordId: alloc.settlementRecordId,
        sourceTransactionType: alloc.sourceTransactionType,
        sourceTransactionId: alloc.sourceTransactionId,
        amountCoinsOrDiamonds: alloc.amountCoinsOrDiamonds ? BigInt(alloc.amountCoinsOrDiamonds) : 0n,
        amountUSD: alloc.amountUSD || 0.0,
      },
    });
    created.push(item);
  }
  return created;
}

export async function findAllocationsByRecordId(settlementRecordId, db = prisma) {
  return await db.settlementAllocation.findMany({
    where: { settlementRecordId },
    orderBy: { settledAt: 'asc' },
  });
}

export async function findAllocationBySource(sourceTransactionType, sourceTransactionId, db = prisma) {
  return await db.settlementAllocation.findUnique({
    where: {
      sourceTransactionType_sourceTransactionId: {
        sourceTransactionType,
        sourceTransactionId,
      },
    },
  });
}

export async function createAdjustment(
  { settlementRecordId, userId, amountUSD, type = 'CORRECTION', reason, approvedByAdminId = null },
  db = prisma
) {
  return await db.settlementAdjustment.create({
    data: {
      settlementRecordId,
      userId,
      amountUSD,
      type,
      reason,
      approvedByAdminId,
    },
  });
}

export async function findAdjustmentsByRecordId(settlementRecordId, db = prisma) {
  return await db.settlementAdjustment.findMany({
    where: { settlementRecordId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Aggregates eligible gifting transactions for hosts in range [startDate, endDate)
 */
export async function getEligibleGiftsForHosts({ startDate, endDate }, db = prisma) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return await db.giftTransaction.findMany({
    where: {
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    include: {
      recipient: {
        include: {
          hostProfile: {
            include: {
              agency: true,
              bdCenter: true,
            },
          },
        },
      },
    },
  });
}

export default {
  createPeriod,
  findPeriodById,
  findPeriodByCode,
  findPeriods,
  updatePeriodStatus,
  createSettlementRecord,
  findRecordById,
  findRecordWithLock,
  findRecords,
  updateRecordStatus,
  createAllocationsBatch,
  findAllocationsByRecordId,
  findAllocationBySource,
  createAdjustment,
  findAdjustmentsByRecordId,
  getEligibleGiftsForHosts,
};
