((root) => {
  function createOrderManagementView({ state, $, adminAssetUrl, adminCan, escapeHtml, financialStatusEventHtml, getOrderValidationSummary, isOrderEffectivelyActive, isOrderEffectivelyArchived, isOrderFullyValidated, isOrderSessionExpired, money, orderMatchesStatusFilter, orderReference, orderStatusLabel, paymentMethodLabel, paymentStatusLabel, providerLabel, renderManualSaleOptions }) {
    function renderOrders() {
      renderManualSaleOptions();
      const orders = state.content?.orders || [];
      const query = (state.orderFilters.allQuery || "").toLowerCase();
      let filteredOrders = orders.filter((order) => {
        if (state.orderFilters.archiveStatus === "archived") return isOrderEffectivelyArchived(order);
        if (state.orderFilters.archiveStatus === "active") return isOrderEffectivelyActive(order);
        return true;
      });
      filteredOrders = query
        ? filteredOrders.filter((order) => [
            orderReference(order),
            order.customerName,
            order.customerEmail,
            order.customerPhone,
            order.movieTitle,
            order.sessionTime,
            order.saleMode,
            ...(order.tickets || []).map((ticket) => ticket.displayCode || ticket.code)
          ].join(" ").toLowerCase().includes(query))
        : filteredOrders;
      if (state.orderFilters.allStatus !== "all") {
        filteredOrders = filteredOrders.filter((order) => orderMatchesStatusFilter(order, state.orderFilters.allStatus));
      }

      renderOrdersTable("ordersList", filteredOrders, {
        compact: false,
        emptyTitle: state.orderFilters.archiveStatus === "archived" ? "Nenhum pedido arquivado" : "Nenhum pedido encontrado",
        emptyMessage: state.orderFilters.archiveStatus === "archived"
          ? "Os pedidos arquivados (validados por QR Code, cancelados ou reembolsados) ficam preservados aqui."
          : "Ajuste a busca ou aguarde uma nova venda."
      });
      const today = state.content?.calendar?.today || new Date().toISOString().slice(0, 10);
      const relevantDate = (order, filter) => {
        const payment = paymentForOrder(order.id) || {};
        if (filter === "refunded") return payment.refundedAt || order.refundedAt || order.concessionRefund?.completedAt || order.createdAt;
        if (filter === "expired") return payment.expiredAt || order.expiredAt || order.createdAt;
        if (filter === "paid") return payment.approvedAt || order.paidAt || order.createdAt;
        return order.createdAt;
      };
      let todayOrders = orders.filter((order) => String(relevantDate(order, state.orderFilters.todayStatus) || "").slice(0, 10) === today);
      if (state.orderFilters.todayOrigin !== "all") todayOrders = todayOrders.filter((order) => String(order.origin || "online") === state.orderFilters.todayOrigin);
      if (state.orderFilters.todayStatus !== "all") {
        todayOrders = todayOrders.filter((order) => orderMatchesStatusFilter(order, state.orderFilters.todayStatus));
      }
      renderTodaySalesSummary(orders.filter((order) => String(order.createdAt || "").slice(0, 10) === today));
      renderOrdersTable("todayOrdersList", todayOrders, { compact: true });
    }

    function renderTodaySalesSummary(orders) {
      if (!$("todaySalesSummary")) return;
      const paid = orders.filter((order) => order.status === "paid");
      const revenue = paid.reduce((total, order) => total + Number(order.totalPrice || 0), 0);
      const tickets = paid.reduce((total, order) => total + orderTicketCount(order), 0);
      const boxOffice = paid.filter((order) => order.origin === "box_office").reduce((total, order) => total + Number(order.totalPrice || 0), 0);
      $("todaySalesSummary").innerHTML = `
        <div><span>Vendas hoje</span><strong>${paid.length}</strong></div>
        <div><span>Receita hoje</span><strong>${money(revenue)}</strong></div>
        <div><span>Ingressos</span><strong>${tickets}</strong></div>
        <div><span>Bilheteria</span><strong>${money(boxOffice)}</strong></div>
      `;
    }

    function orderTicketCount(order) {
      const legacyCount = Number(order.fullTicketsCount || 0) + Number(order.halfTicketsCount || 0);
      const itemCount = (order.ticketItems || []).reduce((total, item) => {
        const explicitTickets = Number(item.ticketQuantity || 0);
        const quantity = Math.max(0, Number(item.quantity || 0));
        const bundleQuantity = Math.max(1, Number(item.bundleQuantity || 1));
        return total + (explicitTickets > 0 ? explicitTickets : quantity * bundleQuantity);
      }, 0);
      const issuedCount = Array.isArray(order.tickets) ? order.tickets.length : 0;
      return Math.max(0, legacyCount, itemCount, issuedCount);
    }

    function renderOrdersTable(targetId, orders, options = {}) {
      const target = $(targetId);
      if (!target) return;
      if (!orders.length) {
        target.innerHTML = `
          <div class="empty-state">
            <strong>${escapeHtml(options.emptyTitle || "Nenhum pedido registrado ainda")}</strong>
            <span>${escapeHtml(options.emptyMessage || "As vendas online e de bilheteria aparecem aqui automaticamente.")}</span>
          </div>
        `;
        return;
      }

      const pageKey = targetId === "todayOrdersList" ? "todayOrdersPage" : "ordersPage";
      const sizeKey = targetId === "todayOrdersList" ? "todayOrdersPageSize" : "ordersPageSize";
      const pageSize = state[sizeKey] || 5;
      const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
      state[pageKey] = Math.min(Math.max(1, state[pageKey] || 1), totalPages);
      const start = (state[pageKey] - 1) * pageSize;
      const pageItems = orders.slice(start, start + pageSize);

      const pagerMarkup = `
        <div class="issued-tickets-pager-bar" style="margin-bottom: var(--sp-8);">
          <span>Exibindo <strong>${start + 1}–${Math.min(start + pageItems.length, orders.length)}</strong> de <strong>${orders.length}</strong> pedido(s)</span>
          <div class="pager-controls">
            <button class="ghost-button" type="button" ${state[pageKey] <= 1 ? "disabled" : ""} data-order-page-target="${targetId}" data-page-delta="-1">← Anterior</button>
            <span class="pager-page-indicator">Página ${state[pageKey]} de ${totalPages}</span>
            <button class="ghost-button" type="button" ${state[pageKey] >= totalPages ? "disabled" : ""} data-order-page-target="${targetId}" data-page-delta="1">Próxima →</button>
          </div>
        </div>
      `;

      target.innerHTML = `
        ${pagerMarkup}
        <div class="orders-table">
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Cliente</th>
                <th>Filme/Sessão</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Pagamento</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${pageItems
                .map(
                  (order) => {
                    const extras = (order.concessionItems || []).map((item) => `${escapeHtml(item.name)} x${Number(item.quantity || 0)}`).join("<br>") || "Sem extras";
                    const tickets = (order.tickets || []).slice(0, 2).map((ticket) => `<button class="copy-code" type="button" data-admin-ticket-action="copy" data-admin-ticket-value="${escapeHtml(ticket.displayCode || ticket.code)}">${escapeHtml(ticket.displayCode || ticket.code)}</button>`).join(" ");
                    const quickSale = order.saleMode === "quick";
                    const customerLabel = quickSale ? "Venda rápida" : order.customerName || "Cliente avulso";
                    const isArchived = isOrderEffectivelyArchived(order);
                    return `
                    <tr class="order-table-row ${isArchived ? "is-archived" : ""}" data-admin-order-action="view" data-admin-order-id="${escapeHtml(order.id)}">
                      <td data-label="Data/Hora"><strong>${escapeHtml(orderReference(order))}</strong><br><span class="list-meta">${new Date(order.createdAt).toLocaleString("pt-BR")}</span></td>
                      <td data-label="Cliente">${escapeHtml(customerLabel)}<br><span class="list-meta">${escapeHtml(quickSale ? "Sem identificação do cliente" : order.customerPhone || order.customerEmail || "")}</span></td>
                      <td data-label="Filme/Sessão"><strong>${escapeHtml(order.movieTitle || "-")}</strong><br><span class="list-meta">${escapeHtml([order.sessionTime, order.sessionFormat].filter(Boolean).join(" • ") || "-")}</span></td>
                      <td data-label="Itens">${orderTicketCount(order)} ingresso(s)<br><span class="list-meta">${extras}</span>${tickets ? `<div class="ticket-code-row">${tickets}</div>` : ""}</td>
                      <td data-label="Total"><strong>${money(order.totalPrice)}</strong></td>
                      <td data-label="Pagamento">${escapeHtml(originLabel(order.origin || "online"))}<br><span class="list-meta">${escapeHtml(paymentMethodLabel(order.paymentMethod))}</span></td>
                      <td data-label="Status"><div class="order-status-stack"><span class="status-label ${statusClass(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span>${isArchived ? '<span class="status-label archived">Arquivado</span>' : ""}${financialStatusEventHtml(order, paymentForOrder(order.id))}</div></td>
                      <td data-label="Ações">
                        <div class="context-menu">
                          <button class="ghost-button" type="button" data-admin-order-action="view" data-admin-order-id="${escapeHtml(order.id)}">Visualizar</button>
                          <button class="icon-button" type="button" data-admin-order-action="menu" data-admin-order-id="${escapeHtml(order.id)}" aria-label="Ações do pedido">•••</button>
                        </div>
                      </td>
                    </tr>
                  `;
                  }
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    function changeOrdersPage(delta, targetId) {
      const pageKey = targetId === "todayOrdersList" ? "todayOrdersPage" : "ordersPage";
      state[pageKey] = Math.max(1, (state[pageKey] || 1) + delta);
      renderOrders();
    }

    function statusClass(status = "") {
      const normalized = String(status || "").toLowerCase();
      if (["paid", "approved", "manual_sale"].includes(normalized)) return "ok";
      if (["pending", "pending_payment", "pix_pending", "processing"].includes(normalized)) return "warn";
      if (["cancelled", "rejected", "refunded", "expired"].includes(normalized)) return "danger";
      return "";
    }

    function originLabel(origin = "") {
      return {
        online: "Site",
        box_office: "Bilheteria",
        club: "Clube",
        manual: "Bilheteria",
        manual_sale: "Venda manual",
        admin: "Painel",
        pix_pending: "Pix pendente"
      }[String(origin || "").toLowerCase()] || humanizeEnum(origin) || "Site";
    }

    function paymentForOrder(orderId) {
      return (state.content?.payments || []).find((payment) => payment.orderId === orderId) || null;
    }

    function movieForOrder(order) {
      return (state.content?.movies || []).find((movie) => movie.id === order.movieId) || null;
    }

    function sectionHtml(title, rows) {
      return `
        <section class="order-detail-section">
          <h3>${escapeHtml(title)}</h3>
          <dl>
            ${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${String(value).includes("<") ? value : escapeHtml(value || "-")}</dd></div>`).join("")}
          </dl>
        </section>
      `;
    }

    function orderDetailHtml(order) {
      const payment = paymentForOrder(order.id);
      const movie = movieForOrder(order);
      const val = getOrderValidationSummary(order);
      const sandboxRefundSimulated = [order.ticketRefund, order.concessionRefund, payment?.metadata?.cancellationRefund, payment?.metadata?.ticketRefund, payment?.metadata?.concessionRefund].some((refund) => refund?.simulated === true);
      const issuedTickets = (state.content?.tickets || []).filter((ticket) => ticket.orderId === order.id);
      const tickets = (issuedTickets.length ? issuedTickets : order.tickets || []).map((ticket) => {
        const canChange = adminCan("orders.edit") && order.status === "paid" && ticket.status === "active"
          && !ticket.usedAt && !["pending", "completed"].includes(order.refundStatus);
        return `<div class="order-ticket-action-row">
          <button class="copy-code" type="button" data-admin-ticket-action="copy" data-admin-ticket-value="${escapeHtml(ticket.displayCode || ticket.code)}">${escapeHtml(ticket.displayCode || ticket.code)}</button>
          <span class="list-meta">${escapeHtml(ticket.movieTitle || order.movieTitle || "Filme")} · ${escapeHtml(ticket.sessionDate || order.sessionDate || "")} ${escapeHtml(ticket.sessionTime || order.sessionTime || "")} · ${escapeHtml(ticket.seat || "Lugar livre")}</span>
          ${adminCan("orders.edit") ? `<button class="ghost-button" type="button" data-admin-ticket-action="change-session" data-admin-ticket-value="${escapeHtml(ticket.id)}" ${canChange ? "" : 'disabled title="Disponível apenas para ingressos ativos de pedidos pagos, sem reembolso em andamento."'}>Trocar sessão</button>` : ""}
        </div>`;
      }).join("") || "-";
      const extras = (order.concessionItems || []).map((item) => `${escapeHtml(item.name || item.id)} x${Number(item.quantity || 0)}`).join("<br>") || "-";
      const history = (order.auditTrail || []).map((entry) => `${escapeHtml(entry.action || "alteração")} • ${new Date(entry.at || order.createdAt).toLocaleString("pt-BR")}`).join("<br>") || `Criação • ${new Date(order.createdAt).toLocaleString("pt-BR")}`;
      const serviceItems = (state.content?.orderServiceItems || []).filter((item) => item.orderId === order.id);
      const goodsItems = (state.content?.orderGoodsItems || []).filter((item) => item.orderId === order.id);
      const fiscalDocument = (state.content?.goodsFiscalDocuments || []).find((item) => item.orderId === order.id);
      const goodsFiscalLabel = {
        not_required: "Não necessária",
        waiting_trigger: "Aguardando entrega ou gatilho configurado",
        pending: "Em processamento",
        authorized: "Autorizada",
        contingency: "Em contingência",
        cancelled: "Cancelada",
        error: "Erro no provider fiscal"
      }[fiscalDocument?.status || order.goodsFiscalStatus] || "Não configurada";
      const serviceRows = serviceItems.map((item) => `${escapeHtml(item.name || "Ingresso")} • base ${money(item.basePrice)} • crédito ${money(item.subscriptionCreditAmount)} • complemento ${money(item.additionalPaymentAmount)}`).join("<br>") || "-";
      const goodsRows = goodsItems.map((item) => `${escapeHtml(item.name || item.sku || "Produto")} x${Number(item.quantity || 0)} • desconto ${money(item.clubDiscount)} • final ${money(Number(item.finalUnitPrice || 0) * Number(item.quantity || 0))}`).join("<br>") || "-";
      return `
        ${sectionHtml("Pedido", [
          ["Referência", orderReference(order)],
          ["Data", new Date(order.createdAt).toLocaleString("pt-BR")],
          ["Origem", originLabel(order.origin || "online")],
          ["Status", orderStatusLabel(order.status)],
          ["Arquivamento", isOrderEffectivelyArchived(order)
            ? `Arquivado ${order.archivedAt ? `em ${new Date(order.archivedAt).toLocaleString("pt-BR")}` : isOrderSessionExpired(order) ? "(sessão de cinema expirada)" : "(pedido concluído / cancelado)"}`
            : "Pedido ativo (aguardando validação ou pagamento)"]
        ])}
        ${sectionHtml("Cliente", [
          ["Tipo", order.saleMode === "quick" ? "Venda rápida" : order.customerUserId ? "Usuário cadastrado" : "Cliente avulso"],
          ["Nome", order.saleMode === "quick" ? "Sem identificação do cliente" : order.customerName || "Cliente avulso"],
          ["Contato", [order.customerPhone, order.customerEmail].filter(Boolean).join(" • ") || "-"]
        ])}
        ${sectionHtml("Sessão", [
          ["Filme", `${movie?.posterUrl ? `<img class="inline-poster" src="${escapeHtml(adminAssetUrl(movie.posterUrl))}" alt="">` : ""}${escapeHtml(order.movieTitle || movie?.title || "-")}`],
          ["Data e horário", [order.sessionDate, order.sessionTime].filter(Boolean).join(" • ") || order.sessionTime || "-"],
          ["Sala", order.sessionRoom || "Sala Cruzeiro"],
          ["Poltronas", Array.isArray(order.selectedSeats) && order.selectedSeats.length ? order.selectedSeats.map((seat) => seat.label).join(", ") : "Lugar livre"],
          ["Formato", order.sessionFormat || "-"]
        ])}
        ${sectionHtml("Ingressos", [
          ["Quantidade", `${orderTicketCount(order)} ingresso(s)`],
          ["Status no cinema", isOrderSessionExpired(order) ? "Sessão já expirada (Não reembolsável)" : val.ticketsValidated ? "Validados no cinema (Não reembolsável)" : val.ticketsCancelled ? "Cancelados / Reembolsados" : "Aguardando validação QR Code"],
          ["Códigos", tickets]
        ])}
        ${sectionHtml("Serviços de cinema", [
          ["Ingressos", serviceRows],
          ["Subtotal", money(order.serviceSubtotal || 0)],
          ["Créditos do Clube", money(order.clubCreditsApplied || 0)],
          ["Tratamento fiscal", "Conforme regra contábil vigente do Clube"]
        ])}
        ${sectionHtml("Mercadorias da bomboniere", [
          ["Status no balcão", val.concessionsDelivered ? "Entregue no balcão (Não reembolsável)" : val.concessionsCancelled ? "Cancelada / Reembolsada" : (order.concessionItems && order.concessionItems.length) ? "Aguardando retirada" : "Sem itens de bomboniere"],
          ["Produtos", goodsRows === "-" ? extras : goodsRows],
          ["Subtotal", money(order.goodsSubtotal || 0)],
          ["Status NFC-e", goodsFiscalLabel]
        ])}
        ${sectionHtml("Pagamento", [
          ["Método", paymentMethodLabel(payment?.method || order.paymentMethod)],
          ["Provider", providerLabel(payment?.provider || order.paymentProvider)],
          ["Valor", money(payment?.amount ?? order.totalPrice)],
          ["Complemento pago", money(order.additionalPayment || 0)],
          ["Status", paymentStatusLabel(payment?.status || order.paymentStatus)],
          ["Pagamento aprovado em", payment?.approvedAt || order.paidAt ? new Date(payment?.approvedAt || order.paidAt).toLocaleString("pt-BR") : "-"],
          ["Reembolso", sandboxRefundSimulated ? "Simulado (Sandbox; sem movimentação real)" : order.refundStatus === "required" ? "Devolução manual necessária" : order.refundStatus === "completed" ? "Concluído" : order.refundStatus === "pending" ? "Em processamento" : "-"],
          ["Reembolso concluído em", payment?.refundedAt || order.refundedAt || order.ticketRefund?.completedAt || order.concessionRefund?.completedAt ? new Date(payment?.refundedAt || order.refundedAt || order.ticketRefund?.completedAt || order.concessionRefund?.completedAt).toLocaleString("pt-BR") : "-"],
          ["Orientação", order.manualRefundReason || payment?.metadata?.manualRefund?.reason || "-"],
          ["Referência externa", payment?.providerPaymentId || payment?.providerReference || "-"]
        ])}
        ${sectionHtml("Histórico", [["Eventos", history], ["Observação", order.operationalNotes || "-"]])}
      `;
    }

    function fillOrderEditor(order, mode) {
      if (mode === "edit" && !adminCan("orders.edit")) mode = "view";
      state.selectedOrderId = order?.id || "";
      $("orderOverlayTitle").textContent = mode === "edit" ? "Editar pedido" : "Visualizar pedido";
      $("orderOverlaySubtitle").textContent = order ? `${orderReference(order)} • ${orderStatusLabel(order.status)}` : "Pedido não encontrado.";
      $("orderDetailBody").innerHTML = order ? orderDetailHtml(order) : "";
      $("orderEditFields").hidden = mode !== "edit";
      $("orderSaveButton").hidden = mode !== "edit" || !adminCan("orders.edit");

      const isArchived = isOrderEffectivelyArchived(order);
      const isCancelledOrRefunded = !order || ["cancelled", "refunded"].includes(order.status);
      const val = getOrderValidationSummary(order);
      const cancelBtn = $("orderCancelButton");
      const refundTicketsBtn = $("orderRefundTicketsButton");
      const refundConcessionsBtn = $("orderRefundConcessionsButton");

      if (isCancelledOrRefunded || isArchived || isOrderFullyValidated(order)) {
        cancelBtn.hidden = true;
        if (refundTicketsBtn) refundTicketsBtn.hidden = true;
        if (refundConcessionsBtn) refundConcessionsBtn.hidden = true;
      } else if (order.status === "paid") {
        if (val.hasTickets && val.hasConcessions) {
          if (!val.ticketsValidated && !val.concessionsDelivered) {
            cancelBtn.hidden = false;
            cancelBtn.textContent = "Cancelar pedido integral";
            if (refundTicketsBtn) {
              refundTicketsBtn.hidden = false;
              refundTicketsBtn.textContent = "Reembolsar apenas ingressos";
            }
            if (refundConcessionsBtn) {
              refundConcessionsBtn.hidden = false;
              refundConcessionsBtn.textContent = "Reembolsar apenas bomboniere";
            }
          } else if (val.ticketsValidated && !val.concessionsDelivered && val.concessionsPending) {
            cancelBtn.hidden = true;
            if (refundTicketsBtn) refundTicketsBtn.hidden = true;
            if (refundConcessionsBtn) {
              refundConcessionsBtn.hidden = false;
              refundConcessionsBtn.textContent = "Reembolsar bomboniere (ingressos já validados)";
            }
          } else if (val.concessionsDelivered && !val.ticketsValidated && val.ticketsPending) {
            cancelBtn.hidden = true;
            if (refundTicketsBtn) {
              refundTicketsBtn.hidden = false;
              refundTicketsBtn.textContent = "Reembolsar ingressos (bomboniere já entregue)";
            }
            if (refundConcessionsBtn) refundConcessionsBtn.hidden = true;
          } else {
            cancelBtn.hidden = true;
            if (refundTicketsBtn) refundTicketsBtn.hidden = true;
            if (refundConcessionsBtn) refundConcessionsBtn.hidden = true;
          }
        } else {
          cancelBtn.hidden = false;
          cancelBtn.textContent = "Cancelar pedido";
          if (refundTicketsBtn) refundTicketsBtn.hidden = true;
          if (refundConcessionsBtn) refundConcessionsBtn.hidden = true;
        }
      } else {
        cancelBtn.hidden = false;
        cancelBtn.textContent = "Cancelar pedido";
        if (refundTicketsBtn) refundTicketsBtn.hidden = true;
        if (refundConcessionsBtn) refundConcessionsBtn.hidden = true;
      }

      if (!adminCan("orders.cancel")) cancelBtn.hidden = true;
      if (!adminCan("orders.refund")) {
        if (refundTicketsBtn) refundTicketsBtn.hidden = true;
        if (refundConcessionsBtn) refundConcessionsBtn.hidden = true;
      }

      $("orderPermanentDeleteButton").hidden = !order || !adminCan("orders.delete");
      if (order) {
        $("orderCustomerName").value = order.customerName || "";
        $("orderCustomerPhone").value = String(order.customerPhone || "").replace(/\D/g, "").slice(0, 11);
        $("orderCustomerEmail").value = order.customerEmail || "";
        $("orderCustomerCpf").value = String(order.customerCpf || "").replace(/\D/g, "").slice(0, 11);
        $("orderOperationalNotes").value = order.operationalNotes || "";
      } else {
        ["orderCustomerName", "orderCustomerPhone", "orderCustomerEmail", "orderCustomerCpf", "orderOperationalNotes"].forEach((id) => { $(id).value = ""; });
      }
      $("orderOverlay").hidden = false;
    }

    return { renderOrders, renderTodaySalesSummary, orderTicketCount, renderOrdersTable, changeOrdersPage, statusClass, originLabel, paymentForOrder, movieForOrder, sectionHtml, orderDetailHtml, fillOrderEditor };
  }

  const api = Object.freeze({ createOrderManagementView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.orderManagementView = api; }
})(globalThis);
