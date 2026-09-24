const legacy = require("../../socialStudioService");
const { templateById } = require("../templates/registry");
const { PALETTES } = require("./palette");
const { normalizeComposition, normalizeMotion, normalizeDirection } = require("../composition-engine/config");

function entityById(items, id) {
  return (Array.isArray(items) ? items : []).find((item) => String(item.id) === String(id)) || null;
}

function genreProfile(movie = {}) {
  const genres = [movie.genre, ...(movie.genres || [])].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/terror|horror|suspense/.test(genres)) return { id: "horror", recommendedStyle: "cinematic", label: "Cinematográfico escuro" };
  if (/fantasia|fantasy/.test(genres)) return { id: "fantasy", recommendedStyle: "immersive", label: "Fantasia imersiva" };
  if (/animacao|familia|infantil/.test(genres)) return { id: "family", recommendedStyle: "impact", label: "Impacto colorido" };
  if (/acao|aventura/.test(genres)) return { id: "action", recommendedStyle: "impact", label: "Impacto" };
  if (/romance/.test(genres)) return { id: "romance", recommendedStyle: "clean", label: "Clean elegante" };
  if (/drama/.test(genres)) return { id: "drama", recommendedStyle: "cinematic", label: "Cinematográfico" };
  if (/comedia|comedy/.test(genres)) return { id: "comedy", recommendedStyle: "split", label: "Comédia editorial" };
  return { id: "cinema", recommendedStyle: "cinematic", label: "Cinematográfico" };
}

