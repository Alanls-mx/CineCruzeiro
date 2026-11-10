((root) => {
  function createOrderManagementActions({ state, $, API_BASE, api, confirm, currentOrder, desktopThermalPrinterAvailable, fillOrderEditor, loadContent, money, orderReference, orderStatusLabel, paymentForOrder, showToast, window }) {
    const pendingActions = new Set();
    async function once(key, action, event) {
      event?.preventDefault?.();
      if (pendingActions.has(key)) return;
      pendingActions.add(key);
      try { return await action(); }
      finally { pendingActions.delete(key); }
    }

    async function executeOrderRefundTickets(orderId = state.selectedOrderId) {
      const order = (state.content?.orders || []).find((item) => item.id === orderId);
      if (!order) return;
      if (!confirm("Confirmar o reembolso dos ingressos deste pedido?")) return;
      try {
        const result = await api(`/api/orders/${encodeURIComponent(order.id)}/refund-tickets`, {
          method: "POST",
          body: JSON.stringify({})
        });
        await loadContent({ silent: true });
        closeOrderOverlay();
        showToast(result.message || `Ingressos reembolsados: ${money(result.refundedAmount || 0)}`);
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function executeOrderRefundConcessions(orderId = state.selectedOrderId) {
      const order = (state.content?.orders || []).find((item) => item.id === orderId);
      if (!order) return;
      if (!confirm("Confirmar o reembolso dos itens de bomboniere deste pedido?")) return;
      try {
        const result = await api(`/api/orders/${encodeURIComponent(order.id)}/refund-concessions`, {
          method: "POST",
          body: JSON.stringify({})
        });
        await loadContent({ silent: true });
        closeOrderOverlay();
        showToast(result.message || `Bomboniere reembolsada: ${money(result.refundedAmount || 0)}`);
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    function openOrderView(orderId) {
      fillOrderEditor((state.content?.orders || []).find((order) => order.id === orderId), "view");
    }

    function openOrderEdit(orderId) {
      fillOrderEditor((state.content?.orders || []).find((order) => order.id === orderId), "edit");
    }

    function closeOrderOverlay() {
      $("orderOverlay").hidden = true;
      state.selectedOrderId = "";
      $("orderDetailBody").innerHTML = "";
      ["orderCustomerName", "orderCustomerPhone", "orderCustomerEmail", "orderCustomerCpf", "orderOperationalNotes"].forEach((id) => { $(id).value = ""; });
    }

    async function saveOrderEdit(event) {
      event.preventDefault();
      const order = currentOrder();
      if (!order) return;
      try {
        await api(`/api/orders/${encodeURIComponent(order.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            customerName: $("orderCustomerName").value,
            customerPhone: $("orderCustomerPhone").value,
            customerEmail: $("orderCustomerEmail").value,
            customerCpf: $("orderCustomerCpf").value,
            operationalNotes: $("orderOperationalNotes").value,
            reason: "Edição pelo painel"
          })
        });
        await loadContent({ silent: true });
        closeOrderOverlay();
        showToast("Pedido atualizado.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function cancelOrDeleteOrder(orderId = state.selectedOrderId) {
      const order = (state.content?.orders || []).find((item) => item.id === orderId);
      if (!order) return;
      if (["cancelled", "refunded"].includes(order.status)) {
        showToast("Este pedido já foi cancelado. Agora ele pode ser arquivado ou excluído.", "error");
        return;
      }
      const draft = ["draft", "test"].includes(order.status);
      const warning = order.status === "paid" ? " O pagamento aprovado poderá ser reembolsado, quando elegível." : "";
      if (!confirm(`Confirmar ${draft ? "exclusão" : "cancelamento"} deste pedido?${warning}`)) return;
      try {
        const result = await api(`/api/orders/${encodeURIComponent(order.id)}`, {
          method: draft ? "DELETE" : "PATCH",
          body: JSON.stringify(draft ? {} : { action: "cancel" })
        });
        await loadContent({ silent: true });
        closeOrderOverlay();
        showToast(result.manualRefundRequired
          ? `Pedido cancelado. ${result.manualRefundReason || "A devolução deve ser concluída manualmente."}`
          : result.order?.refundStatus === "completed"
          ? "Pedido reembolsado pelo Mercado Pago."
          : draft
          ? "Pedido excluído."
          : "Pedido cancelado.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function archiveOrderAdmin(orderId = state.selectedOrderId) {
      const order = (state.content?.orders || []).find((item) => item.id === orderId);
      if (!order) return;
      if (!confirm("Arquivar este pedido?")) return;
      try {
        await api(`/api/orders/${encodeURIComponent(order.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "archive" })
        });
        await loadContent({ silent: true });
        closeOrderOverlay();
        showToast("Pedido arquivado.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function restoreOrderAdmin(orderId = state.selectedOrderId) {
      const order = (state.content?.orders || []).find((item) => item.id === orderId);
      if (!order || !order.archived || !confirm("Restaurar este pedido para a lista de ativos?")) return;
      try {
        await api(`/api/orders/${encodeURIComponent(order.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "unarchive", reason: "Restaurado pelo painel" })
        });
        await loadContent({ silent: true });
        closeOrderOverlay();
        showToast("Pedido restaurado.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    function printOrderTicket(orderId) {
      const url = `${API_BASE}/api/admin/orders/${encodeURIComponent(orderId)}/print`;
      if (desktopThermalPrinterAvailable()) {
        window.cineDesktop.printUrl(url, `order-${orderId}`);
        return;
      }
      const popup = window.open(url, "_blank");
      if (popup) popup.opener = null;
      else showToast("Permita pop-ups para abrir a via PDV.", "error");
    }

    async function resendOrderTicket(orderId) {
      try {
        await api(`/api/orders/${encodeURIComponent(orderId)}/resend-ticket-email`, { method: "POST" });
        showToast("Ingresso reenviado por e-mail.");
        openOrderView(orderId);
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    function openPermanentDelete(orderId = state.selectedOrderId) {
      const order = (state.content?.orders || []).find((item) => item.id === orderId);
      if (!order) return;
      state.selectedOrderId = order.id;
      const payment = paymentForOrder(order.id);
      $("permanentDeleteSummary").textContent = `${orderReference(order)} • ${order.movieTitle || "Pedido"} • ${money(order.totalPrice)} • ${orderStatusLabel(order.status)}${payment && !["box_office", "admin", "external_manual", "manual_external", "internal_club"].includes(payment.provider) ? " • provider externo vinculado" : ""}`;
      $("permanentDeleteConfirmation").value = "";
      $("permanentDeleteOverlay").hidden = false;
    }

    function closePermanentDelete() {
      $("permanentDeleteOverlay").hidden = true;
    }

    async function permanentlyDeleteSelectedOrder(event) {
      event.preventDefault();
      const order = currentOrder();
      if (!order) return;
      try {
        await api(`/api/orders/${encodeURIComponent(order.id)}/permanent`, {
          method: "DELETE",
          body: JSON.stringify({
            confirmation: $("permanentDeleteConfirmation").value
          })
        });
        await loadContent({ silent: true });
        closePermanentDelete();
        closeOrderOverlay();
        showToast("Pedido excluído permanentemente.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    return {
      openOrderView, openOrderEdit, closeOrderOverlay, printOrderTicket, openPermanentDelete, closePermanentDelete,
      executeOrderRefundTickets: (id = state.selectedOrderId) => once(`refund-tickets-${id}`, () => executeOrderRefundTickets(id)),
      executeOrderRefundConcessions: (id = state.selectedOrderId) => once(`refund-concessions-${id}`, () => executeOrderRefundConcessions(id)),
      saveOrderEdit: (event) => once(`edit-${state.selectedOrderId}`, () => saveOrderEdit(event), event),
      cancelOrDeleteOrder: (id = state.selectedOrderId) => once(`cancel-${id}`, () => cancelOrDeleteOrder(id)),
      archiveOrderAdmin: (id = state.selectedOrderId) => once(`archive-${id}`, () => archiveOrderAdmin(id)),
      restoreOrderAdmin: (id = state.selectedOrderId) => once(`restore-${id}`, () => restoreOrderAdmin(id)),
      resendOrderTicket: (id) => once(`resend-${id}`, () => resendOrderTicket(id)),
      permanentlyDeleteSelectedOrder: (event) => once(`permanent-${state.selectedOrderId}`, () => permanentlyDeleteSelectedOrder(event), event)
    };
  }

  const api = Object.freeze({ createOrderManagementActions });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.orderManagementActions = api; }
})(globalThis);
