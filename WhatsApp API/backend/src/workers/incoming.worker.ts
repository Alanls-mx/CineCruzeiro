import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/bullmq.js';
import { redisClient } from '../queue/redis.js';
import { IncomingWhatsAppMessage } from '../modules/whatsapp/webhooks/webhooks.types.js';
import { ContactsRepository } from '../modules/whatsapp/contacts/contacts.repository.js';
import { ConversationsRepository } from '../modules/whatsapp/conversations/conversations.repository.js';
import { MessagesRepository } from '../modules/whatsapp/messages/messages.repository.js';
import { RedisLock } from '../shared/utils/redis-lock.js';
import { WhatsAppProviderFactory } from '../modules/whatsapp/providers/whatsapp-provider.factory.js';
import { FlowEngine } from '../modules/whatsapp/flows/flow-engine.js';
import { SSEService } from '../modules/whatsapp/realtime/sse.service.js';
import { prisma } from '../database/prisma.js';
import { MessageDirection, MessageSender, MessageType } from '@prisma/client';
import { logger } from '../config/logger.js';

export class IncomingWorker {
  private worker: Worker | null = null;
  private readonly contactsRepo = new ContactsRepository();
  private readonly conversationsRepo = new ConversationsRepository();
  private readonly messagesRepo = new MessagesRepository();
  private readonly flowEngine = new FlowEngine();

  start() {
    this.worker = new Worker<IncomingWhatsAppMessage>(
      QUEUE_NAMES.INCOMING,
      async (job: Job<IncomingWhatsAppMessage>) => {
        const message = job.data;
        const { companyId, phone, messageId, instanceId } = message;

        logger.info({ messageId, phone, companyId }, 'Worker processing incoming WhatsApp message');

        // 1. Acquire distributed lock for this conversation
        const lockToken = await RedisLock.acquireLock(companyId, phone, 15);
        if (!lockToken) {
          logger.warn({ phone, companyId }, 'Conversation is currently locked. Postponing job.');
          throw new Error(`Conversation locked for ${phone}`);
        }

        try {
          // 2. Resolve Contact
          const contact = await this.contactsRepo.findOrCreate(companyId, phone, message.name);

          // 3. Resolve Active Conversation
          let conversation = await this.conversationsRepo.findActiveByContact(companyId, contact.id);
          if (!conversation) {
            conversation = await this.conversationsRepo.create({
              companyId,
              contactId: contact.id,
              currentFlow: 'MAIN_MENU',
              currentState: 'SHOW_MENU',
            });
          }

          // 4. Save Inbound Message in Database
          const savedInbound = await this.messagesRepo.create({
            companyId,
            conversationId: conversation.id,
            externalMessageId: messageId,
            direction: MessageDirection.INBOUND,
            sender: MessageSender.CUSTOMER,
            type: message.type || MessageType.TEXT,
            content: message.text || (message.selectionId ? `[Selecionou: ${message.selectionId}]` : ''),
            metadata: {
              selectionId: message.selectionId,
              media: message.media,
            } as any,
          });

          // Increment unread count for the agent inbox
          const updatedConv = await this.conversationsRepo.incrementUnreadCount(conversation.id);

          // Broadcast inbound message to connected agent consoles
          SSEService.broadcastToCompany(companyId, 'message:new', {
            conversationId: conversation.id,
            message: savedInbound,
          });
          SSEService.broadcastToCompany(companyId, 'conversation:update', {
            id: conversation.id,
            unreadCount: updatedConv.unreadCount,
            lastMessageAt: updatedConv.lastMessageAt,
          });

          // 5. Resolve WhatsApp Provider
          const instance = await prisma.whatsAppInstance.findUnique({
            where: { id: instanceId },
          });
          const provider = WhatsAppProviderFactory.getProvider(instance?.provider);

          // 6. Run Flow Engine
          await this.flowEngine.processMessage(conversation, message, provider);

          logger.info({ messageId, conversationId: conversation.id }, 'Message processed successfully by FlowEngine');
        } finally {
          // 7. Always release distributed lock
          await RedisLock.releaseLock(companyId, phone, lockToken);
        }
      },
      {
        connection: redisClient,
        concurrency: 5,
      }
    );

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, error: err.message }, 'Incoming message job failed');
    });

    this.worker.on('completed', (job) => {
      logger.debug({ jobId: job?.id }, 'Incoming message job completed');
    });

    logger.info('Incoming BullMQ Worker started');
    return this.worker;
  }

  async stop() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
