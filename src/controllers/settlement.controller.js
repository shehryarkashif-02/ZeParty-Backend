import settlementService from '../services/settlement.service.js';
import settlementRepository from '../repositories/settlement.repository.js';
import hostRepository from '../repositories/host.repository.js';
import {
  calculateSettlementSchema,
  querySettlementPeriodsSchema,
  querySettlementRecordsSchema,
  createAdjustmentSchema,
} from '../validators/settlement.validator.js';

// ============================================================
// ADMIN SETTLEMENT CONTROLLERS
// ============================================================

export async function calculatePeriod(req, res, next) {
  try {
    const validated = calculateSettlementSchema.parse(req.body);
    const adminId = req.auth?.userId;
    const adminName = req.auth?.username || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const result = await settlementService.calculateSettlementPeriod({
      ...validated,
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Settlement period calculated successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPeriods(req, res, next) {
  try {
    const validated = querySettlementPeriodsSchema.parse(req.query);
    const result = await settlementRepository.findPeriods(validated);

    return res.status(200).json({
      success: true,
      data: result.periods.map(settlementService.serializeSettlementPeriod),
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPeriodById(req, res, next) {
  try {
    const { id } = req.params;
    const period = await settlementRepository.findPeriodById(id);
    if (!period) {
      return res.status(404).json({
        success: false,
        error: { code: 'SETTLEMENT_PERIOD_NOT_FOUND', message: 'Settlement period not found' },
      });
    }

    return res.status(200).json({
      success: true,
      data: settlementService.serializeSettlementPeriod(period),
    });
  } catch (err) {
    next(err);
  }
}

export async function getRecords(req, res, next) {
  try {
    const validated = querySettlementRecordsSchema.parse(req.query);
    const result = await settlementRepository.findRecords(validated);

    return res.status(200).json({
      success: true,
      data: result.records.map(settlementService.serializeSettlementRecord),
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getRecordById(req, res, next) {
  try {
    const { id } = req.params;
    const record = await settlementRepository.findRecordById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: { code: 'SETTLEMENT_NOT_FOUND', message: 'Settlement record not found' },
      });
    }

    return res.status(200).json({
      success: true,
      data: settlementService.serializeSettlementRecord(record),
    });
  } catch (err) {
    next(err);
  }
}

export async function submitRecordForApproval(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.auth?.userId;
    const adminName = req.auth?.username || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const result = await settlementService.submitSettlementForApproval({
      settlementRecordId: id,
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Settlement record submitted for approval successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function approveRecord(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.auth?.userId;
    const adminName = req.auth?.username || 'Administrator';
    const isOwner = Boolean(req.auth?.isOwner);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const result = await settlementService.approveSettlementRecord({
      settlementRecordId: id,
      adminId,
      adminName,
      isOwner,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Settlement record approved successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function payRecord(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.auth?.userId;
    const adminName = req.auth?.username || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const result = await settlementService.executeSettlementPayout({
      settlementRecordId: id,
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function adjustRecord(req, res, next) {
  try {
    const { id } = req.params;
    const validated = createAdjustmentSchema.parse(req.body);
    const adminId = req.auth?.userId;
    const adminName = req.auth?.username || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const result = await settlementService.createSettlementAdjustment({
      settlementRecordId: id,
      ...validated,
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Settlement adjustment created successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function reconcilePeriod(req, res, next) {
  try {
    const { id } = req.params;
    const result = await settlementService.reconcileSettlementPeriod(id);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// MOBILE / HOST / AGENCY / BD CONTROLLERS (IDOR PROTECTED)
// ============================================================

export async function getMyHostEarningsSummary(req, res, next) {
  try {
    const userId = req.auth?.userId;
    const hostProfile = await hostRepository.findHostProfileByUserId(userId);
    if (!hostProfile) {
      return res.status(404).json({
        success: false,
        error: { code: 'HOST_PROFILE_NOT_FOUND', message: 'Host profile not found' },
      });
    }

    const totalDiamonds = BigInt(hostProfile.totalDiamondsEarnedMonth ?? 0n);
    const dollarProgress = Number(totalDiamonds) / 10000;

    return res.status(200).json({
      success: true,
      data: {
        hostProfileId: hostProfile.id,
        hostType: hostProfile.hostType,
        hostStatus: hostProfile.hostStatus,
        hostLevel: hostProfile.hostLevel,
        totalLiveHoursMonth: hostProfile.totalLiveHoursMonth,
        totalDiamondsEarnedMonth: totalDiamonds.toString(),
        targetDaysAchieved: hostProfile.targetDaysAchieved,
        earningsUSD: Number(dollarProgress.toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyHostSettlements(req, res, next) {
  try {
    const userId = req.auth?.userId;
    const result = await settlementRepository.findRecords({
      userId,
      recipientType: 'HOST',
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    });

    return res.status(200).json({
      success: true,
      data: result.records.map(settlementService.serializeSettlementRecord),
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyHostSettlementById(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.auth?.userId;
    const record = await settlementRepository.findRecordById(id);

    if (!record || record.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: { code: 'SETTLEMENT_NOT_FOUND', message: 'Settlement record not found' },
      });
    }

    return res.status(200).json({
      success: true,
      data: settlementService.serializeSettlementRecord(record),
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyAgencySettlements(req, res, next) {
  try {
    const userId = req.auth?.userId;
    const result = await settlementRepository.findRecords({
      userId,
      recipientType: 'AGENCY',
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    });

    return res.status(200).json({
      success: true,
      data: result.records.map(settlementService.serializeSettlementRecord),
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyBDCenterSettlements(req, res, next) {
  try {
    const userId = req.auth?.userId;
    const result = await settlementRepository.findRecords({
      userId,
      recipientType: 'BD_CENTER',
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    });

    return res.status(200).json({
      success: true,
      data: result.records.map(settlementService.serializeSettlementRecord),
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  calculatePeriod,
  getPeriods,
  getPeriodById,
  getRecords,
  getRecordById,
  submitRecordForApproval,
  approveRecord,
  payRecord,
  adjustRecord,
  reconcilePeriod,
  getMyHostEarningsSummary,
  getMyHostSettlements,
  getMyHostSettlementById,
  getMyAgencySettlements,
  getMyBDCenterSettlements,
};
