PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS market_snapshots (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  observed_at_ms INTEGER NOT NULL,
  last_seen_at_ms INTEGER NOT NULL,
  product_count INTEGER NOT NULL CHECK (product_count > 0)
);

CREATE TABLE IF NOT EXISTS market_products (
  snapshot_id INTEGER NOT NULL REFERENCES market_snapshots(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  sell_offers_json TEXT NOT NULL,
  buy_orders_json TEXT NOT NULL,
  conservative_weekly_volume INTEGER,
  PRIMARY KEY (snapshot_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_latest
  ON market_snapshots(observed_at_ms DESC, id DESC);
