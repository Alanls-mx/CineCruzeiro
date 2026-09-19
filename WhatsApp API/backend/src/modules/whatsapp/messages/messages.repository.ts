import { prisma } from '../../../database/prisma.js';
import { Message, MessageDirection, MessageSender, MessageStatus, MessageType, Prisma } from '@prisma/client';

export interface CreateMessageData {
  companyId: string;
  conversationId: string;
  externalMessageId?: string;
  direction: MessageDirection;
  type?: MessageType;
  sender: MessageSender;
  content: string;
  metadata?: Prisma.InputJsonValue;
  status?: MessageStatus;
}

export class MessagesRepository {
  async create(data: CreateMessageData): Promise<Message> {
    return prisma.message.create({
      data: {
        companyId: data.companyId,
        conversationId: data.conversationId,
        externalMessageId: data.externalMessageId,
        direction: data.direction,
        type: data.type || MessageType.TEXT,
        sender: data.sender,
        content: data.content,
        metadata: data.metadata || {},
        status: data.status || MessageStatus.SENT,
      },
    });
  }

  async listByConversation(
    companyId: string,
    conversationId: string,
    limit = 50,
    before?: Date
  ): Promise<Message[]> {
    return prisma.message.findMany({
      where: {
        companyId,
        conversationId,
        createdAt: before ? { lt: before } : undefined,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit,
    });
  }

  async updateStatusByExternalId(
    companyId: string,
    externalMessageId: string,
    status: MessageStatus
  ): Promise<Message | null> {
    const msg = await prisma.message.findFirst({
      where: { companyId, externalMessageId },
    });

    if (!msg) return null;

    return prisma.message.update({
      where: { id: msg.id },
      data: { status },
    });
  }
}
