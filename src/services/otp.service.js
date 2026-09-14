import env from '../config/env.js';
import { generateOtpCode, hashToken } from '../utils/crypto.util.js';
import { checkRateLimit } from '../utils/rate-limiter.util.js';
import { normalizePhone } from '../utils/phone.util.js';
import otpRepository from '../repositories/otp.repository.js';
import mockProvider from './otp/mock.provider.js';
import twilioProvider from './otp/twilio.provider.js';
import snsProvider from './otp/sns.provider.js';

export { normalizePhone };

export async function requestOtp({ phone, purpose = 'LOGIN', ipAddress, logger }) {
  const normalizedPhone = normalizePhone(phone);
  
  // Rate limiting check per phone number
  const phoneRateKey = `rate:otp:phone:${normalizedPhone}`;
  const phoneLimit = await checkRateLimit({
    key: phoneRateKey,
    limit: env.OTP_RATE_LIMIT_MAX,
    windowSeconds: 600, // 10 minutes
  });

  if (!phoneLimit.allowed) {
    const error = new Error('Too many OTP requests for this phone number. Please try again later.');
    error.status = 429;
    error.code = 'OTP_RATE_LIMITED';
    throw error;
  }

  // Rate limiting check per IP address
  if (ipAddress) {
    const ipRateKey = `rate:otp:ip:${ipAddress}`;
    const ipLimit = await checkRateLimit({
      key: ipRateKey,
      limit: env.OTP_RATE_LIMIT_MAX * 3,
      windowSeconds: 600,
    });

    if (!ipLimit.allowed) {
      const error = new Error('Too many OTP requests from this IP address.');
      error.status = 429;
      error.code = 'OTP_RATE_LIMITED';
      throw error;
    }
  }

  // Generate 6-digit numeric OTP
  const rawOtp = generateOtpCode(6);
  const codeHash = hashToken(rawOtp);
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_SECONDS * 1000);

  // Store hashed OTP in database
  await otpRepository.createOtp({
    destination: normalizedPhone,
    codeHash,
    purpose,
    expiresAt,
  });

  // Select provider & deliver
  let providerResult;
  if (env.OTP_PROVIDER === 'twilio') {
    providerResult = await twilioProvider.sendOtp({
      destination: normalizedPhone,
      otp: rawOtp,
      purpose,
      logger,
    });
  } else if (env.OTP_PROVIDER === 'aws_sns') {
    providerResult = await snsProvider.sendOtp({
      destination: normalizedPhone,
      otp: rawOtp,
      purpose,
      logger,
    });
  } else {
    // Default mock / dev / test provider
    providerResult = await mockProvider.sendOtp({
      destination: normalizedPhone,
      otp: rawOtp,
      purpose,
      logger,
    });
  }

  return {
    success: true,
    message: 'OTP verification code sent successfully.',
    expiresInSeconds: env.OTP_EXPIRY_SECONDS,
    ...(env.NODE_ENV === 'development' || env.NODE_ENV === 'test' ? { devOtp: rawOtp } : {}),
  };
}

export async function verifyOtp({ phone, code, purpose = 'LOGIN' }) {
  const normalizedPhone = normalizePhone(phone);
  const activeOtp = await otpRepository.findActiveOtp({
    destination: normalizedPhone,
    purpose,
  });

  if (!activeOtp) {
    const error = new Error('Invalid or expired OTP code.');
    error.status = 400;
    error.code = 'OTP_INVALID';
    throw error;
  }

  // Check attempt limit
  if (activeOtp.attempts >= env.OTP_MAX_ATTEMPTS) {
    await otpRepository.markConsumed(activeOtp.id);
    const error = new Error('Maximum OTP verification attempts exceeded. Please request a new code.');
    error.status = 400;
    error.code = 'OTP_MAX_ATTEMPTS';
    throw error;
  }

  // Compare hash
  const submittedHash = hashToken(code);
  if (submittedHash !== activeOtp.codeHash) {
    await otpRepository.incrementAttempts(activeOtp.id);
    const remaining = env.OTP_MAX_ATTEMPTS - (activeOtp.attempts + 1);
    const error = new Error(`Invalid OTP code. ${remaining} attempt(s) remaining.`);
    error.status = 400;
    error.code = 'OTP_INVALID';
    throw error;
  }

  // Mark OTP consumed (single use)
  await otpRepository.markConsumed(activeOtp.id);

  return {
    verified: true,
    destination: normalizedPhone,
    purpose,
  };
}

export default {
  normalizePhone,
  requestOtp,
  verifyOtp,
};
