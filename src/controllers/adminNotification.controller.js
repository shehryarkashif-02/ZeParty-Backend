import adminNotificationService from '../services/adminNotification.service.js';
import { broadcastNotificationSchema } from '../validators/notification.validator.js';

export async function broadcastNotification(req, res, next) {
  try {
    const validated = broadcastNotificationSchema.parse(req.body);
    const adminId = typeof req.auth?.userId === 'object' ? req.auth.userId?.id : req.auth?.userId;
    const adminName = req.admin?.name || 'Administrator';
    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';

    const result = await adminNotificationService.broadcastNotification({
      ...validated,
      adminId,
      adminName,
      ipAddress,
    });

    res.status(201).json({
      success: true,
      message: `Notification broadcast sent to ${result.recipientCount} users`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function listBroadcasts(req, res, next) {
  try {
    const { page, limit, search, type, audience } = req.query;

    const result = await adminNotificationService.listBroadcasts({
      page,
      limit,
      search,
      type,
      audience,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getBroadcastDetails(req, res, next) {
  try {
    const { id } = req.params;
    const broadcast = await adminNotificationService.getBroadcastDetails(id);

    res.status(200).json({
      success: true,
      data: { broadcast },
    });
  } catch (err) {
    next(err);
  }
}

export default {
  broadcastNotification,
  listBroadcasts,
  getBroadcastDetails,
};
