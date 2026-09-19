import { prisma } from '../../../database/prisma.js';
import { incomingQueue } from '../../../queue/bullmq.js';
import { EvolutionWebhookPayload } from './webhooks.types.js';
import { normalizeEvolutionMessage } from './webhooks.normalizer.js';
import { IdempotencyService } from './idempotency.service.js';
import { WhatsAppInstanceStatus } from '@prisma/client';
import { logger } from '../../../config/logger.js';

export class WebhooksService {
  constructor(private readonly idempotencyService = new IdempotencyService()) {}

  async handleEvolutionWebhook(payload: EvolutionWebhookPayload) {
    const instanceName = payload.instance;
    if (!instanceName) {
      logger.warn({ payload }, 'Received webhook without instance name');
      return { received: true, ignored: true, reason: 'missing_instance_name' };
    }

    // 1. Find the instance and its company
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { instanceName },
      select: { id: true, companyId: true, status: true, provider: true },
    });

    if (!instance) {
      logger.warn({ instanceName }, 'Received webhook for unregistered instance in LumixEngine');
      return { received: true, ignored: true, reason: 'instance_not_registered' };
    }

    const event = payload.event;

    // 2. Handle Connection Update
    if (event === 'CONNECTION_UPDATE' || event === 'connection.update') {
      const state = payload.data?.state || payload.data?.status;
      logger.info({ instanceName, state }, 'Webhook CONNECTION_UPDATE received');

      if (state === 'open' || state === 'connected') {
        await prisma.whatsAppInstance.update({
          where: { id: instance.id },
          data: {
            status: WhatsAppInstanceStatus.CONNECTED,
            connectedAt: new Date(),
          },
        });
      } else if (state === 'close' || state === 'disconnected') {
        await prisma.whatsAppInstance.update({
          where: { id: instance.id },
          data: {
            status: WhatsAppInstanceStatus.DISCONNECTED,
            disconnectedAt: new Date(),
          },
        });
      } else if (state === 'connecting') {
        await prisma.whatsAppInstance.update({
          where: { id: instance.id },
          data: {
            status: WhatsAppInstanceStatus.CONNECTING,
          },
        });
      }

      return { received: true, event };
    }

    // 3. Handle Incoming Messages (MESSAGES_UPSERT)
    if (event === 'MESSAGES_UPSERT' || event === 'messages.upsert') {
      const normalizedMessage = normalizeEvolutionMessage(instance.companyId, instance.id, payload);
      if (!normalizedMessage) {
        return { received: true, ignored: true, reason: 'ignored_or_outgoing_message' };
      }

      // Idempotency: verify if already processed
      const isNewEvent = await this.idempotencyService.registerEvent(
        instance.companyId,
        'EVOLUTION',
        normalizedMessage.messageId,
        'MESSAGES_UPSERT'
      );

      if (!isNewEvent) {
        return { received: true, deduplicated: true };
      }

      // Push to BullMQ queue for fast async processing
      const safeJobId = `${instance.companyId}_${normalizedMessage.messageId}`.replace(/[:]/g, '_');
      await incomingQueue.add(
        'process-incoming-message',
        normalizedMessage,
        {
          jobId: safeJobId,
        }
      );

      logger.debug(
        { messageId: normalizedMessage.messageId, phone: normalizedMessage.phone, companyId: instance.companyId },
        'Message added to incoming queue'
      );

      return { received: true, queued: true, messageId: normalizedMessage.messageId };
    }

    return { received: true, event, unhandled: true };
  }
}
