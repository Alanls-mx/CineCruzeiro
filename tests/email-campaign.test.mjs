import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const emailService = require("../backend/services/emailService.js");

test("anexos aceitam apenas arquivos armazenados na raiz privada", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cine-email-attachments-"));
  const allowed = path.join(root, "email-anexo-seguro.txt");
  const outside = path.join(path.dirname(root), "cine-email-fora-da-raiz.txt");
  const previousRoot = process.env.CINE_EMAIL_ATTACHMENTS_DIR;
  try {
    await fs.writeFile(allowed, "conteudo permitido");
    await fs.writeFile(outside, "conteudo privado");
    process.env.CINE_EMAIL_ATTACHMENTS_DIR = root;

    const attachments = await emailService._test.prepareAttachments([
      { path: allowed, filename: "permitido.txt" },
      { path: outside, filename: "bloqueado.txt" },
      { path: path.join(root, "..", path.basename(outside)), filename: "travessia.txt" },
      { content: Buffer.from("conteudo direto"), filename: "direto.txt" }
    ]);

    assert.deepEqual(attachments.map((item) => item.filename), ["permitido.txt", "direto.txt"]);
    assert.equal(attachments[0].content.toString("utf8"), "conteudo permitido");
    assert.equal(attachments[1].content.toString("utf8"), "conteudo direto");
    assert.equal(attachments.every((item) => item.path === undefined), true);
  } finally {
    if (previousRoot === undefined) delete process.env.CINE_EMAIL_ATTACHMENTS_DIR;
    else process.env.CINE_EMAIL_ATTACHMENTS_DIR = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { force: true });
  }
});

test("campanha personaliza variáveis sem permitir HTML no nome", () => {
  const result = emailService._test.interpolateCampaign("Olá {{nome}} · {{codigo_cupom}}", {
    name: "<Alan>",
    couponCode: "CINE20"
  });
  assert.equal(result, "Olá &lt;Alan&gt; · CINE20");
});

test("campanha resolve cupom selecionado e placeholders personalizados", () => {
  const result = emailService._test.interpolateCampaign("{{nome}} · {{codigo_cupom}} · {{link_programacao}}", {
    name: "Alan",
    couponCode: "CINE20"
  }, {
    link_programacao: "https://example.com/programacao"
  });
  assert.equal(result, "Alan · CINE20 · https://example.com/programacao");
});

test("dados do destinatário e do cupom prevalecem sobre variáveis reservadas", () => {
  const result = emailService._test.interpolateCampaign("{{nome}} · {{codigo_cupom}}", { name: "Alan", couponCode: "CINE20" }, { nome: "Outro", codigo_cupom: "FALSO" });
  assert.equal(result, "Alan · CINE20");
});

test("placeholders de conteúdo combinam dados do cliente e da oferta", () => {
  const result = emailService._test.interpolateCampaign(
    "Oi {{primeiro_nome}} · {{nome_filme}} · {{preco_plano}} · {{publico_oferta}}",
    { name: "Alan Luiz da Silva", email: "alan@example.com" },
    { nome_filme: "Toy Story 5", preco_plano: "R$ 39,90/mês", publico_oferta: "Clientes ativos" }
  );
  assert.equal(result, "Oi Alan · Toy Story 5 · R$ 39,90/mês · Clientes ativos");
});

test("HTML de campanha remove scripts, eventos e esquemas perigosos", () => {
  const result = emailService._test.sanitizeCampaignHtml('<script>alert(1)</script><a href="javascript:alert(1)" onclick="x()">Abrir</a>');
  assert.equal(result.includes("<script"), false);
  assert.equal(result.includes("onclick"), false);
  assert.equal(result.includes("javascript:"), false);
});

test("layout de marketing preserva identidade e descadastro", () => {
  const result = emailService._test.baseLayout("Oferta", "<p>Conteúdo</p>", {
    kind: "marketing",
    unsubscribeUrl: "https://example.com/unsubscribe",
    brand: { name: "Cine Cruzeiro", footer: "Fale com o cinema." }
  });
  assert.match(result, /Fale com o cinema/);
  assert.match(result, /Não desejo receber mais emails/);
  assert.match(result, /unsubscribe/);
});

