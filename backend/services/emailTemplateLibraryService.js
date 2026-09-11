const TEMPLATE_DEFINITIONS = Object.freeze([
  { id: "announcement", name: "Comunicado", category: "communication", objective: "announcement", visualStyle: "editorial", description: "Comunicação geral com hierarquia direta e identidade institucional.", tags: ["comunicado", "institucional", "aviso"] },
  { id: "weekly", name: "Programação da semana", category: "programming", objective: "programming", visualStyle: "catalog", description: "Programação com vários filmes e acesso às sessões disponíveis.", tags: ["programação", "filmes", "sessões"] },
  { id: "premiere", name: "Grande estreia", category: "movies", objective: "movie", visualStyle: "cinematic", description: "Lançamento em destaque com pôster, contexto do filme e compra antecipada.", tags: ["estreia", "lançamento", "cinema"] },
  { id: "last_chance", name: "Últimos dias", category: "movies", objective: "movie", visualStyle: "urgent", description: "Últimas sessões confirmadas de um filme em cartaz.", tags: ["últimos dias", "sessões", "urgência"] },
  { id: "promotion", name: "Promoção", category: "offers", objective: "offer", visualStyle: "promotional", description: "Oferta editorial sem depender de um código de cupom.", tags: ["promoção", "oferta", "desconto"] },
  { id: "coupon", name: "Cupom", category: "offers", objective: "offer", visualStyle: "voucher", description: "Campanha vinculada a um cupom válido e verificável.", tags: ["cupom", "código", "desconto"] },
  { id: "concession", name: "Produto da bomboniere", category: "concession", objective: "concession", visualStyle: "product", description: "Destaque individual de um produto ativo da bomboniere.", tags: ["bomboniere", "produto", "lanche"] },
  { id: "combo", name: "Combo em destaque", category: "concession", objective: "concession", visualStyle: "product-grid", description: "Composição para dois ou mais itens ativos da bomboniere.", tags: ["bomboniere", "combo", "produtos"] },
  { id: "club_plan", name: "Plano do Clube", category: "club", objective: "club", visualStyle: "membership", description: "Aquisição de um plano específico do Clube Cine Cruzeiro.", tags: ["clube", "plano", "benefícios"] },
  { id: "club", name: "Novidades do Clube", category: "club", objective: "club", visualStyle: "membership-news", description: "Benefícios, novidades e relacionamento com membros do Clube.", tags: ["clube", "novidade", "benefícios"] },
  { id: "birthday", name: "Aniversário", category: "relationship", objective: "announcement", visualStyle: "celebration", description: "Relacionamento com aniversariantes selecionados por dados reais.", tags: ["aniversário", "relacionamento", "cliente"] },
  { id: "event", name: "Evento especial", category: "events", objective: "event", visualStyle: "event", description: "Eventos, sessões especiais e experiências no cinema.", tags: ["evento", "especial", "experiência"] },
  { id: "ticket", name: "Como acessar seu ingresso", category: "relationship", objective: "announcement", visualStyle: "service", description: "Orientação de acesso e uso de ingressos já emitidos.", tags: ["ingresso", "acesso", "serviço"] },
  { id: "reactivation", name: "Sentimos sua falta", category: "relationship", objective: "announcement", visualStyle: "reactivation", description: "Reativação exclusiva para público inativo validado pelo sistema.", tags: ["reativação", "relacionamento", "inativos"] }
]);

const CATEGORY_LABELS = Object.freeze({
  all: "Todos",
  movies: "Filmes",
  programming: "Programação",
  offers: "Ofertas",
  concession: "Bomboniere",
  club: "Clube",
  events: "Eventos e datas",
  relationship: "Relacionamento",
  communication: "Comunicados"
});

