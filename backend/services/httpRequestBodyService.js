function createHttpRequestBodyService(maxBytes) {
  async function readBody(req, { rawOnly = false } = {}) {
    const chunks = [];
    let receivedBytes = 0;
    const declaredBytes = Number(req.headers["content-length"] || 0);
    if (declaredBytes > maxBytes) {
      const error = new Error("A requisição excede o limite permitido.");
      error.statusCode = 413;
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    }
    for await (const chunk of req) {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        const error = new Error("A requisição excede o limite permitido.");
        error.statusCode = 413;
        error.code = "PAYLOAD_TOO_LARGE";
        throw error;
      }
      chunks.push(chunk);
    }
    const rawBuffer = Buffer.concat(chunks);
    const raw = rawBuffer.toString("utf8");
    req.rawBodyBuffer = rawBuffer;
    req.rawBody = raw;
    if (rawOnly) return rawBuffer;
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      const error = new Error("JSON inválido. Revise o corpo da requisição.");
      error.statusCode = 400;
      error.code = "INVALID_JSON";
      throw error;
    }
  }
  return { readBody };
}

module.exports = { createHttpRequestBodyService };
