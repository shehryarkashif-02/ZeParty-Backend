import prisma from '../config/database.js';
import reportRepository from '../repositories/report.repository.js';
import restrictionService from './restriction.service.js';
import socketEmitter from '../socket/socket.emitter.js';
import { SOCKET_EVENTS } from '../socket/socket.constants.js';

async function logAudit(
  {
    adminId,
    adminName,
    action,
    targetEntity,
    targetEntityId,
    beforeStateJson,
    afterStateJson,
    reason,
    ipAddress,
  },
  db = prisma
) {
  try {
    if (db.auditLog?.create) {
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
    }
  } catch (err) {
    console.error('Failed to write audit log in report.service:', err);
  }
}

/**
 * Submits a new user violation report with anti-spam deduplication.
 */
export async function submitReport(
  {
    reporterUserId,
    reportedUserId = null,
    reportedRoomId = null,
    reportedPostId = null,
    reportedCommentId = null,
    reportedMessageId = null,
    violationType,
    description = null,
    screenshotUrl = null,
    priority = 'MEDIUM',
  },
  { ipAddress = '127.0.0.1' } = {},
  db = prisma
) {
  if (!reporterUserId) {
    const error = new Error('Authentication required to submit report');
    error.statusCode = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  if (reportedUserId && reporterUserId === reportedUserId) {
    const error = new Error('You cannot report yourself');
    error.statusCode = 400;
    error.code = 'CANNOT_REPORT_SELF';
    throw error;
  }

  if (!reportedUserId && !reportedRoomId && !reportedPostId && !reportedCommentId && !reportedMessageId) {
    const error = new Error('At least one target entity must be specified for reporting');
    error.statusCode = 400;
    error.code = 'TARGET_REQUIRED';
    throw error;
  }

  // Check for duplicate unresolved report from the same user against the same target
  const existingActive = await reportRepository.findExistingActiveReport(
    {
      reporterUserId,
      reportedUserId,
      reportedRoomId,
      reportedPostId,
      reportedCommentId,
      reportedMessageId,
    },
    db
  );

  if (existingActive) {
    return {
      report: existingActive,
      isDuplicate: true,
      message: 'You have already submitted a report for this entity which is currently under review.',
    };
  }

  // Create authoritative Report
  const report = await reportRepository.createReport(
    {
      reporterUserId,
      reportedUserId,
      reportedRoomId,
      reportedPostId,
      reportedCommentId,
      reportedMessageId,
      violationType,
      description,
      screenshotUrl,
      priority,
      status: 'PENDING',
    },
    db
  );

  // Emit post-commit realtime event for admin monitoring
  socketEmitter.emitToAll(SOCKET_EVENTS.REPORT_CREATED, {
    reportId: report.id,
    reporterUserId,
    reportedUserId,
    violationType,
    priority,
    createdAt: report.createdAt.toISOString(),
  });

  return {
    report,
    isDuplicate: false,
    message: 'Report submitted successfully. Our Trust & Safety team is reviewing it.',
  };
}

/**
 * Retrieves report details with IDOR protection.
 */
export async function getReportDetails(id, viewerContext = {}, db = prisma) {
  const report = await reportRepository.findReportById(id, db);
  if (!report) {
    const error = new Error('Report not found');
    error.statusCode = 404;
    error.code = 'REPORT_NOT_FOUND';
    throw error;
  }

  // IDOR check: Only reporter or Admins may inspect report details
  const isReporter = viewerContext.userId && viewerContext.userId === report.reporterUserId;
  const isAdmin = viewerContext.isAdmin || false;

  if (!isReporter && !isAdmin) {
    const error = new Error('You are not authorized to view this report');
    error.statusCode = 403;
    error.code = 'FORBIDDEN_REPORT_ACCESS';
    throw error;
  }

  return report;
}

/**
 * Lists reports for Admin moderation queue.
 */
export async function listReports(filters, db = prisma) {
  return await reportRepository.findReports(filters, db);
}

/**
 * Assigns a report to a moderator.
 */
export async function assignReport(
  id,
  adminId,
  { adminName = 'Moderator', ipAddress = '127.0.0.1' } = {},
  db = prisma
) {
  const existing = await reportRepository.findReportById(id, db);
  if (!existing) {
    const error = new Error('Report not found');
    error.statusCode = 404;
    error.code = 'REPORT_NOT_FOUND';
    throw error;
  }

  const updated = await reportRepository.updateReport(
    id,
    {
      assignedAdminId: adminId,
      status: 'UNDER_REVIEW',
    },
    db
  );

  await logAudit(
    {
      adminId,
      adminName,
      action: 'REPORT_ASSIGNED',
      targetEntity: 'Report',
      targetEntityId: id,
      beforeStateJson: existing,
      afterStateJson: updated,
      reason: `Report assigned to admin ${adminName}`,
      ipAddress,
    },
    db
  );

  socketEmitter.emitToAll(SOCKET_EVENTS.REPORT_UPDATED, {
    reportId: id,
    status: 'UNDER_REVIEW',
    assignedAdminId: adminId,
  });

  return updated;
}

/**
 * Resolves or dismisses a report, optionally applying a penalty restriction to the target.
 */
export async function resolveReport(
  id,
  {
    status = 'RESOLVED',
    resolutionAction = 'ACTIONED',
    resolutionNotes = '',
    applyRestriction = false,
    restrictionType = 'MUTE',
    restrictionDays = 7,
    reason = null,
  } = {},
  { adminId = null, adminName = 'Super Admin', ipAddress = '127.0.0.1' } = {},
  db = prisma
) {
  const existing = await reportRepository.findReportById(id, db);
  if (!existing) {
    const error = new Error('Report not found');
    error.statusCode = 404;
    error.code = 'REPORT_NOT_FOUND';
    throw error;
  }

  const resolvedAt = new Date();

  const updated = await reportRepository.updateReport(
    id,
    {
      status,
      resolutionAction,
      resolutionNotes,
      resolvedAt,
      adminActionTaken: resolutionAction,
    },
    db
  );

  // If moderation action applies a restriction to target user
  let appliedRestriction = null;
  if (applyRestriction && existing.reportedUserId) {
    appliedRestriction = await restrictionService.applyRestriction(
      {
        userId: existing.reportedUserId,
        targetId: existing.reportedUserId,
        type: restrictionType,
        reason: reason || resolutionNotes || `Penalty resulting from Report ${id}`,
        durationDays: restrictionDays,
        createdByAdminId: adminId,
        adminName,
        ipAddress,
      },
      db
    );
  }

  await logAudit(
    {
      adminId,
      adminName,
      action: status === 'DISMISSED' ? 'REPORT_DISMISSED' : 'REPORT_RESOLVED',
      targetEntity: 'Report',
      targetEntityId: id,
      beforeStateJson: existing,
      afterStateJson: {
        ...updated,
        appliedRestrictionId: appliedRestriction?.id || null,
      },
      reason: resolutionNotes || `Report ${status} by ${adminName}`,
      ipAddress,
    },
    db
  );

  socketEmitter.emitToAll(SOCKET_EVENTS.REPORT_RESOLVED, {
    reportId: id,
    status,
    resolutionAction,
    resolvedAt: resolvedAt.toISOString(),
  });

  return {
    report: updated,
    appliedRestriction,
  };
}

/**
 * Retrieves stats for Trust & Safety dashboard.
 */
export async function getReportStats(db = prisma) {
  return await reportRepository.getReportStats(db);
}

export default {
  submitReport,
  getReportDetails,
  listReports,
  assignReport,
  resolveReport,
  getReportStats,
};
