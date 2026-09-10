const SCHEDULE_WORD = /\b(?:agendar|agende|agendado|programar|programe|enviar|envio|envie|disparar|disparo|dispare|mandar|mande)\b/gi;

function validLocalDate(year, month, day, hour, minute) {
  const utc = new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0));
  if (!Number.isFinite(utc.getTime())) return null;
  const local = new Date(utc.getTime() - (3 * 60 * 60 * 1000));
  if (local.getUTCFullYear() !== year || local.getUTCMonth() + 1 !== month || local.getUTCDate() !== day || local.getUTCHours() !== hour || local.getUTCMinutes() !== minute) return null;
  return utc;
}

function scheduleKeywords(text) {
  return [...String(text || "").matchAll(SCHEDULE_WORD)].map((match) => match.index || 0);
}

function nearestDistance(index, positions) {
  return positions.reduce((minimum, position) => Math.min(minimum, Math.abs(position - index)), Number.POSITIVE_INFINITY);
}

function parseTimeAround(text, index, length) {
  const nearby = text.slice(Math.max(0, index - 45), Math.min(text.length, index + length + 55));
  const match = nearby.match(/(?:às?|pelas?|hor[aá]rio\s*)\s*(\d{1,2})(?::|h)(\d{2})?|\b(\d{1,2}):(\d{2})\b/i);
  const hour = Number(match?.[1] ?? match?.[3] ?? 9);
  const minute = Number(match?.[2] ?? match?.[4] ?? 0);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
}

function extractRequestedSchedule(brief, options = {}) {
  const text = String(brief || "");
  const keywords = scheduleKeywords(text);
  if (!keywords.length) return { scheduleAt: "", matched: false, reason: "no_schedule_instruction" };
  const now = new Date(options.now || Date.now());
  const dates = [...text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)]
    .map((match) => ({ match, distance: nearestDistance(match.index || 0, keywords) }))
    .filter(({ match, distance }) => {
      if (distance > 100) return false;
      const context = text.slice(Math.max(0, (match.index || 0) - 28), match.index || 0).toLowerCase();
      return !/(?:v[aá]lid[oa]|validade|expira|estreia)\s*(?:at[eé]|em|no dia)?\s*$/.test(context);
    })
    .sort((left, right) => left.distance - right.distance);
  const selected = dates[0]?.match;
  if (!selected) return { scheduleAt: "", matched: false, reason: "schedule_date_missing" };

  let year = Number(selected[3] || now.getFullYear());
  if (year < 100) year += 2000;
  const month = Number(selected[2]);
  const day = Number(selected[1]);
  const time = parseTimeAround(text, selected.index || 0, selected[0].length);
  if (!time) return { scheduleAt: "", matched: false, reason: "schedule_time_invalid" };
  let scheduled = validLocalDate(year, month, day, time.hour, time.minute);
  if (!selected[3] && scheduled && scheduled.getTime() <= now.getTime()) {
    scheduled = validLocalDate(year + 1, month, day, time.hour, time.minute);
  }
  if (!scheduled) return { scheduleAt: "", matched: false, reason: "schedule_date_invalid" };
  if (scheduled.getTime() <= now.getTime()) return { scheduleAt: "", matched: false, reason: "schedule_in_past" };
  return { scheduleAt: scheduled.toISOString(), matched: true, reason: "explicit_brief_schedule" };
}

function requestedButtonHints(brief) {
  const text = String(brief || "");
  const hints = [];
  const intentPatterns = [
    ["tickets", /(?:comprar|garantir|reservar)\s+(?:meu\s+|seu\s+)?ingresso|ver\s+sessoes?/i],
    ["programming", /ver\s+(?:a\s+)?programa[cç][aã]o|consultar\s+hor[aá]rios?/i],
    ["trailer", /(?:assistir|ver)\s+(?:(?:ao|o)\s+)?trailer/i],
    ["coupon", /(?:usar|aplicar|resgatar)\s+(?:o\s+)?cupom/i],
    ["concession", /(?:ver|conhecer|comprar)\s+(?:a\s+)?bomboniere|ver\s+combos?/i],
    ["club", /(?:conhecer|assinar|ver)\s+(?:o\s+)?(?:clube|plano)/i],
    ["event", /(?:ver|conhecer|participar|confirmar)\s+(?:o\s+)?evento/i],
    ["account", /(?:abrir|acessar|ver)\s+(?:a\s+)?(?:conta|meus ingressos)/i]
  ];
  for (const [intent, pattern] of intentPatterns) {
    const match = text.match(pattern);
    if (match) hints.push({ intent, requestedText: match[0] });
  }
  const listedButtons = text.match(/bot(?:ão|ões)\s*[:=-]\s*([^.!\n]{2,180})/i)?.[1] || "";
  if (listedButtons) {
    for (const requestedText of listedButtons.split(/,|;|\s+e\s+/i).map((item) => item.trim()).filter(Boolean)) {
      const normalized = requestedText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const intent = normalized.includes("trailer") ? "trailer"
        : normalized.includes("cupom") ? "coupon"
          : normalized.includes("bomboniere") || normalized.includes("combo") ? "concession"
            : normalized.includes("clube") || normalized.includes("plano") ? "club"
              : normalized.includes("evento") ? "event"
                : normalized.includes("conta") || normalized.includes("ingressos") ? "account"
                  : normalized.includes("programacao") || normalized.includes("horario") ? "programming"
                    : normalized.includes("ingresso") || normalized.includes("comprar") || normalized.includes("garantir") ? "tickets" : "";
      if (intent && !hints.some((hint) => hint.intent === intent)) hints.push({ intent, requestedText });
    }
  }
  return hints.slice(0, 3);
}

module.exports = { extractRequestedSchedule, requestedButtonHints, _test: { parseTimeAround, validLocalDate } };
