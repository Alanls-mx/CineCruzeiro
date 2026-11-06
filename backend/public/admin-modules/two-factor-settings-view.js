((root) => {
  function createTwoFactorSettingsView({ $, escapeHtml, state, twoFactorDate }) {
    function renderTwoFactorSettings() {
      const body = $("twoFactorBody");
      if (!body) return;
      if (!state.twoFactorStatus) {
        body.innerHTML = `<div class="two-factor-loading"><span class="loading-spinner"></span>Carregando segurança da conta...</div>`;
        return;
      }
      if (state.twoFactorStatus.configurationReady === false) {
        body.innerHTML = `
          <div class="two-factor-status danger-zone">
            <span class="two-factor-status-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M12 8v4M12 16h.01"/></svg></span>
            <div><strong>2FA aguardando configuração do servidor</strong><span>A chave de proteção ainda não foi definida. Nenhuma configuração incompleta será salva.</span></div>
          </div>`;
        return;
      }
      if (state.twoFactorRecoveryCodes.length) {
        body.innerHTML = `
          <div class="two-factor-success">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            <div><strong>2FA ativo</strong><span>Estes códigos aparecem uma única vez.</span></div>
          </div>
          <p class="two-factor-instruction">Guarde os códigos em um local seguro. Cada código substitui o autenticador apenas uma vez.</p>
          <div class="recovery-code-grid">${state.twoFactorRecoveryCodes.map((code) => `<code>${escapeHtml(code)}</code>`).join("")}</div>
          <div class="button-row">
            <button class="primary-button" type="button" data-two-factor-action="copy-recovery">Copiar códigos</button>
            <button class="ghost-button" type="button" data-two-factor-action="download-recovery">Baixar arquivo</button>
            <button class="ghost-button" type="button" data-two-factor-action="finish">Concluir</button>
          </div>`;
        return;
      }
      if (state.twoFactorSetup) {
        const groupedSecret = String(state.twoFactorSetup.secret || "").match(/.{1,4}/g)?.join(" ") || "";
        body.innerHTML = `
          <div class="two-factor-setup-grid">
            <div class="authenticator-qr"><img src="${escapeHtml(state.twoFactorSetup.qrCodeDataUrl)}" alt="QR Code para configurar o aplicativo autenticador" /></div>
            <div class="two-factor-setup-copy">
              <h3>Conecte seu autenticador</h3>
              <ol><li>Abra Google Authenticator, Microsoft Authenticator, Authy ou equivalente.</li><li>Escaneie o QR Code.</li><li>Informe abaixo o código de 6 dígitos.</li></ol>
              <div class="manual-secret"><span>Chave manual</span><code>${escapeHtml(groupedSecret)}</code></div>
            </div>
          </div>
          <form id="twoFactorEnableForm" class="two-factor-action-form">
            <label>Código do aplicativo<input name="code" class="two-factor-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required /></label>
            <button class="primary-button" type="submit">Ativar autenticação em duas etapas</button>
          </form>
          <p class="helper-text">Os códigos mudam a cada 30 segundos. Se não conferir, ative data e hora automáticas no celular e tente o próximo código.</p>`;
        return;
      }
      if (state.twoFactorStatus.enabled) {
        body.innerHTML = `
          <div class="two-factor-status active">
            <span class="two-factor-status-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg></span>
            <div><strong>Autenticação em duas etapas ativa</strong><span>${state.twoFactorStatus.confirmedAt ? `Ativada em ${escapeHtml(twoFactorDate(state.twoFactorStatus.confirmedAt))}. ` : ""}${Number(state.twoFactorStatus.recoveryCodesRemaining || 0)} código(s) de recuperação disponível(is).</span></div>
          </div>
          <div class="two-factor-actions">
            <details>
              <summary>Gerar novos códigos de recuperação</summary>
              <p>Os códigos atuais serão invalidados imediatamente.</p>
              <form id="twoFactorRecoveryForm" class="two-factor-action-form compact">
                <label>Senha atual<input name="password" type="password" autocomplete="current-password" required /></label>
                <label>Código do autenticador<input name="code" class="two-factor-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required /></label>
                <button class="ghost-button" type="submit">Gerar novos códigos</button>
              </form>
            </details>
            ${state.twoFactorStatus.requiredByPolicy ? `
            <div class="two-factor-policy-note"><strong>Proteção obrigatória</strong><span>A política da equipe exige 2FA. Para desativá-lo, o dono deve primeiro desligar a exigência global em Contas.</span></div>` : `
            <details class="danger-zone">
              <summary>Desativar 2FA</summary>
              <p>O painel voltará a aceitar apenas e-mail e senha.</p>
              <form id="twoFactorDisableForm" class="two-factor-action-form compact">
                <label>Senha atual<input name="password" type="password" autocomplete="current-password" required /></label>
                <label>Código ou recuperação<input name="code" class="two-factor-code" autocomplete="one-time-code" maxlength="11" required /></label>
                <button class="danger-button" type="submit">Desativar 2FA</button>
              </form>
            </details>`}
          </div>`;
        return;
      }
      body.innerHTML = `
        <div class="two-factor-status">
          <span class="two-factor-status-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M12 8v4M12 16h.01"/></svg></span>
          <div><strong>2FA ainda não está ativo</strong><span>Depois da senha, o painel solicitará um código temporário do seu celular.</span></div>
        </div>
        <form id="twoFactorSetupForm" class="two-factor-action-form">
          <label>Confirme sua senha atual<input name="password" type="password" autocomplete="current-password" required /></label>
          <button class="primary-button" type="submit">Configurar aplicativo autenticador</button>
        </form>`;
    }

    function renderAccountSecuritySummary() {
      const target = $("accountSecuritySummary");
      if (!target) return;
      const enabled = Boolean(state.twoFactorStatus?.enabled ?? state.adminUser?.twoFactorEnabled);
      const required = Boolean(state.twoFactorStatus?.requiredByPolicy ?? state.content?.settings?.adminTwoFactorRequired);
      if ($("myAccountSecurityState")) {
        const remaining = state.twoFactorStatus?.recoveryCodesRemaining ?? state.adminUser?.twoFactorRecoveryCodesRemaining ?? 0;
        $("myAccountSecurityState").textContent = enabled
          ? `2FA ativo · ${remaining} códigos de recuperação disponíveis. Os códigos só são exibidos ao gerar um novo conjunto.`
          : "2FA ainda não configurado para esta conta.";
      }
      target.innerHTML = `
        <span class="security-state ${enabled ? "active" : "pending"}">${enabled ? "Protegida" : "Configuração pendente"}</span>
        <strong>${enabled ? "Seu acesso exige senha e código temporário" : "Adicione uma segunda etapa ao seu login"}</strong>
        <p>${required ? "A política atual exige 2FA para todas as contas administrativas." : "O 2FA é opcional na política atual, mas recomendado para contas administrativas."}</p>`;
    }
    return { renderTwoFactorSettings, renderAccountSecuritySummary };
  }
  const api = Object.freeze({ createTwoFactorSettingsView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.twoFactorSettingsView = api; }
})(globalThis);
