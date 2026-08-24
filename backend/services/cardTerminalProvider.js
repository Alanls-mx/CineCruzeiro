function cardTerminalConfigured() {
  return Boolean(process.env.CARD_TERMINAL_PROVIDER && process.env.CARD_TERMINAL_API_KEY);
}

function providerName() {
  return process.env.CARD_TERMINAL_PROVIDER || "manual_external";
}

function manualTerminalPaymentMetadata(input = {}, adminUser = {}) {
  return {
    terminalMode: "manual_external",
    terminalConfigured: false,
    terminalReference: String(input.terminalReference || input.reference || "").trim(),
    confirmedBy: adminUser.id || "",
    confirmedByEmail: adminUser.email || "",
    confirmedAt: new Date().toISOString()
  };
}

async function createPayment() {
  const error = new Error("Integração automática com maquininha não configurada.");
  error.statusCode = 412;
  throw error;
}

async function getStatus() {
  const error = new Error("Integração automática com maquininha não configurada.");
  error.statusCode = 412;
  throw error;
}

async function cancelPayment() {
  const error = new Error("Cancelamento automático na maquininha não configurado.");
  error.statusCode = 412;
  throw error;
}

async function refundPayment() {
  const error = new Error("Reembolso automático na maquininha não configurado.");
  error.statusCode = 412;
  throw error;
}

module.exports = {
  configured: cardTerminalConfigured,
  providerName,
  manualTerminalPaymentMetadata,
  createPayment,
  getStatus,
  cancelPayment,
  refundPayment
};
