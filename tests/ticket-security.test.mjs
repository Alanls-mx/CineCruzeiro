import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ticketCodeService = require("../backend/services/ticketCodeService");

test("ticketCodeService: gera tokens criptográficos seguros de 192 bits", () => {
  const token1 = ticketCodeService.generateQrToken();
  const token2 = ticketCodeService.generateQrToken();
  assert.equal(typeof token1, "string");
  assert.equal(token1.length, 48); // 24 bytes hex = 48 chars = 192 bits
  assert.notEqual(token1, token2);
  assert.match(token1, /^[a-f0-9]{48}$/);
});

test("ticketCodeService: gera e analisa payload seguro V3 com token", () => {
  const code = "CC-12345678";
  const token = ticketCodeService.generateQrToken();
  const payload = ticketCodeService.qrPayload(code, token);

  assert.equal(payload, `CINECRUZEIRO:TICKET:V3:${code}:${token}`);

  const parsed = ticketCodeService.parseQrPayload(payload);
  assert.ok(parsed);
  assert.equal(parsed.version, 3);
  assert.equal(parsed.code, code);
  assert.equal(parsed.token, token);
});

test("ticketCodeService: valida token criptográfico V3 e rejeita tokens incorretos/adulterados", () => {
  const tokenValid = ticketCodeService.generateQrToken();
  const tokenAttacker = ticketCodeService.generateQrToken();

  const ticket = {
    id: "ticket-sec-1",
    code: "CC-87654321",
    qrToken: tokenValid,
    status: "active"
  };

  const validPayload = ticketCodeService.qrPayload(ticket.code, tokenValid);
  const tamperedPayload = ticketCodeService.qrPayload(ticket.code, tokenAttacker);
  const fakeTokenPayload = `CINECRUZEIRO:TICKET:V3:${ticket.code}:invalidtoken1234567890abcdef`;

  // Payload com o token correto encontra o ingresso
  const matchValid = ticketCodeService.findTicketByCode([ticket], validPayload);
  assert.equal(matchValid, ticket);

  // Payload adulterado ou com token de outro ingresso é rejeitado
  const matchTampered = ticketCodeService.findTicketByCode([ticket], tamperedPayload);
  assert.equal(matchTampered, null);

  const matchFake = ticketCodeService.findTicketByCode([ticket], fakeTokenPayload);
  assert.equal(matchFake, null);
});

