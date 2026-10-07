DROP TABLE IF EXISTS canva_studio_mcp_oauth;
DROP TABLE IF EXISTS canva_studio_oauth_flows;
DROP TABLE IF EXISTS canva_studio_oauth;
DROP TABLE IF EXISTS canva_studio_assets;
DROP TABLE IF EXISTS canva_studio_campaigns;
DROP TABLE IF EXISTS canva_studio_templates;

UPDATE settings
SET value = value #- '{integrations,canva}', updated_at = now()
WHERE key = 'app' AND value #> '{integrations,canva}' IS NOT NULL;

DELETE FROM audit_logs
WHERE action ILIKE '%canva_studio%'
   OR entity_type ILIKE '%canva_studio%'
   OR (entity_type = 'integration' AND entity_id = 'canva');

DELETE FROM system_logs
WHERE event ILIKE '%canva_studio%'
   OR path ILIKE '%/canva-studio/%'
   OR path ILIKE '%/integrations/canva%'
   OR category ILIKE '%canva_studio%';

DELETE FROM schema_migrations
WHERE filename IN ('043_canva_studio.sql', '044_canva_studio_mcp.sql');
