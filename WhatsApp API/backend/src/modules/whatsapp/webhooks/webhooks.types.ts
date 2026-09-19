import { MessageType } from '@prisma/client';

export interface IncomingWhatsAppMedia {
  url?: string;
  mimetype?: string;
  fileName?: string;
  caption?: string;
}

/**
 * Canonical Internal WhatsApp Message Structure
 * Business flows will ONLY consume this normalized structure.
 */
export interface IncomingWhatsAppMessage {
  messageId: string;
  companyId: string;
  instanceId: string;
  instanceName: string;
  phone: string;
  name: string;
  type: MessageType;
  text: string;
  selectionId?: string; // ID of selected button or list option (e.g. 'PROGRAMMING')
  media?: IncomingWhatsAppMedia;
  timestamp: Date;
  rawPayload?: unknown;
}

/**
 * Raw Evolution API v2 Webhook Payload Structure
 */
export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    pushName?: string;
    message?: any;
    messageType?: string;
    messageTimestamp?: number | string;
    state?: string;
    status?: string;
    qrcode?: {
      base64?: string;
      code?: string;
    };
  };
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}
