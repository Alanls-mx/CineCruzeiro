const crypto=require('crypto');
const entries=new Map();
function remember(owner,rendered){
  for(const [id,item] of entries)if(item.expires<Date.now())entries.delete(id);
  while(entries.size>=32)entries.delete(entries.keys().next().value);
  const id=crypto.randomUUID();entries.set(id,{owner,rendered,expires:Date.now()+30*60000});return id;
}
function read(owner,id){
  const item=entries.get(id);
  if(!item || item.owner!==owner || item.expires<Date.now())throw Object.assign(new Error('A prévia expirou. Atualize a arte antes de salvá-la ou animá-la.'),{statusCode:409});
  return item.rendered;
}
module.exports={remember,read};