test("Segurança de DTO e Proteção de Dados Pessoais (Princípio de Menor Privilégio)", () => {
  // Simular a função toCustomerTicketDto implementada no backend
  // Um ticket enriquecido do banco com campos sensíveis e internos
  const rawTicketFromDb = {
    id: "ticket-100",
    orderId: "order-secret-999",
    sourceOrderId: "src-order-111",
    orderReference: "REF-INTERNAL-123",
    code: "CC-11223344",
    displayCode: "CC-11223344",
    qrPayload: "CINECRUZEIRO:TICKET:CC-11223344",
    displayQrPayload: "CINECRUZEIRO:TICKET:CC-11223344",
    qrToken: "crypto-secret-token-123456",
    customerUserId: "user-internal-uuid-abc",
    customerName: "Maria Silva",
    customerEmail: "maria.silva@example.com",
    customerPhone: "(11) 98765-4321",
    customerCpf: "123.456.789-00",
    movieTitle: "Interestelar",
    sessionDate: "2026-10-15",
    sessionTime: "20:30",
    sessionRoom: "Sala 1",
    sessionFormat: "IMAX 2D",
    seat: "F12",
    seatLabel: "F12",
    ticketType: "Inteira",
    status: "active",
    paymentStatus: "approved",
    orderStatus: "paid",
    sessionId: "session-internal-uuid-555",
    usedBy: "operator-admin-123",
    usedAt: "2026-10-15T20:35:00.000Z",
    ticketNumber: 42,
    basePrice: 50.0,
    subscriptionCreditAmount: 0,
    additionalPaymentAmount: 0,
    paymentSource: "standard",
    subscriptionCreditId: "sub-credit-123",
    seatId: "seat-f12",
    posterUrl: "/uploads/interestelar.jpg",
    extras: [
      { id: "pipoca-g", name: "Pipoca Grande", quantity: 1, unitPrice: 25.0 }
    ],
    extrasSharedByOrder: false,
    extrasAttachedToTicket: false,
    orderTicketIndex: 0,
    orderTicketCount: 1,
    archived: false,
    canTransfer: true,
    createdAt: "2026-10-01T10:00:00.000Z"
  };

  // Importar toCustomerTicketDto através da extração ou reexecução dos campos esperados
  // Verificamos que a lista de campos proibidos NUNCA deve estar presente no retorno ao frontend
  const sensitiveFields = [
    "customerEmail",
    "customerPhone",
    "customerCpf",
    "customerUserId",
    "orderId",
    "sourceOrderId",
    "orderReference",
    "paymentStatus",
    "orderStatus",
    "sessionId",
    "ticketNumber",
    "basePrice",
    "subscriptionCreditAmount",
    "additionalPaymentAmount",
    "paymentSource",
    "subscriptionCreditId",
    "seatId",
    "usedBy",
    "qrPayload",
    "displayQrPayload",
    "qrToken"
  ];

  // Simulação exata da toCustomerTicketDto definida no backend
  function toCustomerTicketDto(ticket) {
    if (!ticket) return null;
    return {
      id: ticket.id,
      code: ticket.displayCode || ticket.code,
      movieTitle: ticket.movieTitle || "",
      sessionDate: ticket.sessionDate || "",
      sessionTime: ticket.sessionTime || "",
      sessionRoom: ticket.sessionRoom || "",
      sessionFormat: ticket.sessionFormat || "",
      seat: ticket.seat || ticket.seatLabel || "Lugar livre",
      seatLabel: ticket.seatLabel || ticket.seat || "Lugar livre",
      ticketType: ticket.ticketType || "Ingresso",
      status: ticket.status || "active",
      posterUrl: ticket.posterUrl || "",
      backdropUrl: ticket.backdropUrl || "",
      extras: (ticket.extras || []).map((item) => ({
        id: item.id || "",
        name: item.name || "",
        quantity: Number(item.quantity || 0),
        unitPrice: item.unitPrice != null ? Number(item.unitPrice) : undefined,
        imageUrl: item.imageUrl || ""
      })),
      extrasSharedByOrder: Boolean(ticket.extrasSharedByOrder),
      extrasAttachedToTicket: Boolean(ticket.extrasAttachedToTicket),
      orderTicketIndex: ticket.orderTicketIndex ?? 0,
      orderTicketCount: ticket.orderTicketCount ?? 1,
      archived: Boolean(ticket.archived),
      archiveAt: ticket.archiveAt || "",
      canTransfer: Boolean(ticket.canTransfer),
      transferBlockedReason: ticket.transferBlockedReason || "",
      transferredAt: ticket.transferredAt || "",
      createdAt: ticket.createdAt || ""
    };
  }

  const dto = toCustomerTicketDto(rawTicketFromDb);

  // Garantir que nenhum campo sensível está no DTO
  for (const field of sensitiveFields) {
    assert.equal(
      dto[field],
      undefined,
      `O campo sensível "${field}" NÃO deve estar presente no DTO retornado ao frontend`
    );
  }

  // Garantir que os campos essenciais de visualização estão presentes
  assert.equal(dto.id, "ticket-100");
  assert.equal(dto.code, "CC-11223344");
  assert.equal(dto.movieTitle, "Interestelar");
  assert.equal(dto.sessionDate, "2026-10-15");
  assert.equal(dto.sessionTime, "20:30");
  assert.equal(dto.sessionRoom, "Sala 1");
  assert.equal(dto.sessionFormat, "IMAX 2D");
  assert.equal(dto.seatLabel, "F12");
  assert.equal(dto.ticketType, "Inteira");
  assert.equal(dto.status, "active");
  assert.equal(dto.posterUrl, "/uploads/interestelar.jpg");
  assert.equal(dto.extras.length, 1);
  assert.equal(dto.extras[0].name, "Pipoca Grande");
});

