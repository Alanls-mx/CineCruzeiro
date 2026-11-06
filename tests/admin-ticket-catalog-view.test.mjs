import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createTicketCatalogView } = require("../backend/public/admin-modules/ticket-catalog-view.js");

test("ticket catalog keeps filters and performs one save after a repeated submit", async () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "", checked: false, innerHTML: "" });
    return elements.get(id);
  };
  const state = { content: { ticketTypes: [], tickets: [] }, creating: { ticket: false }, selectedTicketId: "",
    issuedTicketFilters: { movieId: "", sessionId: "", room: "", date: "", status: "" } };
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const requests = [];
  const notices = [];
  const view = createTicketCatalogView({ state, $,
    api: async (path, options) => { requests.push([path, options]); return pending; },
    creationPlaceholder: () => "Novo tipo", currentTicket: () => null, escapeHtml: String, money: String,
    paginateAdminItems: (items) => ({ pageItems: items }), renderAdminListPager: () => "",
    syncCreationControl: () => {}, setDisabled: () => {},
    upsertAdminCollection: (key, item) => state.content[key].push(item),
    showToast: (message, kind) => notices.push([message, kind])
  });
  view.renderTickets();
  view.renderTickets();
  view.newTicket();
  $("ticketName").value = "Inteira QA";
  $("ticketPrice").value = "15";
  $("ticketBundleQuantity").value = "1";
  let prevented = 0;
  const event = { preventDefault: () => { prevented += 1; } };
  const first = view.saveTicket(event);
  await view.saveTicket(event);
  assert.equal(prevented, 3);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], "/api/ticket-types");
  assert.equal(JSON.parse(requests[0][1].body).price, 15);
  assert.equal(state.content.ticketTypes.length, 0);
  release({ id: "ticket-qa", name: "Inteira QA", price: 15 });
  await first;
  assert.equal(state.content.ticketTypes.length, 1);
  assert.deepEqual(notices, [["Ingresso salvo.", undefined]]);
});
