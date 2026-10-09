import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import service from "../backend/services/checkoutIdentifier.js";

test("IDs de pagamento mantem valores antigos validos e rejeitam codigo em atributos", () => {
  assert.equal(service.checkoutIdentifier("sessao-1-1728512345000-aabbcc"), "sessao-1-1728512345000-aabbcc");
  for (const value of ["x');globalThis.injected=true;//", "a b", "<img>", "a&b", {}, "x".repeat(161)]) {
    assert.throws(() => service.checkoutIdentifier(value), { code: "INVALID_CHECKOUT_IDENTIFIER" });
  }
});

test("lista administrativa nao coloca IDs de pedidos em handlers inline", () => {
  const source = readFileSync(fileURLToPath(new URL("../backend/public/admin.js", import.meta.url)), "utf8");
  assert.doesNotMatch(source, /onclick="[^"]*(?:openOrderView|openConcessionOrderDetail|toggleOrderMenu)\('\$\{escapeHtml\((?:order\.id|payment\.orderId)\)\}/);
  assert.match(source, /data-admin-order-id="\$\{escapeHtml\(order\.id\)\}"/);
  const orderMenu = source.split("function toggleOrderMenu(")[1].split("function toggleEmailCampaignMenu(")[0];
  const campaignMenu = source.split("function toggleEmailCampaignMenu(")[1].split("async function copyTicketCode(")[0];
  assert.doesNotMatch(orderMenu, /onclick=/);
  assert.doesNotMatch(campaignMenu, /onclick=/);
  assert.match(orderMenu, /data-floating-order-action="view"/);
  assert.match(campaignMenu, /data-floating-campaign-action="edit"/);
  assert.match(source, /data-admin-campaign-id="\$\{escapeHtml\(item\.id\)\}"/);
  assert.doesNotMatch(source, /onclick="[^"]*copyTicketCode\('\$\{escapeHtml\(/);
  assert.match(source, /data-admin-ticket-action="copy" data-admin-ticket-value="\$\{escapeHtml\(/);
  const movieRows = source.split('$("moviesList").innerHTML = pagination.pageItems')[1].split('if (!options.preserveForm) fillMovieForm')[0];
  assert.doesNotMatch(movieRows, /on(?:click|dragstart|drop)="/);
  assert.match(movieRows, /data-movie-id="\$\{escapeHtml\(movie\.id\)\}"/);
  assert.doesNotMatch(source, /onclick="[^"]*(?:showSessionTickets|openSessionEditor|removeSession|openGlobalSessionEditor|openSessionDashboardDetail)\('\$\{escapeHtml\(/);
  assert.match(source, /data-admin-session-action="global-edit" data-admin-movie-id="\$\{escapeHtml\(entry\.movie\.id\)\}"/);
});
