import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/auth-helpers';

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
// Métricas globales del dashboard de administrador.

/** Devuelve el lunes de la semana que contiene la fecha dada (ISO). */
function getMondayKey(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay();            // 0=Dom … 6=Sáb
  const diff = day === 0 ? -6 : 1 - day; // ajuste a lunes
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Formato legible "DD MMM" (es-CR) para un ISO YYYY-MM-DD. */
function fmtDay(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CR', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function fmtWeek(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const admin  = createAdminClient();
  const now    = new Date();
  const semana = new Date(now.getTime() - 7  * 86_400_000).toISOString();
  const dos    = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const ocho   = new Date(now.getTime() - 56 * 86_400_000).toISOString();

  // ── Consultas en paralelo ────────────────────────────────────────────────────
  const [
    { count: totalNutri  },
    { count: totalPac    },
    { count: planesActivos },
    { count: totalFotos  },
    { count: totalMediciones },
    { data:  usuariosSemana   },
    { data:  usuariosOchoSemanas },
    { data:  fotosQuincena  },
    { data:  ultimosUsuarios },
    authUsersRes,
  ] = await Promise.all([
    admin.from('nutriologos').select('*', { count: 'exact', head: true }),
    admin.from('pacientes').select('*', { count: 'exact', head: true }),
    admin.from('planes_nutricionales').select('*', { count: 'exact', head: true }).eq('activo', true),
    admin.from('diario_comidas').select('*', { count: 'exact', head: true }),
    admin.from('mediciones_inbody').select('*', { count: 'exact', head: true }),

    // Usuarios nuevos en los últimos 7 días (para nuevos esta semana)
    admin.from('usuarios').select('tipo_usuario, created_at').gte('created_at', semana),

    // Usuarios últimas 8 semanas para el gráfico de crecimiento
    admin.from('usuarios').select('tipo_usuario, created_at').gte('created_at', ocho),

    // Fotos de comida últimos 14 días para actividad diaria
    admin.from('diario_comidas').select('created_at').gte('created_at', dos),

    // Últimos 10 usuarios registrados
    admin
      .from('usuarios')
      .select('id, nombre, apellido, email, tipo_usuario, avatar_url, created_at')
      .order('created_at', { ascending: false })
      .limit(10),

    // Auth users para last_sign_in_at (activos últimos 7 días)
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  // ── Derivados simples ────────────────────────────────────────────────────────
  const semanaUsers = usuariosSemana ?? [];
  const nuevosNutri = semanaUsers.filter((u) => u.tipo_usuario === 'nutriologo').length;
  const nuevosPac   = semanaUsers.filter((u) => u.tipo_usuario === 'paciente').length;

  // Activos últimos 7 días: auth users con last_sign_in_at en los últimos 7 días
  const authUsers = authUsersRes.data?.users ?? [];
  const activosSemana = authUsers.filter((u) => {
    if (!u.last_sign_in_at) return false;
    return new Date(u.last_sign_in_at) >= new Date(semana);
  }).length;

  // ── Gráfico: crecimiento semanal ─────────────────────────────────────────────
  // Generar los 8 lunes más recientes como keys
  const semanasKeys: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 86_400_000);
    semanasKeys.push(getMondayKey(d.toISOString()));
  }

  const weekMap: Record<string, { nutriologos: number; pacientes: number }> = {};
  for (const k of semanasKeys) weekMap[k] = { nutriologos: 0, pacientes: 0 };

  for (const u of (usuariosOchoSemanas ?? [])) {
    const wk = getMondayKey(u.created_at);
    if (wk in weekMap) {
      if (u.tipo_usuario === 'nutriologo') weekMap[wk].nutriologos++;
      else                                  weekMap[wk].pacientes++;
    }
  }

  const crecimiento = semanasKeys.map((k) => ({
    semana:       fmtWeek(k),
    nutriologos:  weekMap[k].nutriologos,
    pacientes:    weekMap[k].pacientes,
  }));

  // ── Gráfico: actividad diaria (últimos 14 días) ───────────────────────────────
  const diasKeys: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    diasKeys.push(d.toISOString().slice(0, 10));
  }

  const diaMap: Record<string, number> = {};
  for (const k of diasKeys) diaMap[k] = 0;

  for (const f of (fotosQuincena ?? [])) {
    const day = f.created_at.slice(0, 10);
    if (day in diaMap) diaMap[day]++;
  }

  const actividadDiaria = diasKeys.map((k) => ({
    dia:   fmtDay(k),
    fotos: diaMap[k],
  }));

  // ── Últimos usuarios con nutriólogo asignado (si es paciente) ─────────────────
  // Enriquecer con nombre del nutriólogo si el usuario es paciente
  const ultiIds = (ultimosUsuarios ?? [])
    .filter((u) => u.tipo_usuario === 'paciente')
    .map((u) => u.id);

  let nutrilMap: Record<string, string> = {};
  if (ultiIds.length) {
    const { data: pacRows } = await admin
      .from('pacientes')
      .select('usuario_id, nutriologos(usuarios(nombre, apellido))')
      .in('usuario_id', ultiIds);

    for (const row of (pacRows ?? [])) {
      const nArr = Array.isArray(row.nutriologos) ? row.nutriologos[0] : row.nutriologos;
      const uArr = Array.isArray((nArr as { usuarios?: unknown })?.usuarios)
        ? (nArr as { usuarios: Array<{ nombre: string; apellido: string | null }> }).usuarios[0]
        : (nArr as { usuarios?: { nombre: string; apellido: string | null } } | null)?.usuarios;
      if (uArr) {
        nutrilMap[row.usuario_id] = [uArr.nombre, uArr.apellido].filter(Boolean).join(' ');
      }
    }
  }

  const ultimosFormateados = (ultimosUsuarios ?? []).map((u) => ({
    ...u,
    nutriologo: nutrilMap[u.id] ?? null,
  }));

  return NextResponse.json({
    metricas: {
      totalNutri:      totalNutri  ?? 0,
      totalPac:        totalPac    ?? 0,
      nuevosNutri,
      nuevosPac,
      activosSemana,
      planesActivos:   planesActivos   ?? 0,
      totalFotos:      totalFotos      ?? 0,
      totalMediciones: totalMediciones ?? 0,
    },
    crecimiento,
    actividadDiaria,
    ultimosUsuarios: ultimosFormateados,
  });
}
