import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../backend/services/socialStudioEngineService');
const { SOCIAL_STUDIO_EDITORIAL_MOVIES } = require('../backend/services/socialStudioEditorialCatalog');
const { STYLES, PRESETS, LOOKS } = require('../backend/services/social-studio/composition-engine/config');
const { PROGRAM_LAYOUTS } = require('../backend/services/social-studio/programming/direction');

const root = path.resolve(import.meta.dirname, '..');
const dateStamp = new Date().toISOString().slice(0, 10);
const outputRoot = path.resolve(process.argv[2] || path.join(root, 'Images', `Social Studio - Campanhas Geradas ${dateStamp}`));
const postsDir = path.join(outputRoot, 'posts');
const sourcesDir = path.join(outputRoot, 'fontes');
const db = JSON.parse(await fs.readFile(path.join(root, 'backend', 'data', 'db.json'), 'utf8'));

function genreList(movie = {}) {
  return Array.isArray(movie.genre) ? movie.genre.map(String) : String(movie.genre || '').split(/[|,/]/).map((item) => item.trim()).filter(Boolean);
}

function localAssetPath(value = '') {
  const asset = String(value || '').replace(/^https?:\/\/[^/]+/i, '').split('?')[0];
  if (asset.startsWith('/uploads/')) return path.join(root, 'backend', 'public', 'uploads', asset.slice('/uploads/'.length));
  if (asset.startsWith('/images/')) return path.join(root, 'public', asset.slice(1));
  return '';
}

async function loadImage(value) {
  const file = localAssetPath(value);
  if (!file) return null;
  return fs.readFile(file).catch(() => null);
}

const catalogMovies = (db.movies || []).map((movie) => ({
  ...movie,
  catalogued: true,
  genres: genreList(movie),
  sessions: Array.isArray(movie.sessions) ? movie.sessions : [],
  minimumPrice: null
}));
const catalogTitles = new Set(catalogMovies.map((movie) => String(movie.title || '').toLocaleLowerCase('pt-BR')));
const editorialMovies = SOCIAL_STUDIO_EDITORIAL_MOVIES
  .filter((movie) => !catalogTitles.has(String(movie.title || '').toLocaleLowerCase('pt-BR')))
  .map((movie) => ({ ...movie, genres: genreList(movie), sessions: [], minimumPrice: null }));
const movies = [...catalogMovies, ...editorialMovies];

const configuredBrand = db.settings?.socialStudioBrand || {};
const context = {
  now: '2026-09-22T12:00:00-03:00',
  brand: engine.normalizeBrand({
    name: configuredBrand.name || db.settings?.cinemaName || 'Cine Cruzeiro',
    logoUrl: configuredBrand.logoUrl || db.settings?.logoUrl || '/images/logo-display.webp',
    posterLogoUrl: configuredBrand.posterLogoUrl || '/images/social-studio/cine-cruzeiro-logo-3d.png',
    website: configuredBrand.website || 'https://www.cinecruzeiro.com.br',
    posterWebsite: configuredBrand.posterWebsite || 'www.cinecruzeiro.com.br',
    primaryColor: configuredBrand.primaryColor || db.settings?.primaryColor || '#07111f',
    secondaryColor: configuredBrand.secondaryColor || db.settings?.secondaryColor || '#267be6',
    accentColor: configuredBrand.accentColor || db.settings?.accentColor || '#facc15',
    textColor: configuredBrand.textColor || db.settings?.textColor || '#ffffff'
  }),
  movies,
  concessions: [],
  clubPlans: [],
  templates: engine.SOCIAL_TEMPLATES,
  styles: [...engine.SOCIAL_STYLES, ...STYLES],
  formats: Object.values(engine.SOCIAL_FORMATS),
  signatures: engine.SOCIAL_SIGNATURES,
  palettes: require('../backend/services/social-studio/engine/palette').PALETTES,
  composition: { presets: PRESETS, looks: LOOKS },
  programLayouts: PROGRAM_LAYOUTS,
  history: [],
  readyPosts: []
};

