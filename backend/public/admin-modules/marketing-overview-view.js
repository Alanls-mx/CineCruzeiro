((root) => {
  function createMarketingOverviewView({ $, emailCampaignTemplateLabel, escapeHtml, humanizeEnum, state, statusClass }) {
    function renderMarketingOverview() {
      if (!$("marketingOverview")) return;
      const settings = state.content?.settings || {};
      const promotions = state.content?.promotions || [];
      const ads = state.content?.ads || [];
      const coupons = promotions.filter((item) => item.couponCode);
      const metrics = state.marketingOverviewData || {};
      const email = metrics.email || {};
      const advertising = metrics.ads || {};
      const delivered = Number(email.delivered || email.sent || 0);
      const deliveryRate = Number(email.sent || 0) > 0 ? Math.round((delivered / Number(email.sent)) * 100) : 0;
      const clickRate = Number(email.delivered || 0) > 0 && email.clickedSupported
        ? Math.round((Number(email.clicked || 0) / Number(email.delivered)) * 1000) / 10
        : null;
      const adCtr = Number(advertising.impressions || 0) > 0
        ? Math.round((Number(advertising.clicks || 0) / Number(advertising.impressions)) * 1000) / 10
        : 0;
      $("marketingOverview").innerHTML = `
        <div class="mini-insight"><span>E-mails enviados</span><strong>${Number(email.sent || 0).toLocaleString("pt-BR")}</strong><small>${deliveryRate}% entregues</small></div>
        <div class="mini-insight"><span>Cliques em e-mail</span><strong>${email.clickedSupported ? Number(email.clicked || 0).toLocaleString("pt-BR") : "Indisponível"}</strong><small>${clickRate === null ? "Provider sem rastreamento" : `${clickRate}% das entregas`}</small></div>
        <div class="mini-insight"><span>Anúncios ativos</span><strong>${settings.adsEnabled === false ? 0 : Number(advertising.active ?? ads.filter((item) => item.active !== false).length)}</strong><small>${settings.adsEnabled === false ? "Exibição geral desligada" : `${Number(advertising.impressions || 0).toLocaleString("pt-BR")} impressões`}</small></div>
        <div class="mini-insight"><span>Cliques em anúncios</span><strong>${Number(advertising.clicks || 0).toLocaleString("pt-BR")}</strong><small>CTR de ${adCtr}%</small></div>
        <div class="mini-insight"><span>Cupons ativos</span><strong>${Number(metrics.coupons?.active ?? coupons.filter((item) => item.active !== false).length)}</strong><small>${Number(metrics.coupons?.uses || 0).toLocaleString("pt-BR")} uso(s)</small></div>
        <div class="mini-insight"><span>Faixa da home</span><strong>${settings.announcementEnabled === false ? "Oculta" : "Visível"}</strong><small>Canal institucional</small></div>
      `;
      const performance = $("marketingPerformance");
      if (!performance) return;
      const campaigns = metrics.recentCampaigns || [];
      const adRows = metrics.topAds || [];
      performance.innerHTML = `
        <section class="surface marketing-performance-panel">
          <div class="surface-head"><div><div class="section-title">Desempenho dos e-mails</div><p>Envios consolidados, falhas e interações informadas pelo provider.</p></div></div>
          <div class="marketing-funnel">
            <div><span>Destinatários</span><strong>${Number(email.recipients || 0).toLocaleString("pt-BR")}</strong></div>
            <div><span>Enviados</span><strong>${Number(email.sent || 0).toLocaleString("pt-BR")}</strong></div>
            <div><span>Entregues</span><strong>${email.deliveredSupported ? Number(email.delivered || 0).toLocaleString("pt-BR") : "-"}</strong></div>
            <div><span>Aberturas</span><strong>${email.openedSupported ? Number(email.opened || 0).toLocaleString("pt-BR") : "-"}</strong></div>
            <div><span>Cliques</span><strong>${email.clickedSupported ? Number(email.clicked || 0).toLocaleString("pt-BR") : "-"}</strong></div>
            <div><span>Falhas</span><strong>${Number(email.failed || 0).toLocaleString("pt-BR")}</strong></div>
          </div>
          <div class="marketing-rank-list">${campaigns.length ? campaigns.map((item) => `<div><span><strong>${escapeHtml(item.subject || "Campanha")}</strong><small>${escapeHtml(emailCampaignTemplateLabel(item.templateId || "announcement"))} · ${new Date(item.createdAt).toLocaleDateString("pt-BR")}</small></span><span class="status-label ${statusClass(item.status)}">${escapeHtml(item.statusLabel || humanizeEnum(item.status))}</span></div>`).join("") : '<div class="empty-state compact"><strong>Nenhuma campanha enviada</strong><span>Os resultados aparecerão após o primeiro envio.</span></div>'}</div>
        </section>
        <section class="surface marketing-performance-panel">
          <div class="surface-head"><div><div class="section-title">Desempenho dos anúncios</div><p>Exibições e acessos registrados nas posições publicadas do site.</p></div></div>
          <div class="marketing-rank-list">${adRows.length ? adRows.map((item) => `<div><span><strong>${escapeHtml(item.title || "Anúncio")}</strong><small>Páginas dos filmes · ${Number(item.impressions || 0).toLocaleString("pt-BR")} impressões</small></span><strong>${Number(item.clicks || 0).toLocaleString("pt-BR")} cliques</strong></div>`).join("") : '<div class="empty-state compact"><strong>Nenhuma interação registrada</strong><span>Publique um anúncio para começar a medir exibições e cliques.</span></div>'}</div>
        </section>
      `;
    }
    return { renderMarketingOverview };
  }
  const api = Object.freeze({ createMarketingOverviewView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.marketingOverviewView = api; }
})(globalThis);
