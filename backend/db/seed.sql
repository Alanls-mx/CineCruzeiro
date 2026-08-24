INSERT INTO rooms (id, name, capacity, technology, status)
VALUES ('sala-cruzeiro', 'Sala Cruzeiro', 120, 'Laser 4K + Dolby 7.1', 'active')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  capacity = EXCLUDED.capacity,
  technology = EXCLUDED.technology,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO ticket_types (id, name, price, description, active)
VALUES
  ('promocional', 'Ingresso Promocional', 10.00, 'Valor promocional permanente', true),
  ('meia', 'Meia Entrada', 10.00, 'Mesmo valor da promocao permanente', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  updated_at = now();

INSERT INTO concessions (id, sku, name, description, image_url, badge, price, compare_at, category, max_per_order, featured, sort_order, tags, combo_items, active)
VALUES
  (
    'combo-classico',
    'combo-classico',
    'Combo Classico',
    'Pipoca media + refrigerante',
    '',
    'Mais pedido',
    25.00,
    32.00,
    'combo',
    6,
    true,
    1,
    ARRAY['pipoca', 'bebida'],
    '[{"name":"Pipoca media","quantity":1},{"name":"Refrigerante","quantity":1}]',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  sku = EXCLUDED.sku,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  compare_at = EXCLUDED.compare_at,
  category = EXCLUDED.category,
  max_per_order = EXCLUDED.max_per_order,
  featured = EXCLUDED.featured,
  sort_order = EXCLUDED.sort_order,
  tags = EXCLUDED.tags,
  combo_items = EXCLUDED.combo_items,
  active = EXCLUDED.active,
  updated_at = now();

INSERT INTO concession_inventory (concession_id, available, reserved, sold)
VALUES ('combo-classico', 80, 0, 0)
ON CONFLICT (concession_id) DO UPDATE SET
  available = EXCLUDED.available,
  updated_at = now();

INSERT INTO users (name, email, password_hash, role, active, auth_provider)
VALUES (
  COALESCE(NULLIF(current_setting('app.seed_admin_name', true), ''), 'Admin Cine Cruzeiro'),
  COALESCE(NULLIF(current_setting('app.seed_admin_email', true), ''), 'admin@cinecruzeiro.local'),
  COALESCE(NULLIF(current_setting('app.seed_admin_password_hash', true), ''), 'configure-a-senha-via-env'),
  'owner',
  true,
  'email'
)
ON CONFLICT (email) DO NOTHING;
