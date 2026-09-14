import { PrismaClient } from '@prisma/client';
import env from './env.js';

const getPrismaLogLevels = () => {
  if (env.PRISMA_LOG_QUERIES) {
    return ['query', 'info', 'warn', 'error'];
  }
  if (env.NODE_ENV === 'development') {
    return ['warn', 'error'];
  }
  return ['error'];
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
  log: getPrismaLogLevels(),
});

export default prisma;
