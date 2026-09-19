import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/bullmq.js';
import { redisClient } from '../queue/redis.js';
import { prisma } from '../database/prisma.js';
import { MessageStatus } from '@prisma/client';
import { logger } from '../config/logger.js';

export interface RetryJobData {
  companyId: string;
  externalMessageId: string;
  operation: string;
  payload: any;
  error: string;
  attempt: number;
}

export class RetryWorker {
  private worker: Worker | null = null;

  start() {
    this.worker = new Worker<RetryJobData>(
      QUEUE_NAMES.RETRY,
      async (job: Job<RetryJobData>) => {
        const { companyId, externalMessageId, operation, attempt } = job.data;

        logger.warn(
          { jobId: job.id, companyId, externalMessageId, operation, attempt },
          'Executing retry job with exponential backoff'
        );

        // Example retry logic: update message status if max attempts exceeded
        if (job.attemptsMade >= (job.opts.attempts || 3)) {
          logger.error(
            { jobId: job.id, externalMessageId },
            'Job permanently failed after exhausting retry attempts'
          );

          if (externalMessageId) {
            await prisma.message.updateMany({
              where: { companyId, externalMessageId },
              data: { status: MessageStatus.FAILED },
            });
          }
        }
      },
      {
        connection: redisClient,
        concurrency: 3,
      }
    );

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, error: err.message }, 'Retry worker job failed');
    });

    logger.info('Retry BullMQ Worker started');
    return this.worker;
  }

  async stop() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
