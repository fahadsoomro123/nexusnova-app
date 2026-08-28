CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_shards (
  source TEXT NOT NULL,
  shard_key TEXT NOT NULL,
  records_json TEXT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  fingerprint TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (source, shard_key)
);

CREATE INDEX IF NOT EXISTS idx_catalog_shards_source ON catalog_shards(source, updated_at DESC);

CREATE TABLE IF NOT EXISTS route_health (
  route_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  capability TEXT NOT NULL DEFAULT 'general',
  successes INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  ewma_latency REAL NOT NULL DEFAULT 0,
  quality REAL NOT NULL DEFAULT 0.50,
  health_score REAL NOT NULL DEFAULT 0.45,
  last_outcome TEXT NOT NULL DEFAULT '',
  last_seen_at INTEGER NOT NULL DEFAULT 0,
  quarantine_until INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_route_health_rank
  ON route_health(capability, quarantine_until, health_score DESC, quality DESC);
CREATE INDEX IF NOT EXISTS idx_route_health_provider
  ON route_health(provider, last_seen_at DESC);
