const FORMATS = Object.freeze({
  feed: "Feed vertical 4:5",
  story: "Story vertical 9:16",
  square: "Square 1:1",
  landscape: "Landscape horizontal 16:9"
});
const CAMPAIGNS = Object.freeze(["teaser", "upcoming", "premiere", "session", "programming"]);
const CAMPAIGN_NAMES = Object.freeze({ teaser: "teaser", upcoming: "em breve", premiere: "estreia", session: "sessão", programming: "programação" });
const DENSITIES = Object.freeze(["auto", "minimal", "balanced", "informative"]);
const VARIANT_IDS = Object.freeze(["recommended", "cinematic", "bold"]);
const SECTION_LABELS = Object.freeze([
  "OBJETIVO", "FORMATO", "ARTE PRINCIPAL", "COMPOSIÇÃO", "PERSONAGENS E ELEMENTOS",
  "TÍTULO", "TIPOGRAFIA", "PALETA", "INFORMAÇÕES COMERCIAIS", "CTA",
  "MARCA", "ATMOSFERA", "ACABAMENTO", "RESTRIÇÕES", "RESULTADO ESPERADO"
]);
const BRIEF_FACT_FIELDS = Object.freeze([
  "summary", "artDirection", "mood", "visualHierarchy", "artworkRole", "titleRole",
  "titleScale", "paletteDirection", "typographyDirection", "informationDensity",
  "ctaTreatment", "statusTreatment", "sessionTreatment", "backgroundTreatment",
  "premiumFinish", "composition", "rationale", "visualRestrictions"
]);

function fail(message, code = "CREATIVE_PROMPT_INVALID_INPUT", statusCode = 422) {
  throw Object.assign(new Error(message), { code, statusCode });
}

function clean(value, limit = 500) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, limit);
}

function list(value, limit = 8) {
  return Array.isArray(value) ? value.map((item) => clean(item, 180)).filter(Boolean).slice(0, limit) : [];
}

function normalizeRequest(input, movie) {
  if (!movie || !movie.id) fail("Selecione um filme válido.", "CREATIVE_PROMPT_MOVIE_REQUIRED");
  const campaignType = clean(input.campaignType, 30);
  const format = clean(input.format, 30);
  const density = clean(input.density || "auto", 30);
  const artworkSource = clean(input.artworkSource || "poster", 30);
  if (!CAMPAIGNS.includes(campaignType)) fail("Selecione um tipo de campanha válido.");
  if (!FORMATS[format]) fail("Selecione um formato válido.");
  if (!DENSITIES.includes(density)) fail("Selecione uma densidade válida.");
  if (!["poster", "backdrop", "upload"].includes(artworkSource)) fail("Selecione uma artwork válida.");
  const artworkUrl = artworkSource === "poster" ? movie.posterUrl
    : artworkSource === "backdrop" ? movie.backdropUrl : clean(input.artworkUrl, 1000);
  if (!artworkUrl) fail("Este filme não tem a artwork selecionada. Envie uma imagem ou escolha outra opção.", "CREATIVE_PROMPT_ARTWORK_REQUIRED");
  const referenceUrl = clean(input.referenceUrl, 1000);
  const sessionId = clean(input.sessionId, 100);
  const session = (movie.sessions || []).find((item) => item.id === sessionId);
  if (campaignType === "session" && !session) fail("Escolha uma sessão cadastrada para a campanha de sessão.", "CREATIVE_PROMPT_SESSION_REQUIRED");
  if (campaignType === "programming" && !(movie.sessions || []).length) fail("Cadastre sessões antes de criar uma campanha de programação.", "CREATIVE_PROMPT_PROGRAMMING_EMPTY");
  const campaignInfo = {
    message: clean(input.message, 600),
    cta: clean(input.cta, 90),
    tagline: clean(input.tagline, 120),
    sessionId,
    siteUrl: clean(input.siteUrl, 180),
    visualNote: clean(input.visualNote, 600)
  };
  return { movieId: movie.id, campaignType, format, density, artworkSource, artworkUrl,
    referenceUrl, campaignInfo, bias: clean(input.bias, 30) };
}

