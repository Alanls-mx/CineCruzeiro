import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createWalletTicketObjectPresenter } = require("../backend/services/walletTicketObjectPresenter.js");
const config = { classId: "issuer.cinema", issuerId: "issuer" };
const enriched = { status: "active", sessionDate: "2026-11-10", sessionTime: "20:00", archiveAt: "2026-11-11T03:00:00Z",
  movieTitle: "Filme", seat: "A10", ticketType: "Inteira", displayCode: "CC-001", displayQrPayload: "display-only", orderId: "order-1" };
const { buildWalletTicketObject } = createWalletTicketObjectPresenter({
  buildGoogleWalletTextModules: () => [{ id: "filme", body: "Filme" }]
});
const baseline = () => buildWalletTicketObject({ config, enriched,
  walletPosterUrl: "https://image.tmdb.org/t/p/w780/poster.jpg", objectId: "issuer.ticket-1",
  frontendUrl: "https://cinema.example/projects/cinema-a", user: { name: "Cliente" }, ticket: { id: "ticket-1" } });

test("objeto Wallet original usa identidade da instalação, QR de exibição e estado do ingresso", () => {
  const active = baseline();
  assert.equal(active.id, "issuer.ticket-1");
  assert.equal(active.classId, "issuer.cinema");
  assert.equal(active.state, "ACTIVE");
  assert.equal(active.barcode.value, "display-only");
  assert.equal(active.heroImage.sourceUri.uri, "https://image.tmdb.org/t/p/w780/poster.jpg");
  assert.equal(active.linksModuleData.uris[0].uri, "https://cinema.example/projects/cinema-a/conta/ingressos");
  assert.equal(active.seatInfo.row.defaultValue.value, "A");
  const before = enriched.status;
  enriched.status = "cancelled";
  assert.equal(baseline().state, "INACTIVE");
  enriched.status = before;
});
