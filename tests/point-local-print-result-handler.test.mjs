import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createPointLocalPrintResultHandler } = require('../backend/services/pointLocalPrintResultHandler.js');

function fixture({ body = { ok: true, jobId: 'job-1' }, commitFails = false } = {}) {
  const events = [];
  const db = {
    payments: [{ id: 'payment-1', status: 'approved', metadata: { kind: 'point_sale' } }],
    orders: [{ id: 'order-1', status: 'paid_pending_print', pointPrint: { mode: 'local', jobId: 'job-1' } }],
    tickets: []
  };
  const handler = createPointLocalPrintResultHandler({
    readBody: async () => body,
    withCriticalMutation: async (callback) => callback(),
    readDb: async () => db,
    writeDb: async () => {
      events.push('commit');
      if (commitFails) throw new Error('commit failed');
    },
    sendJson: (_res, status, payload) => events.push({ status, payload }),
    pointPaymentOrders: (current) => current.orders,
    orderTickets: (current, id) => current.tickets.filter((ticket) => ticket.orderId === id),
    finalizePrintedOrders: (current, orders) => {
      orders[0].status = 'paid';
      current.tickets.push({ id: 'ticket-1', orderId: orders[0].id });
      return { orders, tickets: current.tickets, newlyPaidOrders: orders };
    },
    logEvent: () => events.push('audit')
  });
  const run = (method = 'POST') => handler({
    req: { adminUser: { id: 'operator' } }, res: {},
    pathname: '/api/box-office/point-payments/payment-1/print-result', method
  });
  return { db, events, run };
}

test('local print confirmation responds only after its write and is idempotent', async () => {
  const state = fixture();
  assert.equal(await state.run(), true);
  assert.deepEqual(state.events.slice(0, 2), ['commit', 'audit']);
  assert.equal(state.events[2].status, 200);
  assert.equal(state.events[2].payload.completed, true);
  assert.equal(state.db.tickets.length, 1);
  assert.equal(await state.run(), true);
  assert.equal(state.db.tickets.length, 1);
  assert.equal(state.events.filter((event) => event === 'commit').length, 1);
});

test('failed local printing keeps rights pending and records failure before response', async () => {
  const state = fixture({ body: { ok: false, jobId: 'job-1', message: 'No paper' } });
  await state.run();
  assert.equal(state.db.orders[0].status, 'paid_pending_print');
  assert.equal(state.db.tickets.length, 0);
  assert.equal(state.events[0], 'commit');
  assert.equal(state.events[2].payload.printFailed, true);
  assert.equal(state.db.orders[0].pointPrint.status, 'failed');
});

test('stale job and failed commit cannot respond with completed sale', async () => {
  const stale = fixture({ body: { ok: true, jobId: 'old-job' } });
  await stale.run();
  assert.equal(stale.events[0].status, 409);
  assert.equal(stale.db.tickets.length, 0);
  const failed = fixture({ commitFails: true });
  await assert.rejects(failed.run(), /commit failed/);
  assert.equal(failed.events.some((event) => typeof event === 'object'), false);
  assert.equal(await failed.run('GET'), false);
});
