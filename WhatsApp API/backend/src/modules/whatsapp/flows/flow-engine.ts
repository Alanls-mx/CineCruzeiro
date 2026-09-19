import { FlowRegistry } from './flow.registry.js';
import { FlowSession } from './flow-engine.types.js';
import { WhatsAppProvider } from '../providers/whatsapp-provider.interface.js';
import { IncomingWhatsAppMessage } from '../webhooks/webhooks.types.js';
import { SSEService } from '../realtime/sse.service.js';
import { IntentNormalizer, StandardIntent } from './intent-normalizer.js';
import { prisma } from '../../../database/prisma.js';
import { Conversation, ConversationMode, MessageDirection, MessageSender, MessageType } from '@prisma/client';
import { logger } from '../../../config/logger.js';

export class FlowEngine {
  async processMessage(
    conversation: Conversation,
    rawMessage: IncomingWhatsAppMessage,
    rawProvider: WhatsAppProvider
  ): Promise<void> {
    const message: IncomingWhatsAppMessage = {
      ...rawMessage,
      text: (rawMessage.text || '').trim(),
    };

    const company = await prisma.company.findUnique({
      where: { id: conversation.companyId },
      include: { settings: true },
    });

    if (!company) {
      logger.error({ companyId: conversation.companyId }, 'Company not found in FlowEngine');
      return;
    }

    if (company.settings && !company.settings.autoReplyEnabled && conversation.mode === ConversationMode.BOT) {
      logger.info({ conversationId: conversation.id }, 'Automated reply disabled by Cine Cruzeiro settings');
      return;
    }

    // 1. Check if conversation is in HUMAN or PAUSED mode
    if (conversation.mode === ConversationMode.HUMAN || conversation.mode === ConversationMode.PAUSED) {
      const text = (message.text || '').trim();
      const cleaned = IntentNormalizer.clean(text);
      const globalIntent = IntentNormalizer.matchGlobalIntent(text);

      const isReturnToBot =
        text.startsWith('#') ||
        ['menu', 'sair', 'bot', 'voltar', 'reiniciar', 'inicio', 'comecar', 'robo'].includes(cleaned) ||
        globalIntent === StandardIntent.MAIN_MENU ||
        globalIntent === StandardIntent.BACK;

      if (isReturnToBot) {
        logger.info(
          { conversationId: conversation.id, phone: message.phone },
          'User explicitly requested to exit non-bot mode and return to automated BOT flow'
        );
        conversation = await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            mode: ConversationMode.BOT,
            currentFlow: 'MAIN_MENU',
            currentState: 'SHOW_MENU',
            fallbackCount: 0,
            context: {},
          },
        });
      } else {
        logger.info(
          { conversationId: conversation.id, mode: conversation.mode },
          'Conversation in non-bot mode, automated flow will not reply'
        );
        return;
      }
    }

    // Wrap provider to automatically persist and broadcast all bot replies
    const recordBotMessage = async (content: string, mediaUrl?: string, externalMessageId?: string) => {
      try {
        const saved = await prisma.message.create({
          data: {
            companyId: conversation.companyId,
            conversationId: conversation.id,
            externalMessageId: externalMessageId || `bot_${Date.now()}`,
            direction: MessageDirection.OUTBOUND,
            sender: MessageSender.BOT,
            type: mediaUrl ? MessageType.IMAGE : MessageType.TEXT,
            content: content,
            metadata: mediaUrl ? { mediaUrl } : {},
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        });

        SSEService.broadcastToCompany(conversation.companyId, 'message:new', {
          conversationId: conversation.id,
          message: saved,
        });
      } catch (e: any) {
        logger.error({ err: e.message }, 'Failed recording bot message to database');
      }
    };

    const provider: WhatsAppProvider = {
      ...rawProvider,
      sendText: async (params) => {
        const res = await rawProvider.sendText(params);
        await recordBotMessage(params.text, undefined, res.messageId);
        return res;
      },
      sendList: async (params) => {
        const res = await rawProvider.sendList(params);
        let listText = `*${params.title}*\n\n${params.description}\n\n`;
        let counter = 1;
        for (const section of params.sections) {
          if (section.title) {
            listText += `*${section.title}*\n`;
          }
          for (const row of section.rows) {
            listText += `*${counter}.* ${row.title}${row.description ? ` — _${row.description}_` : ''}\n`;
            counter++;
          }
          listText += '\n';
        }
        if (params.footer) {
          listText += `_${params.footer}_\n\n`;
        }
        listText += `_Responda com o número da opção desejada._`;
        await recordBotMessage(listText.trim(), undefined, res.messageId);
        return res;
      },
      sendButtons: async (params) => {
        const res = await rawProvider.sendButtons(params);
        let btnText = `*${params.title}*\n\n${params.description}\n\n`;
        params.buttons.forEach((btn, index) => {
          btnText += `*${index + 1}.* ${btn.displayText}\n`;
        });
        if (params.footer) {
          btnText += `\n_${params.footer}_\n`;
        }
        btnText += `\n_Responda com o número da opção desejada._`;
        await recordBotMessage(btnText.trim(), undefined, res.messageId);
        return res;
      },
      sendImage: async (params) => {
        const res = await rawProvider.sendImage(params);
        await recordBotMessage(params.caption || '[Imagem]', params.mediaUrl, res.messageId);
        return res;
      },
      sendDocument: async (params) => {
        const res = await rawProvider.sendDocument(params);
        await recordBotMessage(params.caption || '[Documento]', params.mediaUrl, res.messageId);
        return res;
      },
      sendLocation: async (params) => {
        const res = await rawProvider.sendLocation(params);
        await recordBotMessage(`📍 ${params.name || 'Localização'}: ${params.address || ''}`, undefined, res.messageId);
        return res;
      },
      sendContact: async (params) => {
        const res = await rawProvider.sendContact(params);
        await recordBotMessage(`👤 Contato: ${params.contactName} (${params.contactPhone})`, undefined, res.messageId);
        return res;
      },
    };

    // 2. Prepare FlowSession
    const contact = await prisma.contact.findUnique({
      where: { id: conversation.contactId },
    });

    const session: FlowSession = {
      companyId: company.id,
      companyName: company.name,
      contactId: contact?.id || conversation.contactId,
      phone: message.phone,
      contactName: contact?.name || message.name || message.phone,
      conversationId: conversation.id,
      currentFlow: conversation.currentFlow || 'MAIN_MENU',
      currentState: conversation.currentState || 'INITIAL',
      context: (conversation.context as Record<string, any>) || {},
      instanceName: message.instanceName,
    };

    // Check global commands and triggers (accessible from any state/flow)
    const globalIntent = IntentNormalizer.matchGlobalIntent(message.text, message.selectionId);

    // Human Support command
    if (globalIntent === StandardIntent.HUMAN_SUPPORT) {
      const supportFlow = FlowRegistry.getFlow('SUPPORT')!;
      const transferState = supportFlow.states.get('TRANSFER')!;
      if (transferState.onEnter) {
        await transferState.onEnter(session, provider);
      }
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentFlow: 'SUPPORT',
          currentState: 'WAITING_HUMAN',
          mode: ConversationMode.HUMAN,
          lastMessageAt: new Date(),
        },
      });
      SSEService.broadcastToCompany(company.id, 'conversation:update', {
        id: conversation.id,
        mode: ConversationMode.HUMAN,
      });
      return;
    }

    // Main Menu / Cancel trigger
    if (globalIntent === StandardIntent.MAIN_MENU || globalIntent === StandardIntent.CANCEL) {
      const mainFlow = FlowRegistry.getFlow('MAIN_MENU')!;
      const showMenuState = mainFlow.states.get('SHOW_MENU')!;
      if (showMenuState?.onEnter) {
        await showMenuState.onEnter(session, provider);
      }
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentFlow: 'MAIN_MENU',
          currentState: 'SHOW_MENU',
          context: {},
          fallbackCount: 0,
          lastMessageAt: new Date(),
        },
      });
      return;
    }

    // Direct top-level flow triggers via selectionId
    if (
      message.selectionId === 'PROGRAMMING' ||
      message.selectionId === 'SNACK_BAR' ||
      message.selectionId === 'BUY_TICKET'
    ) {
      const targetFlowId = message.selectionId;
      const targetFlow = FlowRegistry.getFlow(targetFlowId);
      if (targetFlow) {
        const initState = targetFlow.states.get(targetFlow.initialState);
        session.currentFlow = targetFlowId;
        session.currentState = targetFlow.initialState;
        session.context = {};
        if (initState?.onEnter) {
          await initState.onEnter(session, provider);
        }
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            currentFlow: targetFlowId,
            currentState: targetFlow.initialState,
            context: {},
            fallbackCount: 0,
            lastMessageAt: new Date(),
          },
        });
        return;
      }
    }

    // 3. Resolve Flow
    let flow = FlowRegistry.getFlow(session.currentFlow);
    if (!flow) {
      flow = FlowRegistry.getFlow('MAIN_MENU')!;
      session.currentFlow = 'MAIN_MENU';
      session.currentState = flow.initialState;
    }

    // 4. Resolve State
    let state = flow.states.get(session.currentState);
    if (!state) {
      state = flow.states.get(flow.initialState);
      if (state) {
        session.currentState = flow.initialState;
        if (state.onEnter) {
          await state.onEnter(session, provider);
        }
      }
    }

    if (!state) {
      logger.error({ flow: session.currentFlow, state: session.currentState }, 'Unable to resolve flow state');
      return;
    }

    // 5. Execute state onMessage
    const result = await state.onMessage(session, message, provider);

    // 6. Handle Fallback if message was not handled
    if (!result.handled) {
      const maxFallbacks = company.settings?.maxFallbackCount ?? 3;
      const newFallbackCount = conversation.fallbackCount + 1;

      if (newFallbackCount >= maxFallbacks) {
        // Offer transfer to human support after repeated failures
        await provider.sendText({
          instanceName: session.instanceName,
          to: session.phone,
          text: `Não consegui compreender sua solicitação após algumas tentativas.\n\nVou te transferir para nossa equipe de atendimento humano! 👨‍💼`,
        });

        const supportFlow = FlowRegistry.getFlow('SUPPORT');
        const transferState = supportFlow?.states.get('TRANSFER');
        if (transferState?.onEnter) {
          await transferState.onEnter(session, provider);
        }

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            fallbackCount: 0,
            currentFlow: 'SUPPORT',
            currentState: 'WAITING_HUMAN',
            mode: ConversationMode.HUMAN,
          },
        });
        SSEService.broadcastToCompany(company.id, 'conversation:update', {
          id: conversation.id,
          mode: ConversationMode.HUMAN,
        });
        return;
      }

      // First/second fallback: send gentle clarification and re-show options
      const fallbackMsg = company.settings?.fallbackMessage || 'Não consegui entender. Por favor, escolha uma das opções:';
      await provider.sendText({
        instanceName: session.instanceName,
        to: session.phone,
        text: `${fallbackMsg}`,
      });

      // Re-trigger current state or main menu onEnter if present
      if (state.onEnter) {
        await state.onEnter(session, provider);
      }

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          fallbackCount: newFallbackCount,
        },
      });
      return;
    }

    // 7. Transition to Next Flow / State
    const nextFlowId = result.nextFlow || session.currentFlow;
    const nextStateName = result.nextState || session.currentState;
    const updatedContext = { ...session.context, ...(result.contextUpdate || {}) };

    const flowChanged = nextFlowId !== session.currentFlow;
    const stateChanged = nextStateName !== session.currentState;

    if (flowChanged || stateChanged) {
      const targetFlow = FlowRegistry.getFlow(nextFlowId);
      const targetState = targetFlow?.states.get(nextStateName);

      if (targetState?.onEnter) {
        // Execute onEnter of new state
        session.currentFlow = nextFlowId;
        session.currentState = nextStateName;
        session.context = updatedContext;
        await targetState.onEnter(session, provider);
      }
    }

    // 8. Persist new conversation state
    const newMode = result.nextMode || (nextFlowId === 'SUPPORT' ? ConversationMode.HUMAN : undefined);

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        currentFlow: nextFlowId,
        currentState: nextStateName,
        context: updatedContext,
        mode: newMode,
        fallbackCount: result.resetFallbackCount ? 0 : conversation.fallbackCount,
        lastMessageAt: new Date(),
      },
    });

    if (newMode) {
      SSEService.broadcastToCompany(company.id, 'conversation:update', {
        id: conversation.id,
        mode: newMode,
      });
    }
  }
}
