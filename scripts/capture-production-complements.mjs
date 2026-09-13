import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);
const BASE = "https://lumixengine.com/projects/cinecruzeiro";
const outputDir = path.resolve(process.argv[2] || "apresentacao-cine-cruzeiro-demonstracao-4k-v2");
const popplerDir = path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin");
const pdftoppm = path.join(popplerDir, "pdftoppm.exe");

const stdin = await new Promise((resolve, reject) => {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => resolve(input));
  process.stdin.on("error", reject);
});
const auth = JSON.parse(String(stdin || process.env.CINE_CAPTURE_AUTH_JSON || "{}"));
for (const key of ["jwtSecret", "customer", "admin"]) {
  if (!auth[key]) throw new Error(`CAPTURE_AUTH_REQUIRED:${key}`);
}

function signedValue(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", auth.jwtSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function sessionCookie(user, admin = false) {
  return {
    name: admin ? "cine_admin" : "cine_customer",
    value: signedValue({
      sub: user.id,
      role: user.role,
      email: user.email,
      sv: Number(user.sessionVersion || 0),
      exp: Date.now() + 4 * 60 * 60 * 1000,
      ...(admin ? { amr: ["pwd", "otp"] } : {})
    }),
    domain: "lumixengine.com",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax"
  };
}

const purposes = {
  "R01-checkout-ingressos-autenticado.png": "Mostra a seleção autenticada de ingresso e a quantidade que será emitida para a sessão escolhida.",
  "R02-mapa-poltronas.png": "Mostra o mapa real da sala, a numeração por fileira, a disponibilidade e a poltrona selecionada pelo cliente.",
  "R03-checkout-extras.png": "Mostra os itens de bomboniere disponíveis, suas quantidades e a composição do pedido antes do pagamento.",
  "R04-checkout-pagamento-pix.png": "Mostra a opção Pix, o cupom, os benefícios e créditos do Clube e o resumo conciliado antes de gerar a cobrança.",
  "R04b-checkout-pagamento-cartao.png": "Mostra o formulário seguro de cartão do Mercado Pago carregado dentro do checkout.",
  "R04c-checkout-clube-creditos.png": "Detalha a aplicação independente de benefícios e créditos do Clube e a prioridade contábil sobre os ingressos.",
  "R05-checkout-confirmacao.png": "Mostra a confirmação de um pedido já aprovado, sem criar uma nova cobrança para a captura.",
  "R06-ingresso-com-bomboniere.png": "Mostra um ingresso ativo da conta com os produtos de bomboniere efetivamente vinculados ao pedido.",
  "R07-bomboniere-entrega-concluida.png": "Mostra o estado concluído da entrega de bomboniere registrado no servidor após a conferência operacional.",
  "R10-pdf-ingresso-pagina-1.png": "Primeira página do PDF real do ingresso, com filme, sessão, poltrona e QR Code.",
  "R10b-pdf-ingresso-pagina-2.png": "Segunda página do PDF real do ingresso, com identificação, status e bomboniere vinculada.",
  "R11-pdf-pdv-pedido.png": "Comprovante térmico real do pedido para PDV, identificado pelo sistema como documento não fiscal."
};

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const customer = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
const admin = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
for (const context of [customer, admin]) {
  await context.addInitScript(() => localStorage.setItem("cine-cruzeiro-measurement-consent", "denied"));
}
await customer.addCookies([sessionCookie(auth.customer)]);
await admin.addCookies([sessionCookie(auth.admin, true)]);
const customerPage = await customer.newPage();
const adminPage = await admin.newPage();
const manifest = [];

async function settle(page, ms = 850) {
  await page.waitForLoadState("domcontentloaded", { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function redact(page) {
  await page.evaluate(({ names, emails, codes }) => {
    const replacements = [
      ...names.filter(Boolean).map((value) => [value, "Cliente de demonstração"]),
      ...emails.filter(Boolean).map((value) => [value, "cliente@exemplo.com"]),
      ...codes.filter(Boolean).map((value) => [value, "CC-********"])
    ].sort((a, b) => b[0].length - a[0].length);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      let value = walker.currentNode.nodeValue || "";
      for (const [from, to] of replacements) value = value.split(from).join(to);
      walker.currentNode.nodeValue = value
        .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "cliente@exemplo.com")
        .replace(/\bCC-[A-Z0-9-]{5,}\b/g, "CC-********")
        .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "***.***.***-**")
        .replace(/\b\d{11}\b/g, "***********");
    }
  }, {
    names: [auth.customer.name || "", auth.admin.name || ""],
    emails: [auth.customer.email || "", auth.admin.email || ""],
    codes: [auth.entryTicketCode || "", auth.completedConcessionCode || ""]
  });
}

