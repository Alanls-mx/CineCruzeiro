import { Queue, QueueOptions } from 'bullmq';
import { redisClient } from './redis.js';

export const QUEUE_NAMES = {
  INCOMING: 'whatsapp-incoming',
  OUTGOING: 'whatsapp-outgoing',
  RETRY: 'whatsapp-retry',
} as const;

const defaultQueueOptions: QueueOptions = {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600 * 24, // keep for 24h
      count: 1000,
    },
    removeOnFail: {
      age: 3600 * 48, // keep for 48h
    },
  },
};

export const incomingQueue = new Queue(QUEUE_NAMES.INCOMING, defaultQueueOptions);
export const outgoingQueue = new Queue(QUEUE_NAMES.OUTGOING, defaultQueueOptions);
export const retryQueue = new Queue(QUEUE_NAMES.RETRY, defaultQueueOptions);
