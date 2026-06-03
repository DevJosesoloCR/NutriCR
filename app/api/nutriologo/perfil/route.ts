import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireNutriologo } from '@/lib/supabase/auth-helpers';

// ── GET /api/nutriologo/perfil ────────────────────────────────────────────────
// Devuelve los datos de perfil del nutricionista autenticado.

export async function GET() {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;

  const { data, error } = await createAdminClient()
    .from('nutriologos')
    .select('especialidad, descripcion, telefono')
    .eq('id', auth.data.nutriologoId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// ── PATCH /api/nutriologo/perfil ──────────────────────────────────────────────
// Actualiza los datos de perfil del nutricionista autenticado.

export async function PATCH(request: Request) {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;

  const body = await request.json() as {
    especialidad?: string | null;
    descripcion?:  string | null;
    telefono?:     string | null;
  };

  const { error } = await createAdminClient()
    .from('nutriologos')
    .update(body)
    .eq('id', auth.data.nutriologoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
