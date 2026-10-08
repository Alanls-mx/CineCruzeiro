CREATE TABLE IF NOT EXISTS creative_prompt_studio_runs (
  id TEXT PRIMARY KEY,
  movie_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  campaign_type TEXT NOT NULL,
  format TEXT NOT NULL,
  density TEXT NOT NULL,
  artwork_source TEXT NOT NULL,
  artwork_url TEXT NOT NULL,
  reference_url TEXT NOT NULL DEFAULT '',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  reference_analysis JSONB,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_variant TEXT NOT NULL DEFAULT '',
  brief JSONB,
  curated_content JSONB,
  prompt_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'saved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creative_prompt_studio_runs_recent_idx
  ON creative_prompt_studio_runs (created_at DESC);
