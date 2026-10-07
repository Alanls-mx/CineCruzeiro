DROP TABLE IF EXISTS social_studio_automation_events;
DROP TABLE IF EXISTS social_studio_automation_campaigns;

UPDATE settings
SET value = (
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
  FROM jsonb_each(settings.value)
  WHERE key NOT LIKE 'socialStudio%'
) #- '{integrations,studioVision}' #- '{integrations,studioImageGeneration}',
    updated_at = now()
WHERE key = 'app';

UPDATE users
SET admin_permissions = (
  SELECT COALESCE(jsonb_agg(permission), '[]'::jsonb)
  FROM jsonb_array_elements(users.admin_permissions) AS permission
  WHERE permission #>> '{}' NOT LIKE 'social_studio.%'
)
WHERE admin_permissions::text LIKE '%social_studio%';

DELETE FROM audit_logs
WHERE action ILIKE '%studio%'
   OR entity_type ILIKE '%studio%'
   OR entity_id ILIKE '%studio%';

DELETE FROM system_logs
WHERE category ILIKE '%studio%'
   OR event ILIKE '%studio%'
   OR path ILIKE '%studio%'
   OR to_jsonb(system_logs)::text ILIKE '%socialStudio%'
   OR to_jsonb(system_logs)::text ILIKE '%social_studio%';
