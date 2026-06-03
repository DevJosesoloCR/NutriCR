import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePaciente } from '@/lib/supabase/auth-helpers';

// ── GET /api/paciente/perfil ──────────────────────────────────────────────────
// Devuelve los datos de perfil del paciente autenticado.

export async function GET() {
  const auth = await requirePaciente();
  if (!auth.ok) return auth.response;

  const { data, error } = await createAdminClient()
    .from('pacientes')
    .select('fecha_nacimiento, sexo, estatura_cm, peso_meta_kg, nivel_actividad, ocupacion, telefono')
    .eq('id', auth.data.pacienteId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// ── PATCH /api/paciente/perfil ────────────────────────────────────────────────
// Actualiza los datos de perfil del paciente autenticado.

export async function PATCH(request: Request) {
  const auth = await requirePaciente();
  if (!auth.ok) return auth.response;

  const body = await request.json() as {
    fecha_nacimiento?: string | null;
    sexo?:            'masculino' | 'femenino' | null;
    estatura_cm?:     number | null;
    peso_meta_kg?:    number | null;
    nivel_actividad?: 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy_activo' | null;
    ocupacion?:       string | null;
    telefono?:        string | null;
  };

  const { error } = await createAdminClient()
    .from('pacientes')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', auth.data.pacienteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
