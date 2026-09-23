const sharp = require("sharp");
const { renderSocialPostV2 } = require("../engine/renderer");
const { STYLES } = require("./config");
const { campaignHierarchy } = require("./hierarchy");
const { renderSocialScene } = require("../scene/renderer");

function variationFamily(style) {
  if (['hero-left','hero-right','split'].includes(style)) return 'lateral';
  if (['poster-dominant','hero-center'].includes(style)) return 'poster';
  if (['cinematic-grid','layered'].includes(style)) return 'grid';
  if (['featured','split-heroes'].includes(style)) return 'featured';
  if (style === 'mosaic') return 'editorial';
  if (['film-strip','lineup','poster-list','editorial-schedule'].includes(style)) return 'list';
  if (['timeline','week-timeline','cinema-board'].includes(style)) return 'timeline';
  if (['day-cards','featured-days','poster-calendar','editorial-week'].includes(style)) return 'calendar';
  return style;
}

function selectDiverseVariations(ranked, mode) {
  if (mode === 'similar') return ranked.slice(0, 4);
  const selected = [], families = new Set();
  for (const variation of ranked) {
    const family = variationFamily(variation.styleId);
    if (families.has(family)) continue;
    selected.push(variation);
    families.add(family);
    if (selected.length === 4) return selected;
  }
  for (const variation of ranked) {
    if (selected.includes(variation)) continue;
    selected.push(variation);
    if (selected.length === 4) break;
  }
  return selected;
}

async function generateVariations(input, context, options = {}) {
  const mode = ["similar", "hierarchy"].includes(input.variationMode) ? input.variationMode : "explore";
  const emphasis = campaignHierarchy(input).primary === "detail" ? "date" : "film";
  const programLayouts=require('../programming/direction').PROGRAM_LAYOUTS[input.templateId];
  const multi=Boolean(programLayouts);
  const multiNames={featured:'Destaque e apoio','cinematic-grid':'Grade cinematográfica',layered:'Pôsteres em camadas',mosaic:'Mosaico editorial','film-strip':'Faixa de filmes',panorama:'Panorama','split-heroes':'Dupla protagonista',collage:'Colagem integrada',lineup:'Seleção de filmes',timeline:'Linha do tempo','hero-schedule':'Filme e horários','poster-list':'Lista de filmes','cinema-board':'Painel de cinema','editorial-schedule':'Agenda editorial','day-cards':'Dias em destaque','week-timeline':'Semana em sequência','poster-calendar':'Pôster e calendário','featured-days':'Dias principais','editorial-week':'Semana editorial'};
  const ticketNames={'price-impact':'Preço gigante','campaign-led':'Selo de campanha','offer-counter':'Impacto comercial','ticket-burst':'Ingresso em destaque','promo-editorial':'Editorial promocional','cinema-pop':'Cinema pop'};
  const commercialStyles = input.templateId === 'ticket-offer' ? Object.keys(ticketNames) : input.templateId === 'concession-combo'
    ? ['poster-dominant','hero-left','hero-right','split']
    : input.templateId === 'club-plan'
      ? ['typography-dominant','editorial','hero-center','hero-right']
      : null;
  const styles = multi ? mode==='similar'?Array(6).fill(input.programLayout || 'automatic'):programLayouts : mode === "similar" ? Array(6).fill(input.layoutId || input.style || commercialStyles?.[0] || "hero-left") : commercialStyles || ["hero-left", "hero-right", "full-bleed", "editorial", "poster-dominant", "typography-dominant", "split", "hero-center"];
  const variations = [],
    rejected = [];
  for (const [index, style] of styles.entries()) {
    const draft = {
      ...input,
      style,
      layoutId:multi?input.layoutId:style,
      ...(multi ? {style:input.style || 'cinematic',programLayout:style} : {}),
      automaticStyle: false,
      polish: false,
      artDirection: {
        ...input.artDirection,
        enabled: true,
        seed: ((Number(input.artDirection?.seed) || 0) + index + 1) % 10000,
        emphasis: mode === "explore" && ["poster-dominant", "hero-center"].includes(style) ? "film" : emphasis,
      },
    };
    if (mode === "similar") {
      draft.artDirection.hero = { ...input.artDirection?.hero, scale: Math.max(.82, Math.min(1.15, (input.artDirection?.hero?.scale || 1) + (index - 2) * .012)) };
      draft.titleScale = Math.max(80, Math.min(120, (input.titleScale || 100) + (index - 2) * 2));
      draft.composition = { ...input.composition, adjustments: { ...input.composition?.adjustments, blend: Math.max(0, Math.min(100, (input.composition?.adjustments?.blend ?? 70) + (index - 2) * 3)) } };
    }
    if(multi && mode==='similar') draft.programSpacing=(index-2)*.003;
    const raw = await renderSocialPostV2(draft, context, { ...options, skipRaster: true });
    const polished = await renderSocialPostV2({ ...draft, polish: true }, context, { ...options, skipRaster: true });
    const rendered = polished.quality.accepted && polished.quality.total >= raw.quality.total ? polished : raw;
    if (!rendered.quality.accepted) {
      rejected.push({ style, quality: rendered.quality });
      continue;
    }
    const { entities, ...payload } = rendered.draft;
    variations.push({
      id: `${style}-${draft.artDirection.seed}`,
      styleId: style,
      name: multi ? multiNames[style] : ticketNames[style] || STYLES.find((s) => s.id === style)?.name || style,
      intent: input.templateId==='ticket-offer'?'Conceito da oferta, preço e compra em destaque':input.templateId === 'concession-combo' ? 'Produto, preço e chamada organizados para a bomboniere' : input.templateId === 'club-plan' ? 'Plano, benefícios e mensalidade em destaque' : draft.artDirection.emphasis === "date" ? "Data ou preço em primeiro plano" : style === "poster-dominant" ? "Artwork em destaque" : "Filme e chamada em destaque",
      draft: payload,
      quality: rendered.quality,
      beforeQuality: raw.quality,
      refined: rendered === polished,
      scene: rendered.scene,
    });
  }
  variations.sort((first, second) => second.quality.total - first.quality.total || second.quality.commercialClarity - first.quality.commercialClarity);
  const selected = selectDiverseVariations(variations, mode).map((variation, index) => ({ ...variation, recommended: index === 0, classification: index === 0 ? "Melhor opção" : variation.quality.total >= 88 ? "Muito boa" : variation.quality.total >= 78 ? "Boa" : "Experimental" }));
  for (const variation of selected) {
    const raster = await renderSocialScene(variation.scene, options);
    const thumb = await sharp(raster.buffer).resize({ width: 400 }).jpeg({ quality: 85 }).toBuffer();
    variation.image = `data:image/jpeg;base64,${thumb.toString("base64")}`;
    delete variation.scene;
  }
  return {
    variations: selected,
    evaluatedCount: styles.length,
    ranking: variations.map(({ name, quality, beforeQuality, refined }) => ({ name, score: quality.total, before: beforeQuality.total, refined })),
    rejectedCount: rejected.length,
    notices:
      variations.length < 3
        ? [
            "Algumas composições não passaram na revisão automática. Reduza o texto ou selecione outra imagem para obter mais opções.",
          ]
        : [],
  };
}
module.exports = { generateVariations, selectDiverseVariations };
