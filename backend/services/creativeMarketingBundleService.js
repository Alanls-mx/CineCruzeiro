const fs = require("node:fs/promises");
const path = require("node:path");
const yazl = require("yazl");
const { imageBuffer } = require("./creativePromptImageService");

const EXTENSIONS = { jpeg: "jpg", png: "png", webp: "webp" };

async function createBundle({ run, movie, uploadRoot, publicRoot, basePath = "", fetcher }) {
  if (run.briefVersion !== 2 || !run.promptText) {
    throw Object.assign(new Error("Gere o prompt antes de baixar os materiais."), { statusCode: 409, code: "CREATIVE_MARKETING_BUNDLE_NOT_READY" });
  }
  const zip = new yazl.ZipFile();
  const materials = [];
  const seen = new Set();
  const addImage = async (label, url, required = false) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    try {
      const { data, format } = await imageBuffer(url, { uploadRoot, publicRoot, basePath, fetcher });
      const filename = `materiais/${label}.${EXTENSIONS[format]}`;
      zip.addBuffer(data, filename);
      materials.push({ label, filename, source: url });
    } catch (error) {
      if (required) throw error;
      materials.push({ label, unavailable: true, reason: error.message });
    }
  };
  await addImage("imagem-principal", run.artworkUrl, Boolean(run.artworkUrl));
  if (movie || run.input?.sourceAssets) {
    const posterUrl = run.input?.sourceAssets?.posterUrl || movie?.posterUrl;
    const backdropUrl = run.input?.sourceAssets?.backdropUrl || movie?.backdropUrl;
    await addImage("poster-filme", posterUrl);
    await addImage("backdrop-filme", backdropUrl);
  }
  await addImage("referencia-visual", run.referenceUrl, Boolean(run.referenceUrl));
  for (const [label, filename] of [["assinatura-clara", "assinatura-clara.png"], ["assinatura-escura", "assinatura-escura.png"]]) {
    const data = await fs.readFile(path.join(publicRoot, "images", "creative-studio", filename));
    zip.addBuffer(data, `materiais/${filename}`);
    materials.push({ label, filename: `materiais/${filename}`, source: "Cine Cruzeiro" });
  }
  zip.addBuffer(Buffer.from(run.promptText, "utf8"), "prompt-canva.txt");
  zip.addBuffer(Buffer.from(JSON.stringify({
    category: run.category, format: run.format, createdAt: run.createdAt,
    selectedVariant: run.selectedVariant, facts: run.input?.request?.facts || {},
    brief: run.brief, materials
  }, null, 2), "utf8"), "briefing.json");
  zip.addBuffer(Buffer.from([
    "CINE CRUZEIRO — MATERIAIS PARA O CANVA",
    "",
    "1. Abra prompt-canva.txt e use-o como direção no Canva.",
    "2. Envie ao Canva as imagens da pasta materiais; a imagem principal é a selecionada no Studio.",
    "3. As assinaturas clara e escura são alternativas: escolha a que tiver maior contraste. Não recrie o logo por IA.",
    "4. Confira manualmente todos os nomes, preços, datas, horários e códigos antes de publicar.",
    "5. Consulte briefing.json para os fatos confirmados e a decisão criativa.",
    "",
    ...materials.filter((item) => item.unavailable).map((item) => `ATENÇÃO: ${item.label} não pôde ser incluído (${item.reason}).`),
    ""
  ].join("\n"), "utf8"), "LEIA-ME.txt");
  zip.end();
  return zip.outputStream;
}

module.exports = { createBundle };
