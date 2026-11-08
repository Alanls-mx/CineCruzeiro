const { assertDisposableTestDatabase } = require("./test-postgres-safety");

async function main() {
  await assertDisposableTestDatabase();
  process.send?.({ type: "ready" });
  process.once("message", async (message) => {
    if (message?.type !== "acquire" || message.sessionId !== "sessao-concorrencia"
      || message.seatId !== "A1" || !/^worker-[ab]$/.test(message.ownerToken || "")) {
      process.send?.({ type: "error", message: "Comando de corrida inválido" });
      process.exitCode = 1;
      return;
    }
    try {
      const { acquireSeatHold, closePostgres } = require("../backend/db/postgresStore");
      const hold = await acquireSeatHold({ sessionId: message.sessionId, seatId: message.seatId,
        ownerToken: message.ownerToken, connectionId: message.ownerToken });
      process.send?.({ type: "result", acquired: Boolean(hold), ownerToken: message.ownerToken }, async () => {
        await closePostgres();
        process.disconnect?.();
      });
    } catch (error) {
      process.send?.({ type: "error", message: error.message });
      process.exitCode = 1;
    }
  });
}

main().catch((error) => { process.send?.({ type: "error", message: error.message }); process.exitCode = 1; });
