import reportService from '../services/report.service.js';
import { submitReportSchema } from '../validators/report.validator.js';

export async function submitReport(req, res, next) {
  try {
    const validated = submitReportSchema.parse(req.body);
    const result = await reportService.submitReport(
      {
        reporterUserId: req.user.id,
        ...validated,
      },
      { ipAddress: req.ip },
      req.db
    );

    return res.status(201).json({
      success: true,
      data: result.report,
      meta: {
        isDuplicate: result.isDuplicate,
        message: result.message,
      },
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
        userId: req.user.id,
        isAdmin: Boolean(req.user.isAdmin || req.admin),
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

export default {
  submitReport,
  getReportDetails,
};
