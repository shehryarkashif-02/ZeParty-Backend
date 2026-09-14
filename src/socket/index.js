import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import env from '../config/env.js';
import redisClient from '../config/redis.js';
import socketAuthMiddleware from './auth.js';
import socketEmitter from './socket.emitter.js';
import { registerRoomHandlers } from './room.socket.js';
import { registerSeatHandlers } from './seat.socket.js';
import { registerGiftHandlers } from './gift.socket.js';
import { registerPKHandlers } from './pk.socket.js';

let ioInstance = null;

/**
 * Initializes and configures the Socket.IO realtime server.
 * 
 * @param {import('http').Server} httpServer - Node.js HTTP server instance
 * @returns {Promise<import('socket.io').Server>}
 */
export async function initSocketServer(httpServer) {
  if (ioInstance) return ioInstance;

  const resolveSocketOrigin = (originString) => {
    if (!originString || originString === '*') return '*';
    const origins = originString.split(',').map((o) => o.trim()).filter(Boolean);
    return origins.length === 1 ? origins[0] : origins;
  };

  const corsOrigin = env.NODE_ENV === 'production' && env.SOCKET_CORS_ORIGIN !== '*'
    ? resolveSocketOrigin(env.SOCKET_CORS_ORIGIN)
    : '*';

  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Optional Redis Adapter for Distributed Multi-Instance Deployments
  if (env.SOCKET_REDIS_ENABLED && redisClient.isOpen) {
    try {
      const pubClient = redisClient.duplicate();
      const subClient = redisClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log('✅ Socket.IO Redis adapter connected successfully');
    } catch (adapterErr) {
      console.warn('⚠️ Socket.IO Redis adapter fallback to in-memory mode:', adapterErr.message);
    }
  }

  // Socket Authentication Middleware
  io.use(socketAuthMiddleware);

  // Connection Handler
  io.on('connection', (socket) => {
    // Automatically join authenticated user's private channel
    socket.join(`user:${socket.userId}`);

    // Register domain handlers
    registerRoomHandlers(io, socket);
    registerSeatHandlers(io, socket);
    registerGiftHandlers(io, socket);
    registerPKHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      // Handled in room.socket.js onSocketDisconnect
    });
  });

  socketEmitter.setSocketServerInstance(io);
  ioInstance = io;

  return io;
}

export function getIO() {
  return ioInstance;
}

export default {
  initSocketServer,
  getIO,
};
