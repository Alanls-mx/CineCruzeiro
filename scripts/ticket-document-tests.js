const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
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

const serverSource = fs.readFileSync(path.resolve(__dirname, "../backend/server.js"), "utf8");
assert.match(serverSource, /pdfWriteCenteredText\(enriched\.displayCode \|\| enriched\.code, 304, 126/);
assert.match(serverSource, /pdfQr\(enriched\.displayQrPayload \|\| enriched\.qrPayload \|\| enriched\.code, 222, 148, 164\)/);
assert.match(serverSource, /const showTicketCode = enriched\.status !== "expired"/);
assert.match(serverSource, /if \(showTicketCode\) page1 \+= pdfWriteCenteredText\(enriched\.displayCode/);
assert.match(serverSource, /if \(showTicketCode\) page2 \+= pdfWriteValueBlock\("CODIGO"/);

const accountTicketsSource = fs.readFileSync(path.resolve(__dirname, "../src/app/conta/ingressos/page.tsx"), "utf8");
assert.match(accountTicketsSource, /const showTicketCode = ticket\.status !== "expired"/);
assert.match(accountTicketsSource, /showTicketCode && <Info label="Código do ingresso"/);

console.log("Ticket document tests passed.");
