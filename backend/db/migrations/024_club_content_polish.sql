UPDATE settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      value,
      '{eventStartingPrice}',
      to_jsonb(450::numeric),
      true
    ),
    '{clubHeroImageUrl}',
    to_jsonb('https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1600&q=82'::text),
    true
  ),
  '{clubBannerImageUrl}',
  to_jsonb('https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=1600&q=82'::text),
  true
), updated_at = now()
WHERE key = 'app';

UPDATE subscription_plans AS plan
SET benefits = COALESCE((
  SELECT jsonb_agg(to_jsonb(regexp_replace(benefit.value, '\mgratis\M', 'grátis', 'gi')) ORDER BY benefit.ordinality)
  FROM jsonb_array_elements_text(plan.benefits) WITH ORDINALITY AS benefit(value, ordinality)
), '[]'::jsonb), updated_at = now();
