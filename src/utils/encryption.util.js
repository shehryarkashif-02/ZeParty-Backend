import crypto from 'crypto';
import env from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = 'v1';

/**
 * Derives a 32-byte key buffer from a raw string key using SHA-256
 * @param {string} [customKey] 
 * @returns {Buffer}
 */
function deriveKey(customKey) {
  const rawKey = customKey || env.PAYMENT_ENCRYPTION_KEY || env.OTP_ENCRYPTION_KEY || 'default-zeparty-dev-key-32bytes!';
  return crypto.createHash('sha256').update(String(rawKey)).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM authenticated encryption.
 * 
 * @param {string} text - Plaintext to encrypt
 * @param {string} [customKey] - Optional override key
 * @returns {string} Serialized encrypted token format: "v1:iv_hex:auth_tag_hex:ciphertext_hex"
 */
export function encrypt(text, customKey) {
  if (text === null || text === undefined || text === '') {
    return text;
  }

  const keyBuffer = deriveKey(customKey);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${VERSION_PREFIX}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM formatted token.
 * 
 * @param {string} encryptedPayload - Formatted token "v1:iv_hex:auth_tag_hex:ciphertext_hex"
 * @param {string} [customKey] - Optional override key
 * @returns {string} Decrypted plaintext string
 * @throws {Error} If decryption or authentication verification fails
 */
export function decrypt(encryptedPayload, customKey) {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    return encryptedPayload;
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error('Invalid encrypted payload format');
  }

  const [, ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid encryption parameters');
  }

  const keyBuffer = deriveKey(customKey);
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('Decryption failed: authentication tag mismatch or invalid key');
  }
}

/**
 * Masks a sensitive API secret or key for safe display in Admin interfaces (e.g. "****4a8f")
 * 
 * @param {string} secret 
 * @param {number} [visibleCount=4] 
 * @returns {string}
 */
export function maskSecret(secret, visibleCount = 4) {
  if (!secret || typeof secret !== 'string') return '';
  if (secret.length <= visibleCount) return '****';
  const visible = secret.slice(-visibleCount);
  return `****${visible}`;
}

export default {
  encrypt,
  decrypt,
  maskSecret,
};
