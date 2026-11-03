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
