'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import Card from '@/components/ui/Card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Medicion {
  id: string;
  fecha: string;
  peso: number | null;
  grasa_porcentaje: number | null;
  musculo_kg: number | null;
}

interface Plan {
  calorias_diarias: number | null;
  proteinas_g: number | null;
  carbohidratos_g: number | null;
  grasas_g: number | null;
}

interface Receta {
  id: string;
  nombre: string;
  calorias: number | null;
  tiempo_preparacion_minutos: number | null;
  tipo_comida: string;
}

interface Notificacion {
  id: string;
  tipo: string;
  mensaje: string;
  created_at: string;
}

type TipoComida = 'desayuno' | 'almuerzo' | 'cena' | 'merienda';

interface InicioData {
  mediciones:      Medicion[];
  plan:            Plan | null;
  recetaSugerida:  Receta | null;
  notificaciones:  Notificacion[];
  diarioFechas:    string[];       // ISO timestamps del diario (últimos 30 días)
  tipoComida:      TipoComida;
  paciente:        { nombre: string; apellido: string | null };
  recetasSemana:        number;         // recetas generadas en los últimos 7 días
  escaneosSemana:       number;         // escaneos de tiquete en los últimos 7 días
  pacienteRegistradoEn: string | null;  // ISO timestamp del registro del paciente
}

