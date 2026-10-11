import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCustomerAccountsView } = require('../backend/public/admin-modules/customer-accounts-view.js');

function fixture() {
  const elements = new Map();
  const calls = [];
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: '', checked: true, innerHTML: '', textContent: '', required: false,
      closest: () => ({ scrollIntoView() {} }) });
    return elements.get(id);
  };
  const state = { content: { users: [
    { id: 'staff', role: 'operator', name: 'Operador' },
    { id: 'one', role: 'customer', name: 'Ana Silva', email: 'ana@example.test', phone: '11988887777', cpf: '12345678900', active: true, emailVerified: true },
    { id: 'two', role: 'customer', name: 'Beto Souza', email: 'beto@example.test', active: true }
  ] }, creating: { customerUser: false }, selectedCustomerAccountId: 'one', customerAccountsPageSize: 1, customerAccountsPage: 1, customerAccountsSearch: '' };
  const view = createCustomerAccountsView({ state, $, api: async (path, options) => {
    calls.push(['api', path, options]);
    if (options.method === 'DELETE') return {};
    return { ...JSON.parse(options.body), id: 'new' };
  }, confirm: () => true, creationPlaceholder: () => 'Novo cliente',
  currentCustomerAccount: () => state.content.users.find((item) => item.id === state.selectedCustomerAccountId),
  escapeHtml: (value) => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  normalizedSearchText: (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
  removeAdminCollectionItem: (collection, id) => { state.content[collection] = state.content[collection].filter((item) => item.id !== id); },
  renderUsers: () => calls.push(['renderUsers']), setDisabled: () => {}, showSuccess: (...args) => calls.push(['success', ...args]),
  showToast: (...args) => calls.push(['toast', ...args]), syncCreationControl: () => {}, twoFactorDate: () => '10/10/2026',
  upsertAdminCollection: (collection, item) => { state.content[collection].push(item); } });
  return { state, $, calls, view };
}

test('carrega antes do painel e filtra somente clientes sem instalar listeners', async () => {
  const html = await fs.readFile(new URL('../backend/public/admin.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('admin-modules/customer-accounts-view.js') < html.indexOf('src="admin.js'));
  const { state, $, view } = fixture();
  view.renderCustomerUsers();
  assert.match($('customerUsersList').innerHTML, /Ana Silva/);
  assert.doesNotMatch($('customerUsersList').innerHTML, /Operador/);
  assert.equal($('customerUserName').value, 'Ana');
  assert.equal($('customerUserLastName').value, 'Silva');
  view.changeCustomerAccountsPage(1);
  assert.match($('customerUsersList').innerHTML, /Beto Souza/);
  state.customerAccountsSearch = '9888';
  assert.deepEqual(view.filteredCustomerAccounts().map((item) => item.id), ['one']);
});

test('salva conta comum e exclui sem modificar conta administrativa', async () => {
  const { state, $, calls, view } = fixture();
  view.newCustomerUser();
  $('customerUserName').value = 'Carla';
  $('customerUserLastName').value = 'Lima';
  $('customerUserEmail').value = 'carla@example.test';
  await view.saveCustomerUser({ preventDefault() {} });
  const create = calls.find((call) => call[0] === 'api');
  assert.equal(create[1], '/api/users');
  assert.equal(create[2].method, 'POST');
  assert.equal(JSON.parse(create[2].body).accountType, 'customer');
  assert.equal(state.selectedCustomerAccountId, 'new');
  await view.deleteCustomerUser();
  assert.equal(calls.find((call) => call[0] === 'api' && call[2].method === 'DELETE')[1], '/api/users/new');
  assert.equal(state.content.users.some((item) => item.id === 'staff'), true);
});
