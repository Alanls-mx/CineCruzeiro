import { prisma } from '../../../database/prisma.js';
import { Conversation, ConversationMode, ConversationStatus, Prisma } from '@prisma/client';

export class ConversationsRepository {
  async findActiveByContact(companyId: string, contactId: string): Promise<Conversation | null> {
    return prisma.conversation.findFirst({
      where: {
        companyId,
        contactId,
        status: {
          in: [ConversationStatus.OPEN, ConversationStatus.WAITING],
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });
  }

  async create(data: {
    companyId: string;
    contactId: string;
    mode?: ConversationMode;
    currentFlow?: string;
    currentState?: string;
    context?: Prisma.InputJsonValue;
  }): Promise<Conversation> {
    return prisma.conversation.create({
      data: {
        companyId: data.companyId,
        contactId: data.contactId,
        status: ConversationStatus.OPEN,
        mode: data.mode || ConversationMode.BOT,
        currentFlow: data.currentFlow || 'MAIN_MENU',
        currentState: data.currentState || 'INITIAL',
        context: data.context || {},
        startedAt: new Date(),
        lastMessageAt: new Date(),
        unreadCount: 1,
      },
    });
  }

  async findById(companyId: string, id: string): Promise<Conversation | null> {
    return prisma.conversation.findFirst({
      where: { id, companyId },
      include: {
        contact: true,
      },
    });
  }

  async updateState(
    id: string,
    update: {
      currentFlow?: string;
      currentState?: string;
      mode?: ConversationMode;
      context?: Prisma.InputJsonValue;
      fallbackCount?: number;
      lastMessageAt?: Date;
    }
  ): Promise<Conversation> {
    return prisma.conversation.update({
      where: { id },
      data: {
        currentFlow: update.currentFlow,
        currentState: update.currentState,
        mode: update.mode,
        context: update.context !== undefined ? update.context : undefined,
        fallbackCount: update.fallbackCount,
        lastMessageAt: update.lastMessageAt || new Date(),
      },
      include: { contact: true },
    });
  }

  async updateMode(id: string, mode: ConversationMode, context?: Prisma.InputJsonValue): Promise<Conversation> {
    return prisma.conversation.update({
      where: { id },
      data: { mode, context: context !== undefined ? context : undefined },
      include: { contact: true },
    });
  }

  async updateStatus(id: string, status: ConversationStatus): Promise<Conversation> {
    return prisma.conversation.update({
      where: { id },
      data: {
        status,
        closedAt: status === ConversationStatus.CLOSED ? new Date() : null,
      },
      include: { contact: true },
    });
  }

  async resetUnreadCount(id: string): Promise<void> {
    await prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
  }

  async incrementUnreadCount(id: string): Promise<Conversation> {
    return prisma.conversation.update({
      where: { id },
      data: {
        unreadCount: { increment: 1 },
        lastMessageAt: new Date(),
      },
    });
  }

  async listConversations(
    companyId: string,
    filters?: {
      status?: ConversationStatus;
      mode?: ConversationMode;
    }
  ) {
    return prisma.conversation.findMany({
      where: {
        companyId,
        status: filters?.status,
        mode: filters?.mode,
      },
      include: {
        contact: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });
  }
}