test("logo de campanha usa URL absoluta e fundo transparente", () => {
  const result = emailService._test.baseLayout("Oferta", "<p>Conteúdo</p>", {
    logoUrl: "/images/favicon-email.png",
    siteUrl: "https://example.com/projects/cinecruzeiro",
    brand: { name: "Cine Cruzeiro" }
  });
  assert.match(result, /https:\/\/example\.com\/projects\/cinecruzeiro\/images\/favicon-email\.png/);
  assert.match(result, /favicon-email\.png[^>]+background-color:transparent/);
  assert.doesNotMatch(result, /favicon-email\.png[^>]+background-color:#060a12/);
});

test("HTML salvo com a logo antiga é reparado antes do envio", () => {
  const result = emailService._test.repairCampaignBrandLogoHtml(
    '<img src="https://example.com/projects/cinecruzeiro/images/logo-display.webp" style="display:block;background-color:#09111f">',
    "https://example.com/projects/cinecruzeiro"
  );
  assert.match(result, /images\/favicon-email\.png/);
  assert.match(result, /background-color:transparent/);
  assert.doesNotMatch(result, /logo-display\.webp|background-color:#09111f/);
});

test("campanha renderiza imagem local com link e texto alternativo", () => {
  const result = emailService._test.campaignImageBlock({
    imageUrl: "/uploads/email-campaign/poster.webp",
    imageAlt: "Pôster do filme",
    imageLink: "/filmes/homem-aranha",
    siteUrl: "https://example.com/projects/cinecruzeiro"
  });
  assert.match(result, /https:\/\/example\.com\/projects\/cinecruzeiro\/uploads\/email-campaign\/poster\.webp/);
  assert.match(result, /Pôster do filme/);
  assert.match(result, /https:\/\/example\.com\/projects\/cinecruzeiro\/filmes\/homem-aranha/);
  assert.match(result, /background-color:#0d1728/);
  assert.equal(emailService._test.campaignImageBlock({ imageUrl: "javascript:alert(1)", siteUrl: "https://example.com" }), "");
});

test("layout de campanha aplica cores válidas sem aceitar CSS arbitrário", () => {
  const result = emailService._test.baseLayout("Oferta", "<p>Conteúdo</p>", {
    headlineColor: "#ffcc00",
    textColor: "#dbeafe"
  });
  assert.match(result, /color:#ffcc00/);
  assert.match(result, /color:#dbeafe/);
  assert.doesNotMatch(result, /javascript:/i);
});

test("compatibilidade legada preserva a ordem dos blocos no e-mail enviado", () => {
  const result = emailService._test.renderCampaignContentBlocks([
    { id: "title", type: "heading", content: "Olá {{nome}}", align: "center", color: "#ffcc00", fontSize: 30 },
    { id: "poster", type: "image", url: "/uploads/email-campaign/poster.webp", alt: "Pôster", width: 55 },
    { id: "copy", type: "text", content: "Cupom {{codigo_cupom}}", align: "left", color: "#dbeafe" },
    { id: "cta", type: "button", content: "Comprar", url: "/filmes", backgroundColor: "#facc15", color: "#020617" }
  ], { siteUrl: "https://example.com/projects/cinecruzeiro", variables: {} }, { name: "Alan", couponCode: "CINE20" });

  assert.ok(result.indexOf("Olá Alan") < result.indexOf("poster.webp"));
  assert.ok(result.indexOf("poster.webp") < result.indexOf("Cupom CINE20"));
  assert.match(result, /width:55%/);
  assert.match(result, /background:#facc15/);
  assert.match(result, /projects\/cinecruzeiro\/filmes/);
});

test("blocos legados escapam conteúdo e rejeitam links perigosos", () => {
  const result = emailService._test.renderCampaignContentBlocks([
    { type: "text", content: "<script>alert(1)</script>" },
    { type: "button", content: "Abrir", url: "javascript:alert(1)" },
    { type: "social", links: [{ label: "Rede", url: "javascript:alert(1)" }] }
  ], { siteUrl: "https://example.com" }, {});

  assert.doesNotMatch(result, /<script/i);
  assert.doesNotMatch(result, /javascript:/i);
  assert.doesNotMatch(result, />Abrir</);
});

test("texto alternativo legado acompanha a composição dos blocos", () => {
  const result = emailService._test.campaignBlocksText([
    { type: "heading", content: "Oferta para {{nome}}" },
    { type: "button", content: "Ver programação", url: "/filmes" }
  ], { name: "Alan" }, {});
  assert.match(result, /Oferta para Alan/);
  assert.match(result, /Ver programação: \/filmes/);
});
