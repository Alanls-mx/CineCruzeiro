import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createTicketEmailWorker } = require('../backend/services/ticketEmailWorker');
async function waitFor(check) {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  throw new Error('worker timeout');
}

function memoryJobs() {
  const jobs = new Map();
  return {
    jobs,
    add(orderId) { jobs.set(orderId, { orderId, status: 'queued', attempts: 0, maxAttempts: 5, due: 0, leaseToken: '' }); },
    async claimNext() {
      const item = [...jobs.values()].find(job => job.status === 'queued' && job.due <= Date.now());
      if (!item) return null;
      Object.assign(item, { status: 'processing', attempts: item.attempts + 1, leaseToken: `${item.attempts + 1}` });
      return { ...item };
    },
    async heartbeat(job) { return jobs.get(job.orderId)?.leaseToken === job.leaseToken; },
    async complete(job, result) {
      const item = jobs.get(job.orderId);
      if (item?.leaseToken !== job.leaseToken) return false;
      Object.assign(item, { status: result.status, due: result.nextAttemptAt ? Date.parse(result.nextAttemptAt) : 0, leaseToken: '', error: result.error });
      return true;
    }
  };
}

test('pedido confirmado conclui uma entrega e dois workers nao duplicam o envio', async () => {
  const repository = memoryJobs();
  repository.add('order-1');
  let deliveries = 0;
  const deliver = async () => { deliveries++; await new Promise(resolve => setTimeout(resolve, 5)); return { status: 'delivered' }; };
  const first = createTicketEmailWorker({ repository, deliver });
  const second = createTicketEmailWorker({ repository, deliver });
  first.start(); second.start();
  await waitFor(() => repository.jobs.get('order-1').status === 'delivered');
  first.stop(); second.stop();
  assert.equal(deliveries, 1);
  assert.equal(repository.jobs.get('order-1').status, 'delivered');
});

test('falha temporaria agenda retentativa e entrega apos reinicio', async () => {
  const repository = memoryJobs();
  repository.add('order-2');
  let attempts = 0;
  const deliver = async () => ++attempts === 1 ? { status: 'retry', reason: 'SMTP_UNAVAILABLE' } : { status: 'delivered' };
  const first = createTicketEmailWorker({ repository, deliver });
  first.start(); await waitFor(() => repository.jobs.get('order-2').status === 'queued' && repository.jobs.get('order-2').attempts === 1); first.stop();
  assert.equal(repository.jobs.get('order-2').status, 'queued');
  assert.equal(repository.jobs.get('order-2').attempts, 1);
  repository.jobs.get('order-2').due = 0;
  const restarted = createTicketEmailWorker({ repository, deliver });
  restarted.start(); await waitFor(() => repository.jobs.get('order-2').status === 'delivered'); restarted.stop();
  assert.equal(repository.jobs.get('order-2').status, 'delivered');
  assert.equal(attempts, 2);
});

test('pedido cancelado nao e enviado e fica terminal', async () => {
  const repository = memoryJobs();
  repository.add('order-3');
  const worker = createTicketEmailWorker({ repository, deliver: async () => ({ status: 'cancelled', reason: 'order_not_paid' }) });
  worker.start(); await waitFor(() => repository.jobs.get('order-3').status === 'cancelled'); worker.stop();
  assert.equal(repository.jobs.get('order-3').status, 'cancelled');
});

test('falha de confirmacao local preserva lease para recuperacao e rechecagem', async () => {
  const repository = memoryJobs();
  repository.add('order-4');
  const complete = repository.complete;
  let failOnce = true;
  repository.complete = async (...args) => {
    if (failOnce) { failOnce = false; throw new Error('database unavailable'); }
    return complete(...args);
  };
  let deliveredExternally = false;
  let sends = 0;
  const deliver = async () => {
    if (deliveredExternally) return { status: 'delivered', reason: 'already_delivered' };
    sends++; deliveredExternally = true;
    return { status: 'delivered' };
  };
  const first = createTicketEmailWorker({ repository, deliver });
  first.start(); await waitFor(() => deliveredExternally && repository.jobs.get('order-4').status === 'processing');
  await new Promise(resolve => setTimeout(resolve, 5)); first.stop();
  assert.equal(repository.jobs.get('order-4').status, 'processing');
  repository.jobs.get('order-4').status = 'queued';
  const restarted = createTicketEmailWorker({ repository, deliver });
  restarted.start(); await waitFor(() => repository.jobs.get('order-4').status === 'delivered'); restarted.stop();
  assert.equal(repository.jobs.get('order-4').status, 'delivered');
  assert.equal(sends, 1);
});
