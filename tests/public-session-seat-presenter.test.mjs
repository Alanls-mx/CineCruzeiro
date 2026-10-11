import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createPublicSessionSeatPresenter } = require('../backend/services/publicSessionSeatPresenter.js');
const presenter = createPublicSessionSeatPresenter({ roomSeats: (room) => (room?.seatLayout?.rows || []).flatMap((row) => row.seats), roomSeatTypes: (room) => room?.seatTypes || [] });
const room = { id: 'r1', name: 'Sala 1', capacity: 4, seatTypes: [{ id: 'regular' }], seatLayout: { screenLabel: 'TELA', rows: [{ id: 'A', label: 'A', seats: [
  { id: 'A1', label: 'A1', enabled: false }, { id: 'A2', label: 'A2' }, { id: 'A3', label: 'A3' }, { id: 'A4', label: 'A4' }
] }] } };

test('mapa publico preserva ocupacao, reserva e titularidade sem dados do comprador', () => {
  const result = presenter.present({ sessionId: 's1', session: { room: 'Sala 1' }, movie: { title: 'Filme' }, room, enabled: true,
    sold: new Set(['A2']), reserved: new Set(['A3']), holds: [{ seatId: 'A4', ownerToken: 'mine' }], ownerToken: 'mine' });
  assert.equal(result.capacity, 4 - 1);
  assert.deepEqual(result.rows[0].seats.map((seat) => seat.status), ['blocked', 'unavailable', 'held', 'held']);
  assert.deepEqual(result.rows[0].seats.map((seat) => seat.heldByMe), [false, false, false, true]);
  assert.equal(JSON.stringify(result).includes('ownerToken'), false);
});

test('sala sem lugar marcado usa capacidade declarada', () => {
  const result = presenter.present({ sessionId: 's2', session: { capacity: 20 }, room: null, enabled: false,
    sold: new Set(), reserved: new Set(), holds: [], ownerToken: '' });
  assert.equal(result.capacity, 20);
  assert.equal(result.placeholder, 'Lugar livre');
  assert.deepEqual(result.rows, []);
});