const website = 'https://www.cinecruzeiro.com.br/filmes';
const campaignInputs = [
  {
    filename: '01-vingadores-estreia-feed.png', templateId: 'movie-premiere', movieId: 'vingadores-doutor-destino', formatId: 'feed_portrait', layoutId: 'hero-left', visualStyle: 'impact', look: 'dramatic',
    subtitle: 'A BATALHA SE APROXIMA', auxiliaryText: 'Uma nova ameaça coloca heróis em rota de colisão.', cta: 'ACOMPANHE A ESTREIA', actionDestination: website
  },
  {
    filename: '02-vingadores-estreia-story.png', templateId: 'movie-premiere', movieId: 'vingadores-doutor-destino', formatId: 'story', layoutId: 'full-bleed', visualStyle: 'cinematic', look: 'immersive',
    subtitle: 'ESTREIA CONFIRMADA', auxiliaryText: 'O próximo capítulo dos Vingadores chega em dezembro de 2026.', cta: 'VEJA AS NOVIDADES', actionDestination: website
  },
  {
    filename: '03-homem-aranha-destaque-feed.png', templateId: 'movie-highlight', movieId: 'homem-aranha-um-novo-dia', formatId: 'feed_portrait', layoutId: 'diagonal', visualStyle: 'impact', look: 'vibrant',
    subtitle: 'UMA NOVA JORNADA', date: 'EM BREVE', auxiliaryText: 'Acompanhe as próximas novidades do herói nas telas.', cta: 'CONFIRA O CATÁLOGO', actionDestination: website
  },
  {
    filename: '04-deadpool-destaque-square.png', templateId: 'movie-highlight', movieId: 'deadpool-wolverine', formatId: 'square', layoutId: 'typography-dominant', visualStyle: 'impact', look: 'dramatic',
    subtitle: 'AÇÃO SEM FREIO', date: 'EM BREVE', auxiliaryText: 'Humor, ação e uma dupla impossível de ignorar.', cta: 'VEJA AS NOVIDADES', actionDestination: website
  },
  {
    filename: '05-superman-destaque-story.png', templateId: 'movie-highlight', movieId: 'superman', formatId: 'story', layoutId: 'hero-right', visualStyle: 'clean', look: 'cinematic',
    subtitle: 'UM SÍMBOLO RETORNA', date: 'EM BREVE', auxiliaryText: 'Uma nova história do herói que atravessa gerações.', cta: 'ACOMPANHE O CINEMA', actionDestination: website
  },
  {
    filename: '06-focker-lancamento-feed.png', templateId: 'movie-premiere', movieId: 'editorial-focker-in-law', formatId: 'feed_portrait', layoutId: 'editorial', visualStyle: 'minimal', look: 'natural',
    subtitle: 'A FAMÍLIA VOLTOU', auxiliaryText: 'Uma reunião de família pronta para sair completamente do controle.', cta: 'ACOMPANHE AS NOVIDADES', actionDestination: website
  },
  {
    filename: '07-sonic-lancamento-story.png', templateId: 'movie-premiere', movieId: 'editorial-sonic-4', formatId: 'story', layoutId: 'hero-center', visualStyle: 'impact', look: 'vibrant',
    subtitle: 'VELOCIDADE EM 2027', auxiliaryText: 'A próxima aventura de Sonic já está no horizonte.', cta: 'FIQUE POR DENTRO', actionDestination: website
  },
  {
    filename: '08-como-treinar-dragao-feed.png', templateId: 'movie-premiere', movieId: 'editorial-como-treinar-dragao-2', formatId: 'feed_portrait', layoutId: 'poster-dominant', visualStyle: 'cinematic', look: 'immersive',
    subtitle: 'UMA NOVA JORNADA', auxiliaryText: 'Soluço e Banguela se preparam para uma nova aventura.', cta: 'ACOMPANHE AS NOVIDADES', actionDestination: website
  },
  {
    filename: '09-shrek-lancamento-square.png', templateId: 'movie-premiere', movieId: 'editorial-shrek-5', formatId: 'square', layoutId: 'split', visualStyle: 'impact', look: 'vibrant',
    subtitle: 'O PÂNTANO CHAMA', auxiliaryText: 'Uma nova aventura para reunir a família no cinema.', cta: 'FIQUE POR DENTRO', actionDestination: website
  },
  {
    filename: '10-frozen-lancamento-story.png', templateId: 'movie-premiere', movieId: 'editorial-frozen-3', formatId: 'story', layoutId: 'full-bleed', visualStyle: 'clean', look: 'immersive',
    subtitle: 'ARRENDELLE RETORNA', auxiliaryText: 'Uma nova história para viver com toda a família.', cta: 'ACOMPANHE AS NOVIDADES', actionDestination: website
  }
];

