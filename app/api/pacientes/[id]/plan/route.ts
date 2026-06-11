import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireNutriologo } from '@/lib/supabase/auth-helpers';

const SELECT_COLS =
  'id, nombre, calorias_diarias, proteinas_g, carbohidratos_g, grasas_g, restricciones_dieteticas, contenido_json';

// ── GET /api/pacientes/[id]/plan ──────────────────────────────────────────────
// Devuelve el plan activo del paciente (para el panel del nutricionista).

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;

  const { data, error } = await createAdminClient()
    .from('planes_nutricionales')
    .select(SELECT_COLS)
    .eq('paciente_id', params.id)
    .eq('activo', true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// ── PATCH /api/pacientes/[id]/plan ────────────────────────────────────────────
// Actualiza solo los campos presentes en el body (merge parcial).
// Soporta: macros numéricos, restricciones[], y contenido_json (plan clínico).

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const body = await request.json() as Record<string, unknown>;

  // Solo incluir campos que existan en el body (permite actualizaciones parciales)
  const CAMPOS_PERMITIDOS = [
    'calorias_diarias',
    'proteinas_g',
    'carbohidratos_g',
    'grasas_g',
    'restricciones_dieteticas',
    'contenido_json',
  ] as const;

  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const campo of CAMPOS_PERMITIDOS) {
    if (campo in body) updateFields[campo] = body[campo] ?? null;
  }

  // Buscar plan activo existente
  const { data: existing } = await supabase
    .from('planes_nutricionales')
    .select('id')
    .eq('paciente_id', params.id)
    .eq('activo', true)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbl = supabase.from('planes_nutricionales') as any;

  if (existing) {
    const { error } = await tbl.update(updateFields).eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await tbl.insert({
      paciente_id:   params.id,
      nutriologo_id: auth.data.nutriologoId,
      nombre:        'Plan principal',
      activo:        true,
      ...updateFields,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
