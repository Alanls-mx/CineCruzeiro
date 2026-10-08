const crypto=require('crypto');
const {normalizeCampaignRequest}=require('./contract');
const {evaluate}=require('./qa');
const {normalizeV2Draft}=require('../engine/normalizer');
const {generateCopy,FIELD_MAP}=require('../copy-engine');
const {generateVariations}=require('../composition-engine/variations');
const {renderSocialPostV2}=require('../engine/renderer');

const STAGES={queued:['Na fila',0],context:['Preparando campanha',12],assets:['Buscando assets',28],copy:['Criando repertório',42],compositions:['Gerando composições',58],qa:['Verificando qualidade',82],ready:['Pronto para revisão',100],failed:['Erro',100]};
const publicRecord=record=>({...record,request:undefined,idempotencyKey:undefined});

class CampaignOrchestrator {
  constructor({repository,contextProvider,loadImage,savePreview,logger=()=>{},dependencies={}}) {
    Object.assign(this,{repository,contextProvider,loadImage,savePreview,logger});
    this.dependencies={normalizeDraft:dependencies.normalizeDraft || normalizeV2Draft,generateCopy:dependencies.generateCopy || generateCopy,generateVariations:dependencies.generateVariations || generateVariations,renderPost:dependencies.renderPost || renderSocialPostV2,evaluate:dependencies.evaluate || evaluate};
    this.running=new Set();
  }
  async create(input={},meta={}) {
    const context=await this.contextProvider();
    const request=normalizeCampaignRequest(input,{cinemaId:context.brand?.id || context.brand?.slug || context.brand?.name || 'default'});
    const now=new Date().toISOString();
    const candidate={id:crypto.randomUUID(),cinemaId:request.cinemaId,idempotencyKey:request.idempotencyKey,campaignType:request.campaignType,objective:request.objective,triggerType:request.triggerType,source:request.source,status:'queued',stage:'queued',progress:0,formats:request.formats,request,warnings:[],qa:{},result:{},attempts:0,error:null,createdBy:String(meta.createdBy || ''),createdAt:now,updatedAt:now};
    const result=await this.repository.create(candidate);
    if(result.created)this.enqueue(result.record.id);
    return {...publicRecord(result.record),duplicate:!result.created};
  }
  enqueue(id) {setImmediate(()=>this.process(id).catch(error=>this.logger('error','social_studio.automation.unhandled',{campaignId:id,message:error.message})));}
  async resumePending() {const pending=(await this.repository.list({limit:100})).filter(item=>['queued','processing','qa'].includes(item.status));pending.forEach(item=>this.enqueue(item.id));return pending.length;}
  async reprocess(id) {
    const current=await this.repository.findById(id);if(!current?.id)throw Object.assign(new Error('Campanha automática não encontrada.'),{statusCode:404,code:'STUDIO_CAMPAIGN_NOT_FOUND'});
    await this.repository.update(id,{status:'queued',stage:'queued',progress:0,error:null,finishedAt:null});this.enqueue(id);return publicRecord(await this.repository.findById(id));
  }
  async stage(id,key,patch={}) {const [message,progress]=STAGES[key];await this.repository.appendEvent(id,{stage:key,message,metadata:patch.metadata});return this.repository.update(id,{stage:key,progress,...patch});}
  async process(id) {
    if(this.running.has(id))return;this.running.add(id);
    try {
      let record=await this.repository.findById(id);if(!record?.id || record.status==='ready')return;
      await this.stage(id,'context',{status:'processing',startedAt:record.startedAt || new Date().toISOString(),attempts:record.attempts+1});
      const context=await this.contextProvider();
      const recent=await this.repository.list({cinemaId:record.cinemaId,limit:30});
      context.history=[...(context.history || []),...recent.filter(item=>item.id!==id).flatMap(item=>item.result?.compositions || []).map(item=>({payload:item.draft || {}}))];
      const request=record.request;
      let draft=this.dependencies.normalizeDraft({...request.subject,templateId:request.templateId,formatId:request.formats[0]},context);
      const warnings=[];
      await this.stage(id,'assets');
      const movie=draft.entities?.movie;
      if(movie && !movie.posterUrl && !movie.backdropUrl && !draft.imageUrl)warnings.push({code:'MISSING_POSTER',message:'Não foi possível obter o pôster. O fallback visual do Studio será usado.'});
      if(request.assets.length && !draft.imageUrl)draft=this.dependencies.normalizeDraft({...draft,imageUrl:request.assets.find(asset=>asset?.url)?.url || ''},context);
      await this.stage(id,'copy',{warnings});
      const copy=this.dependencies.generateCopy(draft,context,{tone:request.copyOptions.tone || draft.copyTone,density:request.copyOptions.density || draft.copyDensity,locks:request.copyOptions.locks || draft.copyLocks,seed:Number(request.copyOptions.seed)||0});
      const withCopy={...draft};
      for(const [field,key] of Object.entries(FIELD_MAP))if(!request.copyOptions.locks?.[field] && !request.subject[key])withCopy[key]=copy.bundle[field];
      draft=this.dependencies.normalizeDraft(withCopy,context);
      await this.stage(id,'compositions');
      let variations=null,lastError=null,retryHistory=[];
      for(let attempt=0;attempt<3;attempt++) {
        try {
          variations=await this.dependencies.generateVariations({...draft,variationMode:attempt?'hierarchy':'explore',artDirection:{...draft.artDirection,seed:(Number(draft.artDirection?.seed)||0)+attempt*37}},context,{loadImage:this.loadImage});
          if(variations.variations.length>=Math.min(3,request.variationCount))break;
          retryHistory.push({attempt:attempt+1,reason:'Poucas composições passaram no QA.',action:'Nova direção e nova distribuição visual.'});
        } catch(error) {lastError=error;retryHistory.push({attempt:attempt+1,reason:error.message,action:'Preservar o conceito e recalcular composição, branding e safe areas.'});}
      }
      if(!variations?.variations?.length)throw lastError || Object.assign(new Error('Nenhuma composição passou pela revisão automática.'),{code:'STUDIO_QA_REJECTED'});
      await this.stage(id,'qa',{status:'qa'});
      const compositions=[],qaItems=[];
      for(const [variationIndex,variation] of variations.variations.slice(0,request.variationCount).entries()) for(const formatId of request.formats) {
        const rendered=await this.dependencies.renderPost({...variation.draft,formatId},context,{loadImage:this.loadImage});
        const qa=this.dependencies.evaluate(rendered,context);qaItems.push({variationId:variation.id,formatId,...qa});
        if(!qa.accepted)continue;
        const previewUrl=await this.savePreview(rendered,{campaignId:id,variationIndex,formatId});
        const {entities,...safeDraft}=rendered.draft;
        compositions.push({id:`${variation.id}-${formatId}`,name:variation.name,formatId,width:rendered.format.width,height:rendered.format.height,previewUrl,quality:rendered.quality,draft:safeDraft,caption:copy.bundle.caption});
      }
      const qa={accepted:compositions.length>0,items:qaItems,errors:qaItems.reduce((sum,item)=>sum+item.counts.ERROR,0),warnings:qaItems.reduce((sum,item)=>sum+item.counts.WARNING,0),suggestions:qaItems.reduce((sum,item)=>sum+item.counts.SUGGESTION,0)};
      if(!qa.accepted)throw Object.assign(new Error('As composições apresentaram conflitos visuais. Gere novas variações ou reduza o texto.'),{code:'STUDIO_QA_REJECTED',qa});
      record=await this.stage(id,'ready',{status:'ready',finishedAt:new Date().toISOString(),warnings:[...warnings,...(variations.notices || []).map(message=>({code:'VARIATION_NOTICE',message}))],qa,result:{compositions,repertoire:{provider:copy.provider,candidates:copy.candidates.map(item=>({id:item.id,score:item.score,bundle:item.bundle}))},retryHistory,rendererVersion:'v2'}});
      this.logger('info','social_studio.automation.ready',{campaignId:id,compositions:compositions.length,attempts:record.attempts});
    } catch(error) {
      await this.stage(id,'failed',{status:'failed',finishedAt:new Date().toISOString(),error:{code:error.code || 'STUDIO_AUTOMATION_FAILED',message:error.message,qa:error.qa || null}}).catch(()=>{});
      this.logger('error','social_studio.automation.failed',{campaignId:id,code:error.code || 'STUDIO_AUTOMATION_FAILED',message:error.message});
    } finally {this.running.delete(id);}
  }
  async get(id) {const record=await this.repository.findById(id);if(!record?.id)return null;return {...publicRecord(record),events:await this.repository.events(id)};}
  async list(options={}) {return Promise.all((await this.repository.list(options)).map(async record=>({...publicRecord(record),events:(await this.repository.events(record.id)).slice(-6)})));}
}
module.exports={CampaignOrchestrator,STAGES,publicRecord};
