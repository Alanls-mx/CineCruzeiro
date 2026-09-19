export interface CreateInstanceParams {
  instanceName: string;
  webhookUrl?: string;
}

export interface CreateInstanceResult {
  instanceId?: string;
  instanceName: string;
  status: string;
  hash?: string;
  qrcode?: {
    code?: string;
    base64?: string;
  };
}

export interface ConnectionStatusResult {
  instanceName: string;
  state: 'open' | 'connecting' | 'close' | 'refused';
  connected: boolean;
  phoneNumber?: string;
}

export interface QrCodeResult {
  pairingCode?: string;
  code?: string;
  base64?: string;
  count?: number;
}

export interface SendMessageResult {
  messageId: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  timestamp: Date;
  raw?: unknown;
}

export interface SendTextParams {
  instanceName: string;
  to: string; // E.164 phone number without +
  text: string;
  delayMs?: number;
}

export interface SendMediaParams {
  instanceName: string;
  to: string;
  mediaUrl: string;
  caption?: string;
  mediaType: 'image' | 'document' | 'video' | 'audio';
  fileName?: string;
}

export interface SendButtonOption {
  id: string;
  displayText: string;
}

export interface SendButtonsParams {
  instanceName: string;
  to: string;
  title: string;
  description: string;
  footer?: string;
  buttons: SendButtonOption[];
}

export interface ListSectionRow {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListSectionRow[];
}

export interface SendListParams {
  instanceName: string;
  to: string;
  title: string;
  description: string;
  buttonText: string;
  footer?: string;
  sections: ListSection[];
}

export interface SendLocationParams {
  instanceName: string;
  to: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface SendContactParams {
  instanceName: string;
  to: string;
  contactName: string;
  contactPhone: string;
}

export interface SendStatusParams {
  instanceName: string;
  type: 'text' | 'image' | 'video';
  content?: string;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  backgroundColor?: string;
  font?: number;
  statusJidList?: string[];
  allContacts?: boolean;
}

/**
 * Standard WhatsApp Provider Interface
 * Decouples all LumixEngine business flows from external WhatsApp gateways (Evolution, Twilio, Meta Cloud, etc.)
 */
export interface WhatsAppProvider {
  createInstance(params: CreateInstanceParams): Promise<CreateInstanceResult>;
  deleteInstance(instanceName: string): Promise<void>;
  logout(instanceName: string): Promise<void>;
  getConnectionStatus(instanceName: string): Promise<ConnectionStatusResult>;
  getQrCode(instanceName: string): Promise<QrCodeResult>;
  configureWebhook?(instanceName: string, webhookUrl: string): Promise<void>;

  sendText(params: SendTextParams): Promise<SendMessageResult>;
  sendImage(params: Omit<SendMediaParams, 'mediaType'>): Promise<SendMessageResult>;
  sendDocument(params: Omit<SendMediaParams, 'mediaType'>): Promise<SendMessageResult>;
  sendButtons(params: SendButtonsParams): Promise<SendMessageResult>;
  sendList(params: SendListParams): Promise<SendMessageResult>;
  sendLocation(params: SendLocationParams): Promise<SendMessageResult>;
  sendContact(params: SendContactParams): Promise<SendMessageResult>;

  fetchProfilePictureUrl?(instanceName: string, phone: string): Promise<string | null>;
  sendStatus?(params: SendStatusParams): Promise<SendMessageResult>;
}
