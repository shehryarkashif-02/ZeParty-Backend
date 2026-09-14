import notificationService from '../services/notification.service.js';
import notificationDeviceService from '../services/notificationDevice.service.js';
import notificationPreferenceService from '../services/notificationPreference.service.js';
import {
  registerDeviceSchema,
  refreshTokenSchema,
  updatePreferencesSchema,
  notificationQuerySchema,
} from '../validators/notification.validator.js';

export async function registerDevice(req, res, next) {
  try {
    const validated = registerDeviceSchema.parse(req.body);
    const userId = req.auth.userId;

    const device = await notificationDeviceService.registerDevice({
      userId,
      ...validated,
    });

    res.status(200).json({
      success: true,
      message: 'Device registered successfully',
      data: { device },
    });
  } catch (err) {
    next(err);
  }
}

export async function refreshDeviceToken(req, res, next) {
  try {
    const validated = refreshTokenSchema.parse(req.body);
    const userId = req.auth.userId;

    const device = await notificationDeviceService.refreshToken({
      userId,
      ...validated,
    });

    res.status(200).json({
      success: true,
      message: 'Device token refreshed successfully',
      data: { device },
    });
  } catch (err) {
    next(err);
  }
}

export async function removeDevice(req, res, next) {
  try {
    const userId = req.auth.userId;
    const deviceId = req.params.id;
    const deviceToken = req.body?.deviceToken;

    const result = await notificationDeviceService.removeDevice({
      userId,
      deviceId,
      deviceToken,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getNotifications(req, res, next) {
  try {
    const query = notificationQuerySchema.parse(req.query);
    const userId = req.auth.userId;

    const result = await notificationService.getNotifications(userId, query);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const userId = req.auth.userId;
    const count = await notificationService.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    const updated = await notificationService.markAsRead(id, userId);
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: { notification: updated },
    });
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    const userId = req.auth.userId;
    const result = await notificationService.markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(req, res, next) {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    const result = await notificationService.deleteNotification(id, userId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPreferences(req, res, next) {
  try {
    const userId = req.auth.userId;
    const preferences = await notificationPreferenceService.getUserPreferences(userId);

    res.status(200).json({
      success: true,
      data: { preferences },
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePreferences(req, res, next) {
  try {
    const validated = updatePreferencesSchema.parse(req.body);
    const userId = req.auth.userId;

    const preferences = await notificationPreferenceService.updateUserPreferences(userId, validated);
    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: { preferences },
    });
  } catch (err) {
    next(err);
  }
}

export default {
  registerDevice,
  refreshDeviceToken,
  removeDevice,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
};
