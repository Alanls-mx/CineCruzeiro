import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createAdminSubscriptionPresenter } = require('../backend/services/adminSubscriptionPresenter');
const presenter = createAdminSubscriptionPresenter({
  refreshSubscriptionCredits: (_db, subscription) => subscription,
  clubSavingsSummary: () => ({ total: 3 }),
  subscriptionStatusLabel: () => 'Ativa',
  currentSubscriptionCredit: () => ({ id: 'credit-1' }),
  sanitizeUser: (user) => ({ id: user.id, name: user.name }),
  subscriptionSummary: (db, userId) => db.subscriptions.filter(item => item.userId === userId),
  enrichTicket: (_db, ticket) => ({ ...ticket, label: 'Ingresso' })
});

const db = {
  subscriptionPlans: [{ id: 'plan-1' }],
  subscriptions: [{ id: 'sub-1', planId: 'plan-1', userId: 'user-1', status: 'active', history: [{ action: 'created' }] }],
  users: [{ id: 'user-1', name: 'Cliente', passwordHash: 'private' }],
  subscriptionCredits: [{ id: 'credit-1' }],
  subscriptionUsage: [{ id: 'usage-1' }],
  subscriptionCycles: [{ id: 'cycle-1', subscriptionId: 'sub-1' }],
  subscriptionPayments: [{ id: 'payment-1', subscriptionId: 'sub-1' }],
  subscriptionCreditUnits: [{ id: 'unit-1', subscriptionId: 'sub-1', cycleId: 'cycle-1' }],
  subscriptionCreditRedemptions: [{ id: 'redemption-1', subscriptionId: 'sub-1', orderId: 'order-1' }],
  orders: [{ id: 'order-1' }, { id: 'order-2' }],
  tickets: [{ id: 'ticket-1', orderId: 'order-1' }, { id: 'ticket-2', orderId: 'order-2' }]
};

test('lista administrativa preserva planos, saldos e sanitizacao do cliente', () => {
  const result = presenter.list(db);
  assert.equal(result.subscriptions[0].statusLabel, 'Ativa');
  assert.deepEqual(result.subscriptions[0].user, { id: 'user-1', name: 'Cliente' });
  assert.equal(result.subscriptions[0].plan.id, 'plan-1');
  assert.deepEqual(result.credits, db.subscriptionCredits);
  assert.deepEqual(result.redemptions, db.subscriptionCreditRedemptions);
});

test('detalhe limita ingressos e pedidos aos resgates da assinatura', () => {
  const result = presenter.detail(db, 'sub-1');
  assert.equal(result.cycles[0].creditsIssued, 1);
  assert.deepEqual(result.tickets.map(item => item.id), ['ticket-1']);
  assert.deepEqual(result.orders.map(item => item.id), ['order-1']);
  assert.deepEqual(result.history, [{ action: 'created' }]);
  assert.equal(presenter.detail(db, 'missing'), null);
});
