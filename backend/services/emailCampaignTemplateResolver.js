const TEMPLATE_IDS = new Set([
  "announcement", "weekly", "premiere", "last_chance", "promotion", "coupon",
  "concession", "combo", "club_plan", "club", "birthday", "event", "ticket", "reactivation"
]);

const OBJECTIVES = {
  movie: { label: "Filme", description: "Estreia, filme em cartaz ou últimas sessões" },
  programming: { label: "Programação", description: "Filmes e sessões disponíveis" },
  offer: { label: "Oferta ou cupom", description: "Promoções, descontos e cupons" },
  concession: { label: "Bomboniere", description: "Produtos e combos" },
  club: { label: "Clube Cine Cruzeiro", description: "Planos, benefícios e novidades" },
  event: { label: "Evento", description: "Um evento especial do cinema" },
  announcement: { label: "Comunicado", description: "Uma comunicação geral para seus clientes" }
};

const SCENARIO_COMPATIBLE_TEMPLATES = {
  announcement: ["announcement"],
  programming: ["weekly"],
  premiere: ["premiere", "weekly"],
  now_playing: ["weekly", "announcement"],
  last_chance: ["last_chance", "weekly"],
  promotion: ["promotion", "coupon"],
  coupon: ["coupon", "promotion"],
  concession: ["concession", "combo"],
  combo: ["combo", "concession"],
  club_plan: ["club_plan", "club"],
  club: ["club"],
  birthday: ["birthday", "announcement"],
  event: ["event", "announcement"],
  ticket: ["ticket"],
  reactivation: ["reactivation", "announcement"]
};

const SCENARIO_ALIASES = {
  announcement: "announcement", comunicado: "announcement", generic: "announcement",
  programming: "programming", programacao: "programming", weekly: "programming",
  movie: "movie", filme: "movie", launch: "premiere", estreia: "premiere", premiere: "premiere",
  cartaz: "now_playing", now_playing: "now_playing", last_chance: "last_chance", ultimos_dias: "last_chance",
  promocao: "promotion", promotion: "promotion", cupom: "coupon", coupon: "coupon",
  bomboniere: "concession", concession: "concession", combo: "combo",
  clube: "club", club: "club", club_plan: "club_plan", plano: "club_plan",
  aniversario: "birthday", birthday: "birthday", evento: "event", event: "event",
  ingresso: "ticket", ingressos: "ticket", ticket: "ticket",
  reactivation: "reactivation", reativacao: "reactivation"
};

const TEMPLATE_SCENARIOS = {
  announcement: "announcement", weekly: "programming", premiere: "premiere", last_chance: "last_chance",
  promotion: "promotion", coupon: "coupon", concession: "concession", combo: "combo",
  club_plan: "club_plan", club: "club", birthday: "birthday", event: "event", ticket: "ticket", reactivation: "reactivation"
};

function normalizeObjective(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (OBJECTIVES[normalized]) return normalized;
  if (["premiere", "now_playing", "last_chance", "movie"].includes(normalized)) return "movie";
  if (["weekly", "programacao_da_semana"].includes(normalized)) return "programming";
  if (["promotion", "coupon"].includes(normalized)) return "offer";
  if (["concession", "combo"].includes(normalized)) return "concession";
  if (["club_plan", "club"].includes(normalized)) return "club";
  if (["birthday", "reactivation"].includes(normalized)) return "announcement";
  return "";
}

function objectiveFromScenario(value) {
  const scenario = normalizeScenario(value);
  if (scenario === "ticket") return "movie";
  if (["premiere", "now_playing", "last_chance"].includes(scenario)) return "movie";
  if (scenario === "programming") return "programming";
  if (["promotion", "coupon"].includes(scenario)) return "offer";
  if (["concession", "combo"].includes(scenario)) return "concession";
  if (["club", "club_plan"].includes(scenario)) return "club";
  if (scenario === "event") return "event";
  return "announcement";
}

function normalizeScenario(value) {
  return SCENARIO_ALIASES[String(value || "").trim().toLowerCase()] || "announcement";
}

function validTemplate(value, fallback = "announcement") {
  return TEMPLATE_IDS.has(String(value || "")) ? String(value) : fallback;
}

function compatibleTemplatesForScenario(scenario, context = {}) {
  const normalized = normalizeScenario(scenario);
  if (normalized === "movie") return compatibleTemplatesForMovie(context);
  if (normalized === "offer") return context.coupon || context.couponId ? ["coupon", "promotion"] : ["promotion", "coupon"];
  if (normalized === "concession") return Number(context.concessionCount ?? context.concessions?.length ?? context.concessionIds?.length ?? 0) > 1 ? ["combo", "concession"] : ["concession", "combo"];
  if (normalized === "club") return context.plan || context.clubPlanId ? ["club_plan", "club"] : ["club"];
  return SCENARIO_COMPATIBLE_TEMPLATES[normalized] || ["announcement"];
}

