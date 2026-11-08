"use strict";

function createMercadoPagoUnknownEventHandler({ withCriticalMutation, readDb, writeDb, logEvent, sendJson }) {
  return async function handleMercadoPagoUnknownEvent({ res, provider, eventId, providerPaymentId, orderId, requestId, action }) {
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const duplicate = lockedDb.webhookEvents.some((event) => event.provider === provider && event.eventId === eventId);
      if (!duplicate) {
        lockedDb.webhookEvents.push({
          provider,
          eventId,
          providerPaymentId,
          orderId,
          requestId,
          action,
          status: "ignored_unknown_event",
          verified: true,
          createdAt: new Date().toISOString()
        });
        await writeDb(lockedDb);
      }
      logEvent("info", "webhook.mercado_pago.ignored", { eventId, action, providerPaymentId, duplicate });
      sendJson(res, 200, {
        ok: true,
        accepted: true,
        processed: false,
        duplicate,
        processing: { recognized: false, orderLocated: false, stateUpdated: false }
      });
    });
  };
}

module.exports = { createMercadoPagoUnknownEventHandler };
