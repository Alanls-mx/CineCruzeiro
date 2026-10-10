UPDATE settings
SET value = CASE
  WHEN jsonb_typeof(value->'integrations') = 'object'
    AND jsonb_typeof(value #> '{integrations,mercadoPago}') = 'object'
  THEN jsonb_set(
    value #- '{integrations,mercadoPagoSandbox}',
    '{integrations,mercadoPago,environment}',
    '"production"'::jsonb,
    true
  )
  ELSE value #- '{integrations,mercadoPagoSandbox}'
END,
updated_at = now()
WHERE key = 'app'
  AND jsonb_typeof(value) = 'object'
  AND (
    value #> '{integrations,mercadoPagoSandbox}' IS NOT NULL
    OR value #>> '{integrations,mercadoPago,environment}' = 'sandbox'
  );
