import { IncomingWorker } from './incoming.worker.js';
import { RetryWorker } from './retry.worker.js';
import { prisma } from '../database/prisma.js';
import { redisClient } from '../queue/redis.js';
import { logger } from '../config/logger.js';

async function bootstrapWorkers() {
  logger.info('🚀 Starting LumixEngine Queue Workers (Incoming & Retry)...');

  await prisma.$connect();
  await redisClient.connect().catch(() => {});

  const incomingWorker = new IncomingWorker();
  incomingWorker.start();

  const retryWorker = new RetryWorker();
  retryWorker.start();

  const signals = ['SIGINT', 'SIGTERM'];
  for (const sig of signals) {
    process.on(sig, async () => {
      logger.info(`Stopping workers on ${sig}...`);
      const forceExitTimer = setTimeout(() => {
        process.exit(0);
      }, 1500);
      forceExitTimer.unref();

      try {
        await incomingWorker.stop();
        await retryWorker.stop();
        await prisma.$disconnect();
        redisClient.disconnect();
      } catch (e) {
        // ignore error on shutdown
      }
      process.exit(0);
    });
  }
}

bootstrapWorkers();
