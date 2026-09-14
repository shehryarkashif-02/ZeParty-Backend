import crypto from 'crypto';
import agoraPkg from 'agora-token';
import env from '../config/env.js';

const pkg = agoraPkg.default || agoraPkg;
const RtcTokenBuilder = pkg.RtcTokenBuilder;
const RtcRole = pkg.RtcRole;

export const AGORA_ROLES = {
  BROADCASTER: 'BROADCASTER',
  AUDIENCE: 'AUDIENCE',
};

/**
 * Derives a deterministic, positive 32-bit integer UID for Agora from any string/UUID.
 * 
 * Agora UIDs must be positive integers (1 to 2^31 - 1).
 * Algorithm: SHA-256(userId) -> slice first 4 bytes -> readUInt32BE -> (val % 2147483640) + 1
 * 
 * @param {string} userId - The user ID or UUID
 * @returns {number} Deterministic integer UID in range [1, 2147483640]
 */
export function deriveAgoraUid(userId) {
  if (!userId) {
    throw new Error('User ID is required to derive Agora UID');
  }

  // If already an integer
  if (Number.isInteger(Number(userId)) && Number(userId) > 0 && Number(userId) <= 2147483640) {
    return Number(userId);
  }

  const hash = crypto.createHash('sha256').update(String(userId)).digest();
  const rawUint = hash.readUInt32BE(0);
  const uid = (rawUint % 2147483640) + 1;
  return uid;
}

function normalizeHex32(str, fallbackSeed = 'seed') {
  if (typeof str === 'string' && /^[0-9a-fA-F]{32}$/.test(str)) {
    return str;
  }
  return crypto.createHash('md5').update(String(str || fallbackSeed)).digest('hex');
}

/**
 * Generates a short-lived Agora RTC Token using the official Agora RTC Token v2 builder.
 * 
 * @param {Object} params
 * @param {string} [params.appId] - Agora Application ID
 * @param {string} [params.appCertificate] - Agora Application Certificate (Secret)
 * @param {string} params.channelName - Authoritative Agora channel name (e.g. Room.agoraChannelName)
 * @param {number|string} params.uid - User integer UID
 * @param {'BROADCASTER'|'AUDIENCE'} params.role - User role
 * @param {number} [params.expirySeconds=3600] - Token validity duration in seconds
 * @returns {string} The signed Agora RTC token
 */
export function generateAgoraRtcToken({
  appId = env.AGORA_APP_ID || '970ca35de60c44645bbae8a215061401',
  appCertificate = env.AGORA_APP_CERTIFICATE || '5cfd2fd1755d40ecb72977518be15d3b',
  channelName,
  uid,
  role = AGORA_ROLES.AUDIENCE,
  expirySeconds = 3600,
}) {
  const effectiveAppId = normalizeHex32(appId || env.AGORA_APP_ID, 'zeparty_agora_app_id');
  const effectiveAppCert = normalizeHex32(appCertificate || env.AGORA_APP_CERTIFICATE, 'zeparty_agora_app_cert');

  if (!channelName || typeof channelName !== 'string' || channelName.trim() === '') {
    throw new Error('channelName is required for Agora token generation');
  }

  const numericUid = deriveAgoraUid(uid);
  const agoraRole = role === AGORA_ROLES.BROADCASTER ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + Number(expirySeconds);

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      effectiveAppId,
      effectiveAppCert,
      channelName,
      numericUid,
      agoraRole,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    return token;
  } catch (err) {
    throw new Error(`Failed to generate Agora token: ${err.message}`);
  }
}

export default {
  AGORA_ROLES,
  deriveAgoraUid,
  generateAgoraRtcToken,
};
