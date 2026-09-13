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

function templateVariant(id, templateId, name, description, visualStyle, defaults, theme, tags = []) {
  return Object.freeze({ id, variantId: id, templateId, name, description, visualStyle, defaults, theme, tags });
}

const TEMPLATE_VARIANTS = Object.freeze([
  templateVariant("announcement", "announcement", "Comunicado editorial", "Mensagem institucional sóbria, com leitura direta e uma ação principal.", "editorial", { subject: "Uma novidade do Cine Cruzeiro", headline: "Uma informação importante para você", message: "Olá, {{nome}}. Confira esta novidade do Cine Cruzeiro.", ctaLabel: "Saiba mais" }, { accent: "#4d8dff", background: "#0d1728", surface: "#09111f", headline: "#ffffff", text: "#dbeafe" }, ["direto", "institucional"]),
  templateVariant("announcement-service", "announcement", "Aviso de serviço", "Comunicado objetivo para mudanças operacionais, orientações e atendimento.", "service", { subject: "Informação de atendimento do Cine Cruzeiro", headline: "Antes da sua próxima visita", message: "Olá, {{nome}}. Reunimos uma orientação importante para sua experiência no cinema.", ctaLabel: "Consultar informações" }, { accent: "#45d6a1", background: "#09131f", surface: "#0c1c2d", headline: "#f8fafc", text: "#dbeafe" }, ["serviço", "orientação"]),
  templateVariant("weekly", "weekly", "Programação em cartaz", "Agenda escaneável com filmes e horários confirmados.", "catalog", { subject: "A programação desta semana no Cine Cruzeiro", headline: "Escolha sua próxima sessão", message: "Olá, {{nome}}. Veja os filmes e horários disponíveis nesta semana.", ctaLabel: "Ver programação completa" }, { accent: "#22d3ee", background: "#07111d", surface: "#091827", headline: "#ffffff", text: "#dbeafe" }, ["agenda", "horários"]),
  templateVariant("weekly-marquee", "weekly", "Programação em destaque", "Seleção com ritmo de cartaz de cinema e maior contraste nos títulos.", "marquee", { subject: "As grandes histórias da semana estão aqui", headline: "Esta semana na tela do Cine Cruzeiro", message: "Olá, {{nome}}. Escolha entre os destaques em cartaz e garanta seu horário.", ctaLabel: "Escolher um filme" }, { accent: "#facc15", background: "#090f1b", surface: "#111b2b", headline: "#fff7d6", text: "#dbeafe" }, ["destaques", "cartaz"]),
  templateVariant("premiere", "premiere", "Estreia cinematográfica", "Pôster protagonista, título forte e chamada para sessões.", "cinematic", { subject: "Uma grande estreia chega ao Cine Cruzeiro", headline: "A próxima grande história começa aqui", message: "Olá, {{nome}}. Prepare-se para viver esta estreia na tela grande.", ctaLabel: "Ver sessões" }, { accent: "#facc15", background: "#09111f", surface: "#050912", headline: "#ffffff", text: "#dbeafe" }, ["blockbuster", "lançamento"]),
  templateVariant("premiere-spotlight", "premiere", "Estreia sob os holofotes", "Composição elegante para drama, suspense e lançamentos de prestígio.", "spotlight", { subject: "Uma estreia para viver na tela grande", headline: "As luzes se acendem para uma nova história", message: "Olá, {{nome}}. Descubra a nova estreia do Cine Cruzeiro e escolha sua sessão.", ctaLabel: "Garantir ingresso" }, { accent: "#ff7185", background: "#0a1220", surface: "#120d18", headline: "#ffffff", text: "#f1e5e8" }, ["holofote", "prestígio"]),
  templateVariant("last_chance", "last_chance", "Últimas sessões", "Urgência legítima com horários restantes em primeiro plano.", "urgent", { subject: "Últimas sessões no Cine Cruzeiro", headline: "Sua última chance na tela grande", message: "Olá, {{nome}}. Confira os últimos horários confirmados para este filme.", ctaLabel: "Garantir ingresso" }, { accent: "#fb7185", background: "#120a11", surface: "#2a1019", headline: "#ffffff", text: "#fecdd3" }, ["urgência", "encerramento"]),
  templateVariant("last_chance-farewell", "last_chance", "Despedida da programação", "Tom de despedida para a última oportunidade de assistir no cinema.", "farewell", { subject: "É hora da última sessão", headline: "Uma última vez na tela do Cine Cruzeiro", message: "Olá, {{nome}}. Ainda dá tempo de viver esta história como ela merece.", ctaLabel: "Ver últimos horários" }, { accent: "#f6c453", background: "#10131a", surface: "#1b1b21", headline: "#fff7e6", text: "#e7dfd1" }, ["despedida", "última oportunidade"]),
  templateVariant("promotion", "promotion", "Oferta em destaque", "Benefício comercial amplo com condições claramente separadas.", "promotional", { subject: "Uma condição especial no Cine Cruzeiro", headline: "Mais cinema por uma condição especial", message: "Olá, {{nome}}. Confira o benefício e as condições desta campanha.", ctaLabel: "Aproveitar oferta" }, { accent: "#facc15", background: "#111827", surface: "#facc15", headline: "#050912", text: "#241b00" }, ["benefício", "oferta"]),
  templateVariant("promotion-premium", "promotion", "Benefício exclusivo", "Oferta de aparência premium para segmentos e ocasiões especiais.", "premium-offer", { subject: "Uma condição reservada para você", headline: "Uma experiência especial no Cine Cruzeiro", message: "Olá, {{nome}}. Preparamos uma condição exclusiva dentro do período informado.", ctaLabel: "Conhecer benefício" }, { accent: "#45d6a1", background: "#071710", surface: "#0d2a20", headline: "#ffffff", text: "#d7f5e8" }, ["exclusivo", "premium"]),
  templateVariant("coupon", "coupon", "Cupom recortável", "Código, desconto e validade organizados como um voucher digital.", "voucher", { subject: "Seu cupom do Cine Cruzeiro chegou", headline: "Um desconto reservado para você", message: "Olá, {{nome}}. Use o código abaixo dentro da validade e das condições informadas.", ctaLabel: "Usar meu cupom" }, { accent: "#45d6a1", background: "#071710", surface: "#f3f6fb", headline: "#ffffff", text: "#dbeafe" }, ["voucher", "código"]),
  templateVariant("coupon-ticket", "coupon", "Cupom em formato de ingresso", "Oferta com linguagem visual inspirada em bilhete de cinema.", "ticket-offer", { subject: "Seu ingresso para uma oferta especial", headline: "Apresente este código na sua próxima compra", message: "Olá, {{nome}}. Este código libera o benefício conforme as regras da campanha.", ctaLabel: "Ver filmes elegíveis" }, { accent: "#facc15", background: "#0b1523", surface: "#fff7d6", headline: "#ffffff", text: "#dbeafe" }, ["ingresso", "cupom"]),
  templateVariant("concession", "concession", "Produto protagonista", "Imagem ampla, nome e preço para um único item da bomboniere.", "product", { subject: "Um sabor especial espera por você", headline: "Complete sua sessão com este destaque", message: "Olá, {{nome}}. Conheça este item selecionado da nossa bomboniere.", ctaLabel: "Ver na bomboniere" }, { accent: "#f59e0b", background: "#141008", surface: "#231a0b", headline: "#ffffff", text: "#fef3c7" }, ["produto", "sabor"]),
  templateVariant("concession-premium", "concession", "Bomboniere premium", "Apresentação refinada para itens especiais e lançamentos sazonais.", "product-premium", { subject: "Um destaque especial da bomboniere", headline: "Um detalhe a mais para sua experiência", message: "Olá, {{nome}}. Descubra o produto selecionado para acompanhar sua sessão.", ctaLabel: "Conhecer o produto" }, { accent: "#f6c453", background: "#0d1218", surface: "#171e27", headline: "#fff7e6", text: "#e7dfd1" }, ["produto", "refinado"]),
  templateVariant("combo", "combo", "Combo para compartilhar", "Vários itens com composição conjunta, quantidades e valores legíveis.", "product-grid", { subject: "Um combo completo para sua próxima sessão", headline: "Tudo combina melhor na tela grande", message: "Olá, {{nome}}. Confira os itens selecionados para completar sua visita.", ctaLabel: "Escolher uma sessão" }, { accent: "#fb7185", background: "#160b12", surface: "#29101d", headline: "#ffffff", text: "#fce7f3" }, ["combo", "compartilhar"]),
  templateVariant("combo-family", "combo", "Combo em família", "Composição acolhedora para grupos e sessões em família.", "family", { subject: "A sessão da família ficou completa", headline: "Mais sabores para dividir boas histórias", message: "Olá, {{nome}}. Veja a seleção preparada para compartilhar durante o filme.", ctaLabel: "Planejar a sessão" }, { accent: "#22d3ee", background: "#0b1728", surface: "#0d2538", headline: "#ffffff", text: "#dbeafe" }, ["família", "grupo"]),
  templateVariant("club_plan", "club_plan", "Plano em destaque", "Aquisição com preço, créditos e benefícios confirmados.", "membership", { subject: "Um plano para viver mais cinema", headline: "Mais cinema, benefícios de verdade", message: "Olá, {{nome}}. Conheça o plano que combina com sua rotina de cinema.", ctaLabel: "Assinar este plano" }, { accent: "#facc15", background: "#081425", surface: "#172235", headline: "#ffffff", text: "#dbeafe" }, ["assinatura", "benefícios"]),
  templateVariant("club_plan-comparison", "club_plan", "Plano com benefícios", "Hierarquia orientada à comparação dos benefícios reais do plano.", "membership-benefits", { subject: "Veja tudo o que este plano inclui", headline: "Seu cinema, com vantagens em cada visita", message: "Olá, {{nome}}. Confira os benefícios e valores confirmados deste plano.", ctaLabel: "Conhecer o plano" }, { accent: "#45d6a1", background: "#07131f", surface: "#0c2630", headline: "#ffffff", text: "#d7f5e8" }, ["comparação", "vantagens"]),
  templateVariant("club", "club", "Novidades para membros", "Relacionamento com membros e comunicação geral do Clube.", "membership-news", { subject: "Novidades do Clube Cine Cruzeiro", headline: "Tem novidade para quem vive cinema", message: "Olá, {{nome}}. Confira a atualização preparada para membros do Clube.", ctaLabel: "Acessar o Clube" }, { accent: "#facc15", background: "#081425", surface: "#172235", headline: "#ffffff", text: "#dbeafe" }, ["membros", "novidade"]),
  templateVariant("club-community", "club", "Comunidade Cine Cruzeiro", "Tom próximo para pertencimento, relacionamento e benefícios do Clube.", "community", { subject: "Uma novidade para a comunidade do Cine Cruzeiro", headline: "Fazer parte também é viver mais histórias", message: "Olá, {{nome}}. Veja o que preparamos para a comunidade do Clube.", ctaLabel: "Ver novidades" }, { accent: "#4d8dff", background: "#0a1220", surface: "#111f35", headline: "#ffffff", text: "#dbeafe" }, ["comunidade", "relacionamento"]),
  templateVariant("birthday", "birthday", "Aniversário cinematográfico", "Mensagem pessoal de celebração com uma ação simples.", "celebration", { subject: "Feliz aniversário, {{nome}}!", headline: "Seu novo ciclo merece cinema", message: "Parabéns, {{nome}}! Desejamos um ano cheio de histórias inesquecíveis.", ctaLabel: "Escolher um filme" }, { accent: "#facc15", background: "#090d1c", surface: "#172554", headline: "#ffffff", text: "#dbeafe" }, ["aniversário", "celebração"]),
  templateVariant("birthday-classic", "birthday", "Celebração clássica", "Aniversário elegante e discreto para relacionamento recorrente.", "classic-celebration", { subject: "Uma sessão especial para celebrar você", headline: "Hoje a história principal é a sua", message: "Olá, {{nome}}. O Cine Cruzeiro deseja um aniversário cheio de bons momentos.", ctaLabel: "Celebrar no cinema" }, { accent: "#f6c453", background: "#10131a", surface: "#1d2330", headline: "#fff7e6", text: "#e7dfd1" }, ["aniversário", "elegante"]),
  templateVariant("event", "event", "Evento imersivo", "Imagem em largura total e convite centralizado para evento confirmado.", "event", { subject: "Um evento especial no Cine Cruzeiro", headline: "Reserve esta data", message: "Olá, {{nome}}. Você está convidado para uma experiência especial no cinema.", ctaLabel: "Ver detalhes" }, { accent: "#22d3ee", background: "#07111d", surface: "#091827", headline: "#ffffff", text: "#dbeafe" }, ["evento", "convite"]),
  templateVariant("event-premium", "event", "Noite especial", "Convite sofisticado para pré-estreias, encontros e experiências exclusivas.", "event-premium", { subject: "Um convite especial do Cine Cruzeiro", headline: "Uma noite para ficar na memória", message: "Olá, {{nome}}. Confira os detalhes desta experiência especial no Cine Cruzeiro.", ctaLabel: "Confirmar interesse" }, { accent: "#f6c453", background: "#0b0d12", surface: "#191b22", headline: "#fff7e6", text: "#e7dfd1" }, ["evento", "noite especial"]),
  templateVariant("ticket", "ticket", "Guia do ingresso digital", "Orientação clara sobre QR Code, sessão e acesso à conta.", "service", { subject: "Tudo sobre seu ingresso do Cine Cruzeiro", headline: "Tudo pronto para sua sessão", message: "Olá, {{nome}}. Consulte seu ingresso digital e confira os dados antes de chegar.", ctaLabel: "Ver meus ingressos" }, { accent: "#45d6a1", background: "#0b1523", surface: "#09111f", headline: "#ffffff", text: "#dbeafe" }, ["qr code", "orientação"]),
  templateVariant("ticket-reminder", "ticket", "Lembrete de sessão", "Modelo de serviço para reforçar acesso, horário e preparação para a visita.", "reminder", { subject: "Sua sessão está chegando", headline: "Seu ingresso já está disponível", message: "Olá, {{nome}}. Abra seu ingresso e confira QR Code, horário e poltrona.", ctaLabel: "Abrir ingresso" }, { accent: "#4d8dff", background: "#09131f", surface: "#111f35", headline: "#ffffff", text: "#dbeafe" }, ["lembrete", "sessão"]),
  templateVariant("reactivation", "reactivation", "Boas-vindas de volta", "Reaproximação acolhedora, sem pressão ou oferta inventada.", "reactivation", { subject: "Sentimos sua falta no Cine Cruzeiro", headline: "Tem uma nova história esperando por você", message: "Olá, {{nome}}. Venha descobrir o que está em cartaz no Cine Cruzeiro.", ctaLabel: "Ver programação" }, { accent: "#4d8dff", background: "#0a1220", surface: "#111f35", headline: "#ffffff", text: "#dbeafe" }, ["retorno", "acolhimento"]),
  templateVariant("reactivation-discovery", "reactivation", "Redescubra o cinema", "Reativação editorial focada em descoberta e programação atual.", "discovery", { subject: "Que tal redescobrir o Cine Cruzeiro?", headline: "Novas histórias chegaram à nossa tela", message: "Olá, {{nome}}. Confira a programação atual e escolha uma nova história para viver.", ctaLabel: "Descobrir filmes" }, { accent: "#22d3ee", background: "#07111d", surface: "#0d1d31", headline: "#ffffff", text: "#dbeafe" }, ["descoberta", "programação"])
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

function variantFor(variantId) {
  return TEMPLATE_VARIANTS.find((item) => item.id === String(variantId || "")) || null;
}

function campaignLibraryItem(campaign = {}, preferences = {}) {
  const definition = definitionFor(campaign.templateId);
  const id = `campaign:${campaign.id}`;
  const origin = "SAVED";
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

function systemLibraryItem(variant, preferences = {}) {
  const definition = definitionFor(variant.templateId);
  const id = `system:${variant.id}`;
  return {
    ...definition,
    ...variant,
    id,
    sourceId: variant.id,
    sourceType: "system",
    variantId: variant.id,
    templateId: variant.templateId,
    tags: [...new Set([...(definition.tags || []), ...(variant.tags || [])])],
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
      coupon: variant.templateId === "coupon",
      discount: ["coupon", "promotion"].includes(variant.templateId),
      sessions: ["weekly", "premiere", "last_chance"].includes(variant.templateId),
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
    ...TEMPLATE_VARIANTS.map((item) => systemLibraryItem(item, preferences)),
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
    systemModelCount: TEMPLATE_VARIANTS.length,
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
  TEMPLATE_VARIANTS,
  CATEGORY_LABELS,
  definitionFor,
  variantFor,
  campaignLibraryItem,
  buildTemplateLibrary,
  updateLibraryPreference,
  campaignReferenceFingerprint,
  findDuplicateReference,
  _test: { normalizeText, recommendationScore }
};
