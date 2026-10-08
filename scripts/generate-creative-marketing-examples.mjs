import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import core from "../backend/services/creativeMarketingStudioService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examples = [
  { category: "films", format: "feed", facts: { title: "Minha Melhor Amiga", campaign: "Estreia",
    release: "29/09", sessions: "29/09 às 15:00" }, visualDescription: "Duas amigas sorrindo em uma praça ao entardecer; luz coral e rosa, céu com respiro à esquerda. O título oficial pode estar incorporado à arte.",
    objective: "Apresentar a estreia com foco no vínculo entre as protagonistas", cta: "Escolha sua sessão" },
  { category: "concessions", format: "feed", facts: { product: "Combo Pipoca + Refrigerante", components: "1 pipoca grande e 2 refrigerantes de 500 ml",
    price: "R$ 34,90" }, visualDescription: "Fotografia real de pipoca dourada e copos com condensação, embalagem vermelha.", cta: "Peça na bomboniere" },
  { category: "programming", format: "landscape", facts: { period: "29/09 a 05/10", movies: "Minha Melhor Amiga\nResident Evil",
    sessions: "Minha Melhor Amiga — 29/09 às 15:00\nResident Evil — 30/09 às 19:00" },
    objective: "Divulgar programação semanal com horários fáceis de comparar" },
  { category: "promotions", format: "square", facts: { benefit: "Ingresso por R$ 12,00", previousPrice: "R$ 20,00",
    price: "R$ 12,00", period: "29/09 a 30/09", conditions: "Somente sessões de terça-feira" }, cta: "Confira as sessões" },
  { category: "events", format: "story", facts: { name: "Pré-estreia especial", date: "29/09", time: "19:00",
    venue: "Cine Cruzeiro — Sala 1", tickets: "Ingressos na bilheteria" },
    visualDescription: "Fachada do cinema iluminada à noite, pessoas chegando; atmosfera de expectativa." },
  { category: "coupons", format: "square", facts: { code: "CINE10", benefit: "R$ 10,00 de desconto",
    validity: "Até 30/09", eligibility: "Compras acima de R$ 40,00", rules: "Um uso por CPF" }, cta: "Use o código na compra" },
  { category: "giveaways", format: "feed", facts: { prize: "2 ingressos", period: "Até 29/09",
    mechanics: "Comente na publicação até 29/09", rules: "Resultado em 30/09" }, cta: "Participe" },
  { category: "institutional", format: "square", facts: { headline: "Horário especial",
    message: "No dia 29/09 abriremos às 14:00.", period: "29/09", hours: "14:00 às 22:00" },
    objective: "Informar mudança de horário com clareza" },
  { category: "free", format: "story", facts: { subject: "Semana do cinema",
    objective: "Convidar o público a conhecer as salas", details: "Ação em 29/09" },
    directionNote: "Clima de descoberta, sem mencionar descontos ou benefícios não confirmados." }
];

const content = [
  "# Exemplos completos de prompts",
  "",
  "Os dados abaixo são **fictícios e ilustrativos**. Não representam ofertas, sessões, sorteios ou horários reais do Cine Cruzeiro. Estes exemplos são produzidos pelo mesmo compilador usado pelo Studio, sem chamada de IA paga.",
  ""
];
for (const example of examples) {
  const input = core.normalizeInput({ ...example, artworkRole: "none", density: "auto" });
  const curated = core.curate(input);
  const variant = core.variantsFor(input)[0];
  const brief = core.briefFor(input, curated, variant, null, null);
  const prompt = core.compile(input, brief, curated);
  core.qa(prompt, input, curated, brief);
  content.push(`## ${core.CATEGORIES[input.category].name}`, "", "```text", prompt, "```", "");
}
fs.writeFileSync(path.join(root, "docs", "CREATIVE_MARKETING_STUDIO_EXAMPLES.md"), content.join("\n"));
