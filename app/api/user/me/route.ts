import { NextResponse } from 'next/server';
import { createAdminClient, createServerClient } from '@/lib/supabase/server';

// ─── GET /api/user/me ─────────────────────────────────────────────────────────
// Devuelve nombre, apellido, avatar_url desde la tabla usuarios.
// Usado por headers/sidebar para evitar depender del JWT cacheado.

export async function GET() {
  const { data: { user }, error } = await createServerClient().auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data, error: dbErr } = await createAdminClient()
    .from('usuarios')
    .select('nombre, apellido, avatar_url')
    .eq('id', user.id)
    .single();

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
