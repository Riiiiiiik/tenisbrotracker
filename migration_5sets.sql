-- Migration: suporte a jogos de 5 sets
-- Executar no console do Cloudflare D1

ALTER TABLE matches ADD COLUMN set4_p1 INTEGER;
ALTER TABLE matches ADD COLUMN set4_p2 INTEGER;
ALTER TABLE matches ADD COLUMN set5_p1 INTEGER;
ALTER TABLE matches ADD COLUMN set5_p2 INTEGER;
