import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createTicketDocumentPdfService } = require("../backend/services/ticketDocumentPdfService");
const { brazilianDate } = require("../backend/utils/dateFormat");
const path = require("node:path");
const crypto = require("node:crypto");
const QRCode = require("qrcode");
const sharp = require("sharp");

function service() {
  return createTicketDocumentPdfService({
    backendDir: path.resolve("backend"),
    fs: { readFile: async () => null, mkdir: async () => {}, writeFile: async () => {} },
    path, crypto, QRCode, sharp,
    storageService: { rootDir: path.resolve("backend/public/uploads") },
    stripPublicAssetBase: (value) => value,
    pathIsInside: () => false,
    movieForTicket: () => null,
    slugify: (value) => String(value || ""),
    downloadPublicBuffer: async () => { throw new Error("unexpected remote image"); },
    enrichTicket: (_db, ticket) => ticket,
    brazilianDate,
    methodLabel: (value) => value
  });
}

const ticket = {
  id: "ticket", orderId: "order", code: "ABC", displayCode: "ABC",
  displayQrPayload: "synthetic-qr-payload", status: "active",
  movieTitle: "Synthetic Film", sessionDate: "2026-11-06", sessionTime: "19:00",
  sessionRoom: "Room 1", sessionFormat: "2D", seat: "A1", ticketType: "Inteira", customerName: "João Silva"
};

test("PDF active ticket includes entry QR and archived ticket suppresses access code", async () => {
  const pdf = service();
  const active = (await pdf.ticketDownloadPdf({}, ticket)).toString("latin1");
  const archived = (await pdf.ticketDownloadPdf({}, { ...ticket, status: "archived" })).toString("latin1");
  assert.match(active, /^%PDF-1\.4/);
  assert.match(active, /Apresente este codigo na entrada/);
  assert.match(active, /Jo\\343o Silva/);
  assert.doesNotMatch(active, /QR Code desativado/);
  assert.match(archived, /QR Code desativado/);
  assert.doesNotMatch(archived, /Apresente este codigo na entrada/);
});

test("thermal ticket and concession receipt remain valid PDFs", () => {
  const pdf = service();
  const thermal = pdf.ticketThermalPdf({}, [ticket]).toString("latin1");
  const concession = pdf.concessionThermalPdf({ id: "order", totalPrice: 5, concessionItems: [{ quantity: 1, name: "Pipoca", price: 5 }] }, { method: "pix" }).toString("latin1");
  assert.match(thermal, /^%PDF-1\.4/);
  assert.match(thermal, /INGRESSO -VIA PDV/);
  assert.match(thermal, /CLIENTE: Jo\\343o Silva/);
  assert.match(concession, /^%PDF-1\.4/);
  assert.match(concession, /BOMBONIERE - VIA PDV/);
});
