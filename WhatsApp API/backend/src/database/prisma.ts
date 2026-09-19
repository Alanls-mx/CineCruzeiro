import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e) => {
  logger.error(e, 'Prisma Client Error');
});

prisma.$on('warn', (e) => {
  logger.warn(e, 'Prisma Client Warning');
});
