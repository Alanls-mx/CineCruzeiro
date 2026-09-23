function campaignHierarchy(draft = {}) {
  const campaign = draft.templateId || "movie-premiere";
  const emphasis = draft.artDirection?.emphasis;
  const price = ["movie-price", "ticket-offer", "concession-combo", "club-plan"].includes(campaign);
  const premiere = ["movie-premiere", "movie-presale"].includes(campaign);
  const sessions = ['sessions-today','sessions-week'].includes(campaign);
  const primary = sessions ? 'detail' : campaign === 'multi-movies' ? 'title' : emphasis === "film" ? "title" : emphasis === "date" || price || premiere ? "detail" : "title";
  const order = [primary, primary === "title" ? "detail" : "title", "cta", "subtitle", "description"];
  return { primary, order, needsDate: premiere, needsPrice: price, genre: draft.genreProfile?.id || "cinema" };
}

module.exports = { campaignHierarchy };