async function capture(page, filename, title, selector = "") {
  const essentialOnly = page.getByRole("button", { name: "Somente essenciais" });
  if (await essentialOnly.isVisible().catch(() => false)) await essentialOnly.click();
  if (selector) await page.locator(selector).first().scrollIntoViewIfNeeded().catch(() => {});
  await redact(page);
  await page.waitForTimeout(250);
  const destination = path.join(outputDir, filename);
  await page.screenshot({ path: destination, fullPage: false, animations: "disabled" });
  const metadata = await sharp(destination).metadata();
  if (Number(metadata.width || 0) < 3840 || Number(metadata.height || 0) < 2160) {
    throw new Error(`LOW_RESOLUTION:${filename}:${metadata.width}x${metadata.height}`);
  }
  manifest.push({ filename, title, purpose: purposes[filename], width: metadata.width, height: metadata.height, url: page.url() });
}

async function assertCustomerSession() {
  await customerPage.goto(`${BASE}/conta`, { waitUntil: "domcontentloaded" });
  await settle(customerPage);
  if (await customerPage.getByRole("heading", { name: "Acesse seus ingressos" }).isVisible().catch(() => false)) {
    throw new Error("CUSTOMER_SESSION_INVALID");
  }
}

async function checkoutPath() {
  if (auth.checkoutSessionId) return `/checkout/${encodeURIComponent(auth.checkoutSessionId)}`;
  await customerPage.goto(`${BASE}/filmes`, { waitUntil: "domcontentloaded" });
  await settle(customerPage);
  const movieLink = await customerPage.locator('a[href*="/filmes/"]').first().getAttribute("href");
  if (!movieLink) throw new Error("NO_PUBLIC_MOVIE_FOR_CHECKOUT");
  await customerPage.goto(new URL(movieLink, BASE).href, { waitUntil: "domcontentloaded" });
  await settle(customerPage);
  const href = await customerPage.locator('a[href*="/checkout/"]').first().getAttribute("href");
  if (!href) throw new Error("NO_ACTIVE_SESSION_FOR_CHECKOUT");
  return new URL(href, BASE).pathname.replace("/projects/cinecruzeiro", "");
}

await assertCustomerSession();
const checkout = await checkoutPath();
await customerPage.goto(`${BASE}${checkout}`, { waitUntil: "domcontentloaded" });
await settle(customerPage, 1300);
const addTicket = customerPage.getByRole("button", { name: "+" }).first();
if (await addTicket.isVisible().catch(() => false)) await addTicket.click();
await customerPage.waitForTimeout(800);
await capture(customerPage, "R01-checkout-ingressos-autenticado.png", "Checkout - seleção autenticada de ingressos");

const availableSeat = customerPage.getByRole("button", { name: /^[A-Z]+\d+,\s/i }).first();
if (await availableSeat.isVisible().catch(() => false)) {
  await availableSeat.click();
  await customerPage.waitForTimeout(650);
}
await capture(customerPage, "R02-mapa-poltronas.png", "Checkout - mapa e seleção de poltronas", "#seat-selection-title");

const extrasLink = customerPage.getByRole("link", { name: /Continuar para Extras/i }).first();
if (!(await extrasLink.isVisible().catch(() => false))) throw new Error("SEAT_SELECTION_NOT_COMPLETED");
await extrasLink.click();
await settle(customerPage, 900);
const addExtra = customerPage.getByRole("button", { name: "+" }).first();
if (await addExtra.isVisible().catch(() => false)) await addExtra.click();
await customerPage.waitForTimeout(400);
await capture(customerPage, "R03-checkout-extras.png", "Checkout - seleção de bomboniere");

