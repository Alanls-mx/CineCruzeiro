import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/database/prisma.js';
import { FlowEngine } from '../../src/modules/whatsapp/flows/flow-engine.js';
import { MockWhatsAppProvider } from '../../src/modules/whatsapp/providers/mock/mock-whatsapp.provider.js';
import { ConversationMode, MessageType } from '@prisma/client';

describe('Flow Engine - Cinema Customer Service Flows', () => {
  let flowEngine: FlowEngine;
  let mockProvider: MockWhatsAppProvider;
  let companyId: string;
  let contactId: string;
  let conversationId: string;
  const testPhone = '5511999112233';

  beforeAll(async () => {
    flowEngine = new FlowEngine();
    mockProvider = new MockWhatsAppProvider();

    const company = await prisma.company.findUnique({
      where: { slug: 'cine-estacao' },
    });
    companyId = company!.id;

    // Create test contact
    const contact = await prisma.contact.upsert({
      where: { companyId_phone: { companyId, phone: testPhone } },
      update: {},
      create: {
        companyId,
        phone: testPhone,
        name: 'Cliente Teste',
      },
    });
    contactId = contact.id;

    // Create active conversation
    const conv = await prisma.conversation.create({
      data: {
        companyId,
        contactId,
        currentFlow: 'MAIN_MENU',
        currentState: 'SHOW_MENU',
        mode: ConversationMode.BOT,
      },
    });
    conversationId = conv.id;
  });

  afterAll(async () => {
    await prisma.conversation.deleteMany({ where: { contactId } });
    await prisma.contact.deleteMany({ where: { id: contactId } });
    await prisma.$disconnect();
  });

  it('1. should present the Main Menu with options when customer sends "Oi"', async () => {
    mockProvider.clear();
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });

    await flowEngine.processMessage(
      conv!,
      {
        messageId: 'msg_1',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Teste',
        type: MessageType.TEXT,
        text: 'Oi',
        timestamp: new Date(),
      },
      mockProvider
    );

    expect(mockProvider.sentMessages.length).toBeGreaterThanOrEqual(1);
    const lastMsg = mockProvider.getLastMessage(testPhone);
    expect(lastMsg?.type).toBe('list');
    expect(lastMsg?.payload.description).toContain('Cine Estação');
  });

  it('2. should show real programming when selecting "PROGRAMMING"', async () => {
    mockProvider.clear();
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });

    // Customer selects PROGRAMMING
    await flowEngine.processMessage(
      conv!,
      {
        messageId: 'msg_2',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Teste',
        type: MessageType.BUTTON,
        selectionId: 'PROGRAMMING',
        text: '🎬 Programação',
        timestamp: new Date(),
      },
      mockProvider
    );

    // Flow prompts for date (Hoje / Amanhã)
    const promptMsg = mockProvider.getLastMessage(testPhone);
    expect(promptMsg?.payload.title).toContain('Programação');

    // Customer chooses DATE_TODAY
    const convUpdated = await prisma.conversation.findUnique({ where: { id: conversationId } });
    await flowEngine.processMessage(
      convUpdated!,
      {
        messageId: 'msg_3',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Teste',
        type: MessageType.LIST,
        selectionId: 'DATE_TODAY',
        text: 'Hoje',
        timestamp: new Date(),
      },
      mockProvider
    );

    const moviesListMsg = mockProvider.getLastMessage(testPhone);
    expect(moviesListMsg?.payload.title).toContain('Filmes em Cartaz');
    const movieTitles = moviesListMsg?.payload.sections[0].rows.map((r: any) => r.title.toUpperCase());
    expect(movieTitles).toContain('SUPERMAN');

    // Customer selects movie #1 (SUPERMAN)
    const convMovie = await prisma.conversation.findUnique({ where: { id: conversationId } });
    await flowEngine.processMessage(
      convMovie!,
      {
        messageId: 'msg_3b',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Teste',
        type: MessageType.TEXT,
        text: 'Superman',
        timestamp: new Date(),
      },
      mockProvider
    );

    const movieDetailMsg = mockProvider.getLastMessage(testPhone);
    expect(movieDetailMsg?.payload.title.toUpperCase()).toContain('SUPERMAN');
    expect(movieDetailMsg?.payload.description).toContain('SUPERMAN');
    expect(movieDetailMsg?.payload.description).toContain('Sessões');
  });

  it('3. should show Bomboniere categories and items when selecting "SNACK_BAR"', async () => {
    mockProvider.clear();
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });

    await flowEngine.processMessage(
      conv!,
      {
        messageId: 'msg_4',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Teste',
        type: MessageType.BUTTON,
        selectionId: 'SNACK_BAR',
        text: '🍿 Bomboniere',
        timestamp: new Date(),
      },
      mockProvider
    );

    // Select Combos
    const convUpdated = await prisma.conversation.findUnique({ where: { id: conversationId } });
    await flowEngine.processMessage(
      convUpdated!,
      {
        messageId: 'msg_5',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Teste',
        type: MessageType.LIST,
        selectionId: 'CAT_COMBO',
        text: 'Super Combos',
        timestamp: new Date(),
      },
      mockProvider
    );

    const productsMsg = mockProvider.getLastMessage(testPhone);
    expect(productsMsg?.payload.description).toContain('Super Combo Casal');
    expect(productsMsg?.payload.description).toContain('64.90');
  });

  it('4. should switch mode to HUMAN and silence bot when requesting support', async () => {
    mockProvider.clear();
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });

    await flowEngine.processMessage(
      conv!,
      {
        messageId: 'msg_6',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Teste',
        type: MessageType.BUTTON,
        selectionId: 'SUPPORT',
        text: '👨‍💼 Falar com atendente',
        timestamp: new Date(),
      },
      mockProvider
    );

    // Verify conversation mode updated to HUMAN in database
    const convAfter = await prisma.conversation.findUnique({ where: { id: conversationId } });
    expect(convAfter?.mode).toBe(ConversationMode.HUMAN);

    // Verify transfer notice sent
    const transferMsg = mockProvider.getLastMessage(testPhone);
    expect(transferMsg?.payload).toContain('Atendimento Humano');

    // Send another message from customer while in HUMAN mode -> Bot MUST NOT reply!
    mockProvider.clear();
    await flowEngine.processMessage(
      convAfter!,
      {
        messageId: 'msg_7',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Teste',
        type: MessageType.TEXT,
        text: 'Tem alguém aí?',
        timestamp: new Date(),
      },
      mockProvider
    );

    expect(mockProvider.sentMessages.length).toBe(0); // BOT IS SILENT!
  });
});
