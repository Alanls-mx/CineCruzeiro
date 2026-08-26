ALTER TABLE ticket_types
  ADD COLUMN IF NOT EXISTS bundle_quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE ticket_types
  DROP CONSTRAINT IF EXISTS ticket_types_bundle_quantity_check;

ALTER TABLE ticket_types
  ADD CONSTRAINT ticket_types_bundle_quantity_check
  CHECK (bundle_quantity BETWEEN 1 AND 20);
