ALTER TABLE creative_prompt_studio_runs ALTER COLUMN movie_id DROP NOT NULL;
ALTER TABLE creative_prompt_studio_runs ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'films';
ALTER TABLE creative_prompt_studio_runs ADD COLUMN IF NOT EXISTS brief_version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS creative_prompt_studio_runs_category_recent_idx
  ON creative_prompt_studio_runs (category, created_at DESC);
