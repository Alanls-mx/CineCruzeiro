const {normalizeScene}=require('./schema');
const {wrapText}=require('./factory');
const {hexToRgb,mix}=require('../engine/palette');
const {SAFE,sessionDayMatches,sessionMomentParts}=require('../contracts/artwork-layout');
const {embeddedMovieTitle}=require('../composition-engine/movie-content');

const rgba=(hex,a)=>{const {r,g,b}=hexToRgb(hex);return `rgba(${r},${g},${b},${a})`;};
const luminance=hex=>{const {r,g,b}=hexToRgb(hex);return .2126*r+.7152*g+.0722*b;};
const chroma=hex=>{const {r,g,b}=hexToRgb(hex);return Math.max(r,g,b)-Math.min(r,g,b);};
function campaignSurface(palette) {
  const artColor=palette.editorialAtmosphere?.color || palette.dominantColor;
  const light=luminance(artColor)>115 && luminance(palette.dominantColor)>95;
  const base=light?mix(artColor,'#ffffff',.68):mix(palette.editorialAtmosphere?.companion || artColor,'#050808',.74);
  return {artColor,light,base};
}

function buildMovieCampaign({draft,format,palette,brand,sourceUrl,backgroundUrl,logoUrl}) {
  const w=format.width,h=format.height,safe=SAFE[format.id],top=h*safe.top,area=h*(safe.bottom-safe.top),u=w/1080;
  const square=format.id==='square',genre=draft.genreProfile?.id;
  const {artColor,light,base}=campaignSurface(palette);
  const serif=light && ['romance','comedy','drama','family'].includes(genre);
  const saturated=[palette.secondaryColor,palette.accentColor,artColor].sort((a,b)=>chroma(b)-chroma(a))[0];
  const ink=light?mix(saturated,'#291d22',.58):'#f5f5ed';
  const secondary=light?mix(artColor,'#311d1b',.68):mix(artColor,'#ffffff',.62);
  const filmAccent=light?mix(saturated,'#291d22',.34):mix(saturated,'#ffffff',.48);
  const elements=[],manifest=[];
  const box=(x,y,width,height)=>({x:x*w,y:top+y*area,width:width*w,height:height*area});
  const image=(id,src,bounds,extra={})=>{if(src)elements.push({id,name:id,role:id,type:'image',src,visible:true,opacity:1,...bounds,...extra});};
  const text=(id,value,bounds,size,extra={})=>{
    if(!String(value || '').trim())return;
    const fit=wrapText(value,bounds.width,bounds.height,size*u,extra.lines || 2);
    elements.push({id,name:id,role:id,type:'text',...bounds,...fit,fontFamily:'Social Text',fontWeight:600,fill:secondary,lineHeight:1.12,align:square?'left':'center',visible:true,opacity:1,...extra});
    if(extra.visible!==false)manifest.push({id,text:String(value).replace(/\s+/g,' ').trim()});
  };
  const heroSource=sourceUrl || backgroundUrl;
  const titlePolicy=embeddedMovieTitle(draft,heroSource);
  const embeddedTitle=titlePolicy.hide;
  const days=draft.showSessions===false?[]:draft.schedule?.days || [];
  const session=days.length?sessionMomentParts(days,{includeDate:true}):null;
  const presale=draft.templateId==='movie-presale';
  const premiere=draft.templateId==='movie-premiere';
  const commercial=draft.templateId==='movie-price';
  const secondarySession=Boolean(session && (presale || premiere || commercial));
  const sameSessionDate=premiere && sessionDayMatches(draft.content?.primaryDate || draft.date,days[0]?.date);
  const sourceRatio=draft.sourceAsset?.width/draft.sourceAsset?.height || 2/3;
  const landscapeArt=sourceRatio>1;
  const embeddedArtHeight=.68;
  const artworkBounds={x:0,y:0,width:w,height:landscapeArt?Math.min(h*.80,w/sourceRatio):embeddedTitle?h*embeddedArtHeight:h};
  const canvasRatio=artworkBounds.width/artworkBounds.height;
  const cropLoss=1-Math.min(sourceRatio/canvasRatio,canvasRatio/sourceRatio);
  const canCover=cropLoss<=.20;
  image('background-blur',embeddedTitle?heroSource:backgroundUrl || heroSource,{x:0,y:0,width:w,height:h},{role:'background',fit:embeddedTitle?'fill':'cover',focusX:draft.movieDirection?.focusX || 50,focusY:38,effects:{layer:'background',blur:embeddedTitle?40:38,brightness:embeddedTitle?.88:light?.92:.58,saturation:1,scale:embeddedTitle?1:1.16}});
  image('artwork',heroSource,artworkBounds,{role:'artwork',fit:embeddedTitle?'contain':canCover?'cover':'contain',keepRatio:true,locked:true,focusX:draft.movieDirection?.focusX || 50,focusY:draft.movieDirection?.focusY || 42,hierarchy:'primary',effects:{layer:'hero',mask:embeddedTitle?'fade-all':'cinematic-bottom',blend:embeddedTitle?27:canCover?45:72,brightness:1,scale:1}});
  const transitionStart=secondarySession?.64:embeddedTitle?.71:.63;
  const atmosphereStops=[
    {offset:0,color:rgba(base,0)},
    {offset:transitionStart,color:rgba(base,0)},
    {offset:.78,color:rgba(base,.88)},
    {offset:.88,color:rgba(base,.96)},
    {offset:1,color:rgba(base,1)}
  ];
  elements.push({id:'campaign-atmosphere',role:'ambient',type:'gradient',x:0,y:0,width:w,height:h,direction:'bottom',stops:atmosphereStops});
  if(!embeddedTitle)text('title',draft.title || draft.entities.movie?.title,box(.065,secondarySession?.60:.685,.87,.085),serif?58:64,{fontFamily:serif?'Social Editorial':'Social Display',fontWeight:serif?500:900,lineHeight:1,lines:2,align:'center',fill:ink,hierarchy:'secondary'});
  const detail=presale && draft.content?.purchaseAvailable?'PRÉ-VENDA ABERTA':commercial?draft.price:premiere?draft.date:session?.day || draft.date || 'EM BREVE';
  const detailY=secondarySession?.70:session?.79:embeddedTitle?.79:.785;
  if(session?.recurring && !sameSessionDate)text('session-kicker','A PARTIR DE',box(.065,.749,.60,.037),32,{align:'center',lines:1,fill:filmAccent,fontFamily:'Social Text',fontWeight:800});
  text('detail',detail,box(.065,detailY,session?.66:.87,secondarySession?.052:.053),presale?54:session?43:48,{fontFamily:'Social Display',fontWeight:900,align:'center',fill:light?secondary:'#ffffff',lines:1,hierarchy:presale?'primary':'secondary'});
  if(secondarySession)text('description',sameSessionDate?session.weekday:session.day,box(.065,.79,.66,.044),43,{align:'center',lines:1,fill:light?secondary:'#ffffff',fontFamily:'Social Display',fontWeight:900});
  if(session)text('session-time',session.clock,box(.065,.848,.66,.059),55,{align:'center',lines:1,fill:filmAccent,fontFamily:'Social Display',fontWeight:900});
  const ctaY=session?.916:detailY+.082;
  const compactCta=String(draft.cta || '').trim();
  text('cta',compactCta,box(.065,ctaY,.60,.037),32,{align:'center',lines:1,fill:filmAccent,fontFamily:'Social Display',fontWeight:900});
  const site=String(brand.posterWebsite || brand.website || draft.actionDestination || '');
  let website='';
  try {website=new URL(/^https?:\/\//i.test(site)?site:`https://${site}`).hostname.replace(/^www\./i,'');} catch {}
  if(website)website=`www.${website}`;
  text('website',website,box(.065,ctaY+(session?.04:.044),.60,.028),27,{align:'center',lines:1,fill:light?ink:'#ffffff'});
  const ratio=draft.signatureAsset?.width/draft.signatureAsset?.height || 2.6;
  const signatureScale=draft.signatureScaleMode==='manual'?Math.max(.7,Math.min(1.35,Number(draft.signatureScale || 100)/100)):1;
  const logoWidth=Math.min(w*.19,h*.115*ratio,w*.14*signatureScale),logoHeight=logoWidth/ratio;
  const logoBox={x:w*.935-logoWidth,y:top+area*.975-logoHeight,width:logoWidth,height:logoHeight};
  if(logoUrl)image('logo',logoUrl,logoBox,{role:'logo',protected:true,hierarchy:'branding',fit:'contain'});
  else if(draft.signatureId!=='none')text('cinema',brand.name,logoBox,28,{align:'center',lines:2,fill:secondary});
  const {entities,...sourceDraft}=draft;
  return normalizeScene({id:`scene-${draft.templateId}-${format.id}`,templateId:draft.templateId,formatId:format.id,width:w,height:h,backgroundColor:base,elements,sourceDraft:{...sourceDraft,officialMovieLayout:true,creativeMovieLayout:true,integratedCampaign:true,solidPanelAllowed:false,movieManifest:manifest,heroUsesPosterCrop:canCover && !embeddedTitle,signatureReserved:logoBox,editorialSource:heroSource,editorialTitle:draft.title}});
}

module.exports={buildMovieCampaign,campaignSurface};
