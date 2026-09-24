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
  const {isConcession,FAMILIES}=require('../contracts/concession-campaign');
  const product=isConcession(input);
  const {MOVIE_FAMILIES,PRODUCT_LAYOUTS,isMovie}=require('../contracts/artwork-layout');
  const commercialStyles = input.templateId === 'ticket-offer' ? Object.keys(ticketNames) : product
    ? Object.keys(PRODUCT_LAYOUTS)
    : input.templateId === 'club-plan'
      ? ['typography-dominant','editorial','hero-center','hero-right']
      : isMovie(input)?Object.keys(MOVIE_FAMILIES):null;
  const styles = multi ? mode==='similar'?Array(6).fill(input.programLayout || 'automatic'):programLayouts : mode === "similar" ? Array(6).fill(input.layoutId || input.style || commercialStyles?.[0] || "hero-left") : commercialStyles || ["hero-left", "hero-right", "full-bleed", "editorial", "poster-dominant", "typography-dominant", "split", "hero-center"];
  const variations = [],
    rejected = [];
  const workspace = require('../contracts/workspace');
  const candidates = input.workspaceVersion === 2 ? workspace.LAYOUTS[workspace.category(input.templateId)] || styles : styles;
  for (const [index, style] of candidates.entries()) {
    const draft = {
      ...input,
      ...(product?{concessionDirection:{...input.concessionDirection,layout:style}}:{}),
      style,
      layoutId:multi?input.layoutId:style,
      ...(multi ? {style:input.style || 'cinematic',programLayout:style,programStyle:['posters','editorial','cinematic'][index%3]} : {}),
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
    let raw;
    try {raw=await renderSocialPostV2(draft, context, { ...options, artworkRetried:true,concessionRetried:product, skipRaster: true });}
    catch(error) {if(!['CONCESSION_QUALITY','ARTWORK_QUALITY','PROGRAM_CAPACITY'].includes(error.code))throw error;rejected.push({style,quality:error.quality});continue;}
    const polished = product || isMovie(input) || multi ? raw : await renderSocialPostV2({ ...draft, polish: true }, context, { ...options, skipRaster: true });
    const rendered = polished.quality.accepted && polished.quality.total >= raw.quality.total ? polished : raw;
    if (!rendered.quality.accepted) {
      rejected.push({ style, quality: rendered.quality });
      continue;
    }
    const { entities, ...payload } = rendered.draft;
    if(multi && variations.some(v=>v.draft.resolvedProgramLayout===payload.resolvedProgramLayout && (input.workspaceVersion===2 || v.draft.programStyle===payload.programStyle)))continue;
    if(isMovie(input) && mode!=='similar' && variations.some(v=>v.draft.movieFamily===payload.movieFamily))continue;
    variations.push({
      id: `${style}-${draft.artDirection.seed}`,
      styleId: isMovie(input)?payload.movieFamily || style:style,
      name: multi ? ({posters:'Pôsteres',editorial:'Editorial clean',cinematic:'Cinematográfico'}[payload.programStyle] || multiNames[style]) : PRODUCT_LAYOUTS[style] || MOVIE_FAMILIES[payload.movieFamily || style] || FAMILIES[style] || ticketNames[style] || STYLES.find((s) => s.id === style)?.name || style,
      intent: input.templateId==='ticket-offer'?'Conceito da oferta, preço e compra em destaque':input.templateId === 'concession-combo' ? 'Produto, preço e chamada organizados para a bomboniere' : input.templateId === 'club-plan' ? 'Plano, benefícios e mensalidade em destaque' : draft.artDirection.emphasis === "date" ? "Data ou preço em primeiro plano" : style === "poster-dominant" ? "Artwork em destaque" : "Filme e chamada em destaque",
      draft: payload,
      ...(product?{intent:`${rendered.draft.entities.concession.name} · ${rendered.format.width} × ${rendered.format.height}`} : {}),
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