function normalizeAnalysis(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("A IA não conseguiu analisar a artwork.", "CREATIVE_PROMPT_ANALYSIS_INVALID", 502);
  const lockup = raw.titleLockup || {};
  const strength = ["strong", "usable", "weak", "not_detected"].includes(lockup.strength) ? lockup.strength : "not_detected";
  const analysis = {
    peopleCount: Number.isInteger(raw.peopleCount) && raw.peopleCount >= 0 ? raw.peopleCount : null,
    mainSubject: clean(raw.mainSubject, 250),
    subjectPositions: list(raw.subjectPositions),
    gazeDirection: clean(raw.gazeDirection, 180),
    negativeSpace: list(raw.negativeSpace),
    focalPoint: clean(raw.focalPoint, 180),
    depth: clean(raw.depth, 180), environment: clean(raw.environment, 240),
    lighting: clean(raw.lighting, 220), contrast: clean(raw.contrast, 160),
    dominantColors: list(raw.dominantColors, 6), characteristicColors: list(raw.characteristicColors, 6),
    temperature: clean(raw.temperature, 140), atmosphere: clean(raw.atmosphere, 240),
    perceivedGenre: clean(raw.perceivedGenre, 160), safeTextAreas: list(raw.safeTextAreas),
    avoidTextAreas: list(raw.avoidTextAreas),
    titleLockup: { strength, evidence: clean(lockup.evidence, 240), location: clean(lockup.location, 150) },
    confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0))
  };
  if (!analysis.focalPoint || !analysis.dominantColors.length) {
    fail("A análise visual veio incompleta. Tente outra artwork.", "CREATIVE_PROMPT_ANALYSIS_INCOMPLETE", 502);
  }
  return analysis;
}

function normalizeReference(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("A referência visual não pôde ser analisada.", "CREATIVE_PROMPT_REFERENCE_INVALID", 502);
  return {
    composition: clean(raw.composition, 260), titlePosition: clean(raw.titlePosition, 180),
    photoTextRatio: clean(raw.photoTextRatio, 160), typography: clean(raw.typography, 220),
    density: clean(raw.density, 160), palette: list(raw.palette, 6),
    atmosphere: clean(raw.atmosphere, 240), treatments: list(raw.treatments, 8),
    finish: clean(raw.finish, 220)
  };
}

const VARIANT_FIELDS = ["summary", "artDirection", "mood", "visualHierarchy", "artworkRole", "titleRole",
  "titleScale", "paletteDirection", "typographyDirection", "informationDensity", "ctaTreatment",
  "statusTreatment", "sessionTreatment", "backgroundTreatment", "premiumFinish", "composition", "rationale"];

function normalizeVariants(raw, analysis) {
  const supplied = Array.isArray(raw?.variants) ? raw.variants : [];
  const variants = VARIANT_IDS.map((id) => {
    const item = supplied.find((candidate) => candidate?.id === id);
    if (!item) fail("A IA não retornou as três direções criativas esperadas.", "CREATIVE_PROMPT_DIRECTIONS_INVALID", 502);
    const normalized = { id };
    for (const field of VARIANT_FIELDS) normalized[field] = clean(item[field], field === "summary" ? 260 : 500);
    normalized.visualRestrictions = list(item.visualRestrictions, 10);
    normalized.recommendedDensity = ["minimal", "balanced", "informative"].includes(item.recommendedDensity)
      ? item.recommendedDensity : "balanced";
    const requestedMode = clean(item.titleMode, 20).toLowerCase();
    const strong = analysis.titleLockup.strength === "strong";
    normalized.titleMode = strong
      ? (requestedMode === "hybrid" ? "hybrid" : "preserve")
      : analysis.titleLockup.strength === "not_detected" ? "recompose"
        : ["preserve", "recompose", "hybrid"].includes(requestedMode) ? requestedMode : "recompose";
    if (!normalized.artDirection || !normalized.composition || !normalized.paletteDirection || !normalized.typographyDirection || !normalized.visualHierarchy) {
      fail("Uma direção criativa veio incompleta. Gere novamente.", "CREATIVE_PROMPT_DIRECTIONS_INCOMPLETE", 502);
    }
    return normalized;
  });
  return variants;
}

