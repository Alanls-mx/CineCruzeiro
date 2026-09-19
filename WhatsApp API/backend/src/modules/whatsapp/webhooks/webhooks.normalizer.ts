import { MessageType } from '@prisma/client';
import { EvolutionWebhookPayload, IncomingWhatsAppMessage } from './webhooks.types.js';

export function normalizeEvolutionMessage(
  companyId: string,
  instanceId: string,
  payload: EvolutionWebhookPayload
): IncomingWhatsAppMessage | null {
  const data = payload.data;
  if (!data || !data.key) {
    return null;
  }

  // Ignore messages sent by ourselves
  if (data.key.fromMe) {
    return null;
  }

  const remoteJid = data.key.remoteJid || '';
  // Ignore status broadcast and group messages if not direct chat
  if (remoteJid.includes('@broadcast') || remoteJid.includes('@g.us')) {
    return null;
  }

  const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
  if (!phone) {
    return null;
  }

  const messageId = data.key.id || `msg_${Date.now()}`;
  const name = data.pushName || phone;
  const msg = data.message || {};

  let type: MessageType = MessageType.UNKNOWN;
  let text = '';
  let selectionId: string | undefined = undefined;
  let media: IncomingWhatsAppMessage['media'] = undefined;

  // 1. Text Message
  if (msg.conversation) {
    type = MessageType.TEXT;
    text = msg.conversation.trim();
  } else if (msg.extendedTextMessage?.text) {
    type = MessageType.TEXT;
    text = msg.extendedTextMessage.text.trim();
  }

  // 2. Button Reply
  else if (msg.buttonsResponseMessage?.selectedButtonId) {
    type = MessageType.BUTTON;
    selectionId = msg.buttonsResponseMessage.selectedButtonId;
    text = msg.buttonsResponseMessage.selectedDisplayText || selectionId;
  } else if (msg.templateButtonReplyMessage?.selectedId) {
    type = MessageType.BUTTON;
    selectionId = msg.templateButtonReplyMessage.selectedId;
    text = msg.templateButtonReplyMessage.selectedDisplayText || selectionId;
  }

  // 3. List Reply
  else if (msg.listResponseMessage?.singleSelectReply?.selectedRowId) {
    type = MessageType.LIST;
    selectionId = msg.listResponseMessage.singleSelectReply.selectedRowId;
    text = msg.listResponseMessage.title || selectionId;
  }

  // 4. Image
  else if (msg.imageMessage) {
    type = MessageType.IMAGE;
    text = msg.imageMessage.caption || '';
    media = {
      url: msg.imageMessage.url,
      mimetype: msg.imageMessage.mimetype || 'image/jpeg',
      caption: msg.imageMessage.caption,
    };
  }

  // 5. Audio / Voice Note
  else if (msg.audioMessage) {
    type = MessageType.AUDIO;
    media = {
      url: msg.audioMessage.url,
      mimetype: msg.audioMessage.mimetype || 'audio/ogg',
    };
  }

  // 6. Document
  else if (msg.documentMessage) {
    type = MessageType.DOCUMENT;
    text = msg.documentMessage.caption || msg.documentMessage.fileName || '';
    media = {
      url: msg.documentMessage.url,
      mimetype: msg.documentMessage.mimetype || 'application/pdf',
      fileName: msg.documentMessage.fileName,
      caption: msg.documentMessage.caption,
    };
  }

  // 7. Location
  else if (msg.locationMessage) {
    type = MessageType.LOCATION;
    text = `Location: ${msg.locationMessage.degreesLatitude}, ${msg.locationMessage.degreesLongitude}`;
  }

  // 8. Contact
  else if (msg.contactMessage) {
    type = MessageType.CONTACT;
    text = msg.contactMessage.displayName || 'Contato';
  }

  // Calculate timestamp
  let timestamp = new Date();
  if (data.messageTimestamp) {
    const tsNum = Number(data.messageTimestamp);
    timestamp = new Date(tsNum > 10000000000 ? tsNum : tsNum * 1000);
  }

  return {
    messageId,
    companyId,
    instanceId,
    instanceName: payload.instance,
    phone,
    name,
    type,
    text,
    selectionId,
    media,
    timestamp,
    rawPayload: payload,
  };
}
