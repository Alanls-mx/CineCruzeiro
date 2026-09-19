import { env } from '../../../config/env.js';

export interface CatalogTicketType {
  id: string;
  name: string;
  price: number;
  description?: string;
}

export interface CatalogRoom {
  id: string;
  name: string;
  technology?: string;
  label?: string;
}

export interface CatalogSession {
  id: string;
  movieId: string;
  movieSlug: string;
  movieTitle: string;
  date: string; // 'YYYY-MM-DD'
  dateLabel?: string;
  time: string; // 'HH:MM'
  startsAt: string; // ISO
  salesOpenAt?: string;
  availableForPurchase: boolean;
  salesStatus?: string;
  room: CatalogRoom;
  format: string; // e.g. '2D Dublado'
  ticketTypes: CatalogTicketType[];
}

export interface CatalogMovie {
  id: string;
  slug: string;
  title: string;
  synopsis?: string;
  status?: string;
  tag?: string;
  releaseDate?: string;
  duration?: string; // e.g. '1h 43m'
  genres?: string[];
  rating?: string; // e.g. '10', 'L', '12', '14', '16', '18'
  featured?: boolean;
  posterUrl?: string;
  backdropUrl?: string;
  availableSessions?: CatalogSession[];
}

export interface CatalogDate {
  date: string; // 'YYYY-MM-DD'
  label: string;
  sessionCount: number;
  availableSessionCount: number;
}

export interface CatalogConcession {
  id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  category?: string;
}

export interface CatalogPromotion {
  id: string;
  title: string;
  description?: string;
  discount?: number;
}

export interface CatalogCoupon {
  code: string;
  description?: string;
  validUntil?: string;
}

export interface CommercialCatalogData {
  version?: string;
  generatedAt?: string;
  timezone?: string;
  catalog?: {
    name: string;
    programmingUrl?: string;
  };
  movies: CatalogMovie[];
  availableSessions: CatalogSession[];
  programming: CatalogSession[];
  concessions: CatalogConcession[];
  promotions: CatalogPromotion[];
  coupons: CatalogCoupon[];
  dates: CatalogDate[];
}

export class CommercialCatalogService {
  private static instance: CommercialCatalogService;
  private cachedData: CommercialCatalogData | null = null;
  private lastFetchedAt = 0;
  private fetchPromise: Promise<CommercialCatalogData> | null = null;

  public static getInstance(): CommercialCatalogService {
    if (!CommercialCatalogService.instance) {
      CommercialCatalogService.instance = new CommercialCatalogService();
    }
    return CommercialCatalogService.instance;
  }

