const assert = require("assert/strict");
const fiscalService = require("../backend/services/fiscalService");

const order = {
  id: "pedido-fiscal-001",
  reference: "CC-001",
  status: "paid",
  customerName: "Cliente Fiscal",
  customerEmail: "cliente@example.com",
  customerPhone: "(11) 99999-9999",
  customerCpf: "123.456.789-01",
  totalPrice: 45,
  concessionItems: [{ id: "pipoca", name: "Pipoca", quantity: 1, unitPrice: 15 }]
};

const config = {
  enabled: true,
  environment: "sandbox",
  apiToken: "token-test",
  cnpj: "12.345.678/0001-90",
  municipalRegistration: "12345",
  municipalityCode: "3550308",
  nationalTaxCode: "120200",
  serviceListItem: "12.02",
  municipalTaxCode: "1202",
  natureOperation: "1",
  serviceDescription: "Serviços do pedido {{pedido}}",
  simpleNational: true,
  issWithheld: false,
  includeConcessionsInServiceAmount: false
};

assert.match(fiscalService.referenceForOrder(order.id), /^CC[A-F0-9]{24}$/);
assert.equal(fiscalService.referenceForOrder(order.id), fiscalService.referenceForOrder(order.id));
assert.equal(fiscalService.concessionAmount(order), 15);
assert.equal(fiscalService.serviceAmount(order, config), 30);
assert.equal(fiscalService.serviceAmount(order, { ...config, includeConcessionsInServiceAmount: true }), 45);

const document = fiscalService.createDocument(order, config, { autoIssued: true });
assert.equal(document.status, "queued");
assert.equal(document.serviceAmount, 30);
assert.equal(document.customerTaxId, "12345678901");

const payload = fiscalService.buildPayload(order, document, config);
assert.equal(payload.cnpj_prestador, "12345678000190");
assert.equal(payload.cpf_tomador, "12345678901");
assert.equal(payload.valor_servico, 30);
assert.equal(payload.descricao_servico, "Serviços do pedido CC-001");
assert.equal(payload.codigo_municipio_emissora, "3550308");
assert.equal(payload.codigo_municipio_prestacao, "3550308");
assert.equal(payload.codigo_tributacao_nacional_iss, "120200");
assert.equal(payload.codigo_opcao_simples_nacional, 3);
assert.equal(payload.tipo_retencao_iss, 1);
assert.equal(payload.data_competencia.length, 10);
assert.equal(payload.serie_dps, 1);
assert.match(payload.numero_dps, /^\d{1,15}$/);
assert.equal(payload.numero_dps, fiscalService.dpsNumberForDocument(document));
assert.equal(fiscalService.nationalTaxCode({ serviceListItem: "12.02" }), "120200");

fiscalService.applyProviderResult(document, {
  status: "autorizado",
  numero: "2026001",
  codigo_verificacao: "ABC123",
  url: "https://prefeitura.example/nfse/1",
  url_danfse: "https://example.com/nfse.pdf",
  caminho_xml_nota_fiscal: "arquivos/nfse.xml"
}, config);
assert.equal(document.status, "authorized");
assert.equal(document.invoiceNumber, "2026001");
assert.equal(document.verificationCode, "ABC123");
assert.match(document.xmlUrl, /^https:\/\/homologacao\.focusnfe\.com\.br\/v2\/arquivos\/nfse\.xml$/);

const incomplete = fiscalService.createDocument(order, { enabled: false }, {});
assert.equal(incomplete.status, "pending_configuration");
assert.match(incomplete.lastError, /Configuração fiscal incompleta/);

async function testNationalProviderRoutes() {
  const originalFetch = global.fetch;
  const calls = [];
  const responses = [
    { status: "processando_autorizacao", ref: document.reference },
    { status: "autorizado", numero: "2026002", codigo_verificacao: "NAC123" },
    { mensagem: "Para utilizar, ative a opção 'habilita_nfsen_producao' da empresa." }
  ];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const payload = responses.shift();
    const status = calls.length === 3 ? 422 : calls.length === 1 ? 202 : 200;
    return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
  };
  try {
    const routed = fiscalService.createDocument(order, config, {});
    await fiscalService.issue(routed, order, config);
    assert.match(calls[0].url, /\/v2\/nfsen\?ref=/);
    const sentPayload = JSON.parse(calls[0].options.body);
    assert.equal(sentPayload.codigo_tributacao_nacional_iss, "120200");
    assert.equal(sentPayload.prestador, undefined);

    await fiscalService.consult(routed, config);
    assert.match(calls[1].url, new RegExp(`/v2/nfsen/${routed.reference}$`));
    assert.equal(routed.status, "authorized");

    await assert.rejects(
      () => fiscalService.issue(fiscalService.createDocument(order, config, {}), order, config),
      /Ambiente da NFS-e Nacional – Homologação/
    );
  } finally {
    global.fetch = originalFetch;
  }
}

testNationalProviderRoutes()
  .then(() => console.log("Fiscal service tests: ok"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
