import { Flow, FlowActionResult, FlowSession, FlowState } from '../flow-engine.types.js';
import { WhatsAppProvider } from '../../providers/whatsapp-provider.interface.js';
import { IncomingWhatsAppMessage } from '../../webhooks/webhooks.types.js';
import { prisma } from '../../../../database/prisma.js';
import { ConversationMode } from '@prisma/client';

export class HumanSupportFlow implements Flow {
  public readonly id = 'SUPPORT';
  public readonly initialState = 'TRANSFER';
  public readonly states = new Map<string, FlowState>();

  constructor() {
    this.states.set('TRANSFER', {
      name: 'TRANSFER',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        // Change conversation mode to HUMAN
        await prisma.conversation.update({
          where: { id: session.conversationId },
          data: {
            mode: ConversationMode.HUMAN,
            currentFlow: 'SUPPORT',
            currentState: 'WAITING_HUMAN',
          },
        });

        await provider.sendText({
          instanceName: session.instanceName,
          to: session.phone,
          text: `*Atendimento Humano*\n\nTransferimos sua solicitação para a equipe do Cine Cruzeiro.\nUm de nossos atendentes entrará em contato em instantes.\n\n_(Para retornar ao menu automático a qualquer momento, digite *#menu* ou *sair*)_`,
        });
      },
      onMessage: async (
        session: FlowSession,
        message: IncomingWhatsAppMessage,
        provider: WhatsAppProvider
      ): Promise<FlowActionResult> => {
        // While in HUMAN mode, bot remains completely silent
        return {
          handled: true,
          nextFlow: 'SUPPORT',
          nextState: 'WAITING_HUMAN',
        };
      },
    });
  }
}
