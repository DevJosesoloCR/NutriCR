import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireNutriologo } from '@/lib/supabase/auth-helpers';
import { calcAdherencia, calcEstado, toCRDateKey } from '@/lib/adherencia';

// ─── GET /api/dashboard ───────────────────────────────────────────────────────

export async function GET() {
  // 1. Verificar sesión de nutricionista
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;
  const { nutriologoId } = auth.data;

  try {
    const supabase = createAdminClient();

    // 2. Código de invitación del nutricionista
    const { data: nutrData } = await supabase
      .from('nutriologos')
      .select('codigo_invitacion')
      .eq('id', nutriologoId)
      .single();

    const codigoInvitacion = nutrData?.codigo_invitacion ?? null;

    // 3. Pacientes del nutricionista
    const { data: pacientesRaw, error: pacErr } = await supabase
      .from('pacientes')
      .select('id, usuario_id, objetivo, created_at')
      .eq('nutriologo_id', nutriologoId);

    if (pacErr) throw new Error(pacErr.message);

    // Sin pacientes → devolver lista vacía (no mock)
    if (!pacientesRaw || pacientesRaw.length === 0) {
      return NextResponse.json({
        stats: { totalPacientes: 0, adherenciaPromedio: 0, ingresosMes: 0 },
        pacientes:        [],
        isMockData:       false,
        nutriologoId,
        codigoInvitacion,
      });
    }

    // 4. Datos de usuario para cada paciente
    const usuarioIds  = pacientesRaw.map((p) => p.usuario_id);
    const pacienteIds = pacientesRaw.map((p) => p.id);

    const sevenDaysAgo = new Date(Date.now() - 7  * 86_400_000).toISOString();
    const threeDaysAgo = new Date(Date.now() - 3  * 86_400_000).toISOString();
    const inicioMes    = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    // 5. Consultas en paralelo
    const [
      usuariosRes,
      fotosRes,
      recetasRes,
      escaneosRes,
      pagosRes,
    ] = await Promise.all([

      supabase
        .from('usuarios')
        .select('id, nombre, apellido, email, avatar_url')
        .in('id', usuarioIds),

      // Fotos de diario últimos 7 días (para días únicos + sinFotoReciente)
      supabase
        .from('diario_comidas')
        .select('paciente_id, created_at')
        .in('paciente_id', pacienteIds)
        .gte('created_at', sevenDaysAgo),

      // Recetas últimos 7 días
      supabase
        .from('recetas_generadas')
        .select('paciente_id, created_at')
        .in('paciente_id', pacienteIds)
        .gte('created_at', sevenDaysAgo),

      // Placeholder — escaneos se obtienen por separado (requiere migración en BD)
      Promise.resolve({ data: null }),

      // Ingresos del mes
      supabase
        .from('pagos')
        .select('monto')
        .eq('nutriologo_id', nutriologoId)
        .eq('estado', 'completado')
        .gte('fecha_pago', inicioMes.toISOString()),
    ]);

    // Escaneos de tiquete: query separada hasta que se aplique la migración
    // ALTER TABLE inventario ADD COLUMN IF NOT EXISTS paciente_id uuid REFERENCES pacientes(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let escaneosRaw: { data: { paciente_id: string; created_at: string }[] | null } = { data: null };
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      escaneosRaw = await (supabase as any)
        .from('inventario')
        .select('paciente_id, created_at')
        .in('paciente_id', pacienteIds)
        .gte('created_at', sevenDaysAgo);
    } catch {
      // La columna paciente_id aún no existe — ejecutar migración SQL pendiente
    }

    // 6. Pre-procesar fotos → días únicos por paciente + última foto
    // Map: pacienteId → Set<dateKey>
    const fotosDiasMap = new Map<string, Set<string>>();
    // Map: pacienteId → latestFotoISO
    const ultimaFotoMap = new Map<string, string>();

    for (const f of fotosRes.data ?? []) {
      if (!f.paciente_id) continue;
      const key = toCRDateKey(f.created_at as string);
      if (!fotosDiasMap.has(f.paciente_id)) fotosDiasMap.set(f.paciente_id, new Set());
      fotosDiasMap.get(f.paciente_id)!.add(key);

      const prev = ultimaFotoMap.get(f.paciente_id);
      if (!prev || (f.created_at as string) > prev) {
        ultimaFotoMap.set(f.paciente_id, f.created_at as string);
      }
    }

    // 7. Pre-procesar recetas → conteo + última actividad
    const recetasCountMap = new Map<string, number>();
    const ultimaRecetaMap = new Map<string, string>();

    for (const r of recetasRes.data ?? []) {
      if (!r.paciente_id) continue;
      recetasCountMap.set(r.paciente_id, (recetasCountMap.get(r.paciente_id) ?? 0) + 1);
      const prev = ultimaRecetaMap.get(r.paciente_id);
      if (!prev || (r.created_at as string) > prev) {
        ultimaRecetaMap.set(r.paciente_id, r.created_at as string);
      }
    }

    // 8. Pre-procesar escaneos → conteo
    const escaneosCountMap = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const e of (escaneosRaw.data ?? []) as any[]) {
      if (!e.paciente_id) continue;
      escaneosCountMap.set(e.paciente_id, (escaneosCountMap.get(e.paciente_id) ?? 0) + 1);
    }

    // 9. Ingresos
    const ingresosMes = (pagosRes.data ?? []).reduce((s, p) => s + (p.monto ?? 0), 0);

    // 10. Mapa de usuarios
    const usuariosMap = new Map((usuariosRes.data ?? []).map((u) => [u.id, u]));

    // 11. Construir lista de pacientes
    const now = Date.now();
    const pacientes = pacientesRaw.map((p) => {
      const usuario      = usuariosMap.get(p.usuario_id);
      const fotosUnicos  = fotosDiasMap.get(p.id)?.size ?? 0;
      const recetasCount = recetasCountMap.get(p.id) ?? 0;
      const escaneosCount = escaneosCountMap.get(p.id) ?? 0;

      // Días desde registro (0 si registrado hoy) → denominador real de fotos
      const daysSinceReg = Math.floor((now - new Date(p.created_at).getTime()) / 86_400_000);
      const diasActivos  = Math.min(7, daysSinceReg + 1); // +1: el día de registro cuenta

      const ultimaFoto = ultimaFotoMap.get(p.id) ?? null;
      // Solo "sin foto reciente" si han pasado ≥ 3 días desde el registro;
      // un paciente nuevo que aún no sube su primera foto no es "Urgente".
      const sinFotoReciente = daysSinceReg >= 3 && (!ultimaFoto || ultimaFoto < threeDaysAgo);

      const adherencia = calcAdherencia({ fotosUnicos, recetasCount, escaneosCount, diasActivos });
      const estado     = calcEstado(adherencia, sinFotoReciente);

      // Última actividad: la más reciente entre foto y receta
      const ultimaReceta = ultimaRecetaMap.get(p.id) ?? null;
      const ultimaActividad = [ultimaFoto, ultimaReceta]
        .filter(Boolean)
        .sort()
        .reverse()[0] ?? null;

      return {
        id:              p.id,
        nombre:          usuario?.nombre   ?? 'Desconocido',
        apellido:        usuario?.apellido   ?? null,
        email:           usuario?.email      ?? '',
        avatar_url:      usuario?.avatar_url ?? null,
        objetivo:        p.objetivo,
        adherencia,
        estado,
        ultimaActividad,
      };
    });

    // Ordenar: Urgente primero, luego por seguimiento ascendente
    pacientes.sort((a, b) => {
      const order = { Urgente: 0, Revisar: 1, 'Al día': 2 } as Record<string, number>;
      const od = (order[a.estado] ?? 1) - (order[b.estado] ?? 1);
      return od !== 0 ? od : a.adherencia - b.adherencia;
    });

    return NextResponse.json({
      stats: {
        totalPacientes:     pacientes.length,
        adherenciaPromedio: Math.round(
          pacientes.reduce((s, p) => s + p.adherencia, 0) / pacientes.length,
        ),
        ingresosMes,
      },
      pacientes,
      isMockData:       false,
      nutriologoId,
      codigoInvitacion,
    });

  } catch (err) {
    console.error('[dashboard] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    );
  }
}