function normalizeV2Draft(input = {}, context = {}) {
  const template = templateById(input.templateId);
  const legacyTemplateId = template.id === "club-plan"
    ? "cinema-club"
    : template.id === "ticket-offer" ? "movie-price" : template.id === "concession-offer" ? "concession-combo" : template.id === "movie-presale" ? "movie-premiere" : ['sessions-today','sessions-week','multi-movies'].includes(template.id) ? 'movie-highlight' : template.id;
  const legacyDraft = legacy.normalizeDraft({ ...input, templateId: legacyTemplateId }, context);
  const commercial = ['concession-combo','concession-offer','online-ticket','club-plan'].includes(template.id);
  const relatedMovie = commercial && template.id!=='club-plan' ? entityById((context.movies || []).filter(movie=>movie.catalogued!==false), input.relatedMovieId) : null;
  const movie = commercial ? relatedMovie : template.id==='ticket-offer' && input.movieId==='' ? null : entityById(context.movies, input.movieId) || (template.type === 'movie' ? legacyDraft.entities.movie : null);
  const concession = entityById(context.concessions, input.concessionId) || legacyDraft.entities.concession;
  const clubPlan = entityById(context.clubPlans, input.clubPlanId) || legacyDraft.entities.clubPlan;
  const profile = genreProfile(movie || {});
  const design = require('../contracts/campaign').normalizeDesign(input, profile.recommendedStyle);
  const requestedStyle = input.style === "automatic" || !input.style ? profile.recommendedStyle : String(input.style);
  const style = template.styles.includes(requestedStyle) ? requestedStyle : template.styles[0];
  const draft = {
    ...legacyDraft,
    ...design,
    ...require('../scene/customization').normalizeCustomization(input,context),
    relatedMovieId:relatedMovie?.id || '',
    dateTextMode:input.dateTextMode==='automatic'?'automatic':'manual',
    templateId: template.id,
    style,
    automaticStyle: input.automaticStyle === true || (!input.layoutId && (input.style === "automatic" || !input.style)),
    polish: input.polish === true,
    artDirection: normalizeDirection(input.artDirection),
    paletteId: PALETTES.some((item) => item.id === input.paletteId) ? input.paletteId : "automatic",
    rendererVersion: "v2",
    copyTone: require('../copy-engine').TONES.includes(input.copyTone) ? input.copyTone : 'automatic',
    copyDensity: ['short','medium','long'].includes(input.copyDensity) ? input.copyDensity : 'medium',
    copyBrief: String(input.copyBrief || '').trim().slice(0,500),
    offerTerms: String(input.offerTerms || '').trim().slice(0,300),
    offerHeadline: String(input.offerHeadline || '').trim().slice(0,100),
    offerBadge: String(input.offerBadge || '').trim().slice(0,44),
    oldPrice: input.oldPrice === '' || input.oldPrice == null ? undefined : Number(input.oldPrice),
    ticketCampaignMode: input.ticketCampaignMode==='promotional'?'promotional':'standard',
    campaignRecurrence: input.campaignRecurrence==='weekly'?'weekly':'none',
    campaignDays: String(input.campaignDays || '').trim().slice(0,90),
    campaignAudience: input.campaignAudience==='all'?'all':'selected',
    copyLocks:Object.fromEntries(Object.keys(require('../copy-engine').FIELD_MAP).map(field=>[field,input.copyLocks?.[field]===true])),
    genreProfile: profile,
    composition: normalizeComposition({...input.composition,look:design.look}, profile.id),
    motion: normalizeMotion(input.motion),
    entities: { movie, concession, clubPlan },
    movieId: movie?.id || ''
  };
  if(template.id==='online-ticket' && (!input.signatureId || input.signatureId==='automatic')) draft.signatureId='classic';
  if(require('../contracts/concession-campaign').isConcession(draft)) {
    const campaign=require('../contracts/concession-campaign');
    draft.concessionDirection=campaign.normalizeConcession(input,concession || {});
    const copy=campaign.concessionCopy(concession || {},draft.concessionDirection,draft.concessionDirection.seed,{relatedMovieId:draft.relatedMovieId,movie, density:'short'});
    if(input.subtitle===undefined)draft.subtitle=copy.kicker;
    if(input.auxiliaryText===undefined)draft.auxiliaryText=copy.supportingText;
    if(input.cta===undefined)draft.cta=copy.cta;
    draft.price=copy.detail;
    if(!input.signatureId || input.signatureId==='automatic')draft.signatureId='classic';
  }

  if (template.id === "movie-presale") {
    if (input.subtitle === undefined) draft.subtitle = "PRÉ-VENDA ABERTA";
    if (input.cta === undefined) draft.cta = "GARANTA NA PRÉ-VENDA";
  }
  if (template.id === "club-plan") {
    draft.clubPlanId = clubPlan?.id || "";
  }
  if(input.layoutId) draft.style = design.layoutId;
  if(template.id==='ticket-offer') {
    if(!input.layoutId && (input.style==='automatic' || !input.style)) draft.style='price-impact';
    if(['impact','hero-left','hero-right','typography-dominant'].includes(draft.style)) draft.style='price-impact';
  }
  require('./content-rules').applyContentRules(draft, input, context);
  draft.signatureScaleMode=input.signatureScaleMode==='automatic' || input.signatureScale===undefined ? 'automatic' : 'manual';
  if(template.id==='ticket-offer') draft.signatureScale=Math.max(70,Math.min(180,Number(input.signatureScale)||100));
  draft.brandProminence=['subtle','normal','strong'].includes(input.brandProminence)?input.brandProminence:'normal';
  Object.assign(draft,require('../composition-engine/artwork-policy').normalizeArtwork(input,commercial && template.id!=='online-ticket' ? null : movie));
  if(['movie-price','ticket-offer'].includes(template.id)) {
    const priceInput=template.id==='ticket-offer' && !input.priceSelection && !input.price ? {...input,priceSelection:{mode:'full'}} : input;
    const priceMovie=template.id==='ticket-offer' && !movie ? {sessions:(context.movies || []).filter(item=>item.catalogued!==false).flatMap(item=>item.sessions || [])} : draft.entities.movie;
    draft.priceInfo=require('../contracts/price').resolvePriceSelection(priceInput,priceMovie,context.now);
    draft.priceSelection=draft.priceInfo.selection;
    draft.price=draft.priceInfo.formatted;
    if(template.id==='movie-price') draft.subtitle=draft.priceInfo.label || 'SELECIONE O TIPO DE INGRESSO';
    else if(input.subtitle===undefined) draft.subtitle='INGRESSOS EM DESTAQUE';
  }
  if(template.id==='concession-offer') {
    const price=Number(draft.entities.concession?.price);
    draft.price=Number.isFinite(price) && price>0 ? price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '';
  }
  if(template.id==='ticket-offer') {
    draft.campaignConcept=require('../contracts/ticket-campaign').ticketCampaignConcept(draft);
    draft.style=require('../contracts/ticket-campaign').selectTicketFamily(draft,Boolean(input.imageUrl || movie?.posterUrl));
    if(!movie) {draft.title=input.title || draft.campaignConcept.headline;draft.imageUrl=input.imageUrl || '';}
  }
  if(draft.programMood) {
    draft.genreProfile={...draft.genreProfile,id:draft.programMood};
    draft.composition=normalizeComposition({...input.composition,look:design.look},draft.programMood);
  }
  const {buildCampaignContent,validateCampaignContent} = require('../contracts/content');
  draft.content = buildCampaignContent(draft,input,context);
  draft.primaryDateKind = draft.content.primaryDateKind;
  draft.releaseDate = draft.content.releaseDate;
  draft.presaleStartDate = draft.content.presaleStartDate;
  draft.sessionDate = draft.content.sessionDate;
  if(template.id==='movie-highlight' && draft.dateTextMode==='automatic' && draft.content.primaryDate) {
    draft.contentRules.mustShowDate=true;
    draft.contentRules.mustKeepDateNearPremiere=true;
  }
  if(input.date===undefined || draft.dateTextMode==='automatic') {
    const value=draft.content.primaryDate;
    draft.date=/^\d{4}-\d{2}-\d{2}$/.test(value)?new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)).toUpperCase():value;
  }
  draft.actionDestination = draft.content.action.destination;
  const editorial=require('../contracts/artwork-layout');
  draft.movieFamily=editorial.isMovie(draft)?editorial.movieFamily(input,draft.formatId):'';
  if(draft.movieFamily) {draft.style=draft.movieFamily;draft.layoutId=draft.movieFamily;}
  if((editorial.isMovie(draft) || editorial.isProgramme(draft)) && !draft.copyLocks.cta) {
    draft.cta=editorial.campaignCTA(draft);
    draft.content.action.label=draft.cta;
  }
  draft.actionDestinationType = draft.content.action.destinationType;
  if(draft.dateTextMode==='automatic' && /^movie-/.test(template.id) && !draft.copyLocks.kicker && /^(ESTREIA|SESSÃO|PRÉ-VENDA|LANÇAMENTO INTERNACIONAL)/i.test(draft.subtitle || '')) {
    draft.subtitle=draft.content.primaryDateLabel;
    draft.content.kicker=draft.subtitle;
  }
  draft.semanticValidation = validateCampaignContent(draft.content);
  draft.contentNotices = [...draft.contentNotices.filter(n=>!draft.semanticValidation.errors.some(e=>e.code===n.code)), ...draft.semanticValidation.errors];
  return draft;
}

function draftNotices(input = {}, context = {}) {
  const draft = normalizeV2Draft(input, context);
  const correction=require('./today-correction').todayCorrection(draft,context);
  const contentNotices=draft.contentNotices.map(notice=>notice.code==='TODAY_MISMATCH' && correction ? {...notice,correction} : notice);
  if(['sessions-today','sessions-week','multi-movies'].includes(draft.templateId)) return contentNotices;
  const legacyId = draft.templateId === "club-plan" ? "cinema-club" : draft.templateId === "movie-presale" ? "movie-premiere" : draft.templateId;
  const notices = legacy.draftNotices({ ...draft, templateId: legacyId }, context);
  if (["movie-premiere", "movie-highlight", "movie-price", "movie-presale"].includes(draft.templateId)) {
    notices.unshift({
      type: "info",
      code: "STYLE_RECOMMENDATION",
      message: `${draft.genreProfile.label} recomendado a partir do gênero. Você pode escolher outra variação.`
    });
  }
  return [...notices, ...contentNotices];
}

module.exports = { draftNotices, genreProfile, normalizeV2Draft };
