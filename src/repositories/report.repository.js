import prisma from '../config/database.js';

/**
 * Creates a new Report record.
 */
export async function createReport(data, db = prisma) {
  return await db.report.create({
    data,
    include: {
      reporter: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
      reportedUser: {
        select: {
          id: true,
          username: true,
          status: true,
        },
      },
    },
  });
}

/**
 * Finds a Report by unique ID.
 */
export async function findReportById(id, db = prisma) {
  return await db.report.findUnique({
    where: { id },
    include: {
      reporter: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          userType: true,
          status: true,
        },
      },
      reportedUser: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          status: true,
          userType: true,
        },
      },
      assignedAdmin: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
  });
}

/**
 * Checks for existing unresolved report from the same reporter against the same target.
 */
export async function findExistingActiveReport(
  {
    reporterUserId,
    reportedUserId = null,
    reportedRoomId = null,
    reportedPostId = null,
    reportedCommentId = null,
    reportedMessageId = null,
  },
  db = prisma
) {
  const where = {
    reporterUserId,
    status: { in: ['PENDING', 'UNDER_REVIEW'] },
  };

  if (reportedUserId) where.reportedUserId = reportedUserId;
  if (reportedRoomId) where.reportedRoomId = reportedRoomId;
  if (reportedPostId) where.reportedPostId = reportedPostId;
  if (reportedCommentId) where.reportedCommentId = reportedCommentId;
  if (reportedMessageId) where.reportedMessageId = reportedMessageId;

  return await db.report.findFirst({
    where,
  });
}

/**
 * Lists reports with flexible filtering, search, and pagination.
 */
export async function findReports(
  {
    status = null,
    priority = null,
    violationType = null,
    reporterUserId = null,
    reportedUserId = null,
    reportedRoomId = null,
    search = '',
    page = 1,
    limit = 20,
  } = {},
  db = prisma
) {
  const skip = (Math.max(1, page) - 1) * limit;
  const take = Math.min(100, Math.max(1, limit));

  const where = {};

  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (priority && priority !== 'ALL') {
    where.priority = priority;
  }
  if (violationType) {
    where.violationType = violationType;
  }
  if (reporterUserId) {
    where.reporterUserId = reporterUserId;
  }
  if (reportedUserId) {
    where.reportedUserId = reportedUserId;
  }
  if (reportedRoomId) {
    where.reportedRoomId = reportedRoomId;
  }

  if (search && search.trim()) {
    const s = search.trim();
    where.OR = [
      { id: { contains: s, mode: 'insensitive' } },
      { description: { contains: s, mode: 'insensitive' } },
      { violationType: { contains: s, mode: 'insensitive' } },
      { reporter: { username: { contains: s, mode: 'insensitive' } } },
      { reportedUser: { username: { contains: s, mode: 'insensitive' } } },
    ];
  }

  const [total, reports] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      skip,
      take,
      orderBy: [
        { createdAt: 'desc' },
      ],
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        reportedUser: {
          select: {
            id: true,
            username: true,
            status: true,
          },
        },
        assignedAdmin: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    }),
  ]);

  return {
    reports,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

/**
 * Updates a report (status, assignment, resolution notes, etc.).
 */
export async function updateReport(id, data, db = prisma) {
  return await db.report.update({
    where: { id },
    data,
    include: {
      reporter: {
        select: { id: true, username: true },
      },
      reportedUser: {
        select: { id: true, username: true, status: true },
      },
      assignedAdmin: {
        select: { id: true, name: true, username: true },
      },
    },
  });
}

/**
 * Aggregates statistics for moderation reports dashboard.
 */
export async function getReportStats(db = prisma) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    totalReports,
    pendingReview,
    underReview,
    resolvedToday,
    reportsToday,
  ] = await Promise.all([
    db.report.count(),
    db.report.count({ where: { status: 'PENDING' } }),
    db.report.count({ where: { status: 'UNDER_REVIEW' } }),
    db.report.count({
      where: {
        status: 'RESOLVED',
        resolvedAt: { gte: startOfDay },
      },
    }),
    db.report.count({
      where: {
        createdAt: { gte: startOfDay },
      },
    }),
  ]);

  return {
    totalReports,
    pendingReview: pendingReview + underReview,
    actionedToday: resolvedToday,
    reportsToday,
    appealsPending: 0,
  };
}

export default {
  createReport,
  findReportById,
  findExistingActiveReport,
  findReports,
  updateReport,
  getReportStats,
};
