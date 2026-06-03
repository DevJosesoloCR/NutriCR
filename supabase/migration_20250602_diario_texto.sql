-- ── Soporte para registros de texto en diario_comidas ────────────────────────
-- Ejecutar en Supabase Dashboard → SQL Editor

-- 1. foto_url pasa a ser nullable (registros sin foto)
ALTER TABLE diario_comidas ALTER COLUMN foto_url DROP NOT NULL;

-- 2. Texto libre de la comida (para entradas manuales sin foto)
ALTER TABLE diario_comidas
  ADD COLUMN IF NOT EXISTS descripcion_texto TEXT;

-- 3. Tipo de comida
ALTER TABLE diario_comidas
  ADD COLUMN IF NOT EXISTS tipo_comida TEXT
  CHECK (tipo_comida IN ('desayuno', 'almuerzo', 'cena', 'merienda'));
