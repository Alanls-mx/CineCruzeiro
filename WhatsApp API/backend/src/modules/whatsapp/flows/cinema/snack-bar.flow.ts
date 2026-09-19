import { Flow, FlowActionResult, FlowSession, FlowState } from '../flow-engine.types.js';
import { WhatsAppProvider } from '../../providers/whatsapp-provider.interface.js';
import { IncomingWhatsAppMessage } from '../../webhooks/webhooks.types.js';
import type { CatalogConcession } from '../../../cinema/services/commercial-catalog.service.js';

export class SnackBarFlow implements Flow {
  public readonly id = 'SNACK_BAR';
  public readonly initialState = 'SHOW_CATEGORIES';
  public readonly states = new Map<string, FlowState>();

  constructor() {
    // -------------------------------------------------------------------------
    // State: SHOW_CATEGORIES
    // -------------------------------------------------------------------------
    this.states.set('SHOW_CATEGORIES', {
      name: 'SHOW_CATEGORIES',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: 'Bomboniere',
          description: 'Escolha a categoria que deseja conferir:',
          buttonText: 'Ver Categorias',
          sections: [
            {
              title: 'Cardápio da Bomboniere',
              rows: [
                { id: 'CAT_COMBO', title: 'Super Combos', description: 'Pipoca + refrigerantes e acompanhamentos' },
                { id: 'CAT_POPCORN', title: 'Pipocas', description: 'Opções salgadas, doces e com manteiga' },
                { id: 'CAT_BEVERAGE', title: 'Bebidas', description: 'Refrigerantes, águas e sucos' },
                { id: 'CAT_CANDY', title: 'Doces e Balas', description: 'Chocolates M&Ms, balas Fini e guloseimas' },
                { id: 'BACK_TO_MENU', title: 'Voltar ao Menu Principal' },
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
        const selection = (message.selectionId || message.text || '').toUpperCase().trim();

        if (selection === 'BACK_TO_MENU' || selection === '0' || selection === '5' || selection === 'MENU' || selection.includes('VOLTAR')) {
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        let category: string | null = null;
        if (selection === 'CAT_COMBO' || selection === '1' || selection.includes('COMBO')) category = 'combo';
        else if (selection === 'CAT_POPCORN' || selection === '2' || selection.includes('PIPOCA')) category = 'popcorn';
        else if (selection === 'CAT_BEVERAGE' || selection === '3' || selection.includes('BEBIDA') || selection.includes('REFRI')) category = 'beverage';
        else if (selection === 'CAT_CANDY' || selection === '4' || selection.includes('DOCE') || selection.includes('BALA') || selection.includes('CHOCOLATE')) category = 'candy';

        if (!category) {
          return { handled: false };
        }

        const categoryLabels: Record<string, string> = {
          combo: 'Super Combos',
          popcorn: 'Pipocas',
          beverage: 'Bebidas',
          candy: 'Doces e Balas',
          snack: 'Snacks',
        };
        const friendlyTitle = categoryLabels[category] || 'Produtos da Bomboniere';

        const { CommercialCatalogService } = await import('../../../cinema/services/commercial-catalog.service.js');
        const catalogService = CommercialCatalogService.getInstance();
        const allConcessions = await catalogService.getConcessions();

        const products: CatalogConcession[] = allConcessions.filter((p) => {
          const rawCategory = String(p.category || '').trim().toLowerCase();
          return rawCategory === category
            || (category === 'popcorn' && rawCategory.includes('pipoca'))
            || (category === 'beverage' && (rawCategory.includes('bebida') || rawCategory.includes('refrigerante')))
            || (category === 'candy' && (rawCategory.includes('doce') || rawCategory.includes('chocolate')));
        });

        if (products.length === 0) {
          await provider.sendText({
            instanceName: session.instanceName,
            to: session.phone,
            text: 'Nenhum item disponível nesta categoria no momento.\nDigite *0* ou *MENU* para retornar.',
          });
          return { nextFlow: 'SNACK_BAR', nextState: 'WAIT_ACTION', handled: true };
        }

        let menuText = `*Bomboniere — ${friendlyTitle}*\n\n`;
        for (const p of products) {
          menuText += `• *${p.name}* — R$ ${Number(p.price).toFixed(2).replace('.', ',')}\n`;
          if (p.description) {
            menuText += `  _${p.description}_\n\n`;
          } else {
            menuText += `\n`;
          }
        }
        menuText += `Escolha uma das opções abaixo:`;

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: 'Produtos da Bomboniere',
          description: menuText,
          buttonText: 'Opções',
          sections: [
            {
              title: 'Continuar',
              rows: [
                { id: 'ANOTHER_CATEGORY', title: 'Outra Categoria' },
                { id: 'BUY_TICKET', title: 'Comprar Ingressos' },
                { id: 'BACK_TO_MENU', title: 'Voltar ao Menu Principal' },
              ],
            },
          ],
        });

        return {
          nextFlow: 'SNACK_BAR',
          nextState: 'WAIT_ACTION',
          resetFallbackCount: true,
          handled: true,
        };
      },
    });

    // -------------------------------------------------------------------------
    // State: WAIT_ACTION
    // -------------------------------------------------------------------------
    this.states.set('WAIT_ACTION', {
      name: 'WAIT_ACTION',
      onMessage: async (
        session: FlowSession,
        message: IncomingWhatsAppMessage,
        provider: WhatsAppProvider
      ): Promise<FlowActionResult> => {
        const selection = (message.selectionId || message.text || '').toUpperCase().trim();

        if (selection === 'ANOTHER_CATEGORY' || selection === '1' || selection.includes('OUTRA') || selection.includes('CATEGORIA')) {
          return { nextFlow: 'SNACK_BAR', nextState: 'SHOW_CATEGORIES', handled: true, resetFallbackCount: true };
        }
        if (selection === 'BUY_TICKET' || selection === '2' || selection.includes('INGRESSO') || selection.includes('COMPR')) {
          return { nextFlow: 'BUY_TICKET', nextState: 'SELECT_MOVIE', handled: true, resetFallbackCount: true };
        }
        if (selection === 'BACK_TO_MENU' || selection === '3' || selection === '0' || selection === 'MENU' || selection.includes('VOLTAR')) {
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: false };
      },
    });
  }
}
