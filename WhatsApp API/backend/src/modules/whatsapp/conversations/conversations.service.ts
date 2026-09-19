import { ConversationsRepository } from './conversations.repository.js';
import { MessagesRepository } from '../messages/messages.repository.js';
import { SendAgentMessageInput, PublishStatusInput } from './conversations.schema.js';
import { WhatsAppProviderFactory } from '../providers/whatsapp-provider.factory.js';
import { SSEService } from '../realtime/sse.service.js';
import { prisma } from '../../../database/prisma.js';
import {
  ConversationMode,
  ConversationStatus,
  MessageDirection,
  MessageSender,
  MessageType,
} from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/app-error.js';

export class ConversationsService {
  constructor(
    private readonly convRepo = new ConversationsRepository(),
    private readonly msgRepo = new MessagesRepository()
  ) {}

  async list(companyId: string, filters?: { status?: ConversationStatus; mode?: ConversationMode }) {
    const list = await this.convRepo.listConversations(companyId, filters);

    // Auto-sync profile picture for contacts that do not have one yet
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    if (instance && instance.status === 'CONNECTED') {
      const provider = WhatsAppProviderFactory.getProvider(instance.provider);
      if (provider.fetchProfilePictureUrl) {
        await Promise.allSettled(
          list.map(async (conv) => {
            if (conv.contact && !conv.contact.profilePicture) {
              try {
                const picUrl = await provider.fetchProfilePictureUrl!(instance.instanceName, conv.contact.phone);
                if (picUrl) {
                  conv.contact.profilePicture = picUrl;
                  await prisma.contact.update({
                    where: { id: conv.contact.id },
                    data: { profilePicture: picUrl },
                  });
                }
              } catch (err) {
                // Ignore profile picture fetch failure
              }
            }
          })
        );
      }
    }

    return list;
  }

  async getById(companyId: string, id: string) {
    const conv = await this.convRepo.findById(companyId, id);
    if (!conv) {
      throw new NotFoundError('Conversation not found');
    }
    // Reset unread count when opened by agent
    await this.convRepo.resetUnreadCount(id);
    return conv;
  }

  async getMessages(companyId: string, id: string, limit = 100) {
    await this.getById(companyId, id);
    return this.msgRepo.listByConversation(companyId, id, limit);
  }

  async sendAgentMessage(companyId: string, conversationId: string, input: SendAgentMessageInput) {
    const conversation = await this.getById(companyId, conversationId);

    // Find active WhatsApp instance for company
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    if (!instance) {
      throw new ValidationError('No active WhatsApp instance configured for this company');
    }

    const contact = await prisma.contact.findUnique({
      where: { id: conversation.contactId },
    });

    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    const provider = WhatsAppProviderFactory.getProvider(instance.provider);

    // Send via provider
    let providerResult;
    if (input.type === MessageType.IMAGE && input.mediaUrl) {
      providerResult = await provider.sendImage({
        instanceName: instance.instanceName,
        to: contact.phone,
        mediaUrl: input.mediaUrl,
        caption: input.text || undefined,
        fileName: input.fileName || 'photo.jpg',
      });
    } else if (input.type === MessageType.DOCUMENT && input.mediaUrl) {
      providerResult = await provider.sendDocument({
        instanceName: instance.instanceName,
        to: contact.phone,
        mediaUrl: input.mediaUrl,
        caption: input.text || undefined,
        fileName: input.fileName || 'document.pdf',
      });
    } else {
      providerResult = await provider.sendText({
        instanceName: instance.instanceName,
        to: contact.phone,
        text: input.text || '[Mensagem]',
      });
    }

    // Persist outbound message in database
    const message = await this.msgRepo.create({
      companyId,
      conversationId: conversation.id,
      externalMessageId: providerResult.messageId,
      direction: MessageDirection.OUTBOUND,
      sender: MessageSender.AGENT,
      type: input.type,
      content: input.text || (input.type === MessageType.IMAGE ? '📷 Foto' : input.type === MessageType.DOCUMENT ? `📎 ${input.fileName || 'Documento'}` : '[Mídia]'),
      metadata: {
        mediaUrl: input.mediaUrl,
        fileName: input.fileName,
      },
    });

    // Update conversation last message timestamp and switch mode to HUMAN if currently BOT
    const updates: any = { lastMessageAt: new Date() };
    if (conversation.mode === ConversationMode.BOT) {
      updates.mode = ConversationMode.HUMAN;
    }
    await this.convRepo.updateState(conversation.id, updates);

    // Broadcast in realtime to connected browsers
    SSEService.broadcastToCompany(companyId, 'message:new', {
      conversationId: conversation.id,
      message,
    });

    if (updates.mode) {
      SSEService.broadcastToCompany(companyId, 'conversation:update', {
        id: conversation.id,
        mode: ConversationMode.HUMAN,
      });
    }

    return message;
  }

