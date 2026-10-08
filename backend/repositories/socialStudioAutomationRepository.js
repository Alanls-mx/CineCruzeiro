const {postgresEnabled,queryPostgres}=require('../db/postgresStore');

const LIMIT=100;
const cleanLimit=value=>Math.max(1,Math.min(LIMIT,Number(value)||20));
const json=value=>value===undefined?null:JSON.stringify(value);
const iso=value=>value?new Date(value).toISOString():'';

function mapCampaign(row={}) {
  return {
    id:String(row.id || ''),cinemaId:String(row.cinema_id ?? row.cinemaId ?? ''),
    idempotencyKey:String(row.idempotency_key ?? row.idempotencyKey ?? ''),
    campaignType:String(row.campaign_type ?? row.campaignType ?? ''),objective:String(row.objective || ''),
    triggerType:String(row.trigger_type ?? row.triggerType ?? 'manual'),source:String(row.source || 'studio'),
    status:String(row.status || 'queued'),stage:String(row.stage || 'queued'),progress:Number(row.progress || 0),
    formats:Array.isArray(row.formats)?row.formats:[],request:row.request || {},result:row.result || {},
    warnings:Array.isArray(row.warnings)?row.warnings:[],qa:row.qa || {},attempts:Number(row.attempts || 0),
    error:row.error || null,createdBy:String(row.created_by ?? row.createdBy ?? ''),
    createdAt:iso(row.created_at ?? row.createdAt),startedAt:iso(row.started_at ?? row.startedAt),
    finishedAt:iso(row.finished_at ?? row.finishedAt),updatedAt:iso(row.updated_at ?? row.updatedAt)
  };
}

class SocialStudioAutomationRepository {
  constructor({readJson,mutateJson}={}) {this.readJson=readJson;this.mutateJson=mutateJson;}
  async create(record) {
    if(postgresEnabled()) {
      const result=await queryPostgres(`INSERT INTO social_studio_automation_campaigns
        (id,cinema_id,idempotency_key,campaign_type,objective,trigger_type,source,status,stage,progress,formats,request,warnings,created_by,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$15)
        ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,[
        record.id,record.cinemaId,record.idempotencyKey,record.campaignType,record.objective,record.triggerType,record.source,
        record.status,record.stage,record.progress,json(record.formats),json(record.request),json(record.warnings),record.createdBy,record.createdAt
      ]);
      return result.rows[0]?{record:mapCampaign(result.rows[0]),created:true}:{record:await this.findByIdempotencyKey(record.idempotencyKey),created:false};
    }
    return this.mutateJson(async db=>{
      db.settings ||= {};db.settings.socialStudioAutomationCampaigns ||= [];
      const existing=db.settings.socialStudioAutomationCampaigns.find(item=>item.idempotencyKey===record.idempotencyKey);
      if(existing)return {record:mapCampaign(existing),created:false};
      db.settings.socialStudioAutomationCampaigns=[record,...db.settings.socialStudioAutomationCampaigns].slice(0,LIMIT);
      return {record:mapCampaign(record),created:true};
    });
  }
  async update(id,patch={}) {
    const clean={...patch,updatedAt:new Date().toISOString()};
    if(postgresEnabled()) {
      const fields={status:'status',stage:'stage',progress:'progress',result:'result',warnings:'warnings',qa:'qa',attempts:'attempts',error:'error',startedAt:'started_at',finishedAt:'finished_at'};
      const sets=[],values=[];
      for(const [key,column] of Object.entries(fields)) if(Object.prototype.hasOwnProperty.call(clean,key)) {
        values.push(['result','warnings','qa','error'].includes(key)?json(clean[key]):clean[key] || null);
        sets.push(`${column}=$${values.length}${['result','warnings','qa','error'].includes(key)?'::jsonb':''}`);
      }
      values.push(clean.updatedAt,id);sets.push(`updated_at=$${values.length-1}`);
      const result=await queryPostgres(`UPDATE social_studio_automation_campaigns SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`,values);
      return result.rows[0]?mapCampaign(result.rows[0]):null;
    }
    return this.mutateJson(async db=>{
      db.settings ||= {};db.settings.socialStudioAutomationCampaigns ||= [];
      const index=db.settings.socialStudioAutomationCampaigns.findIndex(item=>String(item.id)===String(id));
      if(index<0)return null;
      db.settings.socialStudioAutomationCampaigns[index]={...db.settings.socialStudioAutomationCampaigns[index],...clean};
      return mapCampaign(db.settings.socialStudioAutomationCampaigns[index]);
    });
  }
  async findById(id) {
    if(postgresEnabled()) {const result=await queryPostgres('SELECT * FROM social_studio_automation_campaigns WHERE id=$1',[id]);return result.rows[0]?mapCampaign(result.rows[0]):null;}
    const db=await this.readJson();return mapCampaign((db.settings?.socialStudioAutomationCampaigns || []).find(item=>String(item.id)===String(id)) || {});
  }
  async findByIdempotencyKey(key) {
    if(postgresEnabled()) {const result=await queryPostgres('SELECT * FROM social_studio_automation_campaigns WHERE idempotency_key=$1',[key]);return result.rows[0]?mapCampaign(result.rows[0]):null;}
    const db=await this.readJson();const value=(db.settings?.socialStudioAutomationCampaigns || []).find(item=>item.idempotencyKey===key);return value?mapCampaign(value):null;
  }
  async list({cinemaId='',limit=20}={}) {
    if(postgresEnabled()) {
      const result=await queryPostgres(`SELECT * FROM social_studio_automation_campaigns WHERE ($1='' OR cinema_id=$1) ORDER BY created_at DESC LIMIT $2`,[cinemaId,cleanLimit(limit)]);
      return result.rows.map(mapCampaign);
    }
    const db=await this.readJson();return (db.settings?.socialStudioAutomationCampaigns || []).filter(item=>!cinemaId || item.cinemaId===cinemaId).slice(0,cleanLimit(limit)).map(mapCampaign);
  }
  async appendEvent(campaignId,event) {
    const value={campaignId,level:event.level || 'info',stage:event.stage || 'processing',message:String(event.message || ''),metadata:event.metadata || {},createdAt:new Date().toISOString()};
    if(postgresEnabled()) {await queryPostgres('INSERT INTO social_studio_automation_events (campaign_id,level,stage,message,metadata) VALUES ($1,$2,$3,$4,$5::jsonb)',[campaignId,value.level,value.stage,value.message,json(value.metadata)]);return value;}
    return this.mutateJson(async db=>{db.settings ||= {};db.settings.socialStudioAutomationEvents ||= [];db.settings.socialStudioAutomationEvents=[value,...db.settings.socialStudioAutomationEvents].slice(0,500);return value;});
  }
  async events(campaignId) {
    if(postgresEnabled()) {const result=await queryPostgres('SELECT level,stage,message,metadata,created_at FROM social_studio_automation_events WHERE campaign_id=$1 ORDER BY created_at ASC',[campaignId]);return result.rows.map(row=>({...row,createdAt:iso(row.created_at)}));}
    const db=await this.readJson();return (db.settings?.socialStudioAutomationEvents || []).filter(item=>String(item.campaignId)===String(campaignId)).reverse();
  }
}
module.exports={SocialStudioAutomationRepository,mapCampaign};