function captionFor(rendered) {
  const draft = rendered.draft;
  const movie = draft.entities.movie || {};
  const release = movie.releaseLabel || draft.date || '';
  return [
    `${draft.subtitle}\n\n${draft.title}`,
    draft.auxiliaryText,
    release ? `\n${release}.` : '',
    `\n${draft.cta}.`,
    'Acompanhe o Cine Cruzeiro para receber atualizações sobre a programação.',
    '\n#CineCruzeiro #Cinema #CulturaELazer'
  ].filter(Boolean).join('\n');
}

await fs.mkdir(postsDir, { recursive: true });
await fs.mkdir(sourcesDir, { recursive: true });
const manifest = [];

for (const [index, input] of campaignInputs.entries()) {
  const rendered = await engine.renderSocialPost({
    ...input,
    primaryDateKind: 'release',
    composition: { enabled: true },
    artDirection: { enabled: true, seed: 240 + index, heroMode: index % 3 === 0 ? 'edge-dissolve' : 'full-blend' },
    signatureId: 'logo-3d',
    polish: true
  }, context, { loadImage });
  const filePath = path.join(postsDir, input.filename);
  await fs.writeFile(filePath, rendered.buffer);
  const source = rendered.draft.entities.movie?.posterUrl;
  const sourcePath = localAssetPath(source);
  if (sourcePath) {
    const extension = path.extname(sourcePath) || '.png';
    await fs.copyFile(sourcePath, path.join(sourcesDir, `${String(index + 1).padStart(2, '0')}-${rendered.draft.entities.movie.id}${extension}`));
  }
  manifest.push({
    file: `posts/${input.filename}`,
    format: rendered.format.name,
    size: `${rendered.format.width}x${rendered.format.height}`,
    movie: rendered.draft.entities.movie?.title || '',
    template: rendered.template.name,
    quality: rendered.quality.total,
    caption: captionFor(rendered),
    source: source || ''
  });
  process.stdout.write(`Gerado ${index + 1}/${campaignInputs.length}: ${input.filename}\n`);
}

const captions = manifest.map((item, index) => `## ${String(index + 1).padStart(2, '0')} - ${item.movie}\n\nArquivo: \`${item.file}\`\nFormato: ${item.format} (${item.size})\n\n${item.caption}\n`).join('\n');
await fs.writeFile(path.join(outputRoot, 'legendas.md'), `# Legendas das campanhas\n\n${captions}`, 'utf8');
await fs.writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), cinema: context.brand.name, posts: manifest }, null, 2), 'utf8');
await fs.writeFile(path.join(outputRoot, 'README.md'), [
  '# Campanhas prontas para redes sociais',
  '',
  `Foram geradas ${manifest.length} artes em alta resolução pelo Social Studio do Cine Cruzeiro.`,
  '',
  '- `posts/`: arquivos PNG prontos para publicação.',
  '- `fontes/`: pôsteres utilizados nas artes.',
  '- `legendas.md`: textos correspondentes às publicações.',
  '- `manifest.json`: metadados de formato, qualidade e origem.',
  '',
  'As peças de lançamentos futuros usam chamadas de acompanhamento e não anunciam sessões ou vendas que não estejam confirmadas.'
].join('\n'), 'utf8');

const tiles = await Promise.all(manifest.map(async (item, index) => ({
  input: await sharp(path.join(outputRoot, item.file))
    .resize({ width: 270, height: 338, fit: 'contain', background: '#07111f' })
    .png()
    .toBuffer(),
  left: (index % 5) * 270,
  top: Math.floor(index / 5) * 338
})));
await sharp({ create: { width: 1350, height: 676, channels: 3, background: '#07111f' } })
  .composite(tiles)
  .png()
  .toFile(path.join(outputRoot, 'grade-de-previas.png'));

console.log(`\nEntrega criada em: ${outputRoot}`);
