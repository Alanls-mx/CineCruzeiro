const PROMPT_TEMPLATE_DEFINITIONS = Object.freeze([
  { id: "announcement", scenario: "announcement", name: "Comunicado geral", description: "Avisos institucionais sem vínculo obrigatório com catálogo ou oferta.", prompt: "Crie um comunicado claro e acolhedor do Cine Cruzeiro. Abra com o benefício ou informação principal, desenvolva somente o contexto fornecido pelo operador e encerre com uma ação simples. Use hierarquia clássica, texto curto e no máximo uma seção complementar. Não mencione filme, cupom, produto, plano, preço ou data que não estejam no briefing validado. O botão deve apontar somente para uma área compatível do site. Público validado: {{publico}}." },
  { id: "programming", scenario: "programming", name: "Programação selecionada", description: "Resumo de vários filmes e suas sessões válidas.", prompt: "Crie um e-mail de programação com leitura rápida e clima de descoberta. Destaque exclusivamente estes filmes: {{filmes}}. Use somente estas sessões válidas: {{sessoes}}. Organize a mensagem para ajudar o cliente a escolher o que assistir, sem transformar horários em texto corrido e sem incluir títulos fora da seleção. Use CTA para ver a programação e, quando sustentado pelo catálogo, um CTA secundário por intenção de ingresso. Não invente estreia, preço, sala, formato ou sessão." },
  { id: "premiere", scenario: "premiere", name: "Grande estreia", description: "Lançamento futuro ou em período de estreia confirmado.", prompt: "Crie uma campanha cinematográfica de grande estreia para {{filme}}. O título e o pôster devem ser os protagonistas, com headline curta, sensação de evento e CTA de compra antecipada ou consulta de sessões. Use somente as informações factuais do catálogo e estas sessões: {{sessoes}}. Traduza a atmosfera solicitada no briefing para cores e composição permitidas, preservando a identidade do Cine Cruzeiro. Não inclua outros filmes, bomboniere, Clube ou promoção sem vínculo validado." },
  { id: "now_playing", scenario: "now_playing", name: "Filme em cartaz", description: "Divulgação de um único filme atualmente em exibição.", prompt: "Crie um e-mail direto para o filme em cartaz {{filme}}. Mostre por que vale assistir agora, usando apenas sinopse e informações confirmadas no catálogo. Exiba somente as sessões válidas deste filme: {{sessoes}}. Dê prioridade ao pôster, a uma mensagem curta e ao CTA para escolher sessão ou comprar ingresso. Não trate o filme como futura estreia, não use urgência de últimos dias sem confirmação e não misture produtos ou planos." },
  { id: "last_chance", scenario: "last_chance", name: "Últimas sessões", description: "Urgência legítima para filme marcado como encerramento próximo.", prompt: "Crie um e-mail de últimas sessões para {{filme}} com urgência elegante e objetiva. Informe que esta é uma oportunidade final somente porque o catálogo validou esse estado. Mostre apenas estas sessões restantes: {{sessoes}}. Use headline curta, contraste visual mais intenso e CTA para garantir ingresso. Não invente data de encerramento, contagem regressiva, desconto ou escassez de lugares." },
  { id: "promotion", scenario: "promotion", name: "Promoção", description: "Oferta comercial cuja regra será validada ou criada pelo sistema.", prompt: "Crie um e-mail promocional que explique primeiro o benefício, depois as condições e por fim a ação. Preserve exatamente valor, período, elegibilidade e restrições validados. Cupom ou regra vinculada: {{cupom}}. Use uma área de destaque para a oferta e CTA explícito. Não associe filme, produto ou público que não esteja no contexto aprovado; não omita validade nem transforme condição comercial em promessa mais ampla. Público validado: {{publico}}." },
  { id: "coupon", scenario: "coupon", name: "Cupom de desconto", description: "Campanha com código de cupom ativo e elegibilidade conferida.", prompt: "Crie um e-mail centrado no cupom {{cupom}}. O código, o benefício e a validade devem ser fáceis de localizar, sem alterar números ou condições. Explique em poucas linhas como usar e para que a oferta é válida. Use card de cupom e CTA compatível com o destino comercial aprovado. Não invente cumulatividade, estoque, filme elegível ou extensão de prazo. Público validado: {{publico}}." },
  { id: "concession", scenario: "concession", name: "Produto da bomboniere", description: "Destaque de um único produto ativo e disponível.", prompt: "Crie um e-mail de bomboniere para destacar exclusivamente {{produtos}}. Use linguagem sensorial e comercial, mantendo nome, descrição e preço do catálogo sem alterações. Dê protagonismo à imagem do produto, apresente uma única proposta de consumo e use CTA para a bomboniere ou compra associada permitida. Não mencionar filmes, sessões, cupons, planos ou outros produtos não selecionados." },
  { id: "combo", scenario: "combo", name: "Seleção da bomboniere", description: "Composição com vários produtos ativos da bomboniere.", prompt: "Crie um e-mail de seleção ou combo usando somente estes itens: {{produtos}}. Explique de forma escaneável o que compõe a oferta e mantenha preços e quantidades exatamente como validados. Use composição visual conjunta, uma seção curta com os itens e CTA único para a bomboniere. Não tratar itens separados como combo oficial se o catálogo não disser isso e não adicionar filmes, sessões, cupons ou Clube." },
  { id: "club_plan", scenario: "club_plan", name: "Plano do Clube", description: "Aquisição de um plano específico e ativo.", prompt: "Crie um e-mail de aquisição para o plano {{plano}} do Clube Cine Cruzeiro. Apresente primeiro a proposta do plano, depois somente os benefícios e valores confirmados, e finalize com CTA para conhecer ou assinar. Use direção visual premium ligada à identidade do Clube e a imagem cadastrada quando disponível. Não invente economia, gratuidade, recorrência, limite ou benefício. Não divulgar outros planos, filmes ou produtos." },
  { id: "club", scenario: "club", name: "Novidade do Clube", description: "Relacionamento e novidades gerais do Clube Cine Cruzeiro.", prompt: "Crie uma comunicação de relacionamento do Clube Cine Cruzeiro sem promover um plano específico. Explique a novidade ou benefício descrito no briefing com tom próximo e valorização de pertencimento. Use visual elegante, mensagem curta e CTA para a área do Clube. Não invente plano, preço, crédito, desconto ou benefício; só mencione dados presentes no contexto validado. Público validado: {{publico}}." },
  { id: "birthday", scenario: "birthday", name: "Aniversário", description: "Mensagem destinada ao público de aniversariantes validado.", prompt: "Crie um e-mail de aniversário caloroso e pessoal para {{nome}}, usando o cinema como convite para celebrar. Mantenha o texto breve, festivo e respeitoso, com CTA para programação ou conta. Inclua benefício somente quando houver uma oferta validada no contexto. Não presumir idade, data exata, acompanhante, plano ou desconto. Público validado: {{publico}}." },
  { id: "event", scenario: "event", name: "Evento especial", description: "Convite para evento cadastrado ou descrito com dados confirmados.", prompt: "Crie um convite para o evento descrito no briefing validado. Destaque nome, proposta, data, horário, local e forma de participação somente quando esses dados existirem. Use composição de convite cinematográfico, uma seção de informações práticas e CTA para a página de eventos. Não invente atração, capacidade, preço, endereço ou disponibilidade. Público validado: {{publico}}." },
  { id: "ticket", scenario: "ticket", name: "Entrega e acesso ao ingresso", description: "Orientação transacional sobre ingresso já emitido.", prompt: "Crie um e-mail transacional de ingresso com prioridade absoluta para clareza. Confirme que o ingresso está disponível, oriente o acesso pela conta e mantenha o CTA para visualizar os ingressos. O renderizador incluirá dados, poltrona e QR quando aplicável; não repita códigos sensíveis no texto. Não adicionar promoção, filme diferente, bomboniere ou Clube e não prometer aprovação de pagamento ainda pendente." },
  { id: "reactivation", scenario: "reactivation", name: "Reativação de cliente", description: "Relacionamento com clientes realmente inativos segundo o segmento.", prompt: "Crie um e-mail de reativação para clientes que o sistema confirmou como inativos. Use tom acolhedor, sem culpa ou pressão, relembre a experiência do Cine Cruzeiro e ofereça um caminho simples para consultar a programação. Só mencione oferta se houver cupom ou regra validada. Não afirmar há quanto tempo a pessoa não compra, não expor segmentação e não inventar preferência de filme. Público validado: {{publico}}." }
]);

