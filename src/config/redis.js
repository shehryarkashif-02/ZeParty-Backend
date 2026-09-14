import { createClient } from 'redis';
import env from './env.js';

let redisClient = null;

export function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: env.REDIS_URL,
    });

    redisClient.on('error', (err) => {
      // Graceful error logging without crashing process
      if (env.NODE_ENV !== 'test') {
        console.warn('⚠️ Redis Connection Notice:', err.message);
      }
    });

    redisClient.on('connect', () => {
      console.log('🔌 Redis Client Connected');
    });
  }
  return redisClient;
}

export const redisProxy = {
  get isOpen() {
    return Boolean(redisClient && redisClient.isOpen);
  },
  get: (key) => getRedisClient().get(key),
  set: (key, val, opts) => getRedisClient().set(key, val, opts),
  del: (key) => getRedisClient().del(key),
  incr: (key) => getRedisClient().incr(key),
  expire: (key, seconds) => getRedisClient().expire(key, seconds),
  ttl: (key) => getRedisClient().ttl(key),
  ping: () => getRedisClient().ping(),
  duplicate: () => getRedisClient().duplicate(),
  connect: () => getRedisClient().connect(),
  disconnect: () => redisClient?.disconnect(),
  quit: () => redisClient?.quit(),
};

export default redisProxy;
