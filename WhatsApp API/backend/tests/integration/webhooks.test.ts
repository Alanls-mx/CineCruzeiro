import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { incomingQueue } from '../../src/queue/bullmq.js';
import { FastifyInstance } from 'fastify';
import { env } from '../../src/config/env.js';

describe('Evolution Webhooks & Idempotency Pipeline', () => {
  let app: FastifyInstance;
  const instanceName = 'cine-estacao-whatsapp';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('should process incoming message webhook and queue it in BullMQ', async () => {
    const messageId = `test_msg_${Date.now()}`;
    const payload = {
      event: 'MESSAGES_UPSERT',
      instance: instanceName,
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: messageId,
        },
        pushName: 'João Silva',
        message: {
          conversation: 'Olá, gostaria de saber os horários!',
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    };

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/evolution',
      headers: { 'x-lumix-webhook-secret': env.EVOLUTION_WEBHOOK_SECRET },
      payload,
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(json.data.queued).toBe(true);
    expect(json.data.messageId).toBe(messageId);

    // Verify it is recorded in processed_events
    const event = await prisma.processedEvent.findFirst({
      where: { eventId: messageId },
    });
    expect(event).toBeDefined();
    expect(event?.provider).toBe('EVOLUTION');
  });

  it('should deduplicate repeated webhook events with same messageId', async () => {
    const duplicateMessageId = `dup_msg_${Date.now()}`;
    const payload = {
      event: 'MESSAGES_UPSERT',
      instance: instanceName,
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: duplicateMessageId,
        },
        pushName: 'Maria Santos',
        message: {
          conversation: 'Quero comprar ingresso',
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    };

    // First call -> queued
    const res1 = await app.inject({
      method: 'POST',
      url: '/webhooks/evolution',
      headers: { 'x-lumix-webhook-secret': env.EVOLUTION_WEBHOOK_SECRET },
      payload,
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().data.queued).toBe(true);

    // Second call -> deduplicated!
    const res2 = await app.inject({
      method: 'POST',
      url: '/webhooks/evolution',
      headers: { 'x-lumix-webhook-secret': env.EVOLUTION_WEBHOOK_SECRET },
      payload,
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().data.deduplicated).toBe(true);
  });

  it('should ignore outgoing messages sent by ourselves', async () => {
    const payload = {
      event: 'MESSAGES_UPSERT',
      instance: instanceName,
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: true, // From ourselves
          id: `out_${Date.now()}`,
        },
        message: {
          conversation: 'Mensagem do atendente',
        },
      },
    };

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/evolution',
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.ignored).toBe(true);
  });
});
