CREATE TABLE IF NOT EXISTS reward_audit (
  event_id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_reward_audit_uid_created
  ON reward_audit(uid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reward_audit_kind_created
  ON reward_audit(kind, created_at DESC);