type Metrica = 'peso' | 'grasa' | 'musculo';
type ChartPoint = {
  label:      string;
  real:       number | null;
  proyeccion: number | null;
  esMeta?:    true;   // marca el último punto de proyección para el label
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TDEE_ASUMIDO = 2000; // kcal/día asumido si el paciente no tiene plan

// Proyección conservadora por defecto (sin plan nutricional asignado)
const FALLBACK_SEMANAL: Record<Metrica, number> = {
  peso:    -0.5,   // ½ kg/semana de pérdida moderada
  grasa:   -0.15,  // ~0.15 pp de grasa/semana
  musculo:  0,     // sin datos de plan, se asume mantenimiento
};

const METRICA: Record<Metrica, { label: string; unit: string; color: string }> = {
  peso:    { label: 'Peso',    unit: 'kg', color: '#16a34a' },
  grasa:   { label: 'Grasa',   unit: '%',  color: '#ea580c' },
  musculo: { label: 'Músculo', unit: 'kg', color: '#2563eb' },
};

const COMIDA: Record<TipoComida, { icon: string; label: string }> = {
  desayuno: { icon: '☀️',  label: 'Desayuno' },
  almuerzo: { icon: '🌤️', label: 'Almuerzo' },
  cena:     { icon: '🌙',  label: 'Cena'     },
  merienda: { icon: '🍎',  label: 'Merienda' },
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function getSaludo(): string {
  const h = new Date().getHours();
  if (h >= 6  && h < 12) return 'Buenos días';
  if (h >= 12 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatFechaHoy(): string {
  return new Date().toLocaleDateString('es-CR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** YYYY-MM-DD en zona local del navegador. */
function toDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA'); // 'en-CA' → YYYY-MM-DD
}

/** Convierte la clave pública VAPID (URL-safe base64) al Uint8Array que
 *  necesita PushManager.subscribe({ applicationServerKey }). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)));
}

// Abreviaciones de día (índice = getDay(), 0=Dom … 6=Sáb)
const DAY_ABBREV = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const;

/**
 * Los últimos 7 días terminando en hoy (del más antiguo al más reciente).
 * Siempre son exactamente 7 días; el filtro de pre-registro se aplica en otro
 * lugar para no romper el layout de 7 puntos.
 */
function getLast7Days(today: Date): Date[] {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() - (6 - i)); // [hoy-6, hoy-5, …, hoy]
    return d;
  });
}

/** Días consecutivos de registro terminando en hoy. */
function calcStreak(diarioFechasSet: Set<string>, today: Date): number {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    if (diarioFechasSet.has(toDateKey(d))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Seguimiento 0-100 con la fórmula 80/10/10.
 *  `diasActivos` ajusta el denominador de fotos al período real del paciente (1-7). */
function calcAdherenciaPct(
  fotosUnicos:  number,
  diasActivos:  number,
  recetasCount: number,
  escaneosCount: number,
): number {
  const denom    = Math.max(1, Math.min(diasActivos, 7));
  const fotos    = (Math.min(fotosUnicos,  denom) / denom) * 80;
  const recetas  = (Math.min(recetasCount,  3) / 3) * 10;
  const escaneos =  Math.min(escaneosCount, 1)       * 10;
  return Math.round(fotos + recetas + escaneos);
}

/** Fecha relativa compacta para notas (ej. "Hoy", "Ayer", "23 may"). */
function formatNotifFecha(iso: string): string {
  const d     = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ayer  = new Date(today); ayer.setDate(today.getDate() - 1);
  const dKey  = toDateKey(d);
  if (dKey === toDateKey(today)) return 'Hoy';
  if (dKey === toDateKey(ayer))  return 'Ayer';
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
}

function getMetricValue(m: Medicion, met: Metrica): number | null {
  if (met === 'peso')    return m.peso;
  if (met === 'grasa')   return m.grasa_porcentaje;
  return m.musculo_kg;
}

function buildChartData(
  mediciones: Medicion[],
  metrica: Metrica,
  plan: Plan | null,
): ChartPoint[] {
  // Tomar las últimas 8 mediciones que tengan valor para esta métrica
  const withValue = mediciones
    .filter((m) => getMetricValue(m, metrica) != null)
    .slice(-8);

  const points: ChartPoint[] = [];

  withValue.forEach((m, i) => {
    const val     = getMetricValue(m, metrica) as number;
    const isPivot = i === withValue.length - 1;
    const date    = new Date(m.fecha);
    const label   = date.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });

    points.push({
      label,
      real: val,
      // BUG FIX: el pivot SIEMPRE tiene proyeccion = val (conecta las dos líneas)
      // antes estaba `isPivot && plan ? val : null` → sin plan, la proyección no arrancaba
      proyeccion: isPivot ? val : null,
    });
  });

  const lastMedicion = withValue[withValue.length - 1];
  const lastVal      = lastMedicion ? getMetricValue(lastMedicion, metrica) : null;

  // BUG FIX: antes era `if (lastVal !== null && plan?.calorias_diarias)` →
  // sin plan nunca se agregaban las semanas de proyección.
  // Ahora: si hay plan con calorías definidas, calcular con el plan;
  // si no, usar proyección conservadora por defecto.
  if (lastVal !== null) {
    let weeklyChange: number;

    if (plan?.calorias_diarias) {
      // Proyección basada en plan nutricional real
      const calDiff    = plan.calorias_diarias - TDEE_ASUMIDO;
      const weeklyKg   = (calDiff * 7) / 7700; // ~7700 kcal ≈ 1 kg de tejido

      if (metrica === 'peso') {
        weeklyChange = weeklyKg;
      } else if (metrica === 'grasa') {
        // Déficit → pierde principalmente grasa; superávit → baja ligeramente la %
        weeklyChange = calDiff < 0 ? weeklyKg * 0.4 : weeklyKg * 0.12;
      } else {
        // Músculo crece con superávit; en déficit se mantiene
        weeklyChange = calDiff > 0 ? weeklyKg * 0.25 : 0;
      }
    } else {
      // Sin plan asignado → proyección conservadora por defecto
      weeklyChange = FALLBACK_SEMANAL[metrica];
    }

    for (let w = 1; w <= 4; w++) {
      const projected = parseFloat((lastVal + weeklyChange * w).toFixed(1));
      points.push({
        label:      `+${w} sem`,
        real:       null,
        proyeccion: projected,
        // BUG FIX: marcar el último punto para renderizar la etiqueta "Meta"
        ...(w === 4 ? { esMeta: true } : {}),
      });
    }
  }

  return points;
}

// ─── Custom SVG dot for the real line ────────────────────────────────────────
// Regular measurements → small filled circle.
// Pivot (last real = today) → pulsing SMIL animation.

function PulsingDot(props: any) {
  const { cx, cy, stroke, payload } = props;
  if (payload?.real == null || cx == null || cy == null) return <g />;

  const color    = stroke ?? '#16a34a';
  const isPivot  = payload.proyeccion != null; // pivot has both series set

  if (!isPivot) {
    return (
      <circle cx={cx} cy={cy} r={3} fill={color} stroke="white" strokeWidth={1.5} />
    );
  }

  return (
    <g>
      {/* Outer pulsing ring */}
      <circle cx={cx} cy={cy} r={5} fill={color} fillOpacity={0.3}>
        <animate attributeName="r"            values="5;14;5"       dur="2s" repeatCount="indefinite" />
        <animate attributeName="fill-opacity" values="0.3;0;0.3"   dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Solid inner dot */}
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />
    </g>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InicioPage() {
  const [data,        setData]       = useState<InicioData | null>(null);
  const [loading,     setLoading]    = useState(true);
  const [metrica,     setMetrica]    = useState<Metrica>('peso');
  // notificaciones: IDs que el usuario ya marcó como leídas en esta sesión
  const [notifOcultas,  setNotifOcultas]  = useState<Set<string>>(new Set());
  const [marcandoId,    setMarcandoId]    = useState<string | null>(null);

  // ── Push notifications ──────────────────────────────────────────────────────
  const [pushBanner,    setPushBanner]    = useState(false);
  const pushAttempted   = useRef(false); // evitar doble-suscripción

  // ── Fetch ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/paciente/inicio')
      .then((r) => r.json())
      .then((json: InicioData) => setData(json))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Web Push: registrar suscripción / mostrar banner ────────────────────────
  const subscribePush = useCallback(async () => {
    if (pushAttempted.current) return;
    pushAttempted.current = true;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as any,
        });
      }
      await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription: sub.toJSON() }),
      });
    } catch {
      // Push no disponible o el usuario lo rechazó — silencioso
    }
  }, []);

  useEffect(() => {
    // Push requiere SW + PushManager (no disponible en todos los browsers)
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const perm = Notification.permission;
    if (perm === 'denied') return;       // ya denegado — no molestar
    if (perm === 'granted') {
      subscribePush();                   // ya tiene permiso → suscribir silenciosamente
      return;
    }
    // perm === 'default' → mostrar banner una vez
    setPushBanner(true);
  }, [subscribePush]);

  // ── Chart data (memoized) ───────────────────────────────────────────────────
  const chartData = useMemo(
    () => (data ? buildChartData(data.mediciones, metrica, data.plan) : []),
    [data, metrica],
  );

  // Goal value = last proyeccion point
  const metaFinal = useMemo(() => {
    const last = [...chartData].reverse().find((p) => p.proyeccion != null);
    return last?.proyeccion ?? null;
  }, [chartData]);

  const hasChart = chartData.length > 0;
  const { unit, color } = METRICA[metrica];

  // ── Seguimiento semanal ──────────────────────────────────────────────────────
  const today    = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  // Fecha de registro del paciente (null hasta que carguen los datos)
  const registradoEn = useMemo(
    () => data?.pacienteRegistradoEn ? new Date(data.pacienteRegistradoEn) : null,
    [data?.pacienteRegistradoEn],
  );
  // Clave YYYY-MM-DD del día de registro (para comparar con toDateKey)
  const regKey = useMemo(
    () => registradoEn ? toDateKey(registradoEn) : null,
    [registradoEn],
  );

  // Siempre 7 días: [hoy-6, hoy-5, …, hoy]
  const last7Days = useMemo(() => getLast7Days(today), [today]);

  // Días activos = cuántos de los 7 son ≥ fecha de registro (1-7)
  const diasActivos = useMemo(() => {
    if (!regKey) return 7;
    return last7Days.filter((d) => toDateKey(d) >= regKey).length;
  }, [last7Days, regKey]);

  const diarioFechasSet = useMemo(() => {
    const set = new Set<string>();
    (data?.diarioFechas ?? []).forEach((iso) =>
      set.add(toDateKey(new Date(iso))),
    );
    return set;
  }, [data?.diarioFechas]);

  const streak = useMemo(
    () => calcStreak(diarioFechasSet, today),
    [diarioFechasSet, today],
  );

  // Días únicos con foto en la ventana activa (excluye días pre-registro)
  const fotosUnicasSemana = useMemo(() => {
    let count = 0;
    for (const day of last7Days) {
      const k = toDateKey(day);
      if (regKey && k < regKey) continue; // día previo al registro → no cuenta
      if (diarioFechasSet.has(k)) count++;
    }
    return count;
  }, [last7Days, regKey, diarioFechasSet]);

  const adherenciaPct = useMemo(
    () => calcAdherenciaPct(
      fotosUnicasSemana,
      diasActivos,
      data?.recetasSemana  ?? 0,
      data?.escaneosSemana ?? 0,
    ),
    [fotosUnicasSemana, diasActivos, data?.recetasSemana, data?.escaneosSemana],
  );

  // ── Notificaciones visibles (filtramos las ya marcadas en esta sesión) ──────
  const notifVisibles = useMemo(
    () => (data?.notificaciones ?? []).filter((n) => !notifOcultas.has(n.id)),
    [data?.notificaciones, notifOcultas],
  );

  // ── Solicitar permiso de push (desde el banner) ─────────────────────────────
  async function requestPushPermission() {
    setPushBanner(false);
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') await subscribePush();
    } catch {
      // silencioso
    }
  }

  // ── Marcar una notificación como leída ──────────────────────────────────────
  async function marcarLeida(id: string) {
    setMarcandoId(id);
    try {
      await fetch('/api/notificaciones', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
      setNotifOcultas((prev) => new Set(Array.from(prev).concat(id)));
    } finally {
      setMarcandoId(null);
    }
  }

  // ── Dot final de proyección con etiqueta "Meta en 4 semanas" ───────────────
  // Se usa como prop `dot` de la línea punteada. Para la mayoría de puntos
  // devuelve <g/> vacío; solo el punto `esMeta` renderiza marcador + label.
  const projectionDot = useCallback(
    (props: any) => {
      const { cx, cy, payload } = props;
      if (!payload?.esMeta || cx == null || cy == null) return <g />;

      const val   = payload.proyeccion as number;
      const label = `Meta ${val.toFixed(1)} ${unit}`;

      return (
        <g>
          {/* Círculo marcador del punto meta */}
          <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />
          {/* Etiqueta anclada a la derecha del punto para no salirse */}
          <text
            x={cx - 8}
            y={cy - 10}
            textAnchor="end"
            fill={color}
            fontSize={9}
            fontWeight="700"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          >
            {label}
          </text>
        </g>
      );
    },
    [color, unit],
  );

  // ── Custom tooltip (memoized per unit to avoid recharts flicker) ────────────
  const CustomTooltip = useCallback(
    ({ active, payload, label }: any) => {
      if (!active || !payload?.length) return null;
      const realPt = payload.find((p: any) => p.dataKey === 'real'       && p.value != null);
      const projPt = payload.find((p: any) => p.dataKey === 'proyeccion' && p.value != null);
      const val    = realPt?.value ?? projPt?.value;
      if (val == null) return null;
      const isProj = !realPt && !!projPt;
      return (
        <div className="bg-white border border-slate-100 rounded-xl shadow-xl px-3 py-2 text-xs pointer-events-none">
          <p className="font-semibold text-slate-500 mb-0.5">{label}</p>
          <p className={isProj ? 'text-slate-400 italic' : 'font-bold'} style={isProj ? {} : { color }}>
            {isProj ? '~' : ''}{Number(val).toFixed(1)}&thinsp;{unit}
            {isProj && <span className="ml-1">(proy.)</span>}
          </p>
        </div>
      );
    },
    [unit, color],
  );

  // ─── Derived display values ─────────────────────────────────────────────────
  const saludo     = getSaludo();
  const fecha      = formatFechaHoy();
  const nombre     = data?.paciente.nombre ?? '';
  const tipoComida = data?.tipoComida ?? 'desayuno';

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-4">

      {/* ── Banner: activar notificaciones push ────────────────────────────── */}
      {pushBanner && (
        <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
          <span className="mt-0.5 text-xl leading-none">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800 leading-snug">
              Activa las notificaciones
            </p>
            <p className="text-xs text-green-700 mt-0.5 leading-relaxed">
              Recibe alertas cuando tu nutricionista te envíe un mensaje.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={requestPushPermission}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 active:scale-95 transition-all"
            >
              Activar
            </button>
            <button
              onClick={() => setPushBanner(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 active:scale-95 transition-all"
            >
              Ahora no
            </button>
          </div>
        </div>
      )}

      {/* ── Saludo ─────────────────────────────────────────────────────────── */}
      <div className="pt-2">
        {loading ? (
          <>
            <div className="h-3.5 bg-slate-100 rounded animate-pulse w-36 mb-1.5" />
            <div className="h-7   bg-slate-100 rounded animate-pulse w-52" />
          </>
        ) : (
          <>
            <p className="text-slate-400 text-sm capitalize">{fecha}</p>
            <h1 className="text-2xl font-bold text-slate-800 leading-tight">
              {saludo}{nombre ? `, ${nombre}` : ''}&nbsp;👋
            </h1>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          GRÁFICA DE PROGRESO
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="p-4 space-y-3">

        {/* Header + selector de métrica */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-700 whitespace-nowrap">Mi progreso</h2>
          <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
            {(Object.entries(METRICA) as [Metrica, typeof METRICA[Metrica]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setMetrica(key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 ${
                  metrica === key
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart area */}
        {loading ? (
          <div className="h-44 bg-slate-100 rounded-xl animate-pulse" />
        ) : !hasChart ? (
          <div className="h-44 flex flex-col items-center justify-center rounded-xl bg-slate-50 text-center px-6">
            <span className="text-3xl mb-2">📊</span>
            <p className="text-sm font-medium text-slate-600">Sin mediciones aún</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Tu nutricionista irá registrando tus datos de InBody aquí
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8', textAnchor: 'end' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(value) => value.toString()}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Línea sólida: mediciones reales */}
                <Line
                  type="monotone"
                  dataKey="real"
                  stroke={color}
                  strokeWidth={2.5}
                  dot={<PulsingDot />}
                  activeDot={{ r: 5, fill: color, stroke: 'white', strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />

                {/* Línea punteada: proyección */}
                <Line
                  type="monotone"
                  dataKey="proyeccion"
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  strokeOpacity={0.6}
                  dot={projectionDot}
                  activeDot={{ r: 4, fill: color }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Leyenda inferior */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span
                className="inline-block w-6 border-t-2 border-dashed flex-shrink-0"
                style={{ borderColor: color, opacity: 0.65 }}
              />
              <span>
                Proyección{' '}
                {data?.plan?.calorias_diarias
                  ? 'basada en tu plan nutricional'
                  : 'conservadora (sin plan asignado)'}
              </span>
            </div>
          </>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          RECETA SUGERIDA
      ══════════════════════════════════════════════════════════════════════ */}
      {(loading || data?.recetaSugerida) && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl leading-none">{COMIDA[tipoComida].icon}</span>
            <h2 className="font-semibold text-slate-700 text-sm">
              {loading ? '' : `${COMIDA[tipoComida].label} sugerido`}
            </h2>
          </div>

          {loading ? (
            <div className="space-y-2">
              <div className="h-5 bg-slate-100 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
            </div>
          ) : data?.recetaSugerida ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 leading-snug">{data.recetaSugerida.nombre}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                  {data.recetaSugerida.calorias != null && (
                    <span>🔥 {data.recetaSugerida.calorias} kcal</span>
                  )}
                  {data.recetaSugerida.tiempo_preparacion_minutos != null && (
                    <span>⏱ {data.recetaSugerida.tiempo_preparacion_minutos} min</span>
                  )}
                </div>
              </div>
              <Link
                href="/paciente/recetas"
                className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 active:bg-brand-800 transition-colors whitespace-nowrap"
              >
                Ver receta
              </Link>
            </div>
          ) : null}
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SEGUIMIENTO SEMANAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="p-4 space-y-3">

        {/* Header: título + score */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 text-sm">Seguimiento semanal</h2>
          {!loading && (
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                adherenciaPct >= 70
                  ? 'bg-green-100 text-green-700'
                  : adherenciaPct >= 40
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {adherenciaPct}%
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-between">
            {[0,1,2,3,4,5,6].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
                <div className="w-3 h-2 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Puntos semanales — últimos 7 días; pre-registro en gris claro */}
            <div className="flex justify-between">
              {last7Days.map((day, i) => {
                const key           = toDateKey(day);
                const isPreRegistro = regKey !== null && key < regKey;
                const isToday       = key === todayKey;
                const hasLog        = !isPreRegistro && diarioFechasSet.has(key);

                return (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        isPreRegistro
                          ? 'bg-slate-50 border border-dashed border-slate-200'
                          : hasLog
                          ? 'bg-green-500 shadow-sm shadow-green-200'
                          : 'bg-slate-200'
                      } ${isToday ? 'ring-2 ring-offset-1 ring-brand-400' : ''}`}
                    >
                      {isPreRegistro ? (
                        <span className="text-[9px] text-slate-300 leading-none">—</span>
                      ) : hasLog ? (
                        <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-5.121-5.121a1 1 0 111.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : null}
                    </div>
                    <span
                      className={`text-[10px] font-semibold ${
                        isPreRegistro
                          ? 'text-slate-200'
                          : isToday
                          ? 'text-brand-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {DAY_ABBREV[day.getDay()]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Barra de progreso */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-700 ${
                  adherenciaPct >= 70
                    ? 'bg-green-500'
                    : adherenciaPct >= 40
                    ? 'bg-amber-400'
                    : 'bg-red-500'
                }`}
                style={{ width: `${adherenciaPct}%` }}
              />
            </div>

            {/* Desglose de componentes */}
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span>
                📸 Fotos&nbsp;
                <span className={fotosUnicasSemana > 0 ? 'text-green-600 font-semibold' : ''}>
                  {fotosUnicasSemana}/{diasActivos}
                </span>
              </span>
              <span>
                🍽 Recetas&nbsp;
                <span className={(data?.recetasSemana ?? 0) > 0 ? 'text-green-600 font-semibold' : ''}>
                  {data?.recetasSemana ?? 0}/3
                </span>
              </span>
              <span>
                🛒 Tiquete&nbsp;
                <span className={(data?.escaneosSemana ?? 0) > 0 ? 'text-green-600 font-semibold' : ''}>
                  {Math.min(data?.escaneosSemana ?? 0, 1)}/1
                </span>
              </span>
            </div>

            {/* Streak o aliento */}
            <p className="text-xs text-center text-slate-500">
              {streak >= 7 ? (
                <>🏆 <span className="font-bold text-green-600">¡Semana perfecta!</span> Llevas {streak} días seguidos</>
              ) : streak > 1 ? (
                <>🔥 Llevas <span className="font-bold text-green-600">{streak} días seguidos</span> registrando</>
              ) : streak === 1 ? (
                <>✅ Registraste hoy, <span className="font-medium text-slate-600">¡seguí así!</span></>
              ) : (
                <>📸 Registrá tu primera comida del día</>
              )}
            </p>
          </>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          NOTAS DEL NUTRICIONISTA (solo si hay notificaciones no leídas)
      ══════════════════════════════════════════════════════════════════════ */}
      {!loading && notifVisibles.length > 0 && (
        <Card className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">🔔</span>
            <h2 className="font-semibold text-slate-700 text-sm flex-1">
              Notas del nutricionista
            </h2>
            <span className="text-[10px] font-bold bg-brand-500 text-white px-1.5 py-0.5 rounded-full leading-none">
              {notifVisibles.length}
            </span>
          </div>

          {/* Lista de notas */}
          <div className="space-y-3">
            {notifVisibles.map((notif, idx) => (
              <div key={notif.id}>
                {idx > 0 && <div className="border-t border-slate-100 mb-3" />}
                <div className="flex gap-2.5">
                  {/* Acento lateral */}
                  <div className="w-0.5 bg-brand-300 rounded-full flex-shrink-0 self-stretch" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {notif.mensaje}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-slate-400">
                        {formatNotifFecha(notif.created_at)}
                      </span>
                      <button
                        onClick={() => marcarLeida(notif.id)}
                        disabled={marcandoId === notif.id}
                        className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-800 transition-colors disabled:opacity-50"
                      >
                        {marcandoId === notif.id ? (
                          <>
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            Marcando…
                          </>
                        ) : (
                          <>✓ Leída</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

    </div>
  );
}
