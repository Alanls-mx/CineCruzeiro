import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMovieSessionsView } = require('../backend/public/admin-modules/movie-sessions-view.js');

function fixture() {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '' });
    return elements.get(id);
  };
  const sessions = [
    { id: 'late', date: '2026-10-12', time: '21:55', status: 'active', format: '2D', room: 'Sala 1', capacity: 10 },
    { id: 'early', date: '2026-10-11', time: '15:05', status: 'active', format: '2D', room: 'Sala 1', capacity: 10 }
  ];
  const state = { movieSessionsPage: 1, movieSessionsPageSize: 1, content: { tickets: [
    { sessionId: 'early', status: 'active' }, { sessionId: 'early', status: 'cancelled' }
  ] } };
  const view = createMovieSessionsView({ state, $, currentMovie: () => ({ sessions }),
    escapeHtml: (value) => String(value ?? '').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    globalSessionStatusLabel: () => 'Ativa', money: () => 'R$ 10,00',
    sessionTicketTypes: () => [{ name: 'Inteira', price: 10 }], trashIcon: 'X' });
  return { state, $, sessions, view };
}

test('modulo inicia antes do painel, sem registrar listeners', async () => {
  const html = await fs.readFile(new URL('../backend/public/admin.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('admin-modules/movie-sessions-view.js') < html.indexOf('src="admin.js'));
  const { $, sessions, view } = fixture();
  view.renderSessions(sessions);
  assert.match($('sessionsList').innerHTML, /15:05/);
  assert.doesNotMatch($('sessionsList').innerHTML, /21:55/);
  assert.match($('sessionsList').innerHTML, /1\/10 vendidos/);
  assert.match($('sessionsList').innerHTML, /data-admin-session-action="edit"/);
  view.changeMovieSessionsPage(1);
  assert.match($('sessionsList').innerHTML, /21:55/);
  assert.doesNotMatch($('sessionsList').innerHTML, /15:05/);
});

test('estado vazio conserva ação para criar primeira sessão', () => {
  const { $, view } = fixture();
  view.renderSessions([]);
  assert.match($('sessionsList').innerHTML, /Salvar rascunho e adicionar sessão/);
  $('movieId').value = 'movie';
  view.renderSessions([]);
  assert.match($('sessionsList').innerHTML, /Adicionar primeira sessão/);
});