  async takeover(companyId: string, id: string) {
    const conv = await this.getById(companyId, id);
    const updated = await this.convRepo.updateMode(conv.id, ConversationMode.HUMAN);

    SSEService.broadcastToCompany(companyId, 'conversation:update', {
      id: updated.id,
      mode: updated.mode,
    });

    return updated;
  }

  async release(companyId: string, id: string) {
    const conv = await this.getById(companyId, id);
    const updated = await this.convRepo.updateState(conv.id, {
      mode: ConversationMode.BOT,
      currentFlow: 'MAIN_MENU',
      currentState: 'SHOW_MENU',
      context: {},
      fallbackCount: 0,
    });

    SSEService.broadcastToCompany(companyId, 'conversation:update', {
      id: updated.id,
      mode: updated.mode,
      currentFlow: 'MAIN_MENU',
      currentState: 'SHOW_MENU',
    });

    return updated;
  }

  async close(companyId: string, id: string) {
    const conv = await this.getById(companyId, id);
    const updated = await this.convRepo.updateStatus(conv.id, ConversationStatus.CLOSED);

    SSEService.broadcastToCompany(companyId, 'conversation:update', {
      id: updated.id,
      status: updated.status,
    });

    return updated;
  }

  async publishStatus(companyId: string, input: PublishStatusInput) {
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    if (!instance) {
      throw new ValidationError('Nenhuma instância WhatsApp configurada para esta empresa.');
    }

    const provider = WhatsAppProviderFactory.getProvider(instance.provider);
    if (!provider.sendStatus) {
      throw new ValidationError('Provedor atual não suporta publicação de Status/Stories.');
    }

    // Collect all contacts for statusJidList
    const contacts = await prisma.contact.findMany({
      where: { companyId },
      select: { phone: true },
    });

    const statusJidList = contacts
      .map((c) => c.phone.replace(/\D/g, ''))
      .filter((p) => p.length >= 10);

    const result = await provider.sendStatus({
      instanceName: instance.instanceName,
      type: input.type,
      text: input.text || input.content,
      content: input.content || input.text,
      mediaUrl: input.mediaUrl,
      caption: input.caption,
      backgroundColor: input.backgroundColor || '#128C7E',
      font: input.font ?? 1,
      statusJidList: statusJidList.length > 0 ? statusJidList : undefined,
      allContacts: true,
    });

    return {
      success: true,
      messageId: result.messageId,
      status: result.status,
      timestamp: result.timestamp,
    };
  }

  async syncProfilePicture(companyId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, companyId },
    });

    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    const instance = await prisma.whatsAppInstance.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    if (!instance) {
      return null;
    }

    const provider = WhatsAppProviderFactory.getProvider(instance.provider);
    if (!provider.fetchProfilePictureUrl) {
      return null;
    }

    const picUrl = await provider.fetchProfilePictureUrl(instance.instanceName, contact.phone);
    if (picUrl) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { profilePicture: picUrl },
      });
      return picUrl;
    }

    return contact.profilePicture;
  }
}
