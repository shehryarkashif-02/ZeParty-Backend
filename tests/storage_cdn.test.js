import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { StorageService } from '../src/services/storage.service.js';

describe('Phase 18 Storage & CDN Subsystem Suite', () => {
  let storageService;

  before(() => {
    storageService = new StorageService();
  });

  test('validates permitted MIME types correctly', () => {
    const validPng = storageService.validateFile({
      mimeType: 'image/png',
      size: 1024 * 1024,
    });
    assert.equal(validPng.ext, 'png');

    const validMp4 = storageService.validateFile({
      mimeType: 'video/mp4',
      size: 10 * 1024 * 1024,
    });
    assert.equal(validMp4.ext, 'mp4');

    const validPdf = storageService.validateFile({
      mimeType: 'application/pdf',
      size: 2 * 1024 * 1024,
    });
    assert.equal(validPdf.ext, 'pdf');
  });

  test('rejects unpermitted MIME types with 400 error', () => {
    assert.throws(
      () => {
        storageService.validateFile({
          mimeType: 'application/x-msdownload', // .exe
          size: 1024,
        });
      },
      (err) => err.code === 'INVALID_MIME_TYPE' && err.status === 400
    );
  });

  test('rejects files exceeding max size limits with 400 error', () => {
    assert.throws(
      () => {
        storageService.validateFile({
          mimeType: 'image/jpeg',
          size: 10 * 1024 * 1024, // 10 MB > 5 MB limit
        });
      },
      (err) => err.code === 'FILE_TOO_LARGE' && err.status === 400
    );
  });

  test('generates secure randomized storage keys with user prefix and folder', () => {
    const key = storageService.generateStorageKey({
      folder: 'avatars',
      ext: 'webp',
      userId: 'user-123-abc',
    });

    assert.match(key, /^avatars\/u_user-123-abc_\d+_[a-f0-9]{32}\.webp$/);
  });

  test('constructs clean CDN URLs without duplicate slashes', () => {
    const url = storageService.getPublicUrl('avatars/u_123_test.png');
    assert.ok(url.includes('/avatars/u_123_test.png'));
    assert.ok(!url.includes('//avatars'));
  });

  test('uploads file buffer to local storage and returns CDN URL', async () => {
    const dummyBuffer = Buffer.from('fake image content for test');
    const result = await storageService.uploadFile({
      buffer: dummyBuffer,
      mimeType: 'image/png',
      folder: 'avatars',
      userId: 'test-user-999',
    });

    assert.ok(result.storageKey);
    assert.ok(result.cdnUrl);
    assert.equal(result.mimeType, 'image/png');
    assert.equal(result.size, dummyBuffer.length);

    // Verify local file exists
    const fullLocalPath = path.join(storageService.uploadDir, result.storageKey);
    assert.ok(fs.existsSync(fullLocalPath));

    // Cleanup
    await storageService.deleteFile(result.storageKey);
    assert.ok(!fs.existsSync(fullLocalPath));
  });

  test('generates presigned upload URL payload', async () => {
    const presigned = await storageService.generatePresignedUploadUrl({
      mimeType: 'image/jpeg',
      folder: 'banners',
      userId: 'admin-1',
    });

    assert.ok(presigned.uploadUrl);
    assert.ok(presigned.storageKey);
    assert.ok(presigned.publicUrl);
    assert.equal(presigned.expiresInSeconds, 300);
  });
});
