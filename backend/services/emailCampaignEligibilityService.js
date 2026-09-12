const { validateCampaignTemporalClaims } = require("./emailCampaignTemporalValidator");
const { orderUsesCoupon } = require("./couponLifecycleService");

function campaignError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 409;
  error.details = details;
  return error;
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function movieCampaignDate(movie) {
  const release = validDate(movie?.releaseDate ? `${movie.releaseDate}T12:00:00` : "");
  const sessions = (movie?.sessions || [])
    .map((session) => validDate(session?.date && session?.time ? `${session.date}T${session.time}:00` : ""))
    .filter(Boolean)
    .sort((a, b) => a - b);
  return release || sessions[0] || null;
}

function couponUsageCount(db, coupon) {
  return (db.orders || []).filter((order) => orderUsesCoupon(order, coupon)).length;
}

function availableConcessionStock(item) {
  if (item?.stock === "" || item?.stock === undefined || item?.stock === null) return Infinity;
  return Math.max(0, Number(item.stock || 0));
}

function scenarioNeedsMovie(scenario) {
  return ["premiere", "now_playing", "last_chance", "ticket"].includes(String(scenario || ""));
}

function scenarioCouponTarget(scenario) {
  if (scenario === "concession") return "concessions";
  if (["premiere", "now_playing", "last_chance", "ticket"].includes(scenario)) return "tickets";
  return "all";
}

function monthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function resolveCampaignContext(db, request = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const scenario = String(request.scenario || request.aiScenario || "promotion");
  const warnings = [];
  const requestedMovieId = String(request.movieId || "").trim();
  const requestedCouponId = String(request.couponId || "").trim();
  const requestedPlanId = String(request.clubPlanId || "").trim();
  const requestedConcessionIds = [...new Set((Array.isArray(request.concessionIds)
    ? request.concessionIds
    : request.concessionId ? [request.concessionId] : [])
    .map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 20);

  let movie = requestedMovieId ? (db.movies || []).find((item) => String(item.id) === requestedMovieId) : null;
  if (requestedMovieId && !movie) throw campaignError("EMAIL_CAMPAIGN_MOVIE_NOT_FOUND", "O filme selecionado não existe mais no catálogo.");
  if (!movie && options.allowAutoMovie && scenarioNeedsMovie(scenario)) {
    const wantedStatus = scenario === "premiere" ? "upcoming" : "now_playing";
    movie = (db.movies || []).find((item) => item.status === wantedStatus && item.workflowStatus !== "archived") || null;
  }
  if (movie && (movie.workflowStatus === "archived" || movie.workflowStatus === "draft" || movie.status === "hidden")) {
    throw campaignError("EMAIL_CAMPAIGN_MOVIE_UNAVAILABLE", "O filme selecionado não está publicado para os clientes.");
  }
  if (scenarioNeedsMovie(scenario) && !movie) {
    throw campaignError("EMAIL_CAMPAIGN_MOVIE_REQUIRED", "Selecione um filme publicado para este tipo de campanha.");
  }

  const coupon = requestedCouponId ? (db.promotions || []).find((item) => String(item.id) === requestedCouponId) : null;
  if (requestedCouponId && !coupon) throw campaignError("EMAIL_CAMPAIGN_COUPON_NOT_FOUND", "O cupom selecionado não existe mais.");
  if (coupon) {
    const ownDraftCoupon = coupon.autoManagedByCampaign === true && String(coupon.sourceCampaignId || "") === String(request.id || "");
    if (coupon.active === false && !ownDraftCoupon) throw campaignError("EMAIL_CAMPAIGN_COUPON_INACTIVE", "O cupom selecionado está desativado.");
    if (!String(coupon.couponCode || "").trim() || Number(coupon.value || 0) <= 0) {
      throw campaignError("EMAIL_CAMPAIGN_COUPON_INVALID", "O cupom selecionado não possui código e desconto válidos.");
    }
    const startsAt = validDate(coupon.startsAt);
    const endsAt = validDate(coupon.endsAt);
    if (startsAt && endsAt && startsAt > endsAt) throw campaignError("EMAIL_CAMPAIGN_COUPON_WINDOW_INVALID", "O período de validade do cupom está incorreto.");
    if (endsAt && endsAt < now) throw campaignError("EMAIL_CAMPAIGN_COUPON_EXPIRED", "O cupom selecionado já expirou.");
    if (startsAt && startsAt > now) warnings.push(`O cupom só poderá ser usado a partir de ${startsAt.toLocaleDateString("pt-BR")}.`);
    if (Number(coupon.usageLimit || 0) > 0 && couponUsageCount(db, coupon) >= Number(coupon.usageLimit)) {
      throw campaignError("EMAIL_CAMPAIGN_COUPON_EXHAUSTED", "O cupom selecionado já atingiu o limite de utilizações.");
    }
    const allowedMovieIds = Array.isArray(coupon.allowedMovieIds) ? coupon.allowedMovieIds.map(String) : [];
    if (allowedMovieIds.length && !movie) {
      throw campaignError("EMAIL_CAMPAIGN_COUPON_MOVIE_REQUIRED", "Este cupom só vale para filmes específicos. Selecione um filme compatível.");
    }
    if (movie && allowedMovieIds.length && !allowedMovieIds.includes(String(movie.id))) {
      throw campaignError("EMAIL_CAMPAIGN_COUPON_MOVIE_INVALID", `O cupom não pode ser usado em ${movie.title || "este filme"}.`);
    }
    const target = scenarioCouponTarget(scenario);
    if (target !== "all" && !["all", target].includes(String(coupon.appliesTo || "all"))) {
      throw campaignError("EMAIL_CAMPAIGN_COUPON_SCOPE_INVALID", target === "tickets"
        ? "Este cupom é exclusivo da bomboniere e não pode ser anunciado como desconto em ingressos."
        : "Este cupom é exclusivo de ingressos e não pode ser anunciado como desconto na bomboniere.");
    }
    const campaignDate = movieCampaignDate(movie);
    if (campaignDate && endsAt && endsAt < campaignDate) {
      throw campaignError("EMAIL_CAMPAIGN_COUPON_EXPIRES_BEFORE_MOVIE", `O cupom expira antes do lançamento ou da primeira sessão de ${movie.title}.`);
    }
    if (campaignDate && startsAt && startsAt > campaignDate) {
      warnings.push(`O cupom começa depois da data inicial de ${movie.title}; deixe essa condição clara no texto.`);
    }
    if (scenario === "premiere" && campaignDate && endsAt && endsAt < monthEnd(campaignDate)) {
      warnings.push(`O cupom não cobre todo o mês de lançamento de ${movie.title}; a data final deve aparecer no e-mail.`);
    }
  }

  const plan = requestedPlanId ? (db.subscriptionPlans || []).find((item) => String(item.id) === requestedPlanId) : null;
  if (requestedPlanId && !plan) throw campaignError("EMAIL_CAMPAIGN_PLAN_NOT_FOUND", "O plano do Clube selecionado não existe mais.");
  if (plan && (plan.active === false || Number(plan.monthlyPrice ?? plan.price ?? 0) <= 0)) {
    throw campaignError("EMAIL_CAMPAIGN_PLAN_UNAVAILABLE", "O plano do Clube selecionado não está disponível para assinatura.");
  }
  if ((scenario === "club_plan" || request.requireClubPlan === true) && !plan) {
    throw campaignError("EMAIL_CAMPAIGN_PLAN_REQUIRED", "Selecione um plano ativo para esta campanha do Clube.");
  }

  const concessions = requestedConcessionIds.map((id) => {
    const item = (db.concessions || []).find((entry) => String(entry.id) === id);
    if (!item) throw campaignError("EMAIL_CAMPAIGN_CONCESSION_NOT_FOUND", "Um item selecionado da bomboniere não existe mais.", { id });
    if (item.active === false) throw campaignError("EMAIL_CAMPAIGN_CONCESSION_INACTIVE", `${item.name || "Um item da bomboniere"} está desativado.`);
    if (Number(item.price || 0) <= 0) throw campaignError("EMAIL_CAMPAIGN_CONCESSION_PRICE_INVALID", `${item.name || "Um item da bomboniere"} não possui preço válido.`);
    if (availableConcessionStock(item) <= 0) throw campaignError("EMAIL_CAMPAIGN_CONCESSION_OUT_OF_STOCK", `${item.name || "Um item da bomboniere"} está sem estoque.`);
    return item;
  });
  if (scenario === "concession" && !concessions.length) {
    throw campaignError("EMAIL_CAMPAIGN_CONCESSION_REQUIRED", "Selecione ao menos um item ativo e disponível da bomboniere.");
  }

  return {
    movie,
    coupon,
    plan,
    concessions,
    report: {
      checkedAt: now.toISOString(),
      warnings,
      facts: {
        movie: movie ? { id: movie.id, title: movie.title, campaignDate: movieCampaignDate(movie)?.toISOString() || "" } : null,
        coupon: coupon ? { id: coupon.id, code: coupon.couponCode, startsAt: coupon.startsAt || "", endsAt: coupon.endsAt || "", usageCount: couponUsageCount(db, coupon), usageLimit: Number(coupon.usageLimit || 0) } : null,
        plan: plan ? { id: plan.id, name: plan.name, active: plan.active !== false } : null,
        concessions: concessions.map((item) => ({ id: item.id, name: item.name, stock: Number.isFinite(availableConcessionStock(item)) ? availableConcessionStock(item) : null }))
      }
    }
  };
}

function filterCouponRecipients(db, coupon, recipients = []) {
  if (!coupon) return { recipients, excluded: 0, reasons: {} };
  const reasons = {};
  const code = String(coupon.couponCode || "").toUpperCase();
  const accepted = recipients.filter((recipient) => {
    const email = String(recipient.email || "").toLowerCase();
    const paidOrders = (db.orders || []).filter((order) => order.status === "paid" && (
      String(order.customerUserId || "") === String(recipient.id || "") ||
      (email && String(order.customerEmail || "").toLowerCase() === email)
    ));
    if (coupon.firstPurchaseOnly && paidOrders.length) {
      reasons.firstPurchaseOnly = (reasons.firstPurchaseOnly || 0) + 1;
      return false;
    }
    if (Number(coupon.perCustomerLimit || 0) > 0) {
      const uses = paidOrders.filter((order) => String(order.couponId || "") === String(coupon.id || "") || (code && String(order.couponCode || "").toUpperCase() === code)).length;
      if (uses >= Number(coupon.perCustomerLimit)) {
        reasons.perCustomerLimit = (reasons.perCustomerLimit || 0) + 1;
        return false;
      }
    }
    return true;
  });
  return { recipients: accepted, excluded: recipients.length - accepted.length, reasons };
}

function filterOfferRecipients(db, context = {}, recipients = []) {
  const couponCheck = filterCouponRecipients(db, context.coupon, recipients);
  if (!context.plan) return couponCheck;
  const planId = String(context.plan.id || "");
  const blockedStatuses = new Set(["pending_payment", "active", "paused", "ending"]);
  const reasons = { ...couponCheck.reasons };
  const accepted = couponCheck.recipients.filter((recipient) => {
    const alreadySubscribed = (db.subscriptions || []).some((subscription) =>
      String(subscription.userId || "") === String(recipient.id || "") &&
      String(subscription.planId || "") === planId &&
      blockedStatuses.has(String(subscription.status || ""))
    );
    if (alreadySubscribed) reasons.alreadySubscribed = (reasons.alreadySubscribed || 0) + 1;
    return !alreadySubscribed;
  });
  return { recipients: accepted, excluded: recipients.length - accepted.length, reasons };
}

module.exports = {
  resolveCampaignContext,
  validateCampaignTemporalClaims,
  filterCouponRecipients,
  filterOfferRecipients,
  _test: { availableConcessionStock, couponUsageCount, movieCampaignDate }
};
