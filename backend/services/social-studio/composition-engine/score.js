const overlap = (a, b) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
function scoreComposition(scene) {
  const issues = [],
    elements = require('../scene/groups').flattenElements(scene.elements).filter((e) => e.visible !== false),
    texts = elements.filter((e) => e.type === "text" && e.text?.trim());
  const add = (code, penalty, id) =>
    issues.push({ code, penalty, elementId: id });
  const top =
      scene.formatId === "story" ? scene.height * 0.055 : scene.height * 0.025,
    bottom =
      scene.formatId === "story" ? scene.height * 0.91 : scene.height * 0.99;
  for (const text of texts) {
    if (
      text.x < scene.width * 0.025 ||
      text.x + text.width > scene.width * 0.975 ||
      text.y < top ||
      text.y + text.height > bottom
    )
      add("SAFE_AREA", 18, text.id);
    if (text.fontSize < 18 && !["website", "cinema"].includes(text.id))
      add("SMALL_TEXT", 12, text.id);
    if (
      text.text.split("\n").length * text.fontSize * text.lineHeight >
      text.height + 1
    )
      add("TEXT_OVERFLOW", 30, text.id);
    if (text.contrastRatio && text.contrastRatio < 4.5)
      add("LOW_CONTRAST", 18, text.id);
  }
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++)
      if (overlap(texts[i], texts[j]) > 4)
        add("TEXT_OVERLAP", 25, `${texts[i].id}/${texts[j].id}`);
  const art = elements.find((e) => e.id === "artwork"),
    bg = elements.find((e) => e.id === "background-blur");
  if (!art && !bg && !elements.some(element=>element.id.startsWith('movie-art-'))) add("NO_ARTWORK", 15, "artwork");
  if (art) {
    const protectedZone = {
      x: art.x + art.width * 0.16,
      y: art.y + art.height * 0.15,
      width: art.width * 0.68,
      height: art.height * 0.62,
    };
    for (const text of texts)
      if (overlap(protectedZone, text) > text.width * text.height * 0.12)
        add("SUBJECT_OVERLAP", 20, text.id);
    if (art.width * art.height < scene.width * scene.height * 0.1)
      add("SMALL_ARTWORK", 15, art.id);
  }
  const logo = elements.find((e) => e.role === "logo");
  if (
    logo &&
    (logo.width < scene.width * 0.13 || logo.height < scene.height * 0.04)
  )
    add("SMALL_LOGO", 12, logo.id);
  const { campaignHierarchy } = require("./hierarchy");
  const clamp = value => Math.round(Math.max(0, Math.min(100, value)));
  const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const hierarchy = campaignHierarchy(scene.sourceDraft);
  const find = id => texts.find(element => element.id === id);
  const size = element => (element?.fontSize || 0) * 1080 / scene.width;
  const title = find("title"), detail = find("detail"), cta = find("cta");
  const brightGenre = ["family", "comedy"].includes(hierarchy.genre);
  const important = [title, detail, cta].filter(Boolean);
  const contrast = clamp(average(important.map(element => Math.min(100, (element.contrastRatio || 4.5) / (brightGenre ? 8 : 7) * 100))));
  const readability = clamp(average([size(title) / (hierarchy.primary === "title" ? 105 : 76), size(detail) / (hierarchy.primary === "detail" ? 115 : 65), size(cta) / (brightGenre ? 40 : 36)].map(value => Math.min(1, value) * 100)) - issues.filter(issue => ["TEXT_OVERFLOW", "SMALL_TEXT"].includes(issue.code)).length * 20);
  const primary = find(hierarchy.primary), secondary = hierarchy.primary === "title" ? detail : title;
  const hierarchyScore = clamp(100 - Math.max(0, size(secondary) / Math.max(1, size(primary)) - .72) * 55 - Math.max(0, size(cta) / Math.max(1, size(primary)) - .5) * 30);
  const weights = important.map(element => ({ center: element.x + element.width / 2, weight: Math.max(1, element.fontSize) * Math.min(30, element.text.length) }));
  if (art) weights.push({ center: art.x + art.width / 2, weight: Math.sqrt(art.width * art.height) * 6 });
  const mass = weights.reduce((sum, item) => sum + item.weight, 0);
  const center = weights.reduce((sum, item) => sum + item.center * item.weight, 0) / Math.max(1, mass) / scene.width;
  const artRatio = art ? art.width * art.height / (scene.width * scene.height) : bg ? .5 : 0;
  const balance = clamp(100 - Math.max(0, Math.abs(center - .5) - .04) * (hierarchy.genre === "horror" ? 140 : 220) - Math.max(0, .25 - artRatio) * 160 - issues.filter(issue => /OVERLAP/.test(issue.code)).length * 25);
  const brandingText = [find("cinema"), find("website")].filter(Boolean);
  const branding = clamp((logo ? Math.min(100, logo.width / scene.width / .21 * 100) : scene.sourceDraft?.signatureId === "none" ? 80 : 25) - brandingText.filter(element => size(element) < 20).length * 15 - texts.filter(element => logo && overlap(element, logo) > 4).length * 25);
  const safeArea = clamp(100 - issues.filter(issue => issue.code === "SAFE_AREA").length * 20 - elements.filter(element => element.role === "logo" && (element.x < scene.width * .025 || element.x + element.width > scene.width * .975 || element.y + element.height > bottom)).length * 25);
  const footer = clamp(100 - brandingText.filter(element => element.y + element.height > bottom || size(element) < 18).length * 30 - (logo && brandingText.some(element => overlap(element, logo) > 4) ? 35 : 0));
  const commercialClarity = clamp((title ? 35 : 0) + (cta ? 30 : 0) + (detail ? 20 : 0) + (logo || find("cinema") ? 15 : 0) - (hierarchy.needsDate && !/\d/.test(scene.sourceDraft?.date || "") ? 18 : 0) - (hierarchy.needsPrice && !/\d/.test(scene.sourceDraft?.price || "") ? 18 : 0) - Math.max(0, 28 - size(cta)));
  const components = { contrast, hierarchy: hierarchyScore, readability, balance, branding, commercialClarity, safeArea, footer };
  const brightness = scene.visualMetrics?.brightness;
  const chroma = scene.visualMetrics?.chroma || 0;
  const genreFit = brightness === undefined ? 80 : hierarchy.genre === "horror" ? clamp(100 - Math.max(0, brightness - .4) * 160) : brightGenre ? clamp(100 - Math.max(0, .22 - brightness) * 200 - Math.max(0, .12 - chroma) * 100) : hierarchy.genre === "action" ? clamp(contrast * .7 + Math.min(1, chroma / .18) * 30) : 90;
  const rules = scene.sourceDraft?.contentRules || {};
  const near = (a,b) => a && b && Math.abs(a.x-b.x) < scene.width*.05 && Math.abs(b.y-(a.y+a.height)) < scene.height*.04;
  if(rules.mustKeepDateNearPremiere && !near(find('subtitle'),detail)) add('DATE_DISCONNECTED',25,'detail');
  if(rules.mustShowWebsite && (!find('website')?.text || !near(cta,find('website')))) add('WEBSITE_DISCONNECTED',25,'website');
  if(rules.mustShowSessions && scene.sourceDraft.schedule?.count && !texts.some(element=>/\d{2}:\d{2}/.test(element.text))) add('MISSING_SESSIONS',30,'detail');
  if(rules.mustShowMultipleMovies && (scene.sourceDraft.programMovies?.length || 0)<2) add('MISSING_MOVIES',35,'title');
  const coherence = clamp(100-issues.filter(issue=>['DATE_DISCONNECTED','WEBSITE_DISCONNECTED','MISSING_SESSIONS','MISSING_MOVIES'].includes(issue.code)).reduce((sum,issue)=>sum+issue.penalty,0));
  const score = clamp((contrast * .14 + hierarchyScore * .15 + readability * .17 + balance * .08 + branding * .08 + commercialClarity * .17 + safeArea * .1 + footer * .07 + genreFit * .04)*.85+coherence*.15);
  const strengths = Object.entries({ readability: "boa leitura", contrast: "contraste forte", hierarchy: "hierarquia clara", branding: "marca legível", commercialClarity: "mensagem comercial clara", balance: "equilíbrio entre imagem e texto" }).filter(([key]) => components[key] >= 85).slice(0, 3).map(([, label]) => label);
  return {
    score,
    total: score,
    ...components,
    genreFit,
    coherence,
    explanation: strengths.length ? strengths.join(", ") + "." : "Composição experimental: revise os pontos de atenção antes de publicar.",
    priority: hierarchy.order,
    accepted:
      score >= 65 &&
      !issues.some((i) =>
        ["TEXT_OVERLAP", "TEXT_OVERFLOW", "SUBJECT_OVERLAP",'DATE_DISCONNECTED','WEBSITE_DISCONNECTED','MISSING_SESSIONS','MISSING_MOVIES'].includes(i.code),
      ),
    issues,
    method: "commercial-curation-heuristic-v2",
  };
}
module.exports = { scoreComposition };
