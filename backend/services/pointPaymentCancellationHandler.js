function createPointPaymentCancellationHandler({
  getAdminUser,
  sendJson,
  withCriticalMutation,
  readDb,
  writeDb,
  integrationConfigService,
  cardTerminalProvider,
  mercadoPagoReferenceMatches,
  applyPointPaymentStatus,
  logEvent,
}) {
  async function handlePointPaymentCancellation({ req, res, db, pathname, method }) {
    const pointPaymentCancelMatch = pathname.match(/^\/api\/box-office\/point-payments\/([^/]+)\/cancel$/);
    if (pointPaymentCancelMatch && method === "POST") {
      const adminUser = getAdminUser(req, db);
      if (!adminUser) {
        sendJson(res, 401, { error: { code: "ADMIN_AUTH_REQUIRED", message: "Entre no painel para cancelar a cobrança." } });
        return true;
      }
      const paymentId = decodeURIComponent(pointPaymentCancelMatch[1]);
      const outcome = await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const payment = (lockedDb.payments || []).find((item) => item.id === paymentId && item.metadata?.kind === "point_sale");
        if (!payment) return { status: 404, payload: { error: { code: "POINT_PAYMENT_NOT_FOUND", message: "Cobrança Point não encontrada." } } };
        if (payment.status === "approved" || payment.status === "refunded") {
          return { status: 409, payload: { error: { code: "POINT_ALREADY_APPROVED", message: "O pagamento já foi aprovado. Use o fluxo de estorno para desfazer a venda." } } };
        }
        const config = integrationConfigService.resolvedConfig(lockedDb, "mercadoPago") || {};
        if (!payment.providerPaymentId) {
          if (payment.metadata?.pointCreateState === "prepared"
            && !payment.metadata?.providerRequestSentAt
            && !(Date.parse(payment.metadata?.pointCreateLeaseUntil || "") > Date.now())) {
            const result = applyPointPaymentStatus(lockedDb, payment, { status: "cancelled", providerStatus: "not_sent" });
            payment.metadata.pointCreateState = "cancelled_before_send";
            await writeDb(lockedDb);
            return { status: 200, payload: { payment, orders: result.orders, tickets: [], cancellationPending: false }, confirmed: true, providerPaymentId: "" };
          }
          return { status: 409, payload: { error: { code: "POINT_RECONNECT_REQUIRED", message: "Reconecte a cobrança com o terminal antes de solicitar o cancelamento." } } };
        }
        const currentProviderPayment = await cardTerminalProvider.getStatus(payment.providerPaymentId, config);
        if (!mercadoPagoReferenceMatches(payment, currentProviderPayment.externalReference)
          || (currentProviderPayment.amount && Math.abs(Number(currentProviderPayment.amount) - Number(payment.amount)) > 0.01)) {
          return { status: 409, payload: { error: { code: "POINT_PAYMENT_MISMATCH", message: "A cobrança retornada pela Point não confere com a venda. Concilie antes de cancelar." } } };
        }
        if (currentProviderPayment.status === "approved" || currentProviderPayment.status === "refunded") {
          return { status: 409, payload: { error: { code: "POINT_ALREADY_APPROVED", message: "O pagamento foi aprovado antes do cancelamento. Consulte a venda e use o estorno se necessário." } } };
        }
        const terminalStates = ["cancelled", "expired", "rejected"];
        const wasPending = !terminalStates.includes(payment.status);
        const providerPayment = terminalStates.includes(currentProviderPayment.status)
          ? currentProviderPayment
          : await cardTerminalProvider.cancelPayment(payment.providerPaymentId, config, {
            idempotencyKey: `cancel-${payment.id}`,
            providerStatus: currentProviderPayment.providerStatus
          });
        if (!mercadoPagoReferenceMatches(payment, providerPayment.externalReference)
          || (providerPayment.amount && Math.abs(Number(providerPayment.amount) - Number(payment.amount)) > 0.01)) {
          return { status: 409, payload: { error: { code: "POINT_PAYMENT_MISMATCH", message: "A resposta de cancelamento não confere com a venda. Concilie antes de prosseguir." } } };
        }
        if (providerPayment.status === "approved" || providerPayment.status === "refunded") {
          return { status: 409, payload: { error: { code: "POINT_ALREADY_APPROVED", message: "A Point confirmou o pagamento durante o cancelamento. Consulte a venda antes de prosseguir." } } };
        }
        const result = applyPointPaymentStatus(lockedDb, payment, providerPayment);
        payment.metadata.cancellationRequestedAt ||= new Date().toISOString();
        payment.metadata.cancellationIdempotencyKey = `cancel-${payment.id}`;
        await writeDb(lockedDb);
        return {
          status: terminalStates.includes(payment.status) ? 200 : 202,
          payload: { payment, orders: result.orders, tickets: result.tickets, cancellationPending: !terminalStates.includes(payment.status) },
          confirmed: wasPending && terminalStates.includes(payment.status),
          providerPaymentId: payment.providerPaymentId
        };
      });
      if (outcome.confirmed) logEvent("info", "box_office_point_sale.cancelled", { paymentId, providerPaymentId: outcome.providerPaymentId, actorUserId: adminUser.id });
      sendJson(res, outcome.status, outcome.payload);
      return true;
    }

    return false;
  }

  return handlePointPaymentCancellation;
}

module.exports = { createPointPaymentCancellationHandler };
