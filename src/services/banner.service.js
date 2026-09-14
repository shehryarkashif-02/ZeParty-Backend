import prisma from '../config/database.js';
import bannerRepository from '../repositories/banner.repository.js';

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
    console.error('Failed to write audit log in banner.service:', err);
  }
}

export async function createBanner(
  data,
  { adminId, adminName, ipAddress } = {},
  db = prisma
) {
  const banner = await bannerRepository.createBanner(data, db);

  await logAudit(
    {
      adminId,
      adminName,
      action: 'BANNER_CREATED',
      targetEntity: 'Banner',
      targetEntityId: banner.id,
      afterStateJson: banner,
      ipAddress,
    },
    db
  );

  return banner;
}

export async function getActiveBanners(db = prisma) {
  return await bannerRepository.findActiveBanners(new Date(), db);
}

export async function getBannerById(id, db = prisma) {
  const banner = await bannerRepository.findBannerById(id, db);
  if (!banner) {
    const error = new Error('Banner not found');
    error.statusCode = 404;
    error.code = 'BANNER_NOT_FOUND';
    throw error;
  }
  return banner;
}

export async function listBannersForAdmin(filters, db = prisma) {
  return await bannerRepository.findAdminBanners(filters, db);
}

export async function updateBanner(
  id,
  data,
  { adminId, adminName, ipAddress } = {},
  db = prisma
) {
  const existing = await bannerRepository.findBannerById(id, db);
  if (!existing) {
    const error = new Error('Banner not found');
    error.statusCode = 404;
    error.code = 'BANNER_NOT_FOUND';
    throw error;
  }

  const updated = await bannerRepository.updateBanner(id, data, db);

  await logAudit(
    {
      adminId,
      adminName,
      action: 'BANNER_UPDATED',
      targetEntity: 'Banner',
      targetEntityId: id,
      beforeStateJson: existing,
      afterStateJson: updated,
      ipAddress,
    },
    db
  );

  return updated;
}

export async function deleteBanner(
  id,
  { adminId, adminName, ipAddress } = {},
  db = prisma
) {
  const existing = await bannerRepository.findBannerById(id, db);
  if (!existing) {
    const error = new Error('Banner not found');
    error.statusCode = 404;
    error.code = 'BANNER_NOT_FOUND';
    throw error;
  }

  await bannerRepository.deleteBanner(id, db);

  await logAudit(
    {
      adminId,
      adminName,
      action: 'BANNER_DELETED',
      targetEntity: 'Banner',
      targetEntityId: id,
      beforeStateJson: existing,
      ipAddress,
    },
    db
  );

  return { success: true, id };
}

export default {
  createBanner,
  getActiveBanners,
  getBannerById,
  listBannersForAdmin,
  updateBanner,
  deleteBanner,
};
