import { Flow, FlowActionResult, FlowSession, FlowState } from '../flow-engine.types.js';
import { WhatsAppProvider } from '../../providers/whatsapp-provider.interface.js';
import { IncomingWhatsAppMessage } from '../../webhooks/webhooks.types.js';
import { CommercialCatalogService, CatalogDate, CatalogMovie, CatalogSession } from '../../../cinema/services/commercial-catalog.service.js';
import { IntentNormalizer, StandardIntent } from '../intent-normalizer.js';

function formatDefaultDateLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

function parseDateIso(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  if (dateStr.length === 10 && dateStr.includes('-')) return dateStr;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

export class ProgrammingFlow implements Flow {
  public readonly id = 'PROGRAMMING';
  public readonly initialState = 'SELECT_DATE';
  public readonly states = new Map<string, FlowState>();

  constructor(
    private readonly catalogService = CommercialCatalogService.getInstance()
  ) {
    // -------------------------------------------------------------------------
    // State 1: SELECT_DATE
    // -------------------------------------------------------------------------
    this.states.set('SELECT_DATE', {
      name: 'SELECT_DATE',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        const dates: CatalogDate[] = await this.catalogService.getDates();
        const now = new Date();
        const todayIso = now.toISOString().slice(0, 10);
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const tomorrowIso = tomorrow.toISOString().slice(0, 10);

        const todayCatalog = dates.find((d) => d.date === todayIso);
        const tomorrowCatalog = dates.find((d) => d.date === tomorrowIso);

        const todayDesc = todayCatalog
          ? `Ver filmes em cartaz hoje (${todayCatalog.sessionCount} sessões)`
          : 'Ver filmes em cartaz hoje';
        const tomorrowDesc = tomorrowCatalog
          ? `Ver filmes para amanhã (${tomorrowCatalog.sessionCount} sessões)`
          : 'Ver filmes para amanhã';

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: 'Programação de Filmes',
          description: 'Para qual dia você deseja consultar os filmes e horários do Cine Cruzeiro?',
          buttonText: 'Escolher Dia',
          sections: [
            {
              title: 'Datas Disponíveis',
              rows: [
                { id: 'DATE_TODAY', title: 'Hoje', description: todayDesc },
                { id: 'DATE_TOMORROW', title: 'Amanhã', description: tomorrowDesc },
                { id: 'DATE_OTHER', title: 'Outra data', description: 'Consultar os próximos dias com sessões' },
                { id: 'MOVIES_UPCOMING', title: 'Filmes Em Breve', description: 'Próximos lançamentos do cinema' },
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
        const raw = (message.selectionId || message.text || '').trim();
        const global = IntentNormalizer.matchGlobalIntent(raw, message.selectionId);

        if (global === StandardIntent.BACK || global === StandardIntent.MAIN_MENU || global === StandardIntent.CANCEL) {
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        const cleaned = IntentNormalizer.clean(raw);
        const now = new Date();
        const dates: CatalogDate[] = await this.catalogService.getDates();

        // 1. Hoje
        if (raw === 'DATE_TODAY' || cleaned === '1' || cleaned.includes('hoje')) {
          const todayIso = now.toISOString().slice(0, 10);
          const match = dates.find((d) => d.date === todayIso);
          const label = match ? match.label : 'Hoje';
          return {
            nextFlow: 'PROGRAMMING',
            nextState: 'SELECT_MOVIE',
            contextUpdate: { targetDate: todayIso, dateLabel: label },
            handled: true,
            resetFallbackCount: true,
          };
        }

        // 2. Amanhã
        if (raw === 'DATE_TOMORROW' || cleaned === '2' || cleaned.includes('amanha')) {
          const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          const tomorrowIso = tomorrow.toISOString().slice(0, 10);
          const match = dates.find((d) => d.date === tomorrowIso);
          const label = match ? match.label : 'Amanhã';
          return {
            nextFlow: 'PROGRAMMING',
            nextState: 'SELECT_MOVIE',
            contextUpdate: { targetDate: tomorrowIso, dateLabel: label },
            handled: true,
            resetFallbackCount: true,
          };
        }

        // 3. Outra Data
        if (raw === 'DATE_OTHER' || cleaned === '3' || cleaned.includes('outra') || cleaned.includes('outro')) {
          return {
            nextFlow: 'PROGRAMMING',
            nextState: 'SELECT_OTHER_DATE',
            handled: true,
            resetFallbackCount: true,
          };
        }

        // 4. Filmes Em Breve
        if (raw === 'MOVIES_UPCOMING' || cleaned === '4' || cleaned.includes('breve') || cleaned.includes('lancamento')) {
          return {
            nextFlow: 'PROGRAMMING',
            nextState: 'SHOW_UPCOMING_MOVIES',
            handled: true,
            resetFallbackCount: true,
          };
        }

        return { handled: false };
      },
    });

    // -------------------------------------------------------------------------
    // State 1.2: SHOW_UPCOMING_MOVIES (Filmes que vão estrear em breve)
    // -------------------------------------------------------------------------
    this.states.set('SHOW_UPCOMING_MOVIES', {
      name: 'SHOW_UPCOMING_MOVIES',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        const upcoming = await this.catalogService.getUpcomingMovies();

        if (upcoming.length === 0) {
          await provider.sendText({
            instanceName: session.instanceName,
            to: session.phone,
            text: 'No momento todos os filmes cadastrados já estão em cartaz no Cine Cruzeiro.\n\nDigite *1* para ver a programação ou *MENU* para retornar.',
          });
          return;
        }

        session.context.upcomingMovies = upcoming.map((m) => ({
          id: m.id,
          slug: m.slug,
          title: m.title,
          releaseDate: m.releaseDate,
          duration: m.duration,
          genres: Array.isArray(m.genres) ? m.genres.join(', ') : m.genres,
        }));

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: 'Filmes Em Breve',
          description: 'Confira os próximos lançamentos confirmados no Cine Cruzeiro:\nEscolha um título para ver a sinopse completa:',
          buttonText: 'Ver Lançamentos',
          sections: [
            {
              title: 'Próximas Estreias',
              rows: upcoming.map((m) => {
                const releaseText = m.releaseDate
                  ? `Estreia em ${new Date(m.releaseDate + 'T12:00:00Z').toLocaleDateString('pt-BR')}`
                  : 'Em breve nos cinemas';
                return {
                  id: `UPCOMING_${m.id}`,
                  title: m.title,
                  description: `${releaseText} • ${Array.isArray(m.genres) ? m.genres.join(', ') : m.genres || 'Cinema'}`,
                };
              }),
            },
            {
              title: 'Navegação',
              rows: [
                { id: 'SHOW_NOW_PLAYING', title: 'Ver Filmes em Cartaz' },
                { id: 'BACK_TO_MENU', title: 'Menu Principal' },
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

        if (global === StandardIntent.MAIN_MENU || global === StandardIntent.CANCEL || raw === 'BACK_TO_MENU') {
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        if (global === StandardIntent.BACK || raw === 'SHOW_NOW_PLAYING' || raw === '0') {
          return { nextFlow: 'PROGRAMMING', nextState: 'SELECT_DATE', handled: true, resetFallbackCount: true };
        }

        const upcoming = await this.catalogService.getUpcomingMovies();
        let selectedMovie: CatalogMovie | null = null;

        if (raw.startsWith('UPCOMING_')) {
          const id = raw.replace('UPCOMING_', '');
          selectedMovie = upcoming.find((m) => m.id === id || m.slug === id) || null;
        } else {
          const idx = IntentNormalizer.parseIndex(raw, upcoming.length);
          if (idx !== null && idx >= 1 && idx <= upcoming.length) {
            selectedMovie = upcoming[idx - 1];
          } else {
            const cleaned = IntentNormalizer.clean(raw);
            selectedMovie = upcoming.find((m) => IntentNormalizer.clean(m.title).includes(cleaned)) || null;
          }
        }

        if (!selectedMovie) {
          return { handled: false };
        }

        return {
          nextFlow: 'PROGRAMMING',
          nextState: 'SHOW_UPCOMING_DETAIL',
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
    // State 1.3: SHOW_UPCOMING_DETAIL (Ficha técnica de filme em breve)
    // -------------------------------------------------------------------------
    this.states.set('SHOW_UPCOMING_DETAIL', {
      name: 'SHOW_UPCOMING_DETAIL',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        const movieId = session.context.selectedMovieId;
        const movie = await this.catalogService.getMovieById(movieId);

        if (!movie) {
          await provider.sendText({
            instanceName: session.instanceName,
            to: session.phone,
            text: 'Filme não encontrado. Digite *0* para voltar aos lançamentos.',
          });
          return;
        }

        const ratingLabel = !movie.rating || movie.rating === 'L' ? 'Livre' : `${movie.rating} anos`;
        const genreStr = Array.isArray(movie.genres) ? movie.genres.join(', ') : movie.genres || 'Cinema';
        const releaseText = movie.releaseDate
          ? new Date(movie.releaseDate + 'T12:00:00Z').toLocaleDateString('pt-BR')
          : 'Em breve';

        let text = `*${movie.title.toUpperCase()}* (Em Breve)\n\n`;
        text += `• *Previsão de Estreia:* ${releaseText}\n`;
        text += `• *Duração:* ${movie.duration || 'A confirmar'}\n`;
        text += `• *Classificação:* ${ratingLabel}\n`;
        text += `• *Gênero:* ${genreStr}\n\n`;

        if (movie.synopsis) {
          text += `_${movie.synopsis.slice(0, 220)}${movie.synopsis.length > 220 ? '...' : ''}_\n\n`;
        }

        text += `Assim que as sessões e a pré-venda forem abertas para este filme, os ingressos estarão disponíveis por aqui.`;

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: movie.title,
          description: text,
          buttonText: 'Opções',
          sections: [
            {
              title: 'Ações',
              rows: [
                { id: 'ANOTHER_UPCOMING', title: 'Ver Outros Lançamentos', description: 'Voltar para a lista de filmes em breve' },
                { id: 'NOW_PLAYING', title: 'Ver Filmes em Cartaz', description: 'Consultar filmes e sessões ativas' },
                { id: 'MAIN_MENU', title: 'Menu Principal' },
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

        if (global === StandardIntent.MAIN_MENU || global === StandardIntent.CANCEL || raw === 'MAIN_MENU') {
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        if (global === StandardIntent.BACK || raw === 'ANOTHER_UPCOMING' || raw === '1' || raw === '0') {
          return { nextFlow: 'PROGRAMMING', nextState: 'SHOW_UPCOMING_MOVIES', handled: true, resetFallbackCount: true };
        }

        if (raw === 'NOW_PLAYING' || raw === '2' || raw.includes('cartaz')) {
          return { nextFlow: 'PROGRAMMING', nextState: 'SELECT_DATE', handled: true, resetFallbackCount: true };
        }

        return { handled: false };
      },
    });

    // -------------------------------------------------------------------------
    // State 1.1: SELECT_OTHER_DATE
    // -------------------------------------------------------------------------
    this.states.set('SELECT_OTHER_DATE', {
      name: 'SELECT_OTHER_DATE',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        const dates = await this.catalogService.getDates();
        // Skip today and tomorrow if they are the first two, show up to 7 subsequent dates
        const upcomingDates = dates.slice(2, 9);

        const rows: { id: string; title: string; description: string }[] = upcomingDates.map((d) => ({
          id: `DATE_${d.date}`,
          title: d.label,
          description: `${d.sessionCount} sessão(ões) programada(s)`,
        }));

        rows.push({ id: 'BACK', title: '◀ Voltar', description: 'Voltar para seleção de hoje/amanhã' });

        session.context.upcomingDates = upcomingDates.map((d) => ({ date: d.date, label: d.label }));

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: 'Outras Datas',
          description: 'Escolha uma das datas com programação confirmada:',
          buttonText: 'Escolher Data',
          sections: [{ title: 'Próximos Dias no Cine Cruzeiro', rows }],
        });
      },
      onMessage: async (
        session: FlowSession,
        message: IncomingWhatsAppMessage,
        provider: WhatsAppProvider
      ): Promise<FlowActionResult> => {
        const raw = (message.selectionId || message.text || '').trim();
        const global = IntentNormalizer.matchGlobalIntent(raw, message.selectionId);

        if (global === StandardIntent.BACK) {
          return { nextFlow: 'PROGRAMMING', nextState: 'SELECT_DATE', handled: true, resetFallbackCount: true };
        }
        if (global === StandardIntent.MAIN_MENU || global === StandardIntent.CANCEL) {
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        const upcomingDates = (session.context.upcomingDates as { date: string; label: string }[]) || [];
        let selectedDate: { date: string; label: string } | null = null;

        if (raw.startsWith('DATE_')) {
          const dateStr = raw.replace('DATE_', '');
          selectedDate = upcomingDates.find((d) => d.date === dateStr) || {
            date: dateStr,
            label: dateStr,
          };
        } else {
          const idx = IntentNormalizer.parseIndex(raw, upcomingDates.length);
          if (idx !== null && idx >= 1 && idx <= upcomingDates.length) {
            selectedDate = upcomingDates[idx - 1];
          }
        }

        if (!selectedDate) {
          return { handled: false };
        }

        return {
          nextFlow: 'PROGRAMMING',
          nextState: 'SELECT_MOVIE',
          contextUpdate: {
            targetDate: selectedDate.date,
            dateLabel: selectedDate.label,
          },
          handled: true,
          resetFallbackCount: true,
        };
      },
    });

    // -------------------------------------------------------------------------
    // State 2: SELECT_MOVIE (Filmes do dia selecionado consultados na API externa)
    // -------------------------------------------------------------------------
    this.states.set('SELECT_MOVIE', {
      name: 'SELECT_MOVIE',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        const targetDate = parseDateIso(session.context.targetDate);
        const dateLabel = session.context.dateLabel || targetDate;

        const moviesWithSessions = await this.catalogService.getMoviesByDate(targetDate);

        if (moviesWithSessions.length === 0) {
          await provider.sendText({
            instanceName: session.instanceName,
            to: session.phone,
            text: `Não encontramos sessões cadastradas para *${dateLabel}* no Cine Cruzeiro.\n\nDigite *0* para escolher outra data ou *MENU* para retornar ao início.`,
          });
          return;
        }

        // Cache movies in session context for selection
        const availableMovies = moviesWithSessions.map((item) => {
          const genreStr = Array.isArray(item.movie.genres)
            ? item.movie.genres.join(', ')
            : item.movie.genres || 'Cinema';
          return {
            id: item.movie.id,
            slug: item.movie.slug,
            title: item.movie.title,
            genre: genreStr,
            duration: item.movie.duration || '100 min',
            sessionsCount: item.sessions.length,
          };
        });
        session.context.availableMovies = availableMovies;

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: `Filmes em Cartaz (${dateLabel})`,
          description: `Selecione um filme para ver horários, salas e ficha técnica:`,
          buttonText: 'Ver Filmes',
          sections: [
            {
              title: `Filmes para ${dateLabel}`,
              rows: availableMovies.map((m) => ({
                id: `MOVIE_${m.id}`,
                title: m.title,
                description: `${m.duration} | ${m.genre} (${m.sessionsCount} sessões)`,
              })),
            },
            {
              title: 'Navegação',
              rows: [{ id: 'BACK_TO_DATE', title: 'Escolher Outra Data' }],
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
          return { nextFlow: 'PROGRAMMING', nextState: 'SELECT_DATE', handled: true, resetFallbackCount: true };
        }
        if (global === StandardIntent.MAIN_MENU || global === StandardIntent.CANCEL) {
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        const targetDate = parseDateIso(session.context.targetDate);
        const moviesWithSessions = await this.catalogService.getMoviesByDate(targetDate);
        const availableMovies = moviesWithSessions.map((item) => ({
          id: item.movie.id,
          slug: item.movie.slug,
          title: item.movie.title,
        }));
        let selectedMovie: any = null;

        if (raw.startsWith('MOVIE_')) {
          const id = raw.replace('MOVIE_', '');
          selectedMovie = availableMovies.find((m) => m.id === id || m.slug === id);
        } else {
          // Check by numeric index (1, 2, 3...)
          const idx = IntentNormalizer.parseIndex(raw, availableMovies.length);
          if (idx !== null && idx >= 1 && idx <= availableMovies.length) {
            selectedMovie = availableMovies[idx - 1];
          } else {
            // Check by movie title match
            const cleaned = IntentNormalizer.clean(raw);
            selectedMovie = availableMovies.find((m) => IntentNormalizer.clean(m.title).includes(cleaned));
          }
        }

        if (!selectedMovie) {
          return { handled: false };
        }

        return {
          nextFlow: 'PROGRAMMING',
          nextState: 'SHOW_MOVIE_SESSIONS',
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
    // State 3: SHOW_MOVIE_SESSIONS (Ficha técnica + sessões reais do filme selecionado)
    // -------------------------------------------------------------------------
    this.states.set('SHOW_MOVIE_SESSIONS', {
      name: 'SHOW_MOVIE_SESSIONS',
      onEnter: async (session: FlowSession, provider: WhatsAppProvider) => {
        const movieId = session.context.selectedMovieId;
        const targetDate = parseDateIso(session.context.targetDate);
        const dateLabel = session.context.dateLabel || targetDate;

        const movie = await this.catalogService.getMovieById(movieId);
        const sessions = await this.catalogService.getSessionsForMovieAndDate(movieId, targetDate);

        if (!movie || sessions.length === 0) {
          await provider.sendText({
            instanceName: session.instanceName,
            to: session.phone,
            text: `Não encontramos sessões ativas para este filme na data selecionada.\n\nDigite *0* para escolher outro filme.`,
          });
          return;
        }

        const ratingLabel = !movie.rating || movie.rating === 'L' ? 'Livre' : `${movie.rating} anos`;
        const genreStr = Array.isArray(movie.genres) ? movie.genres.join(', ') : movie.genres || 'Cinema';

        let detailText = `*${movie.title.toUpperCase()}*\n\n`;
        detailText += `• *Duração:* ${movie.duration || '100 min'}\n`;
        detailText += `• *Classificação:* ${ratingLabel}\n`;
        detailText += `• *Gênero:* ${genreStr}\n\n`;

        if (movie.synopsis) {
          const cleanSynopsis = movie.synopsis.slice(0, 180);
          detailText += `_${cleanSynopsis}${movie.synopsis.length > 180 ? '...' : ''}_\n\n`;
        }

        detailText += `*Sessões para ${dateLabel}:*\n\n`;

        for (const s of sessions) {
          const roomName = s.room?.name || 'Sala Principal';
          const ticketsFormatted = s.ticketTypes && s.ticketTypes.length > 0
            ? s.ticketTypes.map((t) => `${t.name}: R$ ${Number(t.price).toFixed(2).replace('.', ',')}`).join(' | ')
            : 'Preço sob consulta';

          detailText += `• *${s.time}* — ${roomName}\n`;
          detailText += `  ${s.format} | ${ticketsFormatted}\n\n`;
        }

        detailText += `Escolha uma das ações abaixo:`;

        await provider.sendList({
          instanceName: session.instanceName,
          to: session.phone,
          title: movie.title,
          description: detailText,
          buttonText: 'Ações',
          sections: [
            {
              title: 'O que você deseja fazer?',
              rows: [
                { id: 'BUY_TICKET', title: 'Comprar Ingressos', description: `Garantir assento para ${movie.title}` },
                { id: 'OTHER_MOVIES', title: 'Ver Outros Filmes', description: `Ver outros filmes para ${dateLabel}` },
                { id: 'BACK_TO_DATE', title: 'Mudar Data', description: 'Escolher outro dia da programação' },
                { id: 'MAIN_MENU', title: 'Menu Principal' },
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

        if (global === StandardIntent.MAIN_MENU || global === StandardIntent.CANCEL) {
          return { nextFlow: 'MAIN_MENU', nextState: 'SHOW_MENU', handled: true, resetFallbackCount: true };
        }

        const cleaned = IntentNormalizer.clean(raw);

        // 1. Comprar Ingressos
        if (
          raw === 'BUY_TICKET' ||
          cleaned === '1' ||
          cleaned.includes('ingresso') ||
          cleaned.includes('comprar') ||
          cleaned.includes('ticket')
        ) {
          return {
            nextFlow: 'BUY_TICKET',
            nextState: 'SELECT_SESSION',
            contextUpdate: {
              selectedMovieId: session.context.selectedMovieId,
              selectedMovieTitle: session.context.selectedMovieTitle,
              selectedDate: session.context.targetDate,
              dateLabel: session.context.dateLabel,
            },
            handled: true,
            resetFallbackCount: true,
          };
        }

        // 2. Outros Filmes da mesma data
        if (raw === 'OTHER_MOVIES' || cleaned === '2' || cleaned.includes('outro') || cleaned.includes('filmes')) {
          return {
            nextFlow: 'PROGRAMMING',
            nextState: 'SELECT_MOVIE',
            handled: true,
            resetFallbackCount: true,
          };
        }

        // 3. Mudar Data / Voltar
        if (
          raw === 'BACK_TO_DATE' ||
          cleaned === '3' ||
          cleaned === '0' ||
          cleaned.includes('data') ||
          global === StandardIntent.BACK
        ) {
          return {
            nextFlow: 'PROGRAMMING',
            nextState: 'SELECT_DATE',
            handled: true,
            resetFallbackCount: true,
          };
        }

        return { handled: false };
      },
    });
  }
}
