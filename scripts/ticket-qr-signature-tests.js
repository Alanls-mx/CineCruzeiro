const assert = require("assert/strict");
const { webcrypto } = require("crypto");
const service = require("../backend/services/ticketQrSignatureService");

async function run() {
  service.resetForTests();
  const ticket = {
    id: "ticket-assinado-1",
    code: "CC-ABCDEF1234567890",
    sessionId: "sessao-1",
    movieId: "filme-1",
    ticketNumber: 42,
    sessionDate: "2026-09-01",
    sessionTime: "19:00",
    createdAt: "2026-09-01T12:00:00.000Z"
  };
  const qrPayload = service.signTicket(ticket);
  assert.match(qrPayload, /^CC2\./);
  assert.deepEqual(service.verify(qrPayload), {
    v: 2, k: service.publicConfig().kid, t: ticket.id, c: ticket.code, s: ticket.sessionId,
    m: ticket.movieId, n: ticket.ticketNumber, i: 1788264000, e: 1788314400
  });
  const [prefix, encoded, signature] = qrPayload.split(".");
  const tampered = `${prefix}.${encoded.slice(0, -1)}${encoded.endsWith("A") ? "B" : "A"}.${signature}`;
  assert.equal(service.verify(tampered), null);

  const key = await webcrypto.subtle.importKey("jwk", service.publicConfig().jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const browserCompatible = await webcrypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    Buffer.from(signature, "base64url"),
    new TextEncoder().encode(`${prefix}.${encoded}`)
  );
  assert.equal(browserCompatible, true);
  console.log("Ticket QR signature tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
