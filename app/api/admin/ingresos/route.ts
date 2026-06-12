import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/auth-helpers';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/ingresos
 *
 * Calcula métricas de ingresos estimados para el panel admin.
 * Modelo: cada paciente registrado genera $PRECIO_POR_PACIENTE/mes.
 * Usa conteo acumulado de pacientes por mes para proyectar MRR histórico.
 */

const PRECIO_POR_PACIENTE = 3.99;

export const dynamic = 'force-dynamic';

/** Etiqueta corta para el eje X del gráfico: "Ene 25", "Feb 25", etc. */
function mesLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-CR', {
    month: 'short',
    year:  '2-digit',
  });
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  // ── 1. Todos los pacientes ─────────────────────────────────────────────────
  const { data: todosLosPacientes, error: pacErr } = await admin
    .from('pacientes')
    .select('id, created_at')
    .order('created_at', { ascending: true });

  if (pacErr) {
    return NextResponse.json({ error: pacErr.message }, { status: 500 });
  }

  const pacientes = todosLosPacientes ?? [];
  const totalPacientes = pacientes.length;

  // ── 2. Construir datos de los últimos 6 meses ─────────────────────────────
  const now = new Date();
  const meses: Array<{
    year:    number;
    month:   number; // 1-indexed
    label:   string;
    endDate: Date;
  }> = [];

  for (let i = 5; i >= 0; i--) {
    const d       = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    meses.push({
      year:    d.getFullYear(),
      month:   d.getMonth() + 1,
      label:   mesLabel(d.getFullYear(), d.getMonth() + 1),
      endDate,
    });
  }

  // Conteo acumulado de pacientes al final de cada mes
  const chartData = meses.map(({ label, endDate }) => {
    const count = pacientes.filter((p) => new Date(p.created_at) <= endDate).length;
    return {
      mes:       label,
      pacientes: count,
      ingresos:  parseFloat((count * PRECIO_POR_PACIENTE).toFixed(2)),
    };
  });

  // ── 3. Métricas principales ────────────────────────────────────────────────
  const mesActual   = chartData[chartData.length - 1];
  const mesAnterior = chartData[chartData.length - 2];

  const ingresosEsteMes       = mesActual.ingresos;
  const ingresosMesAnterior   = mesAnterior.ingresos;

  const crecimientoPct =
    ingresosMesAnterior > 0
      ? ((ingresosEsteMes - ingresosMesAnterior) / ingresosMesAnterior) * 100
      : 0;

  // ── 4. Proyección próximo mes ──────────────────────────────────────────────
  // Tasa de crecimiento promedio de los últimos 3 meses
  const last3Pac = chartData.slice(-3).map((d) => d.pacientes);
  const growthRates = last3Pac.slice(1).map((curr, i) => {
    const prev = last3Pac[i];
    return prev > 0 ? (curr - prev) / prev : 0;
  });
  const avgGrowth =
    growthRates.length > 0
      ? growthRates.reduce((s, r) => s + r, 0) / growthRates.length
      : 0;

  const proyeccionPacientes = Math.round(totalPacientes * (1 + avgGrowth));
  const proyeccionIngresos  = parseFloat((proyeccionPacientes * PRECIO_POR_PACIENTE).toFixed(2));

  // ── 5. Ingreso promedio por nutricionista ──────────────────────────────────
  const { count: totalNutri } = await admin
    .from('nutriologos')
    .select('*', { count: 'exact', head: true });

  const ingresoPorNutri =
    totalNutri && totalNutri > 0
      ? parseFloat((ingresosEsteMes / totalNutri).toFixed(2))
      : 0;

  return NextResponse.json({
    precio:               PRECIO_POR_PACIENTE,
    ingresosEsteMes,
    ingresosMesAnterior,
    crecimientoPct:       parseFloat(crecimientoPct.toFixed(1)),
    proyeccionIngresos,
    proyeccionPacientes,
    pacientesActivos:     totalPacientes,
    ingresoPorNutri,
    totalNutri:           totalNutri ?? 0,
    chartData,
  });
}
