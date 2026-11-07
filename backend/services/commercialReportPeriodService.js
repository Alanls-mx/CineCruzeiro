function createCommercialReportPeriodService({ todayIsoDate, isValidCalendarDate, datePartsInSaoPaulo }) {
  function parseAdminPeriod(url) {
    const period = url.searchParams.get("period") || "today";
    const today = todayIsoDate();
    const now = new Date(`${today}T12:00:00`);
    const iso = (date) => date.toISOString().slice(0, 10);
    let start = today;
    let end = today;
    if (period === "7d") {
      const date = new Date(now);
      date.setDate(date.getDate() - 6);
      start = iso(date);
    } else if (period === "30d") {
      const date = new Date(now);
      date.setDate(date.getDate() - 29);
      start = iso(date);
    } else if (period === "month") {
      start = `${today.slice(0, 7)}-01`;
    } else if (period === "custom") {
      start = url.searchParams.get("from") || today;
      end = url.searchParams.get("to") || today;
    }
    if (!isValidCalendarDate(start) || !isValidCalendarDate(end) || end < start) {
      const error = new Error("Informe um período válido: a data final deve ser igual ou posterior à inicial.");
      error.statusCode = 422;
      throw error;
    }
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    const days = Math.floor((endDate - startDate) / 86400000) + 1;
    if (days > 366) {
      const error = new Error("Selecione um período de até 366 dias por relatório.");
      error.statusCode = 422;
      throw error;
    }
    const previousEndDate = new Date(startDate);
    previousEndDate.setUTCDate(previousEndDate.getUTCDate() - 1);
    const previousStartDate = new Date(previousEndDate);
    previousStartDate.setUTCDate(previousStartDate.getUTCDate() - days + 1);
    return {
      period,
      start,
      end,
      days,
      previousStart: iso(previousStartDate),
      previousEnd: iso(previousEndDate)
    };
  }

  function inDateRange(value, start, end) {
    const raw = String(value || "").trim();
    let date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
    if (!date && raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        const parts = datePartsInSaoPaulo(parsed);
        date = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
      }
    }
    return date && date >= start && date <= end;
  }

  function compareMetric(current, previous) {
    if (!previous) return current ? 100 : 0;
    return Math.round(((Number(current || 0) - Number(previous || 0)) / Number(previous)) * 100);
  }
  return { parseAdminPeriod, inDateRange, compareMetric };
}

module.exports = { createCommercialReportPeriodService };
