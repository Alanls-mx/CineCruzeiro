import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createRoomListView } = require('../backend/public/admin-modules/room-list-view.js');

function fixture(rooms = []) {
  const state = { content: { rooms }, creating: { room: false }, selectedRoomId: rooms[0]?.id || '' };
  const list = { innerHTML: '' };
  const view = createRoomListView({
    state, $: () => list, creationPlaceholder: (title) => `CREATE ${title}`,
    paginateAdminItems: (items) => ({ pageItems: items }),
    renderAdminListPager: () => 'PAGER',
    escapeHtml: (value) => String(value ?? '').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  });
  return { state, list, view };
}

test('room list loads before admin and preserves empty/create states', async () => {
  const html = await fs.readFile(new URL('../backend/public/admin.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('admin-modules/room-list-view.js') < html.indexOf('src="admin.js'));
  const { state, list, view } = fixture();
  view.renderRoomList();
  assert.match(list.innerHTML, /Nenhuma sala cadastrada/);
  state.creating.room = true;
  view.renderRoomList();
  assert.equal(list.innerHTML, 'CREATE Nova sala');
});

test('room list keeps selection, pagination and escapes persisted labels', () => {
  const { list, view } = fixture([{ id: 'room-1', name: '<Sala>', capacity: 8, technology: 'Laser', status: 'active' }]);
  view.renderRoomList();
  assert.match(list.innerHTML, /class="list-item active"/);
  assert.match(list.innerHTML, /&lt;Sala&gt;/);
  assert.match(list.innerHTML, /8 lugares/);
  assert.match(list.innerHTML, /data-admin-select-kind="room"/);
  assert.match(list.innerHTML, /PAGER$/);
});

test('room save updates the shared collection only after the API responds', async () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '' });
    return elements.get(id);
  };
  const state = { content: { rooms: [], movies: [], orders: [], tickets: [] }, creating: { room: true },
    roomSeatDraft: { enabled: false, seatTypes: [], screenLabel: 'TELA', rows: [] } };
  $('roomName').value = 'Sala QA';
  $('roomCapacity').value = '80';
  $('roomCleanupMinutes').value = '20';
  $('roomStatus').value = 'active';
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const calls = [];
  const view = createRoomListView({ state, $,
    api: async (path, options) => { calls.push([path, options]); return pending; },
    upsertAdminCollection: (key, item) => { state.content[key].push(item); },
    renderRooms: () => {}, renderRoomOptions: () => {}, renderGlobalSessions: () => {},
    updateSessionScheduleSuggestion: () => {}, showToast: () => {}
  });
  const save = view.saveRoom({ preventDefault() {} });
  assert.equal(state.content.rooms.length, 0);
  assert.equal(calls[0][0], '/api/rooms');
  assert.equal(JSON.parse(calls[0][1].body).cleanupMinutes, 20);
  release({ id: 'room', name: 'Sala QA' });
  await save;
  assert.equal(state.content.rooms.length, 1);
  assert.equal(state.selectedRoomId, 'room');
});
