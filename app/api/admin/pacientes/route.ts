import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/auth-helpers';

// ── GET /api/admin/pacientes?q=...&nutriologo_id=... ─────────────────────────

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const q            = (searchParams.get('q')             ?? '').trim().toLowerCase();
  const nutriId      =  searchParams.get('nutriologo_id') ?? '';

  const admin = createAdminClient();

  // Pacientes con usuario + nutriólogo
  let query = admin
    .from('pacientes')
    .select('id, usuario_id, nutriologo_id, created_at, usuarios(nombre, apellido, email, avatar_url), nutriologos(id, usuarios(nombre, apellido))')
    .order('created_at', { ascending: false })
    .limit(500);

  if (nutriId) query = query.eq('nutriologo_id', nutriId) as typeof query;

  const { data: pacs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Datos auth para last_sign_in_at
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const authMap = new Map((authData?.users ?? []).map((u) => [u.id, u]));

  const rows = (pacs ?? []).map((p) => {
    const u  = Array.isArray(p.usuarios) ? p.usuarios[0] : p.usuarios;
    const n  = Array.isArray(p.nutriologos) ? p.nutriologos[0] : p.nutriologos;
    const nu = n ? (Array.isArray((n as { usuarios?: unknown }).usuarios) ? (n as { usuarios: Array<{ nombre: string; apellido: string | null }> }).usuarios[0] : (n as { usuarios?: { nombre: string; apellido: string | null } }).usuarios) : null;
    const au = authMap.get(p.usuario_id);

    return {
      id:              p.id,
      usuario_id:      p.usuario_id,
      nutriologo_id:   p.nutriologo_id ?? null,
      nombre:          u ? [u.nombre, u.apellido].filter(Boolean).join(' ') : '',
      email:           u?.email ?? '',
      avatar_url:      u?.avatar_url ?? null,
      nutriologo_nombre: nu ? [nu.nombre, nu.apellido].filter(Boolean).join(' ') : null,
      created_at:      p.created_at,
      last_sign_in_at: au?.last_sign_in_at ?? null,
    };
  });

  const filtered = q
    ? rows.filter((r) => r.nombre.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
    : rows;

  return NextResponse.json({ data: filtered });
}
