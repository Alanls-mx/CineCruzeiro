-- The legacy service-invoice module was removed. Its orphaned order foreign key
-- blocked unrelated snapshot updates, including movie metadata changes.
DROP TABLE IF EXISTS fiscal_documents;
