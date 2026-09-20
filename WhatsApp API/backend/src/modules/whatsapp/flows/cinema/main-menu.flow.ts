import { Flow, FlowActionResult, FlowSession, FlowState } from '../flow-engine.types.js';
import { WhatsAppProvider } from '../../providers/whatsapp-provider.interface.js';
import { IncomingWhatsAppMessage } from '../../webhooks/webhooks.types.js';
import { IntentNormalizer, StandardIntent } from '../intent-normalizer.js';

export class MainMenuFlow implements Flow {
  public readonly id = 'MAIN_MENU';
  public readonly initialState = 'SHOW_MENU';
  public readonly states = new Map<string, FlowState>();

  constructor() {
    this.states.set('SHOW_MENU', {
      name: 'SHOW_MENU',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: session.companyName,
          description: `Olá! 👋 Bem-vindo ao *${session.companyName}*.\nConsulte a programação, compre ingressos ou fale com a equipe:`,
          buttonText: 'Ver Opções',
          footer: 'Atendimento Digital',
          sections: [
            {
              title: 'Menu Principal',
              rows: [
                { id: 'PROGRAMMING', title: 'Filmes em Cartaz', description: 'Consulte os filmes e sessões ativas' },
                { id: 'UPCOMING', title: 'Filmes Em Breve', description: 'Próximos lançamentos do cinema' },
                { id: 'BUY_TICKET', title: 'Ingressos', description: 'Compre ingressos para sua sessão' },
                { id: 'SNACK_BAR', title: 'Bomboniere', description: 'Combos, pipocas, bebidas e doces' },
                { id: 'SUPPORT', title: 'Falar com Atendente', description: 'Fale diretamente com nossa equipe' },
              ],
            },
          ],
        });
      },
      onMessage: async (
        session: FlowSession,
        message: IncomingWhatsAppMessage,
        provider: WhatsAppProvider
      ): Promise<FlowActionResult> => {
        const raw = (message.selectionId || message.text || '').trim();
        const cleaned = IntentNormalizer.clean(raw);

        if (raw === 'UPCOMING' || cleaned === '2' || cleaned.includes('breve') || cleaned.includes('lancamento') || cleaned.includes('proximo')) {
          return {
            nextFlow: 'PROGRAMMING',
            nextState: 'SHOW_UPCOMING_MOVIES',
            resetFallbackCount: true,
            handled: true,
          };
        }

        const intent = IntentNormalizer.matchMainMenuIntent(message.text, message.selectionId);

        if (intent === StandardIntent.PROGRAMMING || cleaned === '1' || cleaned.includes('cartaz') || cleaned.includes('programacao')) {
          return {
            nextFlow: 'PROGRAMMING',
            nextState: 'SELECT_DATE',
            resetFallbackCount: true,
            handled: true,
          };
        }

        if (intent === StandardIntent.BUY_TICKET || cleaned === '3' || cleaned.includes('ingresso') || cleaned.includes('comprar')) {
          return {
            nextFlow: 'BUY_TICKET',
            nextState: 'SELECT_MOVIE',
            resetFallbackCount: true,
            handled: true,
          };
        }

        if (intent === StandardIntent.SNACK_BAR || cleaned === '4' || cleaned.includes('bomboniere') || cleaned.includes('pipoca') || cleaned.includes('combo')) {
          return {
            nextFlow: 'SNACK_BAR',
            nextState: 'SHOW_CATEGORIES',
            resetFallbackCount: true,
            handled: true,
          };
        }

        if (intent === StandardIntent.HUMAN_SUPPORT || cleaned === '5' || cleaned.includes('atendente') || cleaned.includes('humano')) {
          return {
            nextFlow: 'SUPPORT',
            nextState: 'TRANSFER',
            resetFallbackCount: true,
            handled: true,
          };
        }

        if (intent === StandardIntent.MAIN_MENU) {
          if (this.states.get('SHOW_MENU')?.onEnter) {
            await this.states.get('SHOW_MENU')!.onEnter!(session, provider);
          }
          return {
            nextFlow: 'MAIN_MENU',
            nextState: 'SHOW_MENU',
            resetFallbackCount: true,
            handled: true,
          };
        }

        // Fallback: re-show menu
        return {
          nextFlow: 'MAIN_MENU',
          nextState: 'SHOW_MENU',
          handled: false,
        };
      },
    });
  }
}
