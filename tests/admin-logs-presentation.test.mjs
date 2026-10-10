import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const script = readFileSync(new URL('../backend/public/admin.js', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const present = require('../backend/public/admin-modules/log-presentation.js').logPresentation;

test('historical performance recovery identifies the alert that ended', () => {
  const latency = present({event: 'performance.recovered', category: 'performance', metadata: {code: 'latency'}});
  const cpu = present({event: 'performance.recovered', category: 'performance', metadata: {code: 'cpu'}});
  assert.match(latency.title, /Tempo de resposta/);
  assert.match(latency.description, /tempo de resposta/);
  assert.match(cpu.title, /CPU/);
  assert.notEqual(cpu.title, latency.title);
});

test('an unknown event still shows its identity; known Studio activity has a readable description', () => {
  assert.match(present({event: 'social_studio.campaign_created', category: 'social_studio'}).description, /Campanha criada no Studio/);
  assert.match(present({event: 'custom.reconciliation_started', category: 'custom'}).description, /custom\.reconciliation_started/);
});

test('WhatsApp navigation and permission controls are removed', () => {
  const html = readFileSync(new URL('../backend/public/admin.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('admin-modules/log-presentation.js') < html.indexOf('admin.js?v='));
  assert.doesNotMatch(html, /class="nav-button"[^>]*admin\/whatsapp/);
  assert.doesNotMatch(html, /value="whatsapp\./);
  assert.doesNotMatch(script, /"whatsapp\.(view|reply|manage)"/);
});
