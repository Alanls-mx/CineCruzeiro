const VISUAL_STYLES = ['cinematic', 'impact', 'clean', 'minimal'];
const LAYOUT_IDS = ['hero-left', 'hero-right', 'hero-center', 'full-bleed', 'editorial', 'poster-dominant', 'typography-dominant', 'split', 'diagonal', 'price-impact', 'campaign-led', 'offer-counter', 'ticket-burst', 'promo-editorial', 'cinema-pop', ...Object.keys(require('./concession-campaign').FAMILIES),...Object.keys(require('./artwork-layout').MOVIE_FAMILIES),...Object.keys(require('./artwork-layout').PRODUCT_LAYOUTS)];
const LOOKS = ['natural', 'cinematic', 'immersive', 'dramatic', 'vibrant', 'cold', 'velocity'];
const LEGACY_LAYOUTS = {cinematic:'poster-dominant', impact:'typography-dominant', clean:'editorial', minimal:'hero-center', immersive:'full-bleed'};

function normalizeDesign(input, recommended = 'cinematic') {
  const legacy = input.style || recommended;
  const visualStyle = VISUAL_STYLES.includes(input.visualStyle) ? input.visualStyle : VISUAL_STYLES.includes(legacy) ? legacy : 'cinematic';
  const layoutId = LAYOUT_IDS.includes(input.layoutId) ? input.layoutId : LAYOUT_IDS.includes(legacy) ? legacy : LEGACY_LAYOUTS[legacy] || 'hero-left';
  const look = LOOKS.includes(input.look) ? input.look : LOOKS.includes(input.composition?.look) ? input.composition.look : legacy === 'immersive' ? 'immersive' : 'cinematic';
  return {visualStyle, layoutId, look, designVersion:1};
}
module.exports = {VISUAL_STYLES, LAYOUT_IDS, LOOKS, normalizeDesign};
