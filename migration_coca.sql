-- Migration: adicionar campo coca_payer na tabela matches
ALTER TABLE matches ADD COLUMN coca_payer TEXT DEFAULT NULL;