  /**
   * Main method to get catalog data with in-memory caching and resilient fallback
   */
  async getCatalog(): Promise<CommercialCatalogData> {
    const now = Date.now();
    const ttlMs = (env.COMMERCIAL_CATALOG_CACHE_TTL_SECONDS || 60) * 1000;

    if (this.cachedData && now - this.lastFetchedAt < ttlMs) {
      return this.cachedData;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = this.fetchFromRemote()
      .then((data) => {
        this.cachedData = data;
        this.lastFetchedAt = Date.now();
        return data;
      })
      .catch((err) => {
        console.error('[CommercialCatalog] Failed to fetch external catalog:', err.message);
        if (this.cachedData) {
          console.warn('[CommercialCatalog] Serving stale cached catalog data.');
          return this.cachedData;
        }
        throw err;
      })
      .finally(() => {
        this.fetchPromise = null;
      });

    return this.fetchPromise;
  }

  /**
   * Performs the HTTP request to the external commercial catalog
   */
  private async fetchFromRemote(): Promise<CommercialCatalogData> {
    const url = env.COMMERCIAL_CATALOG_URL;
    const token = env.COMMERCIAL_CATALOG_TOKEN;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': 'LumixEngine-WhatsApp/2.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Catalog HTTP ${response.status}: ${response.statusText}`);
      }

      const json = (await response.json()) as CommercialCatalogData;
      return json;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ===========================================================================
  // High-Level Query Methods for WhatsApp Flow Engine
  // ===========================================================================

  /**
   * Returns list of dates that have cinema programming
   */
  async getDates(): Promise<CatalogDate[]> {
    const catalog = await this.getCatalog();
    if (catalog.dates && catalog.dates.length > 0) {
      return catalog.dates;
    }

    // Fallback: derive dates from programming
    const dateMap = new Map<string, { label: string; count: number; available: number }>();
    for (const s of catalog.programming || []) {
      const entry = dateMap.get(s.date) || { label: s.dateLabel || s.date, count: 0, available: 0 };
      entry.count++;
      if (s.availableForPurchase) entry.available++;
      dateMap.set(s.date, entry);
    }

    return Array.from(dateMap.entries()).map(([date, val]) => ({
      date,
      label: val.label,
      sessionCount: val.count,
      availableSessionCount: val.available,
    }));
  }

  /**
   * Returns all movies published in catalog
   */
  async getMovies(): Promise<CatalogMovie[]> {
    const catalog = await this.getCatalog();
    return catalog.movies || [];
  }

  /**
   * Returns movies that are currently in theaters (Em Cartaz)
   */
  async getNowPlayingMovies(): Promise<CatalogMovie[]> {
    const catalog = await this.getCatalog();
    return (catalog.movies || []).filter(
      (m) => m.status === 'now_playing' || (m.status !== 'upcoming' && m.tag !== 'Em Breve')
    );
  }

  /**
   * Returns movies that will premiere soon (Em Breve)
   */
  async getUpcomingMovies(): Promise<CatalogMovie[]> {
    const catalog = await this.getCatalog();
    return (catalog.movies || []).filter(
      (m) => m.status === 'upcoming' || m.tag === 'Em Breve'
    );
  }

  /**
   * Returns a single movie by ID or slug
   */
  async getMovieById(idOrSlug: string): Promise<CatalogMovie | null> {
    const catalog = await this.getCatalog();
    const target = idOrSlug.trim().toLowerCase();
    const movie = catalog.movies.find(
      (m) => m.id.toLowerCase() === target || m.slug.toLowerCase() === target
    );
    return movie || null;
  }

  /**
   * Returns movies that have sessions on a specific date (YYYY-MM-DD)
   */
  async getMoviesByDate(dateStr: string): Promise<{ movie: CatalogMovie; sessions: CatalogSession[] }[]> {
    const catalog = await this.getCatalog();
    const targetDate = dateStr.slice(0, 10);

    const sessionsForDate = (catalog.programming || []).filter(
      (s) => s.date.slice(0, 10) === targetDate
    );

    const movieSessionMap = new Map<string, CatalogSession[]>();
    for (const s of sessionsForDate) {
      const list = movieSessionMap.get(s.movieId) || [];
      list.push(s);
      movieSessionMap.set(s.movieId, list);
    }

    const results: { movie: CatalogMovie; sessions: CatalogSession[] }[] = [];
    for (const [movieId, sessions] of movieSessionMap.entries()) {
      const movie =
        catalog.movies.find((m) => m.id === movieId || m.slug === sessions[0]?.movieSlug) ||
        ({
          id: movieId,
          slug: sessions[0]?.movieSlug || movieId,
          title: sessions[0]?.movieTitle || 'Filme em Cartaz',
          duration: '100 min',
          genres: ['Cinema'],
          rating: 'L',
        } as CatalogMovie);

      results.push({ movie, sessions });
    }

    return results;
  }

  /**
   * Returns all sessions for a movie on a specific date
   */
  async getSessionsForMovieAndDate(
    movieIdOrSlug: string,
    dateStr: string
  ): Promise<CatalogSession[]> {
    const catalog = await this.getCatalog();
    const targetId = movieIdOrSlug.trim().toLowerCase();
    const targetDate = dateStr.slice(0, 10);

    return (catalog.programming || []).filter(
      (s) =>
        (s.movieId.toLowerCase() === targetId || s.movieSlug.toLowerCase() === targetId) &&
        s.date.slice(0, 10) === targetDate
    );
  }

  /**
   * Returns movies that have at least one session available for online ticket purchase
   */
  async getAvailableMoviesForPurchase(): Promise<CatalogMovie[]> {
    const catalog = await this.getCatalog();
    const availableMovieIds = new Set<string>();

    for (const s of catalog.availableSessions || []) {
      if (s.availableForPurchase) {
        availableMovieIds.add(s.movieId);
        availableMovieIds.add(s.movieSlug);
      }
    }

    // Also check programming sessions where availableForPurchase is true
    for (const s of catalog.programming || []) {
      if (s.availableForPurchase) {
        availableMovieIds.add(s.movieId);
        availableMovieIds.add(s.movieSlug);
      }
    }

    return catalog.movies.filter(
      (m) => availableMovieIds.has(m.id) || availableMovieIds.has(m.slug)
    );
  }

  /**
   * Returns dates with available sessions for purchase (optionally for a specific movie)
   */
  async getAvailableDatesForPurchase(movieIdOrSlug?: string): Promise<CatalogDate[]> {
    const catalog = await this.getCatalog();
    const targetId = movieIdOrSlug ? movieIdOrSlug.trim().toLowerCase() : null;

    const availableSessions = [
      ...(catalog.availableSessions || []),
      ...(catalog.programming || []).filter((s) => s.availableForPurchase),
    ];

    const dateMap = new Map<string, { label: string; count: number }>();
    for (const s of availableSessions) {
      if (!s.availableForPurchase) continue;
      if (
        targetId &&
        s.movieId.toLowerCase() !== targetId &&
        s.movieSlug.toLowerCase() !== targetId
      ) {
        continue;
      }
      const entry = dateMap.get(s.date) || { label: s.dateLabel || s.date, count: 0 };
      entry.count++;
      dateMap.set(s.date, entry);
    }

    return Array.from(dateMap.entries()).map(([date, val]) => ({
      date,
      label: val.label,
      sessionCount: val.count,
      availableSessionCount: val.count,
    }));
  }

  /**
   * Returns sessions available for purchase (optionally filtered by movie and date)
   */
  async getAvailableSessions(
    movieIdOrSlug?: string,
    dateStr?: string
  ): Promise<CatalogSession[]> {
    const catalog = await this.getCatalog();
    const targetId = movieIdOrSlug ? movieIdOrSlug.trim().toLowerCase() : null;
    const targetDate = dateStr ? dateStr.slice(0, 10) : null;

    // Combine availableSessions and programming where availableForPurchase === true
    const sessionMap = new Map<string, CatalogSession>();
    for (const s of catalog.availableSessions || []) {
      sessionMap.set(s.id, s);
    }
    for (const s of catalog.programming || []) {
      if (s.availableForPurchase && !sessionMap.has(s.id)) {
        sessionMap.set(s.id, s);
      }
    }

    let sessions = Array.from(sessionMap.values());

    if (targetId) {
      sessions = sessions.filter(
        (s) => s.movieId.toLowerCase() === targetId || s.movieSlug.toLowerCase() === targetId
      );
    }

    if (targetDate) {
      sessions = sessions.filter((s) => s.date.slice(0, 10) === targetDate);
    }

    return sessions.sort((a, b) => a.time.localeCompare(b.time));
  }

  /**
   * Returns a session by ID with full ticket types and room data
   */
  async getSessionById(sessionId: string): Promise<CatalogSession | null> {
    const catalog = await this.getCatalog();
    const found =
      catalog.availableSessions?.find((s) => s.id === sessionId) ||
      catalog.programming?.find((s) => s.id === sessionId);

    return found || null;
  }

  /** Returns concessions from the Cine Cruzeiro catalog. */
  async getConcessions(): Promise<CatalogConcession[]> {
    const catalog = await this.getCatalog();
    return catalog.concessions || [];
  }
}
