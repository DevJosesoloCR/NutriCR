'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PacienteRow {
  id:              string;
  nombre:          string;
  apellido:        string | null;
  email:           string;
  avatar_url:      string | null;
  objetivo:        string | null;
  adherencia:      number;
  estado:          string;
  ultimaActividad: string | null;
}

// ─── Helpers (mismos que dashboard) ──────────────────────────────────────────

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="px-5 py-4 flex items-center gap-4 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-slate-100 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-slate-100 rounded w-40" />
        <div className="h-2.5 bg-slate-100 rounded w-28" />
      </div>
      <div className="hidden md:block h-2.5 bg-slate-100 rounded w-24" />
      <div className="hidden md:block h-1.5 bg-slate-100 rounded w-28" />
      <div className="h-5 bg-slate-100 rounded-full w-16" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FiltroEstado = 'todos' | 'Al día' | 'Revisar' | 'Urgente';

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<PacienteRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busqueda,  setBusqueda]  = useState('');
  const [filtro,    setFiltro]    = useState<FiltroEstado>('todos');

  // ── Fetch (mismo endpoint que el dashboard) ──────────────────────────────
  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((json) => setPacientes(json.pacientes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const pacientesFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return pacientes.filter((p) => {
      const matchBusqueda =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        (p.apellido ?? '').toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.objetivo ?? '').toLowerCase().includes(q);

      const matchFiltro = filtro === 'todos' || p.estado === filtro;

      return matchBusqueda && matchFiltro;
    });
  }, [pacientes, busqueda, filtro]);

  // ── Conteos por estado (para los botones de filtro) ───────────────────────
  const conteos = useMemo(() => ({
    todos:    pacientes.length,
    'Al día':  pacientes.filter((p) => p.estado === 'Al día').length,
    'Revisar': pacientes.filter((p) => p.estado === 'Revisar').length,
    'Urgente': pacientes.filter((p) => p.estado === 'Urgente').length,
  }), [pacientes]);

  const FILTROS: { key: FiltroEstado; label: string; activeCls: string }[] = [
    { key: 'todos',    label: 'Todos',    activeCls: 'bg-slate-800 text-white'   },
    { key: 'Al día',   label: 'Al día',   activeCls: 'bg-green-600 text-white'  },
    { key: 'Revisar',  label: 'Revisar',  activeCls: 'bg-amber-500 text-white'  },
    { key: 'Urgente',  label: 'Urgente',  activeCls: 'bg-red-600   text-white'  },
  ];

  return (
    <div className="space-y-6">

      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pacientes</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            {loading ? '…' : `${pacientes.length} paciente${pacientes.length !== 1 ? 's' : ''} vinculado${pacientes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* ── Panel: búsqueda + filtros + tabla ──────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        {/* Barra de controles */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-100">

          {/* Búsqueda */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, email u objetivo…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>

          {/* Filtros de estado */}
          <div className="flex gap-1.5 flex-wrap">
            {FILTROS.map(({ key, label, activeCls }) => (
              <button
                key={key}
                onClick={() => setFiltro(key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border',
                  filtro === key
                    ? cn(activeCls, 'border-transparent')
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
                )}
              >
                {label}
                {!loading && (
                  <span className={cn(
                    'ml-1.5 text-[10px] font-bold px-1 py-0.5 rounded-full',
                    filtro === key ? 'bg-white/25' : 'bg-slate-100 text-slate-500',
                  )}>
                    {conteos[key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Encabezados de tabla — solo desktop */}
        <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_104px_92px] gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100">
          {['Paciente', 'Objetivo', 'Seguimiento semanal', 'Estado', 'Acción'].map((h) => (
            <span key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : pacientesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <span className="text-4xl">{busqueda || filtro !== 'todos' ? '🔍' : '🔗'}</span>
            <p className="font-medium text-slate-700">
              {busqueda || filtro !== 'todos'
                ? 'Sin resultados para la búsqueda actual'
                : 'Aún no tenés pacientes vinculados'}
            </p>
            {!busqueda && filtro === 'todos' && (
              <p className="text-sm text-slate-400 max-w-xs">
                Compartí tu código de invitación con tus pacientes para que se registren y queden vinculados a tu panel.
              </p>
            )}
            {(busqueda || filtro !== 'todos') && (
              <button
                onClick={() => { setBusqueda(''); setFiltro('todos'); }}
                className="text-sm font-semibold text-brand-600 hover:text-brand-800 transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pacientesFiltrados.map((p) => {
              const est            = getEstado(p.estado ?? (p.adherencia >= 70 ? 'Al día' : p.adherencia >= 40 ? 'Revisar' : 'Urgente'));
              const nombreCompleto = `${p.nombre}${p.apellido ? ' ' + p.apellido : ''}`;

              const EstadoBadge = () => (
                <span className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap',
                  est.bg, est.text,
                )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', est.dot)} />
                  {est.label}
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

                  {/* ── Móvil ── */}
                  <div className="md:hidden px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
                        {p.avatar_url
                          ? <img src={p.avatar_url} alt={p.nombre} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-brand-100 text-brand-700 text-sm font-bold flex items-center justify-center">{initiales(p.nombre, p.apellido)}</div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{nombreCompleto}</p>
                          <span className="text-sm font-bold text-slate-700 tabular-nums flex-shrink-0">{p.adherencia}%</span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{p.email}</p>
                        <div className="mt-2"><EstadoBadge /></div>
                        <div className="mt-2"><BarraAdherencia /></div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-400">
                            {p.ultimaActividad ? tiempoAtras(p.ultimaActividad) : '—'}
                          </span>
                          <Link
                            href={`/nutriologo/pacientes/${p.id}`}
                            className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors"
                          >
                            Ver perfil →
                          </Link>
                        </div>
                      </div>
                    </div>
                    {p.objetivo && (
                      <div className="mt-2 pl-12">
                        <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
                          {p.objetivo}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Desktop ── */}
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

                    {/* Seguimiento */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-slate-700 tabular-nums">{p.adherencia}%</span>
                        {p.ultimaActividad && (
                          <span className="text-xs text-slate-400 truncate">{tiempoAtras(p.ultimaActividad)}</span>
                        )}
                      </div>
                      <BarraAdherencia />
                    </div>

                    {/* Estado */}
                    <div><EstadoBadge /></div>

                    {/* Acción */}
                    <div>
                      <Link
                        href={`/nutriologo/pacientes/${p.id}`}
                        className="inline-flex items-center justify-center w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-300 text-xs font-semibold text-slate-600 hover:text-brand-700 transition-colors"
                      >
                        Ver perfil
                      </Link>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
