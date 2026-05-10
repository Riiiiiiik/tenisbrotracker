-- Migration: sessão rápida (placar ao vivo)
-- Executar no console do Cloudflare D1

CREATE TABLE IF NOT EXISTS quick_sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  games_to_win INTEGER NOT NULL DEFAULT 3,
  prize       TEXT,
  status      TEXT DEFAULT 'active',
  started_at  TEXT DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS quick_session_players (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  INTEGER NOT NULL REFERENCES quick_sessions(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  wins        INTEGER DEFAULT 0,
  UNIQUE(session_id, player_name)
);

CREATE INDEX IF NOT EXISTS idx_qs_status ON quick_sessions (status);
CREATE INDEX IF NOT EXISTS idx_qsp_session ON quick_session_players (session_id);
