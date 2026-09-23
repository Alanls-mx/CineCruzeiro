const {normalizeScene} = require('./schema');
function wrapSchedule(value,width,height,preferred) {
  const {wrapText}=require('./factory');
  const paragraphs=String(value || '').split('\n');
  for(let size=preferred;size>=16;size--) {
    const lines=paragraphs.map(line=>wrapText(line,width,height,size,4));
    if(lines.every(line=>line.fontSize===size) && lines.reduce((sum,line)=>sum+line.text.split('\n').length,0)*size*1.12<=height) return {text:lines.map(line=>line.text).join('\n'),fontSize:size};
  }
  return wrapText(value,width,height,16,12);
}

function enforceContentLayout(scene) {
  const {wrapText} = require('./factory');
  const draft = scene.sourceDraft, rules = draft.contentRules || {};
  const get = id=>scene.elements.find(item=>item.id===id);
  const fit = (item,preferred,lines=4)=>Object.assign(item,wrapText(item.text,item.width,item.height,preferred,lines));
  if(draft.templateId==='online-ticket') {
    const detail=get('detail'),description=get('description');
    if(detail && description) {Object.assign(description,{x:detail.x,y:detail.y,width:detail.width,height:detail.height});fit(description,36,6);scene.elements=scene.elements.filter(item=>item.id!=='detail' && item.id!=='detail-band');}
  }
  if(rules.mustShowSessions && get('description') && draft.schedule?.text) {
    const item=get('description');Object.assign(item,wrapSchedule(draft.schedule.text,item.width,item.height,item.fontSize));
  }
  if(rules.mustKeepDateNearPremiere) {
    const callout=get('subtitle'),date=get('detail');
    if(callout && date) {
      if(draft.content?.primaryDateLabel) {
        const label=draft.content.primaryDateLabel;
        const message=String(draft.subtitle || '').trim();
        callout.text=message && message.toUpperCase()!==label ? `${message} • ${label}` : label;
      }
      const height=date.height, calloutHeight=Math.max(30,Math.min(height*.28,52));
      Object.assign(callout,{x:date.x,y:date.y,width:date.width,height:calloutHeight,align:date.align});
      Object.assign(date,{y:date.y+calloutHeight+8,height:Math.max(24,height-calloutHeight-8)});
      fit(callout,32,2);fit(date,date.fontSize,3);
    }
  }
  if(rules.mustKeepWebsiteNearCTA && (draft.actionDestination || draft.website)) {
    const cta=get('cta'), website=get('website');
    if(cta && website) {
      const bottom=scene.height*(scene.formatId==='story'?.86:.88);
      const total=Math.max(cta.height,scene.height*.075);
      cta.y=Math.min(cta.y,bottom-total);
      cta.height=total*.48;
      Object.assign(website,{x:cta.x,y:cta.y+cta.height+6,width:cta.width,height:total*.45,align:cta.align,text:(draft.actionDestination || draft.website).replace(/^https?:\/\//,'').replace(/\/$/,'')});
      fit(cta,Math.max(32,cta.fontSize),2);fit(website,30,2);
    }
  }
  const detail=get('detail'),cta=get('cta'),website=get('website');
  if(detail && cta && detail.y+detail.height>cta.y && detail.x<cta.x+cta.width && cta.x<detail.x+detail.width) {
    detail.y=Math.max(scene.height*.035,cta.y-detail.height-10);
  }
  if(detail && website && detail.y+detail.height>website.y && detail.x<website.x+website.width && website.x<detail.x+detail.width) {
    detail.y=Math.max(scene.height*.035,website.y-detail.height-10);
  }
  const description=get('description');
  if(detail && description && detail.y<description.y+description.height && description.y<detail.y+detail.height && detail.x<description.x+description.width && description.x<detail.x+detail.width) {
    if(description.x-detail.x>=scene.width*.16) {
      detail.width=description.x-detail.x-12;
      fit(detail,detail.fontSize,3);
    } else if(detail.x-description.x>=scene.width*.16) {
      description.width=detail.x-description.x-12;
      fit(description,description.fontSize,6);
    }
  }
  return scene;
}

function buildProgrammeScene({draft,format,brand,palette,logoUrl,sourceUrl}) {
  const {wrapText}=require('./factory');
  const w=format.width,h=format.height,top=format.id==='story'?h*.075:h*.045,bottom=h*(format.id==='story'?.88:.95),m=w*.065;
  const elements=[];
  const tx=(id,value,x,y,width,height,size=40,props={})=>elements.push({id,name:id,type:'text',role:id,visible:true,opacity:1,x,y,width,height,fontFamily:'Social Text',fontWeight:600,fill:'#ffffff',lineHeight:1.12,align:'left',...(id==='detail'||id.startsWith('sessions-')?wrapSchedule(value,width,height,size):wrapText(value,width,height,size,8)),...props});
  const im=(id,src,x,y,width,height,role='background')=>src && elements.push({id,name:id,type:'image',role,src,x,y,width,height,fit:'contain',focusX:50,focusY:50,opacity:1,visible:true,locked:true});
  const multi=draft.templateId==='multi-movies';
  const titleHeight=h*.09;
  tx('subtitle',draft.subtitle,m,top,w-2*m,h*.03,30,{fill:palette.accentColor});
  tx('title',draft.title,m,top+h*.04,w-2*m,titleHeight,66,{fontFamily:'Social Display',fontWeight:900});
  const y=top+h*.16,ctaY=bottom-h*.15,areaH=ctaY-y-h*.025;
  if(multi) {
    const movies=draft.programMovies;
    const count=movies.length,layout=draft.multiLayout;
    const gap=w*.024;
    const slots=[];
    if(layout==='summary' || layout==='editorial' && count<=4) {
      const rowH=(areaH-gap*Math.max(0,count-1))/Math.max(1,count);
      movies.forEach((_,i)=>slots.push({x:m,y:y+i*(rowH+gap),width:w-2*m,height:rowH,horizontal:true}));
    } else if(layout==='featured' && count>2) {
      slots.push({x:m,y,width:(w-2*m)*.47,height:areaH});
      const rightX=m+(w-2*m)*.5,cols=count>4?2:1,rows=Math.ceil((count-1)/cols),width=((w-2*m)*.5-gap*(cols-1))/cols,height=(areaH-gap*(rows-1))/rows;
      movies.slice(1).forEach((_,i)=>slots.push({x:rightX+(i%cols)*(width+gap),y:y+Math.floor(i/cols)*(height+gap),width,height}));
    } else {
      const cols=count<=2?count:count===3 && format.id!=='story'?3:count>4 && format.id==='square'?3:2;
      const rows=Math.ceil(count/Math.max(1,cols)),width=(w-2*m-gap*(cols-1))/Math.max(1,cols),height=(areaH-gap*(rows-1))/Math.max(1,rows);
      movies.forEach((_,i)=>slots.push({x:m+i%cols*(width+gap),y:y+Math.floor(i/cols)*(height+gap),width,height}));
    }
    movies.forEach((movie,i)=>{
      const slot=slots[i],horizontal=slot.horizontal;
      const editorial=horizontal && layout==='editorial';
      const reverse=editorial && i%2===1;
      const imageFraction=editorial?.28:.20;
      const textWidth=horizontal?slot.width*(editorial?.68:.76):slot.width;
      const titleHeight=Math.max(32,slot.height*(horizontal?.32:.16));
      const sessionHeight=draft.showSessions?Math.max(58,slot.height*(horizontal?.64:.24)):0;
      const posterHeight=horizontal?slot.height:Math.max(24,slot.height-titleHeight-sessionHeight-12);
      const titleFirst=layout==='poster-footer' && !horizontal;
      im(`movie-art-${i}`,movie.posterUrl,reverse?slot.x+slot.width*(1-imageFraction):slot.x,slot.y+(titleFirst?titleHeight+6:0),horizontal?slot.width*imageFraction:slot.width,posterHeight);
      const textX=slot.x+(horizontal && !reverse?slot.width*(imageFraction+.04):0),textY=horizontal?slot.y:slot.y+posterHeight+5;
      tx(`movie-title-${i}`,movie.title,textX,titleFirst?slot.y:textY,textWidth,titleHeight,count>4?30:38,{fontFamily:'Social Display',fontWeight:900});
      if(draft.showSessions) tx(`sessions-${i}`,movie.schedule.text || 'Horários no site',textX,textY+titleHeight+6,textWidth,Math.min(sessionHeight,slot.y+slot.height-textY-titleHeight-6),count>4?24:28);
      if(layout==='editorial' || layout==='poster-footer') elements.push({id:`tile-line-${i}`,name:'Separador',type:'shape',x:slot.x,y:slot.y+slot.height,width:slot.width,height:2,fill:palette.accentColor,opacity:.65});
    });
  } else {
    im('artwork',sourceUrl,m,y,(w-2*m)*.42,areaH);
    const textX=m+(w-2*m)*.47,textW=(w-2*m)*.53;
    tx('detail',draft.schedule.text || 'Sessões disponíveis no site',textX,y,textW,areaH,54,{role:'sessions',fontFamily:'Social Display',fontWeight:900});
  }
  tx('cta',draft.cta,m,ctaY,w-2*m,h*.04,36);
  tx('website',draft.website,m,ctaY+h*.045,w-2*m,h*.035,30,{required:true,protected:true});
  elements.push({id:'divider',name:'Divisor',type:'shape',x:m,y:bottom-h*.055,width:w-2*m,height:1,fill:'#c8d1dc',opacity:.4});
  tx('cinema',brand.name,m,bottom-h*.045,w*.55,h*.04,28);
  im('logo',logoUrl,w-m-w*.25,bottom-h*.048,w*.25,h*.048,'logo');
  const {entities,...sourceDraft}=draft;
  return normalizeScene({id:`scene-${draft.templateId}-${format.id}`,templateId:draft.templateId,formatId:format.id,width:w,height:h,backgroundColor:'#090d14',motion:draft.motion,elements,sourceDraft});
}
module.exports={enforceContentLayout,buildProgrammeScene,wrapSchedule};
