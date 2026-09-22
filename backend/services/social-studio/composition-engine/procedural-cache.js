const entries=new Map();
const MAX_BYTES=32*1024*1024,TTL=20*60*1000;
let bytes=0,hits=0,misses=0;
function cachedPixels(key,build) {
  const entry=entries.get(key);
  if(entry && entry.expires>Date.now()) {hits++;entries.delete(key);entries.set(key,entry);return entry.buffer;}
  if(entry) {bytes-=entry.buffer.length;entries.delete(key);}
  misses++;
  const buffer=build();
  if(buffer.length>MAX_BYTES) return buffer;
  while(bytes+buffer.length>MAX_BYTES || entries.size>=48) {const oldest=entries.keys().next().value;bytes-=entries.get(oldest).buffer.length;entries.delete(oldest);}
  entries.set(key,{buffer,expires:Date.now()+TTL});bytes+=buffer.length;
  return buffer;
}
module.exports={cachedPixels,proceduralCacheStats:()=>({entries:entries.size,bytes,hits,misses,maxBytes:MAX_BYTES})};
