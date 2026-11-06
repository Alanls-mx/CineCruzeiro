((root) => {
  function createBoxOfficePointController({ state, $, api, API_BASE, window, document, localStorage, sessionStorage, confirm, money, escapeHtml, showToast, adminCan, loadContent, renderConcessionCounterPayment, scheduleConcessionCounterPaymentPoll, stopConcessionCounterPaymentPolling, renderManualSaleItems }) {
    const inFlightActions = new Set();
    function pointPaymentStatusLabel(status = "") {
      return {
        connecting: "Conectando à maquininha",
        reconnecting: "Reconectando à maquininha",
        pending: "Aguardando no terminal",
        approved: "Pagamento aprovado",
        rejected: "Pagamento recusado",
        cancelled: "Cobrança cancelada",
        expired: "Cobrança expirada",
        refunded: "Pagamento estornado"
      }[status] || status || "Aguardando no terminal";
    }

    function stopPointPaymentPolling() {
      clearTimeout(state.pointPaymentTimer);
      state.pointPaymentTimer = null;
    }

    function pointPaymentPrintUrl(paymentId = state.pointPaymentId) {
      return `${API_BASE}/api/box-office/point-payments/${encodeURIComponent(paymentId)}/print`;
    }

    function desktopThermalPrinterAvailable() {
      return Boolean(window.cineDesktop?.printUrl);
    }

    async function requestLocalPointPaymentPrint(paymentId = state.pointPaymentId, { manual = false } = {}) {
      if (!paymentId) return false;
      const jobKey = `point-${paymentId}`;
      if (state.localPointPrintJobs.has(jobKey) && state.localPointPrintStatus === "printing") return true;
      if (!manual && state.localPointPrintJobs.has(jobKey)) return true;
      const snapshot = state.pointPaymentId === paymentId ? state.pointPaymentSnapshot : state.concessionCounterPaymentSnapshot;
      let printJob = snapshot?.pointPrint;
      if (!desktopThermalPrinterAvailable()) {
        state.localPointPrintStatus = "unavailable";
        if (!state.localPointPrintJobs.has(jobKey) && printJob?.mode === "local") {
          state.localPointPrintJobs.add(jobKey);
          void api(`/api/box-office/point-payments/${encodeURIComponent(paymentId)}/print-result`, {
            method: "POST",
            body: JSON.stringify({ ok: false, jobId: printJob.jobId, message: "O aplicativo desktop com impressora térmica padrão não está disponível neste dispositivo." })
          }).then((result) => {
            if (state.pointPaymentId === paymentId) renderPointPayment(result);
            if (state.concessionCounterPaymentId === paymentId) renderConcessionCounterPayment(result);
          }).catch((error) => showToast(error.message, "error"));
        }
        if (manual) showToast("Abra esta venda no aplicativo desktop com uma impressora térmica padrão configurada.", "error");
        return false;
      }
      state.localPointPrintJobs.add(jobKey);
      state.localPointPrintStatus = "printing";
      const pendingPrint = (snapshot?.orders || []).some((order) => order.status === "paid_pending_print");
      if (pendingPrint && (snapshot?.pointPrint?.mode !== "local" || ["failed", "timed_out"].includes(String(snapshot?.pointPrint?.status || "")))) {
        try {
          const retry = await api(`/api/box-office/point-payments/${encodeURIComponent(paymentId)}/retry-print`, {
            method: "POST",
            body: JSON.stringify({ mode: "local" })
          });
          if (retry.completed) {
            state.localPointPrintStatus = "printed";
            if (state.pointPaymentId === paymentId) renderPointPayment(retry);
            if (state.concessionCounterPaymentId === paymentId) renderConcessionCounterPayment(retry);
            await loadContent({ silent: true });
            return true;
          }
          printJob = retry.pointPrint;
        } catch (error) {
          state.localPointPrintStatus = "failed";
          state.localPointPrintJobs.delete(jobKey);
          showToast(error.message, "error");
          return false;
        }
      }
      if (pendingPrint && !printJob?.jobId) {
        state.localPointPrintStatus = "failed";
        state.localPointPrintJobs.delete(jobKey);
        showToast("A tentativa de impressão não foi identificada. Atualize a venda e tente novamente.", "error");
        return false;
      }
      const jobId = `${jobKey}::${printJob?.jobId || "reprint"}`;
      window.cineDesktop.printUrl(pointPaymentPrintUrl(paymentId), jobId);
      return true;
    }

    window.addEventListener("cine-desktop-print-result", async (event) => {
      const detail = event.detail || {};
      if (/^(order-|ticket-)/.test(String(detail.jobId || ""))) {
        showToast(detail.ok ? "Via enviada à impressora térmica." : detail.message || "A impressora não confirmou a reimpressão.", detail.ok ? undefined : "error");
        return;
      }
      if (!String(detail.jobId || "").startsWith("point-")) return;
      const [paymentId, printJobId] = String(detail.jobId).slice("point-".length).split("::");
      let result = null;
      let confirmationError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          result = await api(`/api/box-office/point-payments/${encodeURIComponent(paymentId)}/print-result`, {
            method: "POST",
            body: JSON.stringify({ ok: Boolean(detail.ok), message: detail.message || "", jobId: printJobId })
          });
          confirmationError = null;
          break;
        } catch (error) {
          confirmationError = error;
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
        }
      }
      state.localPointPrintStatus = detail.ok && result?.completed ? "printed" : "failed";
      if (detail.ok && result?.completed) {
        localStorage.removeItem("cine_admin_active_point_payment");
        localStorage.removeItem("cine_admin_active_concession_point_payment");
        showToast("Impressão confirmada. Os ingressos foram emitidos e ativados.");
        await loadContent({ silent: true });
      } else {
        showToast(confirmationError?.message || detail.message || "A impressora térmica não confirmou a impressão. O ingresso não foi emitido.", "error");
      }
      if (result && state.pointPaymentSnapshot) renderPointPayment(result);
      else if (state.pointPaymentSnapshot) renderPointPayment(state.pointPaymentSnapshot);
      if (result && state.concessionCounterPaymentSnapshot) renderConcessionCounterPayment(result);
      else if (state.concessionCounterPaymentSnapshot) renderConcessionCounterPayment(state.concessionCounterPaymentSnapshot);
    });

    function renderPointPayment(data = {}) {
      const payment = data.payment || state.pointPaymentSnapshot?.payment || {};
      const orders = data.orders || state.pointPaymentSnapshot?.orders || [];
      const tickets = data.tickets || state.pointPaymentSnapshot?.tickets || [];
      const pointPrint = data.pointPrint || state.pointPaymentSnapshot?.pointPrint || {};
      const ticketDelivery = orders[0]?.ticketDelivery || {};
      const onlineDelivery = orders.some((order) => order.ticketDeliveryMethod === "online");
      const status = data.reconnecting ? "reconnecting" : payment.status || "pending";
      const reconciliationRequired = Boolean(data.reconciliationRequired || payment.metadata?.reconciliationRequired);
      const pendingPrint = status === "approved" && orders.some((order) => order.status === "paid_pending_print") && !data.completed;
      const finalStatus = ["rejected", "cancelled", "expired", "refunded"].includes(status) || (status === "approved" && !pendingPrint);
      state.pointPaymentSnapshot = { ...data, payment, orders, tickets, pointPrint };

      const panel = $("pointPaymentPanel");
      panel.hidden = false;
      document.querySelector("#boxOfficeNewSale .box-office-sale-workspace").hidden = true;
      panel.dataset.status = status;
      $("pointPaymentAmount").textContent = money(payment.amount);
      $("pointPaymentTerminal").textContent = payment.metadata?.terminalId || data.terminal?.id || "Impressora local";
      $("pointPaymentReference").textContent = payment.providerReference || payment.providerPaymentId || "-";
      $("pointPaymentStatus").textContent = status === "approved" && payment.metadata?.kind === "counter_sale"
        ? "Recebido" : pointPaymentStatusLabel(status);
      $("pointPaymentRetryButton").hidden = status === "approved";
      $("pointPaymentCancelButton").hidden = status === "approved" || finalStatus || status === "reconnecting";
      $("pointPaymentNewSaleButton").hidden = !finalStatus;

      const needsLocalPrint = ["local_required", "failed"].includes(String(pointPrint.status || ""));
      if (pendingPrint && needsLocalPrint && !onlineDelivery && !["failed", "unavailable"].includes(state.localPointPrintStatus)) {
        requestLocalPointPaymentPrint(payment.id || state.pointPaymentId);
      }
      if (payment.status === "approved" && data.completed === true) {
        localStorage.removeItem("cine_admin_active_point_payment");
      }

      const copy = reconciliationRequired ? [
        "Conciliação financeira necessária",
        "A Point confirmou um pagamento para um pedido encerrado ou ausente. Nenhum ingresso será emitido automaticamente. Confira a referência no painel antes de qualquer nova cobrança ou reembolso."
      ] : {
        approved: [
          pendingPrint ? "Pagamento registrado, aguardando impressão" : "Venda concluída; ingressos emitidos",
          onlineDelivery
            ? ticketDelivery.message || "Os ingressos digitais estão sendo enviados ao e-mail informado."
            : pointPrint.status === "printed"
            ? "O pagamento e a impressão dos ingressos foram confirmados pela Point."
            : ["queued", "on_terminal"].includes(pointPrint.status)
            ? pointPrint.message || "A impressão foi enviada à Point e está sendo confirmada."
            : state.localPointPrintStatus === "printed"
            ? "O trabalho foi aceito pela impressora térmica deste computador."
            : state.localPointPrintStatus === "printing"
            ? "Pagamento confirmado. Enviando o ingresso à impressora térmica deste computador."
            : pointPrint.message || (pendingPrint ? "O ingresso só será emitido depois que a impressão for confirmada." : "A venda foi confirmada.")
        ],
        rejected: ["Pagamento recusado", "Nenhum ingresso foi emitido. Inicie uma nova venda para tentar outra forma de pagamento."],
        cancelled: ["Cobrança cancelada", "A ordem foi cancelada no terminal e nenhum ingresso foi emitido."],
        expired: ["Tempo de pagamento encerrado", "A cobrança expirou sem aprovação e os ingressos não foram emitidos."],
        refunded: ["Pagamento estornado", "O Mercado Pago informou o estorno desta cobrança."],
        reconnecting: ["Reconectando à maquininha", payment.metadata?.connectionMessage || "A cobrança continua vinculada à mesma Order. O sistema tentará novamente sem duplicar o pagamento."]
      }[status] || ["Aguardando pagamento na Point", "A cobrança foi enviada. Oriente o cliente a concluir o pagamento no terminal."];
      $("pointPaymentTitle").textContent = copy[0];
      $("pointPaymentMessage").textContent = copy[1];

      const printActions = $("pointPaymentPrintActions");
      if (status === "approved" && orders.length && !onlineDelivery && !reconciliationRequired) {
        const printFailed = ["failed", "timed_out"].includes(String(pointPrint.status || "")) || ["failed", "unavailable"].includes(state.localPointPrintStatus);
        const canRetryPrint = ["local_required", "failed", "timed_out"].includes(String(pointPrint.status || "")) || ["failed", "unavailable"].includes(state.localPointPrintStatus);
        const resolutionLabel = payment.metadata?.kind === "point_sale" ? "Reembolsar pagamento" : "Cancelar pedido";
        const canResolve = adminCan(payment.metadata?.kind === "point_sale" ? "orders.refund" : "orders.cancel");
        printActions.hidden = false;
        printActions.innerHTML = `
          <strong>Impressão da venda</strong>
          <p>${pendingPrint ? `A emissão está bloqueada até a impressora confirmar o trabalho. ${tickets.length || orders.reduce((sum, order) => sum + Number(order.printFulfillment?.ticketCount || 0), 0)} ingresso(s) aguardando ativação.` : `${tickets.length} ingresso(s) emitido(s).`}</p>
          <div class="button-row">
            ${pendingPrint ? canRetryPrint ? `<button class="ghost-button" type="button" data-point-print-action="retry" data-point-print-id="${escapeHtml(payment.id || state.pointPaymentId)}">Tentar imprimir novamente</button>` : "" : `<button class="ghost-button" type="button" data-point-print-action="reprint" data-point-print-id="${escapeHtml(payment.id || state.pointPaymentId)}">Imprimir venda novamente</button>`}
            ${pendingPrint && printFailed && canResolve ? `<button class="danger-button" type="button" data-point-print-action="resolve" data-point-print-id="${escapeHtml(payment.id || state.pointPaymentId)}" data-point-resolution="${payment.metadata?.kind === "point_sale" ? "refund" : "cancel"}">${resolutionLabel}</button>` : ""}
            ${pendingPrint ? "" : tickets.map((ticket, index) => `<button class="ghost-button" type="button" data-point-print-action="ticket" data-point-print-id="${escapeHtml(ticket.id)}">Imprimir apenas ${escapeHtml(ticket.movieTitle || ticket.ticketType || `ingresso ${index + 1}`)}</button>`).join("")}
          </div>
        `;
      } else {
        printActions.hidden = true;
        printActions.innerHTML = "";
      }
    }

    function schedulePointPaymentPoll(delay = 2200) {
      stopPointPaymentPolling();
      if (!state.pointPaymentId) return;
      state.pointPaymentTimer = setTimeout(() => pollPointPayment(), delay);
    }

    async function pollPointPayment({ manual = false } = {}) {
      if (!state.pointPaymentId || state.pointPaymentSyncing) return;
      state.pointPaymentSyncing = true;
      const retryButton = $("pointPaymentRetryButton");
      if (manual) retryButton.disabled = true;
      try {
        const result = await api(`/api/box-office/point-payments/${encodeURIComponent(state.pointPaymentId)}`);
        renderPointPayment(result);
        if (result.reconnecting) {
          state.pointPaymentPollAttempts += 1;
          schedulePointPaymentPoll(Math.min(15000, Number(result.retryAfterMs || 3500) + state.pointPaymentPollAttempts * 1000));
          return;
        }
        state.pointPaymentPollAttempts = 0;
        if (result.reconciliationRequired) {
          stopPointPaymentPolling();
          await loadContent({ silent: true });
          renderPointPayment(result);
          showToast("Pagamento exige conciliação administrativa. Não refaça a cobrança.");
          return;
        }
        if (result.payment?.status === "approved") {
          await loadContent({ silent: true });
          renderPointPayment(result);
          if (["queued", "on_terminal"].includes(String(result.pointPrint?.status || ""))) schedulePointPaymentPoll(2500);
          else stopPointPaymentPolling();
          showToast("Pagamento aprovado. Finalizando a impressão dos ingressos.");
        } else if (["rejected", "cancelled", "expired", "refunded"].includes(result.payment?.status)) {
          stopPointPaymentPolling();
          localStorage.removeItem("cine_admin_active_point_payment");
          await loadContent({ silent: true });
        } else {
          schedulePointPaymentPoll();
        }
      } catch (error) {
        state.pointPaymentPollAttempts += 1;
        $("pointPaymentMessage").textContent = `${error.message} Tentaremos consultar novamente automaticamente.`;
        schedulePointPaymentPoll(Math.min(15000, 3000 + state.pointPaymentPollAttempts * 1500));
      } finally {
        state.pointPaymentSyncing = false;
        retryButton.disabled = false;
      }
    }

    function startPointPaymentTracking(result) {
      state.pointPaymentId = result.payment?.id || "";
      state.localPointPrintStatus = "";
      state.pointPaymentPollAttempts = 0;
      if (state.pointPaymentId) localStorage.setItem("cine_admin_active_point_payment", state.pointPaymentId);
      renderPointPayment(result);
      if (result.payment?.status === "approved") {
        void loadContent({ silent: true }).then(() => renderPointPayment(result));
        if (["queued", "on_terminal"].includes(String(result.pointPrint?.status || ""))) schedulePointPaymentPoll(2500);
        return;
      }
      schedulePointPaymentPoll(1200);
    }

    async function cancelPointPayment() {
      const paymentId = state.pointPaymentId;
      const actionKey = `cancel:${paymentId}`;
      if (!paymentId || inFlightActions.has(actionKey) || !confirm("Cancelar a cobrança enviada à Point? Nenhum ingresso será emitido.")) return;
      inFlightActions.add(actionKey);
      const button = $("pointPaymentCancelButton");
      button.disabled = true;
      try {
        const result = await api(`/api/box-office/point-payments/${encodeURIComponent(state.pointPaymentId)}/cancel`, { method: "POST" });
        renderPointPayment(result);
        await loadContent({ silent: true });
        if (result.cancellationPending) {
          schedulePointPaymentPoll(1200);
          showToast("Cancelamento solicitado. Aguardando confirmação da Point.");
        } else {
          stopPointPaymentPolling();
          showToast("Cobrança encerrada no Mercado Pago Point.");
        }
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        inFlightActions.delete(actionKey);
        button.disabled = false;
      }
    }

    async function retryPendingSalePrint(paymentId = state.pointPaymentId) {
      if (!paymentId) return;
      state.localPointPrintStatus = "";
      if (desktopThermalPrinterAvailable()) {
        await requestLocalPointPaymentPrint(paymentId, { manual: true });
        if (state.pointPaymentSnapshot) renderPointPayment(state.pointPaymentSnapshot);
        if (state.concessionCounterPaymentSnapshot) renderConcessionCounterPayment(state.concessionCounterPaymentSnapshot);
        return;
      }
      const snapshot = state.pointPaymentId === paymentId ? state.pointPaymentSnapshot : state.concessionCounterPaymentSnapshot;
      if (snapshot?.payment?.metadata?.kind === "counter_sale") {
        showToast("A impressão desta venda exige o aplicativo desktop com uma impressora térmica padrão configurada.", "error");
        return;
      }
      try {
        const result = await api(`/api/box-office/point-payments/${encodeURIComponent(paymentId)}/retry-print`, {
          method: "POST",
          body: JSON.stringify({ mode: "point" })
        });
        if (state.pointPaymentId === paymentId) {
          renderPointPayment(result);
          schedulePointPaymentPoll(1800);
        }
        if (state.concessionCounterPaymentId === paymentId) {
          renderConcessionCounterPayment(result);
          scheduleConcessionCounterPaymentPoll(1800);
        }
        showToast(result.pointPrint?.status === "queued" ? "Nova tentativa enviada para a Point." : "Prepare a impressora térmica padrão e tente novamente pelo aplicativo do painel.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function resolvePendingSalePrint(paymentId = state.pointPaymentId, action = "refund") {
      if (!paymentId) return;
      const actionKey = `resolve:${paymentId}`;
      if (inFlightActions.has(actionKey)) return;
      const verb = action === "refund" ? "reembolsar o pagamento" : "cancelar o pedido";
      if (!confirm(`A impressão ainda não foi confirmada. Deseja ${verb}? O ingresso não será emitido.`)) return;
      inFlightActions.add(actionKey);
      try {
        const result = await api(`/api/box-office/point-payments/${encodeURIComponent(paymentId)}/resolve-print-failure`, {
          method: "POST",
          body: JSON.stringify({ action, reason: "Falha na impressão do ingresso" })
        });
        stopPointPaymentPolling();
        stopConcessionCounterPaymentPolling();
        localStorage.removeItem("cine_admin_active_point_payment");
        localStorage.removeItem("cine_admin_active_concession_point_payment");
        await loadContent({ silent: true });
        if (state.pointPaymentId === paymentId) renderPointPayment(result);
        if (state.concessionCounterPaymentId === paymentId) renderConcessionCounterPayment(result);
        showToast(result.resolution === "refunded" ? "Pagamento reembolsado. Nenhum ingresso foi emitido." : "Pedido cancelado. Nenhum ingresso foi emitido.");
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        inFlightActions.delete(actionKey);
      }
    }

    function resetPointPaymentPanel() {
      stopPointPaymentPolling();
      state.pointPaymentId = "";
      state.pointCheckoutKey = "";
      sessionStorage.removeItem("cine_admin_point_checkout_key");
      state.pointPaymentPollAttempts = 0;
      state.localPointPrintStatus = "";
      localStorage.removeItem("cine_admin_active_point_payment");
      state.pointPaymentSnapshot = null;
      $("pointPaymentPanel").hidden = true;
      document.querySelector("#boxOfficeNewSale .box-office-sale-workspace").hidden = false;
      $("manualTicketForm").hidden = false;
      renderManualSaleItems();
      $("manualTicketForm").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function printPhysicalTicket(ticketId) {
      const url = `${API_BASE}/api/admin/tickets/${encodeURIComponent(ticketId)}/print`;
      if (desktopThermalPrinterAvailable()) {
        window.cineDesktop.printUrl(url, `ticket-${ticketId}`);
        return;
      }
      const popup = window.open(url, "_blank");
      if (popup) popup.opener = null;
      else showToast("O navegador bloqueou a abertura do PDF. Permita pop-ups para imprimir.", "error");
    }

    return { pointPaymentStatusLabel, stopPointPaymentPolling, pointPaymentPrintUrl, desktopThermalPrinterAvailable, requestLocalPointPaymentPrint, renderPointPayment, schedulePointPaymentPoll, pollPointPayment, startPointPaymentTracking, cancelPointPayment, retryPendingSalePrint, resolvePendingSalePrint, resetPointPaymentPanel, printPhysicalTicket };
  }
  const api = Object.freeze({ createBoxOfficePointController });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.boxOfficePointController = api; }
})(globalThis);
