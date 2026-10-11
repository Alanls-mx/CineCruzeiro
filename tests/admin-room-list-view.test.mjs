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
