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

function parseBrazilianDeadline(brief, reference) {
  const match = String(brief || "").match(/\b(?:at[eé]|v[aá]lid[oa]\s+at[eé])\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i);
  if (!match) return null;
  let year = Number(match[3] || reference.getUTCFullYear());
  if (year < 100) year += 2000;
  const candidate = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[1]), 23, 59, 59, 999));
  if (!match[3] && candidate < reference) candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  return Number.isFinite(candidate.getTime()) ? candidate : null;
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
  const match = String(brief || "").match(/\b(?:cupom|c[oó]digo)(?:\s+(?:ser[aá]|chamado))?\s*[:=-]?\s*["']?([A-Z][A-Z0-9_-]{2,31})\b/);
  if (!match) return "";
  const blocked = new Set(["COM", "PARA", "DE", "DESCONTO", "PROMOCAO", "PROMOÇÃO"]);
  return blocked.has(match[1]) ? "" : match[1];
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
  if (/bomboniere|pipoca|combo|produto/.test(text) || concessionIds.length) return "concessions";
  if (/ingresso|filme|sessao|cinema/.test(text) || movieIds.length) return "tickets";
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
  const start = new Date(scheduleAt || now);
  const durationMatch = normalizedText(brief).match(/\bpor\s+(\d{1,2})\s+dias?\b/);
  const durationDays = Math.max(1, Math.min(31, Number(durationMatch?.[1] || 7)));
  const explicitEnd = parseBrazilianDeadline(brief, start);
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
    autoCouponDurationDays: durationDays,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString()
  };
}

function syncCampaignCouponSchedule(coupon, campaign, now = new Date()) {
  if (!coupon?.autoManagedByCampaign || String(coupon.sourceCampaignId || "") !== String(campaign?.id || "")) return coupon;
  const start = new Date(campaign.scheduleAt || now);
  if (!Number.isFinite(start.getTime())) return coupon;
  const durationDays = Math.max(1, Math.min(31, Number(coupon.autoCouponDurationDays || 7)));
  return { ...coupon, startsAt: start.toISOString(), endsAt: addDays(start, durationDays).toISOString(), updatedAt: new Date(now).toISOString() };
}

module.exports = {
  buildCampaignCoupon,
  syncCampaignCouponSchedule,
  _test: { couponScope, discountRule, parseBrazilianDeadline, requestedCode, uniqueCode }
};
