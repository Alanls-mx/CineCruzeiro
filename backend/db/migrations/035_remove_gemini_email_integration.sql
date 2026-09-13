UPDATE settings
SET value = (
  jsonb_set(
    value,
    '{integrations}',
    CASE
      WHEN jsonb_typeof(value->'integrations') = 'object' THEN (value->'integrations') - 'gemini'
      ELSE '{}'::jsonb
    END,
    true
  ) - 'emailAiPromptTemplates'
), updated_at = now()
WHERE key = 'app'
  AND jsonb_typeof(value) = 'object'
  AND (
    value ? 'emailAiPromptTemplates'
    OR (jsonb_typeof(value->'integrations') = 'object' AND (value->'integrations') ? 'gemini')
  );
