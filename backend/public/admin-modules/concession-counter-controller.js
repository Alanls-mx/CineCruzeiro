((root) => {
  function createConcessionCounterController({ state, $, api, API_BASE, window, document, localStorage, sessionStorage, confirm, adminCan, money, escapeHtml, showToast, showSuccess, normalizedSearchText, adminAssetUrl, formatConcessionStock, pointPaymentStatusLabel, retryPendingSalePrint, requestLocalPointPaymentPrint, desktopThermalPrinterAvailable, resolvePendingSalePrint, loadContent, loadConcessionDailySales, loadConcessionFinance, loadDashboard }) {
    let saleInFlight = false;
    let cancellationInFlight = false;
    function concessionCounterItems() {
      return Object.entries(state.concessionCounterQuantities || {})
        .map(([id, quantity]) => ({ id, quantity: Math.max(0, Math.floor(Number(quantity || 0))) }))
        .filter((item) => item.id && item.quantity > 0);
    }

    function concessionCounterAvailableUnits(item = {}) {
      const maxPerOrder = Math.max(1, Math.floor(Number(item.maxPerOrder || 8)));
      if (item.stock === "" || item.stock === null || item.stock === undefined) return maxPerOrder;
      const stock = Math.max(0, Number(item.stock || 0));
      const unit = item.stockUnit || "unit";
      const usage = unit === "unit" ? 1 : Math.max(0.001, Number(item.usagePerSale || 1));
      return Math.max(0, Math.min(maxPerOrder, Math.floor(stock / usage)));
    }

    function concessionCounterProducts() {
      const search = normalizedSearchText(state.concessionCounterSearch);
      return (state.content?.concessions || [])
        .filter((item) => item.active !== false)
        .filter((item) => state.concessionCounterCategory === "all" || item.category === state.concessionCounterCategory)
        .filter((item) => !search || normalizedSearchText([item.name, item.sku, item.category, item.description].join(" ")).includes(search))
        .sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
    }

    function updateConcessionCounterQuantity(id, value) {
      const product = (state.content?.concessions || []).find((item) => item.id === id && item.active !== false);
      if (!product) return;
      const quantity = Math.max(0, Math.min(concessionCounterAvailableUnits(product), Math.floor(Number(value || 0))));
      if (quantity) state.concessionCounterQuantities[id] = quantity;
      else delete state.concessionCounterQuantities[id];
      renderConcessionCounterSale();
    }

    function renderConcessionCounterSummary() {
      const target = $("concessionCounterSummary");
      if (!target) return;
      const products = new Map((state.content?.concessions || []).map((item) => [item.id, item]));
      const items = concessionCounterItems().map((item) => ({ ...item, product: products.get(item.id) })).filter((item) => item.product);
      const grossTotal = items.reduce((sum, item) => sum + item.quantity * Number(item.product.price || 0), 0);
      const paymentMethod = document.querySelector("input[name='concessionCounterPaymentMethod']:checked")?.value || "cash";
      const courtesy = paymentMethod === "courtesy";
      const total = courtesy ? 0 : grossTotal;
      const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
      target.innerHTML = `
        <div class="concession-counter-summary-head">
          <div><span>Venda em andamento</span><h2>Resumo do balcão</h2></div>
          <span class="status-pill muted">${quantity} ${quantity === 1 ? "item" : "itens"}</span>
        </div>
        <div class="concession-counter-summary-items">
          ${items.length ? items.map((item) => `<div><span>${item.quantity}× ${escapeHtml(item.product.name)}</span><strong>${money(item.quantity * Number(item.product.price || 0))}</strong></div>`).join("") : `<div class="manual-sale-empty">Os produtos selecionados aparecerão aqui.</div>`}
        </div>
        ${courtesy && items.length ? `<div class="concession-counter-summary-benefit"><span>Valor concedido como cortesia</span><strong>-${money(grossTotal)}</strong></div>` : ""}
        <div class="concession-counter-summary-total"><span>${courtesy ? "Total da cortesia" : "Total calculado"}</span><strong>${money(total)}</strong></div>`;
      const submit = $("concessionCounterSubmitButton");
      if (submit) submit.disabled = items.length === 0;
    }

    function renderConcessionCounterSale() {
      const target = $("concessionCounterProducts");
      if (!target) return;
      if (!state.content) {
        target.innerHTML = `
          <div class="concession-counter-loading" role="status" aria-live="polite">
            <span class="inline-spinner" aria-hidden="true"></span>
            <span><strong>Carregando produtos</strong><small>Sincronizando cardápio e estoque...</small></span>
          </div>`;
        const pager = $("concessionCounterPager");
        if (pager) pager.innerHTML = "";
        renderConcessionCounterSummary();
        return;
      }
      const products = concessionCounterProducts();
      const productIds = new Set((state.content?.concessions || []).filter((item) => item.active !== false).map((item) => item.id));
      state.concessionCounterQuantities = Object.fromEntries(Object.entries(state.concessionCounterQuantities || {}).filter(([id, quantity]) => productIds.has(id) && Number(quantity) > 0));
      const pageSize = state.concessionCounterPageSize || 8;
      const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
      state.concessionCounterPage = Math.min(Math.max(1, state.concessionCounterPage || 1), totalPages);
      const start = (state.concessionCounterPage - 1) * pageSize;
      const visible = products.slice(start, start + pageSize);
      target.innerHTML = visible.length ? visible.map((item) => {
        const max = concessionCounterAvailableUnits(item);
        const quantity = Math.min(max, Number(state.concessionCounterQuantities[item.id] || 0));
        if (quantity) state.concessionCounterQuantities[item.id] = quantity;
        return `<article class="concession-counter-product ${max === 0 ? "unavailable" : ""}">
          <div class="concession-counter-product-copy">
            ${item.imageUrl ? `<img src="${escapeHtml(adminAssetUrl(item.imageUrl))}" alt="${escapeHtml(item.name)}" loading="lazy" />` : ""}
            <div><strong>${escapeHtml(item.name)}</strong><span>${money(item.price)} · ${escapeHtml(formatConcessionStock(item))}</span></div>
          </div>
          <div class="stepper">
            <button type="button" data-counter-step="-1" data-counter-id="${escapeHtml(item.id)}" aria-label="Remover ${escapeHtml(item.name)}" ${quantity <= 0 ? "disabled" : ""}>-</button>
            <input type="number" min="0" max="${max}" value="${quantity}" data-counter-quantity="${escapeHtml(item.id)}" aria-label="Quantidade de ${escapeHtml(item.name)}" ${max === 0 ? "disabled" : ""} />
            <button type="button" data-counter-step="1" data-counter-id="${escapeHtml(item.id)}" aria-label="Adicionar ${escapeHtml(item.name)}" ${max === 0 || quantity >= max ? "disabled" : ""}>+</button>
          </div>
        </article>`;
      }).join("") : `<div class="empty-state compact"><strong>Nenhum produto encontrado</strong><span>Ajuste a busca ou verifique os produtos ativos no cardápio.</span></div>`;
      target.querySelectorAll("[data-counter-step]").forEach((button) => button.addEventListener("click", () => {
        updateConcessionCounterQuantity(button.dataset.counterId, Number(state.concessionCounterQuantities[button.dataset.counterId] || 0) + Number(button.dataset.counterStep || 0));
      }));
      target.querySelectorAll("[data-counter-quantity]").forEach((input) => input.addEventListener("change", () => updateConcessionCounterQuantity(input.dataset.counterQuantity, input.value)));
      const pager = $("concessionCounterPager");
      if (pager) {
        pager.innerHTML = products.length ? `<span>Exibindo <strong>${start + 1}-${Math.min(start + visible.length, products.length)}</strong> de <strong>${products.length}</strong></span><div class="pager-controls"><button class="ghost-button" type="button" data-counter-page="-1" ${state.concessionCounterPage <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${state.concessionCounterPage} de ${totalPages}</span><button class="ghost-button" type="button" data-counter-page="1" ${state.concessionCounterPage >= totalPages ? "disabled" : ""}>Próxima</button></div>` : "";
        pager.querySelectorAll("[data-counter-page]").forEach((button) => button.addEventListener("click", () => {
          state.concessionCounterPage += Number(button.dataset.counterPage || 0);
          renderConcessionCounterSale();
        }));
      }
      renderConcessionCounterSummary();
    }

    function printConcessionCounterReceipt(orderId = state.concessionCounterLastOrderId) {
      if (state.concessionCounterPaymentId && state.concessionCounterPaymentSnapshot?.payment?.status === "approved") {
        const pendingPrint = (state.concessionCounterPaymentSnapshot?.orders || []).some((order) => order.status === "paid_pending_print");
        if (pendingPrint) void retryPendingSalePrint(state.concessionCounterPaymentId);
        else requestLocalPointPaymentPrint(state.concessionCounterPaymentId, { manual: true });
        return;
      }
      if (!orderId) return;
      const url = `${API_BASE}/api/admin/concession-sales/${encodeURIComponent(orderId)}/print`;
      if (desktopThermalPrinterAvailable()) {
        window.cineDesktop.printUrl(url, `concession-${orderId}`);
        return;
      }
      const popup = window.open(url, "_blank");
      if (popup) popup.opener = null;
      else showToast("O navegador bloqueou o comprovante. Permita pop-ups para imprimir.", "error");
    }

    function stopConcessionCounterPaymentPolling() {
      clearTimeout(state.concessionCounterPaymentTimer);
      state.concessionCounterPaymentTimer = null;
    }

    function renderConcessionCounterPayment(data = {}) {
      const payment = data.payment || state.concessionCounterPaymentSnapshot?.payment || {};
      const orders = data.orders || state.concessionCounterPaymentSnapshot?.orders || [];
      const order = orders[0] || data.order || {};
      const pointPrint = data.pointPrint || state.concessionCounterPaymentSnapshot?.pointPrint || {};
      const status = data.reconnecting ? "reconnecting" : payment.status || "pending";
      const reconciliationRequired = Boolean(data.reconciliationRequired || payment.metadata?.reconciliationRequired);
      const pendingPrint = status === "approved" && orders.some((item) => item.status === "paid_pending_print") && !data.completed;
      const finalStatus = ["rejected", "cancelled", "expired", "refunded"].includes(status) || (status === "approved" && !pendingPrint);
      state.concessionCounterPaymentSnapshot = { ...data, payment, orders, order, pointPrint };
      state.concessionCounterLastOrderId = order.id || state.concessionCounterLastOrderId;
      $("concessionCounterWorkspace").hidden = true;
      const panel = $("concessionCounterPaymentPanel");
      panel.hidden = false;
      panel.dataset.status = status;
      $("concessionCounterPaymentStatus").textContent = pointPaymentStatusLabel(status);
      $("concessionCounterPaymentAmount").textContent = money(payment.amount || order.totalPrice || 0);
      $("concessionCounterPaymentReference").textContent = payment.providerReference || payment.providerPaymentId || "-";
      const needsLocalPrint = ["local_required", "failed"].includes(String(pointPrint.status || ""));
      if (pendingPrint && needsLocalPrint && !["failed", "unavailable"].includes(state.localPointPrintStatus)) requestLocalPointPaymentPrint(payment.id || state.concessionCounterPaymentId);
      if (payment.status === "approved" && data.completed === true) {
        localStorage.removeItem("cine_admin_active_concession_point_payment");
      }
      const copy = reconciliationRequired ? [
        "Conciliação financeira necessária",
        "A Point confirmou um pagamento para um pedido encerrado ou ausente. Os produtos não serão liberados automaticamente. Confira a referência antes de nova cobrança ou reembolso."
      ] : {
        approved: [pendingPrint ? "Pagamento aprovado, aguardando impressão" : "Venda aprovada", pointPrint.status === "printed"
          ? "O pagamento e a impressão foram confirmados pela Point."
          : ["queued", "on_terminal"].includes(pointPrint.status)
            ? pointPrint.message || "O comprovante foi enviado automaticamente para a Point."
            : state.localPointPrintStatus === "printing"
              ? "Pagamento confirmado. Enviando o comprovante à impressora térmica deste computador."
              : pointPrint.message || (pendingPrint ? "A venda só será concluída depois que a impressão for confirmada." : "O pagamento foi confirmado.")],
        rejected: ["Pagamento recusado", "Nenhum produto foi baixado do estoque. Inicie outra venda para tentar novamente."],
        cancelled: ["Cobrança cancelada", "A venda não foi concluída e o estoque foi liberado."],
        expired: ["Tempo de pagamento encerrado", "A cobrança expirou e o estoque foi liberado."],
        refunded: ["Pagamento estornado", "O Mercado Pago informou o estorno desta venda."],
        reconnecting: ["Reconectando à maquininha", payment.metadata?.connectionMessage || "A cobrança permanece vinculada à mesma Order e será consultada novamente sem duplicar o pagamento."]
      }[status] || ["Aguardando pagamento na Point", "Oriente o cliente a concluir o pagamento na maquininha."];
      $("concessionCounterPaymentTitle").textContent = copy[0];
      $("concessionCounterPaymentMessage").textContent = copy[1];
      $("concessionCounterPaymentRetryButton").hidden = status === "approved";
      const printFailed = ["failed", "timed_out"].includes(String(pointPrint.status || "")) || ["failed", "unavailable"].includes(state.localPointPrintStatus);
      $("concessionCounterPaymentCancelButton").hidden = (finalStatus || status === "reconnecting") && !(pendingPrint && printFailed && adminCan(payment.metadata?.kind === "point_sale" ? "orders.refund" : "orders.cancel"));
      $("concessionCounterPaymentCancelButton").textContent = payment.metadata?.kind === "point_sale" ? "Reembolsar pagamento" : "Cancelar pedido";
      $("concessionCounterPrintButton").hidden = reconciliationRequired || status !== "approved" || !state.concessionCounterLastOrderId || (pendingPrint && !["local_required", "failed", "timed_out"].includes(String(pointPrint.status || "")));
      $("concessionCounterPrintButton").textContent = pendingPrint ? "Tentar imprimir novamente" : "Imprimir comprovante novamente";
      $("concessionCounterNewSaleButton").hidden = !finalStatus;
    }

    function scheduleConcessionCounterPaymentPoll(delay = 2200) {
      stopConcessionCounterPaymentPolling();
      if (!state.concessionCounterPaymentId) return;
      state.concessionCounterPaymentTimer = setTimeout(() => void pollConcessionCounterPayment(), delay);
    }

    async function pollConcessionCounterPayment({ manual = false } = {}) {
      if (!state.concessionCounterPaymentId || state.concessionCounterPaymentSyncing) return;
      state.concessionCounterPaymentSyncing = true;
      const button = $("concessionCounterPaymentRetryButton");
      if (manual) button.disabled = true;
      try {
        const result = await api(`/api/box-office/point-payments/${encodeURIComponent(state.concessionCounterPaymentId)}`);
        renderConcessionCounterPayment(result);
        if (result.reconnecting) {
          scheduleConcessionCounterPaymentPoll(Math.min(15000, Number(result.retryAfterMs || 5000)));
          return;
        }
        if (result.reconciliationRequired) {
          stopConcessionCounterPaymentPolling();
          await loadContent({ silent: true });
          renderConcessionCounterPayment(result);
          showToast("Pagamento exige conciliação administrativa. Não refaça a cobrança.");
          return;
        }
        if (result.payment?.status === "approved") {
          state.concessionCounterQuantities = {};
          await Promise.all([loadContent({ silent: true }), loadConcessionDailySales()]);
          renderConcessionCounterPayment(result);
          if (["queued", "on_terminal"].includes(String(result.pointPrint?.status || ""))) {
            scheduleConcessionCounterPaymentPoll(2500);
          } else {
            stopConcessionCounterPaymentPolling();
          }
          showToast("Pagamento aprovado. Finalizando a impressão do comprovante.");
        } else if (["rejected", "cancelled", "expired", "refunded"].includes(result.payment?.status)) {
          stopConcessionCounterPaymentPolling();
          localStorage.removeItem("cine_admin_active_concession_point_payment");
          await loadContent({ silent: true });
        } else scheduleConcessionCounterPaymentPoll();
      } catch (error) {
        $("concessionCounterPaymentMessage").textContent = `${error.message} A consulta será repetida automaticamente.`;
        scheduleConcessionCounterPaymentPoll(3500);
      } finally {
        state.concessionCounterPaymentSyncing = false;
        button.disabled = false;
      }
    }

    async function cancelConcessionCounterPayment() {
      if (cancellationInFlight) return;
      const snapshotPayment = state.concessionCounterPaymentSnapshot?.payment;
      const pendingPrint = snapshotPayment?.status === "approved" && (state.concessionCounterPaymentSnapshot?.orders || []).some((order) => order.status === "paid_pending_print");
      if (pendingPrint) {
        await resolvePendingSalePrint(state.concessionCounterPaymentId, snapshotPayment.metadata?.kind === "point_sale" ? "refund" : "cancel");
        return;
      }
      if (!state.concessionCounterPaymentId || !confirm("Cancelar a cobrança enviada à Point?")) return;
      cancellationInFlight = true;
      const button = $("concessionCounterPaymentCancelButton");
      button.disabled = true;
      try {
        const result = await api(`/api/box-office/point-payments/${encodeURIComponent(state.concessionCounterPaymentId)}/cancel`, { method: "POST" });
        renderConcessionCounterPayment(result);
        await loadContent({ silent: true });
        if (result.cancellationPending) {
          scheduleConcessionCounterPaymentPoll(1200);
          showToast("Cancelamento solicitado. Aguardando confirmação da Point.");
        } else {
          stopConcessionCounterPaymentPolling();
          localStorage.removeItem("cine_admin_active_concession_point_payment");
          showToast("Cobrança encerrada no Mercado Pago Point.");
        }
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        cancellationInFlight = false;
        button.disabled = false;
      }
    }

    function resetConcessionCounterSale() {
      stopConcessionCounterPaymentPolling();
      state.concessionCounterPaymentId = "";
      state.concessionCounterPaymentSnapshot = null;
      state.concessionCounterLastOrderId = "";
      state.concessionCounterCheckoutKey = "";
      sessionStorage.removeItem("cine_admin_concession_checkout_key");
      state.localPointPrintStatus = "";
      localStorage.removeItem("cine_admin_active_concession_point_payment");
      state.concessionCounterQuantities = {};
      $("concessionCounterPaymentPanel").hidden = true;
      $("concessionCounterWorkspace").hidden = false;
      renderConcessionCounterSale();
    }

    async function createConcessionCounterSale(event) {
      event.preventDefault();
      if (saleInFlight) return;
      const concessionItems = concessionCounterItems();
      if (!concessionItems.length) {
        showToast("Selecione pelo menos um produto da bomboniere.", "error");
        return;
      }
      const paymentMethod = document.querySelector("input[name='concessionCounterPaymentMethod']:checked")?.value || "cash";
      const pointPayment = ["point_debit", "point_credit", "point_qr"].includes(paymentMethod);
      const popup = null;
      const button = $("concessionCounterSubmitButton");
      try {
        saleInFlight = true;
        button.disabled = true;
        button.textContent = pointPayment ? "Enviando à Point..." : "Finalizando venda...";
        if (pointPayment) {
          state.concessionCounterCheckoutKey ||= String(sessionStorage.getItem("cine_admin_concession_checkout_key") || "") || crypto.randomUUID();
          sessionStorage.setItem("cine_admin_concession_checkout_key", state.concessionCounterCheckoutKey);
        }
        const result = await api("/api/admin/concession-counter-sales", {
          method: "POST",
          body: JSON.stringify({
            saleMode: "concession_counter",
            paymentMethod,
            concessionItems,
            createdAt: new Date().toISOString(),
            ...(pointPayment ? { clientRequestId: state.concessionCounterCheckoutKey } : {})
          })
        });
        const order = result.orders?.[0] || result.order || {};
        state.concessionCounterLastOrderId = order.id || "";
        if (pointPayment) {
          state.concessionCounterCheckoutKey = "";
          sessionStorage.removeItem("cine_admin_concession_checkout_key");
        }
        if (pointPayment || order.status === "paid_pending_print") {
          state.concessionCounterPaymentId = result.payment?.id || result.payments?.[0]?.id || "";
          state.localPointPrintStatus = "";
          if (state.concessionCounterPaymentId) localStorage.setItem("cine_admin_active_concession_point_payment", state.concessionCounterPaymentId);
          renderConcessionCounterPayment(result);
          const trackedPayment = result.payment || result.payments?.[0];
          if (trackedPayment?.status !== "approved" || ["queued", "on_terminal"].includes(String(result.pointPrint?.status || ""))) scheduleConcessionCounterPaymentPoll(1200);
          else {
            state.concessionCounterQuantities = {};
            await Promise.all([loadContent({ silent: true }), loadConcessionDailySales()]);
          }
          return;
        }
        state.concessionCounterQuantities = {};
        await Promise.all([loadContent({ silent: true }), loadConcessionDailySales(), loadConcessionFinance(), loadDashboard()]);
        if (popup) {
          popup.opener = null;
          popup.location = `${API_BASE}/api/admin/concession-sales/${encodeURIComponent(order.id)}/print`;
        } else showToast("Venda concluída. Permita pop-ups para abrir o comprovante PDV.", "error");
        showSuccess("Venda da bomboniere concluída", "O estoque foi atualizado e o comprovante presencial foi gerado.");
      } catch (error) {
        if (popup) popup.close();
        showToast(error.message, "error");
      } finally {
        saleInFlight = false;
        button.textContent = "Finalizar e imprimir";
        renderConcessionCounterSale();
      }
    }

    return { concessionCounterItems, concessionCounterAvailableUnits, concessionCounterProducts, updateConcessionCounterQuantity, renderConcessionCounterSummary, renderConcessionCounterSale, printConcessionCounterReceipt, stopConcessionCounterPaymentPolling, renderConcessionCounterPayment, scheduleConcessionCounterPaymentPoll, pollConcessionCounterPayment, cancelConcessionCounterPayment, resetConcessionCounterSale, createConcessionCounterSale };
  }
  const api = Object.freeze({ createConcessionCounterController });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.concessionCounterController = api; }
})(globalThis);
