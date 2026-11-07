import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClubSubscriptionSummary } = require('../backend/services/clubSubscriptionSummary.js');

test('resume somente o Clube do cliente, preservando uso, saldos e atualização prévia', () => {
  const refreshed = [];
  const summarize = createClubSubscriptionSummary({
    refreshSubscriptionCredits: (_db, subscription) => { refreshed.push(subscription.id); subscription.creditsAvailable = 2; },
    currentSubscriptionCredit: () => ({ total: 3, cycleStart: '2099-01-01', cycleEnd: '2099-02-01' }),
    shortOrderReference: () => 'PED-1',
    clubDomainService: { creditCounts: () => ({ available: 2, reserved: 0, redeemed: 1, expired: 0 }) },
    reservedFreeConcessionQuantity: () => 1,
    subscriptionStatusLabel: () => 'Ativa',
    isManualSubscription: () => false,
    clubSavingsSummary: () => 8.5,
    subscriptionCanUseCredit: () => true
  });
  const db = {
    subscriptions: [
      { id: 'sub-1', userId: 'cliente-1', planId: 'plano-1', status: 'active', cycleEnd: '2099-02-01' },
      { id: 'sub-2', userId: 'cliente-2', planId: 'plano-1', status: 'active' }
    ],
    subscriptionPlans: [{ id: 'plano-1', freeConcessionItems: [{ concessionId: 'pipoca', quantity: 2 }] }],
    subscriptionUsage: [{ subscriptionId: 'sub-1', orderId: 'pedido-1', ticketId: 'ingresso-1', movieId: 'filme-1' }],
    subscriptionCreditUnits: [{ subscriptionId: 'sub-1' }, { subscriptionId: 'sub-1' }, { subscriptionId: 'sub-1' }],
    orders: [{ id: 'pedido-1', movieId: 'filme-1' }],
    tickets: [{ id: 'ingresso-1', orderId: 'pedido-1', basePrice: 10, additionalPaymentAmount: 1.5, sessionDate: '2099-01-15', sessionTime: '20:00' }],
    movies: [{ id: 'filme-1', title: 'Filme sintético' }],
    concessions: [{ id: 'pipoca', name: 'Pipoca', imageUrl: '/pipoca.png' }]
  };
  const result = summarize(db, 'cliente-1');
  assert.deepEqual(refreshed, ['sub-1']);
  assert.equal(result.length, 1);
  assert.equal(result[0].creditsRemaining, 2);
  assert.equal(result[0].creditsUsed, 1);
  assert.equal(result[0].usage[0].savings, 8.5);
  assert.equal(result[0].usage[0].orderReference, 'PED-1');
  assert.deepEqual(result[0].freeItems[0], { concessionId: 'pipoca', name: 'Pipoca', included: 2, used: 1, remaining: 1, imageUrl: '/pipoca.png' });
  assert.equal(result[0].paymentRequired, true);
  assert.equal(result[0].nextBillingAt, '2099-02-01');
});