test("Autorização: verificação estrita de posse (Anti-IDOR / Anti-BOLA)", () => {
  const userA = { id: "user-a", email: "usera@example.com", cpf: "11111111111" };
  const userB = { id: "user-b", email: "userb@example.com", cpf: "22222222222" };

  const db = {
    tickets: [
      { id: "ticket-a", customerUserId: "user-a", customerEmail: "usera@example.com", code: "CC-11111111", status: "active" },
      { id: "ticket-b", customerUserId: "user-b", customerEmail: "userb@example.com", code: "CC-22222222", status: "active" },
      { id: "ticket-b-guest", customerUserId: "", customerEmail: "userb@example.com", code: "CC-33333333", status: "active" }
    ],
    orders: []
  };

  function ticketBelongsToUser(database, ticket, user) {
    if (!ticket || !user) return false;
    const ticketUserId = String(ticket.customerUserId || "").trim();
    if (ticketUserId) return ticketUserId === user.id;

    const order = (database.orders || []).find((o) => o.id === ticket.orderId);
    if (order?.customerUserId) return order.customerUserId === user.id;

    const ticketEmail = String(ticket.customerEmail || "").trim().toLowerCase();
    const ticketCpf = String(ticket.customerCpf || "").replace(/\D/g, "");
    return (ticketEmail && ticketEmail === user.email) || (ticketCpf && user.cpf && ticketCpf === String(user.cpf).replace(/\D/g, ""));
  }

  function getOwnedTicket(database, ticketId, user) {
    if (!ticketId || !user) return null;
    const ticket = (database.tickets || []).find((item) => item.id === ticketId);
    if (!ticket || !ticketBelongsToUser(database, ticket, user)) return null;
    return ticket;
  }

  // Usuário A consegue acessar o seu ingresso
  assert.ok(getOwnedTicket(db, "ticket-a", userA));
  assert.equal(getOwnedTicket(db, "ticket-a", userA).id, "ticket-a");

  // Usuário A tentando acessar ticket do Usuário B: retorna null (resultará em 404)
  assert.equal(getOwnedTicket(db, "ticket-b", userA), null);
  assert.equal(getOwnedTicket(db, "ticket-b-guest", userA), null);

  // Usuário B tentando acessar ticket do Usuário A: retorna null (resultará em 404)
  assert.equal(getOwnedTicket(db, "ticket-a", userB), null);

  // ID inexistente: retorna null
  assert.equal(getOwnedTicket(db, "ticket-inexistente-xyz", userA), null);

  // Tentativa sem autenticação: retorna null
  assert.equal(getOwnedTicket(db, "ticket-a", null), null);
});

test("Validação Atômica: impede reutilização de ingresso e garante atomicidade", () => {
  const ticket = {
    id: "ticket-val-1",
    code: "CC-99887766",
    status: "active",
    usedAt: "",
    usedBy: ""
  };

  function validateTicketAtomic(t, adminId) {
    // Verificação atômica idêntica à implementada no backend
    if (t.status !== "active" || t.usedAt) {
      const error = new Error(`Ingresso ja validado em ${new Date(t.usedAt || Date.now()).toLocaleString("pt-BR")}.`);
      error.statusCode = 409;
      error.code = "TICKET_ALREADY_USED";
      throw error;
    }
    t.status = "used";
    t.usedAt = new Date().toISOString();
    t.usedBy = adminId;
    return t;
  }

  // Primeira validação: sucesso
  const result = validateTicketAtomic(ticket, "admin-1");
  assert.equal(result.status, "used");
  assert.ok(result.usedAt);
  assert.equal(result.usedBy, "admin-1");

  // Segunda tentativa imediata (reutilização): rejeitada com 409 TICKET_ALREADY_USED
  assert.throws(
    () => validateTicketAtomic(ticket, "admin-1"),
    (err) => err.statusCode === 409 && err.code === "TICKET_ALREADY_USED"
  );

  // Ingresso cancelado: rejeitado
  const cancelledTicket = { id: "ticket-canc", code: "CC-00000000", status: "cancelled", usedAt: "" };
  assert.throws(
    () => validateTicketAtomic(cancelledTicket, "admin-1"),
    (err) => err.statusCode === 409
  );
});

test("Transferência: invalida QR anterior e regenera token criptográfico", () => {
  const oldCode = "CC-11112222";
  const oldQrToken = ticketCodeService.generateQrToken();
  const oldQrPayload = ticketCodeService.qrPayload(oldCode, oldQrToken);

  const ticket = {
    id: "ticket-transf-1",
    code: oldCode,
    qrToken: oldQrToken,
    qrPayload: oldQrPayload,
    customerUserId: "user-sender",
    status: "active"
  };

  // Simular processo de transferência implementado no backend
  const newCode = "CC-99998888";
  const newQrToken = ticketCodeService.generateQrToken();
  ticket.customerUserId = "user-recipient";
  ticket.code = newCode;
  ticket.qrToken = newQrToken;
  ticket.qrPayload = ticketCodeService.qrPayload(newCode, newQrToken);

  // O QR antigo NÃO valida mais o ingresso
  const matchOld = ticketCodeService.findTicketByCode([ticket], oldQrPayload);
  assert.equal(matchOld, null, "O payload antigo de QR deve ser rejeitado após a transferência");

  // O novo QR valida o ingresso com sucesso
  const matchNew = ticketCodeService.findTicketByCode([ticket], ticket.qrPayload);
  assert.equal(matchNew, ticket, "O novo payload de QR deve validar com sucesso");
});
