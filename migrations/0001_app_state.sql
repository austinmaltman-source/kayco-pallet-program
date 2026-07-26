-- Shared app state: one row per store key (see SYNCED_KEYS in
-- src/lib/state-sync.ts). value is the JSON payload the client would have
-- written to localStorage; last write wins, updated_at is server time (ms).
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
