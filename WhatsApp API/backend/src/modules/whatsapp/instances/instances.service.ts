import { WhatsAppInstance, WhatsAppInstanceStatus } from '@prisma/client';
import { InstancesRepository } from './instances.repository.js';
import { CreateInstanceInput } from './instances.schema.js';
import { WhatsAppProviderFactory } from '../providers/whatsapp-provider.factory.js';
import { AppError, NotFoundError } from '../../../shared/errors/app-error.js';
import { logger } from '../../../config/logger.js';
import { env } from '../../../config/env.js';

export class InstancesService {
  constructor(private readonly repository = new InstancesRepository()) {}

  async createInstance(companyId: string, input: CreateInstanceInput) {
    // Check if instance name is already in use
    const existing = await this.repository.findByInstanceName(input.instanceName);
    if (existing) {
      throw new AppError(`Instance name '${input.instanceName}' is already taken`, 409, 'INSTANCE_ALREADY_EXISTS');
    }

    const provider = WhatsAppProviderFactory.getProvider(input.provider);
    const webhookUrl = env.EVOLUTION_WEBHOOK_URL || `${env.APP_URL}/webhooks/evolution`;

    // 1. Create on provider (Evolution / Mock)
    const providerResult = await provider.createInstance({
      instanceName: input.instanceName,
      webhookUrl,
    });

    // 2. Persist in Lumix database
    const instance = await this.repository.create({
      companyId,
      instanceName: input.instanceName,
      provider: input.provider,
      webhookUrl,
      status: WhatsAppInstanceStatus.DISCONNECTED,
    });

    return {
      instance,
      qrcode: providerResult.qrcode,
    };
  }

  async listInstances(companyId: string): Promise<WhatsAppInstance[]> {
    return this.repository.listByCompany(companyId);
  }

  async getInstance(companyId: string, id: string): Promise<WhatsAppInstance> {
    const instance = await this.repository.findById(companyId, id);
    if (!instance) {
      throw new NotFoundError(`WhatsApp instance not found`);
    }
    return instance;
  }

  async connectInstance(companyId: string, id: string) {
    const instance = await this.getInstance(companyId, id);
    const provider = WhatsAppProviderFactory.getProvider(instance.provider);

    // Update status to CONNECTING
    await this.repository.updateStatus(instance.id, WhatsAppInstanceStatus.CONNECTING);

    try {
      const webhookUrl = env.EVOLUTION_WEBHOOK_URL || `${env.APP_URL}/webhooks/evolution`;
      if (provider.configureWebhook) {
        await provider.configureWebhook(instance.instanceName, webhookUrl);
      }
      let qrData = await provider.getQrCode(instance.instanceName);

      // If QR Code count is near expiration (>= 25 in Baileys), logout to refresh session
      if (qrData.count && qrData.count >= 25) {
        logger.info({ instanceName: instance.instanceName, count: qrData.count }, 'QR Code near expiration, resetting for fresh QR Code...');
        try {
          await provider.logout(instance.instanceName);
        } catch (e) {
          // silent logout attempt
        }
        qrData = await provider.getQrCode(instance.instanceName);
      }

      return {
        instanceId: instance.id,
        instanceName: instance.instanceName,
        status: WhatsAppInstanceStatus.CONNECTING,
        qrcode: qrData,
      };
    } catch (error: any) {
      logger.warn({ err: error.message, instanceName: instance.instanceName }, 'QR code fetch warning on connect');
      // If already connected, fetch state
      const statusResult = await provider.getConnectionStatus(instance.instanceName);
      if (statusResult.connected) {
        await this.repository.updateStatus(
          instance.id,
          WhatsAppInstanceStatus.CONNECTED,
          statusResult.phoneNumber,
          new Date(),
          null
        );
        return {
          instanceId: instance.id,
          instanceName: instance.instanceName,
          status: WhatsAppInstanceStatus.CONNECTED,
          phoneNumber: statusResult.phoneNumber,
        };
      }
      throw error;
    }
  }

  async getQrCode(companyId: string, id: string) {
    const instance = await this.getInstance(companyId, id);
    const provider = WhatsAppProviderFactory.getProvider(instance.provider);

    const qrData = await provider.getQrCode(instance.instanceName);
    return {
      instanceId: instance.id,
      instanceName: instance.instanceName,
      status: instance.status,
      qrcode: qrData,
    };
  }

  async getLiveStatus(companyId: string, id: string) {
    const instance = await this.getInstance(companyId, id);
    const provider = WhatsAppProviderFactory.getProvider(instance.provider);

    const statusResult = await provider.getConnectionStatus(instance.instanceName);

    const newStatus = statusResult.connected
      ? WhatsAppInstanceStatus.CONNECTED
      : statusResult.state === 'connecting'
      ? WhatsAppInstanceStatus.CONNECTING
      : WhatsAppInstanceStatus.DISCONNECTED;

    if (newStatus !== instance.status) {
      await this.repository.updateStatus(
        instance.id,
        newStatus,
        statusResult.phoneNumber,
        newStatus === WhatsAppInstanceStatus.CONNECTED ? new Date() : undefined,
        newStatus === WhatsAppInstanceStatus.DISCONNECTED ? new Date() : undefined
      );
    }

    return {
      id: instance.id,
      instanceName: instance.instanceName,
      status: newStatus,
      state: statusResult.state,
      phoneNumber: statusResult.phoneNumber || instance.phoneNumber,
      connectedAt: instance.connectedAt,
      disconnectedAt: instance.disconnectedAt,
    };
  }

  async disconnectInstance(companyId: string, id: string) {
    const instance = await this.getInstance(companyId, id);
    const provider = WhatsAppProviderFactory.getProvider(instance.provider);

    await provider.logout(instance.instanceName);
    const updated = await this.repository.updateStatus(
      instance.id,
      WhatsAppInstanceStatus.DISCONNECTED,
      undefined,
      undefined,
      new Date()
    );

    return {
      success: true,
      instance: updated,
    };
  }

  async deleteInstance(companyId: string, id: string) {
    const instance = await this.getInstance(companyId, id);
    const provider = WhatsAppProviderFactory.getProvider(instance.provider);

    try {
      await provider.deleteInstance(instance.instanceName);
    } catch (e) {
      logger.warn({ instanceName: instance.instanceName }, 'Failed to delete on provider, proceeding with local delete');
    }

    await this.repository.delete(companyId, id);

    return {
      success: true,
      message: `Instance '${instance.instanceName}' deleted successfully`,
    };
  }
}
