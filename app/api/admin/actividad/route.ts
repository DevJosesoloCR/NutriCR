import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/auth-helpers';

// ── GET /api/admin/actividad?tipo=...&desde=...&hasta=... ─────────────────────
// Feed de actividad global — combina eventos de múltiples tablas.

type TipoEvento =
  | 'nuevo_nutriologo'
  | 'nuevo_paciente'
  | 'plan_asignado'
  | 'medicion_inbody'
  | 'foto_comida';

interface Evento {
  id:        string;
  tipo:      TipoEvento;
  titulo:    string;
  detalle:   string | null;
  fecha:     string;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const tipo  = searchParams.get('tipo')  ?? '';   // filtro opcional
  const desde = searchParams.get('desde') ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const hasta = searchParams.get('hasta') ?? new Date().toISOString();

  const admin  = createAdminClient();
  const events: Evento[] = [];

  // ── 1. Nuevos nutricionistas ───────────────────────────────────────────────
  if (!tipo || tipo === 'nuevo_nutriologo') {
    const { data } = await admin
      .from('nutriologos')
      .select('id, created_at, usuarios(nombre, apellido, email)')
      .gte('created_at', desde)
      .lte('created_at', hasta)
      .order('created_at', { ascending: false })
      .limit(100);

    for (const r of (data ?? [])) {
      const u = Array.isArray(r.usuarios) ? r.usuarios[0] : r.usuarios;
      events.push({
        id:      `nutri-${r.id}`,
        tipo:    'nuevo_nutriologo',
        titulo:  `Nuevo nutricionista registrado`,
        detalle: u ? [u.nombre, u.apellido].filter(Boolean).join(' ') + (u.email ? ` · ${u.email}` : '') : null,
        fecha:   r.created_at,
      });
    }
  }

  // ── 2. Nuevos pacientes ────────────────────────────────────────────────────
  if (!tipo || tipo === 'nuevo_paciente') {
    const { data } = await admin
      .from('pacientes')
      .select('id, created_at, usuarios(nombre, apellido), nutriologos(usuarios(nombre, apellido))')
      .gte('created_at', desde)
      .lte('created_at', hasta)
      .order('created_at', { ascending: false })
      .limit(100);

    for (const r of (data ?? [])) {
      const u  = Array.isArray(r.usuarios) ? r.usuarios[0] : r.usuarios;
      const n  = Array.isArray(r.nutriologos) ? r.nutriologos[0] : r.nutriologos;
      const nu = n ? (Array.isArray((n as { usuarios?: unknown }).usuarios) ? (n as { usuarios: Array<{ nombre: string; apellido: string | null }> }).usuarios[0] : (n as { usuarios?: { nombre: string; apellido: string | null } }).usuarios) : null;
      const paciente = u ? [u.nombre, u.apellido].filter(Boolean).join(' ') : 'Paciente';
      const nutriNombre = nu ? ` → ${[nu.nombre, nu.apellido].filter(Boolean).join(' ')}` : '';
      events.push({
        id:      `pac-${r.id}`,
        tipo:    'nuevo_paciente',
        titulo:  'Nuevo paciente registrado',
        detalle: paciente + nutriNombre,
        fecha:   r.created_at,
      });
    }
  }

  // ── 3. Planes nutricionales asignados ──────────────────────────────────────
  if (!tipo || tipo === 'plan_asignado') {
    const { data } = await (admin.from('planes_nutricionales') as any)
      .select('id, nombre, created_at, pacientes(usuarios(nombre, apellido))')
      .gte('created_at', desde)
      .lte('created_at', hasta)
      .not('paciente_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100) as { data: Array<{ id: string; nombre: string; created_at: string; pacientes: unknown }> | null };

    for (const r of (data ?? [])) {
      const p  = Array.isArray(r.pacientes) ? (r.pacientes as Array<{ usuarios: unknown }>)[0] : r.pacientes as { usuarios?: unknown } | null;
      const u  = p ? (Array.isArray((p as { usuarios?: unknown }).usuarios) ? (p as { usuarios: Array<{ nombre: string; apellido: string | null }> }).usuarios[0] : (p as { usuarios?: { nombre: string; apellido: string | null } }).usuarios) : null;
      events.push({
        id:      `plan-${r.id}`,
        tipo:    'plan_asignado',
        titulo:  'Plan nutricional asignado',
        detalle: `${r.nombre}` + (u ? ` → ${[u.nombre, u.apellido].filter(Boolean).join(' ')}` : ''),
        fecha:   r.created_at,
      });
    }
  }

  // ── 4. Mediciones InBody ───────────────────────────────────────────────────
  if (!tipo || tipo === 'medicion_inbody') {
    const { data } = await admin
      .from('mediciones_inbody')
      .select('id, fecha, created_at, peso, pacientes(usuarios(nombre, apellido))')
      .gte('created_at', desde)
      .lte('created_at', hasta)
      .order('created_at', { ascending: false })
      .limit(100);

    for (const r of (data ?? [])) {
      const p = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
      const u = p ? (Array.isArray((p as { usuarios?: unknown }).usuarios) ? (p as { usuarios: Array<{ nombre: string; apellido: string | null }> }).usuarios[0] : (p as { usuarios?: { nombre: string; apellido: string | null } }).usuarios) : null;
      events.push({
        id:      `inbody-${r.id}`,
        tipo:    'medicion_inbody',
        titulo:  'Medición InBody registrada',
        detalle: (u ? [u.nombre, u.apellido].filter(Boolean).join(' ') : 'Paciente')
                 + (r.peso ? ` · ${r.peso} kg` : ''),
        fecha:   r.created_at,
      });
    }
  }

  // ── 5. Fotos de comida ────────────────────────────────────────────────────
  if (!tipo || tipo === 'foto_comida') {
    const { data } = await admin
      .from('diario_comidas')
      .select('id, tipo_comida, created_at, pacientes(usuarios(nombre, apellido))')
      .gte('created_at', desde)
      .lte('created_at', hasta)
      .order('created_at', { ascending: false })
      .limit(100);

    for (const r of (data ?? [])) {
      const p = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
      const u = p ? (Array.isArray((p as { usuarios?: unknown }).usuarios) ? (p as { usuarios: Array<{ nombre: string; apellido: string | null }> }).usuarios[0] : (p as { usuarios?: { nombre: string; apellido: string | null } }).usuarios) : null;
      events.push({
        id:      `foto-${r.id}`,
        tipo:    'foto_comida',
        titulo:  'Foto de comida subida',
        detalle: (u ? [u.nombre, u.apellido].filter(Boolean).join(' ') : 'Paciente')
                 + (r.tipo_comida ? ` · ${r.tipo_comida}` : ''),
        fecha:   r.created_at,
      });
    }
  }

  // Ordenar por fecha descendente y limitar a 200
  events.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return NextResponse.json({ data: events.slice(0, 200) });
}
