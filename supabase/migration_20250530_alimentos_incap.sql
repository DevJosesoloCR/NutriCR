-- ── Migration: soporte para fuente='incap' + índice único nombre+fuente ─────────
-- Ejecutar en Supabase Dashboard → SQL Editor
-- Fecha: 2025-05-30

-- 1. Ampliar CHECK de fuente para incluir 'incap'
ALTER TABLE alimentos DROP CONSTRAINT IF EXISTS alimentos_fuente_check;
ALTER TABLE alimentos
  ADD CONSTRAINT alimentos_fuente_check
  CHECK (fuente IN ('openfoodfacts', 'usda', 'manual', 'ia', 'incap'));

-- 2. Índice único (nombre, fuente) para que ON CONFLICT DO NOTHING funcione
--    en el seed y el insert sea idempotente.
CREATE UNIQUE INDEX IF NOT EXISTS alimentos_nombre_fuente_unique
  ON alimentos (nombre, fuente);
