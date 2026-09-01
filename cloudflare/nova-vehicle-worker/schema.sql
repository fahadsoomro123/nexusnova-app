CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  owner_email TEXT,
  display_name TEXT NOT NULL,
  device_token_hash TEXT,
  device_label TEXT,
  tracker_bound INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  last_history_at INTEGER,
  live_lat REAL,
  live_lng REAL,
  live_accuracy REAL,
  live_speed REAL,
  live_heading REAL,
  live_battery REAL,
  live_charging INTEGER,
  live_external_power INTEGER,
  observed_at INTEGER,
  received_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_uid, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_token ON vehicles(device_token_hash) WHERE device_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS pairings (
  code_hash TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pairings_vehicle ON pairings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_pairings_expiry ON pairings(expires_at);

CREATE TABLE IF NOT EXISTS telemetry_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy_m REAL,
  speed_kmh REAL,
  heading REAL,
  battery_pct REAL,
  external_power INTEGER,
  FOREIGN KEY(vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_time ON telemetry_history(vehicle_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_cleanup ON telemetry_history(received_at);
