function normalizeSnapshotMovies(db, { slugify }) {
  db.movies ||= [];
  db.movies = db.movies.map((movie) => ({
    ...movie,
    slug: movie.slug || movie.id || slugify(movie.title || ""),
    workflowStatus: movie.workflowStatus || (movie.status === "hidden" ? "archived" : "published"),
    sortOrder: Number(movie.sortOrder ?? movie.displayOrder ?? 100),
    director: movie.director || "",
    metadata: movie.metadata || {}
  })).sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.title || "").localeCompare(String(b.title || "")));
  db.rooms ||= [];
  db.ticketTypes ||= [];
  const activeTicketTypeIds = db.ticketTypes.filter((ticketType) => ticketType.active !== false).map((ticketType) => ticketType.id);
  db.movies = db.movies.map((movie) => ({
    ...movie,
    sessions: (movie.sessions || []).map((session) => {
      const selectedIds = (Array.isArray(session.ticketTypeIds) && session.ticketTypeIds.length ? session.ticketTypeIds : activeTicketTypeIds)
        .filter((id, index, ids) => db.ticketTypes.some((ticketType) => ticketType.id === id) && ids.indexOf(id) === index);
      const selectedTypes = selectedIds.map((id) => db.ticketTypes.find((ticketType) => ticketType.id === id)).filter(Boolean);
      return {
        ...session,
        ticketTypeIds: selectedIds,
        priceFull: Number(selectedTypes[0]?.price ?? session.priceFull ?? db.settings.defaultTicketPrice ?? 10),
        priceHalf: Number(selectedTypes[1]?.price ?? selectedTypes[0]?.price ?? session.priceHalf ?? session.priceFull ?? db.settings.defaultTicketPrice ?? 10)
      };
    })
  }));
}

module.exports = { normalizeSnapshotMovies };
