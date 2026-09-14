import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createPostSchema,
  createCommentSchema,
  reportContentSchema,
} from '../src/validators/post.validator.js';

describe('Phase 6 Social Validation & Anti-Abuse Schemas Suite', () => {
  it('rejects post exceeding 2000 characters or containing more than 9 media URLs', () => {
    // 1. Oversized content
    const hugeContent = 'a'.repeat(2001);
    assert.throws(() => {
      createPostSchema.parse({ content: hugeContent });
    });

    // 2. More than 9 media URLs
    const tenUrls = Array.from({ length: 10 }, (_, i) => `https://cdn.zeparty.app/img${i}.jpg`);
    assert.throws(() => {
      createPostSchema.parse({ content: 'Valid content', mediaUrls: tenUrls });
    });

    // 3. Valid post passes
    const valid = createPostSchema.parse({
      content: 'Hello ZeParty',
      mediaUrls: ['https://cdn.zeparty.app/img1.jpg'],
      visibility: 'FOLLOWERS',
    });
    assert.strictEqual(valid.visibility, 'FOLLOWERS');
  });

  it('rejects empty or oversized comments', () => {
    // Empty comment
    assert.throws(() => {
      createCommentSchema.parse({ content: '   ' });
    });

    // Oversized comment (> 1000 chars)
    assert.throws(() => {
      createCommentSchema.parse({ content: 'a'.repeat(1001) });
    });

    // Valid comment passes
    const valid = createCommentSchema.parse({ content: 'Awesome party!' });
    assert.strictEqual(valid.content, 'Awesome party!');
  });

  it('validates content report payloads strictly', () => {
    // Valid report
    const validReport = reportContentSchema.parse({
      targetType: 'POST',
      targetId: 'p-12345',
      violationType: 'INAPPROPRIATE_CONTENT',
      description: 'Contains policy violating imagery',
    });
    assert.strictEqual(validReport.targetType, 'POST');

    // Invalid targetType
    assert.throws(() => {
      reportContentSchema.parse({
        targetType: 'INVALID_TYPE',
        targetId: 'p-1',
        violationType: 'SPAM',
      });
    });
  });
});
