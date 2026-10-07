const MAX_QUEUE_SIZE = 200;
const MAX_EMBEDS_PER_MESSAGE = 5;
const SEND_TIMEOUT_MS = 5000;
const RETRY_LIMIT = 2;
const EVENT_FIELD_ALLOWLIST = new Set([
  "status", "statusCode", "code", "reason", "rule", "attackType", "method", "path",
  "durationMs", "count", "threshold", "windowSeconds", "cpuPercent", "httpStatus",
  "message", "cause", "errorType", "errorCode", "version", "commit", "release", "previousRelease",
  "outageType", "healthStatus", "failureStage", "summary", "outageDurationSeconds", "currentVersion", "currentCommit",
  "attemptedVersion", "attemptedCommit", "previousVersion", "lastHeartbeatAt", "diagnosis", "pid", "signal"
]);

const LEVEL_LABELS = { error: "ERRO", warn: "AVISO", info: "INFORMAÇÃO", debug: "DEPURAÇÃO" };
const EVENT_LABELS = {
  "http.request.completed": "Requisição HTTP concluída",
  "request.failed": "Falha ao processar requisição",
  "security.suspicious_request": "Padrão suspeito detectado",
  "performance.anomaly": "Desempenho degradado",
  "performance.recovered": "Desempenho normalizado",
  "discord.delivery_failed": "Falha ao entregar alerta ao Discord",
  "crm_webhook.queued": "Evento colocado na fila do CRM",
  "crm_webhook.delivered": "Evento entregue ao CRM",
  "crm_webhook.retry_scheduled": "Nova tentativa do CRM agendada",
  "crm_webhook.dead_letter": "Entrega ao CRM esgotou as tentativas",
  "payment.created": "Pagamento criado",
  "payment.reconciled": "Pagamento conciliado",
  "payment.reconciliation_reference_mismatch": "Referência do pagamento divergente",
  "payment.reconciliation_amount_mismatch": "Valor do pagamento divergente",
  "order.refund_pending": "Estorno de pedido pendente",
  "order.refunded": "Pedido estornado",
  "ticket.used": "Ingresso validado na entrada",
  "ticket_email.failed": "Falha no envio do ingresso por e-mail",
  "box_office_ticket_print.failed": "Falha ao imprimir ingresso na bilheteria",
  "webhook.processed": "Webhook processado",
  "webhook.mercado_pago.rejected": "Webhook do Mercado Pago rejeitado",
  "google_wallet.integration_failed": "Falha na integração com Google Wallet",
  "email_campaign.attachment_pruned": "Anexo antigo de campanha removido",
  "system_log.persist_failed": "Falha ao salvar log de operação",
  "deployment.completed": "Nova versão publicada",
  "deployment.failed": "Falha ao publicar versão",
  "deployment.rollback_completed": "Versão anterior restaurada",
  "service.outage.detected": "Indisponibilidade detectada",
  "service.outage.recovered": "Serviço restabelecido após reinício inesperado",
  "service.outage.recovery_failed": "Serviço continua indisponível após rollback",
  "service.runtime.started": "Backend iniciado",
  "service.runtime.stopped": "Backend encerrado normalmente"
};

const DOMAIN_LABELS = {
  abuse: "Proteção contra abuso", admin: "Painel administrativo", admin_two_factor: "Autenticação em duas etapas",
  box_office: "Bilheteria", club: "Clube", concession: "Bomboniere", crm_webhook: "Webhook CRM",
  database: "Banco de dados", deployment: "Publicação do sistema", discord: "Integração Discord", email: "E-mail", email_campaign: "Campanha de e-mail",
  email_verification: "Verificação de e-mail", google_wallet: "Google Wallet", http: "API", integrations: "Integrações",
  movie: "Filmes", order: "Pedidos", password_reset: "Redefinição de senha", payment: "Pagamentos",
  performance: "Desempenho", repository: "Persistência de dados", security: "Segurança", service: "Disponibilidade do sistema", session: "Sessões",
  subscription: "Assinaturas", system: "Sistema", ticket: "Ingressos", ticket_email: "E-mail de ingressos",
  webhook: "Webhooks"
};

