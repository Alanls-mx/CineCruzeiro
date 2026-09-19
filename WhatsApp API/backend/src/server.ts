import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './database/prisma.js';
import { redisClient } from './queue/redis.js';

async function startServer() {
  const app = buildApp();

  try {
    // Verify Prisma connection
    await prisma.$connect();
    logger.info('Database connected successfully via Prisma');

    // Verify Redis connection
    await redisClient.connect().catch((err) => {
      logger.warn(`Redis connect attempt: ${err.message}`);
    });

    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`🚀 LumixEngine WhatsApp API running at http://${env.HOST}:${env.PORT}`);

    // Graceful Shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info(`Received ${signal}. Gracefully shutting down...`);
        const forceExitTimer = setTimeout(() => {
          process.exit(0);
        }, 1500);
        forceExitTimer.unref();

        try {
          await app.close();
          await prisma.$disconnect();
          redisClient.disconnect();
        } catch (e) {
          // ignore error on shutdown
        }
        process.exit(0);
      });
    }
  } catch (err) {
    logger.fatal(err, 'Failed to start Fastify server');
    process.exit(1);
  }
}

startServer();
