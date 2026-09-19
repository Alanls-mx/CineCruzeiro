import { prisma } from '../../../database/prisma.js';
import { WhatsAppInstance, WhatsAppInstanceStatus, WhatsAppProviderType } from '@prisma/client';

export interface CreateInstanceData {
  companyId: string;
  instanceName: string;
  provider: WhatsAppProviderType;
  webhookUrl?: string;
  status?: WhatsAppInstanceStatus;
}

export class InstancesRepository {
  async findById(companyId: string, id: string): Promise<WhatsAppInstance | null> {
    return prisma.whatsAppInstance.findFirst({
      where: {
        id,
        companyId,
      },
    });
  }

  async findByInstanceName(instanceName: string): Promise<WhatsAppInstance | null> {
    return prisma.whatsAppInstance.findUnique({
      where: {
        instanceName,
      },
    });
  }

  async listByCompany(companyId: string): Promise<WhatsAppInstance[]> {
    return prisma.whatsAppInstance.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(data: CreateInstanceData): Promise<WhatsAppInstance> {
    return prisma.whatsAppInstance.create({
      data: {
        companyId: data.companyId,
        instanceName: data.instanceName,
        provider: data.provider,
        webhookUrl: data.webhookUrl,
        status: data.status || WhatsAppInstanceStatus.DISCONNECTED,
      },
    });
  }

  async updateStatus(
    id: string,
    status: WhatsAppInstanceStatus,
    phoneNumber?: string,
    connectedAt?: Date | null,
    disconnectedAt?: Date | null
  ): Promise<WhatsAppInstance> {
    return prisma.whatsAppInstance.update({
      where: { id },
      data: {
        status,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : undefined,
        connectedAt: connectedAt !== undefined ? connectedAt : undefined,
        disconnectedAt: disconnectedAt !== undefined ? disconnectedAt : undefined,
      },
    });
  }

  async delete(companyId: string, id: string): Promise<WhatsAppInstance> {
    return prisma.whatsAppInstance.delete({
      where: {
        id,
      },
    });
  }
}
