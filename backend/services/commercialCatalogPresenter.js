function createCommercialCatalogPresenter({
  appFrontendUrl,
  isSessionSellable,
  normalizedSessionStatus,
  publicAssetUrl,
  publicSessionStatus,
  roomDisplayLabel,
  roomForSession,
  sessionSalesOpenAt,
  sessionStartsAt,
  ticketTypesForSession,
  todayIsoDate
}) {
  function assetUrl(value) {
    const asset = String(value || "").trim();
    if (!asset) return "";
    try {
      return new URL(asset, `${appFrontendUrl()}/`).toString();
    } catch {
      return asset;
    }
  }

  function dateLabel(date) {
    const value = String(date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(`${value}T12:00:00-03:00`));
  }

  function offerIsActive(item = {}, now = new Date()) {
    const status = String(item.status || "").trim().toLowerCase();
    if (item.active === false || item.archivedAt || ["archived", "hidden", "inactive", "expired"].includes(status)) return false;
    const startsAt = item.startsAt || item.startAt || item.validFrom || item.startsOn || "";
    const endsAt = item.endsAt || item.endAt || item.validUntil || item.expiresAt || "";
    const start = startsAt ? new Date(startsAt).getTime() : 0;
    const end = endsAt ? new Date(endsAt).getTime() : 0;
    if (Number.isFinite(start) && start && start > now.getTime()) return false;
    return !(Number.isFinite(end) && end && end < now.getTime());
  }

  function catalogOffer(item = {}, { coupon = false } = {}) {
    return {
      id: String(item.id || ""),
      title: String(item.title || item.name || ""),
      description: String(item.description || item.details || ""),
      ...(coupon ? { code: String(item.couponCode || "") } : {}),
      discountType: String(item.discountType || item.benefitType || ""),
      discountValue: Number(item.discountValue ?? item.value ?? item.amount ?? 0) || 0,
      appliesTo: String(item.appliesTo || item.scope || ""),
      validFrom: String(item.startsAt || item.startAt || item.validFrom || item.startsOn || ""),
      validUntil: String(item.endsAt || item.endAt || item.validUntil || item.expiresAt || ""),
      imageUrl: assetUrl(publicAssetUrl(item.imageUrl || ""))
    };
  }

  function catalogSession(db, movie, session, now = new Date()) {
    const room = roomForSession(db, session);
    const startsAt = sessionStartsAt(session, session.date || todayIsoDate());
    const publicStatus = publicSessionStatus(db, session);
    const availableForPurchase = isSessionSellable(session, session.date || todayIsoDate(), now) && publicStatus !== "sold_out";
    return {
      id: String(session.id || ""),
      movieId: String(movie.id || ""),
      movieSlug: String(movie.slug || movie.id || ""),
      movieTitle: String(movie.title || ""),
      date: String(session.date || "").slice(0, 10),
      dateLabel: dateLabel(session.date),
      time: String(session.time || session.timeLabel || ""),
      startsAt: startsAt ? startsAt.toISOString() : "",
      salesOpenAt: sessionSalesOpenAt(session, session.date || todayIsoDate())?.toISOString() || "",
      availableForPurchase,
      salesStatus: availableForPurchase ? publicStatus : (publicStatus === "sold_out" ? "sold_out" : "scheduled"),
      room: {
        id: String(room?.id || session.roomId || ""),
        name: String(room?.name || session.room || ""),
        technology: String(room?.technology || ""),
        label: roomDisplayLabel(room) || String(session.room || "")
      },
      format: String(session.format || ""),
      ticketTypes: ticketTypesForSession(db, session).map((ticketType) => ({
        id: String(ticketType.id || ""),
        name: String(ticketType.name || ""),
        price: Number(ticketType.price || 0),
        description: String(ticketType.description || "")
      }))
    };
  }

  function buildCommercialCatalog(db, now = new Date()) {
    const publishedMovies = (db.movies || [])
      .filter((movie) => (movie.workflowStatus || (movie.status === "hidden" ? "archived" : "published")) === "published" && movie.status !== "hidden")
      .sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.title || "").localeCompare(String(b.title || "")));
    const programming = publishedMovies.flatMap((movie) => (movie.sessions || [])
      .filter((session) => {
        const status = normalizedSessionStatus(session);
        const startsAt = sessionStartsAt(session, session.date || todayIsoDate());
        const remainsSellable = isSessionSellable(session, session.date || todayIsoDate(), now);
        return !["cancelled", "hidden", "archived"].includes(status) && startsAt && (startsAt.getTime() >= now.getTime() || remainsSellable);
      })
      .map((session) => catalogSession(db, movie, session, now)))
      .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    const availableSessions = programming.filter((session) => session.availableForPurchase);
    const movies = publishedMovies.map((movie) => {
      const sellable = (movie.sessions || [])
        .map((session) => catalogSession(db, movie, session, now))
        .filter((session) => session.availableForPurchase);
      return {
        id: String(movie.id || ""),
        slug: String(movie.slug || movie.id || ""),
        title: String(movie.title || ""),
        synopsis: String(movie.synopsis || ""),
        status: String(movie.status || ""),
        tag: String(movie.tag || ""),
        releaseDate: String(movie.releaseDate || ""),
        duration: String(movie.duration || ""),
        genres: Array.isArray(movie.genre) ? movie.genre.map(String) : [],
        artworkMetadata: movie.artworkMetadata || {},
        rating: String(movie.rating || ""),
        featured: Boolean(movie.isHighlight),
        posterUrl: assetUrl(publicAssetUrl(movie.posterUrl || "")),
        backdropUrl: assetUrl(publicAssetUrl(movie.backdropUrl || "")),
        availableSessions: sellable
      };
    });
    const activePromotions = (db.promotions || []).filter((item) => !item.couponCode && offerIsActive(item, now));
    const activeCoupons = (db.promotions || []).filter((item) => item.couponCode && offerIsActive(item, now));
    const dates = [...new Map(programming.map((session) => [session.date, {
      date: session.date,
      label: session.dateLabel,
      sessionCount: 0,
      availableSessionCount: 0
    }])).values()];
    programming.forEach((session) => {
      const date = dates.find((item) => item.date === session.date);
      if (!date) return;
      date.sessionCount += 1;
      if (session.availableForPurchase) date.availableSessionCount += 1;
    });

    return {
      version: "1.0",
      generatedAt: now.toISOString(),
      timezone: "America/Sao_Paulo",
      catalog: {
        name: String(db.settings?.cinemaName || db.settings?.name || "Catálogo de cinema"),
        programmingUrl: `${appFrontendUrl()}/filmes`
      },
      movies,
      availableSessions,
      programming,
      concessions: (db.concessions || [])
        .filter((item) => item.active !== false && !item.archivedAt)
        .map((item) => ({
          id: String(item.id || ""),
          name: String(item.name || ""),
          category: String(item.category || ""),
          description: String(item.description || ""),
          price: Number(item.price || 0),
          imageUrl: assetUrl(publicAssetUrl(item.imageUrl || ""))
        })),
      promotions: activePromotions.map((item) => catalogOffer(item)),
      coupons: activeCoupons.map((item) => catalogOffer(item, { coupon: true })),
      dates
    };
  }

  return { buildCommercialCatalog };
}

module.exports = { createCommercialCatalogPresenter };
