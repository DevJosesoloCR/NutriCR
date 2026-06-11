import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePaciente } from '@/lib/supabase/auth-helpers';

// ── GET /api/paciente/plan ────────────────────────────────────────────────────
// Devuelve el plan nutricional activo asignado al paciente autenticado.
// Incluye el campo contenido_json con el plan clínico estructurado.

export async function GET() {
  const auth = await requirePaciente();
  if (!auth.ok) return auth.response;

  const { pacienteId } = auth.data;

  const { data, error } = await createAdminClient()
    .from('planes_nutricionales')
    .select(
      'id, nombre, calorias_diarias, proteinas_g, carbohidratos_g, grasas_g, restricciones_dieteticas, contenido_json',
    )
    .eq('paciente_id', pacienteId)
    .eq('activo', true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
