const PROGRAM_IDS = ['sessions-today', 'sessions-week', 'multi-movies'];
const LAYOUTS = {
  movie: ['movie-editorial-light', 'movie-immersive', 'movie-spotlight'],
  programming: ['program-cards', 'program-grid', 'program-days'],
  concession: ['product-price', 'product-lateral', 'hero-product'],
  ticket: ['price-impact', 'ticket-burst', 'promo-editorial'],
  online: ['hero-left', 'hero-center', 'typography-dominant']
};
function category(id) {
  if (PROGRAM_IDS.includes(id)) return 'programming';
  if (id === 'ticket-offer') return 'ticket';
  if (id === 'online-ticket') return 'online';
  if (['concession-combo', 'concession-offer'].includes(id)) return 'concession';
  return id?.startsWith('movie-') ? 'movie' : 'legacy';
}
function normalizeWorkspace(input) {
  const kind = category(input.templateId), next = {...input};
  if (kind === 'programming') {
    // Film framing and image overrides cannot replace a multi-film programme.
    next.layoutId = undefined; next.style = 'automatic'; next.automaticStyle = true;
    next.artworkStrategy = 'automatic'; next.imageUrl = ''; next.imageMode = 'automatic';
    next.artDirection = {}; next.composition = {};
  } else if (kind !== 'legacy') {
    const requested = input.layoutId || input.style;
    const foreign = requested?.startsWith('program-') || kind !== 'movie' && requested?.startsWith('movie-');
    if (foreign) { next.layoutId = undefined; next.style = 'automatic'; next.automaticStyle = true; }
    delete next.programLayout;
  }
  if (input.workspaceVersion === 2 && LAYOUTS[kind]) {
    const key = kind === 'programming' ? 'programLayout' : 'layoutId';
    const requested = next[key] || next.style;
    if (requested && requested !== 'automatic' && !LAYOUTS[kind].includes(requested)) {
      next[key] = kind === 'programming' ? 'automatic' : undefined;
      next.style = 'automatic'; next.automaticStyle = true;
    }
  }
  return next;
}
module.exports = {PROGRAM_IDS, LAYOUTS, category, normalizeWorkspace};
