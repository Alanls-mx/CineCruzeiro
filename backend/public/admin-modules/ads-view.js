((root) => {
  function createAdsView({ state, $, api, cleanAdminAssetUrl, confirm, creationPlaceholder, currentAd, datetimeIsoValue, datetimeLocalValue, escapeHtml, loadContent, paginateAdminItems, renderAdminImagePreview, renderAdminListPager, renderMarketingOverview, setAdminSubtab, setDisabled, showSuccess, showToast, syncCreationControl }) {
function renderAds() {
  const items = state.content?.ads || [];
  renderAdsMasterControl();
  if (state.creating.ad) {
    $("adsList").innerHTML = creationPlaceholder("Novo anúncio", "Envie a imagem que será exibida abaixo das sessões dos filmes.");
    fillAdForm(null);
    return;
  }
  const pagination = paginateAdminItems(items, "ads", "selectedAdId");
  $("adsList").innerHTML = items.length
    ? pagination.pageItems.map((item) => {
        const now = Date.now();
        const scheduled = item.startsAt && new Date(item.startsAt).getTime() > now;
        const ended = item.endsAt && new Date(item.endsAt).getTime() <= now;
        const status = item.active === false ? "inativo" : scheduled ? "agendado" : ended ? "encerrado" : "em exibição";
        return `
        <button class="list-item ${item.id === state.selectedAdId ? "active" : ""}" type="button" data-admin-select-kind="ad" data-admin-select-id="${escapeHtml(item.id)}">
          <span>
            <span class="list-title">${escapeHtml(item.title)}</span>
            <span class="list-meta">Páginas dos filmes • ${status} • ${Number(item.impressions || 0).toLocaleString("pt-BR")} impressões • ${Number(item.clicks || 0).toLocaleString("pt-BR")} cliques</span>
          </span>
          <span class="badge">Ad</span>
        </button>
      `;
      }).join("") + renderAdminListPager("ads", pagination, "anúncio(s)")
    : `<div class="empty-state"><strong>Nenhum anuncio</strong><span>Crie banners e destaques comerciais.</span></div>`;
  fillAdForm(currentAd());
}

function renderAdsMasterControl() {
  const enabled = state.content?.settings?.adsEnabled !== false;
  const status = $("adsMasterStatus");
  const button = $("adsMasterToggle");
  if (status) {
    status.className = `status-label ${enabled ? "ok" : "muted"}`;
    status.innerHTML = `<span class="status-dot" aria-hidden="true"></span>${enabled ? "Em exibição" : "Desligados"}`;
  }
  if (button) {
    button.setAttribute("aria-checked", String(enabled));
    button.disabled = state.adsStatusUpdating;
    button.textContent = state.adsStatusUpdating
      ? (enabled ? "Desligando..." : "Ligando...")
      : (enabled ? "Desligar anúncios" : "Ligar anúncios");
  }
}

async function toggleAdsStatus() {
  if (state.adsStatusUpdating) return;
  const enabled = state.content?.settings?.adsEnabled !== false;
  state.adsStatusUpdating = true;
  renderAdsMasterControl();
  try {
    const result = await api("/api/ads/status", {
      method: "PUT",
      body: JSON.stringify({ enabled: !enabled })
    });
    state.content.settings = { ...(state.content.settings || {}), adsEnabled: result.enabled !== false };
    state.marketingOverviewData = await api("/api/admin/marketing/overview").catch(() => state.marketingOverviewData);
    renderMarketingOverview();
    showSuccess(
      result.enabled === false ? "Anúncios desligados" : "Anúncios ligados",
      result.enabled === false
        ? "A exibição e a coleta de novas métricas foram suspensas no site."
        : "Os anúncios ativos e dentro do agendamento voltaram a ser exibidos."
    );
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    state.adsStatusUpdating = false;
    renderAdsMasterControl();
  }
}

function selectAd(id) {
  state.creating.ad = false;
  state.selectedAdId = id;
  renderAds();
}

function newAd() {
  setAdminSubtab("marketing", "ads");
  state.creating.ad = true;
  state.selectedAdId = "";
  $("adsList").innerHTML = creationPlaceholder("Novo anúncio", "Envie a imagem que será exibida abaixo das sessões dos filmes.");
  fillAdForm(null);
}

function fillAdForm(item) {
  syncCreationControl("ad", "cancelAdCreateButton", "deleteAdButton", Boolean(item));
  setDisabled("deleteAdButton", !item);
  $("adId").value = item?.id || "";
  $("adTitle").value = item?.title || "";
  $("adDescription").value = item?.description || "";
  $("adPlacement").value = "movie";
  $("adImageUrl").value = item?.imageUrl || "";
  $("adLinkUrl").value = item?.linkUrl || "";
  $("adCtaLabel").value = item?.ctaLabel || "";
  $("adStartsAt").value = datetimeLocalValue(item?.startsAt);
  $("adEndsAt").value = datetimeLocalValue(item?.endsAt);
  $("adActive").checked = item?.active !== false;
  renderAdminImagePreview("adImageUrl", "adImagePreview", "Prévia do anúncio");
}

async function saveAd(event) {
  event.preventDefault();
  try {
    const payload = {
      id: $("adId").value || undefined,
      title: $("adTitle").value,
      description: $("adDescription").value,
      placement: $("adPlacement").value,
      imageUrl: cleanAdminAssetUrl($("adImageUrl").value),
      linkUrl: $("adLinkUrl").value,
      ctaLabel: $("adCtaLabel").value,
      startsAt: datetimeIsoValue($("adStartsAt").value),
      endsAt: datetimeIsoValue($("adEndsAt").value),
      active: $("adActive").checked
    };
    const existingId = $("adId").value;
    const saved = existingId
      ? await api(`/api/ads/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/ads", { method: "POST", body: JSON.stringify(payload) });
    state.creating.ad = false;
    state.selectedAdId = saved.id;
    await loadContent({ silent: true });
    showSuccess("Anúncio salvo", `${saved.title} foi atualizado.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteAd() {
  const item = currentAd();
  if (!item || !confirm(`Excluir ${item.title}?`)) return;
  try {
    await api(`/api/ads/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    state.selectedAdId = "";
    await loadContent({ silent: true });
    showToast("Anúncio excluído.");
  } catch (error) {
    showToast(error.message, "error");
  }
}
    return { renderAds, renderAdsMasterControl, toggleAdsStatus, selectAd, newAd, fillAdForm, saveAd, deleteAd };
  }

  const api = Object.freeze({ createAdsView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.CineAdminModules ||= {};
    root.CineAdminModules.adsView = api;
  }
})(globalThis);
