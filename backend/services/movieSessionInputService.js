function createMovieSessionInputService({ isValidCalendarDate, isValidSessionTime, crypto }) {
  function normalizeMovieSession(input, movieId, existing = {}, ticketTypes = []) {
    const preserveExistingDate = Boolean(existing.id && existing.date && input.dateChanged !== true);
    const date = String(preserveExistingDate ? existing.date : input.date ?? input.sessionDate ?? existing.date ?? "").trim();
    const time = String(input.time ?? existing.time ?? "").trim();
    const room = String(input.room ?? existing.room ?? "").trim();
    const roomChangedByInput = input.room !== undefined && room !== String(existing.room || "").trim();
    const roomId = String(input.roomId !== undefined ? input.roomId : roomChangedByInput ? "" : existing.roomId || "").trim();
    const format = String(input.format ?? existing.format ?? "").trim();
    const knownTicketTypes = (ticketTypes || []).filter((ticketType) => ticketType.active !== false);
    const requestedTicketTypeIds = Array.isArray(input.ticketTypeIds)
      ? input.ticketTypeIds.map(String)
      : Array.isArray(existing.ticketTypeIds) && existing.ticketTypeIds.length
        ? existing.ticketTypeIds.map(String)
        : knownTicketTypes.map((ticketType) => ticketType.id);
    const ticketTypeIds = requestedTicketTypeIds.filter((id, index, ids) => (
      knownTicketTypes.some((ticketType) => ticketType.id === id) && ids.indexOf(id) === index
    ));
    const selectedTicketTypes = ticketTypeIds.map((id) => knownTicketTypes.find((ticketType) => ticketType.id === id)).filter(Boolean);
    const priceFull = Number(selectedTicketTypes[0]?.price ?? input.priceFull ?? existing.priceFull ?? 0);
    const priceHalf = Number(selectedTicketTypes[1]?.price ?? selectedTicketTypes[0]?.price ?? input.priceHalf ?? input.priceFull ?? existing.priceHalf ?? existing.priceFull ?? 0);

    if (!isValidCalendarDate(date)) {
      const error = new Error("Informe uma data válida para a sessão.");
      error.statusCode = 422;
      throw error;
    }
    if (!isValidSessionTime(time)) {
      const error = new Error("Informe um horário válido para a sessão.");
      error.statusCode = 422;
      throw error;
    }
    if (!room || !format) {
      const error = new Error("Informe sala e formato da sessão.");
      error.statusCode = 422;
      throw error;
    }
    if (!ticketTypeIds.length) {
      const error = new Error("Selecione pelo menos um tipo de ingresso disponível nesta sessão.");
      error.statusCode = 422;
      throw error;
    }
    if (!Number.isFinite(priceFull) || priceFull < 0 || !Number.isFinite(priceHalf) || priceHalf < 0) {
      const error = new Error("Informe um preço válido para a sessão.");
      error.statusCode = 422;
      throw error;
    }

    return {
      id: String(existing.id || input.id || `${movieId}-sessao-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`),
      date,
      time,
      format,
      room,
      roomId,
      ticketTypeIds,
      priceFull,
      priceHalf,
      status: ["available", "filling_fast", "sold_out", "cancelled"].includes(input.status || existing.status)
        ? input.status || existing.status
        : "available"
    };
  }

  function sessionDatesInRange(dateFrom, dateTo, weekdays = []) {
    const start = new Date(`${String(dateFrom || "").slice(0, 10)}T12:00:00Z`);
    const end = new Date(`${String(dateTo || "").slice(0, 10)}T12:00:00Z`);
    if (!isValidCalendarDate(dateFrom) || !isValidCalendarDate(dateTo) || end < start) {
      const error = new Error("Informe um período válido para criar as sessões.");
      error.statusCode = 422;
      throw error;
    }
    const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    if (totalDays > 120) {
      const error = new Error("Crie sessões em períodos de no máximo 120 dias.");
      error.statusCode = 422;
      throw error;
    }
    const allowedWeekdays = new Set((weekdays || []).map(Number).filter((day) => day >= 0 && day <= 6));
    return Array.from({ length: totalDays }, (_, index) => {
      const date = new Date(start.getTime() + index * 86400000);
      return { date, isoDate: date.toISOString().slice(0, 10) };
    }).filter(({ date }) => !allowedWeekdays.size || allowedWeekdays.has(date.getUTCDay())).map(({ isoDate }) => isoDate);
  }

  function createMovieSessionBatch(input, movieId, existingSessions = [], ticketTypes = []) {
    if (input.weekdays !== undefined && (!Array.isArray(input.weekdays) || !input.weekdays.length || input.weekdays.some((day) => !Number.isInteger(Number(day)) || Number(day) < 0 || Number(day) > 6))) {
      throw Object.assign(new Error("Selecione pelo menos um dia da semana válido."), { statusCode: 422, code: "SESSION_WEEKDAYS_REQUIRED" });
    }
    const dateFrom = String(input.dateFrom || input.date || "").slice(0, 10);
    const dateTo = String(input.dateTo || input.dateEnd || dateFrom).slice(0, 10);
    const times = [...new Set((Array.isArray(input.times) ? input.times : [input.time])
      .map((time) => String(time || "").trim()))];
    if (!times.length || times.some((time) => !isValidSessionTime(time))) {
      const error = new Error("Informe pelo menos um horário válido.");
      error.statusCode = 422;
      throw error;
    }
    const dates = sessionDatesInRange(dateFrom, dateTo, input.weekdays);
    const created = [];
    const skipped = [];
    for (const date of dates) {
      for (const time of times) {
        const duplicate = [...existingSessions, ...created].some((session) =>
          session.date === date && session.time === time && session.room === input.room && session.format === input.format
        );
        if (duplicate) {
          skipped.push({ date, time, reason: "duplicate" });
          continue;
        }
        created.push(normalizeMovieSession({ ...input, date, time }, movieId, {}, ticketTypes));
      }
    }
    if (!created.length && !skipped.length) {
      const error = new Error("Nenhuma data corresponde aos dias da semana selecionados.");
      error.statusCode = 422;
      throw error;
    }
    return { created, skipped };
  }
  return { normalizeMovieSession, sessionDatesInRange, createMovieSessionBatch };
}

module.exports = { createMovieSessionInputService };
