function flattenElements(elements, origin = {x:0,y:0}) {
  return elements.flatMap(e => e.type === 'group' ? (e.visible === false ? [] : flattenElements(e.children || [], {x:origin.x+e.x,y:origin.y+e.y})) : [{...e,x:e.x+origin.x,y:e.y+origin.y}]);
}
function groupElements(scene, id, ids, role = id) {
  const members=scene.elements.filter(e=>ids.includes(e.id));
  if(members.length<2) return;
  const x=Math.min(...members.map(e=>e.x)), y=Math.min(...members.map(e=>e.y));
  const width=Math.max(...members.map(e=>e.x+e.width))-x, height=Math.max(...members.map(e=>e.y+e.height))-y;
  const index=scene.elements.findIndex(e=>e.id===members[0].id);
  scene.elements=scene.elements.filter(e=>!ids.includes(e.id));
  scene.elements.splice(index,0,{id,name:role==='action'?'Chamada e destino':role==='date'?'Data e significado':id,role,type:'group',x,y,width,height,visible:true,opacity:1,children:members.map(e=>({...e,x:e.x-x,y:e.y-y}))});
}
function groupCampaignScene(scene) {
  groupElements(scene,'action-group',['cta','website'],'action');
  if(scene.sourceDraft?.contentRules?.mustShowDate) groupElements(scene,'date-group',['subtitle','detail'],'date');
  for(let i=0;i<6;i++) groupElements(scene,`movie-group-${i}`,[`movie-art-${i}`,`movie-title-${i}`,`movie-sessions-${i}`],'movie');
  return scene;
}
function validateSceneSemantics(scene) {
  const content=scene.sourceDraft?.content;
  if(!content) return {valid:true,errors:[]};
  const elements=flattenElements(scene.elements).filter(e=>e.visible!==false);
  const errors=[];
  if(content.action.label && !elements.some(e=>e.id==='cta' && e.text)) errors.push({code:'MISSING_ACTION',message:'A cena perdeu a chamada principal.'});
  if(content.action.destination && !elements.some(e=>e.id==='website' && e.text)) errors.push({code:'MISSING_DESTINATION',message:'A cena perdeu o destino da chamada.'});
  if(content.campaignType==='multi-movies') for(const [i,movie] of content.programMovies.entries()) if(!elements.some(e=>e.id===`movie-title-${i}` && e.text)) errors.push({code:'MISSING_MOVIE',movieId:movie.id,message:'Um filme selecionado não foi representado na cena.'});
  return {valid:!errors.length,errors};
}
module.exports={flattenElements,groupElements,groupCampaignScene,validateSceneSemantics};
