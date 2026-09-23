const DAYS={segunda:'SEGUNDA',terca:'TERÇA',quarta:'QUARTA',quinta:'QUINTA',sexta:'SEXTA',sabado:'SÁBADO',domingo:'DOMINGO'};

function normalizeDays(value='') {
  const tokens=String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[,;/]+|\s+e\s+/).map(part=>part.trim().replace(/-feira$/,'')).filter(Boolean);
  const unique=[...new Set(tokens.filter(day=>Object.hasOwn(DAYS,day)))];
  return {days:unique,invalid:tokens.some(day=>!Object.hasOwn(DAYS,day))};
}

function formatCampaignSession(session,compact=false) {
  if(!session?.date || !/^\d{4}-\d{2}-\d{2}$/.test(session.date)) return '';
  const date=new Date(`${session.date}T12:00:00Z`);
  if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==session.date) return '';
  const time=/^([01]\d|2[0-3]):[0-5]\d$/.test(session.time || '')?session.time:'';
  if(compact) return `${new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(date)}${time?` • ${time}`:''}`;
  const long=new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',timeZone:'UTC'}).format(date).toLocaleUpperCase('pt-BR');
  const hour=time?.endsWith(':00')?`${Number(time.slice(0,2))}H`:time?.replace(':','H');
  return `${long}${hour?` • ${hour}`:''}`;
}

function ticketCampaignConcept(draft) {
  const mode=draft.ticketCampaignMode==='promotional'?'promotional':'standard';
  const {days}=normalizeDays(draft.campaignDays);
  const weekly=mode==='promotional' && draft.campaignRecurrence==='weekly' && days.length>0;
  const allHalf=mode==='promotional' && draft.campaignAudience==='all' && (draft.priceInfo?.selection?.mode==='half' || /^meia(?:\b|-)/i.test(draft.priceInfo?.ticketType || ''));
  const from=Boolean(draft.priceInfo?.from || draft.priceInfo?.selection?.mode==='minimum');
  const dayLine=weekly?`TODA ${days.map(day=>DAYS[day]).join(' E ')}`:'';
  const headline=draft.offerHeadline || (allHalf?'TODO MUNDO PAGA MEIA':weekly?'SESSÕES COM PREÇO ESPECIAL':from?'INGRESSOS A PARTIR DE':'INGRESSOS EM DESTAQUE');
  const eyebrow=dayLine || (mode==='promotional'?'OFERTA CONFIRMADA':'NA TELA GRANDE');
  const pricePrompt=from?(headline.includes('A PARTIR DE')?'VALOR POR INGRESSO':'A PARTIR DE'):allHalf?'VALOR POR INGRESSO':draft.priceInfo?.ticketType || 'INGRESSO';
  return {headline,eyebrow,pricePrompt,mode,weekly,allHalf,days,from};
}

function selectTicketFamily(draft,hasArtwork) {
  if(!draft.automaticStyle) return draft.style;
  const concept=ticketCampaignConcept(draft);
  if(draft.oldPrice) return 'offer-counter';
  if(concept.weekly) return concept.allHalf?'campaign-led':'ticket-burst';
  if(concept.mode==='promotional' && !hasArtwork) return 'cinema-pop';
  if(draft.offerHeadline && draft.offerHeadline.length>26) return 'promo-editorial';
  if(hasArtwork && draft.offerHeadline) return 'campaign-led';
  if(Number(draft.priceInfo?.value)>=100) return 'promo-editorial';
  return 'price-impact';
}

function validateTicketLayout(scene) {
  const flatten=(items,origin={x:0,y:0,rotation:0})=>items.filter(e=>e.visible!==false).flatMap(e=>{
    const angle=origin.rotation*Math.PI/180;
    const absolute={...e,x:origin.x+e.x*Math.cos(angle)-e.y*Math.sin(angle),y:origin.y+e.x*Math.sin(angle)+e.y*Math.cos(angle),rotation:origin.rotation+(e.rotation || 0)};
    return e.type==='group'?flatten(e.children || [],absolute):[absolute];
  });
  const elements=flatten(scene.elements);
  const important=elements.filter(e=>e.visible!==false && (e.type==='text' || ['artwork','logo'].includes(e.id)));
  const bounds=e=>{
    const r=(e.rotation || 0)*Math.PI/180;
    const points=[[0,0],[e.width,0],[e.width,e.height],[0,e.height]].map(([x,y])=>[e.x+x*Math.cos(r)-y*Math.sin(r),e.y+x*Math.sin(r)+y*Math.cos(r)]);
    return {x:Math.min(...points.map(p=>p[0])),y:Math.min(...points.map(p=>p[1])),right:Math.max(...points.map(p=>p[0])),bottom:Math.max(...points.map(p=>p[1]))};
  };
  const collisions=[];
  for(let i=0;i<important.length;i++) for(let j=i+1;j<important.length;j++) {
    const a=bounds(important[i]),b=bounds(important[j]);
    if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>2) collisions.push(`${important[i].id} / ${important[j].id}`);
  }
  const top=scene.formatId==='story'?.10:.04,bottom=scene.formatId==='story'?.90:.95;
  const safe=important.filter(e=>{const b=bounds(e);return b.x<scene.width*.035 || b.y<scene.height*top || b.right>scene.width*.965 || b.bottom>scene.height*bottom;}).map(e=>e.id);
  const textOverflow=important.filter(e=>e.type==='text' && (e.fontSize<20 || e.text.split('\n').length*e.fontSize*(e.lineHeight || 1)>e.height+1)).map(e=>e.id);
  return {valid:!collisions.length&&!safe.length&&!textOverflow.length,collisions,safe,textOverflow};
}

function validateLayoutCollisions(scene,{repair=false}={}) {
  if(repair) {
    const title=scene.elements.find(e=>e.id==='title'),art=scene.elements.find(e=>e.id==='artwork');
    if(title && art && validateTicketLayout(scene).collisions.includes('title / artwork')) {
      art.x=scene.width*.74;
      art.width=Math.min(art.width,scene.width*.195);
      title.width=Math.min(title.width,art.x-title.x-scene.width*.045);
    }
    for(const e of scene.elements.filter(e=>e.type==='text')) {
      const fitted=require('../scene/factory').wrapText(e.text,e.width,e.height,e.fontSize,Math.max(1,Math.floor(e.height/20/1.12)));
      if(fitted.fontSize>=20) Object.assign(e,fitted);
    }
  }
  return validateTicketLayout(scene);
}
module.exports={normalizeDays,formatCampaignSession,ticketCampaignConcept,selectTicketFamily,validateTicketLayout,validateLayoutCollisions};
