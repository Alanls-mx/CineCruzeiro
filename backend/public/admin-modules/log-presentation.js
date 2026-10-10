(function registerLogPresentation(root) {
function logLevelLabel(level = "") {
  return { error: "Precisa de ação", warn: "Atenção", info: "Concluído", debug: "Diagnóstico" }[level] || "Informação";
}

function logCategoryLabel(category = "") {
  const normalized = String(category || "").toLowerCase();
  const exact = {
    payment: "Pagamentos",
    box_office: "Bilheteria",
    ticket: "Ingressos",
    subscription: "Clube",
    email: "E-mails",
    password_reset: "Acesso de clientes",
    email_verification: "Verificação de e-mail",
    admin: "Painel administrativo",
    admin_two_factor: "Segurança e 2FA",
    integration: "Integrações",
    google_wallet: "Carteira digital",
    webhook: "Confirmações automáticas",
    deployment: "Publicação do sistema",
    service: "Disponibilidade do sistema",
    request: "Operação do sistema",
    logs: "Histórico",
    system: "Sistema"
  }[normalized];
  if (exact) return exact;
  if (normalized.startsWith("box_office")) return "Bilheteria";
  if (normalized.startsWith("ticket")) return "Ingressos";
  if (normalized.startsWith("subscription")) return "Clube";
  if (normalized.includes("email")) return "E-mails";
  if (normalized.startsWith("google_wallet")) return "Carteira digital";
  return "Sistema";
}

function logPaymentMethod(value = "") {
  return {
    pix: "Pix",
    cash: "Dinheiro",
    credit_card: "Cartão de crédito",
    card: "Cartão",
    courtesy: "Cortesia",
    external_pix: "Pix registrado no balcão",
    point_qr: "Pix na Point",
    card_terminal: "Débito/crédito na Point",
    point_debit: "Débito na Point",
    point_credit: "Crédito na Point",
    club_credit: "Crédito do Clube"
  }[String(value || "").toLowerCase()] || value;
}

function logFriendlyError(message = "") {
  const text = String(message || "").trim();
  if (!text) return "O sistema registrou uma ocorrência que precisa ser conferida.";
  const translations = [
    [/invalid input syntax for type timestamp with time zone/i, "Uma data ou horário foi enviado em formato inválido."],
    [/unauthorized|não autorizado|nao autorizado/i, "A operação foi recusada por falta de autorização."],
    [/not found|não encontrado|nao encontrado/i, "O registro solicitado não foi encontrado."],
    [/timeout|timed out/i, "O serviço demorou mais que o esperado para responder."],
    [/network|fetch failed|econnreset|econnrefused/i, "Não foi possível se comunicar com o serviço externo."],
    [/duplicate|already exists/i, "O registro já existia e não foi duplicado."],
    [/invalid signature/i, "A confirmação automática foi recusada por assinatura inválida."]
  ];
  return translations.find(([pattern]) => pattern.test(text))?.[1] || text;
}

function logAdminAction(log) {
  const path = String(log.path || "");
  const method = String(log.method || "").toUpperCase();
  const operation = method === "POST" ? "criado" : method === "DELETE" ? "excluído" : "atualizado";
  const resources = [
    [/\/users/, "Usuário"],
    [/\/movies/, "Filme"],
    [/\/rooms/, "Sala"],
    [/\/tickets/, "Ingresso"],
    [/\/orders/, "Pedido"],
    [/\/club/, "Clube"],
    [/\/concessions/, "Produto da bomboniere"],
    [/\/integrations/, "Integração"],
    [/\/marketing/, "Campanha"]
  ];
  const resource = resources.find(([pattern]) => pattern.test(path))?.[1] || "Configuração";
  return { title: `${resource} ${operation}`, description: "Uma alteração foi realizada pelo painel administrativo." };
}

function logDeploymentStageLabel(value = "") {
  return ({
    prepare_release: "preparação da release",
    release_build: "montagem da release",
    backup_and_migration: "backup ou migração do banco",
    release_activation: "ativação da nova versão",
    health_check: "checagem de disponibilidade",
    completed: "concluída"
  })[String(value)] || String(value || "não identificada").replace(/[_-]+/g, " ");
}

function logOutageTypeLabel(value = "") {
  return ({
    readiness_dependency_unavailable: "dependência necessária indisponível",
    http_server_error: "erro HTTP interno do servidor",
    health_check_unreachable: "servidor não respondeu à checagem",
    release_activation_failed: "falha ao ativar a release",
    rollback_health_check_failed: "checagem falhou após o rollback",
    process_exit_without_shutdown: "processo encerrou sem parada normal"
  })[String(value)] || String(value || "não identificado").replace(/[_-]+/g, " ");
}

function logPerformanceAlert(log) {
  const code = String(log.metadata?.code || "");
  const alerts = {
    cpu: ["Uso de CPU", "O uso de CPU voltou ao nível normal."],
    memory: ["Uso de memória", "O uso de memória voltou ao nível normal."],
    disk: ["Espaço em disco", "O espaço disponível em disco voltou ao nível normal."],
    latency: ["Tempo de resposta", "O tempo de resposta das operações internas voltou ao nível normal."],
    external_latency: ["Tempo das integrações", "O tempo de resposta das integrações voltou ao nível normal."],
    event_loop: ["Atraso no processamento", "O atraso no processamento do backend voltou ao nível normal."],
    http_errors: ["Falhas nas requisições", "A taxa de falhas nas requisições voltou ao nível normal."]
  };
  const [name, recovery] = alerts[code] || ["Desempenho", `O alerta ${code || "de desempenho"} deixou de ser detectado.`];
  return log.event === "performance.recovered"
    ? { title: `${name} normalizado`, description: recovery }
    : { title: `Alerta: ${name}`, description: logFriendlyError(log.message || log.metadata?.message || `O sistema detectou uma alteração em ${name.toLowerCase()}.`) };
}

function logEventSummary(event) {
  const known = {
    "social_studio.campaign_created": "Campanha criada no Studio.",
    "social_studio.post_created": "Post criado no Studio.",
    "email_automation.draft_created": "Rascunho de e-mail criado automaticamente.",
    "subscription.pending_payment_maintenance": "Assinaturas com pagamento pendente foram verificadas.",
    "session.finished_archived": "Uma sessão encerrada foi arquivada."
  };
  return known[event] || `Evento registrado: ${event || "sem identificação"}.`;
}

function logPresentation(log = {}) {
  const event = String(log.event || "");
  const metadata = log.metadata || {};
  const method = logPaymentMethod(metadata.method || metadata.paymentMethod || "");
  const entries = {
    "payment.created": { title: "Pagamento iniciado", description: method ? `Uma cobrança por ${method} foi criada e aguarda confirmação.` : "Uma cobrança foi criada e aguarda confirmação." },
    "coupon.order_completed": { title: "Pedido concluído com cupom", description: "O desconto cobriu todo o pedido e os ingressos foram emitidos sem cobrança." },
    "payment.reconciled": { title: "Pagamento confirmado", description: "O pagamento foi localizado e conciliado com o pedido." },
    "payment.reconciliation_reference_mismatch": { title: "Pagamento não localizado no pedido", description: "A referência recebida não corresponde ao pedido e precisa ser conferida." },
    "payment.reconciliation_amount_mismatch": { title: "Valor do pagamento diferente", description: "O valor confirmado pelo provedor não corresponde ao total do pedido." },
    "order.concession_refund_pending": { title: "Reembolso da bomboniere pendente", description: "A devolução foi solicitada, mas ainda precisa de confirmação do Mercado Pago." },
    "order.concession_refunded": { title: "Bomboniere reembolsada", description: "Os produtos foram devolvidos pela forma de pagamento original sem cancelar os ingressos do pedido." },
    "ticket.used": { title: "Ingresso validado", description: "A entrada foi liberada e o ingresso foi marcado como utilizado." },
    "ticket.transferred": { title: "Ingresso transferido", description: "O ingresso foi enviado para outro cliente." },
    "ticket_email.failed": { title: "E-mail do ingresso não enviado", description: "O ingresso foi emitido, mas o e-mail não pôde ser entregue." },
    "ticket_email.pdf_failed": { title: "PDF do ingresso não gerado", description: "O sistema não conseguiu preparar o PDF anexado ao e-mail." },
    "box_office_sale.created": { title: "Venda concluída na bilheteria", description: method ? `A venda presencial foi registrada com pagamento em ${method}.` : "A venda presencial foi registrada com sucesso." },
    "box_office_point_sale.created": { title: "Pagamento enviado à Point", description: "A cobrança presencial foi enviada para o terminal selecionado." },
    "box_office_point_sale.synced": { title: "Pagamento da Point atualizado", description: "O status da venda presencial foi atualizado pelo Mercado Pago." },
    "box_office_point_sale.cancelled": { title: "Cobrança da Point cancelada", description: "A cobrança presencial foi cancelada no Mercado Pago." },
    "box_office_ticket_print.queued": { title: "Ingresso enviado para impressão", description: "A impressão física foi enviada para o terminal Point." },
    "box_office_ticket_print.failed": { title: "Ingresso não impresso", description: "A venda foi concluída, mas o terminal Point não recebeu a impressão." },
    "webhook.processed": { title: "Pagamento atualizado automaticamente", description: "O Mercado Pago confirmou uma mudança no pagamento do pedido." },
    "webhook.subscription.processed": { title: "Assinatura do Clube atualizada", description: "O Mercado Pago confirmou uma mudança na assinatura do cliente." },
    "webhook.payment.not_found": { title: "Pagamento sem pedido correspondente", description: "O provedor confirmou uma cobrança, mas o sistema não encontrou o pedido relacionado." },
    "webhook.subscription.not_found": { title: "Pagamento sem assinatura correspondente", description: "O provedor enviou uma atualização, mas a assinatura relacionada não foi encontrada." },
    "webhook.mercado_pago.rejected": { title: "Confirmação do Mercado Pago recusada", description: "A notificação recebida não passou pela verificação de segurança." },
    "subscription.pending_payment_expiration_failed": { title: "Plano pendente não cancelado", description: "O sistema não conseguiu cancelar automaticamente um plano sem pagamento." },
    "subscription.pending_payment_maintenance_failed": { title: "Revisão de planos pendentes falhou", description: "A rotina automática de assinaturas precisa ser conferida." },
    "email_verification.delivery_failed": { title: "E-mail de verificação não entregue", description: "A mensagem de confirmação do cadastro não pôde ser enviada." },
    "email_verification.delivery_missing_channel": { title: "Envio de verificação não configurado", description: "Não há um serviço de e-mail disponível para confirmar o cadastro do cliente." },
    "email_campaign.created": { title: "Campanha criada", description: "Uma campanha de e-mail foi salva no painel." },
    "email_campaign.updated": { title: "Campanha editada", description: "O conteúdo ou o público de uma campanha foi atualizado." },
    "email_campaign.duplicated": { title: "Campanha duplicada", description: "Uma cópia foi criada como novo rascunho." },
    "email_campaign.deleted": { title: "Campanha removida", description: "A campanha foi retirada do histórico visível; envios anteriores continuam auditáveis." },
    "email_campaign.scheduled": { title: "Campanha agendada", description: "O envio foi programado para a data definida no painel." },
    "email_campaign.queued": { title: "Campanha colocada na fila", description: "O envio aguarda processamento pelo serviço de e-mails." },
    "email_campaign.cancelled": { title: "Campanha cancelada", description: "Os destinatários ainda pendentes não receberão a campanha." },
    "email_campaign.completed": { title: "Campanha concluída", description: "Todos os destinatários elegíveis foram processados sem falhas confirmadas." },
    "email_campaign.completed_with_errors": { title: "Campanha concluída com falhas", description: "Parte dos e-mails foi enviada e parte precisa de atenção." },
    "email_campaign.failed": { title: "Campanha não enviada", description: "O processamento terminou sem entregas confirmadas." },
    "email_campaign.failures_requeued": { title: "Falhas recolocadas na fila", description: "Somente entregas com falha segura para nova tentativa serão processadas." },
    "password_reset.delivery_failed": { title: "E-mail de recuperação não entregue", description: "A mensagem para redefinir a senha não pôde ser enviada." },
    "password_reset.delivery_missing_channel": { title: "Recuperação de senha não configurada", description: "Não há um serviço de e-mail disponível para enviar a recuperação de senha." },
    "password_reset.delivery_not_configured": { title: "Recuperação de senha indisponível", description: "As configurações necessárias para enviar a recuperação de senha estão incompletas." },
    "ticket_transfer_email.failed": { title: "Transferência não enviada por e-mail", description: "O ingresso foi transferido, mas o destinatário não recebeu a mensagem." },
    "ticket_transfer_pdf.failed": { title: "PDF da transferência não gerado", description: "O ingresso foi transferido, mas o PDF atualizado não pôde ser preparado." },
    "google_wallet.integration_failed": { title: "Carteira digital indisponível", description: "A conexão com o Google Wallet apresentou uma falha." },
    "deployment.completed": {
      title: "Nova versão publicada",
      description: `${metadata.version || "Versão atualizada"} entrou em produção. Commit ${metadata.commitShort || metadata.commit || "não informado"}. Alterações: ${String(metadata.summary || log.message || "sem resumo").replace(/\s+/g, " ")}`
    },
    "deployment.failed": {
      title: "Falha ao publicar versão",
      description: `Etapa: ${logDeploymentStageLabel(metadata.failureStage)}. ${metadata.outageDetected ? `Tipo de queda: ${logOutageTypeLabel(metadata.outageType)}.` : "A versão anterior permaneceu ativa; não foi detectada indisponibilidade causada pela publicação."} Versão tentada: ${metadata.attemptedVersion || "não informada"}. Causa: ${logFriendlyError(metadata.cause || log.message || "não informada")}`
    },
    "deployment.rollback_completed": {
      title: "Versão anterior restaurada",
      description: `A publicação ${metadata.failedRelease || "tentada"} foi revertida para ${metadata.currentRelease || "a release anterior"}; a checagem após rollback passou.`
    },
    "service.outage.detected": {
      title: "Indisponibilidade detectada",
      description: `Tipo: ${logOutageTypeLabel(metadata.outageType)}. Etapa: ${logDeploymentStageLabel(metadata.failureStage)}. HTTP da checagem: ${metadata.healthStatus || "sem resposta"}. Causa: ${logFriendlyError(metadata.cause || log.message || "não confirmada")}`
    },
    "service.outage.recovered": {
      title: "Serviço restabelecido após reinício inesperado",
      description: `O processo anterior encerrou sem sinal de parada normal (${logOutageTypeLabel(metadata.outageType)}). Indisponibilidade estimada desde o último sinal: ${metadata.outageDurationSeconds == null ? "não calculada" : `${metadata.outageDurationSeconds} s`}. ${metadata.diagnosis || "A causa exata não foi confirmada; verifique PM2 e eventos de memória do sistema."}`
    },
    "service.outage.recovery_failed": {
      title: "Serviço continua indisponível após rollback",
      description: `A checagem da release anterior também falhou (${metadata.healthStatus || "sem resposta"}). Causa: ${logFriendlyError(metadata.cause || log.message || "não confirmada")}`
    },
    "logs.retention_applied": { title: "Histórico antigo organizado", description: "A política de retenção removeu registros técnicos antigos." },
    "logs.retention_failed": { title: "Histórico antigo não foi limpo", description: "A rotina de organização dos registros precisa ser executada novamente." },
    "admin_two_factor.setup_started": { title: "Configuração do 2FA iniciada", description: "O aplicativo autenticador foi preparado para esta conta administrativa." },
    "admin_two_factor.enabled": { title: "2FA ativado", description: "A conta administrativa passou a exigir senha e código temporário no login." },
    "admin_two_factor.disabled": { title: "2FA desativado", description: "A autenticação em duas etapas foi removida desta conta administrativa." },
    "admin_two_factor.recovery_codes_regenerated": { title: "Códigos de recuperação renovados", description: "Os códigos anteriores foram invalidados e substituídos." }
  };
  if (entries[event]) return entries[event];
  if (event === "performance.anomaly" || event === "performance.recovered") return logPerformanceAlert(log);
  if (event === "admin.action") return logAdminAction(log);
  if (event === "request.failed") return { title: "Operação não concluída", description: logFriendlyError(log.message || metadata.message) };
  if (/\.failed$|_failed$/.test(event)) return { title: "Operação com falha", description: logFriendlyError(log.message || metadata.message) };
  return {
    title: logCategoryLabel(log.category),
    description: log.message
      ? logFriendlyError(log.message)
      : logEventSummary(event)
  };
}

function logReferenceItems(log = {}) {
  const metadata = log.metadata || {};
  if (String(log.event || "").startsWith("deployment.")) {
    return [
      ["Versão atual", metadata.version || metadata.currentVersion],
      ["Versão tentada", metadata.attemptedVersion],
      ["Commit", metadata.commitShort || metadata.commit || metadata.attemptedCommit],
      ["Release", metadata.release || metadata.currentRelease],
      ["Release anterior", metadata.previousRelease],
      ["Arquivos alterados", Array.isArray(metadata.files) ? metadata.files.slice(0, 8).join(", ") : ""],
      ["Etapa da falha", logDeploymentStageLabel(metadata.failureStage)]
    ].filter(([, value]) => value != null && String(value).trim()).slice(0, 6);
  }
  if (String(log.event || "").startsWith("service.outage.")) {
    return [
      ["Tipo de queda", logOutageTypeLabel(metadata.outageType)],
      ["Duração estimada", metadata.outageDurationSeconds == null ? "" : `${metadata.outageDurationSeconds} s`],
      ["Último sinal", metadata.lastHeartbeatAt],
      ["Versão anterior", metadata.previousVersion],
      ["Versão atual", metadata.currentVersion]
    ].filter(([, value]) => value != null && String(value).trim()).slice(0, 5);
  }
  if (String(log.event || "").startsWith("service.runtime.")) {
    return [
      ["Versão", metadata.version],
      ["Commit", metadata.commit],
      ["Release", metadata.release],
      ["PID do processo", metadata.pid],
      ["Sinal de encerramento", metadata.signal]
    ].filter(([, value]) => value != null && String(value).trim()).slice(0, 5);
  }
  const candidates = [
    ["Pedido", metadata.orderId],
    ["Pagamento", metadata.paymentId || metadata.providerPaymentId],
    ["Ingresso", metadata.ticketId],
    ["Assinatura", metadata.subscriptionId],
    ["Sessão", metadata.sessionId],
    ["Cliente", metadata.customerEmail || metadata.email]
  ];
  return candidates.filter(([, value]) => value != null && String(value).trim()).slice(0, 4);
}

function logDate(value = "") {
  if (!value) return "Sem data";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

function logFilterDate(value, endOfMinute = false) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (endOfMinute) date.setSeconds(59, 999);
  return date.toISOString();
}

  const api = Object.freeze({ logLevelLabel, logCategoryLabel, logPaymentMethod, logFriendlyError, logAdminAction, logDeploymentStageLabel, logOutageTypeLabel, logPerformanceAlert, logEventSummary, logPresentation, logReferenceItems, logDate, logFilterDate });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CineAdminModules ||= {};
    root.CineAdminModules.logPresentation = api;
  }
})(globalThis);
