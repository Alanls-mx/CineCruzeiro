import React, { useState, useEffect, useMemo } from 'react';
import type { Company } from '../types/index.js';
import { api } from '../services/api.js';
import {
  Film,
  Clock,
  Popcorn,
  Calendar,
  Layers,
  CupSoda,
  Candy,
  CheckCircle2,
  Hourglass,
  Tag,
} from 'lucide-react';
import { SegmentedControl } from './ui/SegmentedControl.js';

interface CinemaPreviewProps {
  company: Company;
}

const RATING_COLORS: Record<string, { bg: string; text: string }> = {
  L: { bg: '#00a651', text: '#ffffff' },
  '10': { bg: '#00a7e1', text: '#ffffff' },
  '12': { bg: '#f5c400', text: '#111827' },
  '14': { bg: '#f58220', text: '#111827' },
  '16': { bg: '#e31b23', text: '#ffffff' },
  '18': { bg: '#111111', text: '#ffffff' },
};

const MOVIE_TAG_STYLES: Record<string, { bg: string; color: string }> = {
  'pre-estreia': { bg: '#22d3ee', color: '#083344' },
  estreia: { bg: '#facc15', color: '#0f172a' },
  'ultimos dias': { bg: '#f43f5e', color: '#ffffff' },
  'destaque da semana': { bg: '#2563eb', color: '#ffffff' },
  'em breve': { bg: '#38bdf8', color: '#082f49' },
  'sessao familia': { bg: '#34d399', color: '#052e16' },
  'sessao especial': { bg: '#e879f9', color: '#4a044e' },
  classico: { bg: '#fcd34d', color: '#451a03' },
  reexibicao: { bg: '#5eead4', color: '#042f2e' },
  'em cartaz': { bg: '#86efac', color: '#052e16' },
  oculto: { bg: '#cbd5e1', color: '#0f172a' },
};

function normalizeMovieTag(tag?: string): string {
  return String(tag || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function moviePresentationState(movie: any) {
  const tag = String(movie?.tag || '').trim();
  const normalizedTag = normalizeMovieTag(tag);
  if (tag && normalizedTag !== 'normal') {
    return { label: tag, style: MOVIE_TAG_STYLES[normalizedTag] || MOVIE_TAG_STYLES['em cartaz'] };
  }
  if (String(movie?.status || '').toLowerCase() === 'hidden') return { label: 'Oculto', style: MOVIE_TAG_STYLES.oculto };
  if (String(movie?.status || '').toLowerCase() === 'now_playing') return { label: 'Em cartaz', style: MOVIE_TAG_STYLES['em cartaz'] };
  return { label: 'Em breve', style: MOVIE_TAG_STYLES['em breve'] };
}

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string; bg: string; border: string }
> = {
  COMBO: {
    label: 'Combo',
    icon: Tag,
    color: '#BF5AF2',
    bg: 'rgba(191, 90, 242, 0.15)',
    border: 'rgba(191, 90, 242, 0.35)',
  },
  POPCORN: {
    label: 'Pipoca',
    icon: Popcorn,
    color: '#FF9F0A',
    bg: 'rgba(255, 159, 10, 0.15)',
    border: 'rgba(255, 159, 10, 0.35)',
  },
  BEVERAGE: {
    label: 'Bebida',
    icon: CupSoda,
    color: '#0A84FF',
    bg: 'rgba(10, 132, 255, 0.15)',
    border: 'rgba(10, 132, 255, 0.35)',
  },
  CANDY: {
    label: 'Doces & Balas',
    icon: Candy,
    color: '#FF375F',
    bg: 'rgba(255, 55, 95, 0.15)',
    border: 'rgba(255, 55, 95, 0.35)',
  },
  SNACK: {
    label: 'Snack',
    icon: Tag,
    color: '#64D2FF',
    bg: 'rgba(100, 210, 255, 0.15)',
    border: 'rgba(100, 210, 255, 0.35)',
  },
};

function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 10 ? `${dateStr}T12:00:00Z` : dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR');
}

