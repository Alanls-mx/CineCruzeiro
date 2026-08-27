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
assert.equal(payload.prestador.cnpj, "12345678000190");
assert.equal(payload.tomador.cpf, "12345678901");
assert.equal(payload.servico.valor_servicos, 30);
assert.equal(payload.servico.discriminacao, "Serviços do pedido CC-001");

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

console.log("Fiscal service tests: ok");
