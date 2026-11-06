((root) => {
  function createIntegrationAdministration({
    state, $, escapeHtml, API_BASE, api, showToast,
    showSuccess, refreshPointProviderControls
  }) {
    function renderIntegrations() {
      if (!$("integrationsList")) return;
      const entries = Object.entries(state.integrations?.integrations || {});
      $("integrationsList").innerHTML = entries.length
        ? entries.map(([key, item]) => `
            <div class="integration-item">
              <div class="integration-main">
                <div class="integration-title-row">
                  <strong>${escapeHtml(item.name)}</strong>
                  <span class="integration-category">${escapeHtml(integrationCategory(key))}</span>
                </div>
                <span>${escapeHtml(item.purpose || "")}</span>
                <div class="integration-meta">
                  <span class="badge ${item.enabled ? "" : "muted"}">${item.enabled ? "Ativa" : "Desativada"}</span>
                  <span class="integration-status ${escapeHtml(item.status || "pending")}">${integrationStatusLabel(item)}</span>
                  ${item.lastTestAt ? `<span>Último teste: ${escapeHtml(new Date(item.lastTestAt).toLocaleString("pt-BR"))}</span>` : ""}
                </div>
              </div>
              <div class="integration-actions">
                <button class="ghost-button" type="button" data-integration-action="config" data-integration-key="${escapeHtml(key)}">Configurar</button>
                <button class="ghost-button" type="button" data-integration-action="test" data-integration-key="${escapeHtml(key)}">Testar</button>
                <button class="${item.enabled ? "danger-button" : "primary-button"}" type="button" data-integration-action="${item.enabled ? "disable" : "enable"}" data-integration-key="${escapeHtml(key)}">${item.enabled ? "Desativar" : "Ativar"}</button>
              </div>
            </div>
          `).join("")
        : `<div class="empty-state"><strong>Acesso restrito</strong><span>Somente o proprietário pode ver integrações.</span></div>`;
    }

    function integrationCategory(key) {
      return {
        mercadoPago: "Pagamentos",
        pagBank: "Pagamentos",
        googleLogin: "Login",
        googleWallet: "Carteira digital",
        tmdb: "Catálogo",
        email: "E-mail",
        analytics: "Medição",
        crm: "CRM",
        discord: "Alertas e monitoramento",
        commercialCatalog: "Catálogo comercial"
      }[key] || "Integração";
    }

    function integrationStatusLabel(item) {
      if (item.key === "pagBank" && item.enabled && item.configured) return "Ativa; pedidos não verificados";
      if (item.enabled && item.configured) return "Operacional";
      if (item.configured) return "Configurada";
      return "Pendente";
    }

    function integrationSecurityHint(field, integration) {
      if (!field.secret) return "";
      const secret = integration.secrets?.[field.key];
      return secret?.hasValue
        ? `<small class="integration-field-hint">${secret.source === "environment" ? "Credencial fornecida pelo servidor" : "Credencial desta integração já configurada"}. Preencha somente para substituir.</small>`
        : `<small class="integration-field-hint">Campo sensível. O valor será criptografado e ocultado após salvar.</small>`;
    }

    function commercialCatalogEndpointUrl() {
      return new URL(`${API_BASE}/api/commercial/catalog`, window.location.origin).toString();
    }

    function commercialCatalogAccessMarkup() {
      return `
        <section class="integration-catalog-access">
          <strong>Link para aplicação externa</strong>
          <p>Após salvar e ativar, este catálogo disponibiliza filmes, sessões vendáveis, programação, bomboniere, promoções, cupons e datas.</p>
          <code>${escapeHtml(commercialCatalogEndpointUrl())}</code>
          <small>Prefira o header <code>Authorization: Bearer TOKEN</code>. Para integrações que exigem uma URL, use também <code>?token=TOKEN</code>.</small>
          <div class="integration-catalog-actions">
            <button class="ghost-button" type="button" data-admin-command="reveal-commercial-token">Revelar token</button>
            <button class="ghost-button" type="button" data-admin-command="copy-commercial-token">Copiar token</button>
          </div>
          <div id="commercialCatalogLinkPreview" class="integration-catalog-link-preview" aria-live="polite"></div>
        </section>
      `;
    }

    function updateCommercialCatalogLinkPreview() {
      const target = $("commercialCatalogLinkPreview");
      const input = document.querySelector('[data-integration-field="accessToken"]');
      if (!target || !input) return;
      const token = String(input.value || "").trim();
      if (!token) {
        target.innerHTML = `<span>O token salvo fica oculto por segurança. Gere um novo token apenas para renovar o acesso.</span>`;
        return;
      }
      const link = `${commercialCatalogEndpointUrl()}?token=${encodeURIComponent(token)}`;
      target.innerHTML = `<code>${escapeHtml(link)}</code><button class="ghost-button" type="button" data-admin-command="copy-commercial-link">Copiar link</button>`;
    }

    async function loadCommercialCatalogToken() {
      const input = document.querySelector('[data-integration-field="accessToken"]');
      if (!input) return "";
      const currentToken = String(input.value || "").trim();
      if (currentToken) return currentToken;
      const result = await api("/api/admin/integrations/commercialCatalog/access-token");
      input.value = String(result.token || "");
      input.type = "text";
      updateCommercialCatalogLinkPreview();
      return String(input.value || "").trim();
    }

    async function revealCommercialCatalogToken() {
      try {
        const token = await loadCommercialCatalogToken();
        if (!token) throw new Error("Nenhum token configurado para o catálogo comercial.");
        const input = document.querySelector('[data-integration-field="accessToken"]');
        if (input) input.type = "text";
        showToast("Token revelado somente nesta sessão do painel.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function copyCommercialCatalogToken() {
      try {
        const token = await loadCommercialCatalogToken();
        if (!token) throw new Error("Nenhum token configurado para o catálogo comercial.");
        await navigator.clipboard.writeText(token);
        showToast("Token do catálogo copiado.");
      } catch (error) {
        showToast(error.message || "Não foi possível copiar o token.", "error");
      }
    }

    function generateCommercialCatalogToken() {
      const input = document.querySelector('[data-integration-field="accessToken"]');
      if (!input) return;
      const bytes = new Uint8Array(24);
      window.crypto.getRandomValues(bytes);
      input.value = `catalog_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      input.type = "text";
      updateCommercialCatalogLinkPreview();
      showToast("Novo token gerado. Salve a integração para ativá-lo.");
    }

    async function copyCommercialCatalogLink() {
      try {
        const token = await loadCommercialCatalogToken();
        if (!token) throw new Error("Nenhum token configurado para o catálogo comercial.");
        await navigator.clipboard.writeText(`${commercialCatalogEndpointUrl()}?token=${encodeURIComponent(token)}`);
        showToast("Link do catálogo copiado.");
      } catch (error) {
        showToast(error.message || "Não foi possível copiar automaticamente.", "error");
      }
    }

    function integrationDiagnosticsMarkup(checks = [], diagnostics = {}) {
      const items = Array.isArray(checks) ? checks : [];
      const summary = diagnostics && Object.keys(diagnostics).length
        ? `
          <dl class="integration-diagnostics-meta">
            ${diagnostics.issuerId ? `<div><dt>Issuer</dt><dd>${escapeHtml(diagnostics.issuerId)}</dd></div>` : ""}
            ${diagnostics.classId ? `<div><dt>Class ID</dt><dd>${escapeHtml(diagnostics.classId)}</dd></div>` : ""}
            ${diagnostics.clientEmail ? `<div><dt>Service Account</dt><dd>${escapeHtml(diagnostics.clientEmail)}</dd></div>` : ""}
            ${diagnostics.passType ? `<div><dt>Tipo</dt><dd>${escapeHtml(diagnostics.passType)}</dd></div>` : ""}
            ${diagnostics.reviewStatus ? `<div><dt>Status Google</dt><dd>${escapeHtml(diagnostics.reviewStatus)}</dd></div>` : ""}
          </dl>
        `
        : "";
      return `
        <div class="integration-diagnostics">
          <strong>Diagnóstico</strong>
          ${items.length ? `
            <ol>
              ${items.map((item) => `
                <li class="${escapeHtml(item.level || (item.ok ? "ok" : "error"))}">
                  <span aria-hidden="true"></span>
                  <div><b>${escapeHtml(item.label || item.key || "Verificação")}</b>${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}</div>
                </li>
              `).join("")}
            </ol>
          ` : `<p>Execute um teste para validar credenciais, Issuer e classe.</p>`}
          ${summary}
          ${diagnostics.demoModeNotice ? `<p class="integration-demo-note">${escapeHtml(diagnostics.demoModeNotice)}</p>` : ""}
        </div>
      `;
    }

    function renderIntegrationContext(integration, testResult = null) {
      const values = integration.values || {};
      return `
        <div class="integration-context-status">
          <span class="integration-status ${escapeHtml(integration.status || "pending")}">${integrationStatusLabel(integration)}</span>
          <strong>${integration.enabled ? "Ativa no sistema" : "Desativada"}</strong>
          <p>${integration.configured ? "Credenciais mínimas configuradas." : "Preencha os campos obrigatórios para usar esta integração."}</p>
        </div>
        <dl class="integration-context-list">
          <div>
            <dt>Área</dt>
            <dd>${escapeHtml(integrationCategory(integration.key))}</dd>
          </div>
          <div>
            <dt>Ambiente</dt>
            <dd>${escapeHtml(integration.environment === "sandbox" ? "Sandbox" : "Produção")}</dd>
          </div>
          ${integration.key === "googleWallet" ? `
            <div>
              <dt>Service Account</dt>
              <dd>${values.clientEmail ? escapeHtml(values.clientEmail) : "Não importada"}</dd>
            </div>
            <div>
              <dt>Credencial</dt>
              <dd>${values.serviceAccountConfigured ? "JSON salvo com segurança" : "Pendente"}</dd>
            </div>
          ` : ""}
          <div>
            <dt>Último teste</dt>
            <dd>${integration.lastTestAt ? escapeHtml(new Date(integration.lastTestAt).toLocaleString("pt-BR")) : "Ainda não testada"}</dd>
          </div>
          <div>
            <dt>Resultado</dt>
            <dd>${escapeHtml(testResult?.message || integration.lastTestMessage || "Sem mensagem registrada")}</dd>
          </div>
        </dl>
        ${integration.key === "googleWallet" ? integrationDiagnosticsMarkup(testResult?.checks, testResult?.diagnostics) : ""}
        ${integration.key === "crm" ? `
          <section class="integration-catalog-access">
            <strong>O que esta integração recebe</strong>
            <p>Somente os eventos marcados são enfileirados. A entrega usa HMAC SHA-256 com timestamp, timeout configurável e fila persistente com novas tentativas para falhas transitórias.</p>
            <p>Fila: ${Number(integration.outbox?.queued || 0)} pendente(s), ${Number(integration.outbox?.processing || 0)} em processamento, ${Number(integration.outbox?.dead || 0)} em dead letter.</p>
            <button class="ghost-button" type="button" data-admin-command="retry-crm-dead-letters" ${Number(integration.outbox?.dead || 0) ? "" : "disabled"}>Reenfileirar falhas</button>
            <small>Falhas permanentes ficam para inspeção. Itens ainda pendentes que forem desmarcados são cancelados antes de enviar.</small>
          </section>
        ` : ""}
        ${integration.key === "discord" ? `
          <section class="integration-catalog-access">
            <strong>O que será enviado</strong>
            <p>Alertas de erro, falhas HTTP, desempenho, eventos de segurança e um resumo periódico de CPU, memória, disco e latência. Os eventos informativos podem ser ligados separadamente.</p>
            <p>Os embeds omitem IP, dados de clientes, conteúdo de requisições e credenciais. Tentativas de SQL injection são sinalizadas por padrões heurísticos em URL e query, sem bloquear a requisição e sem inspecionar corpos POST.</p>
          </section>
        ` : ""}
        ${integration.key === "commercialCatalog" ? commercialCatalogAccessMarkup() : ""}
      `;
    }

    function integrationFieldInput(field, integration) {
      const value = integration.values?.[field.key] ?? "";
      if (field.type === "boolean") {
        return `
          <label class="check-field ${field.full ? "full" : ""}">
            <input type="checkbox" data-integration-field="${escapeHtml(field.key)}" data-integration-original="${value ? "true" : "false"}" ${value ? "checked" : ""} />
            <span>${escapeHtml(field.label)}</span>
          </label>
        `;
      }
      if (field.type === "select") {
        return `
          <label>
            ${escapeHtml(field.label)}
            <select data-integration-field="${escapeHtml(field.key)}" data-integration-original="${escapeHtml(String(value))}">
              ${(field.options || []).map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(option === "production" ? "Produção" : option === "sandbox" ? "Sandbox" : option)}</option>`).join("")}
            </select>
          </label>
        `;
      }
      if (field.type === "checkboxGroup") {
        const selected = new Set(Array.isArray(value) ? value : String(value || "").split(",").map((item) => item.trim()));
        const original = escapeHtml(JSON.stringify([...selected]));
        return `
          <fieldset class="integration-checkbox-group" data-integration-checkbox-group="${escapeHtml(field.key)}" data-integration-original="${original}">
            <legend>${escapeHtml(field.label)}</legend>
            ${(field.options || []).map((option) => `
              <label class="check-field">
                <input type="checkbox" data-integration-field="${escapeHtml(field.key)}" data-integration-option="${escapeHtml(option)}" ${selected.has(option) ? "checked" : ""} />
                <span>${escapeHtml(option)}</span>
              </label>
            `).join("")}
          </fieldset>
        `;
      }
      const secret = integration.secrets?.[field.key];
      const placeholders = {
        publicKey: "Ex.: APP_USR-...",
        accessToken: "Cole o token de acesso",
        webhookSecret: "Cole o segredo do webhook",
        pointStoreId: "Ex.: STORE123",
        pointPosId: "Ex.: POS001",
        pointDeviceId: "Ex.: DEVICE001",
        clientId: "Ex.: 000000000000-abc.apps.googleusercontent.com",
        clientSecret: "Cole o segredo do cliente",
        redirectUri: "Ex.: https://seusite.com/api/auth/google/callback",
        issuerId: "Ex.: 3388000000020000000",
        classId: "Ex.: emissor.classe_ingresso",
        serviceAccountJson: "Cole o JSON completo da Service Account",
        origins: "Ex.: https://seusite.com",
        apiKey: "Cole a chave da API",
        bearerToken: "Cole o bearer token",
        fromEmail: "Ex.: ingressos@seusite.com",
        fromName: "Ex.: Cine Cruzeiro",
        replyTo: "Ex.: atendimento@seusite.com",
        notificationEmail: "Ex.: contato@seusite.com",
        smtpHost: "Ex.: smtp.seuprovedor.com",
        smtpPort: "Ex.: 587",
        smtpUser: "Ex.: ingressos@seusite.com",
        smtpPassword: "Cole a senha SMTP",
        webhookUrl: "Ex.: https://api.seusite.com/webhook",
        googleMeasurementId: "Ex.: G-XXXXXXXXXX",
        metaPixelId: "Ex.: 123456789012345",
        url: "Ex.: https://crm.seusite.com/webhook",
        webhookUrl: "https://discord.com/api/webhooks/ID/TOKEN (tratado como segredo)",
        secret: "Cole o segredo de assinatura",
        events: "Ex.: order.created,payment.approved",
        timeout: "Ex.: 8000",
        retryLimit: "Ex.: 2",
        allowedOrigins: "Ex.: https://app.parceira.com",
        cacheSeconds: "Ex.: 60"
      };
      const placeholder = field.secret && secret?.hasValue ? "Valor já salvo; preencha apenas para substituir" : field.placeholder || placeholders[field.key] || "";
      const common = `data-integration-field="${escapeHtml(field.key)}" data-integration-original="${field.secret ? "" : escapeHtml(String(value))}" ${field.secret ? `data-secret="true" autocomplete="off" spellcheck="false"` : ""} placeholder="${escapeHtml(placeholder)}"`;
      const labelClass = field.multiline ? "full" : "";
      if (field.multiline) {
        return `
          <label class="${labelClass} integration-field ${field.secret ? "secret-field" : ""}">
            ${escapeHtml(field.label)}
            <textarea rows="${field.key === "serviceAccountJson" ? "7" : "4"}" ${common}></textarea>
            ${integrationSecurityHint(field, integration)}
          </label>
        `;
      }
      return `
        <label class="integration-field ${field.secret ? "secret-field" : ""}">
          ${escapeHtml(field.label)}
          <input type="${field.secret ? "password" : escapeHtml(field.type || "text")}" value="${field.secret ? "" : escapeHtml(value)}" ${common} />
          ${integration.key === "commercialCatalog" && field.key === "accessToken" ? `<button class="ghost-button" type="button" data-admin-command="generate-commercial-token">Gerar token seguro</button>` : ""}
          ${integrationSecurityHint(field, integration)}
        </label>
      `;
    }

    function webhookStep(label, stateValue, detail) {
      const stateClass = stateValue === "ok" ? "ok" : stateValue === "error" ? "error" : "muted";
      return `
        <li class="webhook-step ${stateClass}">
          <span class="webhook-step-mark" aria-hidden="true"></span>
          <span><strong>${escapeHtml(label)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</span>
        </li>
      `;
    }

    function renderWebhookRun(run) {
      const target = $("webhookTestResult");
      if (!target) return;
      if (!run) {
        target.innerHTML = `<div class="empty-state compact"><strong>Nenhum teste executado</strong><span>Simule uma notificação para acompanhar cada etapa do fluxo.</span></div>`;
        return;
      }
      const request = run.request || {};
      const processing = run.processing || {};
      const signatureRejectedAsExpected = run.expectedStatus === 401 && run.httpStatus === 401;
      const signatureState = run.signatureValid || signatureRejectedAsExpected ? "ok" : "error";
      const recognizedState = run.httpStatus === 401 ? "muted" : processing.recognized === false ? (run.scenario === "unknown_event" ? "ok" : "error") : "ok";
      const orderState = processing.orderLocated === true ? "ok" : processing.orderLocated === false ? (run.scenario === "resource_not_found" || run.scenario === "unknown_event" ? "ok" : "muted") : "muted";
      const stateUpdated = processing.stateUpdated === true ? "ok" : run.duplicate || run.expectedStatus !== 200 || run.scenario === "resource_not_found" || run.scenario === "unknown_event" ? "ok" : "muted";
      target.innerHTML = `
        <div class="webhook-result-head">
          <div>
            <span class="webhook-http ${run.passed ? "ok" : "error"}">HTTP ${escapeHtml(run.httpStatus || "sem resposta")}</span>
            <strong>${run.passed ? "Comportamento confirmado" : "Teste requer atenção"}</strong>
          </div>
          <span>${escapeHtml(`${Number(run.elapsedMs || 0)} ms`)}</span>
        </div>
        <dl class="webhook-result-meta">
          <div><dt>Evento</dt><dd>${escapeHtml(run.action || "")}</dd></div>
          <div><dt>Resource ID</dt><dd>${escapeHtml(run.resourceId || "")}</dd></div>
          <div><dt>Referência</dt><dd>${escapeHtml(run.externalReference || "")}</dd></div>
          <div><dt>Request ID</dt><dd>${escapeHtml(run.requestId || "")}</dd></div>
        </dl>
        <ol class="webhook-steps">
          ${webhookStep("Webhook recebido", run.httpStatus ? "ok" : "error", run.httpStatus ? `Resposta HTTP ${run.httpStatus}` : "Sem resposta do endpoint")}
          ${webhookStep("Headers obrigatórios", request.signaturePresent && request.requestIdPresent ? "ok" : run.expectedStatus === 401 ? "ok" : "error", `x-signature ${request.signaturePresent ? "presente" : "ausente"}; x-request-id ${request.requestIdPresent ? "presente" : "ausente"}`)}
          ${webhookStep("data.id da query", request.dataIdPresent ? "ok" : run.expectedStatus === 401 ? "ok" : "error", request.dataIdPresent ? "Parâmetro encontrado" : "Parâmetro ausente")}
          ${webhookStep("Validação da assinatura", signatureState, run.signatureValid ? "HMAC validado" : signatureRejectedAsExpected ? "Rejeição esperada confirmada" : "Assinatura não validada")}
          ${webhookStep("Evento interpretado", recognizedState, processing.recognized === false ? "Evento desconhecido aceito sem alteração" : run.httpStatus === 401 ? "Não processado após rejeição" : "Evento reconhecido")}
          ${webhookStep("Pedido localizado", orderState, processing.orderLocated === true ? "Pedido de teste encontrado" : processing.orderLocated === false ? "Nenhum pedido correspondente" : "Etapa não aplicável")}
          ${webhookStep("Estado e idempotência", stateUpdated, run.duplicate ? "Reenvio detectado sem duplicação" : processing.stateUpdated ? `Estado atualizado para ${processing.status || "novo status"}` : "Nenhuma duplicação ou alteração indevida")}
        </ol>
        <div class="webhook-result-message">${escapeHtml(run.result || "")}</div>
      `;
    }

    function renderWebhookHistory() {
      const target = $("webhookTestHistory");
      if (!target) return;
      const runs = state.webhookSimulatorRuns || [];
      const pageSize = state.webhookHistoryPageSize || 8;
      const pages = Math.max(1, Math.ceil(runs.length / pageSize));
      state.webhookHistoryPage = Math.min(Math.max(1, state.webhookHistoryPage || 1), pages);
      const start = (state.webhookHistoryPage - 1) * pageSize;
      const pageRuns = runs.slice(start, start + pageSize);
      $("webhookHistoryCount").textContent = runs.length ? `${runs.length} registro${runs.length === 1 ? "" : "s"}` : "Nenhum teste";
      target.innerHTML = runs.length ? pageRuns.map((run) => `
        <div class="webhook-history-row ${state.selectedWebhookRunId === run.id ? "selected" : ""}">
          <button type="button" class="webhook-history-main" data-webhook-action="show" data-webhook-id="${escapeHtml(run.id)}">
            <span>${escapeHtml(new Date(run.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))}</span>
            <strong>${escapeHtml(run.action || "Evento")}</strong>
            <span class="truncate">${escapeHtml(run.resourceId || "")}</span>
            <span class="webhook-http ${run.passed ? "ok" : "error"}">${escapeHtml(String(run.httpStatus || "--"))}</span>
            <span>${escapeHtml(run.passed ? "Aprovado" : "Falhou")}</span>
          </button>
          <button class="ghost-button webhook-resend" type="button" data-webhook-action="resend" data-webhook-id="${escapeHtml(run.id)}">Reenviar</button>
        </div>
      `).join("") + (runs.length > pageSize ? `
        <div class="table-pagination-bar">
          <span>Exibindo <strong>${start + 1}–${Math.min(start + pageRuns.length, runs.length)}</strong> de <strong>${runs.length}</strong></span>
          <div class="pager-controls">
            <button class="ghost-button" type="button" ${state.webhookHistoryPage <= 1 ? "disabled" : ""} data-static-pager="webhook-history" data-page-delta="-1">← Anterior</button>
            <span class="pager-page-indicator">Página ${state.webhookHistoryPage} de ${pages}</span>
            <button class="ghost-button" type="button" ${state.webhookHistoryPage >= pages ? "disabled" : ""} data-static-pager="webhook-history" data-page-delta="1">Próxima →</button>
          </div>
        </div>` : "") : `<div class="empty-state compact"><strong>Console vazio</strong><span>Os testes recentes aparecerão aqui.</span></div>`;
    }

    function changeWebhookHistoryPage(delta) {
      state.webhookHistoryPage = Math.max(1, state.webhookHistoryPage + delta);
      renderWebhookHistory();
    }

    function showWebhookRun(id) {
      const run = state.webhookSimulatorRuns.find((item) => item.id === id);
      if (!run) return;
      state.selectedWebhookRunId = id;
      renderWebhookRun(run);
      renderWebhookHistory();
    }

    function renderWebhookBatchProgress(job) {
      const target = $("webhookTestResult");
      if (!target || !job) return;
      const completed = Number(job.completed || 0);
      const total = Number(job.total || 8);
      const label = job.status === "queued" ? "Aguardando início" : `Executando ${completed} de ${total} cenários`;
      target.innerHTML = `
        <div class="empty-state compact">
          <strong>Bateria de webhooks em andamento</strong>
          <span>${escapeHtml(label)}. A operação continua em segundo plano e não interfere na latência da jornada de compra.</span>
        </div>
      `;
    }

    async function watchWebhookBatch(job, button = null, originalLabel = "Executar bateria de testes", notifyOnComplete = true) {
      if (!job || state.webhookBatchPolling) return job;
      state.webhookBatchPolling = true;
      let current = job;
      try {
        while (["queued", "running"].includes(current.status)) {
          state.webhookBatchJob = current;
          renderWebhookBatchProgress(current);
          if (button) {
            button.disabled = true;
            button.textContent = current.status === "queued" ? "Preparando bateria..." : `Executando ${current.completed || 0}/${current.total || 8} testes...`;
          }
          await new Promise((resolve) => setTimeout(resolve, 900));
          const data = await api(`/api/admin/integrations/mercadoPago/webhook-simulations/batch/${encodeURIComponent(current.id)}`);
          current = data.job;
        }
        state.webhookBatchJob = null;
        await loadWebhookSimulator();
        if (current.status === "completed" && notifyOnComplete) {
          showSuccess("Bateria de Webhooks concluída", `${current.total} testes executados, ${current.passed} aprovados e ${current.failed} ${current.failed === 1 ? "falhou" : "falharam"}.`);
        } else if (current.status !== "completed") {
          showToast(current.error || "A bateria de webhooks não pôde ser concluída.", "error");
        }
      } finally {
        state.webhookBatchPolling = false;
        if (button) {
          button.disabled = false;
          button.textContent = originalLabel;
        }
      }
      return current;
    }

    async function loadWebhookSimulator() {
      const data = await api("/api/admin/integrations/mercadoPago/webhook-simulations");
      state.webhookSimulatorRuns = data.runs || [];
      state.webhookBatchJob = data.activeBatch || null;
      renderWebhookHistory();
      if (state.webhookBatchJob) {
        renderWebhookBatchProgress(state.webhookBatchJob);
        if (!state.webhookBatchPolling) {
          void watchWebhookBatch(state.webhookBatchJob, $("webhookBatchButton"), "Executar bateria de testes", false);
        }
      } else {
        renderWebhookRun(state.webhookSimulatorRuns.find((item) => item.id === state.selectedWebhookRunId) || state.webhookSimulatorRuns[0]);
      }
    }

    function webhookSimulationPayload() {
      return {
        action: $("webhookTestAction").value,
        status: $("webhookTestStatus").value,
        resourceId: $("webhookTestResourceId").value.trim(),
        externalReference: $("webhookTestExternalReference").value.trim(),
        amount: Number($("webhookTestAmount").value || 10),
        scenario: $("webhookTestScenario").value
      };
    }

    async function simulateWebhook() {
      const button = $("webhookSimulateButton");
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "Simulando...";
      try {
        const data = await api("/api/admin/integrations/mercadoPago/webhook-simulations", {
          method: "POST",
          body: JSON.stringify(webhookSimulationPayload())
        });
        state.webhookSimulatorRuns.unshift(data.run);
        state.webhookSimulatorRuns = state.webhookSimulatorRuns.slice(0, 60);
        state.selectedWebhookRunId = data.run.id;
        renderWebhookRun(data.run);
        renderWebhookHistory();
        showToast(data.run.passed ? "Webhook testado com o comportamento esperado." : "O teste encontrou uma divergência.", data.run.passed ? "ok" : "error");
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    }

    async function runWebhookBatch() {
      const button = $("webhookBatchButton");
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "Iniciando bateria...";
      try {
        const data = await api("/api/admin/integrations/mercadoPago/webhook-simulations/batch", { method: "POST" });
        await watchWebhookBatch(data.job, button, original);
      } catch (error) {
        showToast(error.message, "error");
        button.disabled = false;
        button.textContent = original;
      } finally {
        if (!state.webhookBatchPolling) {
          button.disabled = false;
          button.textContent = original;
        }
      }
    }

    async function resendWebhookRun(id) {
      try {
        const data = await api(`/api/admin/integrations/mercadoPago/webhook-simulations/${encodeURIComponent(id)}/resend`, { method: "POST" });
        state.webhookSimulatorRuns.unshift(data.run);
        state.webhookSimulatorRuns = state.webhookSimulatorRuns.slice(0, 60);
        state.selectedWebhookRunId = data.run.id;
        renderWebhookRun(data.run);
        renderWebhookHistory();
        showToast(data.run.duplicate ? "Idempotência confirmada: nenhuma duplicação." : "Webhook reenviado.", data.run.passed ? "ok" : "error");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function openIntegrationConfig(key) {
      try {
        const data = await api(`/api/admin/integrations/${encodeURIComponent(key)}`);
        const integration = data.integration;
        state.selectedIntegrationKey = integration.key;
        $("integrationTitle").textContent = integration.name;
        $("integrationSubtitle").textContent = integration.purpose || "Configure o provider selecionado.";
        $("integrationFields").innerHTML = (integration.fields || []).map((field) => integrationFieldInput(field, integration)).join("");
        if ($("integrationContext")) {
          $("integrationContext").innerHTML = renderIntegrationContext(integration);
        }
        $("integrationDisableButton").textContent = integration.enabled ? "Desativar" : "Ativar";
        $("integrationDisableButton").className = integration.enabled ? "danger-button" : "ghost-button";
        $("integrationTestButton").textContent = "Testar conexão";
        const webhookPanel = $("webhookTesterPanel");
        webhookPanel.hidden = integration.key !== "mercadoPago";
        $("integrationOverlay").hidden = false;
        if (integration.key === "commercialCatalog") {
          document.querySelector('[data-integration-field="accessToken"]')?.addEventListener("input", updateCommercialCatalogLinkPreview);
          updateCommercialCatalogLinkPreview();
        }
        if (integration.key === "mercadoPago") await loadWebhookSimulator();
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    function closeIntegrationConfig() {
      state.selectedIntegrationKey = "";
      if ($("integrationOverlay")) $("integrationOverlay").hidden = true;
    }

    function collectIntegrationForm() {
      const payload = {};
      const collectedGroups = new Set();
      $("integrationForm").querySelectorAll("[data-integration-field]").forEach((input) => {
        const key = input.dataset.integrationField;
        if (!key) return;
        if (input.dataset.integrationOption) {
          if (collectedGroups.has(key)) return;
          collectedGroups.add(key);
          const group = input.closest("[data-integration-checkbox-group]");
          const current = [...group.querySelectorAll("[data-integration-option]:checked")].map((option) => option.dataset.integrationOption);
          let original = [];
          try { original = JSON.parse(group.dataset.integrationOriginal || "[]"); } catch {}
          if (JSON.stringify(current) !== JSON.stringify(original)) payload[key] = current;
          return;
        }
        if (input.type === "checkbox") {
          if (String(input.checked) === input.dataset.integrationOriginal) return;
          payload[key] = input.checked;
          return;
        }
        const value = input.value || "";
        if (input.dataset.secret === "true" && !value.trim()) return;
        if (input.dataset.secret !== "true" && value === (input.dataset.integrationOriginal || "")) return;
        payload[key] = value;
      });
      return payload;
    }

    async function persistIntegrationForm({ close = true, announce = true } = {}) {
      const key = state.selectedIntegrationKey;
      if (!key) return null;
      const data = await api(`/api/admin/integrations/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify(collectIntegrationForm())
      });
      state.integrations.integrations[key] = data.integration;
      renderIntegrations();
      if (close) closeIntegrationConfig();
      if (announce) showToast("Integração salva com segurança.");
      return data.integration;
    }

    async function saveIntegration(event) {
      event.preventDefault();
      const submitButton = event.submitter || $("integrationForm").querySelector('button[type="submit"]');
      const originalLabel = submitButton?.textContent || "Salvar configuração";
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Salvando...";
      }
      try {
        await persistIntegrationForm();
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalLabel;
        }
      }
    }

    async function testIntegration(key) {
      const button = $("integrationTestButton");
      const originalLabel = button?.textContent || "Testar conexão";
      if (button) {
        button.disabled = true;
        button.textContent = "Salvando e testando...";
      }
      try {
        if (state.selectedIntegrationKey === key) {
          const formPayload = collectIntegrationForm();
          if (Object.keys(formPayload).length > 0) {
            await persistIntegrationForm({ close: false, announce: false });
          }
        }
        const result = await api(`/api/admin/integrations/${encodeURIComponent(key)}/test`, { method: "POST" });
        if (state.integrations?.integrations && result.integration) state.integrations.integrations[key] = result.integration;
        renderIntegrations();
        if (state.selectedIntegrationKey === key && $("integrationContext") && result.integration) {
          $("integrationContext").innerHTML = renderIntegrationContext(result.integration, result);
        }
        showToast(result.message || "Integração testada.", result.ok ? "ok" : "error");
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalLabel;
        }
      }
    }

    async function toggleIntegration(key, enabled) {
      try {
        const result = await api(`/api/admin/integrations/${encodeURIComponent(key)}/${enabled ? "enable" : "disable"}`, { method: "POST" });
        if (state.integrations?.integrations) state.integrations.integrations[key] = result.integration;
        renderIntegrations();
        if (["mercadoPago", "pagBank"].includes(key)) {
          state.onlinePaymentProvider = undefined;
          refreshPointProviderControls();
        }
        showToast(enabled ? "Integração ativada." : "Integração desativada.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }
    return {
      renderIntegrations, integrationCategory, integrationStatusLabel, integrationSecurityHint, commercialCatalogEndpointUrl, commercialCatalogAccessMarkup,
      updateCommercialCatalogLinkPreview, loadCommercialCatalogToken, revealCommercialCatalogToken, copyCommercialCatalogToken, generateCommercialCatalogToken, copyCommercialCatalogLink,
      integrationDiagnosticsMarkup, renderIntegrationContext, integrationFieldInput, webhookStep, renderWebhookRun, renderWebhookHistory,
      changeWebhookHistoryPage, showWebhookRun, renderWebhookBatchProgress, watchWebhookBatch, loadWebhookSimulator, webhookSimulationPayload,
      simulateWebhook, runWebhookBatch, resendWebhookRun, openIntegrationConfig, closeIntegrationConfig, collectIntegrationForm,
      persistIntegrationForm, saveIntegration, testIntegration, toggleIntegration
    };
  }
  const api = Object.freeze({ createIntegrationAdministration });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.integrationAdministration = api; }
})(globalThis);
