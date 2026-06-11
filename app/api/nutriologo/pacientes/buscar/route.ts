import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireNutriologo } from '@/lib/supabase/auth-helpers';

// ── GET /api/nutriologo/pacientes/buscar?q=Jo ─────────────────────────────────
// Busca pacientes del nutricionista autenticado por nombre o apellido.
// Mínimo 1 carácter. Devuelve hasta 10 resultados.

export async function GET(request: Request) {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();

  if (q.length < 1) return NextResponse.json({ data: [] });

  const admin         = createAdminClient();
  const nutriologoId  = auth.data.nutriologoId;

  // Paso 1: obtener todos los pacientes de este nutricionista con su usuario_id
  const { data: pacientes, error: pErr } = await admin
    .from('pacientes')
    .select('id, usuario_id')
    .eq('nutriologo_id', nutriologoId);

  if (pErr) {
    console.error('[buscar-pacientes]', pErr.message);
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  if (!pacientes?.length) return NextResponse.json({ data: [] });

  const usuarioIds = pacientes.map((p) => p.usuario_id).filter(Boolean) as string[];

  // Paso 2: buscar usuarios por nombre/apellido entre los IDs del nutricionista
  const { data: usuarios, error: uErr } = await admin
    .from('usuarios')
    .select('id, nombre, apellido, avatar_url')
    .in('id', usuarioIds)
    .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%`)
    .limit(10);

  if (uErr) {
    console.error('[buscar-pacientes] usuarios:', uErr.message);
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  // Mapa usuario_id → paciente_id para devolver el id correcto
  const pacienteMap = new Map(pacientes.map((p) => [p.usuario_id, p.id]));

  const result = (usuarios ?? [])
    .map((u) => ({
      id:         pacienteMap.get(u.id) ?? '', // pacientes.id (para PATCH /api/pacientes/{id}/plan)
      nombre:     u.nombre     ?? '',
      apellido:   u.apellido   ?? null,
      avatar_url: u.avatar_url ?? null,
    }))
    .filter((r) => r.id); // descartar si por algún motivo no se encontró el mapping

  return NextResponse.json({ data: result });
}
