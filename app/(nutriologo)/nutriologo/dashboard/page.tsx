'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PacienteRow {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string;
  avatar_url: string | null;
  objetivo: string | null;
  adherencia: number;           // 0–100
  estado: string;               // 'Al día' | 'Revisar' | 'Urgente'
  ultimaActividad: string | null;
}

interface Stats {
  totalPacientes:     number;
  adherenciaPromedio: number;
  ingresosMes:        number;
}

interface DashboardData {
  stats:            Stats;
  pacientes:        PacienteRow[];
  isMockData:       boolean;
  codigoInvitacion: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initiales(nombre: string, apellido: string | null) {
  return (nombre.charAt(0) + (apellido?.charAt(0) ?? '')).toUpperCase();
}

function tiempoAtras(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0) return `hace ${days}d`;
  if (hours > 0) return `hace ${hours}h`;
  if (mins  > 0) return `hace ${mins}min`;
  return 'ahora mismo';
}

function formatCRC(n: number) {
  return new Intl.NumberFormat('es-CR', {
    style:                 'currency',
    currency:              'CRC',
    minimumFractionDigits: 0,
  }).format(n);
}

function getEstado(estado: string) {
  if (estado === 'Al día')  return { label: 'Al día',  bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' };
  if (estado === 'Revisar') return { label: 'Revisar', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' };
  return                           { label: 'Urgente', bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500'   };
}

function getBarColor(pct: number) {
  if (pct >= 70) return 'bg-green-500';
  if (pct >= 40) return 'bg-amber-400';
  return             'bg-red-500';
}

/** 8 chars alfanuméricos sin ambiguos (0/O, 1/I), formateado XXXX-XXXX */
function generarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const raw   = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Componente definido fuera del render para evitar que React lo destruya/recree
// en cada actualización de estado, lo que quebraría los eventos de click.
function BtnPerfil({ id, className }: { id: string; className?: string }) {
  return (
    <Link
      href={`/nutriologo/pacientes/${id}`}
      className={cn(
        'text-xs font-medium transition-colors px-3 py-1.5 rounded-lg whitespace-nowrap',
        'text-brand-600 hover:text-brand-800 hover:bg-brand-50',
        className,
      )}
    >
      Ver perfil →
    </Link>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon:    string;
  label:   string;
  value:   string;
  sub?:    string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0', accent ?? 'bg-brand-50')}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="px-4 py-4 md:px-5 md:py-3.5 animate-pulse border-b border-slate-50">
      {/* Mobile skeleton */}
      <div className="flex items-start gap-3 md:hidden">
        <div className="w-9 h-9 rounded-full bg-slate-100 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between gap-2">
            <div className="h-3.5 bg-slate-100 rounded w-32" />
            <div className="h-3.5 bg-slate-100 rounded w-8" />
          </div>
          <div className="h-3 bg-slate-100 rounded w-44" />
          <div className="h-5 bg-slate-100 rounded-full w-16 mt-1" />
          <div className="h-1.5 bg-slate-100 rounded-full w-full" />
        </div>
      </div>
      {/* Desktop skeleton */}
      <div className="hidden md:flex items-center gap-4">
        <div className="w-9 h-9 rounded-full bg-slate-100 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-slate-100 rounded w-36" />
          <div className="h-3 bg-slate-100 rounded w-48" />
        </div>
        <div className="w-24 h-3 bg-slate-100 rounded" />
        <div className="w-32 h-2 bg-slate-100 rounded" />
        <div className="w-16 h-6 bg-slate-100 rounded-full" />
        <div className="w-20 h-7 bg-slate-100 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Modal: código de invitación ──────────────────────────────────────────────

function ModalCodigo({
  codigo,
  guardando,
  errorGuardado,
  onNuevoCodigo,
  onClose,
}: {
  codigo:         string;
  guardando:      boolean;
  errorGuardado:  string | null;
  onNuevoCodigo:  () => void;
  onClose:        () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function handleCopiar() {
    // Copiar sin el guión para que sea más fácil de escribir
    await navigator.clipboard.writeText(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Código de invitación</h3>
            <p className="text-sm text-slate-400 mt-0.5">Compartilo con tus pacientes para vincularlos</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors text-lg"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Código */}
          <div className="bg-brand-50 rounded-xl p-5 text-center border border-brand-100 relative">
            {guardando && (
              <span className="absolute top-2 right-3 text-xs text-brand-400 animate-pulse">
                guardando…
              </span>
            )}
            <p className="text-xs font-medium text-brand-500 uppercase tracking-widest mb-3">
              Tu código único
            </p>
            <p className="text-4xl font-mono font-bold text-brand-700 tracking-[0.3em] select-all">
              {codigo}
            </p>
            <p className="text-xs text-brand-400 mt-2">
              Este código es permanente y puede usarlo cualquier paciente tuyo
            </p>
          </div>

          {/* Instrucciones */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-600">¿Cómo funciona?</p>
            <ol className="space-y-1.5 text-xs text-slate-500">
              <li className="flex gap-2"><span className="font-bold text-brand-600">1.</span> Copiá el código y mandáselo a tu paciente</li>
              <li className="flex gap-2"><span className="font-bold text-brand-600">2.</span> El paciente se registra en Nutri Smart CR e ingresa el código</li>
              <li className="flex gap-2"><span className="font-bold text-brand-600">3.</span> Queda vinculado a tu panel automáticamente</li>
            </ol>
          </div>

          {/* Error de guardado — aparece si falta la migración SQL */}
          {errorGuardado && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <span className="text-red-500 flex-shrink-0">⚠️</span>
              <div>
                <p className="text-xs font-semibold text-red-700 mb-0.5">El código no se guardó en la base de datos</p>
                <p className="text-xs text-red-600">{errorGuardado}</p>
                <p className="text-xs text-red-500 mt-1">
                  Ejecutá este SQL en Supabase → SQL Editor:
                </p>
                <code className="block mt-1 text-xs font-mono bg-red-100 text-red-800 rounded p-2 select-all">
                  ALTER TABLE nutriologos ADD COLUMN IF NOT EXISTS codigo_invitacion TEXT;
                </code>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-3">
            <button
              onClick={handleCopiar}
              disabled={!!errorGuardado}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
                errorGuardado
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : copiado
                  ? 'bg-green-500 text-white'
                  : 'bg-brand-600 hover:bg-brand-700 text-white',
              )}
            >
              {copiado ? '✓ ¡Copiado!' : '📋 Copiar código'}
            </button>
            <button
              onClick={onNuevoCodigo}
              disabled={guardando}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              title="Genera un código nuevo — el anterior dejará de funcionar"
            >
              🔄 Renovar
            </button>
          </div>
          {!errorGuardado && (
            <p className="text-xs text-slate-400 text-center">
              Al renovar el código, el anterior deja de funcionar
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData]         = useState<DashboardData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal]       = useState(false);
  const [codigo, setCodigo]     = useState('');
  const [guardandoCodigo, setGuardandoCodigo] = useState(false);
  const [errorCodigo,     setErrorCodigo]     = useState<string | null>(null);

  // ── Carga de datos ──────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/dashboard');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar dashboard');
      const dashData = json as DashboardData;
      setData(dashData);
      // Precargar código guardado en estado local
      if (dashData.codigoInvitacion) setCodigo(dashData.codigoInvitacion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Pacientes que necesitan atención (Revisar o Urgente) ─────────────────

  const pacientesNecesitanAtencion = (data?.pacientes ?? []).filter(
    (p) => p.estado === 'Revisar' || p.estado === 'Urgente',
  );

  // ── Filtro de búsqueda sobre ese subconjunto ───────────────────────────────

  const pacientesFiltrados = pacientesNecesitanAtencion.filter((p) =>
    `${p.nombre} ${p.apellido ?? ''} ${p.email}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );

  // ── Guardar código en BD (UPDATE en nutriologos.codigo_invitacion) ─────────

  async function guardarCodigo(nuevoCodigo: string) {
    setGuardandoCodigo(true);
    setErrorCodigo(null);
    try {
      const res  = await fetch('/api/codigos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ codigo: nuevoCodigo }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Error visible en el modal — el más común es que falte la migración SQL
        setErrorCodigo(json.error ?? 'No se pudo guardar el código. Verificá la BD.');
      }
    } catch {
      setErrorCodigo('Error de conexión al guardar el código.');
    } finally {
      setGuardandoCodigo(false);
    }
  }

  // ── Abrir modal — mostrar código existente o generar uno nuevo ─────────────

  function abrirModal() {
    if (codigo) {
      // Ya hay un código guardado → mostrar directamente
      setModal(true);
    } else {
      // Primera vez → generar y guardar
      const nuevo = generarCodigo();
      setCodigo(nuevo);
      setModal(true);
      guardarCodigo(nuevo);
    }
  }

  // ── Generar nuevo código (desde el modal) ──────────────────────────────────

  function renovarCodigo() {
    const nuevo = generarCodigo();
    setCodigo(nuevo);
    guardarCodigo(nuevo);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const hoy = new Date().toLocaleDateString('es-CR', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
  });

  return (
    <div className="space-y-6">

      {/* ── Cabecera ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5 capitalize">{hoy}</p>
        </div>
        <button
          onClick={abrirModal}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all"
        >
          <span className="text-base">+</span>
          Agregar paciente
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-red-500 flex-shrink-0">⚠️</span>
          <div>
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={cargar} className="text-xs text-red-500 underline mt-1">
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* ── Métricas ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 h-20 animate-pulse" />
            ))}
          </>
        ) : data ? (
          <>
            <StatCard
              icon="👥"
              label="Pacientes activos"
              value={String(data.stats.totalPacientes)}
              sub="en seguimiento"
              accent="bg-brand-50"
            />
            <StatCard
              icon="📊"
              label="Seguimiento promedio"
              value={`${data.stats.adherenciaPromedio}%`}
              sub="últimos 7 días"
              accent={
                data.stats.adherenciaPromedio >= 70
                  ? 'bg-green-50'
                  : data.stats.adherenciaPromedio >= 40
                  ? 'bg-amber-50'
                  : 'bg-red-50'
              }
            />
            <StatCard
              icon="💰"
              label="Ingresos del mes"
              value={formatCRC(data.stats.ingresosMes)}
              sub={new Date().toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })}
              accent="bg-emerald-50"
            />
          </>
        ) : null}
      </div>

      {/* ── Lista de pacientes ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Barra superior */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="font-semibold text-slate-800">Pacientes que necesitan atención</h2>
            {data && !loading && pacientesNecesitanAtencion.length > 0 && (
              <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {pacientesNecesitanAtencion.length}
              </span>
            )}
            {data?.isMockData && (
              <span className="bg-amber-100 text-amber-600 text-xs font-medium px-2 py-0.5 rounded-full">
                Datos de ejemplo
              </span>
            )}
          </div>

          {/* Búsqueda */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Buscar paciente…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:bg-white transition-all w-52"
            />
          </div>
        </div>

        {/* Encabezados de tabla — solo desktop */}
        <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_104px_92px] gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100">
          {['Paciente', 'Objetivo', 'Seguimiento semanal', 'Estado', 'Acción'].map((h) => (
            <span key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {h}
            </span>
          ))}
        </div>

        {/* Filas */}
        {loading ? (
          <div>
            {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
          </div>

        ) : (data?.pacientes ?? []).length === 0 ? (
          /* Sin pacientes vinculados aún */
          <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <span className="text-4xl">🔗</span>
            <p className="font-medium text-slate-700">Aún no tenés pacientes vinculados</p>
            <p className="text-sm text-slate-400 max-w-xs">
              Compartí tu código de invitación con tus pacientes para que se registren y queden vinculados a tu panel.
            </p>
            <button
              onClick={abrirModal}
              className="mt-1 flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <span>🔑</span> Ver mi código de invitación
            </button>
          </div>

        ) : pacientesNecesitanAtencion.length === 0 ? (
          /* Todos los pacientes están al día */
          <div className="flex flex-col items-center gap-3 py-14 text-center px-6">
            <span className="text-5xl">🎉</span>
            <p className="font-semibold text-slate-800 text-lg">
              ¡Todos tus pacientes están al día esta semana!
            </p>
            <p className="text-sm text-slate-400 max-w-xs">
              Ningún paciente necesita atención especial. Seguís haciendo un gran trabajo.
            </p>
            <Link
              href="/nutriologo/pacientes"
              className="mt-1 text-sm font-semibold text-brand-600 hover:text-brand-800 transition-colors"
            >
              Ver lista completa de pacientes →
            </Link>
          </div>

        ) : busqueda && pacientesFiltrados.length === 0 ? (
          /* Búsqueda sin resultados dentro del subconjunto */
          <div className="flex flex-col items-center gap-3 py-14 text-center px-6">
            <span className="text-4xl">🔍</span>
            <p className="font-medium text-slate-700">Sin resultados para &ldquo;{busqueda}&rdquo;</p>
            <button
              onClick={() => setBusqueda('')}
              className="text-sm font-semibold text-brand-600 hover:text-brand-800 transition-colors"
            >
              Limpiar búsqueda
            </button>
          </div>

        ) : (
          <div className="divide-y divide-slate-100">
            {pacientesFiltrados.map((p) => {
              const estado        = getEstado(p.estado ?? (p.adherencia >= 70 ? 'Al día' : p.adherencia >= 40 ? 'Revisar' : 'Urgente'));
              const nombreCompleto = `${p.nombre}${p.apellido ? ' ' + p.apellido : ''}`;

              const EstadoBadge = () => (
                <span className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap',
                  estado.bg, estado.text,
                )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', estado.dot)} />
                  {estado.label}
                </span>
              );

              const BarraAdherencia = () => (
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={cn('h-1.5 rounded-full transition-all duration-700', getBarColor(p.adherencia))}
                    style={{ width: `${p.adherencia}%` }}
                  />
                </div>
              );

              return (
                <div key={p.id} className="hover:bg-slate-50/60 transition-colors">

                  {/* ── Móvil: card apilada (<md) ── */}
                  <div className="md:hidden px-4 py-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
                        {p.avatar_url
                          ? <img src={p.avatar_url} alt={p.nombre} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-brand-100 text-brand-700 text-sm font-bold flex items-center justify-center">{initiales(p.nombre, p.apellido)}</div>
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Fila 1: nombre + % */}
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
                            {nombreCompleto}
                          </p>
                          <span className="text-sm font-bold text-slate-700 tabular-nums flex-shrink-0">
                            {p.adherencia}%
                          </span>
                        </div>

                        {/* Fila 2: email */}
                        <p className="text-xs text-slate-400 truncate mt-0.5">{p.email}</p>

                        {/* Fila 3: badge estado (su propia línea) */}
                        <div className="mt-2">
                          <EstadoBadge />
                        </div>

                        {/* Barra de progreso */}
                        <div className="mt-2">
                          <BarraAdherencia />
                        </div>

                        {/* Fila 4: última actividad + botón */}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-400">
                            {p.ultimaActividad ? tiempoAtras(p.ultimaActividad) : '—'}
                          </span>
                          <BtnPerfil id={p.id} />
                        </div>
                      </div>
                    </div>

                    {/* Objetivo — línea separada debajo si existe */}
                    {p.objetivo && (
                      <div className="mt-2 pl-12">
                        <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
                          {p.objetivo}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Desktop: fila de grid (≥md) ── */}
                  <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_104px_92px] gap-4 px-5 py-3.5 items-center">
                    {/* Avatar + nombre + email */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                        {p.avatar_url
                          ? <img src={p.avatar_url} alt={p.nombre} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-brand-100 text-brand-700 text-sm font-bold flex items-center justify-center">{initiales(p.nombre, p.apellido)}</div>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{nombreCompleto}</p>
                        <p className="text-xs text-slate-400 truncate">{p.email}</p>
                      </div>
                    </div>

                    {/* Objetivo */}
                    <div className="min-w-0">
                      {p.objetivo
                        ? <span className="inline-block text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full truncate max-w-full">{p.objetivo}</span>
                        : <span className="text-xs text-slate-300">—</span>
                      }
                    </div>

                    {/* Seguimiento: % + tiempo + barra */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-slate-700 tabular-nums">
                          {p.adherencia}%
                        </span>
                        {p.ultimaActividad && (
                          <span className="text-xs text-slate-400 truncate">
                            {tiempoAtras(p.ultimaActividad)}
                          </span>
                        )}
                      </div>
                      <BarraAdherencia />
                    </div>

                    {/* Estado badge */}
                    <div><EstadoBadge /></div>

                    {/* Botón */}
                    <div><BtnPerfil id={p.id} /></div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Pie de tabla */}
        {!loading && (data?.pacientes ?? []).length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-400">
              {pacientesFiltrados.length > 0
                ? `${pacientesFiltrados.length} de ${data?.stats.totalPacientes ?? 0} paciente${(data?.stats.totalPacientes ?? 0) !== 1 ? 's' : ''} requieren atención`
                : `${data?.stats.totalPacientes ?? 0} paciente${(data?.stats.totalPacientes ?? 0) !== 1 ? 's' : ''} en total`
              }
              {busqueda && ` · buscando "${busqueda}"`}
            </p>
            <Link
              href="/nutriologo/pacientes"
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors whitespace-nowrap"
            >
              Ver todos →
            </Link>
          </div>
        )}
      </div>

      {/* ── Modal código de invitación ── */}
      {modal && (
        <ModalCodigo
          codigo={codigo}
          guardando={guardandoCodigo}
          errorGuardado={errorCodigo}
          onNuevoCodigo={renovarCodigo}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
}
