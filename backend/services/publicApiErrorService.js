const SAFE_ERROR_RULES = [
  { test: (error) => error?.code === "23505", status: 409, code: "RESOURCE_CONFLICT", message: "Já existe um registro com estes dados. Revise os campos e tente novamente." },
  { test: (error) => error?.code === "23503", status: 409, code: "RESOURCE_IN_USE", message: "Este item está vinculado a outros registros e não pode ser alterado dessa forma." },
  { test: (error) => error?.code === "22P02", status: 422, code: "INVALID_DATA_FORMAT", message: "Um dos dados enviados está em formato inválido. Revise o formulário." },
  { test: (error) => /timeout|timed out|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/i.test(`${error?.code || ""} ${error?.message || ""}`), status: 504, code: "DEPENDENCY_TIMEOUT", message: "Um serviço necessário demorou para responder. Tente novamente em instantes." },
  { test: (error) => /gemini/i.test(`${error?.code || ""} ${error?.message || ""}`), status: 502, code: "GEMINI_UNAVAILABLE", message: "O Gemini não conseguiu concluir a geração. Verifique a integração e tente novamente." },
  { test: (error) => /smtp|nodemailer|email webhook/i.test(`${error?.code || ""} ${error?.message || ""}`), status: 502, code: "EMAIL_PROVIDER_UNAVAILABLE", message: "O provedor de e-mail não confirmou a operação. Verifique a integração antes de tentar novamente." },
  { test: (error) => error instanceof SyntaxError, status: 422, code: "INVALID_RESPONSE_FORMAT", message: "A resposta recebida não pôde ser validada. Tente gerar novamente." }
];

function publicApiError(error, requestId = "") {
  const explicitStatus = Number(error?.statusCode || 0);
  if (explicitStatus && explicitStatus < 500) {
    return {
      status: explicitStatus,
      code: error.code || "REQUEST_ERROR",
      message: error.message || "Não foi possível concluir a solicitação.",
      requestId
    };
  }
  if (error?.expose === true && error?.message) {
    return { status: explicitStatus || 500, code: error.code || "REQUEST_ERROR", message: error.message, requestId };
  }
  const rule = SAFE_ERROR_RULES.find((item) => item.test(error));
  if (rule) return { status: rule.status, code: rule.code, message: rule.message, requestId };
  return {
    status: explicitStatus >= 500 ? explicitStatus : 500,
    code: "OPERATION_FAILED",
    message: `Não foi possível concluir esta operação. Tente novamente${requestId ? ` e, se o problema continuar, informe o código ${requestId}` : ""}.`,
    requestId
  };
}

module.exports = { publicApiError, _test: { SAFE_ERROR_RULES } };
