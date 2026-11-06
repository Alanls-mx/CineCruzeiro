function createPointPaymentRecoveryHandler({
  getAdminUser,
  sendJson,
  integrationConfigService,
  attemptPointCreation,
  cardTerminalProvider,
  pointPaymentOrders,
  orderRequiresConfirmedPrint,
  mercadoPagoReferenceMatches,
  withCriticalMutation,
  readDb,
  writeDb,
  applyPointPaymentStatus,
  queueBoxOfficePointPrint,
  syncBoxOfficePointPrint,
  finalizePrintedOrders,
  shouldDeliverBoxOfficeTicketsByEmail,
  queueTicketEmailDelivery,
  logEvent,
}) {
  async function handlePointPaymentRecovery({ req, res, db, pathname, method }) {
    const pointPaymentMatch = pathname.match(/^\/api\/box-office\/point-payments\/([^/]+)$/);
    if (pointPaymentMatch && method === "GET") {
      const adminUser = getAdminUser(req, db);
      if (!adminUser) {
        sendJson(res, 401, { error: { code: "ADMIN_AUTH_REQUIRED", message: "Entre no painel para acompanhar a cobrança." } });
        return true;
      }
      const paymentId = decodeURIComponent(pointPaymentMatch[1]);
      const snapshotPayment = (db.payments || []).find((item) => item.id === paymentId && ["point_sale", "counter_sale"].includes(item.metadata?.kind));
      if (!snapshotPayment) {
        sendJson(res, 404, { error: { code: "POINT_PAYMENT_NOT_FOUND", message: "Cobrança Point não encontrada." } });
        return true;
      }
      const config = integrationConfigService.resolvedConfig(db, "mercadoPago") || {};
      let providerPayment;
      try {
        if (snapshotPayment.metadata?.kind === "counter_sale") {
          providerPayment = {
            id: snapshotPayment.providerPaymentId,
            externalReference: snapshotPayment.providerReference,
            status: snapshotPayment.status,
            providerStatus: snapshotPayment.status,
            amount: snapshotPayment.amount,
            terminalId: ""
          };
        } else if (snapshotPayment.providerPaymentId) {
          providerPayment = await cardTerminalProvider.getStatus(snapshotPayment.providerPaymentId, config);
        } else {
          const recovery = snapshotPayment.metadata?.recoveryRequest;
          if (!recovery?.idempotencyKey || !recovery?.externalReference) {
            throw Object.assign(new Error("A cobrança não possui dados suficientes para reconexão."), { code: "POINT_RECOVERY_DATA_MISSING" });
          }
          providerPayment = await attemptPointCreation(snapshotPayment.id, config);
          if (!providerPayment) {
            throw Object.assign(new Error("A tentativa anterior ainda está em andamento ou requer conciliação."), { code: "POINT_RECOVERY_PENDING" });
          }
        }
      } catch (error) {
        const orders = pointPaymentOrders(db, snapshotPayment);
        const orderIds = new Set(orders.map((order) => order.id));
        const tickets = (db.tickets || []).filter((ticket) => orderIds.has(ticket.orderId));
        sendJson(res, 200, {
          payment: {
            ...snapshotPayment,
            metadata: {
              ...(snapshotPayment.metadata || {}),
              connectionState: "reconnecting",
              connectionMessage: error.message,
              lastConnectionErrorAt: new Date().toISOString()
            }
          },
          orders,
          tickets,
          pointPrint: orders.find((order) => order.pointPrint)?.pointPrint || { status: "not_requested" },
          completed: snapshotPayment.status === "approved" && orders.every((order) => !orderRequiresConfirmedPrint(order) || order.status === "paid"),
          reconnecting: true,
          retryAfterMs: 5000,
          terminal: { id: snapshotPayment.metadata?.terminalId || "", providerStatus: snapshotPayment.metadata?.providerStatus || "" }
        });
        return true;
      }
      if ((snapshotPayment.metadata?.requestFingerprint && !providerPayment.externalReference)
        || !mercadoPagoReferenceMatches(snapshotPayment, providerPayment.externalReference)) {
        sendJson(res, 409, { error: { code: "POINT_REFERENCE_MISMATCH", message: "A referência retornada pela maquininha não confere com a venda." } });
        return true;
      }
      if (providerPayment.amount && Math.abs(Number(providerPayment.amount) - Number(snapshotPayment.amount)) > 0.01) {
        sendJson(res, 409, { error: { code: "POINT_AMOUNT_MISMATCH", message: "O valor retornado pela maquininha não confere com a venda." } });
        return true;
      }
      const synced = await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const payment = (lockedDb.payments || []).find((item) => item.id === paymentId && ["point_sale", "counter_sale"].includes(item.metadata?.kind));
        if (!payment) {
          return { status: 404, payload: { error: { code: "POINT_PAYMENT_NOT_FOUND", message: "Cobrança Point não encontrada." } } };
        }
        if (!payment.providerPaymentId && providerPayment.id) payment.providerPaymentId = providerPayment.id;
        payment.metadata = {
          ...(payment.metadata || {}),
          pointCreateState: payment.providerPaymentId ? "known" : payment.metadata?.pointCreateState,
          pointCreateLeaseUntil: payment.providerPaymentId ? "" : payment.metadata?.pointCreateLeaseUntil,
          reconnectRequired: false,
          reconnectAttempts: Number(payment.metadata?.reconnectAttempts || 0) + (snapshotPayment.providerPaymentId ? 0 : 1),
          reconnectedAt: snapshotPayment.providerPaymentId ? payment.metadata?.reconnectedAt || "" : new Date().toISOString()
        };
        let result = applyPointPaymentStatus(lockedDb, payment, providerPayment);
        const existingPointPrint = result.orders.find((order) => order.pointPrint)?.pointPrint;
        let pointPrint = result.reconciliationRequired
          ? { requested: false, status: "not_requested", message: "Cobrança e pedido divergentes. Conciliação administrativa necessária." }
          : payment.status === "approved" && ["local_required", "failed", "timed_out"].includes(String(existingPointPrint?.status || ""))
          ? existingPointPrint
          : payment.status === "approved"
          ? await queueBoxOfficePointPrint(lockedDb, result.orders, result.tickets, config, {
            batchId: payment.metadata?.batchId,
            paymentMethod: payment.method,
            adminUser,
            forceLocal: payment.metadata?.kind === "counter_sale"
          })
          : { requested: false, status: "not_requested", message: "" };
        if (!result.reconciliationRequired && payment.status === "approved" && ["queued", "on_terminal"].includes(String(pointPrint?.status || ""))) {
          pointPrint = await syncBoxOfficePointPrint(result.orders, config) || pointPrint;
        }
        if (!result.reconciliationRequired && payment.status === "approved" && pointPrint?.status === "printed") {
          result = finalizePrintedOrders(lockedDb, result.orders, payment);
        }
        await writeDb(lockedDb);
        return {
          status: 200,
          payload: {
            payment,
            orders: result.orders,
            tickets: result.tickets,
            pointPrint,
            reconciliationRequired: Boolean(result.reconciliationRequired),
            completed: !result.reconciliationRequired && payment.status === "approved" && result.orders.every((order) => !orderRequiresConfirmedPrint(order) || order.status === "paid"),
            terminal: { id: payment.metadata?.terminalId || "", providerStatus: payment.metadata?.providerStatus || "" }
          },
          emailOrderIds: result.newlyPaidOrders.filter((order) => shouldDeliverBoxOfficeTicketsByEmail(order)).map((order) => order.id)
        };
      });
      if (synced.status === 200) {
        logEvent(synced.payload.reconciliationRequired ? "warn" : "info", "box_office_point_sale.synced", {
          paymentId,
          providerPaymentId: synced.payload.payment.providerPaymentId,
          status: synced.payload.payment.status,
          tickets: synced.payload.tickets.length,
          reconciliationRequired: synced.payload.reconciliationRequired,
          actorUserId: adminUser.id
        });
      }
      sendJson(res, synced.status, synced.payload);
      for (const orderId of synced.emailOrderIds || []) queueTicketEmailDelivery(orderId);
      return true;
    }

    return false;
  }

  return handlePointPaymentRecovery;
}

module.exports = { createPointPaymentRecoveryHandler };
