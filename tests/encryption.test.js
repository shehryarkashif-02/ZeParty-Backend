import { describe, it } from 'node:test';
import assert from 'node:assert';
import { encrypt, decrypt, maskSecret } from '../src/utils/encryption.util.js';

describe('Phase 1 AES-256-GCM Encryption & Masking Suite', () => {
  it('encrypts and decrypts sensitive plaintext back to original string', () => {
    const secret = 'sk_live_stripe_secret_key_1234567890abcdef';
    const encrypted = encrypt(secret);

    assert.notStrictEqual(encrypted, secret);
    assert.ok(encrypted.startsWith('v1:'));

    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, secret);
  });

  it('produces unique ciphertexts for identical plaintext across multiple calls (random IV)', () => {
    const secret = 'my_secret_token';
    const enc1 = encrypt(secret);
    const enc2 = encrypt(secret);

    assert.notStrictEqual(enc1, enc2);
    assert.strictEqual(decrypt(enc1), secret);
    assert.strictEqual(decrypt(enc2), secret);
  });

  it('fails decryption when ciphertext or authentication tag is tampered with', () => {
    const secret = 'super_confidential_data';
    const encrypted = encrypt(secret);
    const parts = encrypted.split(':');

    // Tamper with ciphertext by altering last char
    const tamperedCipher = parts[3].slice(0, -2) + 'ff';
    const tamperedPayload = `v1:${parts[1]}:${parts[2]}:${tamperedCipher}`;

    assert.throws(() => {
      decrypt(tamperedPayload);
    }, /Decryption failed/);
  });

  it('fails decryption when an incorrect decryption key is supplied', () => {
    const secret = 'paypal_client_secret_999';
    const encrypted = encrypt(secret, 'original-correct-key-32-chars-long!');

    assert.throws(() => {
      decrypt(encrypted, 'wrong-key-completely-different-32c!');
    }, /Decryption failed/);
  });

  it('handles empty or null inputs gracefully', () => {
    assert.strictEqual(encrypt(''), '');
    assert.strictEqual(encrypt(null), null);
    assert.strictEqual(decrypt(''), '');
    assert.strictEqual(decrypt(null), null);
  });

  it('masks sensitive API credentials correctly for Admin display', () => {
    assert.strictEqual(maskSecret('sk_live_1234567890abcdef'), '****cdef');
    assert.strictEqual(maskSecret('short', 4), '****hort');
    assert.strictEqual(maskSecret('abc', 4), '****');
    assert.strictEqual(maskSecret(null), '');
  });
});
