import prisma from '../config/database.js';
import settlementRepository from '../repositories/settlement.repository.js';
import hostRepository from '../repositories/host.repository.js';
import agencyRepository from '../repositories/agency.repository.js';
import bdCenterRepository from '../repositories/bdCenter.repository.js';
import walletRepository from '../repositories/wallet.repository.js';
import payrollService from './payroll.service.js';
import ledgerService from './ledger.service.js';
import approvalService from './approval.service.js';
import effectivePermissionsService from './effectivePermissions.service.js';
import { generateReference } from '../utils/reference.util.js';
import socketEmitter from '../socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../socket/socket.constants.js';

/**
 * Settlement Service
 * Master coordinator for Settlement Periods, Approvals, Payouts, Adjustments, and Reconciliations.
 */

async function logAudit({ adminId, adminName, action, targetEntity, targetEntityId, beforeStateJson, afterStateJson, reason, ipAddress }, db = prisma) {
  try {
    await db.auditLog.create({
      data: {
        adminId: adminId || null,
        adminName: adminName || (adminId ? 'Administrator' : 'System Automation'),
        action,
        targetEntity,
        targetEntityId,
        beforeStateJson: beforeStateJson || null,
        afterStateJson: afterStateJson || null,
        reason: reason || null,
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to write audit log in settlement.service:', err);
  }
}

export function serializeSettlementRecord(rec) {
  if (!rec) return null;
  return {
    ...rec,
    grossDiamondsOrCoins: rec.grossDiamondsOrCoins ? rec.grossDiamondsOrCoins.toString() : '0',
    grossEarningsUSD: Number(rec.grossEarningsUSD ?? 0),
    commissionUSD: Number(rec.commissionUSD ?? 0),
    deductionsUSD: Number(rec.deductionsUSD ?? 0),
    adjustmentsUSD: Number(rec.adjustmentsUSD ?? 0),
    netPayableUSD: Number(rec.netPayableUSD ?? 0),
  };
}

export function serializeSettlementPeriod(period) {
  if (!period) return null;
  return {
    ...period,
    grossTotalCoins: period.grossTotalCoins ? period.grossTotalCoins.toString() : '0',
    grossTotalUSD: Number(period.grossTotalUSD ?? 0),
    netPayableUSD: Number(period.netPayableUSD ?? 0),
    records: period.records ? period.records.map(serializeSettlementRecord) : undefined,
  };
}

/**
 * Calculates a complete settlement period.
 */
export async function calculateSettlementPeriod(
  {
    periodCode,
    entityType = 'HOST',
    startDate,
    endDate,
    adminId = null,
    adminName = null,
    ipAddress = '127.0.0.1',
  },
  db = prisma
) {
  if (!periodCode || !startDate || !endDate) {
    const error = new Error('periodCode, startDate, and endDate are required');
    error.statusCode = 400;
    error.code = 'INVALID_SETTLEMENT_PARAMS';
    throw error;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    const error = new Error('startDate must be strictly before endDate');
    error.statusCode = 400;
    error.code = 'INVALID_DATE_RANGE';
    throw error;
  }

  // 1. Check existing Period
  let period = await settlementRepository.findPeriodByCode(periodCode, db);
  if (period && ['APPROVED', 'PROCESSING', 'PAID'].includes(period.status)) {
    const error = new Error(`Cannot recalculate settlement period in ${period.status} status`);
    error.statusCode = 400;
    error.code = 'SETTLEMENT_ALREADY_LOCKED';
    throw error;
  }

  if (!period) {
    period = await settlementRepository.createPeriod(
      {
        periodCode,
        entityType,
        startDate: start,
        endDate: end,
        status: 'CALCULATING',
        calculatedBy: adminId,
        calculatedAt: new Date(),
      },
      db
    );
  } else {
    period = await settlementRepository.updatePeriodStatus(
      period.id,
      {
        status: 'CALCULATING',
        calculatedBy: adminId,
        calculatedAt: new Date(),
      },
      db
    );
  }

  // 2. Fetch Eligible Gift Transactions
  const eligibleGifts = await settlementRepository.getEligibleGiftsForHosts({ startDate: start, endDate: end }, db);

  let createdRecords = [];
  let totalCoins = 0n;
  let totalGrossUSD = 0.0;
  let totalNetUSD = 0.0;

  if (entityType === 'HOST') {
    const hostsResult = await hostRepository.findHostProfiles({ page: 1, limit: 1000 }, db);
    const hosts = hostsResult.hosts || [];

    for (const host of hosts) {
      const calculation = await payrollService.calculateHostPayroll({
        hostProfile: host,
        giftTransactions: eligibleGifts,
        liveHours: host.totalLiveHoursMonth,
        daysAchieved: host.targetDaysAchieved,
        db,
      });

      // Create settlement record
      const record = await settlementRepository.createSettlementRecord(
        {
          settlementPeriodId: period.id,
          recipientType: 'HOST',
          recipientId: host.id,
          userId: host.userId,
          grossDiamondsOrCoins: calculation.grossDiamondsOrCoins,
          grossEarningsUSD: calculation.grossEarningsUSD,
          commissionUSD: 0.0,
          deductionsUSD: calculation.deductionsUSD,
          adjustmentsUSD: calculation.adjustmentsUSD,
          netPayableUSD: calculation.netPayableUSD,
          status: 'CALCULATED',
          policyVersion: calculation.policyVersion,
        },
        db
      );

      // Create allocations
      if (calculation.allocations && calculation.allocations.length > 0) {
        const allocsWithRecordId = calculation.allocations.map((a) => ({
          ...a,
          settlementRecordId: record.id,
        }));
        await settlementRepository.createAllocationsBatch(allocsWithRecordId, db);
      }

      createdRecords.push(record);
      totalCoins += BigInt(calculation.grossDiamondsOrCoins);
      totalGrossUSD += calculation.grossEarningsUSD;
      totalNetUSD += calculation.netPayableUSD;
    }
  } else if (entityType === 'AGENCY') {
    const agenciesResult = await agencyRepository.findAgencies({ page: 1, limit: 1000 }, db);
    const agencies = agenciesResult.agencies || [];

    for (const agency of agencies) {
      // Find hosts in this agency
      const agencyHostsResult = await hostRepository.findHostProfiles({ agencyId: agency.id, page: 1, limit: 1000 }, db);
      const agencyHosts = agencyHostsResult.hosts || [];

      const hostPayrollResults = [];
      for (const h of agencyHosts) {
        const hostCalc = await payrollService.calculateHostPayroll({
          hostProfile: h,
          giftTransactions: eligibleGifts,
          db,
        });
        hostPayrollResults.push(hostCalc);
      }

      const agencyCalc = await payrollService.calculateAgencyCommissions({
        agency,
        hostPayrollResults,
        giftTransactions: eligibleGifts,
        db,
      });

      const record = await settlementRepository.createSettlementRecord(
        {
          settlementPeriodId: period.id,
          recipientType: 'AGENCY',
          recipientId: agency.id,
          userId: agency.ownerUserId,
          grossDiamondsOrCoins: agencyCalc.grossDiamondsOrCoins,
          grossEarningsUSD: agencyCalc.grossEarningsUSD,
          commissionUSD: agencyCalc.commissionUSD,
          deductionsUSD: agencyCalc.deductionsUSD,
          adjustmentsUSD: agencyCalc.adjustmentsUSD,
          netPayableUSD: agencyCalc.netPayableUSD,
          status: 'CALCULATED',
          policyVersion: agencyCalc.policyVersion,
        },
        db
      );

      if (agencyCalc.allocations && agencyCalc.allocations.length > 0) {
        const allocsWithRecordId = agencyCalc.allocations.map((a) => ({
          ...a,
          settlementRecordId: record.id,
        }));
        await settlementRepository.createAllocationsBatch(allocsWithRecordId, db);
      }

      createdRecords.push(record);
      totalCoins += BigInt(agencyCalc.grossDiamondsOrCoins);
      totalGrossUSD += agencyCalc.grossEarningsUSD;
      totalNetUSD += agencyCalc.netPayableUSD;
    }
  } else if (entityType === 'BD_CENTER') {
    const bdCentersResult = await bdCenterRepository.findBDCenters({ page: 1, limit: 1000 }, db);
    const bdCenters = bdCentersResult.bdCenters || [];

    for (const bd of bdCenters) {
      const bdCalc = await payrollService.calculateBDCenterSettlement({
        bdCenter: bd,
        agencyResults: [],
        directHostResults: [],
      });

      const record = await settlementRepository.createSettlementRecord(
        {
          settlementPeriodId: period.id,
          recipientType: 'BD_CENTER',
          recipientId: bd.id,
          userId: bd.managerUserId,
          grossDiamondsOrCoins: bdCalc.grossDiamondsOrCoins,
          grossEarningsUSD: bdCalc.grossEarningsUSD,
          commissionUSD: 0.0,
          deductionsUSD: bdCalc.deductionsUSD,
          adjustmentsUSD: bdCalc.adjustmentsUSD,
          netPayableUSD: bdCalc.netPayableUSD,
          status: 'CALCULATED',
          policyVersion: bdCalc.policyVersion,
        },
        db
      );

      if (bdCalc.allocations && bdCalc.allocations.length > 0) {
        const allocsWithRecordId = bdCalc.allocations.map((a) => ({
          ...a,
          settlementRecordId: record.id,
        }));
        await settlementRepository.createAllocationsBatch(allocsWithRecordId, db);
      }

      createdRecords.push(record);
      totalCoins += BigInt(bdCalc.grossDiamondsOrCoins);
      totalGrossUSD += bdCalc.grossEarningsUSD;
      totalNetUSD += bdCalc.netPayableUSD;
    }
  }

  // 3. Update Period Aggregate Status to CALCULATED
  const updatedPeriod = await settlementRepository.updatePeriodStatus(
    period.id,
    {
      status: 'CALCULATED',
      grossTotalCoins: totalCoins,
      grossTotalUSD: Number(totalGrossUSD.toFixed(2)),
      netPayableUSD: Number(totalNetUSD.toFixed(2)),
    },
    db
  );

  await logAudit({
    adminId,
    adminName,
    action: 'SETTLEMENT_PERIOD_CALCULATED',
    targetEntity: 'SettlementPeriod',
    targetEntityId: period.id,
    afterStateJson: {
      periodCode,
      entityType,
      recordsCount: createdRecords.length,
      grossTotalUSD: totalGrossUSD,
      netPayableUSD: totalNetUSD,
    },
    ipAddress,
  }, db);

  return serializeSettlementPeriod({
    ...period,
    ...updatedPeriod,
    records: createdRecords,
  });
}

/**
 * Submits a settlement record for Maker-Checker approval.
 */
export async function submitSettlementForApproval(
  {
    settlementRecordId,
    adminId,
    adminName,
    ipAddress = '127.0.0.1',
  },
  db = prisma
) {
  const record = await settlementRepository.findRecordById(settlementRecordId, db);
  if (!record) {
    const error = new Error('Settlement record not found');
    error.statusCode = 404;
    error.code = 'SETTLEMENT_NOT_FOUND';
    throw error;
  }

  if (record.status !== 'CALCULATED') {
    const error = new Error(`Cannot submit settlement record in ${record.status} status`);
    error.statusCode = 400;
    error.code = 'INVALID_SETTLEMENT_STATUS';
    throw error;
  }

  const netPayableUSD = Number(record.netPayableUSD);
  let approvalRecord = null;

  // Create approval request if amount requires Maker-Checker review
  if (netPayableUSD >= 100.0) {
    approvalRecord = await approvalService.createApprovalRequest(
      {
        requesterId: adminId,
        module: 'finance',
        actionType: 'SETTLEMENT_PAYOUT',
        payloadStateJson: {
          settlementRecordId: record.id,
          recipientType: record.recipientType,
          recipientId: record.recipientId,
          userId: record.userId,
          netPayableUSD,
        },
        beforeStateJson: {
          status: record.status,
          netPayableUSD,
        },
      },
      db
    );
  }

  const updated = await settlementRepository.updateRecordStatus(
    record.id,
    {
      status: 'PENDING_APPROVAL',
      approvalId: approvalRecord ? approvalRecord.id : null,
    },
    db
  );

  await logAudit({
    adminId,
    adminName,
    action: 'SETTLEMENT_SUBMITTED_FOR_APPROVAL',
    targetEntity: 'SettlementRecord',
    targetEntityId: record.id,
    afterStateJson: serializeSettlementRecord(updated),
    ipAddress,
  }, db);

  return serializeSettlementRecord(updated);
}

/**
 * Approves a settlement record adhering to Maker-Checker rules.
 */
export async function approveSettlementRecord(
  {
    settlementRecordId,
    adminId,
    adminName,
    isOwner = false,
    ipAddress = '127.0.0.1',
  },
  db = prisma
) {
  const record = await settlementRepository.findRecordById(settlementRecordId, db);
  if (!record) {
    const error = new Error('Settlement record not found');
    error.statusCode = 404;
    error.code = 'SETTLEMENT_NOT_FOUND';
    throw error;
  }

  if (!['CALCULATED', 'PENDING_APPROVAL'].includes(record.status)) {
    const error = new Error(`Cannot approve settlement in ${record.status} status`);
    error.statusCode = 400;
    error.code = 'INVALID_SETTLEMENT_STATUS';
    throw error;
  }

  // Maker-Checker Check: Approver must be authorized and not the submitter
  if (record.approvalId) {
    const approval = await approvalService.getApprovalById(record.approvalId, db);
    if (approval.requesterId === adminId && !isOwner) {
      const error = new Error('Maker-Checker Violation: You cannot approve your own settlement request.');
      error.statusCode = 403;
      error.code = 'SELF_APPROVAL_FORBIDDEN';
      throw error;
    }
  }

  const updated = await settlementRepository.updateRecordStatus(
    record.id,
    {
      status: 'APPROVED',
    },
    db
  );

  await logAudit({
    adminId,
    adminName,
    action: 'SETTLEMENT_RECORD_APPROVED',
    targetEntity: 'SettlementRecord',
    targetEntityId: record.id,
    afterStateJson: serializeSettlementRecord(updated),
    ipAddress,
  }, db);

  socketEmitter.emitToUser(record.userId, SOCKET_EVENTS.SETTLEMENT_APPROVED, {
    settlementRecordId: record.id,
    netPayableUSD: Number(record.netPayableUSD),
    timestamp: new Date().toISOString(),
  });

  return serializeSettlementRecord(updated);
}

/**
 * Executes payout for a settlement record (atomic ledger mutation + wallet credit + post-commit event).
 */
export async function executeSettlementPayout(
  {
    settlementRecordId,
    adminId,
    adminName,
    ipAddress = '127.0.0.1',
  },
  db = prisma
) {
  const refId = generateReference('SETTLE');

  // Execute inside atomic transaction with row locks
  const result = await db.$transaction(async (tx) => {
    // 1. Lock SettlementRecord row
    const lockedRecord = await settlementRepository.findRecordWithLock(settlementRecordId, tx);
    if (!lockedRecord) {
      const error = new Error('Settlement record not found');
      error.statusCode = 404;
      error.code = 'SETTLEMENT_NOT_FOUND';
      throw error;
    }

    if (lockedRecord.status === 'PAID') {
      const error = new Error('This settlement has already been paid.');
      error.statusCode = 400;
      error.code = 'SETTLEMENT_ALREADY_PAID';
      throw error;
    }

    if (!['APPROVED', 'CALCULATED'].includes(lockedRecord.status)) {
      const error = new Error(`Settlement cannot be paid in status: ${lockedRecord.status}`);
      error.statusCode = 400;
      error.code = 'INVALID_SETTLEMENT_STATUS';
      throw error;
    }

    // 2. Mark PROCESSING to prevent race
    await settlementRepository.updateRecordStatus(
      lockedRecord.id,
      { status: 'PROCESSING' },
      tx
    );

    // 3. Ensure recipient wallet exists & lock it
    let recipientWallet = await walletRepository.findByUserId(lockedRecord.userId, tx);
    if (!recipientWallet) {
      recipientWallet = await walletRepository.createWallet(lockedRecord.userId, tx);
    }
    await walletRepository.findWithLock(recipientWallet.id, tx);

    // 4. Calculate payout units
    const netUSD = Number(lockedRecord.netPayableUSD);
    const payoutCoinsOrDiamonds = BigInt(Math.round(netUSD * 10000));

    // Post Double-Entry Ledger Entry
    const operations = [
      {
        walletId: recipientWallet.id,
        coinDelta: lockedRecord.recipientType === 'AGENCY' ? payoutCoinsOrDiamonds : 0n,
        diamondDelta: lockedRecord.recipientType !== 'AGENCY' ? payoutCoinsOrDiamonds : 0n,
      },
    ];

    const ledgerPosting = await ledgerService.postTransaction({
      operations,
      referenceId: refId,
      transactionType: 'SETTLEMENT_PAYOUT',
      db: tx,
    });

    // 5. Update record status to PAID
    const paidRecord = await settlementRepository.updateRecordStatus(
      lockedRecord.id,
      {
        status: 'PAID',
        paidTransactionId: refId,
        ledgerReferenceId: refId,
        paidAt: new Date(),
      },
      tx
    );

    // 6. Record Audit Log inside transaction
    await tx.auditLog.create({
      data: {
        adminId: adminId || null,
        adminName: adminName || 'Administrator',
        action: 'SETTLEMENT_PAYOUT_EXECUTED',
        targetEntity: 'SettlementRecord',
        targetEntityId: lockedRecord.id,
        beforeStateJson: { status: lockedRecord.status, netPayableUSD: netUSD },
        afterStateJson: { status: 'PAID', paidTransactionId: refId, netPayableUSD: netUSD },
        reason: `Executed settlement payout of $${netUSD.toFixed(2)} for ${lockedRecord.recipientType} ${lockedRecord.recipientId}`,
        ipAddress,
      },
    });

    return {
      paidRecord,
      ledgerPosting,
      recipientUserId: lockedRecord.userId,
      netPayableUSD: netUSD,
    };
  });

  // Post-commit realtime emission
  socketEmitter.emitToUser(result.recipientUserId, SOCKET_EVENTS.SETTLEMENT_PAID, {
    settlementRecordId,
    referenceId: refId,
    netPayableUSD: result.netPayableUSD,
    paidAt: new Date().toISOString(),
  });

  return {
    success: true,
    message: 'Settlement payout executed successfully.',
    data: {
      settlementRecord: serializeSettlementRecord(result.paidRecord),
      referenceId: refId,
      ledgerPosting: result.ledgerPosting,
    },
  };
}

/**
 * Creates an additive settlement adjustment.
 */
export async function createSettlementAdjustment(
  {
    settlementRecordId,
    amountUSD,
    type = 'CORRECTION',
    reason,
    adminId,
    adminName,
    ipAddress = '127.0.0.1',
  },
  db = prisma
) {
  const record = await settlementRepository.findRecordById(settlementRecordId, db);
  if (!record) {
    const error = new Error('Settlement record not found');
    error.statusCode = 404;
    error.code = 'SETTLEMENT_NOT_FOUND';
    throw error;
  }

  if (record.status === 'PAID') {
    const error = new Error('Cannot adjust an already paid settlement');
    error.statusCode = 400;
    error.code = 'SETTLEMENT_ALREADY_PAID';
    throw error;
  }

  const amt = Number(amountUSD);
  if (isNaN(amt) || amt === 0) {
    const error = new Error('Adjustment amount must be a non-zero number');
    error.statusCode = 400;
    error.code = 'INVALID_ADJUSTMENT_AMOUNT';
    throw error;
  }

  const adjustment = await settlementRepository.createAdjustment(
    {
      settlementRecordId: record.id,
      userId: record.userId,
      amountUSD: amt,
      type,
      reason,
      approvedByAdminId: adminId,
    },
    db
  );

  const newAdjustmentsUSD = Number(record.adjustmentsUSD ?? 0) + amt;
  const newNetPayableUSD = Number(record.grossEarningsUSD ?? 0) - Number(record.deductionsUSD ?? 0) + newAdjustmentsUSD;

  const updatedRecord = await settlementRepository.updateRecordStatus(
    record.id,
    {
      adjustmentsUSD: Number(newAdjustmentsUSD.toFixed(2)),
      netPayableUSD: Number(newNetPayableUSD.toFixed(2)),
    },
    db
  );

  await logAudit({
    adminId,
    adminName,
    action: 'SETTLEMENT_ADJUSTMENT_CREATED',
    targetEntity: 'SettlementAdjustment',
    targetEntityId: adjustment.id,
    afterStateJson: {
      adjustmentId: adjustment.id,
      amountUSD: amt,
      type,
      reason,
      newNetPayableUSD,
    },
    ipAddress,
  }, db);

  socketEmitter.emitToUser(record.userId, SOCKET_EVENTS.SETTLEMENT_ADJUSTED, {
    settlementRecordId: record.id,
    adjustmentAmountUSD: amt,
    newNetPayableUSD,
    reason,
  });

  return {
    adjustment,
    updatedRecord: serializeSettlementRecord(updatedRecord),
  };
}

/**
 * Reconciles a settlement period to verify all accounting invariants.
 */
export async function reconcileSettlementPeriod(periodId, db = prisma) {
  const period = await settlementRepository.findPeriodById(periodId, db);
  if (!period) {
    const error = new Error('Settlement period not found');
    error.statusCode = 404;
    error.code = 'SETTLEMENT_PERIOD_NOT_FOUND';
    throw error;
  }

  const records = period.records || [];
  const discrepancies = [];
  let calculatedGrossTotal = 0.0;
  let calculatedNetTotal = 0.0;

  for (const rec of records) {
    const allocations = await settlementRepository.findAllocationsByRecordId(rec.id, db);
    const adjustments = await settlementRepository.findAdjustmentsByRecordId(rec.id, db);

    const gross = Number(rec.grossEarningsUSD);
    const deductions = Number(rec.deductionsUSD);
    const adjustmentsTotal = adjustments.reduce((acc, a) => acc + Number(a.amountUSD), 0);
    const expectedNet = Number((gross - deductions + adjustmentsTotal).toFixed(2));
    const actualNet = Number(rec.netPayableUSD);

    if (Math.abs(expectedNet - actualNet) > 0.001) {
      discrepancies.push({
        settlementRecordId: rec.id,
        recipientId: rec.recipientId,
        expectedNet,
        actualNet,
        delta: actualNet - expectedNet,
        reason: 'NET_PAYABLE_MISMATCH',
      });
    }

    calculatedGrossTotal += gross;
    calculatedNetTotal += actualNet;
  }

  const isBalanced = discrepancies.length === 0;

  return {
    periodId: period.id,
    periodCode: period.periodCode,
    isBalanced,
    discrepanciesCount: discrepancies.length,
    discrepancies,
    calculatedGrossTotal: Number(calculatedGrossTotal.toFixed(2)),
    calculatedNetTotal: Number(calculatedNetTotal.toFixed(2)),
    recordedGrossTotal: Number(period.grossTotalUSD),
    recordedNetTotal: Number(period.netPayableUSD),
  };
}

export default {
  serializeSettlementRecord,
  serializeSettlementPeriod,
  calculateSettlementPeriod,
  submitSettlementForApproval,
  approveSettlementRecord,
  executeSettlementPayout,
  createSettlementAdjustment,
  reconcileSettlementPeriod,
};
