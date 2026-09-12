CREATE TABLE IF NOT EXISTS hub_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'community',
  region TEXT NOT NULL DEFAULT 'Seattle',
  city TEXT DEFAULT '',
  venue TEXT DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  url TEXT NOT NULL,
  image_url TEXT,
  source_name TEXT NOT NULL,
  source_kind TEXT NOT NULL DEFAULT 'web',
  source_event_id TEXT,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(source_name, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_events_start ON hub_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_hub_events_region ON hub_events(region, starts_at);
CREATE INDEX IF NOT EXISTS idx_hub_events_category ON hub_events(category, starts_at);

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL CHECK(section IN ('music','history')),
  title TEXT NOT NULL,
  dek TEXT DEFAULT '',
  body TEXT DEFAULT '',
  canonical_url TEXT NOT NULL,
  image_url TEXT,
  source_name TEXT NOT NULL,
  author TEXT,
  published_at TEXT NOT NULL,
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','rejected')),
  UNIQUE(canonical_url)
);

CREATE INDEX IF NOT EXISTS idx_content_section_date ON content_items(section, status, published_at DESC);

CREATE TABLE IF NOT EXISTS source_status (
  source_key TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  last_run_at TEXT,
  last_success_at TEXT,
  last_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS app_cache (
  cache_key TEXT PRIMARY KEY,
  cache_value TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

INSERT OR IGNORE INTO content_items
  (id, section, title, dek, body, canonical_url, source_name, author, published_at, status)
VALUES
  ('history-1947', 'history', '1947: Panjab, Partition and a divided homeland',
   'A starting point for understanding how Partition reshaped Panjab and its communities.',
   'This reading guide links to SikhRI’s source-backed overview. The history page intentionally summarizes and links out instead of copying full articles.',
   'https://sikhri.org/videos/1947-south-asia-panjab-sikhs', 'Sikh Research Institute', 'Editorial desk', '2026-01-01T12:00:00Z', 'published'),
  ('history-pdl', 'history', 'Explore Panjab through its digitized record',
   'Manuscripts, newspapers, photographs and maps preserve many voices from Panjab’s past.',
   'Use the Panjab Digital Library as a primary research doorway. Future automated posts should cite original records and clearly separate fact from interpretation.',
   'https://www.panjabdigilib.org/', 'Panjab Digital Library', 'Editorial desk', '2026-01-02T12:00:00Z', 'published');
