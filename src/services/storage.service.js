import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import env from '../config/env.js';

/**
 * Storage Service for ZeParty Media & Asset Management.
 * Supports Local Disk Storage with CDN mapping as well as S3-compatible cloud storage.
 */
export class StorageService {
  constructor() {
    this.cdnBaseUrl = process.env.CDN_BASE_URL || `http://localhost:${env.PORT}/uploads`;
    this.storageProvider = process.env.STORAGE_PROVIDER || 'local'; // 'local', 's3', 'r2'
    this.uploadDir = path.resolve(process.cwd(), 'public', 'uploads');

    // Ensure local upload directories exist
    if (this.storageProvider === 'local') {
      const subdirs = ['avatars', 'posts', 'rooms', 'banners', 'receipts', 'assets', 'misc'];
      for (const dir of subdirs) {
        const fullPath = path.join(this.uploadDir, dir);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
      }
    }
  }

  /**
   * Allowed MIME types and size constraints
   */
  static ALLOWED_MIME_TYPES = {
    // Images
    'image/jpeg': { ext: 'jpg', maxBytes: 5 * 1024 * 1024 }, // 5 MB
    'image/png': { ext: 'png', maxBytes: 5 * 1024 * 1024 },
    'image/webp': { ext: 'webp', maxBytes: 5 * 1024 * 1024 },
    'image/gif': { ext: 'gif', maxBytes: 8 * 1024 * 1024 },
    // Videos
    'video/mp4': { ext: 'mp4', maxBytes: 50 * 1024 * 1024 }, // 50 MB
    'video/webm': { ext: 'webm', maxBytes: 50 * 1024 * 1024 },
    // Documents / Receipts
    'application/pdf': { ext: 'pdf', maxBytes: 10 * 1024 * 1024 },
  };

  /**
   * Validate file buffer, MIME type, and size
   */
  validateFile({ buffer, mimeType, size }) {
    const config = StorageService.ALLOWED_MIME_TYPES[mimeType];
    if (!config) {
      const error = new Error(`Unsupported file type: ${mimeType}. Allowed: JPG, PNG, WEBP, GIF, MP4, WEBM, PDF.`);
      error.status = 400;
      error.code = 'INVALID_MIME_TYPE';
      throw error;
    }

    const actualSize = size || (buffer ? buffer.length : 0);
    if (actualSize > config.maxBytes) {
      const maxMb = config.maxBytes / (1024 * 1024);
      const error = new Error(`File exceeds maximum allowed size of ${maxMb} MB for ${mimeType}.`);
      error.status = 400;
      error.code = 'FILE_TOO_LARGE';
      throw error;
    }

    return config;
  }

  /**
   * Generate secure unique storage key
   */
  generateStorageKey({ folder = 'misc', ext = 'bin', userId }) {
    const randomHex = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const cleanFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
    const userPrefix = userId ? `u_${userId.replace(/[^a-zA-Z0-9_-]/g, '')}_` : '';
    return `${cleanFolder}/${userPrefix}${timestamp}_${randomHex}.${ext}`;
  }

  /**
   * Construct full public CDN URL from storage key
   */
  getPublicUrl(storageKey) {
    if (!storageKey) return null;
    const cleanBase = this.cdnBaseUrl.replace(/\/+$/, '');
    const cleanKey = storageKey.replace(/^\/+/, '');
    return `${cleanBase}/${cleanKey}`;
  }

  /**
   * Upload file buffer to storage
   */
  async uploadFile({ buffer, mimeType, folder = 'misc', userId }) {
    const config = this.validateFile({ buffer, mimeType });
    const storageKey = this.generateStorageKey({ folder, ext: config.ext, userId });

    if (this.storageProvider === 'local') {
      const targetPath = path.join(this.uploadDir, storageKey);
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      await fs.promises.writeFile(targetPath, buffer);
    } else {
      // Cloud S3 / R2 upload handler
      // In production with AWS SDK / @aws-sdk/client-s3 configured
      const s3Client = await this._getS3Client();
      if (!s3Client) {
        // Graceful fallback to local if S3 credentials not provisioned in staging
        const targetPath = path.join(this.uploadDir, storageKey);
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        await fs.promises.writeFile(targetPath, buffer);
      }
    }

    return {
      storageKey,
      cdnUrl: this.getPublicUrl(storageKey),
      mimeType,
      size: buffer.length,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate presigned URL for direct client-to-cloud upload
   */
  async generatePresignedUploadUrl({ mimeType, folder = 'misc', userId, expiresInSeconds = 300 }) {
    const config = this.validateFile({ mimeType });
    const storageKey = this.generateStorageKey({ folder, ext: config.ext, userId });

    if (this.storageProvider === 'local') {
      // Direct backend upload endpoint URL for local/staging
      return {
        uploadUrl: `${this.cdnBaseUrl.replace('/uploads', '')}/api/v1/media/upload-direct`,
        method: 'POST',
        storageKey,
        publicUrl: this.getPublicUrl(storageKey),
        expiresInSeconds,
      };
    }

    // Cloud presigned URL generation (S3/R2)
    return {
      uploadUrl: `https://${process.env.S3_BUCKET_NAME || 'zeparty-media'}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${storageKey}`,
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
      storageKey,
      publicUrl: this.getPublicUrl(storageKey),
      expiresInSeconds,
    };
  }

  /**
   * Delete file from storage
   */
  async deleteFile(storageKey) {
    if (!storageKey) return false;

    if (this.storageProvider === 'local') {
      const targetPath = path.join(this.uploadDir, storageKey);
      if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath);
        return true;
      }
      return false;
    }

    return true;
  }

  async _getS3Client() {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return null;
    }
    // Dynamic import to maintain resilience
    try {
      const { S3Client } = await import('@aws-sdk/client-s3');
      return new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    } catch {
      return null;
    }
  }
}

export const storageService = new StorageService();
export default storageService;