const WORD_TRANSLATIONS = {
  action_required: "requer atenção", anomaly: "desvio detectado", applied: "aplicada", background: "em segundo plano",
  cancelled: "cancelado", canceled: "cancelado", completed: "concluída", created: "criado", delivery: "entrega",
  failed: "falhou", failure: "falha", missing: "ausente", not_found: "não encontrado", pending: "pendente",
  persisted: "salvo", processed: "processado", queued: "na fila", recovered: "normalizado", rejected: "rejeitado",
  released: "liberado", removed: "removido", request: "requisição", retry: "nova tentativa", scheduled: "agendada",
  suspicious: "suspeito", updated: "atualizado", used: "utilizado", mismatch: "divergente", timeout: "tempo esgotado"
};

const FIELD_LABELS = {
  status: "Estado", statusCode: "Código HTTP", httpStatus: "HTTP da integração", code: "Código técnico",
  errorCode: "Código da causa", errorType: "Tipo de erro", reason: "Motivo", rule: "Regra detectada",
  attackType: "Tipo de atividade suspeita", method: "Método", path: "Rota", durationMs: "Duração",
  count: "Ocorrências", threshold: "Limite", windowSeconds: "Janela", cpuPercent: "Uso de CPU",
  message: "Causa / detalhe", cause: "Causa raiz", version: "Versão", commit: "Commit",
  release: "Release atual", previousRelease: "Release anterior", outageType: "Tipo de queda",
  healthStatus: "HTTP da checagem", failureStage: "Etapa da falha", summary: "Alterações do commit",
  outageDurationSeconds: "Indisponibilidade estimada (s)", currentVersion: "Versão atual", currentCommit: "Commit atual",
  attemptedVersion: "Versão tentada", attemptedCommit: "Commit tentado", previousVersion: "Versão anterior",
  lastHeartbeatAt: "Último sinal do processo", diagnosis: "Como investigar", pid: "PID do processo", signal: "Sinal de encerramento"
};

const DEPLOYMENT_STAGE_LABELS = {
  prepare_release: "preparação da release",
  release_build: "montagem da release",
  backup_and_migration: "backup ou migração do banco",
  release_activation: "ativação da nova versão",
  health_check: "checagem de disponibilidade",
  completed: "concluída"
};
const OUTAGE_TYPE_LABELS = {
  readiness_dependency_unavailable: "dependência necessária indisponível",
  http_server_error: "erro HTTP interno do servidor",
  health_check_unreachable: "servidor não respondeu à checagem",
  release_activation_failed: "falha ao ativar a release",
  rollback_health_check_failed: "checagem falhou após o rollback",
  process_exit_without_shutdown: "processo encerrou sem parada normal"
};
function diagnosticLabel(value, labels) {
  const key = String(value || "");
  return labels[key] || key.replace(/[_-]+/g, " ") || "não identificado";
}

const HTTP_STATUS_LABELS = {
  200: "sucesso", 201: "criado", 202: "aceito para processamento", 204: "sucesso sem conteúdo",
  301: "redirecionamento permanente", 302: "redirecionamento temporário", 304: "sem alteração",
  400: "requisição inválida ou incompleta", 401: "autenticação ausente ou inválida", 403: "acesso não autorizado",
  404: "rota ou recurso não encontrado", 408: "tempo limite da requisição esgotado", 409: "conflito com o estado atual",
  410: "recurso removido", 413: "conteúdo acima do limite permitido", 415: "formato não suportado",
  422: "dados rejeitados pela validação", 429: "limite de requisições atingido", 500: "falha interna do servidor",
  502: "resposta inválida de um serviço integrado", 503: "serviço temporariamente indisponível", 504: "serviço integrado excedeu o tempo limite"
};

const ERROR_CODE_LABELS = {
  ECONNREFUSED: "conexão recusada pelo serviço de destino", ECONNRESET: "conexão encerrada antes da resposta",
  ETIMEDOUT: "tempo limite de conexão excedido", ENOTFOUND: "endereço do serviço não encontrado",
  ENOSPC: "disco sem espaço disponível", EACCES: "permissão insuficiente no sistema de arquivos",
  REQUEST_ERROR: "falha durante o processamento da requisição", MODULE_REMOVED: "módulo desativado nesta instalação",
  23505: "registro duplicado no banco de dados", 23503: "referência relacionada não encontrada no banco de dados",
  23502: "campo obrigatório ausente no banco de dados", "42P01": "tabela não encontrada no banco de dados",
  "42601": "comando SQL inválido"
};

