const crypto = require("node:crypto");
const {
  checkoutRequestFingerprint, providerAccountFingerprint, appendIntentHistory,
  pendingCheckoutPayment, intentOf, sameCheckoutIntent
} = require("./onlineCheckoutIntentService");
const { createOnlinePaymentReconciliationService } = require("./onlinePaymentReconciliationService");

function createOnlineCheckoutCoordinator(deps) {
  const {
    withCriticalMutation, readDb, writeDb, expireStaleReservations, getCustomerUser,
    sendJson, normalizePaymentOrder, checkoutIdentifier, findExistingCheckout,
    checkoutAccessAllowed, checkoutResponse, checkoutAccessCookie, repriceOrderFromCatalog,
    applyClubPlanBenefits, reserveClubCreditsForOrder, assertClientPricingMatches,
    materializeOrderAccounting, claimSeatHoldsForOrder, finalizeOrderWithoutCharge,
    activeOnlinePaymentProvider, createActiveOnlinePayment, mercadoPagoDeviceId,
    frontendUrlForRequest, cpfDigits, createPaymentRecord, reserveConcessionStock,
    finalizePaidOrder, consumePendingClubCredit, releaseOrderSeatHolds,
    broadcastSessionRefresh, queueTicketEmailDelivery, logEvent,
    paymentStatusAfterWebhook, paymentService, pagBankPaymentService
  } = deps;

  function accountFingerprint(active) {
    const accessToken = active.provider === "pag_bank"
      ? pagBankPaymentService.token(active.config)
      : paymentService.getMercadoPagoAccessToken(active.config);
    return providerAccountFingerprint(active.provider, active.config, accessToken);
  }

  async function prepare(req, res, body, method) {
    return withCriticalMutation(async () => {
      const db = await readDb();
      expireStaleReservations(db);
      const user = getCustomerUser(req, db);
      if (!user) {
        sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: method === "pix" ? "Entre na sua conta para gerar o pagamento por Pix." : "Entre na sua conta para pagar com cartão." } });
        return null;
      }
      if (String(user.name || "").trim().split(/\s+/).length < 2) {
        sendJson(res, 422, { error: { code: "CUSTOMER_LAST_NAME_REQUIRED", message: "Complete nome e sobrenome em Minha Conta antes de pagar." } });
        return null;
      }
      const rawOrder = body.order || body;
      const normalized = normalizePaymentOrder(rawOrder);
      normalized.idempotencyKey = checkoutIdentifier(body.idempotencyKey || req.headers["x-idempotency-key"] || normalized.idempotencyKey || normalized.id);
      normalized.customerUserId = user.id;
      normalized.customerEmail = user.email || "";
      normalized.customerCpf = user.cpf || "";
      normalized.customerName = user.name || "";
      normalized.customerRegisteredAt = user.createdAt || "";
      const fingerprint = checkoutRequestFingerprint(normalized, method);
      const existing = findExistingCheckout(db, normalized, method);
      if (existing) {
        if (!checkoutAccessAllowed(req, db, existing.order)) {
          sendJson(res, 409, { error: { code: "IDEMPOTENCY_KEY_CONFLICT", message: "Esta referência de compra já está em uso." } });
          return null;
        }
        const intent = intentOf(existing.payment);
        if (!existing.payment && existing.order.status !== "paid") {
          sendJson(res, 409, { error: { code: "IDEMPOTENCY_KEY_CONFLICT", message: "Esta referência pertence a outro pagamento." } });
          return null;
        }
        if (intent && !sameCheckoutIntent(existing.payment, fingerprint, method, existing.payment.provider)) {
          sendJson(res, 409, { error: { code: "IDEMPOTENCY_KEY_CONFLICT", message: "Esta referência pertence a uma composição diferente da compra." } });
          return null;
        }
        return { kind: intent && !existing.payment.providerPaymentId ? "intent" : "existing", orderId: existing.order.id, paymentId: existing.payment?.id || "" };
      }
      const order = repriceOrderFromCatalog(db, normalized);
      order.reservationExpiresAt = new Date(Date.now() + (method === "pix" ? paymentService.mercadoPagoPixExpirationMs() : 15 * 60 * 1000)).toISOString();
      applyClubPlanBenefits(db, order, user);
      if (normalized.useClubCredits) reserveClubCreditsForOrder(db, order, user, normalized.idempotencyKey);
      assertClientPricingMatches(rawOrder, order);
      materializeOrderAccounting(db, order);
      await claimSeatHoldsForOrder(db, order);
      if (order.totalPrice <= 0) {
        if (!order.couponId) {
          sendJson(res, 409, { error: { code: "PAYMENT_AMOUNT_INVALID", message: method === "pix" ? "O valor desta compra ficou zerado. Revise os benefícios selecionados antes de gerar o Pix." : "O valor desta compra ficou zerado. Revise os benefícios selecionados antes de pagar." } });
          return null;
        }
        const completed = await finalizeOrderWithoutCharge(db, order, user);
        await writeDb(db);
        return { kind: "created", orderId: completed.order.id, tickets: completed.tickets };
      }
      const active = activeOnlinePaymentProvider(db);
      if (!(active.config?.enabled && active.config?.configured) && process.env.PAYMENTS_MODE !== "test") {
        sendJson(res, 412, { error: { code: "PAYMENT_PROVIDER_NOT_CONFIGURED", message: `${active.name} está indisponível. Configure e habilite a integração no painel administrativo.` } });
        return null;
      }
      if (method === "credit_card") {
        const cardCredential = active.provider === "pag_bank"
          ? body.encryptedCard || body.card?.encrypted
          : body.cardToken || body.token || body.card?.token || body.payment?.token;
        if (!String(cardCredential || "").trim()) {
          sendJson(res, 422, { error: { code: active.provider === "pag_bank" ? "PAGBANK_ENCRYPTED_CARD_REQUIRED" : "CARD_TOKEN_REQUIRED", message: "Informe o cartão tokenizado pelo provedor antes de pagar." } });
          return null;
        }
      }
      const payment = pendingCheckoutPayment(order, active.provider, method, fingerprint, accountFingerprint(active), normalized.idempotencyKey);
      const savedOrder = {
        ...order, paymentMethod: method === "pix" ? "PIX" : "CREDIT_CARD",
        paymentProvider: payment.provider, paymentId: "", paymentStatus: "processing", status: "pending_payment"
      };
      reserveConcessionStock(db, savedOrder);
      db.orders.unshift(savedOrder);
      db.payments.unshift(payment);
      await writeDb(db);
      return { kind: "intent", orderId: savedOrder.id, paymentId: payment.id, releaseHolds: true };
    });
  }

  async function claim(paymentId) {
    return withCriticalMutation(async () => {
      const db = await readDb();
      const payment = (db.payments || []).find((item) => item.id === paymentId);
      const order = payment && (db.orders || []).find((item) => item.id === payment.orderId);
      const intent = intentOf(payment);
      if (!order || !intent || payment.providerPaymentId || order.status !== "pending_payment") return null;
      if (intent.state === "sending" && Date.parse(intent.leaseUntil || "") <= Date.now()) {
        appendIntentHistory(intent, "unknown", "lease_expired");
        await writeDb(db);
        return null;
      }
      if (intent.state !== "prepared") return null;
      const active = activeOnlinePaymentProvider(db);
      if (active.provider !== payment.provider || accountFingerprint(active) !== intent.providerAccountFingerprint) {
        appendIntentHistory(intent, "review_required", "provider_account_changed");
        await writeDb(db);
        return null;
      }
      intent.claim = crypto.randomUUID();
      intent.leaseUntil = new Date(Date.now() + 90_000).toISOString();
      intent.requestSentAt = new Date().toISOString();
      intent.attempts = Number(intent.attempts || 0) + 1;
      appendIntentHistory(intent, "sending");
      payment.updatedAt = intent.updatedAt;
      await writeDb(db);
      return { order, active, paymentId, claim: intent.claim, idempotencyKey: intent.idempotencyKey };
    });
  }

  async function markUnknown(paymentId, claimId, code) {
    await withCriticalMutation(async () => {
      const db = await readDb();
      const payment = (db.payments || []).find((item) => item.id === paymentId);
      const intent = intentOf(payment);
      if (!intent || intent.claim !== claimId || payment.providerPaymentId) return;
      appendIntentHistory(intent, "unknown", String(code || "PROVIDER_RESULT_UNKNOWN").slice(0, 80));
      payment.updatedAt = intent.updatedAt;
      await writeDb(db);
    });
  }

  async function recordResult(paymentId, claimId, providerPayment) {
    return withCriticalMutation(async () => {
      const db = await readDb();
      const payment = (db.payments || []).find((item) => item.id === paymentId);
      const order = payment && (db.orders || []).find((item) => item.id === payment.orderId);
      const intent = intentOf(payment);
      if (!order || !intent || intent.claim !== claimId) return null;
      if (!providerPayment?.id || providerPayment.provider !== payment.provider
        || providerPayment.externalReference !== String(order.id).slice(0, 64)
        || Math.round(Number(providerPayment.amount) * 100) !== Math.round(Number(payment.amount) * 100)) {
        appendIntentHistory(intent, "review_required", "provider_response_mismatch");
        await writeDb(db);
        return null;
      }
      if (payment.providerPaymentId && String(payment.providerPaymentId).toLowerCase() !== String(providerPayment.id).toLowerCase()) {
        appendIntentHistory(intent, "review_required", "provider_id_conflict");
        await writeDb(db);
        return null;
      }
      const received = createPaymentRecord(order, providerPayment, payment.method);
      payment.providerPaymentId = received.providerPaymentId;
      payment.providerReference = received.providerReference;
      payment.metadata = { ...payment.metadata, ...received.metadata, onlineIntent: intent };
      payment.qrCode = order.status === "pending_payment" ? received.qrCode : "";
      payment.qrCodeBase64 = order.status === "pending_payment" ? received.qrCodeBase64 : "";
      payment.ticketUrl = order.status === "pending_payment" ? received.ticketUrl : "";
      payment.checkoutUrl = order.status === "pending_payment" ? received.checkoutUrl : "";
      payment.expiresAt = received.expiresAt;
      payment.updatedAt = new Date().toISOString();
      appendIntentHistory(intent, "result_known");
      await writeDb(db);
      return true;
    });
  }

  async function finalize(paymentId, providerPayment) {
    return withCriticalMutation(async () => {
      const db = await readDb();
      const payment = (db.payments || []).find((item) => item.id === paymentId);
      const order = payment && (db.orders || []).find((item) => item.id === payment.orderId);
      if (!order || !payment?.providerPaymentId) return null;
      const intent = intentOf(payment);
      const received = createPaymentRecord(order, providerPayment, payment.method);
      payment.status = payment.status === "processing"
        ? received.status : paymentStatusAfterWebhook(payment.status, received.status);
      payment.updatedAt = new Date().toISOString();
      if (payment.status === "approved") payment.approvedAt ||= payment.updatedAt;
      if (intent) appendIntentHistory(intent, "completed");
      let tickets = (db.tickets || []).filter((ticket) => ticket.orderId === order.id);
      if (payment.status === "approved" && order.status === "pending_payment") {
        tickets = finalizePaidOrder(db, order, payment, "online");
        if (tickets.length) consumePendingClubCredit(db, order, tickets, order.customerUserId);
      } else if (payment.status === "approved" && order.status !== "paid") {
        payment.metadata.reconciliationRequired = true;
        payment.metadata.reconciliationReason = "online_order_closed_before_provider_result";
      }
      order.paymentId = payment.providerPaymentId;
      order.paymentStatus = payment.status;
      if (payment.status === "approved" && order.status === "paid") order.reservationExpiresAt = "";
      else if (payment.expiresAt && order.status === "pending_payment") order.reservationExpiresAt = payment.expiresAt;
      const closedBeforeResponse = !["pending_payment", "paid"].includes(order.status);
      if (closedBeforeResponse) {
        payment.qrCode = "";
        payment.qrCodeBase64 = "";
        payment.ticketUrl = "";
        payment.checkoutUrl = "";
      }
      await writeDb(db);
      return { order, payment, tickets, closedBeforeResponse,
        response: checkoutResponse(db, order, payment, tickets) };
    });
  }

  async function handle(req, res, body, method) {
    const prepared = await prepare(req, res, body, method);
    if (!prepared) return;
    const fresh = await readDb();
    const initialOrder = fresh.orders.find((item) => item.id === prepared.orderId);
    if (prepared.releaseHolds || prepared.kind === "created") {
      try {
        await releaseOrderSeatHolds(initialOrder, initialOrder.status === "pending_payment" ? "held" : "unavailable");
        broadcastSessionRefresh(initialOrder.sessionId);
      } catch (error) {
        logEvent("warn", "seat_realtime.release_hold_error", { orderId: initialOrder.id, message: error.message });
      }
    }
    if (prepared.kind === "created" || prepared.kind === "existing") {
      const payment = fresh.payments.find((item) => item.orderId === initialOrder.id && item.method === method) || null;
      const tickets = fresh.tickets.filter((ticket) => ticket.orderId === initialOrder.id);
      if (prepared.kind === "created" && tickets.length) queueTicketEmailDelivery(initialOrder.id);
      sendJson(res, prepared.kind === "created" ? 201 : 200, checkoutResponse(fresh, initialOrder, payment, tickets), {
        "Set-Cookie": checkoutAccessCookie(req, initialOrder.id)
      });
      return;
    }
    const claimed = await claim(prepared.paymentId);
    if (!claimed) {
      const snapshot = await readDb();
      const order = snapshot.orders.find((item) => item.id === prepared.orderId);
      const payment = snapshot.payments.find((item) => item.id === prepared.paymentId);
      sendJson(res, 202, checkoutResponse(snapshot, order, payment, []), { "Set-Cookie": checkoutAccessCookie(req, order.id) });
      return;
    }
    let providerPayment;
    try {
      providerPayment = await createActiveOnlinePayment(claimed.order, claimed.active, {
        method,
        deviceId: mercadoPagoDeviceId(req),
        card: method === "credit_card" ? {
          token: body.cardToken || body.token || body.card?.token || body.payment?.token,
          encrypted: body.encryptedCard || body.card?.encrypted,
          holderName: body.cardHolderName || body.card?.holderName,
          holderTaxId: cpfDigits(body.cardHolderTaxId || body.card?.holderTaxId),
          paymentMethodId: body.paymentMethodId || body.payment_method_id || body.card?.paymentMethodId || body.card?.payment_method_id,
          paymentTypeId: body.paymentTypeId || body.payment_type_id || body.card?.paymentTypeId || body.card?.payment_type_id || "credit_card",
          installments: body.installments || body.card?.installments || 1
        } : undefined,
        idempotencyKey: claimed.idempotencyKey,
        statementDescriptor: String(fresh.settings?.cinemaName || fresh.settings?.name || "Cinema")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
          .replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 22),
        notificationUrl: `${frontendUrlForRequest(req, fresh).replace(/\/$/, "")}/api/webhooks/pag-bank`
      });
    } catch (error) {
      await markUnknown(claimed.paymentId, claimed.claim, error.code || "PROVIDER_RESULT_UNKNOWN");
      throw Object.assign(new Error("O resultado do pagamento está em verificação. Não inicie outra compra; consulte o pedido original."), {
        code: "PAYMENT_OUTCOME_UNKNOWN", statusCode: 503
      });
    }
    if (!await recordResult(claimed.paymentId, claimed.claim, providerPayment)) {
      throw Object.assign(new Error("A resposta do provedor diverge da intenção registrada. Conciliação necessária."), {
        code: "PAYMENT_RECONCILIATION_REQUIRED", statusCode: 502
      });
    }
    const result = await finalize(claimed.paymentId, providerPayment);
    if (!result) throw Object.assign(new Error("A cobrança foi registrada, mas a conclusão local precisa de conciliação."), { code: "PAYMENT_RECONCILIATION_REQUIRED", statusCode: 503 });
    if (result.closedBeforeResponse) {
      logEvent("warn", "payment.order_closed_during_checkout", {
        orderId: result.order.id, paymentId: result.payment.id, status: result.payment.status
      });
      sendJson(res, 409, { error: { code: "PAYMENT_ORDER_CLOSED",
        message: "A compra foi encerrada durante a confirmação. Consulte o pedido antes de iniciar outra tentativa." },
        ...result.response }, { "Set-Cookie": checkoutAccessCookie(req, result.order.id) });
      return;
    }
    if (result.tickets.length && result.order.status === "paid") queueTicketEmailDelivery(result.order.id);
    logEvent("info", "payment.created", {
      orderId: result.order.id, paymentId: result.payment.id, method: result.payment.method,
      provider: result.payment.provider, status: result.payment.status,
      couponCode: result.order.couponCode || "", couponDiscount: result.order.couponDiscount || 0
    });
    sendJson(res, 201, result.response, { "Set-Cookie": checkoutAccessCookie(req, result.order.id) });
  }

  const recovery = createOnlinePaymentReconciliationService({ withCriticalMutation, readDb, writeDb,
    activeOnlinePaymentProvider, paymentService, pagBankPaymentService,
    createPaymentRecord, finalize, logEvent });
  return { handle, reconcile: recovery.reconcile, scan: recovery.scan };
}

module.exports = { createOnlineCheckoutCoordinator };
