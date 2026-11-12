-- BardalesLabs admin + analytics (Cloudflare D1)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,                 -- unix ms
  property TEXT NOT NULL,              -- e.g. bardaleslabs, agents, ptm
  type TEXT NOT NULL,                  -- pageview | event
  name TEXT,                           -- event name (cta_click, form_submit, ...)
  path TEXT,
  referrer TEXT,
  sid TEXT,                            -- per-browser-session random id (no cookies)
  country TEXT,
  device TEXT,                         -- desktop | mobile | tablet
  browser TEXT
);
CREATE INDEX IF NOT EXISTS events_prop_ts ON events(property, ts);
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);

-- admin-only layer over the public data files (status, links, notes)
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                  -- app | website | company | project | product
  name TEXT NOT NULL,
  status TEXT DEFAULT 'live',          -- live | building | paused | idea
  url TEXT, store_url TEXT, repo TEXT, property TEXT,
  notes TEXT, next_action TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  day TEXT NOT NULL,                   -- YYYY-MM-DD
  units INTEGER NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'manual',        -- manual | appstore
  UNIQUE(app_id, day, source)
);

CREATE TABLE IF NOT EXISTS inbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  name TEXT, email TEXT, company TEXT, interest TEXT, message TEXT, page TEXT,
  status TEXT DEFAULT 'new'            -- new | replied | archived
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Miami-Dade car directory: cars photographed with a for-sale sign (photos in R2 under media/cars/)
CREATE TABLE IF NOT EXISTS cars (
  id TEXT PRIMARY KEY,                 -- url slug: /cars/<id>/, e.g. 2016-toyota-camry-se-k3f9
  status TEXT NOT NULL DEFAULT 'draft',-- draft | available | pending | sold
  year INTEGER, make TEXT, model TEXT, trim TEXT,
  price INTEGER,                       -- whole dollars; NULL = ask the seller
  mileage INTEGER,
  body TEXT, transmission TEXT, fuel TEXT, color TEXT, vin TEXT,
  title_status TEXT,                   -- Clean | Rebuilt | Salvage | ''
  seller TEXT,                         -- Private | Dealer | ''
  area TEXT,                           -- where it was spotted (Hialeah, Kendall, ...)
  phone TEXT,                          -- number on the for-sale sign
  description TEXT,
  photos TEXT NOT NULL DEFAULT '[]',   -- JSON array of photo ids, first one is the cover
  spotted TEXT,                        -- YYYY-MM-DD
  created_at INTEGER, updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS cars_status_spotted ON cars(status, spotted);

-- Digital products sold through Stripe Checkout (files in R2 under files/, never public)
CREATE TABLE IF NOT EXISTS store_products (
  id TEXT PRIMARY KEY,                 -- url slug: /store/<id>/ (overrides an entry with the same id in data/products.js)
  status TEXT NOT NULL DEFAULT 'draft',-- draft | live | archived
  name TEXT NOT NULL, kind TEXT,
  price INTEGER NOT NULL DEFAULT 0,    -- cents; 0 = free download in exchange for an email
  short TEXT, body TEXT,
  features TEXT,                       -- one per line, "Title: description"
  cover TEXT,                          -- image id under media/products/
  file_key TEXT, file_name TEXT, file_size INTEGER, file_type TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER, updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS store_orders (
  id TEXT PRIMARY KEY,                 -- Stripe Checkout Session id (cs_...) or free_<random>
  product_id TEXT NOT NULL,
  email TEXT, amount INTEGER, currency TEXT,
  status TEXT NOT NULL DEFAULT 'paid', -- paid | refunded
  token TEXT NOT NULL UNIQUE,          -- secret in the download link
  downloads INTEGER NOT NULL DEFAULT 0,
  payment_intent TEXT,
  emailed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS store_orders_created ON store_orders(created_at);
CREATE INDEX IF NOT EXISTS store_orders_pi ON store_orders(payment_intent);
