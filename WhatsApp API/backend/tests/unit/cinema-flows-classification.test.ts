import { describe, it, expect, vi } from 'vitest';
import { MainMenuFlow } from '../../src/modules/whatsapp/flows/cinema/main-menu.flow.js';
import { ProgrammingFlow } from '../../src/modules/whatsapp/flows/cinema/programming.flow.js';
import { SnackBarFlow } from '../../src/modules/whatsapp/flows/cinema/snack-bar.flow.js';
import { FlowSession } from '../../src/modules/whatsapp/flows/flow-engine.types.js';
import { WhatsAppProvider } from '../../src/modules/whatsapp/providers/whatsapp-provider.interface.js';
import { MessageType } from '@prisma/client';

vi.mock('../../src/database/prisma.js', () => ({
  prisma: {
    company: { findFirst: vi.fn().mockResolvedValue({ id: 'd2dab86a-96f4-4851-8460-e3fb6bcd4cae', name: 'Cine Cruzeiro' }) },
    movie: { upsert: vi.fn(), updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    room: { upsert: vi.fn() },
    session: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    product: {
      findMany: vi.fn().mockResolvedValue([
        { id: '1', name: 'Super Combo Casal', price: 64.9, description: 'Pipoca + 2 Refris', category: 'COMBO', isAvailable: true },
        { id: '2', name: 'Pipoca Grande Salgada', price: 26.0, description: 'Com manteiga', category: 'POPCORN', isAvailable: true },
      ]),
    },
    conversation: { update: vi.fn() },
  },
}));

describe('Cinema Classification & Flows', () => {
  const mockProvider: WhatsAppProvider = {
    createInstance: vi.fn(),
    deleteInstance: vi.fn(),
    logout: vi.fn(),
    getConnectionStatus: vi.fn(),
    getQrCode: vi.fn(),
    sendText: vi.fn().mockResolvedValue({ messageId: 'm1', status: 'SENT', timestamp: new Date() }),
    sendImage: vi.fn().mockResolvedValue({ messageId: 'm2', status: 'SENT', timestamp: new Date() }),
    sendDocument: vi.fn().mockResolvedValue({ messageId: 'm3', status: 'SENT', timestamp: new Date() }),
    sendButtons: vi.fn().mockResolvedValue({ messageId: 'm4', status: 'SENT', timestamp: new Date() }),
    sendList: vi.fn().mockResolvedValue({ messageId: 'm5', status: 'SENT', timestamp: new Date() }),
    sendLocation: vi.fn().mockResolvedValue({ messageId: 'm6', status: 'SENT', timestamp: new Date() }),
    sendContact: vi.fn().mockResolvedValue({ messageId: 'm7', status: 'SENT', timestamp: new Date() }),
  };

  const createSession = (): FlowSession => ({
    companyId: 'd2dab86a-96f4-4851-8460-e3fb6bcd4cae',
    companyName: 'Cine Cruzeiro',
    instanceName: 'cine-estacao-whatsapp',
    phone: '5512981157296',
    contactName: 'Cliente Teste',
    context: {},
    fallbackCount: 0,
  });

  describe('MainMenuFlow', () => {
    const mainMenu = new MainMenuFlow();
    const showMenuState = mainMenu.states.get('SHOW_MENU')!;

    it('should route option 1 or "cartaz" to PROGRAMMING:SELECT_DATE (Filmes em Cartaz)', async () => {
      const session = createSession();
      const res1 = await showMenuState.onMessage(
        session,
        { messageId: '1', phone: session.phone, type: MessageType.TEXT, text: '1', timestamp: new Date() },
        mockProvider
      );
      expect(res1.nextFlow).toBe('PROGRAMMING');
      expect(res1.nextState).toBe('SELECT_DATE');

      const resText = await showMenuState.onMessage(
        session,
        { messageId: '2', phone: session.phone, type: MessageType.TEXT, text: 'Quero ver os filmes em cartaz', timestamp: new Date() },
        mockProvider
      );
      expect(resText.nextFlow).toBe('PROGRAMMING');
      expect(resText.nextState).toBe('SELECT_DATE');
    });

    it('should route option 2 or "em breve" to PROGRAMMING:SHOW_UPCOMING_MOVIES', async () => {
      const session = createSession();
      const res2 = await showMenuState.onMessage(
        session,
        { messageId: '3', phone: session.phone, type: MessageType.TEXT, text: '2', timestamp: new Date() },
        mockProvider
      );
      expect(res2.nextFlow).toBe('PROGRAMMING');
      expect(res2.nextState).toBe('SHOW_UPCOMING_MOVIES');

      const resBreve = await showMenuState.onMessage(
        session,
        { messageId: '4', phone: session.phone, type: MessageType.TEXT, text: 'filmes em breve', timestamp: new Date() },
        mockProvider
      );
      expect(resBreve.nextFlow).toBe('PROGRAMMING');
      expect(resBreve.nextState).toBe('SHOW_UPCOMING_MOVIES');
    });

    it('should route option 4 or "bomboniere" to SNACK_BAR:SHOW_CATEGORIES', async () => {
      const session = createSession();
      const res4 = await showMenuState.onMessage(
        session,
        { messageId: '5', phone: session.phone, type: MessageType.TEXT, text: '4', timestamp: new Date() },
        mockProvider
      );
      expect(res4.nextFlow).toBe('SNACK_BAR');
      expect(res4.nextState).toBe('SHOW_CATEGORIES');

      const resSnack = await showMenuState.onMessage(
        session,
        { messageId: '6', phone: session.phone, type: MessageType.TEXT, text: 'ver a bomboniere', timestamp: new Date() },
        mockProvider
      );
      expect(resSnack.nextFlow).toBe('SNACK_BAR');
      expect(resSnack.nextState).toBe('SHOW_CATEGORIES');
    });
  });

  describe('ProgrammingFlow Date Selection', () => {
    const progFlow = new ProgrammingFlow();
    const selectDateState = progFlow.states.get('SELECT_DATE')!;

    it('should allow navigation to SHOW_UPCOMING_MOVIES from SELECT_DATE', async () => {
      const session = createSession();
      const resUpcoming = await selectDateState.onMessage(
        session,
        { messageId: '7', phone: session.phone, type: MessageType.TEXT, text: '4', selectionId: 'MOVIES_UPCOMING', timestamp: new Date() },
        mockProvider
      );
      expect(resUpcoming.nextFlow).toBe('PROGRAMMING');
      expect(resUpcoming.nextState).toBe('SHOW_UPCOMING_MOVIES');
    });
  });

  describe('SnackBarFlow Categories', () => {
    const snackFlow = new SnackBarFlow();
    const categoriesState = snackFlow.states.get('SHOW_CATEGORIES')!;

    it('should route option 1 to Combos category', async () => {
      const session = createSession();
      const res = await categoriesState.onMessage(
        session,
        { messageId: '8', phone: session.phone, type: MessageType.TEXT, text: '1', timestamp: new Date() },
        mockProvider
      );
      expect(res.nextFlow).toBe('SNACK_BAR');
      expect(res.nextState).toBe('WAIT_ACTION');
    });

    it('should route option 5 or 0 back to Main Menu', async () => {
      const session = createSession();
      const res = await categoriesState.onMessage(
        session,
        { messageId: '9', phone: session.phone, type: MessageType.TEXT, text: '5', selectionId: 'BACK_TO_MENU', timestamp: new Date() },
        mockProvider
      );
      expect(res.nextFlow).toBe('MAIN_MENU');
      expect(res.nextState).toBe('SHOW_MENU');
    });
  });
});
