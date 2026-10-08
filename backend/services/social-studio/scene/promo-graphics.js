const shape=(id,x,y,width,height,fill,extra={})=>({id,name:id,role:'ambient',type:'shape',x,y,width,height,fill,locked:true,...extra});
const burstPoints=()=>Array.from({length:32},(_,i)=>{const r=i%2?.43:.5,a=i*Math.PI/16;return [.5+Math.cos(a)*r,.5+Math.sin(a)*r];}).flat();
function StarBurst(id,box,color){return shape(id,...box,color,{points:burstPoints()});}
function TiltedCard(id,box,color,rotation=-2){return shape(id,...box,color,{rotation});}
function HighlightStripe(id,box,color){return TiltedCard(id,box,color,-2);}
function PromoSticker(id,box,color){return shape(id,...box,color,{radius:Math.min(box[2],box[3])*.25,rotation:3});}
function TicketIcon(id,[x,y,w,h],color,ink){
  return [shape(id,x,y,w,h,color,{points:[0,0,1,0,1,.35,.93,.42,.93,.58,1,.65,1,1,0,1,0,.65,.07,.58,.07,.42,0,.35]}),...Array.from({length:5},(_,i)=>shape(`${id}-perforation-${i}`,x+w*.72,y+h*(.12+i*.16),w*.015,h*.07,ink))];
}
function ClapperboardIcon(id,[x,y,w,h],color,ink){
  return [shape(id,x,y+h*.25,w,h*.75,color),shape(`${id}-hinge`,x,y,w,h*.2,color,{rotation:-6}),...Array.from({length:3},(_,i)=>shape(`${id}-stripe-${i}`,x+w*(.18+i*.27),y+h*.035,w*.12,h*.14,ink,{rotation:-15})),shape(`${id}-line`,x+w*.15,y+h*.50,w*.7,h*.035,ink)];
}
function TornEdge(id,[x,y,w,h],color){
  const edge=Array.from({length:25},(_,i)=>[1-i/24,i%2?.72:1]).flat();
  return shape(id,x,y,w,h,color,{points:[0,0,1,0,...edge]});
}
module.exports={StarBurst,PriceBurst:StarBurst,TiltedCard,HighlightStripe,PromoSticker,TicketIcon,ClapperboardIcon,TornEdge};
