-- ================================================
-- Court Clash - Schema do Banco de Dados
-- Cloudflare D1 (compatível com SQLite)
-- ================================================

-- Tabela principal de confrontos
CREATE TABLE IF NOT EXISTS matches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player1     TEXT    NOT NULL,
  player2     TEXT    NOT NULL,
  set1_p1     INTEGER NOT NULL,
  set1_p2     INTEGER NOT NULL,
  set2_p1     INTEGER NOT NULL,
  set2_p2     INTEGER NOT NULL,
  set3_p1     INTEGER,           -- opcional (3º set)
  set3_p2     INTEGER,           -- opcional (3º set)
  winner      TEXT    NOT NULL,
  match_date  TEXT    NOT NULL,  -- formato ISO: YYYY-MM-DD
  notes       TEXT,              -- observações opcionais
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT    DEFAULT (datetime('now'))
);

-- Índice para ordenação por data de partida
CREATE INDEX IF NOT EXISTS idx_matches_date   ON matches (match_date DESC);

-- Índice para filtro por vencedor
CREATE INDEX IF NOT EXISTS idx_matches_winner ON matches (winner);
