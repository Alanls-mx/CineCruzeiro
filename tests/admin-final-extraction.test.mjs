import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createIntegrationAdministration } = require('../backend/public/admin-modules/integration-administration.js');
const { bindDashboardAndOverlayEvents } = require('../backend/public/admin-modules/dashboard-and-overlay-events.js');
const { bindSalesAndTicketEvents } = require('../backend/public/admin-modules/sales-and-ticket-events.js');

test('integration list renders from supplied state without calling a provider', () => {
  const target = { innerHTML: '' };
  let calls = 0;
  const controller = createIntegrationAdministration({
    state: { integrations: { integrations: { tmdb: { key: 'tmdb', name: 'TMDB', purpose: 'Catálogo', enabled: true, configured: true } } } },
    $: (id) => id === 'integrationsList' ? target : null,
    escapeHtml: (value) => String(value),
    API_BASE: '',
    api: async () => { calls++; },
    showToast() {},
    showSuccess() {},
    refreshPointProviderControls() {}
  });
  controller.renderIntegrations();
  assert.match(target.innerHTML, /TMDB/);
  assert.match(target.innerHTML, /data-integration-action="config"/);
  assert.equal(calls, 0);
});

test('concession finance controls receive one listener after domain event composition', () => {
  const registrations = new Map();
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        addEventListener(type) {
          const key = `${id}:${type}`;
          registrations.set(key, (registrations.get(key) || 0) + 1);
        }
      });
    }
    return elements.get(id);
  };
  const oldDocument = globalThis.document;
  const oldWindow = globalThis.window;
  globalThis.document = { querySelectorAll: () => [] };
  globalThis.window = { CineAdminModules: { logEvents: { bindLogEvents() {} } } };
  try {
    const deps = new Proxy({ $: getElement, state: {} }, { get: (target, key) => key in target ? target[key] : () => {} });
    bindDashboardAndOverlayEvents(deps);
    bindSalesAndTicketEvents(deps);
    assert.equal(registrations.get('concessionSalesRefresh:click'), 1);
    assert.equal(registrations.get('concessionSalesDate:change'), 1);
    assert.equal(registrations.get('concessionSalesArchived:change'), 1);
  } finally {
    globalThis.document = oldDocument;
    globalThis.window = oldWindow;
  }
});
