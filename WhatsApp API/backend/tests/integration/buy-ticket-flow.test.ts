import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/database/prisma.js';
import { FlowEngine } from '../../src/modules/whatsapp/flows/flow-engine.js';
import { MockWhatsAppProvider } from '../../src/modules/whatsapp/providers/mock/mock-whatsapp.provider.js';
import { MessageType } from '@prisma/client';

describe('Buy Ticket Flow - Integration Tests', () => {
  const mockProvider = new MockWhatsAppProvider();
  const flowEngine = new FlowEngine();

  const companyId = '6a9a6c2f-2166-4111-b2f1-534021401ada';
  const testPhone = '5511999997777';
  let contactId: string;
  let conversationId: string;

  beforeAll(async () => {
    // Reset test conversation & contact
    await prisma.conversation.deleteMany({
      where: { companyId, contact: { phone: testPhone } },
    });
    await prisma.contact.deleteMany({
      where: { companyId, phone: testPhone },
    });

    const contact = await prisma.contact.create({
      data: {
        companyId,
        phone: testPhone,
        name: 'Cliente Ingresso Teste',
      },
    });
    contactId = contact.id;

    const conv = await prisma.conversation.create({
      data: {
        companyId,
        contactId,
        currentFlow: 'MAIN_MENU',
        currentState: 'SHOW_MENU',
        mode: 'BOT',
        status: 'OPEN',
      },
    });
    conversationId = conv.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({
      where: { order: { companyId } },
    });
    await prisma.order.deleteMany({
      where: { companyId, contactId },
    });
    await prisma.message.deleteMany({
      where: { companyId, conversationId },
    });
    await prisma.conversation.deleteMany({
      where: { id: conversationId },
    });
    await prisma.contact.deleteMany({
      where: { id: contactId },
    });
  });

  it('should complete full ticket purchase flow: Movie -> Date -> Session -> Type -> Qty -> Summary -> Checkout', async () => {
    mockProvider.clear();
    let conv = await prisma.conversation.findUnique({ where: { id: conversationId } });

    // Step 1: Customer clicks BUY_TICKET
    await flowEngine.processMessage(
      conv!,
      {
        messageId: 'tmsg_1',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Ingresso Teste',
        type: MessageType.BUTTON,
        selectionId: 'BUY_TICKET',
        text: '🎟️ Ingressos',
        timestamp: new Date(),
      },
      mockProvider
    );

    let lastMsg = mockProvider.getLastMessage(testPhone);
    expect(lastMsg?.payload.title).toContain('Compra de Ingressos');

    // Step 2: Customer selects movie #1 (Superman)
    conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    await flowEngine.processMessage(
      conv!,
      {
        messageId: 'tmsg_2',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Ingresso Teste',
        type: MessageType.TEXT,
        text: 'Superman',
        timestamp: new Date(),
      },
      mockProvider
    );

    lastMsg = mockProvider.getLastMessage(testPhone);
    expect(lastMsg?.payload.title).toContain('Ingressos:');

    // Step 3: Customer selects Hoje ("1")
    conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    await flowEngine.processMessage(
      conv!,
      {
        messageId: 'tmsg_3',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Ingresso Teste',
        type: MessageType.TEXT,
        text: '1',
        timestamp: new Date(),
      },
      mockProvider
    );

    lastMsg = mockProvider.getLastMessage(testPhone);
    expect(lastMsg?.payload.title).toContain('Sessões:');

    // Step 4: Customer selects Session #1 ("1")
    conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    await flowEngine.processMessage(
      conv!,
      {
        messageId: 'tmsg_4',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Ingresso Teste',
        type: MessageType.TEXT,
        text: '1',
        timestamp: new Date(),
      },
      mockProvider
    );

    lastMsg = mockProvider.getLastMessage(testPhone);
    expect(lastMsg?.payload.title).toContain('Tipo de Ingresso');

    // Step 5: Customer chooses Inteira ("1")
    conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    await flowEngine.processMessage(
      conv!,
      {
        messageId: 'tmsg_5',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Ingresso Teste',
        type: MessageType.TEXT,
        text: '1',
        timestamp: new Date(),
      },
      mockProvider
    );

    lastMsg = mockProvider.getLastMessage(testPhone);
    expect(lastMsg?.payload.title).toContain('Quantidade de Ingressos');

    // Step 6: Customer chooses 2 tickets ("2")
    conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    await flowEngine.processMessage(
      conv!,
      {
        messageId: 'tmsg_6',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Ingresso Teste',
        type: MessageType.TEXT,
        text: '2',
        timestamp: new Date(),
      },
      mockProvider
    );

    // Step 7: Verify Order Summary
    lastMsg = mockProvider.getLastMessage(testPhone);
    expect(lastMsg?.payload.title).toContain('Resumo do Pedido');
    expect(lastMsg?.payload.description).toContain('2x Inteira');
    expect(lastMsg?.payload.sections[0].rows[0].title).toContain('Continuar para pagamento');

    // Step 8: Customer confirms payment ("1")
    conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    await flowEngine.processMessage(
      conv!,
      {
        messageId: 'tmsg_7',
        companyId,
        instanceId: 'inst_1',
        instanceName: 'cine-estacao-whatsapp',
        phone: testPhone,
        name: 'Cliente Ingresso Teste',
        type: MessageType.TEXT,
        text: '1',
        timestamp: new Date(),
      },
      mockProvider
    );

    lastMsg = mockProvider.getLastMessage(testPhone);
    expect(lastMsg?.payload).toContain('PEDIDO GERADO COM SUCESSO');
    expect(lastMsg?.payload).toContain('/c/');

    // Check DB: Order should exist with status PENDING and 2 tickets
    const createdOrder = await prisma.order.findFirst({
      where: { companyId, contactId },
      include: { tickets: true },
    });
    expect(createdOrder).not.toBeNull();
    expect(createdOrder?.status).toBe('PENDING');
    expect(createdOrder?.tickets).toHaveLength(2);
    expect(Number(createdOrder?.totalAmount)).toBeGreaterThan(0);
  });
});
