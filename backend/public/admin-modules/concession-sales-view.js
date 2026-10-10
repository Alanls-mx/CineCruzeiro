((root) => {
  function createConcessionSalesView({ state, $, api, document, escapeHtml, money, financialStatusEventHtml, showToast, adminCan, executeConcessionRefund, toggleConcessionArchive, deleteConcessionOrder }) {
let concessionSalesLoading = false;
async function loadConcessionDailySales() {
  if (concessionSalesLoading || document.hidden) return;
  concessionSalesLoading = true;
  const target = $("concessionDailySales");
  if (!target) { concessionSalesLoading = false; return; }
  try {
    const dateInput = $("concessionSalesDate");
    if (dateInput && !dateInput.value) {
      dateInput.value = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    }
    const selectedDate = dateInput?.value || "";
    const data = await api(`/api/admin/concession-sales${selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : ""}`);
    state.concessionSalesData = data;
    renderConcessionDailySales();
  } catch (error) {
    target.innerHTML = `<div class="empty-state"><strong>Não foi possível carregar as vendas</strong><span>${escapeHtml(error.message)}</span></div>`;
  } finally {
    concessionSalesLoading = false;
  }
}

function findConcessionOrder(orderId) {
  for (const group of state.concessionSalesData?.groups || []) {
    const found = group.orders.find((o) => o.id === orderId);
    if (found) return { order: found, group };
  }
  return null;
}

function getOrderTickets(order) {
  if (Array.isArray(order?.tickets) && order.tickets.length) return order.tickets;
  if (order?.id && Array.isArray(state.content?.tickets)) {
    return state.content.tickets.filter((t) => t.orderId === order.id);
  }
  return [];
}

function isOrderFullyValidated(order) {
  if (!order) return false;
  const tickets = getOrderTickets(order);
  const hasTickets = tickets.length > 0;
  const ticketsDone = !hasTickets || tickets.every((t) => ["validated", "cancelled"].includes(t.status));
  const concessionItems = Array.isArray(order.concessionItems || order.items) ? (order.concessionItems || order.items) : [];
  const hasConcessions = concessionItems.length > 0;
  const concessionsDone = !hasConcessions || Boolean(
    order.concessionDeliveryStatus === "delivered" ||
    order.concessionStatus === "cancelled" ||
    order.concessionsFulfilledAt ||
    (order.concessionValidation && order.concessionValidation.fulfilledItems >= order.concessionValidation.totalItems)
  );
  if (!hasTickets && !hasConcessions) return false;
  return ticketsDone && concessionsDone;
}

function orderSessionStartsAt(order = {}) {
  let date = String(order?.sessionDate || "").slice(0, 10);
  let time = String(order?.sessionTime || "").trim();
  if ((!date || !time) && order?.sessionId && Array.isArray(state.content?.sessions)) {
    const foundSession = state.content.sessions.find((s) => s.id === order.sessionId);
    if (foundSession) {
      date = date || String(foundSession.date || "").slice(0, 10);
      time = time || String(foundSession.time || "").trim();
    }
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const parsed = new Date(`${date}T${normalizedTime}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isOrderSessionExpired(order = {}) {
  if (!order) return false;
  const startsAt = orderSessionStartsAt(order);
  if (!startsAt) return false;
  return startsAt.getTime() <= Date.now();
}

function isOrderEffectivelyArchived(order) {
  if (!order) return false;
  if (order.archived === true) return true;
  if (["cancelled", "refunded"].includes(order.status)) return true;
  if (isOrderSessionExpired(order)) return true;
  if (order.status === "paid" && isOrderFullyValidated(order)) return true;
  return false;
}

function isOrderEffectivelyActive(order) {
  if (!order) return false;
  return !isOrderEffectivelyArchived(order);
}

function getOrderValidationSummary(order) {
  const tickets = getOrderTickets(order);
  const hasTickets = tickets.length > 0;
  const ticketsValidated = hasTickets && tickets.every((t) => ["validated", "cancelled"].includes(t.status)) && tickets.some((t) => t.status === "validated");
  const ticketsCancelled = hasTickets && tickets.every((t) => t.status === "cancelled");
  const ticketsPending = hasTickets && !ticketsValidated && !ticketsCancelled;

  const concessionItems = Array.isArray(order?.concessionItems || order?.items) ? (order.concessionItems || order.items) : [];
  const hasConcessions = concessionItems.length > 0;
  const concessionsDelivered = hasConcessions && Boolean(
    order.concessionDeliveryStatus === "delivered" ||
    order.concessionsFulfilledAt ||
    (order.concessionValidation && order.concessionValidation.fulfilledItems >= order.concessionValidation.totalItems)
  );
  const concessionsCancelled = hasConcessions && order.concessionStatus === "cancelled";
  const concessionsPending = hasConcessions && !concessionsDelivered && !concessionsCancelled;

  return {
    hasTickets,
    ticketsValidated,
    ticketsCancelled,
    ticketsPending,
    hasConcessions,
    concessionsDelivered,
    concessionsCancelled,
    concessionsPending
  };
}

function changeConcessionDailySalesPage(delta) {
  state.concessionDailySalesPage = Math.max(1, (state.concessionDailySalesPage || 1) + delta);
  renderConcessionDailySales();
}

function renderConcessionDailySales() {
  const target = $("concessionDailySales");
  if (!target) return;
  const data = state.concessionSalesData || { summary: {}, groups: [] };
  const summary = data.summary || {};
  const showArchived = Boolean($("concessionSalesArchived")?.checked);
  const statusFilter = state.concessionStatusFilter || "all";

  const summaryEl = $("concessionSalesSummary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div><span>Receita Líquida</span><strong>${money(summary.netRevenue || 0)}</strong></div>
      <div><span>Venda Bruta</span><strong>${money(summary.grossRevenue || 0)}</strong></div>
      <div><span>Itens Vendidos</span><strong>${Number(summary.itemQuantity || 0)}</strong></div>
      <div><span>Descontos / Devoluções</span><strong>${money((Number(summary.discountTotal || 0)) + (Number(summary.refundTotal || 0)))}</strong></div>
    `;
  }

  const allOrdersWithGroup = [];
  for (const group of data.groups || []) {
    for (const order of group.orders || []) {
      allOrdersWithGroup.push({ order, group });
    }
  }

  const filtered = allOrdersWithGroup.filter(({ order }) => {
    const isArchived = isOrderEffectivelyArchived(order);
    if (!showArchived && isArchived) return false;
    if (statusFilter === "all") return true;

    const totalItems = (order.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
    const fulfilledItems = (order.items || []).reduce((s, i) => s + Number(i.fulfilledQuantity || 0), 0);
    const isRefunded = Number(order.finance?.refundTotal || 0) > 0 || order.refund?.status === "completed" || order.status === "refunded";
    const isCancelled = order.concessionStatus === "cancelled" || order.status === "cancelled" || isRefunded;

    if (statusFilter === "refunded" || statusFilter === "cancelled") return isCancelled;
    if (statusFilter === "fulfilled") return !isCancelled && fulfilledItems >= totalItems && totalItems > 0;
    if (statusFilter === "pending") return !isCancelled && fulfilledItems < totalItems;
    return true;
  });

  if (!filtered.length) {
    target.innerHTML = `<div class="empty-state"><strong>Nenhum pedido encontrado</strong><span>Não há pedidos para o filtro selecionado nesta data.</span></div>`;
    return;
  }

  const pageSize = state.concessionDailySalesPageSize || 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.concessionDailySalesPage = Math.min(Math.max(1, state.concessionDailySalesPage || 1), totalPages);
  const start = (state.concessionDailySalesPage - 1) * pageSize;
  const pageOrders = filtered.slice(start, start + pageSize);

  const pagerMarkup = `
    <div class="table-pagination-bar">
      <span>Exibindo <strong>${start + 1}–${Math.min(start + pageOrders.length, filtered.length)}</strong> de <strong>${filtered.length}</strong> pedido(s)</span>
      <div class="pager-controls">
        <button class="ghost-button" type="button" ${state.concessionDailySalesPage <= 1 ? "disabled" : ""} data-static-pager="concession-daily-sales" data-page-delta="-1">← Anterior</button>
        <span class="pager-page-indicator">Página ${state.concessionDailySalesPage} de ${totalPages}</span>
        <button class="ghost-button" type="button" ${state.concessionDailySalesPage >= totalPages ? "disabled" : ""} data-static-pager="concession-daily-sales" data-page-delta="1">Próxima →</button>
      </div>
    </div>
  `;

  target.innerHTML = `
    ${pagerMarkup}
    <table>
      <thead>
        <tr>
          <th>Data/Hora</th>
          <th>Cliente</th>
          <th>Sessão / Balcão</th>
          <th>Itens da Bomboniere</th>
          <th>Total Líquido</th>
          <th>Pagamento</th>
          <th>Entrega</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${pageOrders.map(({ order, group }) => {
          const items = order.items || [];
          const finance = order.finance || {};
          const totalItems = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
          const fulfilledItems = items.reduce((s, i) => s + Number(i.fulfilledQuantity || 0), 0);
          const isRefunded = Number(finance.refundTotal || 0) > 0 || order.refund?.status === "completed" || order.status === "refunded";
          const isCancelled = order.concessionStatus === "cancelled" || order.status === "cancelled" || isRefunded;
          const discountTotal = Number(finance.clubDiscount || 0) + Number(finance.freeItemDiscount || 0) + Number(finance.couponDiscount || 0);

          let deliveryLabel = "Aguardando";
          let deliveryTone = "warn";
          if (isCancelled) {
            deliveryLabel = isRefunded ? "Cancelado (Reembolsado)" : "Cancelado";
            deliveryTone = "danger";
          } else if (totalItems > 0 && fulfilledItems >= totalItems) {
            deliveryLabel = "Entregue";
            deliveryTone = "ok";
          } else if (fulfilledItems > 0) {
            deliveryLabel = `${fulfilledItems}/${totalItems} entregue`;
            deliveryTone = "warn";
          }

          const orderTime = new Date(order.purchasedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

          return `
            <tr class="order-table-row ${order.archived ? "is-archived" : ""}" data-admin-order-action="concession" data-admin-order-id="${escapeHtml(order.id)}">
              <td data-label="Data/Hora">
                <strong>#${escapeHtml(order.id.slice(-8).toUpperCase())}</strong><br>
                <span class="list-meta">${orderTime}</span>
              </td>
              <td data-label="Cliente">
                <strong>${escapeHtml(order.customerName || "Cliente avulso")}</strong>
              </td>
              <td data-label="Sessão">
                <strong>${escapeHtml(group.title || "Balcão")}</strong><br>
                <span class="list-meta">${escapeHtml([group.time, group.room].filter(Boolean).join(" • ") || "Venda avulsa")}</span>
              </td>
              <td data-label="Itens">
                <div class="concession-item-chips">
                  ${items.map((item) => {
                    const itemRefunded = item.refundStatus === "completed" || item.status === "cancelled" || isCancelled;
                    const f = Number(item.fulfilledQuantity || 0);
                    const q = Number(item.quantity || 0);
                    const isF = f >= q && !itemRefunded;
                    const tone = itemRefunded ? "chip-refunded" : isF ? "chip-ok" : "chip-pending";
                    return `<span class="concession-chip ${tone}" title="${escapeHtml(item.name)}: ${itemRefunded ? "Cancelado / Reembolsado" : isF ? "Entregue" : `${f}/${q} retirado`}"><strong>${q}x</strong> ${escapeHtml(item.name)}</span>`;
                  }).join("")}
                </div>
              </td>
              <td data-label="Total">
                <strong>${money(finance.netRevenue || 0)}</strong>
                ${discountTotal > 0 ? `<br><span class="list-meta discount-tag">-${money(discountTotal)}</span>` : ""}
              </td>
              <td data-label="Pagamento">
                <strong>${escapeHtml(order.paymentMethod || "Pix")}</strong><br>
                <span class="list-meta">${escapeHtml(order.paymentStatus || "Aprovado")}</span>
                ${financialStatusEventHtml(order.refund || {}, { status: isRefunded ? "refunded" : "approved", approvedAt: order.approvedAt, refundedAt: order.refund?.completedAt })}
              </td>
              <td data-label="Entrega">
                <div class="order-status-stack">
                  <span class="status-label ${deliveryTone}">${deliveryLabel}</span>
                  ${order.archived ? '<span class="status-label archived">Arquivado</span>' : ""}
                </div>
              </td>
              <td data-label="Ações">
                <button class="ghost-button" type="button" data-admin-order-action="concession" data-admin-order-id="${escapeHtml(order.id)}">Detalhes</button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function openConcessionOrderDetail(orderId) {
  const match = findConcessionOrder(orderId);
  if (!match) {
    showToast("Pedido não encontrado nesta data.", "error");
    return;
  }
  const { order, group } = match;
  state.selectedConcessionOrderId = orderId;
  const overlay = $("concessionOrderOverlay");
  if (!overlay) return;

  const titleEl = $("concessionOrderModalTitle");
  const subtitleEl = $("concessionOrderModalSubtitle");
  const bodyEl = $("concessionOrderDetailBody");
  const refundBtn = $("concessionModalRefundButton");
  const archiveBtn = $("concessionModalArchiveButton");
  const deleteBtn = $("concessionModalDeleteButton");

  if (titleEl) titleEl.textContent = `Pedido #${order.id.slice(-8).toUpperCase()}`;
  if (subtitleEl) subtitleEl.textContent = `Registrado em ${new Date(order.purchasedAt).toLocaleString("pt-BR")}`;

  const items = order.items || [];
  const finance = order.finance || {};
  const totalItems = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const fulfilledItems = items.reduce((s, i) => s + Number(i.fulfilledQuantity || 0), 0);
  const isRefunded = Number(finance.refundTotal || 0) > 0 || order.refund?.status === "completed" || order.status === "refunded";
  const isCancelled = order.concessionStatus === "cancelled" || order.status === "cancelled" || isRefunded;

  let deliveryBadge = '<span class="status-label warn">Aguardando retirada</span>';
  if (isCancelled) {
    deliveryBadge = `<span class="status-label danger">${isRefunded ? "Cancelado (Reembolsado)" : "Cancelado"}</span>`;
  } else if (fulfilledItems >= totalItems && totalItems > 0) {
    deliveryBadge = `<span class="status-label ok">Entregue (${fulfilledItems}/${totalItems})</span>`;
  } else if (fulfilledItems > 0) {
    deliveryBadge = `<span class="status-label warn">Retirada parcial (${fulfilledItems}/${totalItems})</span>`;
  }

  bodyEl.innerHTML = `
    <section class="order-detail-section">
      <h3>Informações do pedido</h3>
      <dl>
        <div><dt>Código completo</dt><dd><code>${escapeHtml(order.id)}</code></dd></div>
        <div><dt>Cliente</dt><dd>${escapeHtml(order.customerName || "Cliente avulso")}</dd></div>
        <div><dt>Sessão / Balcão</dt><dd>${escapeHtml(group.title || "Balcão")}${group.time ? ` • ${escapeHtml([group.time, group.room].filter(Boolean).join(" • "))}` : ""}</dd></div>
        <div><dt>Pagamento</dt><dd>${escapeHtml(order.paymentMethod || "Pix")} • ${escapeHtml(order.paymentStatus || "Aprovado")}</dd></div>
        <div><dt>Pagamento aprovado em</dt><dd>${order.approvedAt ? new Date(order.approvedAt).toLocaleString("pt-BR") : "-"}</dd></div>
        <div><dt>Reembolso concluído em</dt><dd>${order.refund?.completedAt ? new Date(order.refund.completedAt).toLocaleString("pt-BR") : "-"}</dd></div>
        <div><dt>Status de entrega</dt><dd>${deliveryBadge}${order.archived ? ' <span class="status-label archived">Arquivado</span>' : ""}</dd></div>
      </dl>
    </section>

    <section class="order-detail-section">
      <h3>Itens do pedido (${totalItems} total)</h3>
      <div class="orders-table modal-compact-table">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd.</th>
              <th>Entregue</th>
              <th>Unitário</th>
              <th>Descontos</th>
              <th>Líquido</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => {
              const productFinance = (finance.products || []).find((p) => String(p.id) === String(item.id)) || {};
              const discount = Number(productFinance.discountTotal || 0);
              const isFulfilled = (item.fulfilledQuantity || 0) >= (item.quantity || 0);
              return `
                <tr>
                  <td><strong>${escapeHtml(item.name)}</strong>${item.refundStatus === "completed" ? '<br><small class="danger-text">Reembolsado</small>' : ""}</td>
                  <td>${Number(item.quantity || 0)}</td>
                  <td><span class="status-label ${isFulfilled ? "ok" : "warn"}">${Number(item.fulfilledQuantity || 0)}/${Number(item.quantity || 0)}</span></td>
                  <td>${money(item.originalUnitPrice)}</td>
                  <td>${discount > 0 ? `-${money(discount)}` : "-"}</td>
                  <td><strong>${money(productFinance.netRevenue || (item.quantity * item.originalUnitPrice - discount))}</strong></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="order-detail-section">
      <h3>Conciliação financeira</h3>
      <dl>
        <div><dt>Venda bruta</dt><dd>${money(finance.grossRevenue || 0)}</dd></div>
        ${Number(finance.clubDiscount || 0) + Number(finance.freeItemDiscount || 0) > 0 ? `<div><dt>Desconto Clube</dt><dd class="is-discount">- ${money(Number(finance.clubDiscount || 0) + Number(finance.freeItemDiscount || 0))}</dd></div>` : ""}
        ${Number(finance.couponDiscount || 0) > 0 ? `<div><dt>Cupom${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}</dt><dd class="is-discount">- ${money(finance.couponDiscount)}</dd></div>` : ""}
        ${Number(finance.refundTotal || 0) > 0 ? `<div><dt>Reembolso</dt><dd class="is-refund">- ${money(finance.refundTotal)}</dd></div>` : ""}
        <div class="is-net"><dt>Receita líquida da bomboniere</dt><dd><strong>${money(finance.netRevenue || 0)}</strong></dd></div>
      </dl>
    </section>
  `;

  if (refundBtn) {
    const eligibility = order.refundEligibility || {};
    const fullyDelivered = fulfilledItems >= totalItems && totalItems > 0;
    if (adminCan("concessions.refund") && eligibility.allowed && !isCancelled && !fullyDelivered) {
      refundBtn.hidden = false;
      const amt = Number(eligibility.amount || 0);
      refundBtn.textContent = amt > 0 ? `Reembolsar ${money(amt)}` : "Cancelar bomboniere";
      refundBtn.onclick = () => executeConcessionRefund(order.id, amt);
    } else {
      refundBtn.hidden = true;
    }
  }

  if (archiveBtn) {
    archiveBtn.hidden = !adminCan("concessions.edit");
    archiveBtn.textContent = order.archived ? "Desarquivar pedido" : "Arquivar pedido";
    archiveBtn.onclick = () => toggleConcessionArchive(order.id, order.archived);
  }

  if (deleteBtn) {
    deleteBtn.hidden = !adminCan("concessions.delete") || !isCancelled;
    deleteBtn.onclick = () => deleteConcessionOrder(order.id);
  }

  overlay.hidden = false;
}
    return { loadConcessionDailySales, findConcessionOrder, getOrderTickets, isOrderFullyValidated, orderSessionStartsAt, isOrderSessionExpired, isOrderEffectivelyArchived, isOrderEffectivelyActive, getOrderValidationSummary, changeConcessionDailySalesPage, renderConcessionDailySales, openConcessionOrderDetail };
  }

  const api = Object.freeze({ createConcessionSalesView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.CineAdminModules ||= {};
    root.CineAdminModules.concessionSalesView = api;
  }
})(globalThis);