const TEMPLATE_BY_ID = new Map(PROMPT_TEMPLATE_DEFINITIONS.map((template) => [template.id, template]));

function normalizeCustomPrompts(settings = {}) {
  const source = settings?.emailAiPromptTemplates;
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source)
    .filter(([id, prompt]) => TEMPLATE_BY_ID.has(id) && typeof prompt === "string")
    .map(([id, prompt]) => [id, prompt.replace(/\0/g, "").trim().slice(0, 12000)])
    .filter(([, prompt]) => prompt.length >= 80));
}

function listPromptTemplates(settings = {}) {
  const custom = normalizeCustomPrompts(settings);
  return PROMPT_TEMPLATE_DEFINITIONS.map((template) => ({ ...template, prompt: custom[template.id] || template.prompt, customized: Boolean(custom[template.id]) }));
}

function resolvePromptTemplate(settings = {}, scenario = "announcement") {
  const templates = listPromptTemplates(settings);
  return templates.find((template) => template.scenario === scenario) || templates.find((template) => template.id === "announcement");
}

function updatePromptTemplate(settings = {}, id, prompt, { reset = false } = {}) {
  const template = TEMPLATE_BY_ID.get(String(id || ""));
  if (!template) throw Object.assign(new Error("Modelo de prompt não encontrado."), { statusCode: 404, code: "EMAIL_AI_PROMPT_TEMPLATE_NOT_FOUND" });
  const custom = normalizeCustomPrompts(settings);
  if (reset) delete custom[template.id];
  else {
    const normalized = String(prompt || "").replace(/\0/g, "").trim();
    if (normalized.length < 80) throw Object.assign(new Error("O modelo precisa ter pelo menos 80 caracteres."), { statusCode: 422, code: "EMAIL_AI_PROMPT_TEMPLATE_TOO_SHORT" });
    custom[template.id] = normalized.slice(0, 12000);
  }
  settings.emailAiPromptTemplates = custom;
  return listPromptTemplates(settings).find((item) => item.id === template.id);
}

