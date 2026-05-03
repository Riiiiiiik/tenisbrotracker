-- Migration: adicionar tabela de jogadores
-- Executar no console do Cloudflare D1

CREATE TABLE IF NOT EXISTS players (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  avatar     TEXT,    -- URL ou base64 da foto do jogador
  created_at TEXT    DEFAULT (datetime('now'))
);
