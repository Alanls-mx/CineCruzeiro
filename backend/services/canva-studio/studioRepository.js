const { queryPostgres, withPostgresTransaction } = require("../../db/postgresStore");

function json(value) { return JSON.stringify(value ?? {}); }
async function templates() {
  return (await queryPostgres("SELECT * FROM canva_studio_templates ORDER BY updated_at DESC")).rows;
}
async function template(id) {
  return (await queryPostgres("SELECT * FROM canva_studio_templates WHERE id=$1", [id])).rows[0] || null;
}
async function saveTemplate(value) {
  return (await queryPostgres(`INSERT INTO canva_studio_templates(id,canva_template_id,name,metadata,dataset,validation,active,last_error)
    VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8)
    ON CONFLICT(id) DO UPDATE SET canva_template_id=EXCLUDED.canva_template_id,name=EXCLUDED.name,metadata=EXCLUDED.metadata,dataset=EXCLUDED.dataset,validation=EXCLUDED.validation,active=EXCLUDED.active,last_error=EXCLUDED.last_error,updated_at=now() RETURNING *`,
  [value.id, value.canva_template_id, value.name, json(value.metadata), json(value.dataset), json(value.validation), Boolean(value.active), value.last_error || ""])).rows[0];
}
async function campaigns(limit = 50) {
  return (await queryPostgres("SELECT * FROM canva_studio_campaigns ORDER BY created_at DESC LIMIT $1", [Math.min(100, Math.max(1, limit))])).rows;
}
async function campaign(id) {
  return (await queryPostgres("SELECT * FROM canva_studio_campaigns WHERE id=$1", [id])).rows[0] || null;
}
async function insertCampaign(value) {
  const result = await queryPostgres(`INSERT INTO canva_studio_campaigns(id,request_key,movie_id,movie_title,campaign_type,input,plan,options,created_by)
    VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)
    ON CONFLICT(request_key) DO UPDATE SET request_key=EXCLUDED.request_key RETURNING *`,
  [value.id, value.request_key, value.movie_id, value.movie_title, value.campaign_type, json(value.input), json(value.plan), json(value.options), value.created_by]);
  return result.rows[0];
}
async function updateCampaign(id, patch) {
  const fields = ["plan", "options", "status", "stage", "error", "lease_until"];
  const selected = fields.filter((field) => Object.hasOwn(patch, field));
  if (!selected.length) return campaign(id);
  const values = selected.map((field) => ["plan", "options", "error"].includes(field) ? json(patch[field]) : patch[field]);
  const assignments = selected.map((field, index) => `${field}=$${index + 2}${["plan", "options", "error"].includes(field) ? "::jsonb" : ""}`);
  return (await queryPostgres(`UPDATE canva_studio_campaigns SET ${assignments.join(",")},updated_at=now() WHERE id=$1 RETURNING *`, [id, ...values])).rows[0];
}
async function claimCampaign(id) {
  return (await queryPostgres(`UPDATE canva_studio_campaigns SET lease_until=now()+interval '45 seconds',status='processing',updated_at=now()
    WHERE id=$1 AND status <> 'completed' AND (lease_until IS NULL OR lease_until<now()) RETURNING *`, [id])).rows[0] || null;
}
async function oauth() { return (await queryPostgres("SELECT * FROM canva_studio_oauth WHERE id='primary'")).rows[0] || null; }
async function clearOAuth() { await queryPostgres("DELETE FROM canva_studio_oauth WHERE id='primary'"); }
async function saveOAuth(value) {
  return (await queryPostgres(`INSERT INTO canva_studio_oauth(id,account_id,access_token,refresh_token,expires_at) VALUES('primary',$1,$2::jsonb,$3::jsonb,$4)
    ON CONFLICT(id) DO UPDATE SET account_id=EXCLUDED.account_id,access_token=EXCLUDED.access_token,refresh_token=EXCLUDED.refresh_token,expires_at=EXCLUDED.expires_at,updated_at=now() RETURNING *`,
  [value.account_id, json(value.access_token), json(value.refresh_token), value.expires_at])).rows[0];
}
async function flow(stateHash, verifier, adminId) {
  await queryPostgres("INSERT INTO canva_studio_oauth_flows(state_hash,verifier,admin_user_id,expires_at) VALUES($1,$2::jsonb,$3,now()+interval '10 minutes')", [stateHash, json(verifier), adminId]);
}
async function takeFlow(stateHash, adminId) {
  return withPostgresTransaction(async () => {
    const row = (await queryPostgres("DELETE FROM canva_studio_oauth_flows WHERE state_hash=$1 AND admin_user_id=$2 AND expires_at>now() RETURNING *", [stateHash, adminId])).rows[0];
    return row || null;
  });
}
async function cachedAsset(accountId, hash) { return (await queryPostgres("SELECT * FROM canva_studio_assets WHERE account_id=$1 AND content_hash=$2", [accountId, hash])).rows[0] || null; }
async function saveAsset(value) {
  return (await queryPostgres(`INSERT INTO canva_studio_assets(account_id,content_hash,canva_asset_id,upload_job_id,name) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(account_id,content_hash) DO UPDATE SET canva_asset_id=EXCLUDED.canva_asset_id,upload_job_id=EXCLUDED.upload_job_id,name=EXCLUDED.name,updated_at=now() RETURNING *`,
  [value.account_id, value.content_hash, value.canva_asset_id || null, value.upload_job_id || null, value.name])).rows[0];
}
module.exports = { templates, template, saveTemplate, campaigns, campaign, insertCampaign, updateCampaign, claimCampaign, oauth, clearOAuth, saveOAuth, flow, takeFlow, cachedAsset, saveAsset, withPostgresTransaction, queryPostgres };