const ROUTE_AREAS = [
  [/^\/api\/health/, "Disponibilidade e saúde da API"],
  [/^\/api\/admin\/me(?:\/|$)/, "Painel administrativo · sessão e permissões"],
  [/^\/api\/admin\/payments?(?:\/|$)/, "Painel administrativo · pagamentos"],
  [/^\/api\/admin\/orders?(?:\/|$)/, "Painel administrativo · pedidos"],
  [/^\/api\/admin\/movies?(?:\/|$)|^\/api\/movies(?:\/|$)/, "Catálogo de filmes"],
  [/^\/api\/admin\/sessions?(?:\/|$)|^\/api\/sessions(?:\/|$)/, "Programação e sessões"],
  [/^\/api\/admin\/users?(?:\/|$)/, "Painel administrativo · clientes e usuários"],
  [/^\/api\/admin\/integrations?(?:\/|$)|^\/api\/integrations(?:\/|$)/, "Painel administrativo · integrações"],
  [/^\/api\/admin\/email(?:\/|$)/, "Painel administrativo · campanhas de e-mail"],
  [/^\/api\/admin\/dashboard(?:\/|$)/, "Painel administrativo · indicadores"],
  [/^\/api\/admin\/logs(?:\/|$)/, "Painel administrativo · logs"],
  [/^\/api\/admin\/login(?:\/|$)/, "Painel administrativo · autenticação"],
  [/^\/api\/admin(?:\/|$)/, "Painel administrativo"],
  [/^\/api\/webhooks?(?:\/|$)/, "Recebimento de webhooks"],
  [/^\/api\/orders?(?:\/|$)/, "Pedidos do site"],
  [/^\/api\/checkout(?:\/|$)/, "Checkout e pagamento"],
  [/^\/api\/box-office(?:\/|$)/, "Bilheteria"],
  [/^\/api\/(?:club|subscriptions)(?:\/|$)/, "Clube e assinaturas"],
  [/^\/api\/(?:concessions|snacks)(?:\/|$)/, "Bomboniere"],
  [/^\/api\//, "API do site"],
  [/^\/(?:admin|images|uploads|trailers)(?:\/|$)/, "Site e conteúdo público"]
];

function validateDiscordWebhookUrl(input) {
  let url;
  try {
    url = new URL(String(input || "").trim());
  } catch {
    return false;
  }
  return url.protocol === "https:"
    && url.hostname === "discord.com"
    && !url.port
    && !url.username
    && !url.password
    && !url.search
    && !url.hash
    && /^\/api\/webhooks\/\d{15,22}\/[A-Za-z0-9._-]{20,}$/.test(url.pathname);
}

function cleanText(value, limit = 180) {
  return String(value ?? "")
    .replace(/@/g, "＠")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[<>]/g, "")
    .slice(0, limit);
}

function cleanPath(value) {
  const segments = String(value ?? "").split("?")[0].split("/").map((segment) => {
    if (!segment) return "";
    if (segment.length > 64 || /@|%40|%27|'|%22|"|;|%3b|--|union|select|sleep|benchmark|\b1%?=1\b/i.test(segment)) return ":redacted";
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) || /^\d{3,}$/.test(segment)) return ":id";
    return segment;
  });
  return cleanText(segments.join("/"), 220);
}

