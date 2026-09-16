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
assert.match(serverSource, /const showTicketAccess = enriched\.status === "active"/);
assert.match(serverSource, /if \(showTicketAccess\) \{[\s\S]*pdfQr\(enriched\.displayQrPayload \|\| enriched\.qrPayload \|\| enriched\.code, 222, 148, 164\)/);
assert.match(serverSource, /if \(showTicketAccess\) page2 \+= pdfWriteValueBlock\("CODIGO"/);
assert.match(serverSource, /QR Code desativado/);
assert.match(serverSource, /const TICKET_ARCHIVED_DOCUMENT_RETENTION_DAYS = 10/);
assert.match(serverSource, /function ticketDocumentDownloadAllowed\(/);
assert.match(serverSource, /code: "TICKET_DOCUMENT_EXPIRED"/);
assert.match(serverSource, /code: "TICKET_ARCHIVED"/);
assert.match(serverSource, /function pruneExpiredTicketPdfArtifacts\(/);
assert.match(serverSource, /function ticketCanRedeemPendingConcessionsToday\(/);
assert.match(serverSource, /status: canRedeemConcessionsToday \? "concessions_pending" : "active"/);

const accountTicketsSource = fs.readFileSync(path.resolve(__dirname, "../src/app/conta/ingressos/page.tsx"), "utf8");
assert.match(accountTicketsSource, /const showTicketCode = ticket\.status === "active" \|\| canRedeemConcessionsToday/);
assert.match(accountTicketsSource, /const canAccessTicketArtifacts = ticket\.status === "active"/);
assert.match(accountTicketsSource, /showTicketCode && <Info label="Código do ingresso"/);
assert.match(accountTicketsSource, /canAccessTicketArtifacts \? \(/);
assert.match(accountTicketsSource, /PDF, visualização externa e Google Wallet não ficam disponíveis no histórico/);
assert.match(accountTicketsSource, /O QR Code permanece disponível hoje para a retirada pendente na bomboniere/);

console.log("Ticket document tests passed.");
