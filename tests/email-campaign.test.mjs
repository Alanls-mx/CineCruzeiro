import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const emailService = require("../backend/services/emailService.js");

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
