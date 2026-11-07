"use strict";

function createSocialStudioContextPresenter({
  appFrontendUrl,
  buildCommercialCatalog,
  buildSocialReadyPosts,
  configuredAppBasePath,
  normalizeSocialBrand,
  publicAssetUrl,
  publicSocialStudioPost,
  slugify,
  SOCIAL_FORMATS,
  SOCIAL_SIGNATURES,
  SOCIAL_STUDIO_EDITORIAL_MOVIES,
  SOCIAL_STYLES,
  SOCIAL_TEMPLATES,
}) {
const { studioPosterBrand } = require("./social-studio/tenant-branding");

function socialStudioBrand(db) {
  const configured = db.settings?.socialStudioBrand || {};
  const inherited = db.settings?.emailBranding || {};
  const basePath = configuredAppBasePath();
  const tenantSignature = studioPosterBrand(process.env.NEXT_PUBLIC_CINEMA_SLUG);
  return normalizeSocialBrand({
    name: configured.name || db.settings?.cinemaName || db.settings?.name || inherited.name,
    logoUrl: publicAssetUrl(configured.logoUrl || db.settings?.logoUrl || inherited.logoUrl || `${basePath}/images/logo-display.webp`),
    website: configured.website || appFrontendUrl(),
    posterWebsite: tenantSignature?.website || configured.posterWebsite || "www.cinecruzeiro.com.br",
    posterLogoUrl: publicAssetUrl(tenantSignature?.signature || configured.posterLogoUrl || "/images/social-studio/cine-cruzeiro-assinatura-oficial.png"),
    primaryColor: configured.primaryColor || db.settings?.primaryColor,
    secondaryColor: configured.secondaryColor || db.settings?.secondaryColor,
    accentColor: configured.accentColor || db.settings?.accentColor,
    textColor: configured.textColor || db.settings?.textColor
  });
}

function socialStudioContext(db) {
  const studioBrand = socialStudioBrand(db);
  const tenantSignature = studioPosterBrand(process.env.NEXT_PUBLIC_CINEMA_SLUG);
  const catalog = buildCommercialCatalog(db);
  const catalogMovies = (catalog.movies || []).map((movie) => ({
    ...movie,
    director: String(db.movies?.find((source) => String(source.id) === String(movie.id))?.director || ""),
    originalTitle: String(db.movies?.find((source) => String(source.id) === String(movie.id))?.originalTitle || ""),
    catalogued: true,
    releaseDate: movie.releaseDate || "",
    sessions: movie.availableSessions || [],
    minimumPrice: (movie.availableSessions || [])
      .flatMap((session) => session.ticketTypes || [])
      .map((ticketType) => Number(ticketType.price))
      .filter((price) => Number.isFinite(price) && price > 0)
      .sort((a, b) => a - b)[0] ?? null
  }));
  const catalogTitleKeys = new Set(catalogMovies.map((movie) => slugify(movie.title || movie.id)));
  const editorialMovies = SOCIAL_STUDIO_EDITORIAL_MOVIES
    .filter((movie) => !catalogTitleKeys.has(slugify(movie.title || movie.id)))
    .map((movie) => ({
      ...movie,
      posterUrl: publicAssetUrl(movie.posterUrl || ""),
      backdropUrl: publicAssetUrl(movie.backdropUrl || ""),
      sessions: [],
      minimumPrice: null
    }));
  const movies = [...catalogMovies, ...editorialMovies];
  const premiereMovie = catalogMovies.find((movie) => /estreia/i.test(String(movie.tag || ""))) || catalogMovies[0] || null;
  const context = {
    brand: studioBrand,
    templates: SOCIAL_TEMPLATES,
    signatures: SOCIAL_SIGNATURES.filter((signature) => !tenantSignature || ["automatic", "classic", "none"].includes(signature.id)).map((signature) => ({
      ...signature,
      imageUrl: signature.imageUrl
        ? tenantSignature ? studioBrand.posterLogoUrl : publicAssetUrl(signature.imageUrl)
        : ""
    })),
    styles: [...SOCIAL_STYLES, ...require("./social-studio/composition-engine/config").STYLES],
    composition: {
      presets: require("./social-studio/composition-engine/config").PRESETS,
      looks: require("./social-studio/composition-engine/config").LOOKS
    },
    palettes: require("./social-studio/engine/palette").PALETTES,
    programLayouts: require('./social-studio/programming/direction').PROGRAM_LAYOUTS,
    formats: Object.values(SOCIAL_FORMATS),
    movies,
    concessions: catalog.concessions || [],
    clubPlans: (db.subscriptionPlans || [])
      .filter((plan) => plan.active !== false)
      .map((plan) => ({
        id: String(plan.id || ""),
        name: String(plan.name || ""),
        monthlyPrice: Number(plan.monthlyPrice || 0),
        includedTickets: Number(plan.includedTickets || 0),
        benefits: Array.isArray(plan.benefits) ? plan.benefits.map(String) : [],
        imageUrl: publicAssetUrl(plan.imageUrl || "")
      })),
    promotions: (catalog.promotions || []).map((promotion) => ({
      id: promotion.id,
      title: promotion.title,
      description: promotion.description,
      imageUrl: promotion.imageUrl || ""
    })),
    recommendedMovieId: premiereMovie?.id || "",
    history: (db.settings?.socialStudioPosts || []).slice(0, 100).map(publicSocialStudioPost)
  };
  return {
    ...context,
    readyPosts: buildSocialReadyPosts(context)
  };
}
  return { socialStudioBrand, socialStudioContext };
}

module.exports = { createSocialStudioContextPresenter };