function formatBRL(val: number | string): string {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const CinemaPreview: React.FC<CinemaPreviewProps> = ({ company }) => {
  const [activeSection, setActiveSection] = useState<'movies' | 'sessions' | 'products'>('movies');
  const [movies, setMovies] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sub-filters for classification
  const [movieFilter, setMovieFilter] = useState<'all' | 'now_playing' | 'upcoming'>('all');
  const [productCategory, setProductCategory] = useState<'all' | 'COMBO' | 'POPCORN' | 'BEVERAGE' | 'CANDY'>('all');

  useEffect(() => {
    async function loadCinemaData() {
      try {
        setLoading(true);
        const [moviesData, sessionsData, productsData] = await Promise.all([
          api.getMovies(company.id),
          api.getSessions(company.id),
          api.getProducts(company.id),
        ]);
        setMovies(moviesData || []);
        setSessions(sessionsData || []);
        setProducts(productsData || []);
      } catch (err) {
        console.error('Failed to load real cinema data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCinemaData();
  }, [company.id]);

  // Movies classification
  const nowPlayingMovies = useMemo(
    () => movies.filter((m) => String(m.status || '').toLowerCase() === 'now_playing'),
    [movies]
  );
  const upcomingMovies = useMemo(
    () => movies.filter((m) => String(m.status || '').toLowerCase() === 'upcoming' || normalizeMovieTag(m.tag) === 'em breve'),
    [movies]
  );
  const filteredMovies = useMemo(() => {
    if (movieFilter === 'now_playing') return nowPlayingMovies;
    if (movieFilter === 'upcoming') return upcomingMovies;
    return movies;
  }, [movieFilter, movies, nowPlayingMovies, upcomingMovies]);

  // Products classification
  const filteredProducts = useMemo(() => {
    if (productCategory === 'all') return products;
    return products.filter((p) => (p.category || '').toUpperCase() === productCategory);
  }, [productCategory, products]);

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-primary)',
        padding: '32px 40px',
      }}
    >
      <div style={{ maxWidth: '1040px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Film size={20} color="var(--lumix-green)" />
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                {company.name || 'Cine Cruzeiro'}
              </h1>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Catálogo oficial classificado e sincronizado com o fluxo de atendimento do WhatsApp.
            </p>
          </div>

          {/* Segmented Control */}
          <div style={{ width: '340px' }}>
            <SegmentedControl
              options={[
                { key: 'movies', label: 'Filmes', count: movies.length },
                { key: 'sessions', label: 'Sessões', count: sessions.length },
                { key: 'products', label: 'Bomboniere', count: products.length },
              ]}
              value={activeSection}
              onChange={(v) => setActiveSection(v as any)}
              size="sm"
            />
          </div>
        </div>

        {/* Content View */}
        {loading ? (
          <div style={{ padding: '60px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Carregando catálogo de cinema...
          </div>
        ) : activeSection === 'movies' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Filter Pills for Movies Classification */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setMovieFilter('all')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    border: movieFilter === 'all' ? '1px solid var(--lumix-green)' : '1px solid var(--separator)',
                    backgroundColor: movieFilter === 'all' ? 'rgba(250, 204, 21, 0.14)' : 'var(--bg-tertiary)',
                    color: movieFilter === 'all' ? 'var(--lumix-green)' : 'var(--text-secondary)',
                  }}
                >
                  <Layers size={14} />
                  <span>Todos ({movies.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovieFilter('now_playing')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    border: movieFilter === 'now_playing' ? '1px solid #34d399' : '1px solid var(--separator)',
                    backgroundColor: movieFilter === 'now_playing' ? 'rgba(52, 211, 153, 0.16)' : 'var(--bg-tertiary)',
                    color: movieFilter === 'now_playing' ? '#86efac' : 'var(--text-secondary)',
                  }}
                >
                  <CheckCircle2 size={14} color="#86efac" />
                  <span>Em Cartaz ({nowPlayingMovies.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovieFilter('upcoming')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    border: movieFilter === 'upcoming' ? '1px solid #38bdf8' : '1px solid var(--separator)',
                    backgroundColor: movieFilter === 'upcoming' ? 'rgba(56, 189, 248, 0.16)' : 'var(--bg-tertiary)',
                    color: movieFilter === 'upcoming' ? '#38bdf8' : 'var(--text-secondary)',
                  }}
                >
                  <Hourglass size={14} color="#38bdf8" />
                  <span>Em Breve ({upcomingMovies.length})</span>
                </button>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                Exibindo {filteredMovies.length} de {movies.length} títulos
              </div>
            </div>

            {/* Movies Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '20px' }}>
              {filteredMovies.map((movie) => {
                const rating = movie.rating || 'L';
                const ratingStyle = RATING_COLORS[rating] || RATING_COLORS.L;
                const presentationState = moviePresentationState(movie);
                const isUpcoming = normalizeMovieTag(presentationState.label) === 'em breve';
                const releaseText = movie.releaseDate ? formatReleaseDate(movie.releaseDate) : null;

                return (
                  <div
                    key={movie.id}
                    className="ios-card"
                    style={{
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.18s ease, border-color 0.18s ease',
                      border: isUpcoming ? '1px solid rgba(56, 189, 248, 0.32)' : '1px solid var(--border-color)',
                    }}
                  >
                    {/* Poster Image */}
                    <div style={{ height: '180px', width: '100%', position: 'relative', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)' }}>
                      {movie.posterUrl ? (
                        <img
                          src={movie.posterUrl}
                          alt={movie.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                          <Film size={44} />
                        </div>
                      )}

                      {/* Age Rating Badge (Top Left) */}
                      <span
                        style={{
                          position: 'absolute',
                          top: '10px',
                          left: '10px',
                          backgroundColor: ratingStyle.bg,
                          color: ratingStyle.text,
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          padding: '3px 7px',
                          borderRadius: '4px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
                        }}
                      >
                        {rating}
                      </span>

                      <span
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          backgroundColor: presentationState.style.bg,
                          color: presentationState.style.color,
                          fontWeight: 900,
                          fontSize: '0.68rem',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          boxShadow: '0 6px 18px rgba(0,0,0,.24)',
                        }}
                      >
                        {presentationState.label}
                      </span>
                    </div>

                    {/* Movie Info */}
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '6px', lineHeight: '1.3' }}>
                        {movie.title}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} />
                          <span>{movie.durationMinutes ? `${movie.durationMinutes} min` : '120 min'}</span>
                        </div>
                        <span>•</span>
                        <span>{movie.genre || 'Cinema'}</span>
                      </div>

                      <p
                        style={{
                          fontSize: '0.82rem',
                          color: 'var(--text-secondary)',
                          lineHeight: '1.45',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          marginBottom: '14px',
                        }}
                      >
                        {movie.synopsis || movie.description || 'Sem sinopse cadastrada.'}
                      </p>

                      {/* Card Footer with Status Info */}
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--separator)', paddingTop: '10px' }}>
                        {isUpcoming ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#FF9F0A', fontSize: '0.78rem', fontWeight: 600 }}>
                            <Calendar size={13} />
                            <span>{releaseText ? `Estreia: ${releaseText}` : 'Lançamento em Breve'}</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#30D158', fontSize: '0.78rem', fontWeight: 600 }}>
                            <Film size={13} />
                            <span>Sessões disponíveis</span>
                          </div>
                        )}

                        <span
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--text-tertiary)',
                            fontWeight: 500,
                          }}
                        >
                          {isUpcoming ? 'Pré-venda em breve' : 'Ingressos no WhatsApp'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeSection === 'sessions' ? (
          /* Sessions Table */
          <div className="ios-card" style={{ padding: '4px 16px', display: 'flex', flexDirection: 'column' }}>
            {sessions.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                Nenhuma sessão encontrada para a programação atual.
              </div>
            ) : (
              sessions.map((sess, idx) => (
                <React.Fragment key={sess.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <strong style={{ color: '#FFFFFF', fontSize: '0.95rem', display: 'block' }}>
                        {sess.movie?.title || sess.movieTitle || 'Sessão Especial'}
                      </strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {sess.room?.name || sess.roomName || 'Sala Principal'} • {sess.type || sess.format || '2D Dublado'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                        <Clock size={14} />
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: '#FFFFFF', fontWeight: 600 }}>
                          {sess.startTime || sess.time || '14:00'}
                        </span>
                      </div>

                      <span style={{ color: 'var(--ios-green)', fontWeight: 600, fontSize: '0.9rem' }}>
                        {formatBRL(sess.price || 10)}
                      </span>
                    </div>
                  </div>

                  {idx < sessions.length - 1 && (
                    <div style={{ height: '1px', backgroundColor: 'var(--separator)' }} />
                  )}
                </React.Fragment>
              ))
            )}
          </div>
        ) : (
          /* Products Grid (Bomboniere Classified) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Filter Pills for Bomboniere Categories */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setProductCategory('all')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    border: productCategory === 'all' ? '1px solid var(--lumix-green)' : '1px solid var(--separator)',
                    backgroundColor: productCategory === 'all' ? 'rgba(48, 209, 88, 0.14)' : 'var(--bg-tertiary)',
                    color: productCategory === 'all' ? 'var(--lumix-green)' : 'var(--text-secondary)',
                  }}
                >
                  <Layers size={14} />
                  <span>Todos ({products.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProductCategory('COMBO')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    border: productCategory === 'COMBO' ? '1px solid #BF5AF2' : '1px solid var(--separator)',
                    backgroundColor: productCategory === 'COMBO' ? 'rgba(191, 90, 242, 0.18)' : 'var(--bg-tertiary)',
                    color: productCategory === 'COMBO' ? '#BF5AF2' : 'var(--text-secondary)',
                  }}
                >
                  <Tag size={14} color="#BF5AF2" />
                  <span>Combos ({products.filter((p) => p.category === 'COMBO').length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProductCategory('POPCORN')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    border: productCategory === 'POPCORN' ? '1px solid #FF9F0A' : '1px solid var(--separator)',
                    backgroundColor: productCategory === 'POPCORN' ? 'rgba(255, 159, 10, 0.18)' : 'var(--bg-tertiary)',
                    color: productCategory === 'POPCORN' ? '#FF9F0A' : 'var(--text-secondary)',
                  }}
                >
                  <Popcorn size={14} color="#FF9F0A" />
                  <span>Pipocas ({products.filter((p) => p.category === 'POPCORN').length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProductCategory('BEVERAGE')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    border: productCategory === 'BEVERAGE' ? '1px solid #0A84FF' : '1px solid var(--separator)',
                    backgroundColor: productCategory === 'BEVERAGE' ? 'rgba(10, 132, 255, 0.18)' : 'var(--bg-tertiary)',
                    color: productCategory === 'BEVERAGE' ? '#0A84FF' : 'var(--text-secondary)',
                  }}
                >
                  <CupSoda size={14} color="#0A84FF" />
                  <span>Bebidas ({products.filter((p) => p.category === 'BEVERAGE').length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProductCategory('CANDY')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    border: productCategory === 'CANDY' ? '1px solid #FF375F' : '1px solid var(--separator)',
                    backgroundColor: productCategory === 'CANDY' ? 'rgba(255, 55, 95, 0.18)' : 'var(--bg-tertiary)',
                    color: productCategory === 'CANDY' ? '#FF375F' : 'var(--text-secondary)',
                  }}
                >
                  <Candy size={14} color="#FF375F" />
                  <span>Doces & Balas ({products.filter((p) => p.category === 'CANDY').length})</span>
                </button>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                {filteredProducts.length} itens na bomboniere
              </div>
            </div>

            {/* Products Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }}>
              {filteredProducts.map((prod) => {
                const cat = (prod.category || 'SNACK').toUpperCase();
                const meta = CATEGORY_META[cat] || CATEGORY_META.SNACK;
                const IconComp = meta.icon;

                return (
                  <div
                    key={prod.id}
                    className="ios-card"
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      border: `1px solid ${meta.border}`,
                      backgroundColor: 'var(--bg-secondary)',
                      transition: 'transform 0.18s ease, border-color 0.18s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          backgroundColor: meta.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconComp size={20} color={meta.color} />
                      </div>

                      <span
                        style={{
                          backgroundColor: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '8px',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>

                    <div>
                      <h4 style={{ color: '#FFFFFF', fontSize: '0.94rem', fontWeight: 600, lineHeight: '1.3' }}>
                        {prod.name}
                      </h4>
                      <p
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.78rem',
                          marginTop: '4px',
                          lineHeight: '1.4',
                        }}
                      >
                        {prod.description || 'Disponível para retirada no balcão da bomboniere'}
                      </p>
                    </div>

                    <div
                      style={{
                        marginTop: 'auto',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid var(--separator)',
                        paddingTop: '10px',
                      }}
                    >
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.76rem' }}>Preço no Cinema</span>
                      <span style={{ color: 'var(--ios-green)', fontWeight: 700, fontSize: '0.98rem' }}>
                        {formatBRL(prod.price)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
