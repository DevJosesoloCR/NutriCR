import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/auth-helpers';

// ── GET /api/admin/nutricionistas?q=... ───────────────────────────────────────
// Lista todos los nutricionistas con datos de auth (last_sign_in, banned).

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const admin = createAdminClient();

  // 1. Nutriologos + usuarios base
  const { data: nutris, error } = await admin
    .from('nutriologos')
    .select('id, usuario_id, numero_cedula, created_at, usuarios(nombre, apellido, email, avatar_url)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2. Contar pacientes por nutriólogo
  const { data: cuentas } = await admin
    .from('pacientes')
    .select('nutriologo_id');

  const conteo: Record<string, number> = {};
  for (const p of (cuentas ?? [])) {
    if (p.nutriologo_id) conteo[p.nutriologo_id] = (conteo[p.nutriologo_id] ?? 0) + 1;
  }

  // 3. Datos de auth (last_sign_in_at + banned_until) — hasta 1000 usuarios
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const authMap = new Map(
    (authData?.users ?? []).map((u) => [u.id, u]),
  );

  // 4. Armar resultado
  const rows = (nutris ?? []).map((n) => {
    const u    = Array.isArray(n.usuarios) ? n.usuarios[0] : n.usuarios;
    const au   = authMap.get(n.usuario_id);
    const nombre = u ? [u.nombre, u.apellido].filter(Boolean).join(' ') : '';
    const email  = u?.email ?? '';
    const activo = !au?.banned_until || new Date(au.banned_until) < new Date();
    return {
      id:               n.id,
      usuario_id:       n.usuario_id,
      nombre,
      email,
      avatar_url:       u?.avatar_url ?? null,
      numero_cedula:    n.numero_cedula ?? null,
      num_pacientes:    conteo[n.id] ?? 0,
      created_at:       n.created_at,
      last_sign_in_at:  au?.last_sign_in_at ?? null,
      activo,
    };
  });

  // Filtrar por búsqueda
  const filtered = q
    ? rows.filter((r) =>
        r.nombre.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q),
      )
    : rows;

  return NextResponse.json({ data: filtered });
}

// ── PATCH /api/admin/nutricionistas ──────────────────────────────────────────
// Activar o desactivar una cuenta de nutricionista.
// Body: { usuario_id: string; activo: boolean }

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json() as { usuario_id?: string; activo?: boolean };
  if (!body.usuario_id || typeof body.activo !== 'boolean') {
    return NextResponse.json({ error: 'usuario_id y activo son requeridos' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(body.usuario_id, {
    // ban_duration: 'none' → activo; '876600h' ≈ 100 años → efectivamente deshabilitado
    ban_duration: body.activo ? 'none' : '876600h',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
