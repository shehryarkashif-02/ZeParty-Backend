import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import env from './config/env.js';
import apiRoutes from './routes/index.js';
import { serializerMiddleware } from './utils/serializer.util.js';
import prisma from './config/database.js';
import redisClient from './config/redis.js';

const app = express();

// Correlation / Request ID Middleware
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

// Security HTTP headers
app.use(helmet());

// Trust Cloudflare and reverse proxy headers (CF-Connecting-IP, X-Forwarded-For, X-Forwarded-Proto)
app.set('trust proxy', 1);

// Flexible CORS origin resolution helper
const getAllowedOrigins = (originString) => {
  if (!originString || originString === '*') return '*';
  const origins = originString.split(',').map((o) => o.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
};

// CORS configuration
app.use(
  cors({
    origin: env.NODE_ENV === 'production' ? getAllowedOrigins(env.CORS_ORIGIN) : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Idempotency-Key'],
    credentials: true,
  })
);

// Request body parsers with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Pino request logger
app.use(
  pinoHttp({
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    genReqId: (req) => req.id || req.headers['x-request-id'] || crypto.randomUUID(),
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'body.password',
        'body.token',
        'body.otp',
        'body.refreshToken',
        'body.fcmToken',
        'body.secretKey',
        'body.pin',
        'body.cardNumber',
        'body.cvv',
      ],
      censor: '***',
    },
  })
);

// Global BigInt and Decimal response serializer
app.use(serializerMiddleware);

// Static uploads serving for media assets (CDN origin)
app.use('/uploads', express.static('public/uploads'));

// Top-level Health Checks (Liveness & Readiness)
app.get('/health/ping', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'pong',
  });
});

app.get('/health', async (req, res) => {
  const services = {
    api: 'up',
    database: 'down',
    redis: 'down',
  };

  let hasError = false;

  // Verify PostgreSQL / Prisma
  try {
    await prisma.$queryRaw`SELECT 1`;
    services.database = 'up';
  } catch (error) {
    if (req.log) req.log.error('Health Check - Database unreachable:', error);
    hasError = true;
  }

  // Verify Redis
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    const pingResult = await redisClient.ping();
    if (pingResult === 'PONG') {
      services.redis = 'up';
    }
  } catch (error) {
    if (req.log) req.log.error('Health Check - Redis unreachable:', error);
    hasError = true;
  }

  const statusCode = hasError ? 503 : 200;

  return res.status(statusCode).json({
    success: !hasError,
    status: hasError ? 'degraded' : 'healthy',
    services,
  });
});

// Register routes under /api
app.use('/api', apiRoutes);

// Global 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: {
      code: 'ROUTE_NOT_FOUND',
    },
  });
});

// Centralized error handler middleware
app.use((err, req, res, next) => {
  if (req.log) {
    req.log.error({ err, requestId: req.id }, 'Request handling error');
  } else {
    console.error('Unhandled request error:', err);
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  const status = err.status || (err.statusCode ? err.statusCode : 500);
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    },
  });
});

export default app;