function cleanDiagnosticText(value, limit = 500) {
  return cleanText(value, 1400)
    .replace(/\b(?:postgres|postgresql):\/\/\S+/gi, "[conexão do banco ocultada]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [credencial ocultada]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Z]{2,}/gi, "[e-mail ocultado]")
    .replace(/\b(password|senha|token|secret|api[_ -]?key|authorization)\s*[:=]\s*\S+/gi, "$1=[ocultado]")
    .slice(0, limit);
}

function humanizeEvent(event = "system.event") {
  const code = String(event);
  if (EVENT_LABELS[code]) return EVENT_LABELS[code];
  const words = code.toLowerCase().split(/[._-]+/).filter(Boolean);
  const translated = words.map((word) => WORD_TRANSLATIONS[word] || word);
  if (DOMAIN_LABELS[words[0]]) translated[0] = DOMAIN_LABELS[words[0]];
  return translated.map((word, index) => index ? word : word.charAt(0).toUpperCase() + word.slice(1)).join(" · ");
}

function describeRoute(path) {
  const route = cleanPath(path);
  return ROUTE_AREAS.find(([pattern]) => pattern.test(route))?.[1] || "Recurso do Cine Cruzeiro";
}

function statusDescription(status) {
  return HTTP_STATUS_LABELS[Number(status)] || "resposta HTTP";
}

function errorTypeDescription(type) {
  const labels = {
    TypeError: "Erro de tipo: um valor ou formato inesperado foi recebido",
    SyntaxError: "Erro de sintaxe: os dados recebidos não puderam ser interpretados",
    AbortError: "A operação foi interrompida por tempo limite ou cancelamento",
    TimeoutError: "O serviço não respondeu dentro do tempo permitido",
    DatabaseError: "Erro durante uma operação no banco de dados",
    Error: "Erro durante o processamento"
  };
  return labels[String(type)] || "Falha durante o processamento";
}

function fieldValue(key, value) {
  if (key === "failureStage") return diagnosticLabel(value, DEPLOYMENT_STAGE_LABELS);
  if (key === "outageType") return diagnosticLabel(value, OUTAGE_TYPE_LABELS);
  if (key === "path") return cleanPath(value) || "Rota não informada";
  if (key === "method") {
    const method = String(value).toUpperCase();
    const meanings = { GET: "consulta", POST: "envio/criação", PUT: "substituição", PATCH: "atualização", DELETE: "remoção" };
    return `${method}${meanings[method] ? ` · ${meanings[method]}` : ""}`;
  }
  if (key === "statusCode" || key === "status" || key === "httpStatus") {
    const number = Number(value);
    return Number.isFinite(number) ? `${number} · ${statusDescription(number)}` : cleanDiagnosticText(value, 160);
  }
  if (key === "durationMs") return `${cleanDiagnosticText(value, 30)} ms`;
  if (key === "outageDurationSeconds") return `${cleanDiagnosticText(value, 30)} s`;
  if (key === "errorType") return `${cleanDiagnosticText(value, 100)} · ${errorTypeDescription(value)}`;
  if (key === "errorCode" || key === "code") {
    const code = String(value);
    return `${cleanDiagnosticText(code, 100)}${ERROR_CODE_LABELS[code] ? ` · ${ERROR_CODE_LABELS[code]}` : ""}`;
  }
  if (key === "attackType" && value === "possible_sql_injection") return "Possível tentativa de injeção SQL";
  if (key === "rule" && value === "sqli.union_select") return "Tentativa de combinar resultados SQL detectada (sqli.union_select; conteúdo sensível ocultado)";
  return cleanDiagnosticText(value, 400);
}

function eventDescription(event, level, payload) {
  const method = String(payload.method || "").toUpperCase();
  const path = payload.path ? cleanPath(payload.path) : "";
  const area = path ? describeRoute(path) : "";
  const status = Number(payload.statusCode ?? payload.status);
  let summary;
  if (event === "http.request.completed") {
    const action = { GET: "Consulta", POST: "Envio/criação", PUT: "Substituição", PATCH: "Atualização", DELETE: "Remoção" }[method] || `Requisição ${method || "HTTP"}`;
    summary = Number.isFinite(status)
      ? `${action} ${area ? `em ${area} ` : ""}respondeu HTTP ${status} (${statusDescription(status)}).`
      : `${action} ${area ? `em ${area} ` : ""}foi concluída.`;
    if (payload.durationMs != null) summary += ` Tempo: ${payload.durationMs} ms.`;
    if (status >= 400 && payload.message) summary += ` Detalhe: ${cleanDiagnosticText(payload.message, 350)}.`;
  } else if (event === "request.failed") {
    summary = `A requisição${area ? ` em ${area}` : ""} falhou${Number.isFinite(status) ? ` com HTTP ${status} (${statusDescription(status)})` : ""}.`;
    if (payload.cause || payload.message) summary += ` Causa informada: ${cleanDiagnosticText(payload.cause, 280) || cleanDiagnosticText(payload.message, 350)}.`;
    if (payload.message && payload.cause) summary += ` Mensagem: ${cleanDiagnosticText(payload.message, 350)}.`;
  } else if (event === "security.suspicious_request") {
    summary = `Foi detectado um padrão de requisição suspeito${area ? ` em ${area}` : ""}. O registro identifica o padrão; não significa, por si só, que houve acesso bem-sucedido.`;
  } else if (event === "performance.anomaly") {
    summary = `As métricas ultrapassaram o limite configurado${payload.threshold != null ? ` (${cleanDiagnosticText(payload.threshold, 80)})` : ""}. Verifique a rota e as métricas registradas.`;
  } else if (event === "performance.recovered") {
    summary = "As métricas de desempenho voltaram à faixa normal.";
  } else if (event === "deployment.completed") {
    summary = `A versão ${cleanDiagnosticText(payload.version || "não informada", 80)} foi ativada com sucesso. Commit ${cleanDiagnosticText(payload.commitShort || payload.commit || "não informado", 80)}. Alterações: ${cleanDiagnosticText(payload.summary || "sem resumo do commit", 700)}`;
  } else if (event === "deployment.failed") {
    summary = `A publicação falhou na etapa ${cleanDiagnosticText(diagnosticLabel(payload.failureStage, DEPLOYMENT_STAGE_LABELS), 100)}. ${payload.outageDetected ? `Indisponibilidade detectada: ${cleanDiagnosticText(diagnosticLabel(payload.outageType, OUTAGE_TYPE_LABELS), 120)}.` : "A release anterior permaneceu ativa; não foi detectada queda causada pelo deploy."} Versão tentada: ${cleanDiagnosticText(payload.attemptedVersion || "não informada", 80)}. Causa: ${cleanDiagnosticText(payload.cause || payload.message || "não informada", 500)}`;
  } else if (event.startsWith("service.outage.")) {
    summary = `${cleanDiagnosticText(payload.cause || payload.message || humanizeEvent(event), 500)}${payload.outageType ? ` Tipo: ${cleanDiagnosticText(diagnosticLabel(payload.outageType, OUTAGE_TYPE_LABELS), 120)}.` : ""}${payload.outageDurationSeconds != null ? ` Duração estimada: ${cleanDiagnosticText(payload.outageDurationSeconds, 30)} s.` : ""}`;
  } else {
    summary = cleanDiagnosticText(payload.cause || payload.message || humanizeEvent(event), 600);
  }
  return `**Nível:** ${LEVEL_LABELS[level] || "INFORMAÇÃO"}\n**O que aconteceu:** ${summary}`;
}

function eventEmbed(log = {}) {
  const level = String(log.level || "info").toLowerCase();
  const colors = { error: 0xe5484d, warn: 0xe5a000, info: 0x3b82f6 };
  const event = String(log.event || "system.event");
  const title = cleanText(humanizeEvent(event), 240);
  const fields = [];
  const payload = log.fields && typeof log.fields === "object" ? log.fields : {};
  if (payload.path) fields.push({ name: "Área afetada", value: describeRoute(payload.path), inline: true });
  const orderedKeys = ["version", "currentVersion", "attemptedVersion", "previousVersion", "commit", "attemptedCommit", "currentCommit", "release", "previousRelease", "outageType", "failureStage", "healthStatus", "lastHeartbeatAt", "diagnosis", "pid", "signal", "method", "path", "statusCode", "status", "durationMs", "attackType", "rule", "errorType", "errorCode", "code", "cause", "message", "reason", "threshold", "count", "windowSeconds", "cpuPercent", "httpStatus"];
  const used = new Set();
  for (const key of orderedKeys) {
    const value = payload[key];
    if (!EVENT_FIELD_ALLOWLIST.has(key) || value === null || value === undefined || typeof value === "object") continue;
    if (key === "status" && payload.statusCode != null && event === "http.request.completed") continue;
    const label = FIELD_LABELS[key] || key;
    fields.push({ name: cleanText(label, 40), value: fieldValue(key, value) || "Não informado", inline: !["path", "cause", "message"].includes(key) });
    used.add(key);
    if (fields.length >= 9) break;
  }
  const metrics = payload.metrics && typeof payload.metrics === "object" ? payload.metrics : {};
  const metricFields = [
    ["cpuPercent", "CPU"],
    ["latencyRequestP95Ms", "Latência HTTP p95"],
    ["eventLoopP95Ms", "Event loop p95"],
    ["errors5xx", "Erros HTTP 5xx"]
  ];
  for (const [key, label] of metricFields) {
    if (metrics[key] === null || metrics[key] === undefined || fields.length >= 10 || (key === "cpuPercent" && used.has(key))) continue;
    const suffix = key.endsWith("Ms") ? " ms" : key === "cpuPercent" ? "%" : "";
    fields.push({ name: label, value: cleanDiagnosticText(`${metrics[key]}${suffix}`, 40), inline: true });
  }
  if (event !== "http.request.completed" && event !== "request.failed") {
    fields.push({ name: "Código do evento", value: cleanText(event, 100), inline: true });
  }
  if (log.requestId && fields.length < 11) fields.push({ name: "ID da requisição", value: cleanText(log.requestId, 60), inline: true });
  return {
    title,
    description: eventDescription(event, level, payload).slice(0, 4000),
    color: colors[level] || colors.info,
    fields,
    timestamp: new Date(log.timestamp || Date.now()).toISOString(),
    footer: { text: "Cine Cruzeiro • telemetria com dados pessoais removidos" }
  };
}

function healthEmbed(snapshot = {}) {
  const metrics = snapshot.current || {};
  const percent = (used, total) => Number(total) > 0 ? `${Math.round(Number(used) / Number(total) * 100)}%` : "n/d";
  const diskAvailable = Number(metrics.diskAvailable);
  const diskTotal = Number(metrics.diskTotal);
  const memoryTotal = Number(metrics.memoryTotal);
  const memoryUsed = Number(metrics.memoryUsed);
  return {
    title: "Saúde do servidor",
    description: "Resumo periódico de desempenho e disponibilidade.",
    color: 0x24b47e,
    fields: [
      { name: "CPU", value: metrics.cpuPercent == null ? "n/d" : `${metrics.cpuPercent}%`, inline: true },
      { name: "Memória", value: percent(memoryUsed, memoryTotal), inline: true },
      { name: "Disco livre", value: percent(diskAvailable, diskTotal) === "n/d" ? "n/d" : `${percent(diskAvailable, diskTotal)} livre`, inline: true },
      { name: "HTTP p95 (60s)", value: metrics.latencyRequestP95Ms == null ? "n/d" : `${metrics.latencyRequestP95Ms} ms`, inline: true },
      { name: "Erros HTTP 5xx", value: String(metrics.errors5xx ?? 0), inline: true },
      { name: "Event loop p95", value: metrics.eventLoopP95Ms == null ? "n/d" : `${metrics.eventLoopP95Ms} ms`, inline: true }
    ],
    timestamp: new Date(metrics.sampledAt || Date.now()).toISOString(),
    footer: { text: "Cine Cruzeiro • amostra agregada, sem dados de clientes" }
  };
}

function shouldForward(log, includeInfo) {
  const level = String(log.level || "info").toLowerCase();
  const event = String(log.event || "").toLowerCase();
  return level === "warn" || level === "error"
    || /^(performance|security|abuse|attack|sql_injection)\./.test(event)
    || event === "request.failed"
    || (includeInfo && level === "info");
}

function createDiscordWebhookService({ fetchImpl = globalThis.fetch, logger = () => {}, timers = globalThis, maxQueue = MAX_QUEUE_SIZE } = {}) {
  let config = { enabled: false, webhookUrl: "", includeInfo: false, healthIntervalMinutes: 5 };
  let queue = [];
  let dropped = 0;
  let flushTimer = null;
  let healthTimer = null;
  let sending = false;
  let closed = false;

  async function postEmbeds(embeds, url = config.webhookUrl, attempt = 0) {
    const controller = new AbortController();
    const timeout = timers.setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds, allowed_mentions: { parse: [] } }),
        signal: controller.signal,
        redirect: "error"
      });
      if (response.ok || response.status === 204) return true;
      if (response.status === 429 && attempt < RETRY_LIMIT) {
        let retryAfter = Number(response.headers?.get?.("retry-after")) * 1000;
        if (!Number.isFinite(retryAfter) || retryAfter <= 0) {
          const body = await response.json().catch(() => ({}));
          retryAfter = Number(body.retry_after) * 1000;
        }
        await new Promise((resolve) => timers.setTimeout(resolve, Math.min(Math.max(retryAfter || 1000, 250), 10000)));
        return postEmbeds(embeds, url, attempt + 1);
      }
      if (response.status >= 500 && attempt < RETRY_LIMIT) {
        await new Promise((resolve) => timers.setTimeout(resolve, 300 * (attempt + 1)));
        return postEmbeds(embeds, url, attempt + 1);
      }
      logger({ event: "discord.delivery_failed", status: response.status });
      return false;
    } catch (error) {
      if (attempt < RETRY_LIMIT) {
        await new Promise((resolve) => timers.setTimeout(resolve, 300 * (attempt + 1)));
      return postEmbeds(embeds, url, attempt + 1);
      }
      logger({ event: "discord.delivery_failed", reason: error.name === "AbortError" ? "timeout" : "network" });
      return false;
    } finally {
      timers.clearTimeout(timeout);
    }
  }

  async function flush() {
    if (sending || closed || !config.enabled || !validateDiscordWebhookUrl(config.webhookUrl) || !queue.length) return;
    sending = true;
    const batch = queue.splice(0, MAX_EMBEDS_PER_MESSAGE);
    if (dropped > 0) {
      batch.unshift({
        title: "Eventos agrupados",
        description: `${dropped} evento(s) foram omitidos porque a fila atingiu o limite configurado.`,
        color: 0xe5a000,
        timestamp: new Date().toISOString()
      });
      dropped = 0;
      batch.splice(MAX_EMBEDS_PER_MESSAGE);
    }
    try {
      if (!await postEmbeds(batch)) dropped += batch.length;
    } finally {
      sending = false;
      if (queue.length && !closed) scheduleFlush(1000);
    }
  }

  function scheduleFlush(delay = 500) {
    if (flushTimer || closed) return;
    flushTimer = timers.setTimeout(() => {
      flushTimer = null;
      void flush();
    }, delay);
    flushTimer.unref?.();
  }

  function setConfig(next = {}) {
    config = {
      enabled: Boolean(next.enabled && next.configured && validateDiscordWebhookUrl(next.webhookUrl)),
      webhookUrl: String(next.webhookUrl || ""),
      includeInfo: Boolean(next.includeInfo),
      healthIntervalMinutes: Math.min(60, Math.max(1, Number(next.healthIntervalMinutes) || 5))
    };
    if (!config.enabled) {
      queue = [];
      dropped = 0;
      if (flushTimer) timers.clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  function enqueue(log = {}) {
    if (!config.enabled || !shouldForward(log, config.includeInfo)) return;
    if (queue.length >= maxQueue) {
      dropped += 1;
      return;
    }
    queue.push(eventEmbed(log));
    scheduleFlush();
  }

  function enqueueHealth(snapshot) {
    if (!config.enabled) return;
    queue.push(healthEmbed(snapshot));
    if (queue.length > maxQueue) {
      queue.shift();
      dropped += 1;
    }
    scheduleFlush();
  }

  function test(configInput) {
    if (!validateDiscordWebhookUrl(configInput?.webhookUrl)) {
      return Promise.resolve({ ok: false, message: "Informe uma URL válida de webhook oficial do Discord." });
    }
    return postEmbeds([{
      title: "Teste da integração Discord",
      description: "O Cine Cruzeiro conseguiu enviar este embed de verificação.",
      color: 0x5865f2,
      timestamp: new Date().toISOString(),
      footer: { text: "Teste • sem dados de operação" }
    }], configInput.webhookUrl).then((ok) => ({ ok, message: ok ? "Webhook do Discord conectado com sucesso." : "O Discord não aceitou o embed de teste." }));
  }

  function close() {
    closed = true;
    if (flushTimer) timers.clearTimeout(flushTimer);
    if (healthTimer) timers.clearInterval(healthTimer);
    flushTimer = null;
    healthTimer = null;
    queue = [];
  }

  return {
    setConfig,
    enqueue,
    enqueueHealth,
    test,
    isEnabled: () => config.enabled,
    healthIntervalMs: () => config.healthIntervalMinutes * 60 * 1000,
    close
  };
}

module.exports = { createDiscordWebhookService, validateDiscordWebhookUrl, eventEmbed, healthEmbed, shouldForward };
