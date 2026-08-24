ALTER TABLE movies ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE movies ADD COLUMN IF NOT EXISTS director TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

UPDATE movies
SET
  slug = COALESCE(NULLIF(slug, ''), id),
  workflow_status = CASE
    WHEN status = 'hidden' THEN 'archived'
    ELSE COALESCE(NULLIF(workflow_status, ''), 'published')
  END;

ALTER TABLE movies DROP CONSTRAINT IF EXISTS movies_workflow_status_check;
ALTER TABLE movies ADD CONSTRAINT movies_workflow_status_check
  CHECK (workflow_status IN ('draft', 'published', 'archived'));

CREATE UNIQUE INDEX IF NOT EXISTS movies_slug_unique_idx
  ON movies (lower(slug))
  WHERE slug IS NOT NULL AND slug <> '';