function formatDate(date) {
  const match = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function sessionText(session) {
  const date = formatDate(session?.date);
  const time = /^\d{2}:\d{2}$/.test(String(session?.time || "")) ? session.time : "";
  return [date, time].filter(Boolean).join(" às ");
}

function curateContent(movie, request, variant) {
  const info = request.campaignInfo;
  const suggestedDensity = ["minimal", "balanced", "informative"].includes(variant?.recommendedDensity)
    ? variant.recommendedDensity : "balanced";
  const density = request.density === "auto"
    ? request.campaignType === "teaser" ? "minimal"
      : request.campaignType === "programming" ? "informative"
        : request.campaignType === "session" && suggestedDensity === "minimal" ? "balanced"
          : suggestedDensity
    : request.density;
  const sessions = (movie.sessions || []).filter((item) => sessionText(item));
  const chosen = sessions.find((item) => item.id === info.sessionId);
  const program = request.campaignType === "programming" ? sessions.slice(0, 6).map(sessionText) : [];
  const schedule = request.campaignType === "session" ? sessionText(chosen) : "";
  if (request.campaignType === "session" && !schedule) fail("A sessão precisa ter data e horário válidos.", "CREATIVE_PROMPT_SESSION_INVALID");
  if (request.campaignType === "programming" && !program.length) fail("A programação precisa de sessões com data e horário válidos.", "CREATIVE_PROMPT_PROGRAMMING_INVALID");
  const status = {
    teaser: "", upcoming: "Em breve", premiere: "Estreia", session: "", programming: "Programação"
  }[request.campaignType];
  const defaultCta = request.campaignType === "session" || request.campaignType === "programming" ? "Escolha sua sessão" : "";
  const cta = info.cta || defaultCta;
  return {
    density,
    primary: clean(movie.title, 180),
    secondary: { status, releaseDate: density !== "minimal" && request.campaignType === "premiere" ? formatDate(movie.releaseDate) : "", schedule, programming: program },
    action: cta,
    brand: { name: clean(movie.cinemaName || "Cine Cruzeiro", 100), siteUrl: info.siteUrl },
    optional: {
      tagline: density === "minimal" ? "" : info.tagline,
      rating: density === "informative" ? clean(movie.rating, 30) : "",
      duration: density === "informative" ? clean(movie.duration, 40) : "",
      originalTitle: ""
    },
    userMessage: info.message,
    sourceText: { title: clean(movie.title, 180), status, cta, schedule, program }
  };
}

function makeBrief(variant, analysis, reference, curated, request) {
  return {
    ...variant,
    titleMode: variant.titleMode,
    density: curated.density,
    format: request.format,
    artworkObservations: {
      focalPoint: analysis.focalPoint, subjectPositions: analysis.subjectPositions,
      gazeDirection: analysis.gazeDirection, safeTextAreas: analysis.safeTextAreas,
      avoidTextAreas: analysis.avoidTextAreas, dominantColors: analysis.dominantColors,
      characteristicColors: analysis.characteristicColors, lighting: analysis.lighting,
      environment: analysis.environment, titleLockup: analysis.titleLockup
    },
    referenceLanguage: reference || null,
    curatedContent: curated
  };
}

function readable(value, fallback = "não identificado com segurança") {
  if (Array.isArray(value)) return value.length ? value.join("; ") : fallback;
  return clean(value, 800) || fallback;
}

function formatGuidance(format) {
  return {
    feed: "Vertical editorial: garantir leitura no feed e uma hierarquia que sobreviva à miniatura; manter margens de segurança para recortes de interface.",
    story: "Vertical imersivo: preservar rostos e título fora das áreas cobertas pela interface superior e inferior do Story; distribuir leitura ao longo do eixo vertical.",
    square: "Quadrado compacto: concentrar foco e título sem comprimir personagens; evitar informação lateral periférica.",
    landscape: "Horizontal panorâmico: explorar profundidade e direção do olhar; agrupar textos em áreas seguras sem reduzir demais a escala da arte."
  }[format];
}

function compilePrompt({ movie, request, analysis, reference, brief, curated }) {
  const lockup = analysis.titleLockup;
  const titleText = brief.titleMode === "preserve" || brief.titleMode === "hybrid"
    ? `O título exato é “${curated.primary}”. Há indício ${lockup.strength === "strong" ? "forte" : "utilizável"} de title lockup na arte (${readable(lockup.location)}; ${readable(lockup.evidence)}). Preserve o title lockup oficial, sua tipografia, proporção, textura e efeitos originais como parte da imagem; não tente redesenhar o logotipo do filme. Se não for possível isolá-lo sem perda, componha ao redor do título já incorporado, sem duplicá-lo.`
    : `O título exato é “${curated.primary}”. Recompose-o como principal elemento gráfico, com escala ${readable(brief.titleScale)}, personalidade ${readable(brief.titleRole)} e posicionamento na área segura descrita; não acrescente palavras nem altere a grafia.`;
  const sessionLines = curated.secondary.programming.length ? curated.secondary.programming.map((line) => `• ${line}`).join("\n") : "";
  const textPlacement = analysis.safeTextAreas.length
    ? `Usar as áreas de espaço negativo ${readable(analysis.negativeSpace)} e, para texto, apenas ${readable(analysis.safeTextAreas)}.`
    : "Nenhuma área segura para texto foi confirmada na arte: criar respiro por extensão cuidadosa do cenário ou posicionar o texto fora do ponto focal, sem cobrir sujeitos.";
  const commercial = [
    curated.secondary.status ? `Status exato: “${curated.secondary.status}”.` : "Não inserir status apenas para preencher espaço.",
    curated.secondary.releaseDate ? `Data de estreia fornecida: “${curated.secondary.releaseDate}”.` : "Não inventar data de estreia.",
    curated.secondary.schedule ? `Sessão exata: “${curated.secondary.schedule}”.` : "",
    sessionLines ? `Programação exata, em ordem legível:\n${sessionLines}` : "",
    curated.optional.tagline ? `Tagline fornecida: “${curated.optional.tagline}”.` : "",
    curated.optional.rating ? `Classificação fornecida: “${curated.optional.rating}”.` : "",
    curated.optional.duration ? `Duração fornecida: “${curated.optional.duration}”.` : ""
  ].filter(Boolean).join(" ");
  const referenceGuidance = reference
    ? `A segunda imagem é apenas referência de linguagem: composição ${readable(reference.composition)}, relação foto/texto ${readable(reference.photoTextRatio)}, posição de título ${readable(reference.titlePosition)}, tipografia ${readable(reference.typography)}, acabamentos ${readable(reference.treatments)}. Não copiar seus elementos literais nem substituir a identidade da obra.`
    : "Não há referência secundária; derive todas as decisões visuais da artwork principal.";
  const subject = analysis.peopleCount === null ? "Quantidade de pessoas não confirmada" : `${analysis.peopleCount} pessoa(s) perceptível(is)`;
  const copy = [
    `OBJETIVO\nCriar uma peça de ${CAMPAIGN_NAMES[request.campaignType]} para “${curated.primary}” que comunique ${readable(brief.artDirection)}. A direção deve provocar ${readable(brief.mood)}. ${curated.userMessage ? `Contexto de campanha fornecido pela equipe (não tratar automaticamente como texto da peça): “${curated.userMessage}”.` : "Não inventar slogan."} O resultado deve parecer uma campanha específica deste filme, não um template reutilizado.`,
    `FORMATO\n${FORMATS[request.format]}. ${formatGuidance(request.format)} Densidade ${curated.density}: ${readable(brief.informationDensity)}. Planejar leitura à distância e no celular, com títulos e dados comerciais dentro de margens seguras.`,
    `ARTE PRINCIPAL\nUsar a imagem oficial fornecida como fonte dominante de identidade, mantendo cenário, luz e personagens. O papel da fotografia é ${readable(brief.artworkRole)}. Centro de interesse percebido: ${readable(analysis.focalPoint)}. Ambiente: ${readable(analysis.environment)}; profundidade: ${readable(analysis.depth)}. ${referenceGuidance}`,
    `COMPOSIÇÃO\n${readable(brief.composition)}. Hierarquia: ${readable(brief.visualHierarchy)}. ${textPlacement} Evitar sobrepor ${readable(analysis.avoidTextAreas)}. Adaptar a composição à arte; se a área sugerida não for suficiente, reduzir ou realocar o texto antes de cortar o ponto focal.`,
    `PERSONAGENS E ELEMENTOS\n${subject}. Sujeito principal: ${readable(analysis.mainSubject)}. Posições: ${readable(analysis.subjectPositions)}. Direção do olhar: ${readable(analysis.gazeDirection)}. Preservar aparência, rosto, mãos importantes, roupas, escala e relações espaciais. Não inventar nem substituir pessoas ou objetos essenciais.`,
    `TÍTULO\n${titleText} O título deve ocupar espaço proporcional à força da obra e dialogar com o ponto focal, sem abafá-lo.`,
    `TIPOGRAFIA\n${readable(brief.typographyDirection)}. Se o lockup for preservado, reservar esta voz tipográfica somente às informações auxiliares. Estabelecer contraste de peso e tamanho entre título, sessão, CTA e assinatura, sem criar competição visual.`,
    `PALETA\nCores observadas na artwork: ${readable(analysis.dominantColors)}. Acentos característicos: ${readable(analysis.characteristicColors)}. Direção cromática: ${readable(brief.paletteDirection)}. Temperatura ${readable(analysis.temperature)} e iluminação ${readable(analysis.lighting)}. A marca entra como assinatura; não neutralizar as cores próprias do filme.`,
    `INFORMAÇÕES COMERCIAIS\n${commercial} Tratamento do status: ${readable(brief.statusTreatment)}. Tratamento de sessões: ${readable(brief.sessionTreatment)}. Mostrar apenas os textos fornecidos acima; se faltarem dados, omitir o campo, jamais preencher com informação criada.`,
    `CTA\n${curated.action ? `Usar o texto exato “${curated.action}”. Tratamento: ${readable(brief.ctaTreatment)}. Deve convidar à ação sem parecer um botão genérico de aplicativo.` : "Não incluir CTA nesta peça; a imagem e o título conduzem a comunicação."}`,
    `MARCA\nAplicar a assinatura oficial “${curated.brand.name}” como asset fornecido, pequena mas legível, sem recriar ou redesenhar o logotipo. ${curated.brand.siteUrl ? `Se houver espaço real, incluir o site exato “${curated.brand.siteUrl}”.` : "Não inventar URL, redes sociais ou parceiros."} A assinatura não deve corrigir a paleta do filme.`,
    `ATMOSFERA\nA sensação observada é ${readable(analysis.atmosphere)} e a linguagem percebida é ${readable(analysis.perceivedGenre)}. Fundo: ${readable(brief.backgroundTreatment)}. ${request.campaignInfo.visualNote ? `Orientação visual adicional da equipe: “${request.campaignInfo.visualNote}”.` : ""} Construir transições e profundidade a partir da fotografia; usar sombra ou gradiente apenas onde melhorarem a legibilidade.`,
    `ACABAMENTO\n${readable(brief.premiumFinish)}. Ajustar grão, vinheta, haze, glow, textura ou fade somente se forem coerentes com a luz da imagem. Evitar efeitos empilhados que escondam personagens, rostos ou o title lockup.`,
    `RESTRIÇÕES\nNão alterar rostos, mãos, proporções, figurino ou cenário essencial. Não inventar personagens, datas, preços, horários, textos, títulos ou logos. Não recriar a assinatura do cinema. ${brief.titleMode !== "recompose" ? "Não substituir nem redesenhar o title lockup original." : "Não fingir que existe um title lockup extraído."} Não converter fotografia em ilustração sem pedido explícito. Não criar visual de template genérico, excesso de faixas, caixas ou pills. Manter leitura. Restrições adicionais: ${readable(brief.visualRestrictions)}.`,
    `RESULTADO ESPERADO\nUma peça ${FORMATS[request.format]} de caráter ${readable(brief.artDirection)}, com arte dominante, hierarquia inequívoca e acabamento de campanha cinematográfica premium. O espectador deve reconhecer imediatamente o filme e compreender somente a informação comercial relevante, sem colisões entre texto e ponto focal.`
  ].join("\n\n");
  return copy;
}

function unverifiedCommercialField(value, curated) {
  const supplied = [curated.sourceText.schedule, ...curated.sourceText.program,
    curated.secondary.releaseDate, curated.userMessage, curated.optional.tagline,
    curated.action, curated.brand.siteUrl].filter(Boolean).join(" ");
  const content = Array.isArray(value) ? value.join(" ") : String(value || "");
  return [...content.matchAll(/R\$\s*[\d.,]+|https?:\/\/\S+|www\.\S+|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{1,2}:\d{2}\b/gi)]
    .some(([fact]) => !supplied.includes(fact));
}

function qaPrompt(prompt, { request, curated, brief }) {
  const errors = [];
  for (const label of SECTION_LABELS) if (!prompt.includes(`${label}\n`)) errors.push(`missing:${label}`);
  if (!prompt.includes(FORMATS[request.format])) errors.push("format");
  if (!prompt.includes(curated.primary)) errors.push("title");
  if (curated.action && !prompt.includes(curated.action)) errors.push("cta");
  if (curated.secondary.schedule && !prompt.includes(curated.secondary.schedule)) errors.push("session");
  for (const line of curated.secondary.programming) if (!prompt.includes(line)) errors.push("programming");
  if (brief.titleMode !== "recompose" && !prompt.includes("lockup")) errors.push("lockup");
  if (brief.titleMode !== "recompose" && /\b(?:redesenhar|recriar|substituir)\b/i.test([
    brief.composition, brief.titleRole, brief.titleScale, brief.typographyDirection
  ].join(" "))) errors.push("title-contradiction");
  if (BRIEF_FACT_FIELDS.some((field) => unverifiedCommercialField(brief[field], curated))) errors.push("unverified-commercial");
  if (prompt.length < 2500) errors.push("detail");
  if (/\b(?:dd\/mm|www\.exemplo)/i.test(prompt)) errors.push("placeholder");
  return { ok: errors.length === 0, errors };
}

function compileWithQa(context) {
  let prompt = compilePrompt(context);
  let qa = qaPrompt(prompt, context);
  let brief = context.brief;
  if (!qa.ok) {
    brief = { ...brief };
    if (qa.errors.includes("title-contradiction")) {
      brief.composition = "Compor ao redor do title lockup original e do ponto focal, mantendo seu desenho intacto";
      brief.titleRole = "assinatura gráfica oficial preservada";
      brief.titleScale = "escala existente na artwork, com espaço de respiro";
      brief.typographyDirection = "tipografia auxiliar discreta, subordinada ao lockup oficial";
    }
    if (qa.errors.includes("unverified-commercial")) {
      for (const field of BRIEF_FACT_FIELDS) {
        if (!unverifiedCommercialField(brief[field], context.curated)) continue;
        brief[field] = field === "visualRestrictions" ? ["Usar somente dados comerciais fornecidos"]
          : field === "paletteDirection" ? `Derivar a paleta de ${readable(context.analysis.dominantColors)}`
            : `Fundamentar a direção na artwork e em ${readable(context.analysis.atmosphere)}`;
      }
    }
    prompt = compilePrompt({ ...context, brief });
    qa = qaPrompt(prompt, { ...context, brief });
  }
  if (!qa.ok) fail("O prompt não passou pela revisão de conteúdo. Revise os dados e tente novamente.", "CREATIVE_PROMPT_QA_FAILED", 502);
  return { prompt, qa, brief };
}

module.exports = { FORMATS, CAMPAIGNS, DENSITIES, VARIANT_IDS, SECTION_LABELS, normalizeRequest,
  normalizeAnalysis, normalizeReference, normalizeVariants, curateContent, makeBrief, compilePrompt, qaPrompt, compileWithQa };
