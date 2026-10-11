import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createTicketFinanceView } = require('../backend/public/admin-modules/ticket-finance-view.js');

function fixture() {
  const elements = new Map();
  const calls = [];
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', innerHTML: '', disabled: false,
      classList: { toggle(name, value) { calls.push(['class', id, name, value]); } },
      addEventListener(name, callback) { calls.push(['listener', id, name, callback]); },
      setAttribute(name, value) { calls.push(['attribute', id, name, value]); },
      removeAttribute(name) { calls.push(['remove', id, name]); }
    });
    return elements.get(id);
  };
  const state = { ticketFinanceReport: null, dashboardFrom: '2026-10-01', dashboardTo: '2026-10-31' };
  const report = { period: { start: '2026-10-01', end: '2026-10-31' }, movies: [{ id: 'm-1', title: '<Filme>' }],
    rules: { distributorPercent: 40, courtesyPercent: 30, clubTicketFee: 5 },
    totals: { quantity: 1, grossRevenue: 10, distributorCost: 4, cinemaNet: 6, retentionPercent: 60 },
    rows: [{ type: '<Inteira>', category: 'paid', quantity: 1, grossRevenue: 10, distributorCost: 4, cinemaNet: 6 }] };
  const view = createTicketFinanceView({ state, $, api: async (path) => { calls.push(['api', path]); return report; },
    adminCan: () => true, setDisabled: (id, value) => calls.push(['disabled', id, value]),
    showToast: (message) => calls.push(['toast', message]), escapeHtml: (value) => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    money: (value) => `R$ ${Number(value).toFixed(2)}`, document: { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } }, apiBase: 'https://example.test' });
  return { view, state, $, calls, report };
}

test('modulo carrega antes de admin.js e mantem um registro de listeners', async () => {
  const html = await fs.readFile(new URL('../backend/public/admin.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('admin-modules/ticket-finance-view.js') < html.indexOf('src="admin.js'));
  const { view, calls } = fixture();
  view.bindEvents();
  assert.equal(calls.filter(item => item[0] === 'listener').length, 7);
  assert.equal(new Set(calls.filter(item => item[0] === 'listener').map(item => `${item[1]}:${item[2]}`)).size, 7);
});

test('filtros, carregamento e renderizacao preservam contrato e escapam titulos', async () => {
  const { view, $, calls } = fixture();
  $('ticketFinanceMovie').value = 'm-1';
  assert.match(view.query(), /movieId=m-1/);
  await view.load();
  assert.ok(calls.some(item => item[0] === 'api' && item[1].includes('/api/admin/reports/ticket-distributor?')));
  assert.equal($('ticketFinanceQuantity').textContent, 1);
  assert.match($('ticketFinanceRows').innerHTML, /&lt;Inteira&gt;/);
  assert.doesNotMatch($('ticketFinanceRows').innerHTML, /<Inteira>/);
  $('ticketFinanceFrom').value = '2026-11-01';
  $('ticketFinanceTo').value = '2026-10-01';
  assert.throws(() => view.query(), /data final/);
});
