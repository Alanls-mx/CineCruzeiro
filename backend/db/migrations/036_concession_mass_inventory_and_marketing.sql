ALTER TABLE concessions
  ADD COLUMN IF NOT EXISTS stock_unit TEXT NOT NULL DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS usage_per_sale NUMERIC(14,3) NOT NULL DEFAULT 1;

ALTER TABLE concessions DROP CONSTRAINT IF EXISTS concessions_stock_unit_check;
ALTER TABLE concessions
  ADD CONSTRAINT concessions_stock_unit_check CHECK (stock_unit IN ('unit', 'kg', 'g', 'mg'));

ALTER TABLE concessions DROP CONSTRAINT IF EXISTS concessions_usage_per_sale_check;
ALTER TABLE concessions
  ADD CONSTRAINT concessions_usage_per_sale_check CHECK (usage_per_sale > 0);

ALTER TABLE concession_inventory
  ALTER COLUMN available TYPE NUMERIC(14,3) USING available::numeric,
  ALTER COLUMN reserved TYPE NUMERIC(14,3) USING reserved::numeric,
  ALTER COLUMN sold TYPE NUMERIC(14,3) USING sold::numeric;
