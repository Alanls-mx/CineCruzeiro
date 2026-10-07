const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const { studioError } = require("./campaignPlanner");
const { MCP_RESOURCE } = require("./mcpOAuthService");

function payload(result) {
  if (result.isError) throw studioError("CANVA_MCP_TOOL_FAILED", "O Canva IA não concluiu a operação. Confira a conta e tente novamente.", 502);
  if (result.structuredContent && typeof result.structuredContent === "object") return result.structuredContent;
  const text = result.content?.find((item) => item.type === "text")?.text;
  try { return JSON.parse(text || "{}"); }
  catch { throw studioError("CANVA_MCP_RESPONSE_INVALID", "O Canva IA retornou um resultado inválido.", 502); }
}
function candidatesFrom(value) {
  const job = value.job || value;
  const designs = job.result?.generated_designs || value.generated_designs || [];
  return { jobId: String(job.id || value.job_id || ""), candidates: designs.map((item) => ({
    candidateId: String(item.candidate_id || ""),
    previewUrl: String(item.thumbnails?.[0]?.url || ""),
    viewUrl: String(item.url || "")
  })).filter((item) => item.candidateId) };
}
async function withClient(token, action, create = (transport) => new Client({ name: "cine-cruzeiro-studio", version: "1.0.0" })) {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_RESOURCE), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
  const client = create(transport);
  try {
    await client.connect(transport);
    return await action(client);
  } catch (error) {
    if (typeof error.code === "string" && (error.code.startsWith("CANVA_") || error.code.startsWith("STUDIO_"))) throw error;
    throw studioError("CANVA_MCP_UNAVAILABLE", "Não foi possível concluir a operação no Canva IA. Confira a conexão MCP e tente novamente.", 503);
  } finally { await client.close().catch(() => {}); }
}
async function generate(token, brief, assetIds, title) {
  if (!assetIds.length) throw studioError("STUDIO_AI_ASSETS_MISSING", "Adicione ao menos uma imagem para a criação com IA.", 422);
  return withClient(token, async (client) => {
    const tools = (await client.listTools()).tools || [];
    const posterWithAssets = (tool) => {
      const properties = tool.inputSchema?.properties || {};
      const types = properties.design_type?.enum;
      return properties.asset_ids && properties.design_type && (!Array.isArray(types) || types.includes("poster"));
    };
    const generator = tools.find((tool) => tool.name === "generate-design" && posterWithAssets(tool))
      || tools.find((tool) => tool.name === "prepare-design-generation" && posterWithAssets(tool));
    if (!generator) throw studioError("CANVA_MCP_POSTER_UNAVAILABLE", "Esta conexão Canva MCP não oferece geração de pôster com imagens de referência. Nenhum crédito de IA foi consumido.", 409);
    const args = generator.name === "prepare-design-generation"
      ? { intent: "generation", design_type: "poster", topic: brief, title, asset_ids: assetIds, user_intent: "Criar pôster editável com assets oficiais do Cine Cruzeiro" }
      : { design_type: "poster", query: brief, asset_ids: assetIds, user_intent: "Criar pôster editável com assets oficiais do Cine Cruzeiro" };
    const value = payload(await client.callTool({ name: generator.name, arguments: args }, undefined, { timeout: 90000 }));
    const result = candidatesFrom(value);
    if (!result.jobId || !result.candidates.length) throw studioError("CANVA_MCP_NO_CANDIDATES", "O Canva IA não retornou alternativas de pôster. Confira o histórico da conta antes de repetir.", 502);
    return result;
  });
}
async function materialize(token, jobId, candidateId) {
  return withClient(token, async (client) => {
    const tools = (await client.listTools()).tools || [];
    if (!tools.some((tool) => tool.name === "create-design-from-candidate")) throw studioError("CANVA_MCP_CANDIDATE_UNAVAILABLE", "Esta conexão Canva MCP não permite salvar a alternativa escolhida.", 409);
    const value = payload(await client.callTool({ name: "create-design-from-candidate", arguments: { job_id: jobId, candidate_id: candidateId } }, undefined, { timeout: 90000 }));
    const design = value.design_summary || value.design || {};
    if (!design.id) throw studioError("CANVA_MCP_DESIGN_UNKNOWN", "O Canva não confirmou o design criado. Confira sua conta antes de repetir.", 502);
    return { id: String(design.id), editUrl: String(design.urls?.edit_url || ""), previewUrl: String(design.thumbnail?.url || "") };
  });
}

module.exports = { payload, candidatesFrom, generate, materialize };
