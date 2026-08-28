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

INSERT OR IGNORE INTO route_health(route_key,provider,model_id,capability,health_score,quality,last_outcome,last_seen_at)
VALUES
  ('Kilo::openrouter/free','Kilo','openrouter/free','general',0.58,0.62,'seed',0),
  ('Kilo::nvidia/nemotron-3-super-120b-a12b:free','Kilo','nvidia/nemotron-3-super-120b-a12b:free','reasoning',0.60,0.68,'seed',0),
  ('Kilo::nvidia/nemotron-3-ultra-550b-a55b:free','Kilo','nvidia/nemotron-3-ultra-550b-a55b:free','reasoning',0.59,0.68,'seed',0),
  ('OVHcloud::Mistral-Small-3.2-24B-Instruct-2506','OVHcloud','Mistral-Small-3.2-24B-Instruct-2506','general',0.64,0.72,'seed',0),
  ('OVHcloud::Mistral-7B-Instruct-v0.3','OVHcloud','Mistral-7B-Instruct-v0.3','general',0.61,0.66,'seed',0),
  ('OVHcloud::Mistral-Nemo-Instruct-2407','OVHcloud','Mistral-Nemo-Instruct-2407','general',0.62,0.69,'seed',0);
