import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mercadoPago = require('../backend/services/paymentService.js');
const pagBank = require('../backend/services/pagBankPaymentService.js');

test('Mercado Pago exige token de cartão antes de acessar o provedor', async () => {
  const previousMode = process.env.PAYMENTS_MODE;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.PAYMENTS_MODE = '';
  process.env.NODE_ENV = 'development';
  try {
    await assert.rejects(mercadoPago.createMercadoPagoOrderPayment(
      { id: 'card-token-missing', totalPrice: 10, customerName: 'Cliente Teste', customerEmail: 'cliente@example.invalid' },
      { environment: 'production', accessToken: 'APP_USR_synthetic_only' },
      { method: 'credit_card', card: { paymentMethodId: 'visa' } }
    ), { code: 'CARD_TOKEN_REQUIRED', statusCode: 422 });
  } finally {
    if (previousMode === undefined) delete process.env.PAYMENTS_MODE; else process.env.PAYMENTS_MODE = previousMode;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('PagBank exige cartão criptografado antes de acessar o provedor', async () => {
  const previousMode = process.env.PAYMENTS_MODE;
  process.env.PAYMENTS_MODE = '';
  try {
    await assert.rejects(pagBank.createOrderPayment({ id: 'card-encrypted-missing', totalPrice: 10 },
      { environment: 'sandbox', accessToken: 'synthetic-only' }, { method: 'credit_card' }),
    { code: 'PAGBANK_ENCRYPTED_CARD_REQUIRED', statusCode: 422 });
  } finally {
    if (previousMode === undefined) delete process.env.PAYMENTS_MODE; else process.env.PAYMENTS_MODE = previousMode;
  }
});

test('PagBank recusa Order com referência ou valor divergente e não infere aprovação', async () => {
  const previousMode = process.env.PAYMENTS_MODE;
  const originalFetch = global.fetch;
  process.env.PAYMENTS_MODE = '';
  const order = { id: 'synthetic-order', totalPrice: 10, customerName: 'Cliente Teste',
    customerEmail: 'cliente@example.invalid', customerCpf: '12345678909' };
  let reference = 'different-order';
  let cents = 1000;
  global.fetch = async () => ({ ok: true, json: async () => ({ id: 'ORDE_SYNTHETIC', reference_id: reference,
    charges: [{ id: 'CHAR_SYNTHETIC', status: 'PAID', amount: { value: cents }, payment_method: { type: 'CREDIT_CARD' } }] }) });
  try {
    const options = { method: 'credit_card', card: { encrypted: 'synthetic-encrypted-card' }, idempotencyKey: 'synthetic-operation' };
    const config = { environment: 'sandbox', accessToken: 'synthetic-only' };
    await assert.rejects(pagBank.createOrderPayment(order, config, options), { code: 'PAGBANK_ORDER_RESPONSE_INVALID' });
    reference = order.id;
    cents = 1100;
    await assert.rejects(pagBank.createOrderPayment(order, config, options), { code: 'PAGBANK_ORDER_RESPONSE_INVALID' });
    cents = 1000;
    const confirmed = await pagBank.createOrderPayment(order, config, options);
    assert.equal(confirmed.status, 'approved');
  } finally {
    global.fetch = originalFetch;
    if (previousMode === undefined) delete process.env.PAYMENTS_MODE; else process.env.PAYMENTS_MODE = previousMode;
  }
});

test('PagBank distingue autorização, recusa, cancelamento e reembolso da Order', () => {
  const order = (status) => pagBank.normalizeOrder({ id: 'ORDE_SYNTHETIC', reference_id: 'synthetic-order',
    charges: [{ id: 'CHAR_SYNTHETIC', status, amount: { value: 1000 } }] });
  assert.equal(order('AUTHORIZED').status, 'processing');
  assert.equal(order('DECLINED').status, 'rejected');
  assert.equal(order('CANCELED').status, 'cancelled');
  assert.equal(order('REFUNDED').status, 'refunded');
  assert.equal(order('WAITING').status, 'pending');
});
