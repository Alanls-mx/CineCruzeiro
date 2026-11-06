((root) => {
  function createBoxOfficeSaleCommand({ state, $, api, document, showToast, showSuccess, manualSaleDraft, manualDraftSeatSelectionComplete, manualTicketDeliveryMethod, manualConcessionItems, closeManualSeatRealtime, renderManualSaleItems, startPointPaymentTracking, loadContent, loadManualSeatMap }) {
    let saleInFlight = false;
    async function createManualTicket(event) {
      event.preventDefault();
      if (saleInFlight) return;
      const draft = manualSaleDraft();
      const saleItems = state.manualSaleItems.length ? state.manualSaleItems : draft ? [draft] : [];
      if (!saleItems.length) {
        showToast("Adicione ao menos um filme com ingressos à venda.", "error");
        return;
      }
      const incompleteSeatItem = saleItems.find((item) => !manualDraftSeatSelectionComplete(item));
      if (incompleteSeatItem) {
        showToast(`Complete a seleção de poltronas para ${incompleteSeatItem.movieTitle}.`, "error");
        return;
      }
      if (state.saleMode === "registered" && !$("manualCustomerUserId").value) {
        showToast("Selecione o usuário que receberá os ingressos.", "error");
        return;
      }

      const submitButton = $("manualSaleSubmitButton");
      try {
        saleInFlight = true;
        submitButton.disabled = true;
        submitButton.textContent = "Finalizando venda...";
        const paymentMethod = document.querySelector("input[name='manualPaymentMethod']:checked")?.value || "cash";
        const saleMode = state.saleMode;
        const ticketDeliveryMethod = manualTicketDeliveryMethod();
        const requiresLocalPrint = (saleMode === "quick" || (saleMode === "guest" && ticketDeliveryMethod === "physical"))
          && ["cash", "courtesy"].includes(paymentMethod);
        if (requiresLocalPrint) {
          if (!window.cineDesktop?.checkPrinter) {
            showToast("A impressão física exige o aplicativo desktop atualizado e uma impressora térmica instalada.", "error");
            return;
          }
          const printer = await window.cineDesktop.checkPrinter();
          if (!printer.ready) {
            showToast(printer.message || "Configure uma impressora térmica física em Dispositivos antes de vender.", "error");
            return;
          }
        }
        const guestEmail = $("manualCustomerEmail").value.trim();
        if (saleMode === "guest" && ticketDeliveryMethod === "online" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
          showToast("Informe um e-mail válido para entregar o ingresso online.", "error");
          $("manualCustomerEmail").focus();
          return;
        }
        const payload = {
          fullTicketsCount: 0,
          halfTicketsCount: 0,
          saleItems: saleItems.map((item) => ({
            movieId: item.movieId,
            sessionId: item.sessionId,
            ticketItems: item.ticketItems,
            selectedSeatIds: item.selectedSeatIds || [],
            seatHoldToken: item.seatHoldToken || "",
            autoAssignSeats: false
          })),
          concessionItems: manualConcessionItems(),
          saleMode,
          ticketDeliveryMethod,
          paymentMethod,
          customerUserId: saleMode === "registered" ? $("manualCustomerUserId").value : "",
          customerName: saleMode === "quick" ? "" : $("manualCustomerName").value,
          customerEmail: saleMode === "quick" ? "" : $("manualCustomerEmail").value,
          customerPhone: saleMode === "quick" ? "" : $("manualCustomerPhone").value,
          customerCpf: saleMode === "quick" ? "" : $("manualCustomerCpf").value.replace(/\D/g, ""),
          createdAt: new Date().toISOString()
        };
        const pointPayment = ["point_debit", "point_credit", "point_card", "point_qr"].includes(paymentMethod);
        if (pointPayment) {
          state.pointCheckoutKey ||= String(sessionStorage.getItem("cine_admin_point_checkout_key") || "") || crypto.randomUUID();
          sessionStorage.setItem("cine_admin_point_checkout_key", state.pointCheckoutKey);
          payload.clientRequestId = state.pointCheckoutKey;
        }
        const result = await api("/api/box-office/sales", { method: "POST", body: JSON.stringify(payload) });
        const orders = result.orders || (result.order ? [result.order] : []);
        state.manualSaleItems = [];
        state.manualConcessionQuantities = {};
        state.manualSelectedSeatIds = [];
        closeManualSeatRealtime();
        renderManualSaleItems();
        if (pointPayment) {
          state.pointCheckoutKey = "";
          sessionStorage.removeItem("cine_admin_point_checkout_key");
        }
        if (pointPayment || orders.some((order) => order.status === "paid_pending_print")) {
          startPointPaymentTracking(result);
          return;
        }
        await loadContent({ silent: true });
        const pointPrint = result.pointPrint || {};
        const ticketDelivery = orders[0]?.ticketDelivery || {};
        const deliveryMessage = ticketDelivery.message
          ? ` ${ticketDelivery.message}`
          : pointPrint.status === "queued"
            ? " Os ingressos foram enviados para impressão na Point."
            : pointPrint.message ? ` ${pointPrint.message}` : "";
        showSuccess(
          "Venda finalizada",
          `${orders.length} ${orders.length === 1 ? "pedido criado" : "pedidos criados"} e ${(result.tickets || []).length} ingresso(s) emitido(s).${deliveryMessage}`
        );
      } catch (error) {
        showToast(error.message, "error");
        if (["SEAT_UNAVAILABLE", "SEAT_LAYOUT_CHANGED", "SEAT_SELECTION_INCOMPLETE"].includes(error.payload?.error?.code)) {
          void loadManualSeatMap();
        }
      } finally {
        saleInFlight = false;
        submitButton.disabled = false;
        renderManualSaleItems();
      }
    }

    return { createManualTicket };
  }
  const api = Object.freeze({ createBoxOfficeSaleCommand });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.boxOfficeSaleCommand = api; }
})(globalThis);
