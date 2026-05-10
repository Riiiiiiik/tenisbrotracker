-- Migration: sistema de torneios com ranking
-- Executar no console do Cloudflare D1

-- Torneio: define período, prêmio e participantes
CREATE TABLE IF NOT EXISTS tournaments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  duration    TEXT    NOT NULL,           -- '1m', '3m', '6m'
  start_date  TEXT    NOT NULL,           -- YYYY-MM-DD
  end_date    TEXT    NOT NULL,           -- YYYY-MM-DD (calculado a partir de start_date + duration)
  prize       TEXT,                       -- descrição do prêmio/valor (ex: "R$ 200,00", "Jantar")
  status      TEXT    DEFAULT 'active',   -- 'active' ou 'finished'
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- Jogadores inscritos no torneio
CREATE TABLE IF NOT EXISTS tournament_players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_name   TEXT    NOT NULL,
  UNIQUE(tournament_id, player_name)
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments (status);
CREATE INDEX IF NOT EXISTS idx_tp_tournament ON tournament_players (tournament_id);
