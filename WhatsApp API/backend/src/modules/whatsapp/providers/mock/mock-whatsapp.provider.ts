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
  SendTextParams,
  WhatsAppProvider,
} from '../whatsapp-provider.interface.js';
import { WhatsAppProviderError } from '../../../../shared/errors/app-error.js';

export interface MockSentMessage {
  id: string;
  instanceName: string;
  to: string;
  type: 'text' | 'image' | 'document' | 'buttons' | 'list' | 'location' | 'contact';
  payload: any;
  sentAt: Date;
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  public sentMessages: MockSentMessage[] = [];
  public connectionStates: Map<string, 'open' | 'connecting' | 'close'> = new Map();
  public shouldFail = false;
  public failureMessage = 'Simulated WhatsApp Provider Failure';

  private checkFailure() {
    if (this.shouldFail) {
      throw new WhatsAppProviderError(this.failureMessage);
    }
  }

  async createInstance(params: CreateInstanceParams): Promise<CreateInstanceResult> {
    this.checkFailure();
    this.connectionStates.set(params.instanceName, 'close');

    return {
      instanceId: `mock_inst_${params.instanceName}`,
      instanceName: params.instanceName,
      status: 'created',
      qrcode: {
        code: `2@mock_qr_${Date.now()}`,
        base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    };
  }

  async deleteInstance(instanceName: string): Promise<void> {
    this.checkFailure();
    this.connectionStates.delete(instanceName);
  }

  async logout(instanceName: string): Promise<void> {
    this.checkFailure();
    this.connectionStates.set(instanceName, 'close');
  }

  async getConnectionStatus(instanceName: string): Promise<ConnectionStatusResult> {
    this.checkFailure();
    const state = this.connectionStates.get(instanceName) || 'close';

    return {
      instanceName,
      state,
      connected: state === 'open',
      phoneNumber: state === 'open' ? '5511999999999' : undefined,
    };
  }

  async getQrCode(instanceName: string): Promise<QrCodeResult> {
    this.checkFailure();
    return {
      code: `2@mock_qr_${Date.now()}`,
      base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      count: 1,
    };
  }

  async sendText(params: SendTextParams): Promise<SendMessageResult> {
    this.checkFailure();
    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.sentMessages.push({
      id: messageId,
      instanceName: params.instanceName,
      to: params.to,
      type: 'text',
      payload: params.text,
      sentAt: new Date(),
    });

    return {
      messageId,
      status: 'SENT',
      timestamp: new Date(),
    };
  }

  async sendImage(params: Omit<SendMediaParams, 'mediaType'>): Promise<SendMessageResult> {
    this.checkFailure();
    const messageId = `mock_img_${Date.now()}`;
    this.sentMessages.push({
      id: messageId,
      instanceName: params.instanceName,
      to: params.to,
      type: 'image',
      payload: params,
      sentAt: new Date(),
    });

    return {
      messageId,
      status: 'SENT',
      timestamp: new Date(),
    };
  }

  async sendDocument(params: Omit<SendMediaParams, 'mediaType'>): Promise<SendMessageResult> {
    this.checkFailure();
    const messageId = `mock_doc_${Date.now()}`;
    this.sentMessages.push({
      id: messageId,
      instanceName: params.instanceName,
      to: params.to,
      type: 'document',
      payload: params,
      sentAt: new Date(),
    });

    return {
      messageId,
      status: 'SENT',
      timestamp: new Date(),
    };
  }

  async sendButtons(params: SendButtonsParams): Promise<SendMessageResult> {
    this.checkFailure();
    const messageId = `mock_btn_${Date.now()}`;
    this.sentMessages.push({
      id: messageId,
      instanceName: params.instanceName,
      to: params.to,
      type: 'buttons',
      payload: params,
      sentAt: new Date(),
    });

    return {
      messageId,
      status: 'SENT',
      timestamp: new Date(),
    };
  }

  async sendList(params: SendListParams): Promise<SendMessageResult> {
    this.checkFailure();
    const messageId = `mock_list_${Date.now()}`;
    this.sentMessages.push({
      id: messageId,
      instanceName: params.instanceName,
      to: params.to,
      type: 'list',
      payload: params,
      sentAt: new Date(),
    });

    return {
      messageId,
      status: 'SENT',
      timestamp: new Date(),
    };
  }

  async sendLocation(params: SendLocationParams): Promise<SendMessageResult> {
    this.checkFailure();
    const messageId = `mock_loc_${Date.now()}`;
    this.sentMessages.push({
      id: messageId,
      instanceName: params.instanceName,
      to: params.to,
      type: 'location',
      payload: params,
      sentAt: new Date(),
    });

    return {
      messageId,
      status: 'SENT',
      timestamp: new Date(),
    };
  }

  async sendContact(params: SendContactParams): Promise<SendMessageResult> {
    this.checkFailure();
    const messageId = `mock_contact_${Date.now()}`;
    this.sentMessages.push({
      id: messageId,
      instanceName: params.instanceName,
      to: params.to,
      type: 'contact',
      payload: params,
      sentAt: new Date(),
    });

    return {
      messageId,
      status: 'SENT',
      timestamp: new Date(),
    };
  }

  async fetchProfilePictureUrl(instanceName: string, phone: string): Promise<string | null> {
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
  }

  async sendStatus(params: any): Promise<SendMessageResult> {
    return {
      messageId: `mock_status_${Date.now()}`,
      status: 'SENT',
      timestamp: new Date(),
    };
  }

  // Test utility helpers
  getLastMessage(phone?: string): MockSentMessage | undefined {
    if (phone) {
      const filtered = this.sentMessages.filter((m) => m.to === phone);
      return filtered[filtered.length - 1];
    }
    return this.sentMessages[this.sentMessages.length - 1];
  }

  clear() {
    this.sentMessages = [];
    this.connectionStates.clear();
    this.shouldFail = false;
  }
}
