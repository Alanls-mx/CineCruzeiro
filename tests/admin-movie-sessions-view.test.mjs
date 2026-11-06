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

test('salvar sessão mantém um único POST e libera o formulário após commit ou falha', async () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: '', selectedOptions: [], disabled: false });
    return elements.get(id);
  };
  $('movieId').value = 'movie';
  $('sessionDate').value = '2026-11-10';
  $('sessionTime').value = '21:55';
  $('sessionRoom').value = 'Sala 1';
  $('sessionRoom').selectedOptions = [{ dataset: { roomId: 'room' } }];
  $('sessionFormat').value = '2D';
  $('sessionStatus').value = 'available';
  $('sessionCreationMode').value = 'single';
  const state = { content: { tickets: [], orders: [] }, editingSessionId: '', savingSession: false };
  const requests = [];
  let fail = false;
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const notices = [];
  const errors = [];
  const view = createMovieSessionsView({ state, $,
    document: { querySelectorAll: () => [{ value: 'full' }] },
    api: async (path, options) => { requests.push([path, options]); if (fail) throw new Error('falha sintética'); return pending; },
    setDisabled: (id, disabled) => { $(id).disabled = disabled; },
    closeSessionEditor: () => {}, applySessionMutation: () => {}, renderMovies: () => {},
    setMovieWizardStep: () => {}, showSuccess: (...args) => notices.push(args), showToast: (...args) => errors.push(args)
  });
  const first = view.saveSession();
  await view.saveSession();
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], '/api/movies/movie/sessions');
  assert.equal(requests[0][1].method, 'POST');
  assert.equal(JSON.parse(requests[0][1].body).roomId, 'room');
  assert.equal($('saveSessionButton').disabled, true);
  finish({ id: 'session', date: '2026-11-10', time: '21:55' });
  await first;
  assert.equal(state.savingSession, false);
  assert.equal($('saveSessionButton').disabled, false);
  assert.equal(notices.length, 1);
  fail = true;
  await view.saveSession();
  assert.equal(state.savingSession, false);
  assert.equal($('saveSessionButton').disabled, false);
  assert.deepEqual(errors[0], ['falha sintética', 'error']);
});