function compatibleTemplatesForMovie(context = {}) {
  if (isLastChanceMovie(context.movie)) return ["last_chance", "weekly"];
  if (isUpcomingMovie(context.movie)) return ["premiere", "weekly"];
  return ["weekly", "announcement"];
}

function isUpcomingMovie(movie) {
  return ["upcoming", "coming_soon", "em_breve"].includes(String(movie?.status || "").toLowerCase());
}

function isLastChanceMovie(movie) {
  return movie?.lastChance === true || movie?.last_chance === true ||
    ["last_chance", "last-days", "last_days", "ultimos_dias", "ending_soon"].includes(String(movie?.status || movie?.programmingStatus || "").toLowerCase());
}

function selectedMovieCount(context = {}) {
  const ids = Array.isArray(context.movieIds) ? context.movieIds.filter(Boolean).map(String) : [];
  return new Set([...ids, context.movieId, context.movie?.id].filter(Boolean).map(String)).size;
}

function scopeCampaignContext(context = {}) {
  const explicitObjective = normalizeObjective(context.objective);
  const category = explicitObjective || objectiveFromScenario(context.scenario || context.aiScenario);
  const scenario = normalizeScenario(context.scenario || context.aiScenario);
  // Keep legacy scenario-only requests intact while still using its category
  // to remove unrelated catalog references.
  const scoped = { ...context, objective: explicitObjective || "" };
  const hasCoupon = Boolean(context.coupon || context.couponId);

  // Catalog references are mutually exclusive unless a coupon needs a movie to
  // validate a film-specific restriction.
  if (!["movie", "programming"].includes(category) && !(category === "offer" && hasCoupon)) {
    delete scoped.movie;
    delete scoped.movieId;
    delete scoped.movieIds;
    delete scoped.movies;
  }
  if (category !== "offer") {
    delete scoped.coupon;
    delete scoped.couponId;
  }
  if (category !== "concession") {
    delete scoped.concessions;
    delete scoped.concessionIds;
    delete scoped.concessionId;
  }
  if (category !== "club") {
    delete scoped.plan;
    delete scoped.clubPlanId;
    delete scoped.clubOffer;
  }
  if (category === "offer" && !hasCoupon) {
    delete scoped.movie;
    delete scoped.movieId;
    delete scoped.movieIds;
    delete scoped.movies;
  }
  if (["event", "announcement"].includes(category)) {
    delete scoped.coupon;
    delete scoped.couponId;
  }
  if (scenario === "ticket") scoped.objective = "";
  return scoped;
}

function inferScenario(context = {}) {
  const explicit = String(context.scenario || context.aiScenario || "").trim();
  const objective = normalizeObjective(context.objective);
  const recipientMode = String(context.recipientMode || context.audience || "");
  const concessionCount = Number(context.concessionCount ?? context.concessions?.length ?? context.concessionIds?.length ?? 0);
  if (recipientMode === "birthday_manual") return "birthday";
  if (recipientMode === "reactivation") return "reactivation";
  if (context.coupon || context.couponId) return "coupon";
  if (concessionCount > 0) return concessionCount > 1 ? "combo" : "concession";
  if (context.plan || context.clubPlanId) return "club_plan";
  if (objective === "event") return "event";
  if (objective === "club") return "club";
  if (objective === "announcement") return "announcement";
  if (objective === "offer") return "promotion";
  if (objective === "concession") return concessionCount > 1 ? "combo" : "concession";
  if (objective === "programming") return "programming";
  if (objective === "movie") {
    if (!context.movie) return "movie";
    if (isLastChanceMovie(context.movie)) return "last_chance";
    return isUpcomingMovie(context.movie) ? "premiere" : "now_playing";
  }
  if (explicit) {
    const normalized = normalizeScenario(explicit);
    if (normalized === "movie") return context.movie ? (isUpcomingMovie(context.movie) ? "premiere" : "now_playing") : "movie";
    return normalized;
  }
  if (context.templateSelectionMode === "manual" && TEMPLATE_SCENARIOS[context.templateId]) {
    return TEMPLATE_SCENARIOS[context.templateId];
  }
  if (selectedMovieCount(context) > 1) return "programming";
  if (context.movie) return isUpcomingMovie(context.movie) ? "premiere" : "now_playing";
  return "announcement";
}

