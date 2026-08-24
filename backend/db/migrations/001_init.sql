CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  cpf TEXT,
  password_hash TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'email',
  google_sub TEXT UNIQUE,
  picture TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  password_reset_hash TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  password_reset_requested_at TIMESTAMPTZ,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('owner', 'manager', 'operator', 'customer')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  technology TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movies (
  id TEXT PRIMARY KEY,
  tmdb_id TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('now_playing', 'upcoming', 'hidden')),
  title TEXT NOT NULL,
  original_title TEXT,
  synopsis TEXT,
  duration TEXT,
  genre TEXT[] NOT NULL DEFAULT '{}',
  rating TEXT NOT NULL DEFAULT 'L',
  poster_url TEXT,
  backdrop_url TEXT,
  trailer_youtube_id TEXT,
  trailer_video_url TEXT,
  local_trailer_url TEXT,
  trailer_source_url TEXT,
  trailer_cache_status TEXT NOT NULL DEFAULT 'idle',
  trailer_cache_error TEXT,
  is_highlight BOOLEAN NOT NULL DEFAULT false,
  highlight_trailer_background BOOLEAN NOT NULL DEFAULT true,
  release_date DATE,
  auto_publish BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  starts_at TIMESTAMPTZ,
  time_label TEXT NOT NULL,
  room_label TEXT,
  format TEXT NOT NULL,
  price_full NUMERIC(10,2) NOT NULL CHECK (price_full >= 0),
  price_half NUMERIC(10,2) NOT NULL CHECK (price_half >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'filling_fast', 'sold_out', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS concessions (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  badge TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  compare_at NUMERIC(10,2),
  category TEXT NOT NULL DEFAULT 'combo',
  max_per_order INTEGER NOT NULL DEFAULT 8 CHECK (max_per_order > 0),
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 100,
  tags TEXT[] NOT NULL DEFAULT '{}',
  combo_items JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS concession_inventory (
  concession_id TEXT PRIMARY KEY REFERENCES concessions(id) ON DELETE CASCADE,
  available INTEGER,
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  sold INTEGER NOT NULL DEFAULT 0 CHECK (sold >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (available IS NULL OR available >= 0)
);

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'fixed_price',
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  placement TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_user_id TEXT REFERENCES users(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_cpf TEXT,
  movie_id TEXT REFERENCES movies(id),
  session_id TEXT REFERENCES sessions(id),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'expired', 'cancelled', 'refunded')),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  reservation_expires_at TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('ticket', 'concession', 'addon', 'promotion')),
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('pix', 'credit_card')),
  provider TEXT NOT NULL CHECK (provider IN ('open_finance', 'mercado_pago')),
  provider_payment_id TEXT,
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'expired', 'cancelled', 'refunded')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  UNIQUE (provider, provider_payment_id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  movie_id TEXT REFERENCES movies(id),
  session_id TEXT REFERENCES sessions(id),
  code TEXT NOT NULL UNIQUE,
  qr_payload TEXT NOT NULL,
  ticket_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'used', 'cancelled', 'refunded')),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_cpf TEXT,
  source TEXT NOT NULL DEFAULT 'online',
  used_at TIMESTAMPTZ,
  used_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  provider_payment_id TEXT,
  order_id TEXT,
  status TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_sessions_movie_id ON sessions(movie_id);
