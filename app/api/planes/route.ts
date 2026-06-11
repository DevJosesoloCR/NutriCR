import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireNutriologo } from '@/lib/supabase/auth-helpers';

// ── GET /api/planes ───────────────────────────────────────────────────────────
// Lista las plantillas de planes del nutricionista autenticado.
// Plantilla = plan con paciente_id IS NULL.

export async function GET() {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient().from('planes_nutricionales') as any)
    .select('id, nombre, contenido_json, created_at, updated_at')
    .eq('nutriologo_id', auth.data.nutriologoId)
    .is('paciente_id', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// ── POST /api/planes ──────────────────────────────────────────────────────────
// Crea una nueva plantilla de plan (sin paciente asignado todavía).

export async function POST(request: Request) {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;

  const body = await request.json() as {
    nombre:         string;
    contenido_json: unknown;
  };

  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient().from('planes_nutricionales') as any)
    .insert({
      nutriologo_id:  auth.data.nutriologoId,
      nombre:         body.nombre.trim(),
      contenido_json: body.contenido_json ?? null,
      paciente_id:    null,   // plantilla — sin paciente
      activo:         false,  // solo activo cuando se asigna a un paciente
    })
    .select('id, nombre, contenido_json, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
