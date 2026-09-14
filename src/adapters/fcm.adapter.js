/**
 * Firebase Cloud Messaging (FCM) Adapter.
 * 
 * Provides production-grade FCM push delivery with automatic invalid-token
 * detection and explicit Mock/Simulation Mode for test/development environments.
 */

let mockDeliveryLog = [];
let customMockHandler = null;

/**
 * Checks if FCM should operate in explicit Mock / Simulated Mode.
 */
export function isMockMode() {
  if (process.env.FCM_MOCK_MODE === 'true') return true;
  if (process.env.NODE_ENV === 'test') return true;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_PROJECT_ID) return true;
  return false;
}

/**
 * Sends push notification to a single device token.
 * 
 * @param {Object} params
 * @param {string} params.token - FCM device registration token
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification text
 * @param {Object} [params.data] - Key-value metadata for client routing
 * @param {string} [params.imageUrl] - Optional banner/image URL
 * @returns {Promise<Object>} Delivery result with status and error details
 */
export async function sendToDevice({ token, title, body, data = {}, imageUrl = null }) {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return {
      success: false,
      status: 'FAILED',
      error: { code: 'INVALID_ARGUMENT', message: 'FCM device token is required' },
      isInvalidToken: true,
    };
  }

  // Handle explicit or automated mock mode
  if (isMockMode()) {
    if (customMockHandler) {
      return await customMockHandler({ token, title, body, data, imageUrl });
    }

    // Simulated test failure hook for known bad tokens
    if (token.includes('invalid') || token.includes('expired')) {
      const result = {
        success: false,
        status: 'FAILED',
        error: { code: 'messaging/registration-token-not-registered', message: 'Token is no longer valid' },
        isInvalidToken: true,
      };
      mockDeliveryLog.push({ token, title, body, data, result, timestamp: new Date() });
      return result;
    }

    const result = {
      success: true,
      status: 'SIMULATED',
      messageId: `mock-msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isInvalidToken: false,
    };
    mockDeliveryLog.push({ token, title, body, data, result, timestamp: new Date() });
    return result;
  }

  try {
    // Production Firebase Admin SDK Integration if credentials configured
    // Note: Dynamically imported to ensure tests run without Firebase package errors
    const admin = await import('firebase-admin').catch(() => null);
    if (!admin || !admin.default || !admin.default.messaging) {
      return {
        success: false,
        status: 'FAILED',
        error: { code: 'FCM_NOT_CONFIGURED', message: 'Firebase Admin messaging is unavailable' },
        isInvalidToken: false,
      };
    }

    const message = {
      token,
      notification: {
        title,
        body,
        ...(imageUrl ? { imageUrl } : {}),
      },
      data: Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
      ),
    };

    const response = await admin.default.messaging().send(message);
    return {
      success: true,
      status: 'SENT',
      messageId: response,
      isInvalidToken: false,
    };
  } catch (error) {
    const isInvalid = isTokenError(error);
    return {
      success: false,
      status: 'FAILED',
      error: {
        code: error.code || 'UNKNOWN_FCM_ERROR',
        message: error.message,
      },
      isInvalidToken: isInvalid,
    };
  }
}

/**
 * Multicast sends push notification to an array of device tokens.
 * 
 * @param {Object} params
 * @param {string[]} params.tokens - Array of FCM device tokens
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification text
 * @param {Object} [params.data] - Key-value metadata
 * @returns {Promise<Object>} Batch delivery summary with list of invalid tokens for cleanup
 */
export async function sendMulticast({ tokens = [], title, body, data = {} }) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return {
      success: true,
      status: isMockMode() ? 'SIMULATED' : 'SENT',
      totalCount: 0,
      sentCount: 0,
      failureCount: 0,
      invalidTokens: [],
    };
  }

  const results = await Promise.allSettled(
    tokens.map((token) => sendToDevice({ token, title, body, data }))
  );

  let sentCount = 0;
  let failureCount = 0;
  const invalidTokens = [];

  results.forEach((res, idx) => {
    const token = tokens[idx];
    if (res.status === 'fulfilled') {
      if (res.value.success) {
        sentCount++;
      } else {
        failureCount++;
        if (res.value.isInvalidToken) {
          invalidTokens.push(token);
        }
      }
    } else {
      failureCount++;
    }
  });

  return {
    success: failureCount === 0 || sentCount > 0,
    status: isMockMode() ? 'SIMULATED' : 'SENT',
    totalCount: tokens.length,
    sentCount,
    failureCount,
    invalidTokens,
  };
}

/**
 * Checks if a Firebase error indicates an expired / invalid registration token.
 */
function isTokenError(error) {
  if (!error) return false;
  const errorCode = error.code || '';
  const message = error.message || '';
  return (
    errorCode === 'messaging/registration-token-not-registered' ||
    errorCode === 'messaging/invalid-registration-token' ||
    errorCode === 'messaging/invalid-argument' ||
    errorCode === 'messaging/mismatched-credential' ||
    message.includes('not registered') ||
    message.includes('invalid token')
  );
}

/**
 * Helper for tests to inspect simulated deliveries.
 */
export function getMockDeliveryLog() {
  return [...mockDeliveryLog];
}

/**
 * Helper for tests to reset simulated delivery logs.
 */
export function clearMockDeliveryLog() {
  mockDeliveryLog = [];
  customMockHandler = null;
}

/**
 * Sets a custom mock handler for test fixtures.
 */
export function setMockDeliveryHandler(handler) {
  customMockHandler = handler;
}

export default {
  isMockMode,
  sendToDevice,
  sendMulticast,
  getMockDeliveryLog,
  clearMockDeliveryLog,
  setMockDeliveryHandler,
};
