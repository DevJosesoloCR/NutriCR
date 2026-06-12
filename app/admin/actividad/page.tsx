'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

type TipoEvento =
  | 'nuevo_nutriologo'
  | 'nuevo_paciente'
  | 'plan_asignado'
  | 'medicion_inbody'
  | 'foto_comida'
  | '';

interface Evento {
  id:      string;
  tipo:    TipoEvento;
  titulo:  string;
  detalle: string | null;
  fecha:   string;
}

const TIPOS: { value: TipoEvento; label: string; icon: string; color: string }[] = [
  { value: '',                label: 'Todos',               icon: '⚡', color: 'bg-slate-100 text-slate-700' },
  { value: 'nuevo_nutriologo', label: 'Nutricionistas',     icon: '👩‍⚕️', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'nuevo_paciente',   label: 'Pacientes',          icon: '🧑', color: 'bg-green-100 text-green-700'  },
  { value: 'plan_asignado',    label: 'Planes asignados',   icon: '📋', color: 'bg-orange-100 text-orange-700'},
  { value: 'medicion_inbody',  label: 'Mediciones InBody',  icon: '⚖️', color: 'bg-blue-100 text-blue-700'   },
  { value: 'foto_comida',      label: 'Fotos de comida',    icon: '📷', color: 'bg-purple-100 text-purple-700'},
];

function getIconTipo(tipo: TipoEvento) {
  return TIPOS.find((t) => t.value === tipo)?.icon ?? '⚡';
}
function getColorTipo(tipo: TipoEvento) {
  return TIPOS.find((t) => t.value === tipo)?.color ?? 'bg-slate-100 text-slate-600';
}

function fmtFecha(iso: string) {
  const d     = new Date(iso);
  const ahora = new Date();
  const diffMin = Math.floor((ahora.getTime() - d.getTime()) / 60_000);
  if (diffMin < 1)   return 'Ahora';
  if (diffMin < 60)  return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH  < 24)   return `Hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD  < 7)    return `Hace ${diffD}d`;
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
}

// Fecha ISO YYYY-MM-DD en zona local
function hoyISO() { return new Date().toISOString().slice(0, 10); }
function desdeFecha(dias: number) {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

export default function AdminActividad() {
  const [eventos,  setEventos]  = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tipo,     setTipo]     = useState<TipoEvento>('');
  const [rango,    setRango]    = useState('7');  // días
  const [error,    setError]    = useState<string | null>(null);

  const cargar = useCallback(async (t: TipoEvento, dias: string) => {
    setCargando(true);
    setError(null);
    try {
      const desde = desdeFecha(parseInt(dias, 10));
      const params = new URLSearchParams({ desde });
      if (t) params.set('tipo', t);
      const res  = await fetch(`/api/admin/actividad?${params}`);
      const json = await res.json() as { data?: Evento[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      setEventos(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(tipo, rango); }, [tipo, rango, cargar]);

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Actividad</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Feed de actividad reciente de toda la plataforma
          </p>
        </div>

        {/* Rango de fechas */}
        <select
          value={rango}
          onChange={(e) => setRango(e.target.value)}
          className="border border-slate-200 rounded-xl text-sm px-3 py-2 bg-white
                     focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700"
        >
          <option value="1">Hoy</option>
          <option value="7">Últimos 7 días</option>
          <option value="14">Últimos 14 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
        </select>
      </div>

      {/* Filtros de tipo */}
      <div className="flex flex-wrap gap-2">
        {TIPOS.map(({ value, label, icon, color }) => (
          <button
            key={value}
            onClick={() => setTipo(value)}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full',
              'border transition-colors',
              tipo === value
                ? cn(color, 'border-transparent shadow-sm')
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300',
            )}
          >
            <span>{icon}</span>{label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Feed */}
      <div className="space-y-0">
        {cargando ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 py-3 border-b border-slate-100 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-slate-200 rounded w-48" />
                <div className="h-3 bg-slate-100 rounded w-72" />
              </div>
              <div className="h-3 bg-slate-100 rounded w-16 mt-0.5" />
            </div>
          ))
        ) : eventos.length === 0 ? (
          <div className="text-center py-14 text-slate-400">
            <span className="text-4xl block mb-3">📭</span>
            <p className="font-medium">Sin actividad en este período</p>
          </div>
        ) : (
          eventos.map((e, idx) => (
            <div
              key={e.id}
              className={cn(
                'flex items-start gap-4 py-3.5',
                idx < eventos.length - 1 && 'border-b border-slate-100',
              )}
            >
              {/* Icono del tipo */}
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5',
                getColorTipo(e.tipo),
              )}>
                {getIconTipo(e.tipo)}
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-tight">{e.titulo}</p>
                {e.detalle && (
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{e.detalle}</p>
                )}
              </div>

              {/* Fecha */}
              <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                {fmtFecha(e.fecha)}
              </span>
            </div>
          ))
        )}
      </div>

      {!cargando && eventos.length > 0 && (
        <p className="text-xs text-slate-400 text-right">
          {eventos.length} evento{eventos.length !== 1 ? 's' : ''} · máx 200
        </p>
      )}
    </div>
  );
}
