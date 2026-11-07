import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('commercial reads preserve audience, status, cache and DTOs', { timeout: 30000 }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'cine-phase21-commercial-'));
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const dataFile = path.join(dir, 'db.json');
  const now = new Date().toISOString();
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  await writeFile(dataFile, JSON.stringify({
    settings: { adminTwoFactorRequired: false },
    users: [{ id: 'qa-owner', name: 'Administrador QA', email: 'qa-owner@example.test', role: 'owner', active: true, passwordHash: '' }],
    subscriptionPlans: [{ id: 'plan-active', name: 'Clube ativo', active: true, monthlyPrice: 25 }, { id: 'plan-hidden', name: 'Clube oculto', active: false }],
    orders: [{ id: 'read-order-1', saleMode: 'concession_counter', status: 'paid', paymentStatus: 'approved', customerName: 'Cliente sintético', totalPrice: 10,
      concessionItems: [{ id: 'item-1', name: 'Pipoca', quantity: 1, unitPrice: 10, finalPrice: 10 }], createdAt: now, paidAt: now }],
    payments: [{ id: 'payment-1', orderId: 'read-order-1', status: 'approved', method: 'pix', amount: 10, approvedAt: now }],
    movies: [], rooms: [], tickets: [], subscriptions: []
  }));
  const child = spawn(process.execPath, ['backend/server.js'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    env: { ...process.env, NODE_ENV: 'test', DATA_STORE: 'json', CINE_DATA_FILE: dataFile,
      PORT: String(port), BIND_HOST: '127.0.0.1', JWT_SECRET: 'phase21-commercial-local-secret',
      CINE_UPLOADS_DIR: path.join(dir, 'uploads'), CINE_EMAIL_ATTACHMENTS_DIR: path.join(dir, 'email'),
      CINE_TICKET_DOCUMENTS_DIR: path.join(dir, 'tickets'), MOVIE_IMAGE_MAINTENANCE_ENABLED: 'false',
      FRONTEND_URL: base, CINE_PUBLIC_BACKEND_URL: base,
      ADMIN_EMAIL: 'qa-owner@example.test', ADMIN_PASSWORD: 'Admin-commercial-2026!' }
  });
  let output = '';
  child.stdout.on('data', (data) => { output += data.toString(); });
  child.stderr.on('data', (data) => { output += data.toString(); });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`backend exited: ${output.slice(-1000)}`);
      try { ready = (await fetch(`${base}/api/health`)).ok; } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, output.slice(-1000));
    const get = async (url, cookie = '', options = {}) => {
      const response = await fetch(`${base}${url}`, { headers: cookie ? { Cookie: cookie } : {}, ...options });
      const raw = await response.text();
      return { response, body: raw && response.headers.get('content-type')?.includes('json') ? JSON.parse(raw) : raw };
    };
    const post = async (url, body) => fetch(`${base}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const plans = await get('/api/subscription-plans');
    assert.equal(plans.response.status, 200);
    assert.deepEqual(plans.body.map((plan) => plan.id), ['plan-active']);
    assert.equal(plans.response.headers.get('cache-control'), 'public, max-age=30, stale-while-revalidate=90');
    for (const route of ['/api/me/subscriptions', '/api/me/tickets']) assert.equal((await get(route)).response.status, 401, route);
    for (const route of ['/api/admin/subscription-plans', '/api/admin/subscriptions', '/api/orders', '/api/admin/concession-sales']) {
      assert.equal((await get(route)).response.status, 401, route);
    }
    const login = await post('/api/admin/login', { email: 'qa-owner@example.test', password: 'Admin-commercial-2026!' });
    assert.equal(login.status, 200);
    const adminCookie = (login.headers.get('set-cookie') || '').split(';')[0];
    assert.equal((await get('/api/admin/subscription-plans', adminCookie)).body.length, 2);
    assert.equal((await get('/api/admin/subscriptions', adminCookie)).response.status, 200);
    const orders = await get('/api/orders', adminCookie);
    assert.equal(orders.response.status, 200);
    assert.equal(orders.body[0].id, 'read-order-1');
    const detail = await get('/api/orders/read-order-1', adminCookie);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.order.id, 'read-order-1');
    assert.deepEqual(detail.body.tickets, []);
    assert.equal((await get('/api/orders/missing', adminCookie)).response.status, 404);
    const sales = await get(`/api/admin/concession-sales?date=${day}`, adminCookie);
    assert.equal(sales.response.status, 200, JSON.stringify(sales.body));
    assert.equal(sales.body.groups.length, 1);
    assert.equal(sales.body.groups[0].orders[0].items[0].name, 'Pipoca');
    const register = await post('/api/auth/register', { firstName: 'Ana', lastName: 'Silva', email: 'ana@example.test', password: 'Senha-forte-2026!' });
    assert.equal(register.status, 201);
    const customerCookie = (register.headers.get('set-cookie') || '').split(';')[0];
    assert.deepEqual((await get('/api/me/subscriptions', customerCookie)).body.subscriptions, []);
    const tickets = await get('/api/me/tickets', customerCookie);
    assert.equal(tickets.response.status, 200);
    assert.deepEqual(tickets.body, { tickets: [], upcoming: [], archived: [] });
    const navigation = await new Promise((resolve, reject) => {
      http.get(`${base}/api/me/tickets`, { headers: { Cookie: customerCookie, 'sec-fetch-mode': 'navigate', Accept: 'text/html' } }, (response) => {
        response.resume();
        response.on('end', () => resolve(response));
      }).on('error', reject);
    });
    assert.equal(navigation.statusCode, 303);
    assert.equal(navigation.headers['cache-control'], 'private, no-store, max-age=0');
  } finally {
    if (child.exitCode === null) { child.kill(); await new Promise((resolve) => child.once('exit', resolve)); }
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(dir, { recursive: true, force: true });
  }
});