await customerPage.getByRole("button", { name: /Continuar para Pagamento/i }).click();
await settle(customerPage, 1400);
await customerPage.getByRole("button", { name: "Pix", exact: true }).click().catch(() => {});
await capture(customerPage, "R04-checkout-pagamento-pix.png", "Checkout - pagamento por Pix");
if (await customerPage.getByText("Benefícios do Clube", { exact: true }).isVisible().catch(() => false)) {
  const credit = customerPage.getByText(/Usar \d+ crédito\(s\) do Clube/i).first();
  const checkbox = credit.locator("xpath=ancestor::label[1]//input");
  if (await checkbox.isVisible().catch(() => false) && !(await checkbox.isChecked())) await checkbox.check();
  await customerPage.waitForTimeout(1100);
  await capture(customerPage, "R04c-checkout-clube-creditos.png", "Checkout - cupom, benefícios e créditos do Clube", "text=Benefícios do Clube");
}
await customerPage.getByRole("button", { name: "Cartão", exact: true }).click();
await customerPage.waitForTimeout(2500);
const cardForm = customerPage.locator('[id^="card-payment-brick-"] iframe, [id^="card-payment-brick-"] form, [id^="card-payment-brick-"] input').first();
if (!(await cardForm.isVisible().catch(() => false))) throw new Error("MERCADO_PAGO_CARD_FORM_NOT_LOADED");
await capture(customerPage, "R04b-checkout-pagamento-cartao.png", "Checkout - cartão Mercado Pago", '[id^="card-payment-brick-"]');

if (!auth.approvedOrderId) throw new Error("CAPTURE_AUTH_REQUIRED:approvedOrderId");
const approvedResult = await customer.request.get(`${BASE}/api/checkout/orders/${encodeURIComponent(auth.approvedOrderId)}`);
if (!approvedResult.ok()) throw new Error(`APPROVED_ORDER_UNAVAILABLE:${approvedResult.status()}`);
const approved = await approvedResult.json();
const approvedSessionId = approved.order?.sessionId;
if (!approvedSessionId) throw new Error("APPROVED_ORDER_WITHOUT_SESSION");
await customerPage.goto(`${BASE}/checkout/${encodeURIComponent(approvedSessionId)}/confirmacao`, { waitUntil: "domcontentloaded" });
await customerPage.evaluate(({ result, sessionId }) => {
  localStorage.setItem("cine-cruzeiro-checkout-draft-v1", JSON.stringify({
    movieId: result.order.movieId,
    sessionId,
    fullTickets: Number(result.order.fullTicketsCount || 0),
    halfTickets: Number(result.order.halfTicketsCount || 0),
    ticketQuantities: Object.fromEntries((result.order.ticketItems || []).map((item) => [item.id, item.quantity])),
    selectedSeatIds: result.order.selectedSeatIds || [],
    concessionQuantities: Object.fromEntries((result.order.concessionItems || []).map((item) => [item.id || item.concessionId, item.quantity])),
    extrasVisited: true,
    paymentMethod: String(result.payment?.method || "pix").includes("card") ? "credit_card" : "pix",
    paymentResult: result
  }));
}, { result: approved, sessionId: approvedSessionId });
await customerPage.reload({ waitUntil: "domcontentloaded" });
await settle(customerPage, 1600);
await capture(customerPage, "R05-checkout-confirmacao.png", "Checkout - pagamento aprovado");

await customerPage.goto(`${BASE}/conta/ingressos`, { waitUntil: "domcontentloaded" });
await settle(customerPage, 1300);
if (!(await customerPage.getByText(/Bomboniere/i).first().isVisible().catch(() => false))) throw new Error("TICKET_WITH_CONCESSIONS_NOT_FOUND");
await capture(customerPage, "R06-ingresso-com-bomboniere.png", "Minha conta - ingresso com bomboniere", "text=Bomboniere");

if (!auth.completedConcessionCode) throw new Error("CAPTURE_AUTH_REQUIRED:completedConcessionCode");
await adminPage.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await settle(adminPage, 1600);
await adminPage.locator("body.admin-booting").waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
await adminPage.locator('.nav-button[data-panel="concessionsPanel"]').click();
await adminPage.locator('#concessionsPanel [data-concession-tab="validateQr"]').click();
await adminPage.evaluate(async (code) => {
  window.stopQrReader?.();
  window.setTicketValidationMode?.("concessions");
  await window.validateTicketByCode(code);
}, auth.completedConcessionCode);
await adminPage.waitForTimeout(900);
await capture(adminPage, "R07-bomboniere-entrega-concluida.png", "Admin - entrega de bomboniere concluída", "#ticketValidationResult");

async function downloadPdf(context, url, destination) {
  const response = await context.request.get(url);
  if (!response.ok()) throw new Error(`PDF_DOWNLOAD_FAILED:${response.status()}:${url}`);
  await fs.writeFile(destination, await response.body());
}

