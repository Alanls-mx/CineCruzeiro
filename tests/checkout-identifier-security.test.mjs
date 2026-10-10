import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
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
  const concessionSource = readFileSync(fileURLToPath(new URL("../backend/public/admin-modules/concession-sales-view.js", import.meta.url)), "utf8");
  assert.doesNotMatch(source, /onclick="[^"]*(?:openOrderView|openConcessionOrderDetail|toggleOrderMenu)\('\$\{escapeHtml\((?:order\.id|payment\.orderId)\)\}/);
  assert.doesNotMatch(concessionSource, /onclick="[^"]*(?:openOrderView|openConcessionOrderDetail|toggleOrderMenu)\('\$\{escapeHtml\((?:order\.id|payment\.orderId)\)\}/);
  assert.match(source, /data-admin-order-id="\$\{escapeHtml\(order\.id\)\}"/);
  assert.match(concessionSource, /data-admin-order-id="\$\{escapeHtml\(order\.id\)\}"/);
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

test("listas administrativas tratam IDs como dados, nao codigo inline", () => {
  const source = readFileSync(fileURLToPath(new URL("../backend/public/admin.js", import.meta.url)), "utf8");
  assert.doesNotMatch(source, /on(?:click|mouseenter|focus)="[^"\n]*\$\{/);
  for (const marker of [
    "data-point-print-action", "data-box-office-customer-id", "data-club-subscription-action",
    "data-integration-action", "data-webhook-action", "data-admin-select-kind", "data-tmdb-movie-id"
  ]) assert.ok(source.includes(marker), `Ação ${marker} deve usar atributo de dados.`);
  const escapeSource = source.slice(source.indexOf("function escapeHtml("), source.indexOf("function adminAssetUrl("));
  const escapeHtml = vm.runInNewContext(`${escapeSource}\nescapeHtml`);
  const maliciousId = `x');globalThis.injected=true;//"<img onerror=alert(1)>`;
  const button = `<button data-admin-select-id="${escapeHtml(maliciousId)}">Detalhes</button>`;
  assert.ok(button.includes("&#039;"));
  assert.ok(button.includes("&quot;"));
  assert.ok(button.includes("&lt;img"));
  assert.doesNotMatch(button, /onclick=|<img/);
});

test("painel e login funcionam sem JavaScript inline na CSP do backend", () => {
  const admin = readFileSync(fileURLToPath(new URL("../backend/public/admin.js", import.meta.url)), "utf8");
  const concession = readFileSync(fileURLToPath(new URL("../backend/public/admin-modules/concession-sales-view.js", import.meta.url)), "utf8");
  const promotions = readFileSync(fileURLToPath(new URL("../backend/public/admin-modules/promotions-view.js", import.meta.url)), "utf8");
  const ads = readFileSync(fileURLToPath(new URL("../backend/public/admin-modules/ads-view.js", import.meta.url)), "utf8");
  const movieCatalogEvents = readFileSync(fileURLToPath(new URL("../backend/public/admin-modules/movie-catalog-events.js", import.meta.url)), "utf8");
  const sessionTicketActions = readFileSync(fileURLToPath(new URL("../backend/public/admin-modules/session-ticket-actions.js", import.meta.url)), "utf8");
  const login = readFileSync(fileURLToPath(new URL("../backend/public/admin-login.html", import.meta.url)), "utf8");
  const server = readFileSync(fileURLToPath(new URL("../backend/server.js", import.meta.url)), "utf8");
  assert.doesNotMatch(admin, /\bon(?:click|change|input|error|load|submit|keydown|mouseover)\s*=\s*["']/i);
  assert.doesNotMatch(concession, /\bon(?:click|change|input|error|load|submit|keydown|mouseover)\s*=\s*["']/i);
  assert.doesNotMatch(promotions, /\bon(?:click|change|input|error|load|submit|keydown|mouseover)\s*=\s*["']/i);
  assert.doesNotMatch(ads, /\bon(?:click|change|input|error|load|submit|keydown|mouseover)\s*=\s*["']/i);
  assert.doesNotMatch(movieCatalogEvents, /\bon(?:click|change|input|error|load|submit|keydown|mouseover)\s*=\s*["']/i);
  assert.doesNotMatch(sessionTicketActions, /\bon(?:click|change|input|error|load|submit|keydown|mouseover)\s*=\s*["']/i);
  assert.doesNotMatch(login, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.match(login, /<script src="\.\/admin-login\.js" defer><\/script>/);
  assert.ok(readFileSync(fileURLToPath(new URL("../backend/public/admin-login.js", import.meta.url)), "utf8").includes('form.addEventListener("submit"'));
  assert.match(server, /"script-src 'self' https:\/\/sdk\.mercadopago\.com/);
  assert.match(server, /"script-src [^"\n]*https:\/\/static\.cloudflareinsights\.com/);
  assert.doesNotMatch(server, /"script-src [^"\n]*'unsafe-inline'/);
  assert.match(server, /"script-src-attr 'none'"/);
});

test("acoes delegadas mantem selecao, paginacao e impressao", () => {
  const source = readFileSync(fileURLToPath(new URL("../backend/public/admin.js", import.meta.url)), "utf8");
  const start = source.indexOf('  document.addEventListener("click", (event) => {', source.indexOf('showChartHintFromPoint(event.target)'));
  const end = source.indexOf('  document.addEventListener("keydown"', start);
  assert.ok(start > 0 && end > start);
  const calls = [];
  let handler;
  const context = {
    document: { addEventListener: (type, callback) => { if (type === "click") handler = callback; } },
    changeConcessionDailySalesPage: (delta) => calls.push(["daily", delta]),
    changeMovieSessionsPage() {}, changeIssuedTicketsPage() {}, changePaymentsPage() {},
    changeConcessionBreakdownPage() {}, changeCustomerAccountsPage() {},
    changeClubSubscriptionsPage() {}, changeClubUsagePage() {}, changeWebhookHistoryPage() {},
    activatePanel: (panel) => calls.push(["panel", panel]),
    setBoxOfficeTab() {}, createSessionFromDashboard() {}, openSessionEditor() {},
    clearSessionAutocorrectPreview() {}, applySessionAutocorrect() {},
    changeBoxOfficeCustomer() {}, scanNextTicket() {},
    revealCommercialCatalogToken() {}, copyCommercialCatalogToken() {},
    copyCommercialCatalogLink() {}, retryCrmDeadLetters() {}, generateCommercialCatalogToken() {},
    changeDashMoviePage: (delta) => calls.push(["page", delta]),
    changeDashSessionsPage() {}, changeDashTopProductsPage() {}, changeDashLatestOrdersPage() {},
    selectRoom: (id) => calls.push(["room", id]),
    selectTicket() {}, selectConcession() {}, selectPromotion() {}, selectAd() {}, selectUser() {}, selectCustomerAccount() {},
    printPhysicalTicket: (id) => calls.push(["print", id])
  };
  vm.runInNewContext(source.slice(start, end), context);
  assert.equal(typeof handler, "function");
  const click = (selector, dataset) => handler({ target: { closest: (candidate) => candidate === selector ? { dataset } : null } });
  click("[data-admin-select-kind][data-admin-select-id]", { adminSelectKind: "room", adminSelectId: "room-1" });
  click("[data-dash-pager][data-page-delta]", { dashPager: "movies", pageDelta: "1" });
  click("[data-point-print-action][data-point-print-id]", { pointPrintAction: "ticket", pointPrintId: "ticket-1" });
  click("[data-static-pager][data-page-delta]", { staticPager: "concession-daily-sales", pageDelta: "-1" });
  click("[data-admin-panel]", { adminPanel: "clubPanel" });
  assert.deepEqual(calls, [["room", "room-1"], ["page", 1], ["print", "ticket-1"], ["daily", -1], ["panel", "clubPanel"]]);
});
