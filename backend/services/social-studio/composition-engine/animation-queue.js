class AnimationQueue {
  constructor({concurrency=1,limit=8}={}) {this.concurrency=Math.max(1,Math.min(2,Number(concurrency)||1));this.limit=Math.max(1,Math.min(20,Number(limit)||8));this.active=0;this.waiting=[];}
  acquire(signal) {
    return new Promise((resolve,reject)=>{
      const cancelled=()=>Object.assign(new Error('Exportação cancelada.'),{name:'AbortError',statusCode:499});
      if(signal?.aborted) return reject(cancelled());
      const start=()=>{signal?.removeEventListener('abort',abort);this.active++;let released=false;resolve(()=>{if(released)return;released=true;this.active--;this.waiting.shift()?.start();});};
      const entry={start};
      const abort=()=>{this.waiting=this.waiting.filter(item=>item!==entry);reject(cancelled());};
      if(this.active<this.concurrency) start();
      else if(this.waiting.length>=this.limit) reject(Object.assign(new Error('A fila de animações está cheia. Aguarde alguns instantes.'),{statusCode:429,code:'ANIMATION_QUEUE_FULL'}));
      else {this.waiting.push(entry);signal?.addEventListener('abort',abort,{once:true});}
    });
  }
  stats(){return {active:this.active,waiting:this.waiting.length,concurrency:this.concurrency,limit:this.limit};}
}
const animationQueue=new AnimationQueue({concurrency:process.env.SOCIAL_STUDIO_ANIMATION_WORKERS,limit:process.env.SOCIAL_STUDIO_ANIMATION_QUEUE});
module.exports={AnimationQueue,animationQueue};
