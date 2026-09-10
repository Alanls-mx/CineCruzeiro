UPDATE settings
SET value = jsonb_set(
  value,
  '{integrations}',
  CASE
    WHEN jsonb_typeof(value->'integrations') = 'object' THEN (value->'integrations') - 'openai'
    ELSE '{}'::jsonb
  END,
  true
), updated_at = now()
WHERE key = 'app'
  AND jsonb_typeof(value) = 'object'
  AND jsonb_typeof(value->'integrations') = 'object'
  AND (value->'integrations') ? 'openai';
