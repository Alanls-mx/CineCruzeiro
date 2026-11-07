"use strict";

function createPublicContentPresenter({
  assetMovie,
  assetRecord,
  buildCalendarDaysForMovies,
  clubSavingsSummary,
  couponUsageSummary,
  enrichTicket,
  integrationConfigService,
  isDeletedMovie,
  publicContentSettings,
  publicSessionStatus,
  sanitizeUser,
  sellableSessions,
  sessionWithCurrentRoom,
  todayIsoDate,
}) {
  return function getContent(db, options = {}) {
  const includePrivate = Boolean(options.includePrivate);
  const now = new Date();
  const publicSettings = includePrivate ? { ...(db.settings || {}) } : publicContentSettings(db.settings);
  const analyticsConfig = integrationConfigService.resolvedConfig(db, "analytics");
  publicSettings.tracking = {
    enabled: Boolean(analyticsConfig?.enabled && analyticsConfig?.configured),
    googleMeasurementId: analyticsConfig?.enabled ? String(analyticsConfig.googleMeasurementId || "") : "",
    metaPixelId: analyticsConfig?.enabled ? String(analyticsConfig.metaPixelId || "") : ""
  };
  const movies = [...(db.movies || [])]
    .filter((movie) => !isDeletedMovie(movie))
    .sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.title || "").localeCompare(String(b.title || "")))
    .map((movie) => assetMovie({
      ...movie,
      sessions: (movie.sessions || []).map((session) => sessionWithCurrentRoom(db, session))
    }));
  const visibleMovies = movies
    .filter((movie) => (movie.workflowStatus || (movie.status === "hidden" ? "archived" : "published")) === "published" && movie.status !== "hidden")
    .map((movie) => ({
      ...movie,
      sessions: sellableSessions(movie, now).map((session) => ({ ...session, status: publicSessionStatus(db, session) }))
    }));
  const nowPlaying = visibleMovies.filter((movie) => movie.status === "now_playing");
  const upcoming = visibleMovies.filter((movie) => movie.status === "upcoming");
  const featuredMovie = visibleMovies.find((movie) => movie.isHighlight) || nowPlaying[0] || visibleMovies[0] || null;
  const ticketsByOrderId = includePrivate
    ? (db.tickets || []).reduce((map, ticket) => {
        const orderId = String(ticket.orderId || "");
        if (!orderId) return map;
        const tickets = map.get(orderId) || [];
        tickets.push(ticket);
        map.set(orderId, tickets);
        return map;
      }, new Map())
    : null;

  return {
    settings: assetRecord(publicSettings, [
      "logoUrl",
      "clubHeroImageUrl",
      "clubBannerImageUrl",
      "eventHeroImageUrl",
      "eventGamesImageUrl",
      "eventPartiesImageUrl",
      "eventCorporateImageUrl",
      "eventGalleryImageUrl"
    ]),
    calendar: {
      timezone: "America/Sao_Paulo",
      today: todayIsoDate(),
      days: buildCalendarDaysForMovies(visibleMovies, 7)
    },
    rooms: db.rooms,
    ticketTypes: db.ticketTypes,
    concessions: (db.concessions || []).map((item) => {
      const withAsset = assetRecord(item, ["imageUrl"]);
      if (includePrivate) return withAsset;
      const { stock, reserved, sold, ...publicItem } = withAsset;
      return publicItem;
    }),
    promotions: includePrivate
      ? (db.promotions || []).map((item) => ({ ...assetRecord(item, ["imageUrl"]), ...couponUsageSummary(db, item) }))
      : (db.promotions || []).filter((item) => !item.couponCode).map(({ couponCode, usageLimit, perCustomerLimit, ...item }) => assetRecord(item, ["imageUrl"])),
    ads: (db.ads || [])
      .filter((item) => includePrivate || (db.settings?.adsEnabled !== false && (
        item.active !== false &&
        (!item.startsAt || new Date(item.startsAt).getTime() <= now.getTime()) &&
        (!item.endsAt || new Date(item.endsAt).getTime() > now.getTime())
      )))
      .map((item) => {
        const withAsset = assetRecord(item, ["imageUrl"]);
        if (includePrivate) return withAsset;
        const { impressions, clicks, lastImpressionAt, lastClickAt, ...publicAd } = withAsset;
        return publicAd;
      }),
    movies: includePrivate ? movies : visibleMovies,
    nowPlaying,
    upcoming,
    featuredMovie,
    ...(includePrivate
      ? {
          users: db.users.map(sanitizeUser),
          orders: db.orders.map((order) => ({
            ...order,
            tickets: (ticketsByOrderId.get(String(order.id || "")) || []).map((ticket) => enrichTicket(db, ticket))
          })),
          payments: db.payments || [],
          tickets: (db.tickets || []).map((ticket) => enrichTicket(db, ticket)),
          auditLogs: db.auditLogs || [],
          subscriptionPlans: (db.subscriptionPlans || []).map((item) => assetRecord(item, ["imageUrl"])),
          subscriptions: (db.subscriptions || []).map((subscription) => ({
            ...subscription,
            savings: clubSavingsSummary(db, subscription)
          })),
          subscriptionCredits: db.subscriptionCredits || [],
          subscriptionUsage: db.subscriptionUsage || [],
          subscriptionCycles: db.subscriptionCycles || [],
          subscriptionPayments: db.subscriptionPayments || [],
          subscriptionCreditUnits: db.subscriptionCreditUnits || [],
          subscriptionCreditRedemptions: db.subscriptionCreditRedemptions || [],
          subscriptionAccountingRules: db.subscriptionAccountingRules || [],
          orderServiceItems: db.orderServiceItems || [],
          orderGoodsItems: db.orderGoodsItems || [],
          goodsFiscalDocuments: db.goodsFiscalDocuments || []
        }
      : {})
  };
}
}

module.exports = { createPublicContentPresenter };
