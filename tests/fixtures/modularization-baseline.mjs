// Test-only records. No operational IDs, credentials, network endpoints or database files.
export function syntheticCinemaRecords() {
  const customer = { id: "baseline-customer", name: "Cliente Exemplo", email: "cliente@baseline.test", role: "customer", active: true, sessionVersion: 1 };
  const employee = { id: "baseline-employee", name: "Operadora Exemplo", email: "equipe@baseline.test", role: "operator", active: true, twoFactorEnabled: true };
  const room = { id: "baseline-room", name: "Sala Exemplo", capacity: 2, status: "active", seatSelectionEnabled: true,
    seatLayout: { screenLabel: "TELA", rows: [{ id: "A", label: "A", seats: [1, 2].map((number) => ({ id: `A${number}`, label: `A${number}`, enabled: true })) }] } };
  const session = { id: "baseline-session", date: "2099-01-01", time: "20:00", roomId: room.id, room: room.name, status: "available", ticketTypeIds: ["baseline-full"] };
  const movie = { id: "baseline-movie", title: "Filme Exemplo", slug: "filme-exemplo", workflowStatus: "published", status: "now_playing", duration: "100 min", sessions: [session] };
  const product = { id: "baseline-product", sku: "BASELINE-POPCORN", name: "Pipoca Exemplo", price: 8, stock: 4, reserved: 0, sold: 0, active: true };
  const order = { id: "baseline-order", userId: customer.id, movieId: movie.id, sessionId: session.id, seatIds: ["A1"], status: "pending_payment", totalPrice: 18, concessionItems: [{ concessionId: product.id, quantity: 1, unitPrice: 8 }] };
  const payment = { id: "baseline-payment", orderId: order.id, method: "pix", provider: "synthetic", status: "pending", amount: 18, currency: "BRL" };
  const subscription = { id: "baseline-subscription", userId: customer.id, planId: "baseline-plan", status: "active", creditsAvailable: 1 };
  return { settings: { cinemaName: "Cinema de Teste" }, users: [customer, employee], rooms: [room], movies: [movie], concessions: [product],
    ticketTypes: [{ id: "baseline-full", name: "Inteira", price: 10, active: true }], orders: [order], payments: [payment],
    subscriptionPlans: [{ id: "baseline-plan", name: "Clube Exemplo", monthlyPrice: 20, includedTickets: 1, active: true }],
    subscriptions: [subscription], tickets: [], promotions: [], auditLogs: [] };
}
