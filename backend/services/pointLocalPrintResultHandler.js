function createPointLocalPrintResultHandler({
  readBody, withCriticalMutation, readDb, writeDb, sendJson,
  pointPaymentOrders, orderTickets, finalizePrintedOrders, logEvent
}) {
  return async function handlePointLocalPrintResult({ req, res, pathname, method }) {
    const match = pathname.match(/^\/api\/box-office\/point-payments\/([^/]+)\/print-result$/);
    if (!match || method !== "POST") return false;

    const body = await readBody(req);
    const paymentId = decodeURIComponent(match[1]);
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const payment = (lockedDb.payments || []).find((item) => item.id === paymentId && ["point_sale", "counter_sale"].includes(item.metadata?.kind));
      if (!payment || payment.status !== "approved") {
        sendJson(res, 409, { error: { code: "PRINT_CONFIRMATION_INVALID", message: "A venda não está disponível para confirmação de impressão." } });
        return;
      }
      const orders = pointPaymentOrders(lockedDb, payment);
      if (payment.metadata?.printResolution?.status === "pending" ||
          !orders.length || orders.some((order) => !["paid_pending_print", "paid"].includes(order.status)) ||
          orders.some((order) => order.status === "paid_pending_print" && order.pointPrint?.mode !== "local")) {
        sendJson(res, 409, { error: { code: "PRINT_CONFIRMATION_CONFLICT", message: "Esta venda não está aguardando confirmação da impressora local." } });
        return;
      }
      if (orders.every((order) => order.status === "paid")) {
        sendJson(res, 200, { payment, orders, tickets: orders.flatMap((order) => orderTickets(lockedDb, order.id)), pointPrint: orders[0]?.pointPrint || { status: "printed" }, completed: true });
        return;
      }
      if (!body.jobId || orders.some((order) => order.pointPrint?.jobId !== String(body.jobId))) {
        sendJson(res, 409, { error: { code: "PRINT_JOB_STALE", message: "Esta tentativa de impressão não está mais ativa. Consulte a venda antes de prosseguir." } });
        return;
      }
      const now = new Date().toISOString();
      if (body.ok === true) {
        orders.forEach((order) => {
          order.pointPrint = {
            ...(order.pointPrint || {}),
            status: "printed",
            mode: "local",
            printedAt: now,
            message: "A impressora térmica deste computador confirmou a impressão."
          };
        });
        const finalized = finalizePrintedOrders(lockedDb, orders, payment);
        await writeDb(lockedDb);
        logEvent("info", "box_office_ticket_print.local_confirmed", { paymentId, orderIds: orders.map((order) => order.id), ticketCount: finalized.tickets.length, createdBy: req.adminUser?.id || "" });
        sendJson(res, 200, { payment, ...finalized, pointPrint: orders[0]?.pointPrint || { status: "printed" }, completed: true });
        return;
      }
      const failedPrint = {
        ...(orders.find((order) => order.pointPrint)?.pointPrint || {}),
        status: "failed",
        mode: "local",
        failedAt: now,
        code: "LOCAL_PRINT_FAILED",
        message: String(body.message || "A impressora térmica não confirmou a impressão.").slice(0, 300)
      };
      orders.forEach((order) => {
        order.pointPrint = { ...failedPrint };
        order.printFulfillment = { ...(order.printFulfillment || {}), status: "failed", failedAt: now, message: failedPrint.message };
      });
      await writeDb(lockedDb);
      logEvent("warn", "box_office_ticket_print.local_failed", { paymentId, orderIds: orders.map((order) => order.id), message: failedPrint.message, createdBy: req.adminUser?.id || "" });
      sendJson(res, 200, { payment, orders, tickets: [], pointPrint: failedPrint, completed: false, printFailed: true });
    });
    return true;
  };
}

module.exports = { createPointLocalPrintResultHandler };
