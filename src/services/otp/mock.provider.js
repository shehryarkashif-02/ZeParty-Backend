/**
 * Mock OTP Provider for development & automated testing.
 * Logs OTP securely to server logger without calling external SMS Gateway.
 */
export async function sendOtp({ destination, otp, purpose, logger }) {
  const message = `[MOCK OTP PROVIDER] Purpose: ${purpose} | Destination: ${destination} | Code: ${otp}`;
  if (logger && typeof logger.info === 'function') {
    logger.info({ destination, purpose, otp }, message);
  } else {
    console.log(`\x1b[36m${message}\x1b[0m`);
  }

  return {
    success: true,
    provider: 'mock',
    messageId: `mock-msg-${Date.now()}`,
  };
}

export default {
  sendOtp,
};
