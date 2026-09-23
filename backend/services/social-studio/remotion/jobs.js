const fs=require('fs/promises');
const path=require('path');
const crypto=require('crypto');
const {fork}=require('child_process');
const {normalizeAnimation,createSpec}=require('./spec');
const {flattenElements}=require('../scene/groups');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const publicJob=job=>{const {id,status,progress,error,postId,artVersion,config,plan,metrics,createdAt,updatedAt}=job;return {id,status,progress,error,postId,artVersion,config,plan,metrics,createdAt,updatedAt};};

class AnimationJobs {
  constructor(root,options={}) {
    this.root=path.resolve(root);this.jobs=new Map();this.pending=[];this.active=null;
    this.loadImage=options.loadImage;this.runner=options.runner;this.limit=10;
    this.creating=0;this.creation=Promise.resolve();
    this.ready=this.restore();
    this.cleanupTimer=setInterval(()=>this.ready.then(()=>this.cleanup()).catch(()=>{}),3600000);this.cleanupTimer.unref();
  }
  async restore() {
    await fs.mkdir(this.root,{recursive:true});
    for(const name of await fs.readdir(this.root)) {
      if(!/^[a-f0-9-]{36}\.json$/.test(name))continue;
      try {
        const job=JSON.parse(await fs.readFile(path.join(this.root,name),'utf8'));
        if(!/^[a-f0-9-]{36}$/.test(job.id))continue;
        if(['waiting','rendering'].includes(job.status)){job.status='failed';job.error='A renderização foi interrompida pelo reinício do serviço. Tente novamente.';await this.save(job);}
        this.jobs.set(job.id,job);
        await fs.rm(path.join(this.root,job.id),{recursive:true,force:true});
      }catch{/* A malformed manifest cannot expose files or stop static exports. */}
    }
    await this.cleanup();
  }
  async save(job) {
    job.updatedAt=new Date().toISOString();
    const file=path.join(this.root,`${job.id}.json`),temporary=`${file}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary,JSON.stringify(job));await fs.rename(temporary,file);
  }
  async cleanup() {
    const completed=[...this.jobs.values()].filter(j=>!['waiting','rendering'].includes(j.status)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    let bytes=0;const finalCounts=new Map();
    for(const job of completed) {
      const key=`${job.owner}:${job.postId}`;
      if(job.status==='done' && job.config.quality==='final') {
        finalCounts.set(key,(finalCounts.get(key) || 0)+1);
        if(finalCounts.get(key)<=3)continue;
      }else {
        bytes+=job.metrics?.bytes || 0;
        if(Date.now()-Date.parse(job.createdAt)<86400000 && bytes<256*1024*1024)continue;
      }
      await fs.rm(path.join(this.root,`${job.id}.${job.config.format}`),{force:true});
      await fs.rm(path.join(this.root,`${job.id}.json`),{force:true});this.jobs.delete(job.id);
    }
  }
  owned(id,owner) {
    const job=this.jobs.get(id);
    if(!job || job.owner!==owner)throw Object.assign(new Error('Animação não encontrada.'),{statusCode:404});
    return job;
  }
  async get(id,owner){await this.ready;return publicJob(this.owned(id,owner));}
  async list(postId,owner){await this.ready;return [...this.jobs.values()].filter(j=>j.owner===owner && j.postId===postId).map(publicJob).reverse();}
  async removePost(postId) {
    await this.ready;
    for(const job of [...this.jobs.values()].filter(j=>j.postId===postId)) {
      if(['waiting','rendering'].includes(job.status))await this.cancel(job.id,job.owner);
      await fs.rm(path.join(this.root,`${job.id}.${job.config.format}`),{force:true});
      await fs.rm(path.join(this.root,`${job.id}.json`),{force:true});this.jobs.delete(job.id);
    }
  }
  async file(id,owner){await this.ready;const job=this.owned(id,owner);if(job.status!=='done')throw Object.assign(new Error('O vídeo ainda não está pronto.'),{statusCode:409});return {buffer:await fs.readFile(path.join(this.root,`${job.id}.${job.config.format}`)),contentType:{mp4:'video/mp4',webm:'video/webm',gif:'image/gif'}[job.config.format],extension:job.config.format};}
  async create(input) {
    await this.ready;
    if(this.pending.length+this.creating>=this.limit)throw Object.assign(new Error('A fila de vídeo está cheia. Tente novamente em instantes.'),{statusCode:429});
    this.creating++;
    const task=this.creation.catch(()=>{}).then(()=>this.prepare(input));this.creation=task;
    try{return await task;}finally{this.creating--;}
  }
  async prepare({scene,animation,owner,postId,artVersion}) {
    await this.ready;
    if(!owner || !postId)throw new Error('Salve a campanha antes de animar.');
    if(this.pending.length>=this.limit)throw Object.assign(new Error('A fila de vídeo está cheia. Tente novamente em instantes.'),{statusCode:429});
    const config={...normalizeAnimation(animation),enabled:true},plan=createSpec(scene,config);
    const disk=await fs.statfs(this.root);
    if(disk.bavail*disk.bsize<1024*1024*1024)throw Object.assign(new Error('Espaço insuficiente para renderizar vídeo. A imagem estática continua disponível.'),{statusCode:503});
    const sceneVersion=hash(JSON.stringify(scene));
    // Hash the actual bytes too: replacing an image at the same URL invalidates the render.
    const assets={},digests=[];
    for(const src of new Set(flattenElements(scene.elements).filter(e=>e.type==='image').map(e=>e.src).filter(Boolean))) {
      const buffer=await this.loadImage(src);
      if(!Buffer.isBuffer(buffer))throw new Error('Uma imagem da arte não está disponível. Atualize a prévia antes de animar.');
      assets[src]=buffer;digests.push([src,hash(buffer)]);
    }
    const key=hash(JSON.stringify({engine:'remotion-v2.1',owner,postId,artVersion,sceneVersion,config,digests}));
    const cached=[...this.jobs.values()].find(j=>j.key===key && ['waiting','rendering','done'].includes(j.status));
    if(cached)return publicJob(cached);
    const id=crypto.randomUUID(),dir=path.join(this.root,id);
    const job={id,key,owner,postId,artVersion:artVersion || sceneVersion,sceneVersion,config,plan,status:'waiting',progress:0,createdAt:new Date().toISOString()};
    await fs.mkdir(dir,{recursive:true});
    try {
      const files={};
      for(const [src,buffer] of Object.entries(assets)){const name=`asset-${Object.keys(files).length}`;await fs.writeFile(path.join(dir,name),buffer);files[src]=name;}
      await fs.writeFile(path.join(dir,'input.json'),JSON.stringify({scene,config,files}));
      this.jobs.set(id,job);await this.save(job);this.pending.push(id);this.drain();return publicJob(job);
    }catch(error){this.jobs.delete(id);await fs.rm(dir,{recursive:true,force:true});throw error;}
  }
  async cancel(id,owner) {
    await this.ready;const job=this.owned(id,owner);
    if(!['waiting','rendering'].includes(job.status))return publicJob(job);
    job.status='cancelled';job.error='Renderização cancelada.';
    this.pending=this.pending.filter(value=>value!==id);
    if(this.active?.id===id)this.active.controller.abort();
    else await fs.rm(path.join(this.root,id),{recursive:true,force:true});
    await this.save(job);return publicJob(job);
  }
  async drain() {
    if(this.active || !this.pending.length)return;
    const id=this.pending.shift(),job=this.jobs.get(id),controller=new AbortController();
    this.active={id,controller};job.status='rendering';
    try {
      await this.save(job);
      const result=await (this.runner || runWorker)(path.join(this.root,id),{signal:controller.signal,onProgress:value=>{job.progress=Math.min(.99,value);}});
      if(controller.signal.aborted)throw new Error('Renderização cancelada.');
      await fs.rename(path.join(this.root,id,`output.${job.config.format}`),path.join(this.root,`${id}.${job.config.format}`));
      Object.assign(job,{status:'done',progress:1,plan:result.plan,metrics:result.metrics});
    }catch(error){job.status=controller.signal.aborted?'cancelled':'failed';job.error=error.message || 'Falha de renderização. Sua arte estática continua disponível.';}
    finally {
      if(this.jobs.has(id))await this.save(job).catch(()=>{});
      await fs.rm(path.join(this.root,id),{recursive:true,force:true}).catch(()=>{});
      this.active=null;await this.cleanup().catch(()=>{});this.drain();
    }
  }
}
function runWorker(dir,{signal,onProgress}) {
  return new Promise((resolve,reject)=>{
    const child=fork(path.join(__dirname,'worker.js'),[dir],{windowsHide:true,stdio:['ignore','ignore','pipe','ipc'],execArgv:['--max-old-space-size=768']});
    let result,errorText='',cancelTimer;
    child.stderr.on('data',chunk=>{errorText=(errorText+chunk).slice(-1000);});
    const cancel=()=>{if(child.connected)child.send({cancel:true});cancelTimer=setTimeout(()=>child.kill('SIGKILL'),15000);};
    const killTimer=setTimeout(()=>{errorText='O vídeo excedeu três minutos de renderização. Tente uma duração menor.';cancel();},180000);
    signal.addEventListener('abort',cancel,{once:true});
    if(signal.aborted)cancel();
    child.on('message',message=>{if(message.progress!==undefined)onProgress(message.progress);if(message.result)result=message.result;if(message.error)errorText=message.error;});
    child.on('error',reject);
    child.on('exit',code=>{
      clearTimeout(killTimer);clearTimeout(cancelTimer);signal.removeEventListener('abort',cancel);
      if(code===0 && result)resolve(result);else reject(new Error(signal.aborted?'Renderização cancelada.':errorText || 'O render excedeu os recursos ou o tempo disponível. Tente novamente.'));
    });
  });
}
module.exports={AnimationJobs};
