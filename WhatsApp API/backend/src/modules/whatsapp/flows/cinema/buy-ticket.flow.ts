import { Flow, FlowActionResult, FlowSession, FlowState } from '../flow-engine.types.js';
import { WhatsAppProvider } from '../../providers/whatsapp-provider.interface.js';
import { IncomingWhatsAppMessage } from '../../webhooks/webhooks.types.js';
import {
  CommercialCatalogService,
  CatalogMovie,
  CatalogSession,
  CatalogDate,
  CatalogTicketType,
} from '../../../cinema/services/commercial-catalog.service.js';
import { OrderService } from '../../../cinema/services/order.service.js';
import { CartService } from '../../../cinema/services/cart.service.js';
import { IntentNormalizer, StandardIntent } from '../intent-normalizer.js';

function parseDateIso(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  if (dateStr.length === 10 && dateStr.includes('-')) return dateStr;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

export class BuyTicketFlow implements Flow {
  public readonly id = 'BUY_TICKET';
  public readonly initialState = 'SELECT_MOVIE';
  public readonly states = new Map<string, FlowState>();

  constructor(
    private readonly catalogService = CommercialCatalogService.getInstance(),
    private readonly orderService = new OrderService(),
    private readonly cartService = new CartService()
  ) {
    // -------------------------------------------------------------------------
    // State 1: SELECT_MOVIE
    // -------------------------------------------------------------------------
    this.states.set('SELECT_MOVIE', {
      name: 'SELECT_MOVIE',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        // If movie was already selected, fast-forward to SELECT_DATE
        if (session.context.selectedMovieId && session.context.selectedMovieTitle) {
          return;
        }

        const movies = await this.catalogService.getAvailableMoviesForPurchase();

        if (movies.length === 0) {
          await provider.sendText({
            instanceName: session.instanceName,
            to: session.phone,
            text: 'No momento não temos filmes com ingressos online disponíveis no Cine Cruzeiro. Digite *MENU* para retornar.',
          });
          return;
        }

        session.context.availableMovies = movies.map((m) => ({
          id: m.id,
          slug: m.slug,
          title: m.title,
          duration: m.duration || '100 min',
          genres: Array.isArray(m.genres) ? m.genres.join(', ') : m.genres || 'Cinema',
        }));

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: 'Compra de Ingressos',
          description: 'Escolha o filme que você deseja assistir no Cine Cruzeiro:',
          buttonText: 'Escolher Filme',
          sections: [
            {
              title: 'Filmes com Ingressos Disponíveis',
              rows: session.context.availableMovies.map((m: any) => ({
                id: `MOVIE_${m.id}`,
                title: m.title,
                description: `${m.duration} | ${m.genres}`,
              })),
            },
            {
              title: 'Navegação',
              rows: [{ id: 'BACK_TO_MENU', title: 'Voltar ao Menu Principal' }],
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
        const global = IntentNormalizer.matchGlobalIntent(raw, message.selectionId);

        if (global === StandardIntent.BACK || global === StandardIntent.MAIN_MENU || global === StandardIntent.CANCEL) {
          this.cartService.clearCart(session.context);
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        // If movie is already set from prior flow, proceed
        if (session.context.selectedMovieId) {
          return {
            nextFlow: 'BUY_TICKET',
            nextState: 'SELECT_DATE',
            handled: true,
            resetFallbackCount: true,
          };
        }

        const movies = await this.catalogService.getAvailableMoviesForPurchase();
        let selectedMovie: any = null;

        if (raw.startsWith('MOVIE_')) {
          const id = raw.replace('MOVIE_', '');
          selectedMovie = movies.find((m) => m.id === id || m.slug === id);
        } else {
          const idx = IntentNormalizer.parseIndex(raw, movies.length);
          if (idx !== null && idx >= 1 && idx <= movies.length) {
            selectedMovie = movies[idx - 1];
          } else {
            const cleaned = IntentNormalizer.clean(raw);
            selectedMovie = movies.find((m) => IntentNormalizer.clean(m.title).includes(cleaned));
          }
        }

        if (!selectedMovie) {
          return { handled: false };
        }

        return {
          nextFlow: 'BUY_TICKET',
          nextState: 'SELECT_DATE',
          contextUpdate: {
            selectedMovieId: selectedMovie.id,
            selectedMovieTitle: selectedMovie.title,
          },
          handled: true,
          resetFallbackCount: true,
        };
      },
    });

    // -------------------------------------------------------------------------
    // State 2: SELECT_DATE
    // -------------------------------------------------------------------------
    this.states.set('SELECT_DATE', {
      name: 'SELECT_DATE',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        // If date already set (e.g. from programming flow), auto-forward
        if (session.context.selectedDate && session.context.dateLabel) {
          return;
        }

        const movieId = session.context.selectedMovieId;
        const movieTitle = session.context.selectedMovieTitle || 'Filme selecionado';

        const dates: CatalogDate[] = await this.catalogService.getAvailableDatesForPurchase(movieId);

        if (dates.length === 0) {
          await provider.sendText({
            instanceName: session.instanceName,
            to: session.phone,
            text: `Não encontramos sessões com venda aberta para *${movieTitle}* no momento.\n\nDigite *0* para escolher outro filme ou *MENU* para retornar.`,
          });
          return;
        }

        session.context.availableDates = dates;

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: `Ingressos: ${movieTitle}`,
          description: `Selecione para qual data deseja comprar ingressos:`,
          buttonText: 'Escolher Data',
          sections: [
            {
              title: 'Datas com Venda Aberta',
              rows: dates.map((d) => ({
                id: `DATE_${d.date}`,
                title: d.label,
                description: `${d.sessionCount} sessão(ões) disponível(is)`,
              })),
            },
            {
              title: 'Navegação',
              rows: [{ id: 'BACK_TO_MOVIE', title: 'Escolher Outro Filme' }],
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
        const global = IntentNormalizer.matchGlobalIntent(raw, message.selectionId);

        if (global === StandardIntent.CANCEL || global === StandardIntent.MAIN_MENU) {
          this.cartService.clearCart(session.context);
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        if (global === StandardIntent.BACK || raw === 'BACK_TO_MOVIE' || raw === '0') {
          delete session.context.selectedMovieId;
          delete session.context.selectedMovieTitle;
          delete session.context.selectedDate;
          delete session.context.dateLabel;
          return { nextFlow: 'BUY_TICKET', nextState: 'SELECT_MOVIE', handled: true, resetFallbackCount: true };
        }

        // If date already set, move forward
        if (session.context.selectedDate) {
          return {
            nextFlow: 'BUY_TICKET',
            nextState: 'SELECT_SESSION',
            handled: true,
            resetFallbackCount: true,
          };
        }

        const dates = (session.context.availableDates as CatalogDate[]) || [];
        let selectedDate: CatalogDate | null = null;

        if (raw.startsWith('DATE_')) {
          const dateStr = raw.replace('DATE_', '');
          selectedDate = dates.find((d) => d.date === dateStr) || {
            date: dateStr,
            label: dateStr,
            sessionCount: 1,
            availableSessionCount: 1,
          };
        } else {
          const idx = IntentNormalizer.parseIndex(raw, dates.length);
          if (idx !== null && idx >= 1 && idx <= dates.length) {
            selectedDate = dates[idx - 1];
          } else {
            const cleaned = IntentNormalizer.clean(raw);
            selectedDate = dates.find((d) => IntentNormalizer.clean(d.label).includes(cleaned)) || null;
          }
        }

        if (!selectedDate) {
          return { handled: false };
        }

        return {
          nextFlow: 'BUY_TICKET',
          nextState: 'SELECT_SESSION',
          contextUpdate: {
            selectedDate: selectedDate.date,
            dateLabel: selectedDate.label,
          },
          handled: true,
          resetFallbackCount: true,
        };
      },
    });

    // -------------------------------------------------------------------------
    // State 3: SELECT_SESSION
    // -------------------------------------------------------------------------
    this.states.set('SELECT_SESSION', {
      name: 'SELECT_SESSION',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        const movieId = session.context.selectedMovieId;
        const targetDate = parseDateIso(session.context.selectedDate);
        const dateLabel = session.context.dateLabel || targetDate;
        const movieTitle = session.context.selectedMovieTitle || 'Filme selecionado';

        const sessions: CatalogSession[] = await this.catalogService.getAvailableSessions(movieId, targetDate);

        if (sessions.length === 0) {
          await provider.sendText({
            instanceName: session.instanceName,
            to: session.phone,
            text: `Não encontramos sessões com ingressos online para *${movieTitle}* em *${dateLabel}*.\n\nDigite *0* para escolher outra data ou *MENU* para retornar ao início.`,
          });
          return;
        }

        session.context.availableSessions = sessions;

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: `Sessões: ${movieTitle}`,
          description: `Sessões para *${dateLabel}*. Selecione o horário desejado:`,
          buttonText: 'Escolher Horário',
          sections: [
            {
              title: `Horários para ${dateLabel}`,
              rows: sessions.map((s) => {
                const roomName = s.room?.name || 'Sala Principal';
                const minPrice = s.ticketTypes && s.ticketTypes.length > 0
                  ? Math.min(...s.ticketTypes.map((t) => Number(t.price)))
                  : 10;
                return {
                  id: `SESSION_${s.id}`,
                  title: `${s.time} — ${roomName}`,
                  description: `${s.format} | A partir de R$ ${minPrice.toFixed(2).replace('.', ',')}`,
                };
              }),
            },
            {
              title: 'Navegação',
              rows: [{ id: 'BACK_TO_DATE', title: 'Mudar Data' }],
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
        const global = IntentNormalizer.matchGlobalIntent(raw, message.selectionId);

        if (global === StandardIntent.BACK || raw === 'BACK_TO_DATE' || raw === '0') {
          delete session.context.selectedDate;
          delete session.context.dateLabel;
          return { nextFlow: 'BUY_TICKET', nextState: 'SELECT_DATE', handled: true, resetFallbackCount: true };
        }
        if (global === StandardIntent.CANCEL || global === StandardIntent.MAIN_MENU) {
          this.cartService.clearCart(session.context);
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        const sessions = (session.context.availableSessions as CatalogSession[]) || [];
        let selectedSession: CatalogSession | null = null;

        if (raw.startsWith('SESSION_')) {
          const id = raw.replace('SESSION_', '');
          selectedSession = sessions.find((s) => s.id === id) || null;
        } else {
          const idx = IntentNormalizer.parseIndex(raw, sessions.length);
          if (idx !== null && idx >= 1 && idx <= sessions.length) {
            selectedSession = sessions[idx - 1];
          } else {
            const cleaned = IntentNormalizer.clean(raw);
            selectedSession = sessions.find((s) => s.time.replace(':', '').includes(cleaned)) || null;
          }
        }

        if (!selectedSession) {
          return { handled: false };
        }

        const audioType = selectedSession.format?.toLowerCase().includes('leg') ? 'Legendado' : 'Dublado';
        const roomName = selectedSession.room?.name || 'Sala Principal';

        return {
          nextFlow: 'BUY_TICKET',
          nextState: 'SELECT_TICKET_TYPE',
          contextUpdate: {
            selectedSessionId: selectedSession.id,
            sessionTime: selectedSession.time,
            roomName,
            format: selectedSession.format,
            audioType,
            sessionTicketTypes: selectedSession.ticketTypes || [],
          },
          handled: true,
          resetFallbackCount: true,
        };
      },
    });

    // -------------------------------------------------------------------------
    // State 4: SELECT_TICKET_TYPE (Dinâmico a partir dos ticketTypes da sessão no catálogo)
    // -------------------------------------------------------------------------
    this.states.set('SELECT_TICKET_TYPE', {
      name: 'SELECT_TICKET_TYPE',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        let ticketTypes = (session.context.sessionTicketTypes as CatalogTicketType[]) || [];

        if (ticketTypes.length === 0 && session.context.selectedSessionId) {
          const fetched = await this.catalogService.getSessionById(session.context.selectedSessionId);
          if (fetched && fetched.ticketTypes && fetched.ticketTypes.length > 0) {
            ticketTypes = fetched.ticketTypes;
          }
        }

        // Default safety fallback if empty
        if (ticketTypes.length === 0) {
          ticketTypes = [
            { id: 'ingresso-inteiro', name: 'Ingresso normal', price: 10, description: 'Ingresso individual' },
            { id: 'meia', name: 'Meia Entrada', price: 5, description: 'Estudantes, idosos e jovens até 29 anos' },
          ];
        }

        session.context.availableTicketTypes = ticketTypes;

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: 'Tipo de Ingresso',
          description: `Qual tipo de ingresso você deseja?\nSessão das ${session.context.sessionTime} (${session.context.roomName}):`,
          buttonText: 'Escolher Tipo',
          sections: [
            {
              title: 'Tipos de Ingresso Disponíveis',
              rows: ticketTypes.map((t) => ({
                id: `TICKET_${t.id}`,
                title: `${t.name} — R$ ${Number(t.price).toFixed(2).replace('.', ',')}`,
                description: t.description || 'Ingresso Cine Cruzeiro',
              })),
            },
            {
              title: 'Navegação',
              rows: [{ id: 'BACK_TO_SESSION', title: 'Voltar aos Horários' }],
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
        const global = IntentNormalizer.matchGlobalIntent(raw, message.selectionId);

        if (global === StandardIntent.BACK || raw === 'BACK_TO_SESSION' || raw === '0') {
          return { nextFlow: 'BUY_TICKET', nextState: 'SELECT_SESSION', handled: true, resetFallbackCount: true };
        }
        if (global === StandardIntent.CANCEL || global === StandardIntent.MAIN_MENU) {
          this.cartService.clearCart(session.context);
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        const ticketTypes = (session.context.availableTicketTypes as CatalogTicketType[]) || [];
        let selectedType: CatalogTicketType | null = null;

        if (raw.startsWith('TICKET_')) {
          const typeId = raw.replace('TICKET_', '');
          selectedType = ticketTypes.find((t) => t.id === typeId) || null;
        } else {
          const idx = IntentNormalizer.parseIndex(raw, ticketTypes.length);
          if (idx !== null && idx >= 1 && idx <= ticketTypes.length) {
            selectedType = ticketTypes[idx - 1];
          } else {
            const cleaned = IntentNormalizer.clean(raw);
            selectedType = ticketTypes.find((t) => IntentNormalizer.clean(t.name).includes(cleaned)) || null;
          }
        }

        if (!selectedType) {
          return { handled: false };
        }

        const unitPrice = Number(selectedType.price);
        const isHalf = selectedType.id.toLowerCase().includes('meia') || selectedType.name.toLowerCase().includes('meia');
        const ticketTypeCategory = isHalf ? 'HALF' : 'FULL';

        return {
          nextFlow: 'BUY_TICKET',
          nextState: 'SELECT_QUANTITY',
          contextUpdate: {
            ticketTypeId: selectedType.id,
            ticketTypeName: selectedType.name,
            ticketType: ticketTypeCategory,
            unitPrice,
          },
          handled: true,
          resetFallbackCount: true,
        };
      },
    });

    // -------------------------------------------------------------------------
    // State 5: SELECT_QUANTITY
    // -------------------------------------------------------------------------
    this.states.set('SELECT_QUANTITY', {
      name: 'SELECT_QUANTITY',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        const ticketTypeName = session.context.ticketTypeName || 'Ingresso';
        const unitPrice = Number(session.context.unitPrice) || 10.0;

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: 'Quantidade de Ingressos',
          description: `Quantos ingressos de *${ticketTypeName}* (R$ ${unitPrice.toFixed(2).replace('.', ',')} cada) você deseja?`,
          buttonText: 'Escolher Quantidade',
          sections: [
            {
              title: 'Selecione a Quantidade',
              rows: [
                { id: 'QTY_1', title: '1 Ingresso', description: `Total: R$ ${(unitPrice * 1).toFixed(2).replace('.', ',')}` },
                { id: 'QTY_2', title: '2 Ingressos', description: `Total: R$ ${(unitPrice * 2).toFixed(2).replace('.', ',')}` },
                { id: 'QTY_3', title: '3 Ingressos', description: `Total: R$ ${(unitPrice * 3).toFixed(2).replace('.', ',')}` },
                { id: 'QTY_4', title: '4 Ingressos', description: `Total: R$ ${(unitPrice * 4).toFixed(2).replace('.', ',')}` },
                { id: 'QTY_5', title: '5 Ingressos', description: `Total: R$ ${(unitPrice * 5).toFixed(2).replace('.', ',')}` },
              ],
            },
            {
              title: 'Navegação',
              rows: [{ id: 'BACK_TO_TYPE', title: 'Voltar ao Tipo de Ingresso' }],
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
        const global = IntentNormalizer.matchGlobalIntent(raw, message.selectionId);

        if (global === StandardIntent.BACK || raw === 'BACK_TO_TYPE' || raw === '0') {
          return { nextFlow: 'BUY_TICKET', nextState: 'SELECT_TICKET_TYPE', handled: true, resetFallbackCount: true };
        }
        if (global === StandardIntent.CANCEL || global === StandardIntent.MAIN_MENU) {
          this.cartService.clearCart(session.context);
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        let qty: number | null = null;
        if (raw.startsWith('QTY_')) {
          qty = parseInt(raw.replace('QTY_', ''), 10);
        } else {
          qty = IntentNormalizer.parseIndex(raw, 10);
        }

        if (!qty || qty < 1 || qty > 10) {
          await provider.sendText({
            instanceName: session.instanceName,
            to: session.phone,
            text: 'Por favor, informe uma quantidade válida de 1 a 10 ingressos (ou digite *0* para voltar).',
          });
          return { handled: false };
        }

        // Store item into unified Cart with real catalog unit price
        this.cartService.setTicketItem(session.context, {
          movieId: session.context.selectedMovieId,
          movieTitle: session.context.selectedMovieTitle,
          sessionId: session.context.selectedSessionId,
          sessionTime: session.context.sessionTime,
          sessionDate: session.context.selectedDate,
          dateLabel: session.context.dateLabel,
          roomName: session.context.roomName,
          format: session.context.format,
          audioType: session.context.audioType,
          ticketType: session.context.ticketType,
          ticketTypeName: session.context.ticketTypeName,
          quantity: qty,
          unitPrice: Number(session.context.unitPrice) || 10.0,
        });

        return {
          nextFlow: 'BUY_TICKET',
          nextState: 'ORDER_SUMMARY',
          handled: true,
          resetFallbackCount: true,
        };
      },
    });

    // -------------------------------------------------------------------------
    // State 6: ORDER_SUMMARY
    // -------------------------------------------------------------------------
    this.states.set('ORDER_SUMMARY', {
      name: 'ORDER_SUMMARY',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        const cart = this.cartService.getCart(session.context);
        const item = cart.ticketItem;

        if (!item) {
          await provider.sendText({
            instanceName: session.instanceName,
            to: session.phone,
            text: 'Seu pedido está vazio. Vamos começar novamente pelo menu.',
          });
          return;
        }

        let summary = `*Resumo do Pedido — Cine Cruzeiro*\n\n`;
        summary += `• *Filme:* ${item.movieTitle}\n`;
        summary += `• *Data:* ${item.dateLabel || item.sessionDate}\n`;
        summary += `• *Horário:* ${item.sessionTime}\n`;
        summary += `• *Sala:* ${item.roomName} (${item.format} | ${item.audioType})\n`;
        summary += `• *Ingressos:* ${item.quantity}x ${item.ticketTypeName} (R$ ${item.unitPrice.toFixed(2).replace('.', ',')} cada)\n\n`;
        summary += `*Total: R$ ${cart.total.toFixed(2).replace('.', ',')}*\n\n`;
        summary += `Escolha uma das opções abaixo:`;

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: 'Resumo do Pedido',
          description: summary,
          buttonText: 'Confirmar / Alterar',
          sections: [
            {
              title: 'O que deseja fazer?',
              rows: [
                { id: 'CONFIRM_PAYMENT', title: 'Continuar para pagamento', description: `Finalizar compra de R$ ${cart.total.toFixed(2).replace('.', ',')}` },
                { id: 'EDIT_ORDER', title: 'Alterar pedido', description: 'Mudar quantidade ou tipo de ingresso' },
                { id: 'CANCEL_ORDER', title: 'Cancelar', description: 'Desistir da compra e voltar ao menu' },
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
        const global = IntentNormalizer.matchGlobalIntent(raw, message.selectionId);
        const cleaned = IntentNormalizer.clean(raw);

        // 1. Continuar para pagamento
        if (
          raw === 'CONFIRM_PAYMENT' ||
          cleaned === '1' ||
          cleaned.includes('pagamento') ||
          cleaned.includes('pagar') ||
          cleaned.includes('continuar') ||
          cleaned === 'sim'
        ) {
          return {
            nextFlow: 'BUY_TICKET',
            nextState: 'CHECKOUT',
            handled: true,
            resetFallbackCount: true,
          };
        }

        // 2. Alterar pedido / Voltar
        if (
          raw === 'EDIT_ORDER' ||
          cleaned === '2' ||
          cleaned.includes('alterar') ||
          cleaned.includes('editar') ||
          global === StandardIntent.BACK ||
          raw === '0'
        ) {
          return {
            nextFlow: 'BUY_TICKET',
            nextState: 'SELECT_TICKET_TYPE',
            handled: true,
            resetFallbackCount: true,
          };
        }

        // 3. Cancelar
        if (
          raw === 'CANCEL_ORDER' ||
          cleaned === '3' ||
          cleaned.includes('cancelar') ||
          global === StandardIntent.CANCEL ||
          global === StandardIntent.MAIN_MENU
        ) {
          this.cartService.clearCart(session.context);
          await provider.sendText({
            instanceName: session.instanceName,
            to: session.phone,
            text: 'Compra cancelada. Se precisar de algo mais, é só chamar.',
          });
          return {
            nextFlow: 'MAIN_MENU',
            nextState: 'SHOW_MENU',
            handled: true,
            resetFallbackCount: true,
          };
        }

        return { handled: false };
      },
    });

    // -------------------------------------------------------------------------
    // State 7: CHECKOUT
    // -------------------------------------------------------------------------
    this.states.set('CHECKOUT', {
      name: 'CHECKOUT',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        const cart = this.cartService.getCart(session.context);

        try {
          const { checkoutUrl } = await this.orderService.createOrderFromCart({
            companyId: session.companyId,
            contactId: session.contactId,
            conversationId: session.conversationId,
            cart,
          });

          // Clear cart now that order is created
          this.cartService.clearCart(session.context);

          await provider.sendButtons({
            instanceName: session.instanceName,
            to: session.phone,
            title: 'Compra pronta 🎬',
            description: 'Seu pedido foi preparado. Toque em *Comprar agora* para escolher as poltronas e concluir o pagamento com segurança.',
            footer: 'Você poderá revisar ingressos, bomboniere e descontos antes de confirmar.',
            buttons: [
              { id: 'OPEN_CHECKOUT', displayText: 'Comprar agora', url: checkoutUrl },
            ],
          });
        } catch (error: any) {
          await provider.sendText({
            instanceName: session.instanceName,
            to: session.phone,
            text: `Não foi possível gerar seu checkout: ${error.message || 'Erro inesperado'}.\n\nDigite *MENU* para tentar novamente.`,
          });
        }
      },
      onMessage: async (
        session: FlowSession,
        message: IncomingWhatsAppMessage,
        provider: WhatsAppProvider
      ): Promise<FlowActionResult> => {
        return {
          nextFlow: 'MAIN_MENU',
          nextState: 'SHOW_MENU',
          handled: true,
          resetFallbackCount: true,
        };
      },
    });
  }
}
