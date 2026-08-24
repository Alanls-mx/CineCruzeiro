ALTER TABLE movies ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100;

UPDATE movies
SET sort_order = 100
WHERE sort_order IS NULL;

CREATE INDEX IF NOT EXISTS movies_sort_order_idx ON movies (sort_order, title);
