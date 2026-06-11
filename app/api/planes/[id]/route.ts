import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireNutriologo } from '@/lib/supabase/auth-helpers';

// ── PATCH /api/planes/[id] ────────────────────────────────────────────────────
// Actualiza nombre y/o contenido_json de una plantilla.

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;

  const body = await request.json() as {
    nombre?:         string;
    contenido_json?: unknown;
  };

  const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.nombre         !== undefined) updateFields.nombre         = body.nombre;
  if (body.contenido_json !== undefined) updateFields.contenido_json = body.contenido_json;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient().from('planes_nutricionales') as any)
    .update(updateFields)
    .eq('id', params.id)
    .eq('nutriologo_id', auth.data.nutriologoId) // solo el propio nutricionista
    .is('paciente_id', null)                      // solo plantillas, no planes de pacientes
    .select('id, nombre, contenido_json, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// ── DELETE /api/planes/[id] ───────────────────────────────────────────────────
// Elimina una plantilla. No puede eliminar planes asignados a pacientes.

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;

  const { error } = await createAdminClient()
    .from('planes_nutricionales')
    .delete()
    .eq('id', params.id)
    .eq('nutriologo_id', auth.data.nutriologoId)
    .is('paciente_id', null); // solo plantillas

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
