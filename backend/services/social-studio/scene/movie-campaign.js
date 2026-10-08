const {normalizeScene}=require('./schema');
const {wrapText}=require('./factory');
const {hexToRgb,mix}=require('../engine/palette');
const {SAFE,sessionMomentLabel}=require('../contracts/artwork-layout');

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
  const elements=[],manifest=[];
  const box=(x,y,width,height)=>({x:x*w,y:top+y*area,width:width*w,height:height*area});
  const image=(id,src,bounds,extra={})=>{if(src)elements.push({id,name:id,role:id,type:'image',src,visible:true,opacity:1,...bounds,...extra});};
  const text=(id,value,bounds,size,extra={})=>{
    if(!String(value || '').trim())return;
    const fit=wrapText(value,bounds.width,bounds.height,size*u,extra.lines || 2);
    elements.push({id,name:id,role:id,type:'text',...bounds,...fit,fontFamily:'Social Text',fontWeight:600,fill:secondary,lineHeight:1.12,align:square?'left':'center',visible:true,opacity:1,...extra});
    if(extra.visible!==false)manifest.push({id,text:String(value).replace(/\s+/g,' ').trim()});
  };
  const sourceRatio=draft.sourceAsset?.width/draft.sourceAsset?.height || 2/3;
  const landscapeArt=sourceRatio>1;
  const artworkBounds={x:0,y:0,width:w,height:landscapeArt?Math.min(h*.75,w/sourceRatio):h};
  const canvasRatio=artworkBounds.width/artworkBounds.height;
  const cropLoss=1-Math.min(sourceRatio/canvasRatio,canvasRatio/sourceRatio);
  const canCover=cropLoss<=.20;
  const heroSource=sourceUrl || backgroundUrl;
  image('background-blur',backgroundUrl || heroSource,{x:0,y:0,width:w,height:h},{role:'background',fit:'cover',focusX:draft.movieDirection?.focusX || 50,focusY:38,effects:{layer:'background',blur:38,brightness:light?.92:.58,saturation:1,scale:1.16}});
  image('artwork',heroSource,artworkBounds,{role:'artwork',fit:canCover?'cover':'contain',keepRatio:true,locked:true,focusX:draft.movieDirection?.focusX || 50,focusY:draft.movieDirection?.focusY || 42,hierarchy:'primary',effects:{layer:'hero',mask:'cinematic-bottom',blend:canCover?45:72,brightness:1,scale:1}});
  const embeddedTitle=Boolean(draft.artworkPolicy?.hideTitle || draft.artworkMetadata?.containsTitle && draft.artworkMetadata.sourceUrl===heroSource && draft.titleVisibility!=='show');
  const transitionStart=embeddedTitle ? .64 : light ? square?.29:.34 : square?.34:.39;
  const atmosphereStops=light && embeddedTitle?[
    {offset:0,color:rgba(base,0)},
    {offset:transitionStart,color:rgba(base,0)},
    {offset:.77,color:rgba(base,.72)},
    {offset:.86,color:rgba(base,.98)},
    {offset:1,color:rgba(base,.99)}
  ]:light?[
    {offset:0,color:rgba(base,0)},
    {offset:transitionStart,color:rgba(base,0)},
    {offset:.44,color:rgba(base,.63)},
    {offset:.51,color:rgba(base,.93)},
    {offset:.72,color:rgba(base,.99)},
    {offset:1,color:rgba(base,.99)}
  ]:[
    {offset:0,color:rgba(base,0)},
    {offset:transitionStart,color:rgba(base,0)},
    {offset:.68,color:rgba(base,.72)},
    {offset:.80,color:rgba(base,.94)},
    {offset:1,color:rgba(base,.97)}
  ];
  elements.push({id:'campaign-atmosphere',role:'ambient',type:'gradient',x:0,y:0,width:w,height:h,direction:'bottom',stops:atmosphereStops});
  if(!embeddedTitle)text('title',draft.title || draft.entities.movie?.title,box(.065,square?.48:.505,.87,square?.16:.245),serif?120:128,{fontFamily:serif?'Social Editorial':'Social Display',fontWeight:serif?400:900,lineHeight:serif?.96:.92,lines:4,align:'center',fill:ink,hierarchy:'primary'});
  const days=draft.showSessions===false?[]:draft.schedule?.days || [];
  const session=days.length?sessionMomentLabel(days,{includeDate:true}):'';
  const presale=draft.templateId==='movie-presale';
  const premiere=draft.templateId==='movie-premiere';
  const commercial=draft.templateId==='movie-price';
  const detail=presale && draft.content?.purchaseAvailable?'PRÉ-VENDA ABERTA':commercial?draft.price:premiere?draft.date:session || draft.date || 'EM BREVE';
  const description=(presale || premiere || commercial) && session?session:'';
  const detailY=square?.67:.76;
  text('detail',detail,box(.065,detailY,.87,.065),presale?64:53,{fontFamily:'Social Display',fontWeight:900,align:'center',fill:light?secondary:'#ffffff',lines:2,hierarchy:presale?'primary':'secondary'});
  if(description)text('description',description,box(.075,detailY+.067,.85,.042),31,{align:'center',lines:1,fill:secondary});
  const ctaY=description?detailY+.125:detailY+.085;
  const compactCta=String(draft.cta || '').trim();
  text('cta',compactCta,box(.065,ctaY,.60,.05),34,{align:'center',lines:1,fill:light?ink:'#ffffff',fontFamily:'Social Display',fontWeight:900});
  const site=String(brand.posterWebsite || brand.website || draft.actionDestination || '');
  let website='';
  try {website=new URL(/^https?:\/\//i.test(site)?site:`https://${site}`).hostname.replace(/^www\./i,'');} catch {}
  if(website)website=`www.${website}`;
  text('website',website,box(.065,ctaY+.05,.60,.035),27,{align:'center',lines:1,fill:secondary});
  const ratio=draft.signatureAsset?.width/draft.signatureAsset?.height || 2.6;
  const signatureScale=draft.signatureScaleMode==='manual'?Math.max(.7,Math.min(1.35,Number(draft.signatureScale || 100)/100)):1;
  const logoWidth=Math.min(w*.19,h*.115*ratio,w*.14*signatureScale),logoHeight=logoWidth/ratio;
  const logoBox={x:w*.935-logoWidth,y:top+area*.975-logoHeight,width:logoWidth,height:logoHeight};
  if(logoUrl)image('logo',logoUrl,logoBox,{role:'logo',protected:true,hierarchy:'branding',fit:'contain'});
  else if(draft.signatureId!=='none')text('cinema',brand.name,logoBox,28,{align:'center',lines:2,fill:secondary});
  const {entities,...sourceDraft}=draft;
  return normalizeScene({id:`scene-${draft.templateId}-${format.id}`,templateId:draft.templateId,formatId:format.id,width:w,height:h,backgroundColor:base,elements,sourceDraft:{...sourceDraft,officialMovieLayout:true,creativeMovieLayout:true,integratedCampaign:true,movieManifest:manifest,heroUsesPosterCrop:canCover,signatureReserved:logoBox,editorialSource:heroSource,editorialTitle:draft.title}});
}

module.exports={buildMovieCampaign,campaignSurface};
