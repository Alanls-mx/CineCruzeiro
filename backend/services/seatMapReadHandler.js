"use strict";

function createSeatMapReadHandler({
  adminHasPermission,
  buildAdminSessionSeatMap,
  findSessionWithMovie,
  listActiveSeatHolds,
  occupiedSeatIds,
  publicSessionSeatPresenter,
  roomForSession,
  roomSeatSelectionEnabled,
  sendJson,
  sessionSeatAvailability,
}) {
  return async function handleSeatMapRead({ req, res, pathname, method, db }) {
  const adminSessionSeatMapMatch = pathname.match(/^\/api\/admin\/sessions\/([^/]+)\/seat-map$/);
  if (adminSessionSeatMapMatch && method === "GET") {
    const sessionId = decodeURIComponent(adminSessionSeatMapMatch[1]);
    const found = findSessionWithMovie(db, sessionId);
    if (!found) {
      sendJson(res, 404, { error: { code: "SESSION_NOT_FOUND", message: "Sessão não encontrada." } });
      return true;
    }
    const room = roomForSession(db, found.session);
    const map = buildAdminSessionSeatMap({
      ...found,
      room,
      tickets: db.tickets || [],
      orders: db.orders || [],
      holds: roomSeatSelectionEnabled(room) ? await listActiveSeatHolds(sessionId) : [],
      occupiedSeatIds: occupiedSeatIds(db, sessionId),
      showPurchaser: adminHasPermission(req.adminUser, "tickets.view") && adminHasPermission(req.adminUser, "orders.view")
    });
    sendJson(res, 200, map, { "Cache-Control": "private, no-store" });
    return true;
  }

  const sessionSeatsMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/seats$/);
  if (sessionSeatsMatch && method === "GET") {
    const sessionId = decodeURIComponent(sessionSeatsMatch[1]);
    let session = null;
    let movie = null;
    for (const candidate of db.movies || []) {
      const found = (candidate.sessions || []).find((item) => item.id === sessionId);
      if (found) {
        session = found;
        movie = candidate;
        break;
      }
    }
    if (!session) {
      sendJson(res, 404, { error: { code: "SESSION_NOT_FOUND", message: "Sessão não encontrada." } });
      return true;
    }
    const room = roomForSession(db, session);
    const enabled = roomSeatSelectionEnabled(room);
    const { sold, reserved } = enabled ? sessionSeatAvailability(db, sessionId) : { sold: new Set(), reserved: new Set() };
    const ownerToken = String(new URL(req.url, `http://${req.headers.host}`).searchParams.get("ownerToken") || "").trim();
    const holds = enabled ? await listActiveSeatHolds(sessionId) : [];
    sendJson(res, 200, publicSessionSeatPresenter.present({ sessionId, session, movie, room, enabled, sold, reserved, holds, ownerToken }), { "Cache-Control": "no-store" });
    return true;
  }
    return false;
  };
}

module.exports = { createSeatMapReadHandler };
