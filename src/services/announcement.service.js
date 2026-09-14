import prisma from '../config/database.js';
import announcementRepository from '../repositories/announcement.repository.js';

async function logAudit(
  { adminId, adminName, action, targetEntity, targetEntityId, beforeStateJson, afterStateJson, reason, ipAddress },
  db = prisma
) {
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
    console.error('Failed to write audit log in announcement.service:', err);
  }
}

export async function createAnnouncement(
  data,
  { adminId, adminName, ipAddress } = {},
  db = prisma
) {
  const announcement = await announcementRepository.createAnnouncement(data, db);

  await logAudit(
    {
      adminId,
      adminName,
      action: 'ANNOUNCEMENT_CREATED',
      targetEntity: 'Announcement',
      targetEntityId: announcement.id,
      afterStateJson: announcement,
      ipAddress,
    },
    db
  );

  return announcement;
}

export async function getActiveAnnouncements({ targetAudience = 'ALL' } = {}, db = prisma) {
  return await announcementRepository.findActiveAnnouncements({ targetAudience, now: new Date() }, db);
}

export async function getAnnouncementById(id, db = prisma) {
  const announcement = await announcementRepository.findAnnouncementById(id, db);
  if (!announcement) {
    const error = new Error('Announcement not found');
    error.statusCode = 404;
    error.code = 'ANNOUNCEMENT_NOT_FOUND';
    throw error;
  }
  return announcement;
}

export async function listAnnouncementsForAdmin(filters, db = prisma) {
  return await announcementRepository.findAdminAnnouncements(filters, db);
}

export async function updateAnnouncement(
  id,
  data,
  { adminId, adminName, ipAddress } = {},
  db = prisma
) {
  const existing = await announcementRepository.findAnnouncementById(id, db);
  if (!existing) {
    const error = new Error('Announcement not found');
    error.statusCode = 404;
    error.code = 'ANNOUNCEMENT_NOT_FOUND';
    throw error;
  }

  const updated = await announcementRepository.updateAnnouncement(id, data, db);

  await logAudit(
    {
      adminId,
      adminName,
      action: 'ANNOUNCEMENT_UPDATED',
      targetEntity: 'Announcement',
      targetEntityId: id,
      beforeStateJson: existing,
      afterStateJson: updated,
      ipAddress,
    },
    db
  );

  return updated;
}

export async function deleteAnnouncement(
  id,
  { adminId, adminName, ipAddress } = {},
  db = prisma
) {
  const existing = await announcementRepository.findAnnouncementById(id, db);
  if (!existing) {
    const error = new Error('Announcement not found');
    error.statusCode = 404;
    error.code = 'ANNOUNCEMENT_NOT_FOUND';
    throw error;
  }

  await announcementRepository.deleteAnnouncement(id, db);

  await logAudit(
    {
      adminId,
      adminName,
      action: 'ANNOUNCEMENT_DELETED',
      targetEntity: 'Announcement',
      targetEntityId: id,
      beforeStateJson: existing,
      ipAddress,
    },
    db
  );

  return { success: true, id };
}

export default {
  createAnnouncement,
  getActiveAnnouncements,
  getAnnouncementById,
  listAnnouncementsForAdmin,
  updateAnnouncement,
  deleteAnnouncement,
};
