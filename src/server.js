import http from 'http';
import app from './app.js';
import env from './config/env.js';
import prisma from './config/database.js';
import redisClient from './config/redis.js';
import { initSocketServer } from './socket/index.js';
import {
  runStartupRecoverySweep,
  startAutoRestoreScheduler,
  stopAutoRestoreScheduler,
} from './jobs/autoRestore.job.js';

let server;
let io;

async function connectDatabaseWithRetry(maxRetries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt === 1) {
        console.log('🔄 Connecting to PostgreSQL database via Prisma...');
      } else {
        console.log(`🔄 Connecting to PostgreSQL database via Prisma (attempt ${attempt}/${maxRetries})...`);
      }
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (err) {
      console.warn(`⚠️ Database connection attempt ${attempt} failed: ${err.message}`);
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
}

async function startServer() {
  try {
    console.log('🔄 Initializing ZeParty Backend Foundation...');

    // 1. Create HTTP Server and bind immediately to prevent cold boot 502 Bad Gateway
    server = http.createServer(app);
    server.listen(env.PORT, '0.0.0.0', () => {
      console.log(`🚀 Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
      console.log(`🔗 Health check available at http://localhost:${env.PORT}/health`);
    });

    // 2. Initialize Database connection with automatic retry
    connectDatabaseWithRetry()
      .then(async () => {
        // Run Phase 7 Auto-Restore Startup Recovery Sweep
        await runStartupRecoverySweep().catch((e) => console.warn('Recovery sweep warning:', e.message));
        // Start Phase 7 Recurring Auto-Restore Scheduler
        startAutoRestoreScheduler({ intervalMs: 60000 });
      })
      .catch((err) => {
        console.error('❌ Database connection failure:', err.message);
      });

    // 3. Initialize Redis connection and Realtime Socket.IO
    (async () => {
      try {
        console.log('🔄 Connecting to Redis...');
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }
        io = await initSocketServer(server);
        console.log('✅ Realtime Socket.IO server initialized');
      } catch (redisErr) {
        console.warn('⚠️ Redis / Socket.IO connection warning:', redisErr.message);
      }
    })();

  } catch (error) {
    console.error('❌ Failed to start ZeParty server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  // Stop background schedulers
  stopAutoRestoreScheduler();

  if (server) {
    console.log('🔄 Closing HTTP server...');
    server.close(() => {
      console.log('✅ HTTP server closed');
    });
  }

  try {
    console.log('🔄 Closing database connections...');
    await prisma.$disconnect();
    console.log('✅ Database connections disconnected');
  } catch (err) {
    console.error('❌ Error during database disconnect:', err);
  }

  try {
    if (redisClient.isOpen) {
      console.log('🔄 Closing Redis connection...');
      await redisClient.quit();
      console.log('✅ Redis connection closed');
    }
  } catch (err) {
    console.error('❌ Error during Redis disconnect:', err);
  }

  console.log('👋 Clean exit completed. Goodbye!');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
