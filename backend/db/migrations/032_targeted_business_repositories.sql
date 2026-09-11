CREATE UNIQUE INDEX IF NOT EXISTS idx_promotions_coupon_code_unique
  ON promotions (upper(coupon_code))
  WHERE coupon_code IS NOT NULL AND coupon_code <> '';

CREATE INDEX IF NOT EXISTS idx_promotions_validity
  ON promotions (starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_promotions_active
  ON promotions (active);

CREATE INDEX IF NOT EXISTS idx_concessions_active_sort
  ON concessions (active, sort_order, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email_unique
  ON users (lower(email));

CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON users (role, active);
