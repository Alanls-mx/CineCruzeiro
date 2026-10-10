((root) => {
  function createPromotionsView({ state, $, api, confirm, creationPlaceholder, currentPromotion, datetimeIsoValue, datetimeLocalValue, escapeHtml, money, paginateAdminItems, removeAdminCollectionItem, renderAdminListPager, setAdminSubtab, setDisabled, showSuccess, showToast, syncCreationControl, upsertAdminCollection }) {
function renderPromotions() {
  const items = state.content?.promotions || [];
  const activeItems = items.filter((item) => !item.archivedAt);
  const archivedItems = items.filter((item) => Boolean(item.archivedAt));
  const visibleItems = state.promotionView === "archived" ? archivedItems : activeItems;
  $("activePromotionsCount").textContent = String(activeItems.length);
  $("archivedPromotionsCount").textContent = String(archivedItems.length);
  $("activePromotionsTab").classList.toggle("active", state.promotionView === "active");
  $("activePromotionsTab").setAttribute("aria-selected", String(state.promotionView === "active"));
  $("archivedPromotionsTab").classList.toggle("active", state.promotionView === "archived");
  $("archivedPromotionsTab").setAttribute("aria-selected", String(state.promotionView === "archived"));
  if (state.creating.promotion) {
    $("promotionsList").innerHTML = creationPlaceholder("Novo cupom", "Configure a regra comercial no quadro à direita.");
    fillPromotionForm(null);
    return;
  }
  const pagination = paginateAdminItems(visibleItems, "promotions", "selectedPromotionId");
  $("promotionsList").innerHTML = visibleItems.length
    ? pagination.pageItems.map((item) => `
        <button class="list-item ${item.id === state.selectedPromotionId ? "active" : ""}" type="button" data-admin-select-kind="promotion" data-admin-select-id="${escapeHtml(item.id)}">
          <span>
            <span class="list-title">${escapeHtml(item.title)}</span>
            <span class="list-meta">${item.couponCode ? `${escapeHtml(item.couponCode)} • ${couponRuleLabel(item)} • ` : "promoção sem código • "}${couponStatusLabel(item)}</span>
          </span>
          <span class="badge">${Number(item.usageCount || 0)} uso(s)</span>
        </button>
      `).join("") + renderAdminListPager("promotions", pagination, "cupom(ns)")
    : `<div class="empty-state"><strong>${state.promotionView === "archived" ? "Nenhum cupom arquivado" : "Nenhum cupom ativo"}</strong><span>${state.promotionView === "archived" ? "Cupons expirados e utilizados continuarão disponíveis aqui para consulta." : "Crie códigos de desconto com período e limites de uso."}</span></div>`;
  const selected = currentPromotion();
  fillPromotionForm(selected);
  if (selected && state.promotionUsageCouponId !== selected.id && !state.promotionUsageLoading) {
    void loadPromotionUsage(selected.id, 1);
  }
}

function couponRuleLabel(item) {
  if (item.discountType === "percent") return `${Number(item.value || 0)}%`;
  if (item.discountType === "fixed_price") return `preço final ${money(item.value)}`;
  return `${money(item.value)} de desconto`;
}

function couponStatusLabel(item) {
  if (item.archivedAt) return item.archiveReason === "expired" ? "arquivado após expirar" : "arquivado";
  if (item.active === false) return "inativo";
  const now = Date.now();
  if (item.startsAt && new Date(item.startsAt).getTime() > now) return "agendado";
  if (item.endsAt && new Date(item.endsAt).getTime() < now) return "expirado";
  if (Number(item.usageLimit || 0) > 0 && Number(item.usageCount || 0) >= Number(item.usageLimit)) return "limite atingido";
  return "disponível";
}

function setPromotionView(view) {
  state.promotionView = view === "archived" ? "archived" : "active";
  state.creating.promotion = false;
  state.selectedPromotionId = "";
  state.promotionUsageCouponId = "";
  state.promotionUsageHistory = [];
  state.promotionUsageMeta = null;
  state.promotionsPage = 1;
  renderPromotions();
}

function selectPromotion(id) {
  state.creating.promotion = false;
  state.selectedPromotionId = id;
  state.promotionUsageCouponId = "";
  state.promotionUsageHistory = [];
  state.promotionUsageMeta = null;
  renderPromotions();
}

function newPromotion() {
  setAdminSubtab("marketing", "promotions");
  state.promotionView = "active";
  state.creating.promotion = true;
  state.selectedPromotionId = "";
  $("promotionsList").innerHTML = creationPlaceholder("Novo cupom", "Configure a regra comercial no quadro à direita.");
  fillPromotionForm(null);
}

function fillPromotionForm(item) {
  syncCreationControl("promotion", "cancelPromotionCreateButton", "deletePromotionButton", Boolean(item));
  const hasUsage = Number(item?.usageCount || 0) > 0;
  const archivedWithHistory = Boolean(item?.archivedAt && hasUsage);
  setDisabled("deletePromotionButton", !item || archivedWithHistory);
  if ($("deletePromotionButton")) {
    $("deletePromotionButton").textContent = archivedWithHistory ? "Arquivado" : hasUsage ? "Arquivar" : "Excluir";
  }
  $("promotionId").value = item?.id || "";
  $("promotionTitle").value = item?.title || "";
  $("promotionDescription").value = item?.description || "";
  $("promotionDiscountType").value = item?.discountType || "percent";
  $("promotionValue").value = item?.value ?? 10;
  $("promotionCouponCode").value = item?.couponCode || "";
  $("promotionAppliesTo").value = item?.appliesTo || "all";
  $("promotionMinimumOrderValue").value = Number(item?.minimumOrderValue || 0) || "";
  $("promotionMaximumDiscount").value = Number(item?.maximumDiscount || 0) || "";
  $("promotionUsageLimit").value = Number(item?.usageLimit || 0) || "";
  $("promotionPerCustomerLimit").value = Number(item?.perCustomerLimit || 0) || "";
  $("promotionStartsAt").value = datetimeLocalValue(item?.startsAt);
  $("promotionEndsAt").value = datetimeLocalValue(item?.endsAt);
  $("promotionFirstPurchaseOnly").checked = Boolean(item?.firstPurchaseOnly);
  $("promotionAllowClubStacking").checked = Boolean(item?.allowClubStacking);
  $("promotionActive").checked = item?.active !== false;
  const selectedMovies = new Set(item?.allowedMovieIds || []);
  $("promotionAllowedMovieIds").innerHTML = (state.content?.movies || [])
    .map((movie) => `<option value="${escapeHtml(movie.id)}" ${selectedMovies.has(movie.id) ? "selected" : ""}>${escapeHtml(movie.title)}</option>`)
    .join("");
  $("promotionUsageStats").innerHTML = item ? `
    <div class="coupon-usage-stat"><span>Status</span><strong>${couponStatusLabel(item)}</strong></div>
    <div class="coupon-usage-stat"><span>Utilizações pagas</span><strong>${Number(item.usageCount || 0)}</strong></div>
    <div class="coupon-usage-stat"><span>Desconto concedido</span><strong>${money(item.discountGranted)}</strong></div>
  ` : "";
  const archiveNotice = $("promotionArchiveNotice");
  archiveNotice.hidden = !item?.archivedAt;
  archiveNotice.innerHTML = item?.archivedAt
    ? `<strong>Cupom arquivado</strong><span>${item.archiveReason === "expired" ? "A validade terminou" : "Arquivado manualmente"} em ${escapeHtml(formatCouponUsageDate(item.archivedAt))}. O histórico financeiro foi preservado.</span>`
    : "";
  $("promotionUsageHistorySection").hidden = !item;
  renderPromotionUsageHistory();
}

function formatCouponUsageDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function couponOrderReference(orderId) {
  const suffix = String(orderId || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || "000000";
  return `#CC-${suffix}`;
}

function renderPromotionUsageHistory() {
  const container = $("promotionUsageHistory");
  const pager = $("promotionUsagePager");
  const summary = $("promotionUsageHistorySummary");
  if (!container || !pager || !summary) return;
  const item = currentPromotion();
  if (!item) {
    container.innerHTML = "";
    pager.innerHTML = "";
    return;
  }
  if (state.promotionUsageLoading) {
    summary.textContent = "Carregando as compras vinculadas a este cupom.";
    container.innerHTML = `<div class="coupon-history-loading"><span class="inline-spinner" aria-hidden="true"></span>Buscando histórico de uso...</div>`;
    pager.innerHTML = "";
    return;
  }
  const meta = state.promotionUsageMeta;
  summary.textContent = meta?.total
    ? `${meta.total} compra(s) paga(s), com ${money(meta.discountGranted)} concedidos em descontos.`
    : "Nenhuma compra paga utilizou este cupom.";
  container.innerHTML = state.promotionUsageHistory.length
    ? state.promotionUsageHistory.map((usage) => `
        <article class="coupon-history-row">
          <div class="coupon-history-customer">
            <strong>${escapeHtml(usage.customerName || "Cliente")}</strong>
            <span>${escapeHtml(usage.customerEmail || "E-mail não informado")}</span>
          </div>
          <div class="coupon-history-date">
            <span class="coupon-history-label">Data e hora</span>
            <strong>${escapeHtml(formatCouponUsageDate(usage.usedAt))}</strong>
          </div>
          <div class="coupon-history-session">
            <span class="coupon-history-label">Filme e sessão</span>
            <strong>${escapeHtml(usage.movieTitle || "Compra sem filme")}</strong>
            <span>${escapeHtml([usage.sessionDate, usage.sessionTime].filter(Boolean).join(" às ") || "Sessão não informada")}</span>
          </div>
          <div class="coupon-history-order">
            <span class="coupon-history-label">Pedido</span>
            <strong>${escapeHtml(couponOrderReference(usage.orderId))}</strong>
            <span>${escapeHtml([...(usage.ticketItems || []), ...(usage.concessionItems || [])].join(" · ") || "Itens não informados")}</span>
          </div>
          <div class="coupon-history-values">
            <span class="coupon-history-label">Desconto</span>
            <strong>${money(usage.discountAmount)}</strong>
            <span>Total ${money(usage.orderTotal)}</span>
          </div>
        </article>
      `).join("")
    : `<div class="empty-state compact"><strong>Sem utilizações</strong><span>O primeiro pagamento aprovado com este cupom aparecerá aqui.</span></div>`;
  if (!meta || meta.pages <= 1) {
    pager.innerHTML = "";
    return;
  }
  pager.innerHTML = `
    <button type="button" class="ghost-button" ${meta.page <= 1 ? "disabled" : ""} data-promotion-usage-id="${escapeHtml(item.id)}" data-promotion-usage-page="${meta.page - 1}">Anterior</button>
    <span>Página ${meta.page} de ${meta.pages}</span>
    <button type="button" class="ghost-button" ${meta.page >= meta.pages ? "disabled" : ""} data-promotion-usage-id="${escapeHtml(item.id)}" data-promotion-usage-page="${meta.page + 1}">Próxima</button>
  `;
}

async function loadPromotionUsage(couponId, page = 1) {
  if (!couponId) return;
  const requestToken = ++state.promotionUsageRequestToken;
  state.promotionUsageLoading = true;
  renderPromotionUsageHistory();
  try {
    const result = await api(`/api/promotions/${encodeURIComponent(couponId)}/usage?page=${Math.max(1, Number(page || 1))}&pageSize=20`);
    if (requestToken !== state.promotionUsageRequestToken || state.selectedPromotionId !== couponId) return;
    state.promotionUsageCouponId = couponId;
    state.promotionUsageHistory = result.usages || [];
    state.promotionUsageMeta = result;
  } catch (error) {
    if (requestToken !== state.promotionUsageRequestToken) return;
    state.promotionUsageCouponId = couponId;
    state.promotionUsageHistory = [];
    state.promotionUsageMeta = null;
    showToast(error.message, "error");
  } finally {
    if (requestToken === state.promotionUsageRequestToken) {
      state.promotionUsageLoading = false;
      renderPromotionUsageHistory();
    }
  }
}

async function savePromotion(event) {
  event.preventDefault();
  try {
    const payload = {
      id: $("promotionId").value || undefined,
      title: $("promotionTitle").value,
      description: $("promotionDescription").value,
      discountType: $("promotionDiscountType").value,
      value: Number($("promotionValue").value || 0),
      couponCode: $("promotionCouponCode").value,
      appliesTo: $("promotionAppliesTo").value,
      minimumOrderValue: Number($("promotionMinimumOrderValue").value || 0),
      maximumDiscount: Number($("promotionMaximumDiscount").value || 0),
      usageLimit: Number($("promotionUsageLimit").value || 0),
      perCustomerLimit: Number($("promotionPerCustomerLimit").value || 0),
      startsAt: datetimeIsoValue($("promotionStartsAt").value),
      endsAt: datetimeIsoValue($("promotionEndsAt").value),
      firstPurchaseOnly: $("promotionFirstPurchaseOnly").checked,
      allowClubStacking: $("promotionAllowClubStacking").checked,
      allowedMovieIds: Array.from($("promotionAllowedMovieIds").selectedOptions).map((option) => option.value),
      active: $("promotionActive").checked
    };
    const existingId = $("promotionId").value;
    const saved = existingId
      ? await api(`/api/promotions/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/promotions", { method: "POST", body: JSON.stringify(payload) });
    state.creating.promotion = false;
    state.selectedPromotionId = saved.id;
    state.promotionView = saved.archivedAt ? "archived" : "active";
    state.promotionUsageCouponId = "";
    upsertAdminCollection("promotions", saved);
    renderPromotions();
    showSuccess("Cupom salvo", `${saved.title} foi atualizado.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deletePromotion() {
  const item = currentPromotion();
  const hasUsage = Number(item?.usageCount || 0) > 0;
  if (!item || !confirm(hasUsage ? `Arquivar ${item.title}? O histórico de uso continuará disponível.` : `Excluir ${item.title}?`)) return;
  try {
    const result = await api(`/api/promotions/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    state.selectedPromotionId = "";
    state.promotionUsageCouponId = "";
    state.promotionView = result.archived ? "archived" : state.promotionView;
    if (result.archived) upsertAdminCollection("promotions", result);
    else removeAdminCollectionItem("promotions", item.id);
    renderPromotions();
    showToast(result.archived ? "Cupom arquivado. O histórico foi preservado." : "Cupom excluído.");
  } catch (error) {
    showToast(error.message, "error");
  }
}
    return { renderPromotions, couponRuleLabel, couponStatusLabel, setPromotionView, selectPromotion, newPromotion, fillPromotionForm, formatCouponUsageDate, couponOrderReference, renderPromotionUsageHistory, loadPromotionUsage, savePromotion, deletePromotion };
  }

  const api = Object.freeze({ createPromotionsView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.CineAdminModules ||= {};
    root.CineAdminModules.promotionsView = api;
  }
})(globalThis);