function resolveCampaignTemplate(context = {}) {
  const scopedContext = scopeCampaignContext(context);
  const objective = normalizeObjective(scopedContext.objective);
  const scenario = inferScenario(scopedContext);
  const movieCount = selectedMovieCount(scopedContext);
  const concessionCount = Number(scopedContext.concessionCount ?? scopedContext.concessions?.length ?? scopedContext.concessionIds?.length ?? 0);
  const incomplete = (["movie", "programming"].includes(scenario) && movieCount === 0) || (scenario === "concession" && concessionCount === 0);
  const compatibleTemplates = incomplete ? [] : compatibleTemplatesForScenario(scenario, { ...scopedContext, concessionCount });
  const automaticTemplate = compatibleTemplates[0] || "";
  const requestedTemplate = validTemplate(scopedContext.templateId || scopedContext.referenceTemplateId, "");
  const selectionMode = scopedContext.templateSelectionMode === "manual" ? "manual" : "automatic";
  const manualCompatible = selectionMode === "manual" && requestedTemplate && compatibleTemplates.includes(requestedTemplate);
  const templateId = incomplete ? "" : manualCompatible ? requestedTemplate : automaticTemplate;
  let reason = "Comunicação geral sem vínculo específico com catálogo.";
  if (incomplete) reason = scenario === "concession" ? "Selecione ao menos um item ativo da bomboniere." : "Selecione o conteúdo para montarmos o layout correto.";
  else if (scenario === "premiere") reason = "Selecionado porque o filme ainda está em período de estreia.";
  else if (scenario === "last_chance") reason = "Selecionado porque o catálogo marcou o filme como em últimas sessões.";
  else if (scenario === "now_playing") reason = movieCount > 1 ? "Selecionado porque vários filmes foram escolhidos." : "Selecionado porque o filme está em cartaz.";
  else if (scenario === "programming") reason = "Selecionado para apresentar a programação e as sessões disponíveis.";
  else if (scenario === "coupon") reason = "Selecionado porque há um cupom válido vinculado à campanha.";
  else if (scenario === "promotion") reason = "Selecionado para uma oferta editorial sem cupom vinculado.";
  else if (scenario === "concession") reason = "Selecionado porque um item ativo da bomboniere foi escolhido.";
  else if (scenario === "combo") reason = "Selecionado porque vários itens ativos da bomboniere foram escolhidos.";
  else if (scenario === "club_plan") reason = "Selecionado porque um plano ativo do Clube foi escolhido.";
  else if (scenario === "club") reason = "Selecionado para uma comunicação geral do Clube.";
  else if (scenario === "birthday") reason = "Selecionado porque o público foi definido como aniversariantes.";
  else if (scenario === "reactivation") reason = "Selecionado porque o público representa clientes sem compra recente.";
  else if (scenario === "event") reason = "Selecionado porque o objetivo da campanha é um evento.";
  if (selectionMode === "manual" && requestedTemplate && !manualCompatible && !incomplete) {
    reason = `O layout manual não é compatível com este conteúdo; ${automaticTemplate || "o layout adequado"} foi escolhido automaticamente.`;
  }
  return {
    objective: objective || (scenario === "programming" ? "programming" : scenario === "promotion" ? "offer" : scenario === "concession" || scenario === "combo" ? "concession" : scenario === "club_plan" || scenario === "club" ? "club" : scenario === "event" ? "event" : scenario === "movie" || ["premiere", "now_playing", "last_chance"].includes(scenario) ? "movie" : "announcement"),
    scenario,
    templateId,
    reason,
    compatibleTemplates,
    templateSelectionMode: manualCompatible ? "manual" : "automatic",
    manualTemplateId: selectionMode === "manual" ? requestedTemplate : "",
    incomplete,
    movieCount,
    concessionCount
  };
}

function isTemplateCompatibleWithScenario(scenario, templateId, context = {}) {
  return compatibleTemplatesForScenario(scenario, context).includes(String(templateId || ""));
}

module.exports = {
  OBJECTIVES,
  TEMPLATE_IDS,
  SCENARIO_COMPATIBLE_TEMPLATES,
  normalizeObjective,
  normalizeScenario,
  validTemplate,
  compatibleTemplatesForScenario,
  isTemplateCompatibleWithScenario,
  resolveCampaignTemplate,
  scopeCampaignContext,
  _test: { inferScenario, isUpcomingMovie, isLastChanceMovie, selectedMovieCount, scopeCampaignContext }
};
