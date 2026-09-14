import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection string' }),
  PRISMA_LOG_QUERIES: z.preprocess((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
    return Boolean(val);
  }, z.boolean()).default(false),
  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid Redis connection URL' }),
  
  // Public Domain & CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SOCKET_CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().default('http://localhost:5000'),

  // Authentication & Security
  JWT_SECRET: z.string().min(16).default('super-secret-zeparty-jwt-key-change-in-prod-2026'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // OTP & Communications
  OTP_PROVIDER: z.enum(['mock', 'twilio', 'aws_sns']).default('mock'),
  OTP_EXPIRY_SECONDS: z.coerce.number().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_RATE_LIMIT_MAX: z.coerce.number().default(5),

  // Cryptography & Financial
  PAYMENT_ENCRYPTION_KEY: z.string().min(16).default('zeparty-payment-encryption-master-key-32b!'),
  OTP_ENCRYPTION_KEY: z.string().min(16).default('zeparty-otp-encryption-master-key-32b!'),

  // Agora Realtime Streaming
  AGORA_APP_ID: z.string().default('mock_agora_app_id_test_environment_12345'),
  AGORA_APP_CERTIFICATE: z.string().default('mock_agora_app_cert_test_environment_67890'),
  AGORA_TOKEN_EXPIRY_SECONDS: z.coerce.number().min(60).max(86400).default(3600),
  AGORA_MOCK_MODE: z.coerce.boolean().default(false),

  // Socket.IO & Redis Adapter
  SOCKET_REDIS_ENABLED: z.coerce.boolean().default(true),

  // Bootstrap Administrative Credentials
  SUPER_ADMIN_USERNAME: z.string().default('admin'),
  SUPER_ADMIN_EMAIL: z.string().email().default('admin@zeparty.app'),
  SUPER_ADMIN_PASSWORD: z.string().min(6).default('admin123'),
  OWNER_EMAIL: z.string().email().default('owner@zeparty.app'),
  OWNER_PASSWORD: z.string().min(6).default('owner123'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

export const env = _env.data;
export default env;
