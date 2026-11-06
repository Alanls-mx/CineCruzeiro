function createPointPrintFailureResolutionHandler({
  readBody, pointPaymentOrders, sendJson, ensureAdminAction,
  withCriticalMutation, readDb, writeDb, integrationConfigService,
  cardTerminalProvider, releaseConcessionReservation, appendOrderAudit,
  logEvent, broadcastReleasedOrderSeats
}) {
  async function handlePointPrintFailureResolution({ req, res, db, pathname, method }) {
  const pointPaymentResolvePrintMatch = pathname.match(/^\/api\/box-office\/point-payments\/([^/]+)\/resolve-print-failure$/);
  if (pointPaymentResolvePrintMatch && method === "POST") {
    const body = await readBody(req);
    const paymentId = decodeURIComponent(pointPaymentResolvePrintMatch[1]);
    const snapshotPayment = (db.payments || []).find((item) => item.id === paymentId && ["point_sale", "counter_sale"].includes(item.metadata?.kind));
    if (snapshotPayment?.status === "refunded" && snapshotPayment.metadata?.printResolution?.status === "pending" &&
        pointPaymentOrders(db, snapshotPayment).every((order) => order.status === "refunded")) {
      sendJson(res, 200, { payment: snapshotPayment, orders: pointPaymentOrders(db, snapshotPayment), tickets: [], completed: false, resolved: true, resolution: "refunded" });
      return true;
    }
    if (!snapshotPayment || snapshotPayment.status !== "approved") {
      sendJson(res, 409, { error: { code: "PRINT_FAILURE_NOT_RESOLVABLE", message: "A venda não está disponível para cancelamento ou reembolso." } });
      return true;
    }
    const isPointSale = snapshotPayment.metadata?.kind === "point_sale";
    if (!ensureAdminAction(req, res, isPointSale ? "orders.refund" : "orders.cancel", "Sua conta não tem permissão para desfazer esta venda.")) return true;
    const snapshotOrders = pointPaymentOrders(db, snapshotPayment);
    const printFailed = snapshotOrders.some((order) => ["failed", "timed_out"].includes(String(order.pointPrint?.status || "")));
    if (!snapshotOrders.length || snapshotOrders.some((order) => order.status !== "paid_pending_print") || !printFailed) {
      sendJson(res, 409, { error: { code: "PRINT_FAILURE_NOT_CONFIRMED", message: "O desfazimento só é permitido depois de uma falha de impressão confirmada, antes da emissão do ingresso." } });
      return true;
    }
    if (isPointSale) {
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const payment = (lockedDb.payments || []).find((item) => item.id === paymentId);
        if (!payment || pointPaymentOrders(lockedDb, payment).some((order) => order.status !== "paid_pending_print")) {
          throw Object.assign(new Error("A venda mudou de estado. Consulte-a novamente antes de reembolsar."), { statusCode: 409, code: "PRINT_RESOLUTION_CONFLICT" });
        }
        payment.metadata = {
          ...(payment.metadata || {}),
          printResolution: {
            status: "pending",
            idempotencyKey: `print-failure-refund-${paymentId}`,
            requestedAt: payment.metadata?.printResolution?.requestedAt || new Date().toISOString()
          }
        };
        await writeDb(lockedDb);
      });
      const config = integrationConfigService.resolvedConfig(db, "mercadoPago") || {};
      const refund = await cardTerminalProvider.refundPayment(snapshotPayment.providerPaymentId, config, {
        idempotencyKey: `print-failure-refund-${paymentId}`
      });
      if (refund.status !== "refunded") {
        throw Object.assign(new Error("O Mercado Pago ainda não confirmou o reembolso. O ingresso continua bloqueado; consulte a mesma operação novamente."), { statusCode: 409, code: "PRINT_REFUND_NOT_CONFIRMED" });
      }
    }
    let resolvedOrders = [];
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const payment = (lockedDb.payments || []).find((item) => item.id === paymentId);
      if (!payment) throw Object.assign(new Error("Pagamento não encontrado."), { statusCode: 404, code: "POINT_PAYMENT_NOT_FOUND" });
      const orders = pointPaymentOrders(lockedDb, payment);
      if (orders.some((order) => order.status !== "paid_pending_print" && !(isPointSale && payment.status === "refunded" && order.status === "refunded"))) {
        throw Object.assign(new Error("A venda mudou de estado. Concilie a devolução com o Mercado Pago."), { statusCode: 409, code: "PRINT_RESOLUTION_CONFLICT" });
      }
      const now = new Date().toISOString();
      const finalStatus = isPointSale ? "refunded" : "cancelled";
      payment.status = finalStatus;
      payment.updatedAt = now;
      if (isPointSale) {
        payment.refundStatus = "completed";
        payment.refundedAt = now;
        payment.metadata.printResolution = { ...(payment.metadata.printResolution || {}), status: "completed", completedAt: now };
      } else {
        payment.cancelledAt = now;
      }
      orders.forEach((order) => {
        releaseConcessionReservation(lockedDb, order);
        delete order.pendingPrintTickets;
        order.status = finalStatus;
        order.paymentStatus = finalStatus;
        order.updatedAt = now;
        order.archived = true;
        order.archivedAt = now;
        order.archivedBy = req.adminUser?.id || "system";
        order.archivedReason = isPointSale ? "Pagamento reembolsado após falha de impressão" : "Pedido cancelado após falha de impressão";
        order.printFulfillment = { ...(order.printFulfillment || {}), status: finalStatus, resolvedAt: now, resolvedBy: req.adminUser?.id || "" };
        order.pointPrint = { ...(order.pointPrint || {}), status: finalStatus, resolvedAt: now };
        appendOrderAudit(order, { action: isPointSale ? "refund_after_print_failure" : "cancel_after_print_failure", reason: String(body.reason || "Falha na impressão do ingresso").slice(0, 240), updatedBy: req.adminUser?.id || "", createdAt: now });
      });
      resolvedOrders = orders;
      await writeDb(lockedDb);
      logEvent("warn", isPointSale ? "box_office_ticket_print.refunded" : "box_office_ticket_print.cancelled", { paymentId, orderIds: orders.map((order) => order.id), createdBy: req.adminUser?.id || "" });
      sendJson(res, 200, { payment, orders, tickets: [], completed: false, resolved: true, resolution: finalStatus });
    });
    for (const order of resolvedOrders) await broadcastReleasedOrderSeats(order);
    return true;
  }

    return false;
  }

  return handlePointPrintFailureResolution;
}

module.exports = { createPointPrintFailureResolutionHandler };
