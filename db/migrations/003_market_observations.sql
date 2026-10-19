ALTER TABLE market_snapshots ADD COLUMN source_updated_at_ms INTEGER;

UPDATE market_snapshots
SET source_updated_at_ms = observed_at_ms
WHERE source_updated_at_ms IS NULL;

CREATE TABLE IF NOT EXISTS market_observations (
  id INTEGER PRIMARY KEY,
  snapshot_id INTEGER NOT NULL REFERENCES market_snapshots(id) ON DELETE CASCADE,
  source_updated_at_ms INTEGER NOT NULL,
  observed_at_ms INTEGER NOT NULL,
  complete INTEGER NOT NULL CHECK (complete IN (0, 1))
);

INSERT INTO market_observations (snapshot_id, source_updated_at_ms, observed_at_ms, complete)
SELECT id, source_updated_at_ms, observed_at_ms, 1
FROM market_snapshots
WHERE NOT EXISTS (
  SELECT 1 FROM market_observations WHERE market_observations.snapshot_id = market_snapshots.id
);

CREATE INDEX IF NOT EXISTS idx_market_observations_latest
  ON market_observations(source_updated_at_ms DESC, observed_at_ms DESC, id DESC);
