const library = require("../reference/creative-prompt-library.json");

const CATEGORY_NAMES = { films: "Filmes", concessions: "Bomboniere", programming: "Programação" };
const CONCEPT_PREFIXES = {
  composition: /^Composição\s*—\s*/i,
  typography: /^Tipografia(?: auxiliar)?\s*—\s*/i,
  palette: /^Paleta\s*—\s*/i,
  finish: /^Acabamento(?: premium)?\s*—\s*/i
};
const STOP_WORDS = new Set(["filme", "filmes", "cinema", "cine", "cruzeiro", "campanha", "poster", "arte",
  "imagem", "visual", "para", "com", "uma", "mais", "como", "sobre", "produto", "peca", "dados",
  "sessao", "programacao", "bomboniere", "informacao", "titulo", "design", "formato"]);

function words(text) {
  return new Set(String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !STOP_WORDS.has(word)));
}
function conceptText(text) {
  return String(text || "").replace(/\[[^\]]{1,120}\]/g, "informação aprovada")
    .replace(/[“”][^“”]{1,120}[“”]/g, "texto aprovado").trim().slice(0, 320);
}
function conceptsFor(record) {
  const concepts = {};
  for (const line of record.lines || []) {
    for (const [key, prefix] of Object.entries(CONCEPT_PREFIXES)) {
      if (prefix.test(line)) concepts[key] = conceptText(line.replace(prefix, ""));
    }
  }
  return concepts;
}
const records = new Map((library.records || []).map((record) => [record.id, record]));

function listReferences(category) {
  const name = CATEGORY_NAMES[category];
  if (!name) return [];
  return [...records.values()].filter((record) => record.category === name).map((record) => ({
    id: record.id, name: record.name, category, composition: conceptsFor(record).composition || ""
  }));
}
function getReference(id, category) {
  const record = records.get(String(id || ""));
  if (!record || (category && record.category !== CATEGORY_NAMES[category])) return null;
  return { id: record.id, name: record.name,
    category: Object.keys(CATEGORY_NAMES).find((key) => CATEGORY_NAMES[key] === record.category),
    concepts: conceptsFor(record), lines: [...record.lines] };
}
function recommendReference(category, query, alternate = false) {
  const queryWords = words(query);
  if (!queryWords.size) return null;
  const ranked = listReferences(category).map((item) => {
    const nameWords = words(item.name);
    const compositionWords = words(item.composition);
    let score = 0;
    for (const word of queryWords) {
      if (nameWords.has(word)) score += 4;
      if (compositionWords.has(word)) score += 1;
    }
    return { id: item.id, score };
  }).filter((item) => item.score >= 4).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  if (!ranked.length) return null;
  return getReference(ranked[alternate && ranked.length > 1 ? 1 : 0].id, category);
}

module.exports = { listReferences, getReference, recommendReference, CATEGORY_NAMES };
