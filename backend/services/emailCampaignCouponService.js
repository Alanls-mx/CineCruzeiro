const crypto = require("crypto");

function couponError(message, details = {}) {
  const error = new Error(message);
  error.code = "EMAIL_CAMPAIGN_COUPON_DETAILS_REQUIRED";
  error.statusCode = 422;
  error.details = details;
  return error;
}

function normalizedText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function addDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function brazilianMoment(year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
  const candidate = new Date(Date.UTC(year, month - 1, day, hour + 3, minute, second, millisecond));
  if (!Number.isFinite(candidate.getTime())) return null;
  const local = new Date(candidate.getTime() - (3 * 60 * 60 * 1000));
  return local.getUTCFullYear() === year && local.getUTCMonth() + 1 === month && local.getUTCDate() === day
    ? candidate
    : null;
}

function parsedYear(value, fallback) {
  let year = Number(value || fallback);
  if (year < 100) year += 2000;
  return year;
}

function parseBrazilianPeriod(brief, reference) {
  const text = String(brief || "").replace(/[*_`]/g, "");
  const match = text.match(/\b(?:v[aá]lid[oa]\s+)?de\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(?:at[eé]|a)\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s*,?\s*(?:[aà]s?|pelas?)\s*(\d{1,2})(?::|h)(\d{2})?)?/i);
  if (!match) return null;
  const startYear = parsedYear(match[3], reference.getUTCFullYear());
  const endYear = parsedYear(match[6], startYear);
  const start = brazilianMoment(startYear, Number(match[2]), Number(match[1]), 0, 0, 0, 0);
  const end = brazilianMoment(endYear, Number(match[5]), Number(match[4]), Number(match[7] || 23), Number(match[8] || 59), 59, 999);
  return start && end && end > start ? { start, end } : null;
}

function parseBrazilianDeadline(brief, reference) {
  const match = String(brief || "").replace(/[*_`]/g, "").match(/\b(?:at[eé]|v[aá]lid[oa]\s+at[eé])\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s*,?\s*(?:[aà]s?|pelas?)\s*(\d{1,2})(?::|h)(\d{2})?)?/i);
  if (!match) return null;
  let year = parsedYear(match[3], reference.getUTCFullYear());
  let candidate = brazilianMoment(year, Number(match[2]), Number(match[1]), Number(match[4] || 23), Number(match[5] || 59), 59, 999);
  if (!candidate) return null;
  if (!match[3] && candidate < reference) candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  return candidate;
}

function discountRule(brief) {
  const raw = String(brief || "");
  const percent = raw.match(/\b(\d{1,3}(?:[,.]\d{1,2})?)\s*%/);
  if (percent) return { discountType: "percent", value: Number(percent[1].replace(",", ".")) };
  const amount = raw.match(/R\$\s*(\d+(?:[.,]\d{1,2})?)/i);
  if (!amount) return null;
  const value = Number(amount[1].replace(".", "").replace(",", "."));
  const fixedPrice = /(?:pre[cç]o\s+final|por\s+apenas|por)\s*(?:de\s+)?R\$/i.test(raw.slice(Math.max(0, amount.index - 30), amount.index + amount[0].length));
  return { discountType: fixedPrice ? "fixed_price" : "amount", value };
}