async function renderPdf(pdfPath, prefix) {
  await run(pdftoppm, ["-png", "-scale-to-x", "3840", "-scale-to-y", "-1", pdfPath, prefix]);
  return (await fs.readdir(path.dirname(prefix)))
    .filter((name) => name.startsWith(path.basename(prefix)) && name.endsWith(".png"))
    .sort()
    .map((name) => path.join(path.dirname(prefix), name));
}

async function redactPdfRaster(source, destination, regions) {
  const metadata = await sharp(source).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const overlays = regions.map(([left, top, regionWidth, regionHeight]) => {
    const x = Math.round(left * width);
    const y = Math.round(top * height);
    const w = Math.round(regionWidth * width);
    const h = Math.round(regionHeight * height);
    return {
      input: Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="12" fill="#111827"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" fill="#cbd5e1" font-family="Arial" font-size="${Math.max(18, Math.round(w / 18))}" font-weight="700">DADO PROTEGIDO</text></svg>`),
      left: x,
      top: y
    };
  });
  await sharp(source).composite(overlays).png().toFile(destination);
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cinecruzeiro-pdf-"));
try {
  if (!auth.ticketWithConcessionsId) throw new Error("CAPTURE_AUTH_REQUIRED:ticketWithConcessionsId");
  const ticketPdf = path.join(tempDir, "ingresso.pdf");
  await downloadPdf(customer, `${BASE}/api/me/tickets/${encodeURIComponent(auth.ticketWithConcessionsId)}/download?view=1`, ticketPdf);
  const ticketPages = await renderPdf(ticketPdf, path.join(tempDir, "ingresso"));
  if (ticketPages.length < 2) throw new Error("TICKET_PDF_EXPECTED_TWO_PAGES");
  await redactPdfRaster(ticketPages[0], path.join(outputDir, "R10-pdf-ingresso-pagina-1.png"), [
    [0.35, 0.63, 0.30, 0.23],
    [0.73, 0.47, 0.21, 0.08]
  ]);
  await redactPdfRaster(ticketPages[1], path.join(outputDir, "R10b-pdf-ingresso-pagina-2.png"), [
    [0.11, 0.32, 0.40, 0.21]
  ]);
  for (const [index, filename] of ["R10-pdf-ingresso-pagina-1.png", "R10b-pdf-ingresso-pagina-2.png"].entries()) {
    const meta = await sharp(path.join(outputDir, filename)).metadata();
    manifest.push({ filename, title: `PDF do ingresso - página ${index + 1}`, purpose: purposes[filename], width: meta.width, height: meta.height, url: "PDF autenticado" });
  }

  const pdvPdf = path.join(tempDir, "pedido-pdv.pdf");
  await downloadPdf(admin, `${BASE}/api/admin/orders/${encodeURIComponent(auth.approvedOrderId)}/print`, pdvPdf);
  const pdvPages = await renderPdf(pdvPdf, path.join(tempDir, "pedido-pdv"));
  await redactPdfRaster(pdvPages[0], path.join(outputDir, "R11-pdf-pdv-pedido.png"), [
    [0.12, 0.31, 0.76, 0.34]
  ]);
  const pdvMeta = await sharp(path.join(outputDir, "R11-pdf-pdv-pedido.png")).metadata();
  manifest.push({ filename: "R11-pdf-pdv-pedido.png", title: "PDF do pedido para PDV", purpose: purposes["R11-pdf-pdv-pedido.png"], width: pdvMeta.width, height: pdvMeta.height, url: "PDF administrativo autenticado" });
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}

await fs.writeFile(path.join(outputDir, "COMPLEMENTOS.md"), [
  "# Capturas complementares da produção",
  "",
  `Geradas em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} a partir de ${BASE}.`,
  "Nenhuma cobrança foi criada para estas capturas. A confirmação reutiliza um pedido aprovado pertencente à conta de demonstração.",
  "O PDF de PDV é um comprovante não fiscal; o sistema não apresenta uma NFC-e inexistente.",
  "",
  ...manifest.flatMap((item) => [
    `## ${item.title}`,
    "",
    `- Arquivo: \`${item.filename}\``,
    `- Resolução: ${item.width} x ${item.height} px`,
    `- Função: ${item.purpose}`,
    ""
  ])
].join("\n"), "utf8");

await browser.close();
console.log(`CAPTURED=${manifest.length}`);
console.log(`OUTPUT=${outputDir}`);
