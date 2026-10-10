function createVenueConfigurationHandler({
  movieDurationMinutes,
  normalizeRoom,
  normalizeTicketType,
  postgresEnabled,
  readBody,
  repositoryAudit,
  roomDisplayLabel,
  roomForSession,
  roomRepository,
  roomSeatIdsInActiveUse,
  roomSeats,
  sendJson,
  sessionRoomConflicts,
  sessionStartsAt,
  syncRoomSessionReferences,
  ticketTypeRepository,
  writeDb,
  getSeatRealtimeService
}) {
  return async function handleVenueConfigurationRoutes({ req, res, pathname, method, db }) {
    const seatRealtimeService = getSeatRealtimeService();
  if (pathname === "/api/rooms" && method === "POST") {
    const room = normalizeRoom(await readBody(req));
    db.rooms = db.rooms.filter((item) => item.id !== room.id);
    db.rooms.push(room);
    if (postgresEnabled()) {
      await roomRepository.create(room, {
        audit: repositoryAudit(req, "rooms", room.id, null, room)
      });
    } else {
      await writeDb(db);
    }
    sendJson(res, 201, room);
    return true;
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomMatch) {
    const id = decodeURIComponent(roomMatch[1]);
    const index = db.rooms.findIndex((room) => room.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Sala nao encontrada" });
      return true;
    }

    if (method === "PUT") {
      const existingRoom = postgresEnabled()
        ? await roomRepository.findById(id)
        : db.rooms[index];
      if (!existingRoom) {
        sendJson(res, 404, { error: "Sala nao encontrada" });
        return true;
      }
      db.rooms[index] = existingRoom;
      const linkedSessions = (db.movies || []).flatMap((movie) => (movie.sessions || [])
        .filter((session) => roomForSession(db, session)?.id === existingRoom.id)
        .map((session) => ({ movie, session })));
      const linkedSessionIds = linkedSessions.map(({ session }) => session.id);
      const room = normalizeRoom(await readBody(req), existingRoom);
      if (room.cleanupMinutes > Number(existingRoom.cleanupMinutes ?? 20)) {
        const scheduleDb = { ...db, rooms: db.rooms.map((item, position) => position === index ? room : item) };
        const conflicts = linkedSessions
          .filter(({ movie, session }) => (sessionStartsAt(session)?.getTime() || 0) + movieDurationMinutes(movie) * 60000 > Date.now())
          .flatMap(({ movie, session }) => sessionRoomConflicts(scheduleDb, movie, session, { ignoreSessionId: session.id }));
        if (conflicts.length) {
          sendJson(res, 409, { error: { code: "ROOM_CLEANUP_CONFLICT", message: "O intervalo de limpeza informado conflita com sessões futuras desta sala. Ajuste os horários antes de salvar.", conflicts } });
          return true;
        }
      }
      const nextSeatIds = new Set(roomSeats(room).map((seat) => String(seat.id)));
      const removedSeatIds = roomSeats(existingRoom).map((seat) => String(seat.id)).filter((seatId) => !nextSeatIds.has(seatId));
      const activeSeatIds = roomSeatIdsInActiveUse(db, existingRoom.id);
      const protectedSeats = removedSeatIds.filter((seatId) => activeSeatIds.has(seatId));
      if (protectedSeats.length) {
        const labels = new Map(roomSeats(existingRoom).map((seat) => [String(seat.id), seat.label || seat.id]));
        sendJson(res, 409, {
          error: {
            code: "ROOM_SEATS_IN_USE",
            message: `Não é possível excluir ${protectedSeats.length === 1 ? "a cadeira" : "as cadeiras"} ${protectedSeats.map((seatId) => labels.get(seatId)).join(", ")} porque há ingressos ou reservas ativos. Bloqueie a cadeira ou aguarde o encerramento da sessão.`
          }
        });
        return true;
      }
      db.rooms[index] = room;
      const synchronized = syncRoomSessionReferences(db, room, linkedSessions);
      if (postgresEnabled()) {
        await roomRepository.update(room, {
          roomLabel: roomDisplayLabel(room),
          sessionIds: linkedSessionIds,
          audit: repositoryAudit(req, "rooms", room.id, existingRoom, room)
        });
      } else {
        await writeDb(db);
      }
      linkedSessionIds.forEach((sessionId) => seatRealtimeService?.broadcastSessionRefresh(sessionId));
      sendJson(res, 200, { ...room, synchronized });
      return true;
    }

    if (method === "DELETE") {
      const linkedSessions = (db.movies || []).flatMap((movie) => (movie.sessions || []).filter((session) => roomForSession(db, session)?.id === id));
      if (linkedSessions.length) {
        sendJson(res, 409, {
          error: {
            code: "ROOM_HAS_SESSIONS",
            message: `Esta sala está vinculada a ${linkedSessions.length} sessão(ões). Remova ou altere essas sessões antes de excluir a sala.`
          }
        });
        return true;
      }
      const [removed] = db.rooms.splice(index, 1);
      if (postgresEnabled()) {
        await roomRepository.remove(id, {
          audit: repositoryAudit(req, "rooms", id, removed, null)
        });
      } else {
        await writeDb(db);
      }
      sendJson(res, 200, removed);
      return true;
    }
  }

  if (pathname === "/api/ticket-types" && method === "POST") {
    const ticket = normalizeTicketType(await readBody(req));
    db.ticketTypes = db.ticketTypes.filter((item) => item.id !== ticket.id);
    db.ticketTypes.push(ticket);
    if (postgresEnabled()) {
      await ticketTypeRepository.create(ticket, {
        audit: repositoryAudit(req, "ticket_type", ticket.id, null, ticket)
      });
    } else {
      await writeDb(db);
    }
    sendJson(res, 201, ticket);
    return true;
  }

  const ticketMatch = pathname.match(/^\/api\/ticket-types\/([^/]+)$/);
  if (ticketMatch) {
    const id = decodeURIComponent(ticketMatch[1]);
    const index = db.ticketTypes.findIndex((ticket) => ticket.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Tipo de ingresso nao encontrado" });
      return true;
    }

    if (method === "PUT") {
      const previousTicket = postgresEnabled()
        ? await ticketTypeRepository.findById(id)
        : db.ticketTypes[index];
      if (!previousTicket) {
        sendJson(res, 404, { error: "Tipo de ingresso nao encontrado" });
        return true;
      }
      db.ticketTypes[index] = previousTicket;
      const ticket = normalizeTicketType(await readBody(req), previousTicket);
      db.ticketTypes[index] = ticket;
      if (postgresEnabled()) {
        await ticketTypeRepository.update(ticket, {
          audit: repositoryAudit(req, "ticket_type", ticket.id, previousTicket, ticket)
        });
      } else {
        await writeDb(db);
      }
      sendJson(res, 200, ticket);
      return true;
    }

    if (method === "DELETE") {
      const [removed] = db.ticketTypes.splice(index, 1);
      if (postgresEnabled()) {
        await ticketTypeRepository.remove(id, {
          audit: repositoryAudit(req, "ticket_type", id, removed, null)
        });
      } else {
        await writeDb(db);
      }
      sendJson(res, 200, removed);
      return true;
    }
  }

    return false;
  };
}

module.exports = { createVenueConfigurationHandler };
