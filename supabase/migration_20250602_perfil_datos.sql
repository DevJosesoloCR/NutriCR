-- ── Perfil extendido de pacientes y nutriologos ──────────────────────────────
-- Ejecutar en Supabase Dashboard → SQL Editor

-- Pacientes: datos biométricos y personales
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS sexo             TEXT CHECK (sexo IN ('masculino', 'femenino')),
  ADD COLUMN IF NOT EXISTS estatura_cm      NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS peso_meta_kg     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS nivel_actividad  TEXT CHECK (nivel_actividad IN
    ('sedentario','ligero','moderado','activo','muy_activo')),
  ADD COLUMN IF NOT EXISTS ocupacion        TEXT,
  ADD COLUMN IF NOT EXISTS telefono         TEXT;

-- Nutriologos: datos de contacto
ALTER TABLE nutriologos
  ADD COLUMN IF NOT EXISTS telefono TEXT;
