import announcementService from '../services/announcement.service.js';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  queryAdminAnnouncementsSchema,
  queryActiveAnnouncementsSchema,
  announcementIdParamSchema,
} from '../validators/announcement.validator.js';

export async function getAdminAnnouncements(req, res, next) {
  try {
    const validatedQuery = queryAdminAnnouncementsSchema.parse(req.query);
    const result = await announcementService.listAnnouncementsForAdmin(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'Announcements retrieved successfully',
      data: result.announcements,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminAnnouncementById(req, res, next) {
  try {
    const { id } = announcementIdParamSchema.parse(req.params);
    const announcement = await announcementService.getAnnouncementById(id);

    return res.status(200).json({
      success: true,
      message: 'Announcement retrieved successfully',
      data: announcement,
    });
  } catch (err) {
    next(err);
  }
}

export async function postAdminAnnouncement(req, res, next) {
  try {
    const validatedData = createAnnouncementSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const announcement = await announcementService.createAnnouncement(validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement,
    });
  } catch (err) {
    next(err);
  }
}

export async function putAdminAnnouncement(req, res, next) {
  try {
    const { id } = announcementIdParamSchema.parse(req.params);
    const validatedData = updateAnnouncementSchema.parse(req.body);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    const announcement = await announcementService.updateAnnouncement(id, validatedData, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminAnnouncement(req, res, next) {
  try {
    const { id } = announcementIdParamSchema.parse(req.params);
    const adminId = req.auth.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers['x-forwarded-for'];

    await announcementService.deleteAnnouncement(id, {
      adminId,
      adminName,
      ipAddress,
    });

    return res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function getActiveAnnouncements(req, res, next) {
  try {
    const validatedQuery = queryActiveAnnouncementsSchema.parse(req.query);
    const announcements = await announcementService.getActiveAnnouncements(validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'Active announcements retrieved successfully',
      data: announcements,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getAdminAnnouncements,
  getAdminAnnouncementById,
  postAdminAnnouncement,
  putAdminAnnouncement,
  deleteAdminAnnouncement,
  getActiveAnnouncements,
};