function renderPromptTemplate(template, input = {}) {
  const movies = Array.isArray(input.movies) && input.movies.length ? input.movies : (input.movie ? [input.movie] : []);
  const sessions = movies.flatMap((movie) => (movie.sessions || []).map((session) => [session.date, session.time, session.format, session.language || session.audio, session.roomName || session.room].filter(Boolean).join(" · "))).slice(0, 24);
  const coupon = input.coupon ? [input.coupon.couponCode || input.coupon.title, input.coupon.value ? `${input.coupon.value}${["percent", "percentage"].includes(input.coupon.discountType) ? "%" : ""}` : "", input.coupon.endsAt ? `até ${input.coupon.endsAt}` : ""].filter(Boolean).join(" · ") : "nenhum cupom vinculado";
  const values = {
    nome: "{{nome}}",
    filme: movies[0]?.title || "filme validado",
    filmes: movies.map((movie) => movie.title).filter(Boolean).join(", ") || "filmes validados",
    sessoes: sessions.join(" | ") || "sessões apresentadas pelo renderizador",
    cupom: coupon,
    produtos: (input.concessions || []).map((item) => `${item.name}${item.price != null ? ` (${Number(item.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})` : ""}`).join(", ") || "produtos validados",
    plano: input.plan?.name || "plano validado",
    publico: String(input.recipientMode || "all")
  };
  return String(template?.prompt || "").replace(/\{\{([a-z_]+)\}\}/gi, (match, key) => Object.hasOwn(values, key.toLowerCase()) ? values[key.toLowerCase()] : match);
}

module.exports = { PROMPT_TEMPLATE_DEFINITIONS, listPromptTemplates, resolvePromptTemplate, updatePromptTemplate, renderPromptTemplate, _test: { normalizeCustomPrompts } };
