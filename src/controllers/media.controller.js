import storageService from '../services/storage.service.js';

export async function uploadMedia(req, res, next) {
  try {
    const { folder = 'misc', dataBase64, mimeType } = req.body;
    const userId = req.auth?.userId;

    if (!dataBase64 || !mimeType) {
      return res.status(400).json({
        success: false,
        message: 'dataBase64 and mimeType are required for media upload.',
        error: { code: 'INVALID_PAYLOAD' },
      });
    }

    // Strip Base64 header if present (e.g., data:image/png;base64,...)
    const cleanBase64 = dataBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const result = await storageService.uploadFile({
      buffer,
      mimeType,
      folder,
      userId,
    });

    return res.status(201).json({
      success: true,
      data: result,
      message: 'Media uploaded successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function getPresignedUploadUrl(req, res, next) {
  try {
    const { mimeType, folder = 'misc' } = req.query;
    const userId = req.auth?.userId;

    if (!mimeType) {
      return res.status(400).json({
        success: false,
        message: 'mimeType query parameter is required.',
        error: { code: 'MISSING_MIME_TYPE' },
      });
    }

    const result = await storageService.generatePresignedUploadUrl({
      mimeType,
      folder,
      userId,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteMedia(req, res, next) {
  try {
    const { key } = req.params;
    const userId = req.auth?.userId;
    const userRole = req.auth?.role;

    // Verify ownership: key must contain user ID or user must be Admin/Owner
    if (userId && key.includes(`u_${userId}_`)) {
      // User owns the file
    } else if (userRole === 'OWNER' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      // Admin has override permission
    } else {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this media asset.',
        error: { code: 'FORBIDDEN_MEDIA_ACCESS' },
      });
    }

    const deleted = await storageService.deleteFile(key);

    return res.status(200).json({
      success: true,
      data: { deleted, storageKey: key },
      message: deleted ? 'Media asset deleted successfully.' : 'Asset not found or already deleted.',
    });
  } catch (error) {
    next(error);
  }
}

export default {
  uploadMedia,
  getPresignedUploadUrl,
  deleteMedia,
};
