import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createAdminCustomerSearchService } = require('../backend/services/adminCustomerSearchService.js');
const search = createAdminCustomerSearchService({ adminRoles: () => new Set(['owner', 'operator']),
  sanitizeUser: ({ passwordHash, cpf, ...user }) => user });
const db = { users: [
  { id: 'older', role: 'customer', name: 'Joao da Silva', email: 'joao@example.test', phone: '(11) 98888-7777', cpf: '123.456.789-00', createdAt: '2026-01-01', passwordHash: 'secret' },
  { id: 'newer', role: 'operator', name: 'Joana', email: 'joana@example.test', updatedAt: '2026-02-01', passwordHash: 'secret' },
  { id: 'inactive', role: 'customer', name: 'Joao Inativo', email: 'inactive@example.test', active: false },
  { id: 'other', role: 'service', name: 'Joao Servico', email: 'service@example.test' }
] };

test('busca clientes e contas autorizadas com ordenacao e dados sanitizados', () => {
  assert.deepEqual(search.search(db, 'JOA').map((item) => item.id), ['newer', 'older']);
  assert.equal('passwordHash' in search.search(db, 'joao')[0], false);
  assert.equal('cpf' in search.search(db, 'joao')[0], false);
  assert.deepEqual(search.search(db, 'example.test').map((item) => item.id), ['newer', 'older']);
});

test('aceita acentos e busca numerica sem divulgar listagem vazia', () => {
  assert.deepEqual(search.search(db, 'João').map((item) => item.id), ['older']);
  assert.deepEqual(search.search(db, '9888').map((item) => item.id), ['older']);
  assert.deepEqual(search.search(db, '456789').map((item) => item.id), ['older']);
  assert.deepEqual(search.search(db, 'j'), []);
  assert.deepEqual(search.search(db, ''), []);
});
