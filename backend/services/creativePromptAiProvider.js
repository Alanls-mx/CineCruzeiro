function providerError(message, code, statusCode = 502) {
  return Object.assign(new Error(message), { code, statusCode });
}

function createCreativePromptAiProvider({ fetcher = fetch } = {}) {
  async function json(config, { system, user, imageDataUrl = "", maxOutputTokens = 1800 }) {
    if (config?.kind === "local") {
      const content = [{ type: "text", text: user }];
      if (imageDataUrl) content.push({ type: "image_url", image_url: { url: imageDataUrl } });
      let response;
      try {
        response = await fetcher(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST", signal: AbortSignal.timeout(Math.min(60000, Math.max(5000, Number(config.timeout || 30000)))),
          headers: { "Content-Type": "application/json", ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) },
          body: JSON.stringify({ model: config.model, messages: [{ role: "system", content: system }, { role: "user", content }],
            response_format: { type: "json_object" }, max_tokens: maxOutputTokens, stream: false })
        });
      } catch (error) {
        throw providerError(error.name === "TimeoutError" ? "A análise local excedeu o tempo limite." : "O provedor local de visão está indisponível.", "CREATIVE_PROMPT_AI_UNAVAILABLE");
      }
      if (!response.ok) throw providerError("O provedor local recusou a análise visual.", "CREATIVE_PROMPT_AI_UPSTREAM");
      try { return JSON.parse((await response.json()).choices?.[0]?.message?.content || ""); }
      catch { throw providerError("O provedor local não retornou JSON válido.", "CREATIVE_PROMPT_AI_INVALID_RESPONSE"); }
    }
    if (!config?.enabled || !config?.apiKey) {
      throw providerError("Ative e configure IA do Creative Prompt Studio em Integrações.", "CREATIVE_PROMPT_AI_NOT_CONFIGURED", 412);
    }
    const content = [{ type: "input_text", text: user }];
    if (imageDataUrl) content.push({ type: "input_image", image_url: imageDataUrl, detail: "high" });
    let response;
    try {
      response = await fetcher("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: AbortSignal.timeout(Math.min(60000, Math.max(5000, Number(config.timeout || 30000)))),
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model || "gpt-4.1-mini",
          instructions: system,
          input: [{ role: "user", content }],
          text: { format: { type: "json_object" } },
          max_output_tokens: maxOutputTokens,
          store: false
        })
      });
    } catch (error) {
      throw providerError(error.name === "TimeoutError" ? "A análise de IA excedeu o tempo limite." : "Não foi possível consultar a IA.", "CREATIVE_PROMPT_AI_UNAVAILABLE");
    }
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403 ? "CREATIVE_PROMPT_AI_CREDENTIALS" : "CREATIVE_PROMPT_AI_UPSTREAM";
      throw providerError(response.status === 429 ? "Limite de chamadas de IA atingido. Tente novamente depois." : "O provedor de IA recusou a análise.", code, response.status === 429 ? 429 : 502);
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw providerError("O provedor de IA retornou uma resposta inválida. Tente novamente.", "CREATIVE_PROMPT_AI_INVALID_RESPONSE");
    }
    if (payload.status !== "completed") throw providerError("A análise de IA ficou incompleta. Tente novamente.", "CREATIVE_PROMPT_AI_INCOMPLETE");
    const output = (payload.output || []).flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text").map((item) => item.text).join("\n");
    try {
      return JSON.parse(output);
    } catch {
      throw providerError("A IA não retornou uma análise estruturada válida.", "CREATIVE_PROMPT_AI_INVALID_RESPONSE");
    }
  }

  async function testConnection(config) {
    if (!config?.apiKey) return { ok: false, message: "Informe a chave da API OpenAI." };
    const model = encodeURIComponent(config.model || "gpt-4.1-mini");
    try {
      const response = await fetcher(`https://api.openai.com/v1/models/${model}`, {
        signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${config.apiKey}` }
      });
      return response.ok
        ? { ok: true, message: "Chave e modelo de IA acessíveis. Nenhuma geração foi cobrada neste teste." }
        : { ok: false, message: "A OpenAI recusou a chave ou o modelo configurado." };
    } catch {
      return { ok: false, message: "Não foi possível consultar a OpenAI." };
    }
  }

  return { json, testConnection };
}

module.exports = { createCreativePromptAiProvider };