function normalizeText(value = "") {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function definitionFor(templateId) {
  return TEMPLATE_DEFINITIONS.find((item) => item.id === String(templateId || "")) || TEMPLATE_DEFINITIONS[0];
}

function campaignLibraryItem(campaign = {}, preferences = {}) {
  const definition = definitionFor(campaign.templateId);
  const id = `campaign:${campaign.id}`;
  const origin = campaign.aiGenerated ? "AI_GENERATED" : "MANUAL";
  const linkedName = campaign.movieTitle || campaign.itemTitle || campaign.couponTitle || campaign.clubPlanName || "";
  const contentFlags = {
    coupon: Boolean(campaign.couponId),
    discount: Boolean(campaign.couponId || ["promotion", "coupon"].includes(definition.id)),
    sessions: Boolean(campaign.movieId || (campaign.movieIds || []).length),
    trailer: Boolean(campaign.variables?.trailer_filme),
    cta: Boolean(campaign.ctaLabel || campaign.ctaUrl)
  };
  return {
    id,
    sourceId: campaign.id,
    sourceType: "campaign",
    templateId: definition.id,
    name: campaign.subject || campaign.headline || definition.name,
    description: campaign.preheader || campaign.messageExcerpt || definition.description,
    category: definition.category,
    categoryLabel: CATEGORY_LABELS[definition.category],
    objective: campaign.objective || definition.objective,
    audience: campaign.recipientMode || "all",
    tone: campaign.artDirection?.tone || campaign.visualStyleLabel || "",
    urgency: ["last_chance", "reactivation"].includes(definition.id) ? "high" : ["premiere", "coupon", "promotion"].includes(definition.id) ? "medium" : "normal",
    visualStyle: campaign.visualStyle || definition.visualStyle,
    tags: [...new Set([...definition.tags, ...(campaign.genres || []), linkedName, campaign.aiScenario || ""].filter(Boolean))],
    origin,
    status: campaign.status === "draft" ? "DRAFT_REFERENCE" : campaign.status === "cancelled" ? "ARCHIVED" : "APPROVED",
    imageUrl: campaign.imageUrl || campaign.moviePosterUrl || "",
    linkedName,
    genres: Array.isArray(campaign.genres) ? campaign.genres : [],
    movieId: campaign.movieId || "",
    movieIds: Array.isArray(campaign.movieIds) ? campaign.movieIds : (campaign.movieId ? [campaign.movieId] : []),
    couponId: campaign.couponId || "",
    concessionIds: Array.isArray(campaign.concessionIds) ? campaign.concessionIds : [],
    clubPlanId: campaign.clubPlanId || "",
    recipientMode: campaign.recipientMode || "all",
    contentFlags,
    favorite: (preferences.favorites || []).includes(id),
    archived: (preferences.archived || []).includes(id),
    usageCount: Number(preferences.usageCounts?.[id] || campaign.libraryUsageCount || 0),
    lastUsedAt: preferences.lastUsedAt?.[id] || "",
    createdAt: campaign.createdAt || "",
    updatedAt: campaign.updatedAt || campaign.createdAt || "",
    hasRealPreview: Boolean(campaign.hasHtml || campaign.hasMessage || campaign.hasBlocks)
  };
}

function systemLibraryItem(definition, preferences = {}) {
  const id = `system:${definition.id}`;
  return {
    ...definition,
    id,
    sourceId: definition.id,
    sourceType: "system",
    templateId: definition.id,
    categoryLabel: CATEGORY_LABELS[definition.category],
    origin: "SYSTEM",
    status: "ACTIVE",
    imageUrl: "",
    linkedName: "",
    favorite: (preferences.favorites || []).includes(id),
    archived: (preferences.archived || []).includes(id),
    usageCount: Number(preferences.usageCounts?.[id] || 0),
    lastUsedAt: preferences.lastUsedAt?.[id] || "",
    createdAt: "",
    updatedAt: "",
    hasRealPreview: false,
    contentFlags: {
      coupon: definition.id === "coupon",
      discount: ["coupon", "promotion"].includes(definition.id),
      sessions: ["weekly", "premiere", "last_chance"].includes(definition.id),
      trailer: false,
      cta: true
    }
  };
}

function campaignReferenceFingerprint(campaign = {}) {
  const structure = (campaign.contentSections || []).map((section) => section.type || section.kind || "").filter(Boolean).join("|");
  return normalizeText([
    campaign.templateId,
    campaign.movieId,
    campaign.couponId,
    campaign.clubPlanId,
    ...(campaign.concessionIds || []),
    campaign.subject,
    campaign.headline,
    structure
  ].join(" "));
}

function findDuplicateReference(candidate = {}, existingCampaigns = []) {
  const fingerprint = campaignReferenceFingerprint(candidate);
  if (!fingerprint) return null;
  return (existingCampaigns || []).find((campaign) => campaignReferenceFingerprint(campaign) === fingerprint) || null;
}

function recommendationScore(item, context = {}) {
  let score = item.sourceType === "system" ? 5 : 10;
  if (context.templateId && item.templateId === context.templateId) score += 80;
  if (context.objective && item.objective === context.objective) score += 45;
  if (context.category && item.category === context.category) score += 30;
  const genres = (context.genres || []).map(normalizeText);
  const haystack = normalizeText([item.name, item.description, ...(item.tags || [])].join(" "));
  score += genres.filter((genre) => genre && haystack.includes(genre)).length * 12;
  if (item.favorite) score += 8;
  score += Math.min(12, Number(item.usageCount || 0));
  return score;
}

function buildTemplateLibrary({ campaigns = [], preferences = {}, filters = {}, context = {} } = {}) {
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(48, Math.max(6, Number(filters.pageSize || 18)));
  const query = normalizeText(filters.search || filters.query);
  const matchingItems = [
    ...TEMPLATE_DEFINITIONS.map((item) => systemLibraryItem(item, preferences)),
    ...(campaigns || []).map((item) => campaignLibraryItem(item, preferences))
  ].filter((item) => {
    if (!filters.includeArchived && item.archived) return false;
    if (filters.objective && item.objective !== filters.objective) return false;
    if (filters.visualStyle && item.visualStyle !== filters.visualStyle) return false;
    if (filters.genre && !(item.genres || []).map(normalizeText).includes(normalizeText(filters.genre))) return false;
    if (filters.content && item.contentFlags?.[filters.content] !== true) return false;
    if (filters.origin && item.origin !== String(filters.origin).toUpperCase()) return false;
    if (filters.favorites === true && !item.favorite) return false;
    if (!query) return true;
    return normalizeText([item.name, item.description, item.categoryLabel, item.objective, item.visualStyle, item.tone, item.audience, item.urgency, item.linkedName, ...(item.tags || [])].join(" ")).includes(query);
  }).map((item) => ({ ...item, recommendationScore: recommendationScore(item, context) }));
  const items = matchingItems.filter((item) => !filters.category || filters.category === "all" || item.category === filters.category);

  const sort = String(filters.sort || "recommended");
  items.sort((a, b) => {
    if (sort === "recent") return String(b.lastUsedAt || b.updatedAt).localeCompare(String(a.lastUsedAt || a.updatedAt));
    if (sort === "popular") return b.usageCount - a.usageCount || b.recommendationScore - a.recommendationScore;
    if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
    return b.recommendationScore - a.recommendationScore || String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    categories: Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label, count: id === "all" ? matchingItems.length : matchingItems.filter((item) => item.category === id).length })),
    filters: {
      visualStyles: [...new Set(items.map((item) => item.visualStyle).filter(Boolean))].sort(),
      genres: [...new Set(matchingItems.flatMap((item) => item.genres || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
      origins: [...new Set(items.map((item) => item.origin).filter(Boolean))].sort()
    }
  };
}

function updateLibraryPreference(preferences = {}, id, action, value = true) {
  const next = {
    favorites: [...new Set(preferences.favorites || [])],
    archived: [...new Set(preferences.archived || [])],
    usageCounts: { ...(preferences.usageCounts || {}) },
    lastUsedAt: { ...(preferences.lastUsedAt || {}) },
    recent: [...new Set(preferences.recent || [])].slice(0, 30)
  };
  if (action === "use") {
    next.usageCounts[id] = Number(next.usageCounts[id] || 0) + 1;
    next.lastUsedAt[id] = new Date().toISOString();
    next.recent = [id, ...next.recent.filter((item) => item !== id)].slice(0, 30);
    return next;
  }
  const key = action === "archive" ? "archived" : "favorites";
  next[key] = value ? [...new Set([...next[key], id])] : next[key].filter((item) => item !== id);
  return next;
}

module.exports = {
  TEMPLATE_DEFINITIONS,
  CATEGORY_LABELS,
  definitionFor,
  campaignLibraryItem,
  buildTemplateLibrary,
  updateLibraryPreference,
  campaignReferenceFingerprint,
  findDuplicateReference,
  _test: { normalizeText, recommendationScore }
};
