const assert = require("assert/strict");
const { brazilianDate } = require("../backend/utils/dateFormat");
const emailService = require("../backend/services/emailService");

assert.equal(brazilianDate("2026-08-27"), "27/08/2026");
assert.equal(brazilianDate("2026-08-27T19:00:00-03:00"), "27/08/2026");
assert.equal(brazilianDate("27/08/2026"), "27/08/2026");

const ticketEmailCard = emailService._test.ticketCard({
  movieTitle: "Filme de teste",
  sessionDate: "2026-08-27",
  sessionTime: "19:00",
  sessionRoom: "Sala Cruzeiro",
  sessionFormat: "2D Dublado",
  seat: "A2",
  ticketType: "Inteira",
  code: "CC-TESTE"
});

assert.match(ticketEmailCard, /27\/08\/2026 às 19:00/);
assert.match(ticketEmailCard, /Poltrona: A2/);
assert.doesNotMatch(ticketEmailCard, /2026-08-27/);

assert.equal(
  emailService._test.absoluteUrl("/uploads/movies-filme/poster.jpg", "https://lumixengine.com/projects/cinecruzeiro"),
  "https://lumixengine.com/projects/cinecruzeiro/uploads/movies-filme/poster.jpg"
);
assert.equal(
  emailService._test.absoluteUrl("/projects/cinecruzeiro/uploads/movies-filme/poster.jpg", "https://lumixengine.com/projects/cinecruzeiro"),
  "https://lumixengine.com/projects/cinecruzeiro/uploads/movies-filme/poster.jpg"
);

console.log("Ticket document tests passed.");
