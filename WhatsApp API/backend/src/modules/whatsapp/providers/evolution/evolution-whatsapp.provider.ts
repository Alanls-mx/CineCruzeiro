import axios, { AxiosInstance } from 'axios';
import {
  ConnectionStatusResult,
  CreateInstanceParams,
  CreateInstanceResult,
  QrCodeResult,
  SendButtonsParams,
  SendContactParams,
  SendListParams,
  SendLocationParams,
  SendMediaParams,
  SendMessageResult,
  SendStatusParams,
  SendTextParams,
  WhatsAppProvider,
} from '../whatsapp-provider.interface.js';
import { EvolutionConnectionError, WhatsAppProviderError } from '../../../../shared/errors/app-error.js';
import { logger } from '../../../../config/logger.js';
import { env } from '../../../../config/env.js';

export class EvolutionWhatsAppProvider implements WhatsAppProvider {
  private readonly client: AxiosInstance;

  constructor(
    private readonly baseUrl = env.EVOLUTION_API_URL,
    private readonly apiKey = env.EVOLUTION_API_KEY
  ) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
      },
      timeout: 8000,
    });
  }

  /**
   * Sanitizes phone number to E.164 without symbols
   */
  private sanitizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private isTimeoutError(error: any): boolean {
    return error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'));
  }

  private isInstanceNotExistError(error: any): boolean {
    const status = error.response?.status;
    const msg = JSON.stringify(error.response?.data || error.message || '');
    return status === 404 && (msg.includes('does not exist') || msg.includes('not found'));
  }

  private isConnectionClosedError(error: any): boolean {
    const status = error.response?.status;
    const msg = JSON.stringify(error.response?.data || error.message || '');
    return (
      (status === 400 || status === 503) &&
      (msg.includes('Connection Closed') || msg.includes('not connected') || msg.includes('is not open'))
    );
  }

  private webhookConfig(webhookUrl: string) {
    return {
      url: webhookUrl,
      byEvents: false,
      base64: true,
      events: [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CONNECTION_UPDATE',
        'QRCODE_UPDATED',
      ],
      headers: {
        'x-lumix-webhook-secret': env.EVOLUTION_WEBHOOK_SECRET,
      },
    };
  }

  private async ensureInstanceExistsAndCheckConnection(instanceName: string): Promise<boolean> {
    try {
      await this.createInstance({ instanceName });
      const status = await this.getConnectionStatus(instanceName);
      return status.connected;
    } catch (e: any) {
      logger.warn({ instanceName, err: e.message }, 'Failed to auto-provision instance on Evolution');
      return false;
    }
  }

  private async handleSendError(
    error: any,
    instanceName: string,
    to: string,
    retryFn?: () => Promise<SendMessageResult>
  ): Promise<SendMessageResult> {
    if (this.isInstanceNotExistError(error)) {
      logger.info({ instance: instanceName }, 'Instance not found on Evolution API. Auto-provisioning instance...');
      const isConnected = await this.ensureInstanceExistsAndCheckConnection(instanceName);
      if (!isConnected) {
        logger.warn(
          { instance: instanceName, to },
          'Instance auto-created, but WhatsApp is not paired yet (QR Code scan required). Message recorded as PENDING.'
        );
        return {
          messageId: `pending_${Date.now()}`,
          status: 'PENDING',
          timestamp: new Date(),
          raw: { note: 'WhatsApp instance not paired yet' },
        };
      }
      if (retryFn) {
        return await retryFn();
      }
    }

    if (this.isConnectionClosedError(error) || this.isTimeoutError(error)) {
      try {
        const conn = await this.getConnectionStatus(instanceName);
        if (!conn.connected) {
          logger.warn(
            { instance: instanceName, to, state: conn.state },
            `WhatsApp session is ${conn.state} (QR Code scan pending). Outgoing message recorded as PENDING.`
          );
          return {
            messageId: `pending_${Date.now()}`,
            status: 'PENDING',
            timestamp: new Date(),
            raw: { note: `WhatsApp session is ${conn.state}` },
          };
        }
      } catch (err: any) {
        logger.warn({ instance: instanceName, err: err.message }, 'Could not check connection status after send failure');
      }
    }

    logger.error(
      { error: error.response?.data || error.message, to, instance: instanceName },
      'Failed to send message via Evolution'
    );
    throw new WhatsAppProviderError(`Failed to send WhatsApp message: ${error.message}`);
  }

  async createInstance(params: CreateInstanceParams): Promise<CreateInstanceResult> {
    try {
      const webhookUrl = params.webhookUrl || env.EVOLUTION_WEBHOOK_URL || `${env.APP_URL}/webhooks/evolution`;

      const response = await this.client.post('/instance/create', {
        instanceName: params.instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: this.webhookConfig(webhookUrl),
      });

      logger.info({ instanceName: params.instanceName }, 'Evolution instance created successfully');

      const data = response.data;
      return {
        instanceId: data?.instance?.id || data?.id,
        instanceName: params.instanceName,
        status: data?.instance?.status || 'created',
        hash: data?.hash?.apikey,
        qrcode: data?.qrcode
          ? {
              code: data.qrcode.code,
              base64: data.qrcode.base64,
            }
          : undefined,
      };
    } catch (error: any) {
      // If instance already exists in Evolution, don't fail, retrieve state
      if (error.response?.status === 403 || error.response?.data?.response?.message?.includes('already in use')) {
        logger.warn({ instanceName: params.instanceName }, 'Evolution instance already exists in gateway');
        return {
          instanceName: params.instanceName,
          status: 'exists',
        };
      }

      logger.error(
        { error: error.response?.data || error.message, instanceName: params.instanceName },
        'Error creating Evolution instance'
      );
      throw new WhatsAppProviderError(`Failed to create instance on Evolution API: ${error.message}`, error.response?.data);
    }
  }

  async deleteInstance(instanceName: string): Promise<void> {
    try {
      await this.client.delete(`/instance/delete/${instanceName}`);
      logger.info({ instanceName }, 'Evolution instance deleted successfully');
    } catch (error: any) {
      if (error.response?.status === 404) return;
      logger.error({ error: error.response?.data || error.message, instanceName }, 'Error deleting Evolution instance');
      throw new WhatsAppProviderError(`Failed to delete instance: ${error.message}`);
    }
  }

  async logout(instanceName: string): Promise<void> {
    try {
      await this.client.post(`/instance/logout/${instanceName}`);
      logger.info({ instanceName }, 'Evolution instance logged out');
    } catch (error: any) {
      if (error.response?.status === 404) return;
      logger.error({ error: error.response?.data || error.message, instanceName }, 'Error logging out Evolution instance');
      throw new WhatsAppProviderError(`Failed to logout instance: ${error.message}`);
    }
  }

  async getConnectionStatus(instanceName: string): Promise<ConnectionStatusResult> {
    try {
      const response = await this.client.get(`/instance/connectionState/${instanceName}`);
      const state = response.data?.instance?.state || 'close';

      return {
        instanceName,
        state,
        connected: state === 'open',
        phoneNumber: response.data?.instance?.ownerJid?.split('@')[0],
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return {
          instanceName,
          state: 'close',
          connected: false,
        };
      }
      logger.error({ error: error.response?.data || error.message, instanceName }, 'Error fetching connection state');
      throw new EvolutionConnectionError(`Failed to fetch connection status: ${error.message}`);
    }
  }

  async getQrCode(instanceName: string): Promise<QrCodeResult> {
    try {
      const response = await this.client.get(`/instance/connect/${instanceName}`);
      const data = response.data;

      return {
        pairingCode: data?.pairingCode,
        code: data?.code,
        base64: data?.base64,
        count: data?.count,
      };
    } catch (error: any) {
      if (this.isInstanceNotExistError(error)) {
        logger.info({ instanceName }, 'Instance not found on Evolution when getting QR Code. Auto-provisioning...');
        await this.createInstance({ instanceName });
        const retryResponse = await this.client.get(`/instance/connect/${instanceName}`);
        const retryData = retryResponse.data;
        return {
          pairingCode: retryData?.pairingCode,
          code: retryData?.code,
          base64: retryData?.base64,
          count: retryData?.count,
        };
      }

      logger.error({ error: error.response?.data || error.message, instanceName }, 'Error fetching QR Code');
      throw new WhatsAppProviderError(`Failed to fetch QR Code from Evolution: ${error.message}`);
    }
  }

  async configureWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    try {
      await this.client.post(`/webhook/set/${instanceName}`, {
        webhook: this.webhookConfig(webhookUrl),
      });
      logger.info({ instanceName, webhookUrl }, 'Evolution webhook configured');
    } catch (error: any) {
      logger.error(
        { error: error.response?.data || error.message, instanceName },
        'Error configuring Evolution webhook'
      );
      throw new WhatsAppProviderError(`Failed to configure Evolution webhook: ${error.message}`);
    }
  }

  async sendText(params: SendTextParams): Promise<SendMessageResult> {
    try {
      const formattedPhone = this.sanitizePhone(params.to);
      const response = await this.client.post(`/message/sendText/${params.instanceName}`, {
        number: formattedPhone,
        text: params.text,
        delay: params.delayMs || 1000,
      });

      const messageKey = response.data?.key;
      return {
        messageId: messageKey?.id || `out_${Date.now()}`,
        status: 'SENT',
        timestamp: new Date(),
        raw: response.data,
      };
    } catch (error: any) {
      return this.handleSendError(error, params.instanceName, params.to, () => this.sendText(params));
    }
  }

  private formatMediaPayload(media: string): string {
    if (media.startsWith('data:')) {
      const commaIndex = media.indexOf(',');
      if (commaIndex !== -1) {
        return media.substring(commaIndex + 1);
      }
    }
    return media;
  }

  async sendImage(params: Omit<SendMediaParams, 'mediaType'>): Promise<SendMessageResult> {
    try {
      const formattedPhone = this.sanitizePhone(params.to);
      const media = this.formatMediaPayload(params.mediaUrl);
      const response = await this.client.post(`/message/sendMedia/${params.instanceName}`, {
        number: formattedPhone,
        mediatype: 'image',
        media,
        caption: params.caption,
        fileName: params.fileName || 'image.jpg',
      });

      return {
        messageId: response.data?.key?.id || `out_${Date.now()}`,
        status: 'SENT',
        timestamp: new Date(),
        raw: response.data,
      };
    } catch (error: any) {
      return this.handleSendError(error, params.instanceName, params.to, () => this.sendImage(params));
    }
  }

  async sendDocument(params: Omit<SendMediaParams, 'mediaType'>): Promise<SendMessageResult> {
    try {
      const formattedPhone = this.sanitizePhone(params.to);
      const media = this.formatMediaPayload(params.mediaUrl);
      const response = await this.client.post(`/message/sendMedia/${params.instanceName}`, {
        number: formattedPhone,
        mediatype: 'document',
        media,
        caption: params.caption,
        fileName: params.fileName || 'document.pdf',
      });

      return {
        messageId: response.data?.key?.id || `out_${Date.now()}`,
        status: 'SENT',
        timestamp: new Date(),
        raw: response.data,
      };
    } catch (error: any) {
      return this.handleSendError(error, params.instanceName, params.to, () => this.sendDocument(params));
    }
  }

  async sendButtons(params: SendButtonsParams): Promise<SendMessageResult> {
    // Formatted text with numbers is universally supported across all devices
    let formatted = `*${params.title}*\n\n${params.description}\n\n`;
    params.buttons.forEach((btn, index) => {
      formatted += `*${index + 1}.* ${btn.displayText}\n`;
    });
    if (params.footer) {
      formatted += `\n_${params.footer}_\n`;
    }
    formatted += `\n_Responda com o número da opção desejada._`;

    return this.sendText({
      instanceName: params.instanceName,
      to: params.to,
      text: formatted.trim(),
    });
  }

  async sendList(params: SendListParams): Promise<SendMessageResult> {
    // Clean formatted text options provide reliable delivery and professional appearance
    let formatted = `*${params.title}*\n\n${params.description}\n\n`;
    let counter = 1;
    for (const section of params.sections) {
      if (section.title) {
        formatted += `*${section.title}*\n`;
      }
      for (const row of section.rows) {
        formatted += `*${counter}.* ${row.title}${row.description ? ` — _${row.description}_` : ''}\n`;
        counter++;
      }
      formatted += '\n';
    }
    if (params.footer) {
      formatted += `_${params.footer}_\n\n`;
    }
    formatted += `_Responda com o número da opção desejada._`;

    return this.sendText({
      instanceName: params.instanceName,
      to: params.to,
      text: formatted.trim(),
    });
  }

  async sendLocation(params: SendLocationParams): Promise<SendMessageResult> {
    try {
      const formattedPhone = this.sanitizePhone(params.to);
      const response = await this.client.post(`/message/sendLocation/${params.instanceName}`, {
        number: formattedPhone,
        latitude: params.latitude,
        longitude: params.longitude,
        name: params.name,
        address: params.address,
      });

      return {
        messageId: response.data?.key?.id || `out_${Date.now()}`,
        status: 'SENT',
        timestamp: new Date(),
        raw: response.data,
      };
    } catch (error: any) {
      return this.handleSendError(error, params.instanceName, params.to, () => this.sendLocation(params));
    }
  }

  async sendContact(params: SendContactParams): Promise<SendMessageResult> {
    try {
      const formattedPhone = this.sanitizePhone(params.to);
      const response = await this.client.post(`/message/sendContact/${params.instanceName}`, {
        number: formattedPhone,
        contact: [
          {
            fullName: params.contactName,
            wuid: this.sanitizePhone(params.contactPhone),
            phoneNumber: params.contactPhone,
          },
        ],
      });

      return {
        messageId: response.data?.key?.id || `out_${Date.now()}`,
        status: 'SENT',
        timestamp: new Date(),
        raw: response.data,
      };
    } catch (error: any) {
      return this.handleSendError(error, params.instanceName, params.to, () => this.sendContact(params));
    }
  }

  async fetchProfilePictureUrl(instanceName: string, phone: string): Promise<string | null> {
    try {
      const formattedPhone = this.sanitizePhone(phone);
      const response = await this.client.post(`/chat/fetchProfilePictureUrl/${instanceName}`, {
        number: formattedPhone,
      });
      return response.data?.profilePictureUrl || null;
    } catch (error: any) {
      logger.warn(
        { instance: instanceName, phone, err: error.response?.data || error.message },
        'Could not fetch profile picture from Evolution API'
      );
      return null;
    }
  }

  async sendStatus(params: SendStatusParams): Promise<SendMessageResult> {
    try {
      let payload: Record<string, any>;

      if (params.type === 'text') {
        const textContent = params.text || params.content || '';
        const bgColor = params.backgroundColor || '#128C7E';
        const font = params.font ?? 1;

        payload = {
          type: 'text',
          content: textContent,
          backgroundColor: bgColor,
          font,
          status: {
            text: textContent,
            backgroundColor: bgColor,
            font,
          },
          allContacts: params.allContacts !== false,
          statusJidList: params.statusJidList && params.statusJidList.length > 0 ? params.statusJidList : undefined,
        };
      } else {
        const media = this.formatMediaPayload(params.mediaUrl || params.content || '');
        payload = {
          type: params.type || 'image',
          content: media,
          caption: params.caption || '',
          status: {
            image: params.mediaUrl || params.content || '',
            caption: params.caption || '',
          },
          allContacts: params.allContacts !== false,
          statusJidList: params.statusJidList && params.statusJidList.length > 0 ? params.statusJidList : undefined,
        };
      }

      logger.info({ instance: params.instanceName, type: params.type }, 'Publishing WhatsApp Status (Story)...');
      const response = await this.client.post(`/message/sendStatus/${params.instanceName}`, payload);

      return {
        messageId: response.data?.key?.id || `status_${Date.now()}`,
        status: 'SENT',
        timestamp: new Date(),
        raw: response.data,
      };
    } catch (error: any) {
      logger.error(
        { error: error.response?.data || error.message, instance: params.instanceName },
        'Failed to publish WhatsApp Status via Evolution'
      );
      throw new WhatsAppProviderError(
        `Failed to publish WhatsApp Status: ${error.response?.data?.response?.message || error.message}`
      );
    }
  }
}
