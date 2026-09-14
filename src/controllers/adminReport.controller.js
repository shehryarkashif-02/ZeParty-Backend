import reportService from '../services/report.service.js';
import { resolveReportSchema } from '../validators/report.validator.js';

export async function listReports(req, res, next) {
  try {
    const { status, priority, violationType, reporterUserId, reportedUserId, reportedRoomId, search, page, limit } = req.query;
    const result = await reportService.listReports(
      {
        status,
        priority,
        violationType,
        reporterUserId,
        reportedUserId,
        reportedRoomId,
        search,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      },
      req.db
    );

    return res.status(200).json({
      success: true,
      data: result.reports,
      meta: result.pagination,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getReportDetails(req, res, next) {
  try {
    const report = await reportService.getReportDetails(
      req.params.id,
      {
        isAdmin: true,
        userId: req.admin?.id,
      },
      req.db
    );

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (err) {
    return next(err);
  }
}

export async function assignReport(req, res, next) {
  try {
    const reportId = req.params.id;
    const adminId = req.body.adminId || req.admin?.id;
    const updated = await reportService.assignReport(
      reportId,
      adminId,
      {
        adminName: req.admin?.name || req.admin?.username || 'Moderator',
        ipAddress: req.ip,
      },
      req.db
    );

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
}

export async function resolveReport(req, res, next) {
  try {
    const reportId = req.params.id;
    const validated = resolveReportSchema.parse(req.body);

    const result = await reportService.resolveReport(
      reportId,
      validated,
      {
        adminId: req.admin?.id,
        adminName: req.admin?.name || req.admin?.username || 'Super Admin',
        ipAddress: req.ip,
      },
      req.db
    );

    return res.status(200).json({
      success: true,
      data: result.report,
      meta: {
        appliedRestriction: result.appliedRestriction,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getReportStats(req, res, next) {
  try {
    const stats = await reportService.getReportStats(req.db);
    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err) {
    return next(err);
  }
}

export default {
  listReports,
  getReportDetails,
  assignReport,
  resolveReport,
  getReportStats,
};
