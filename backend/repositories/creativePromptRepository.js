const { queryPostgres, postgresEnabled } = require("../db/postgresStore");

function requirePostgres() {
  if (postgresEnabled()) return;
  const error = new Error("O Creative Prompt Studio requer PostgreSQL. Configure DATABASE_URL e aplique a migration 046.");
  error.statusCode = 503;
  error.code = "CREATIVE_PROMPT_DATABASE_REQUIRED";
  throw error;
}

async function insert(run) {
  requirePostgres();
  const { rows } = await queryPostgres(`
    INSERT INTO creative_prompt_studio_runs
      (id, movie_id, created_by, campaign_type, format, density, artwork_source, artwork_url,
       reference_url, input, analysis, reference_analysis, variants, selected_variant,
       brief, curated_content, prompt_text, status, category, brief_version)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    RETURNING *`, [
    run.id, run.movieId, run.createdBy, run.campaignType, run.format, run.density,
    run.artworkSource, run.artworkUrl, run.referenceUrl || "", JSON.stringify(run.input),
    JSON.stringify(run.analysis), run.referenceAnalysis ? JSON.stringify(run.referenceAnalysis) : null,
    JSON.stringify(run.variants), run.selectedVariant || "",
    run.brief ? JSON.stringify(run.brief) : null,
    run.curatedContent ? JSON.stringify(run.curatedContent) : null,
    run.promptText || "", run.status || "draft", run.category || "films", run.briefVersion || 1
  ]);
  return mapRun(rows[0]);
}

async function get(id) {
  requirePostgres();
  const { rows } = await queryPostgres("SELECT * FROM creative_prompt_studio_runs WHERE id = $1", [id]);
  return rows[0] ? mapRun(rows[0]) : null;
}

async function list({ limit = 30, offset = 0 } = {}) {
  requirePostgres();
  const { rows } = await queryPostgres(
    "SELECT * FROM creative_prompt_studio_runs WHERE status <> 'draft' ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [Math.min(100, Math.max(1, limit)), Math.max(0, offset)]
  );
  return rows.map(mapRun);
}

async function update(id, patch) {
  requirePostgres();
  const allowed = {
    input: "input",
    selectedVariant: "selected_variant", brief: "brief", curatedContent: "curated_content",
    promptText: "prompt_text", status: "status"
  };
  const entries = Object.entries(patch).filter(([key]) => allowed[key]);
  if (!entries.length) return get(id);
  const assignments = entries.map(([key], index) => `${allowed[key]} = $${index + 2}`);
  const { rows } = await queryPostgres(
    `UPDATE creative_prompt_studio_runs SET ${assignments.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...entries.map(([key, value]) => ["input", "brief", "curatedContent"].includes(key) && value !== null
      ? JSON.stringify(value) : value)]
  );
  return rows[0] ? mapRun(rows[0]) : null;
}

function mapRun(row) {
  return {
    id: row.id, movieId: row.movie_id, category: row.category || "films",
    briefVersion: row.brief_version || 1, createdBy: row.created_by,
    campaignType: row.campaign_type, format: row.format, density: row.density,
    artworkSource: row.artwork_source, artworkUrl: row.artwork_url,
    referenceUrl: row.reference_url, input: row.input, analysis: row.analysis,
    referenceAnalysis: row.reference_analysis, variants: row.variants,
    selectedVariant: row.selected_variant, brief: row.brief,
    curatedContent: row.curated_content, promptText: row.prompt_text,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

module.exports = { insert, get, list, update };
