import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { FastifyInstance } from 'fastify';
import { ConversationMode, ConversationStatus } from '@prisma/client';

describe('Admin Inbox & Human Takeover API', () => {
  let app: FastifyInstance;
  let companyId: string;
  let contactId: string;
  let conversationId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    const company = await prisma.company.findUnique({
      where: { slug: 'cine-estacao' },
    });
    companyId = company!.id;

    // Create a contact and conversation for testing
    const contact = await prisma.contact.create({
      data: {
        companyId,
        phone: `5511${Date.now().toString().slice(-9)}`,
        name: 'Cliente Inbox Teste',
      },
    });
    contactId = contact.id;

    const conv = await prisma.conversation.create({
      data: {
        companyId,
        contactId,
        currentFlow: 'SUPPORT',
        currentState: 'WAITING_HUMAN',
        mode: ConversationMode.BOT,
      },
    });
    conversationId = conv.id;
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversation.deleteMany({ where: { id: conversationId } });
    await prisma.contact.deleteMany({ where: { id: contactId } });
    await app.close();
    await prisma.$disconnect();
  });

  it('should list conversations for the company in the Inbox', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/whatsapp/conversations',
      headers: {
        'x-company-id': companyId,
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    const found = json.data.find((c: any) => c.id === conversationId);
    expect(found).toBeDefined();
    expect(found.contact.name).toBe('Cliente Inbox Teste');
  });

  it('should take over conversation (mode = HUMAN)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/whatsapp/conversations/${conversationId}/takeover`,
      headers: {
        'x-company-id': companyId,
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(json.data.mode).toBe(ConversationMode.HUMAN);

    // Verify in database
    const inDb = await prisma.conversation.findUnique({ where: { id: conversationId } });
    expect(inDb?.mode).toBe(ConversationMode.HUMAN);
  });

  it('should allow agent to send a message to customer', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/whatsapp/conversations/${conversationId}/messages`,
      headers: {
        'x-company-id': companyId,
      },
      payload: {
        text: 'Olá! Sou o atendente Carlos, como posso te ajudar?',
      },
    });

    expect(response.statusCode).toBe(201);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(json.data.sender).toBe('AGENT');
    expect(json.data.direction).toBe('OUTBOUND');
    expect(json.data.content).toContain('atendente Carlos');
  });

  it('should retrieve conversation message history', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/whatsapp/conversations/${conversationId}/messages`,
      headers: {
        'x-company-id': companyId,
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(1);
    expect(json.data[0].content).toContain('atendente Carlos');
  });

  it('should release conversation back to bot (mode = BOT)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/whatsapp/conversations/${conversationId}/release`,
      headers: {
        'x-company-id': companyId,
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(json.data.mode).toBe(ConversationMode.BOT);
    expect(json.data.currentFlow).toBe('MAIN_MENU');
  });

  it('should close conversation (status = CLOSED)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/whatsapp/conversations/${conversationId}/close`,
      headers: {
        'x-company-id': companyId,
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe(ConversationStatus.CLOSED);
  });

  it('should get and update bot settings', async () => {
    // Get
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/whatsapp/settings',
      headers: { 'x-company-id': companyId },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().data.companyId).toBe(companyId);

    // Update
    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/whatsapp/settings',
      headers: { 'x-company-id': companyId },
      payload: {
        welcomeMessage: 'Bem-vindo ao Cine Estação VIP!',
        maxFallbackCount: 4,
      },
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().data.welcomeMessage).toBe('Bem-vindo ao Cine Estação VIP!');
    expect(putRes.json().data.maxFallbackCount).toBe(4);
  });
});
