function createTicketEmailDeliveryCoordinator({
  enrichTicket, googleWalletSaveUrl, ticketDownloadPdf, logEvent,
  emailService, appFrontendUrl, readDb, orderTickets,
  shouldDeliverBoxOfficeTicketsByEmail, structuredCloneSafe,
  deliverBoxOfficeTicketsBySelectedMethod, withCriticalMutation, writeDb,
  deferUntilPostgresCommit, postgresEnabled, getTicketEmailWorker,
  outsidePostgresTransaction, requestContext, mutationContext
}) {
  const pendingTicketEmailDeliveries = new Set();
async function deliverTicketsByEmail(db, order, tickets) {
  if (!tickets?.length || !order?.customerEmail) return false;
  const emailUser = (db.users || []).find((user) =>
    user.active !== false &&
    (user.id === order.customerUserId || String(user.email || "").toLowerCase() === String(order.customerEmail || "").toLowerCase())
  );
  const enrichedTickets = await Promise.all(tickets.map(async (ticket) => {
    const enriched = enrichTicket(db, ticket);
    try {
      enriched.googleWalletUrl = await googleWalletSaveUrl(db, ticket, emailUser || {
        id: order.customerUserId || "",
        name: order.customerName || enriched.customerName || "Cliente Cine Cruzeiro",
        email: order.customerEmail || enriched.customerEmail || ""
      }, null);
    } catch {
      enriched.googleWalletUrl = "";
    }
    return enriched;
  }));
  const attachments = [];
  for (const ticket of tickets) {
    try {
      attachments.push({
        filename: `cine-cruzeiro-${String(ticket.code || ticket.id || "ingresso").replace(/[^a-z0-9-]/gi, "-").toLowerCase()}.pdf`,
        content: await ticketDownloadPdf(db, ticket),
        contentType: "application/pdf"
      });
    } catch (error) {
      logEvent("warn", "ticket_email.pdf_failed", { orderId: order.id, ticketId: ticket.id, message: error.message });
    }
  }
  const delivered = await emailService.sendTicketDelivery(db, order, enrichedTickets, {
    attachments,
    accountUrl: `${appFrontendUrl()}/conta/ingressos`,
    logoUrl: `${appFrontendUrl()}/images/favicon-email.png`,
    siteUrl: appFrontendUrl()
  }).catch((error) => {
    logEvent("warn", "ticket_email.failed", { orderId: order.id, message: error.message });
    return false;
  });
  if (delivered) {
    order.emailDeliveredAt = new Date().toISOString();
  }
  return delivered;
}

async function processQueuedTicketEmailDelivery(orderId) {
  const startedAt = Date.now();
  const snapshotDb = await readDb();
  const order = (snapshotDb.orders || []).find((item) => item.id === orderId);
  const tickets = order ? orderTickets(snapshotDb, order.id) : [];
  if (!order || order.status !== "paid" || !tickets.length || !order.customerEmail) {
    logEvent("info", "ticket_email.background_skipped", {
      orderId,
      reason: !order ? "order_not_found" : order?.status !== "paid" ? "order_not_paid" : !tickets.length ? "tickets_not_found" : "customer_email_missing"
    });
    return { status: "cancelled", reason: !order ? "order_not_found" : order?.status !== "paid" ? "order_not_paid" : !tickets.length ? "tickets_not_found" : "customer_email_missing" };
  }
  if (order.emailDeliveredAt || order.ticketDelivery?.status === "delivered") {
    logEvent("info", "ticket_email.background_skipped", { orderId, reason: "already_delivered" });
    return { status: "delivered", reason: "already_delivered" };
  }
  if (["box_office", "concession_counter"].includes(String(order.origin || "")) && !shouldDeliverBoxOfficeTicketsByEmail(order)) {
    return { status: "cancelled", reason: "physical_delivery" };
  }

  const deliveryOrder = structuredCloneSafe(order);
  const boxOfficeDelivery = ["box_office", "concession_counter"].includes(String(order.origin || ""));
  const delivered = boxOfficeDelivery
    ? (await deliverBoxOfficeTicketsBySelectedMethod(snapshotDb, deliveryOrder, tickets)).status === "delivered"
    : await deliverTicketsByEmail(snapshotDb, deliveryOrder, tickets);

  if (deliveryOrder.emailDeliveredAt || deliveryOrder.ticketDelivery) {
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const persistedOrder = (lockedDb.orders || []).find((item) => item.id === orderId);
      if (!persistedOrder) return;
      if (deliveryOrder.emailDeliveredAt) persistedOrder.emailDeliveredAt = deliveryOrder.emailDeliveredAt;
      if (deliveryOrder.ticketDelivery) persistedOrder.ticketDelivery = deliveryOrder.ticketDelivery;
      persistedOrder.updatedAt = new Date().toISOString();
      await writeDb(lockedDb);
    });
  }

  logEvent(delivered ? "info" : "warn", "ticket_email.background_completed", {
    orderId,
    tickets: tickets.length,
    delivered,
    durationMs: Date.now() - startedAt
  });
  return { status: delivered ? "delivered" : "retry", reason: delivered ? "" : "delivery_failed" };
}

function queueTicketEmailDelivery(orderId) {
  const normalizedOrderId = String(orderId || "").trim();
  if (normalizedOrderId && deferUntilPostgresCommit(() => queueTicketEmailDelivery(normalizedOrderId))) return true;
  if (postgresEnabled()) {
    getTicketEmailWorker()?.wake();
    return Boolean(normalizedOrderId);
  }
  if (!normalizedOrderId || pendingTicketEmailDeliveries.has(normalizedOrderId)) return false;
  pendingTicketEmailDeliveries.add(normalizedOrderId);
  logEvent("info", "ticket_email.background_queued", { orderId: normalizedOrderId });
  setImmediate(() => {
    outsidePostgresTransaction(() => requestContext.run({}, () => {
      mutationContext.run({ active: false }, () => {
        void processQueuedTicketEmailDelivery(normalizedOrderId)
          .catch((error) => {
            logEvent("warn", "ticket_email.background_failed", {
              orderId: normalizedOrderId,
              message: error.message
            });
          })
          .finally(() => pendingTicketEmailDeliveries.delete(normalizedOrderId));
      });
    }));
  });
  return true;
}

  return { deliverTicketsByEmail, processQueuedTicketEmailDelivery, queueTicketEmailDelivery };
}

module.exports = { createTicketEmailDeliveryCoordinator };