function requestedCode(brief) {
  const cleaned = String(brief || "").replace(/[*_`]/g, "");
  const match = cleaned.match(/\b(?:cupom|c[oó]digo)(?:\s+(?:ser[aá]|chamado))?\s*[:=-]?\s*["']?([A-Z][A-Z0-9_-]{2,31})\b/i);
  if (!match) return "";
  const blocked = new Set(["COM", "PARA", "DE", "DESCONTO", "PROMOCAO", "PROMOÇÃO"]);
  const code = String(match[1] || "").toUpperCase();
  return blocked.has(code) ? "" : code;
}

function uniqueCode(preferred, rule, promotions = []) {
  const used = new Set(promotions.map((item) => String(item.couponCode || "").toUpperCase()));
  const base = String(preferred || `CINE${String(rule.value).replace(/\D/g, "") || "OFERTA"}`)
    .toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24) || "CINEOFERTA";
  if (!used.has(base)) return base;
  let candidate = "";
  do candidate = `${base.slice(0, 27)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  while (used.has(candidate));
  return candidate;
}

function couponScope(brief, movieIds, concessionIds) {
  const text = normalizedText(brief);
  if (concessionIds.length) return "concessions";
  if (movieIds.length) return "tickets";
  if (/bomboniere|pipoca|combo|produto\s+da\s+bomboniere/.test(text)) return "concessions";
  if (/ingresso|filme|sessao|cinema/.test(text)) return "tickets";
  return "all";
}

function buildCampaignCoupon({ brief, campaignId, scheduleAt, movieIds = [], concessionIds = [], promotions = [], now = new Date() } = {}) {
  const rule = discountRule(brief);
  if (!rule || !Number.isFinite(rule.value) || rule.value <= 0) {
    throw couponError("Para criar a promoção, informe no briefing o desconto exato, como 20% ou R$ 10 de desconto.");
  }
  if (rule.discountType === "percent" && rule.value > 50) {
    throw couponError("Cupons criados automaticamente aceitam no máximo 50% de desconto. Para uma condição maior, crie e revise o cupom manualmente.", { value: rule.value });
  }
  const scheduleStart = new Date(scheduleAt || now);
  const explicitPeriod = parseBrazilianPeriod(brief, scheduleStart);
  const start = explicitPeriod?.start || scheduleStart;
  const durationMatch = normalizedText(brief).match(/\bpor\s+(\d{1,2})\s+dias?\b/);
  const durationDays = Math.max(1, Math.min(31, Number(durationMatch?.[1] || 7)));
  const explicitEnd = explicitPeriod?.end || parseBrazilianDeadline(brief, start);
  const end = explicitEnd || addDays(start, durationDays);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw couponError("A validade informada para o cupom não é compatível com a data da campanha.");
  }
  const scope = couponScope(brief, movieIds, concessionIds);
  const titleTarget = movieIds.length ? "Ingressos do filme selecionado" : scope === "concessions" ? "Oferta da bomboniere" : "Oferta da campanha";
  const couponCode = uniqueCode(requestedCode(brief), rule, promotions);
  return {
    id: `cupom-campanha-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    title: titleTarget,
    description: `Cupom criado automaticamente para a campanha ${campaignId}. Revise as regras antes do envio.`,
    couponCode,
    discountType: rule.discountType,
    value: Number(rule.value.toFixed(2)),
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    appliesTo: scope,
    minimumOrderValue: 0,
    maximumDiscount: 0,
    usageLimit: 0,
    perCustomerLimit: 1,
    firstPurchaseOnly: false,
    allowClubStacking: false,
    allowedMovieIds: scope === "tickets" ? movieIds.map(String).filter(Boolean).slice(0, 20) : [],
    active: false,
    sourceCampaignId: campaignId,
    autoManagedByCampaign: true,
    autoCouponValidityMode: explicitPeriod ? "explicit" : "relative",
    autoCouponDurationDays: durationDays,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString()
  };
}

function syncCampaignCouponSchedule(coupon, campaign, now = new Date()) {
  if (!coupon?.autoManagedByCampaign || String(coupon.sourceCampaignId || "") !== String(campaign?.id || "")) return coupon;
  if (coupon.autoCouponValidityMode === "explicit") return { ...coupon, updatedAt: new Date(now).toISOString() };
  const start = new Date(campaign.scheduleAt || now);
  if (!Number.isFinite(start.getTime())) return coupon;
  const durationDays = Math.max(1, Math.min(31, Number(coupon.autoCouponDurationDays || 7)));
  return { ...coupon, startsAt: start.toISOString(), endsAt: addDays(start, durationDays).toISOString(), updatedAt: new Date(now).toISOString() };
}

module.exports = {
  buildCampaignCoupon,
  syncCampaignCouponSchedule,
  _test: { couponScope, discountRule, parseBrazilianDeadline, parseBrazilianPeriod, requestedCode, uniqueCode }
};
