import { FastifyReply } from 'fastify';
import { logger } from '../../../config/logger.js';
import { redisClient } from '../../../queue/redis.js';
import { Redis } from 'ioredis';
import { env } from '../../../config/env.js';

interface SSEClient {
  id: string;
  companyId: string;
  reply: FastifyReply;
}

export class SSEService {
  private static nodeId = Math.random().toString(36).substring(2) + Date.now().toString(36);
  private static clients: Map<string, SSEClient> = new Map();
  private static subscriber: Redis | null = null;

  static initSubscriber() {
    if (this.subscriber) return;

    this.subscriber = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      db: env.REDIS_DB,
      lazyConnect: true,
    });

    this.subscriber
      .connect()
      .then(() => {
        this.subscriber?.subscribe('sse:company-events', (err) => {
          if (err) logger.error(err, 'Failed to subscribe to sse:company-events');
        });

        this.subscriber?.on('message', (_channel, messageStr) => {
          try {
            const { nodeId, companyId, event, data } = JSON.parse(messageStr);
            // Ignore events that originated from this exact node/process to prevent double broadcast
            if (nodeId === this.nodeId) {
              return;
            }
            this.broadcastLocal(companyId, event, data);
          } catch {
            // ignore
          }
        });
      })
      .catch((err) => {
        logger.warn({ err: err.message }, 'Could not connect Redis subscriber for SSE');
      });
  }

  static addClient(id: string, companyId: string, reply: FastifyReply) {
    this.initSubscriber();
    this.clients.set(id, { id, companyId, reply });

    logger.debug({ clientId: id, companyId }, 'SSE client connected to realtime feed');

    // Remove client on connection close
    reply.raw.on('close', () => {
      this.clients.delete(id);
      logger.debug({ clientId: id, companyId }, 'SSE client disconnected');
    });
  }

  private static broadcastLocal(companyId: string, event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of this.clients.values()) {
      if (client.companyId === companyId) {
        try {
          client.reply.raw.write(payload);
        } catch (e: any) {
          logger.warn({ clientId: client.id, err: e.message }, 'Failed writing to SSE client');
          this.clients.delete(client.id);
        }
      }
    }
  }

  static broadcastToCompany(companyId: string, event: string, data: any) {
    // 1. Send to local connected clients
    this.broadcastLocal(companyId, event, data);

    // 2. Publish to Redis so other processes (API / Worker) can broadcast to their clients
    try {
      redisClient
        .publish('sse:company-events', JSON.stringify({ nodeId: this.nodeId, companyId, event, data }))
        .catch(() => {});
    } catch {
      // ignore
    }
  }
}
