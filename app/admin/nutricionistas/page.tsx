'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Nutricionista {
  id:              string;
  usuario_id:      string;
  nombre:          string;
  email:           string;
  avatar_url:      string | null;
  numero_cedula:   string | null;
  num_pacientes:   number;
  created_at:      string;
  last_sign_in_at: string | null;
  activo:          boolean;
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const ahora = new Date();
  const diffH = (ahora.getTime() - d.getTime()) / 3_600_000;
  if (diffH < 1)  return 'Hace menos de 1h';
  if (diffH < 24) return `Hace ${Math.floor(diffH)}h`;
  if (diffH < 24 * 7) return `Hace ${Math.floor(diffH / 24)}d`;
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminNutricionistas() {
  const [rows,     setRows]     = useState<Nutricionista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [query,    setQuery]    = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const cargar = useCallback(async (q = '') => {
    setCargando(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/nutricionistas?q=${encodeURIComponent(q)}`);
      const json = await res.json() as { data?: Nutricionista[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      setRows(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => cargar(query), 350);
    return () => clearTimeout(t);
  }, [query, cargar]);

  async function toggleActivo(r: Nutricionista) {
    setToggling(r.usuario_id);
    try {
      const res = await fetch('/api/admin/nutricionistas', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ usuario_id: r.usuario_id, activo: !r.activo }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      setRows((prev) => prev.map((x) =>
        x.usuario_id === r.usuario_id ? { ...x, activo: !x.activo } : x,
      ));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nutricionistas</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {rows.length} nutricionistas registrados
          </p>
        </div>

        {/* Buscador */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
            🔍
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none
                       focus:ring-2 focus:ring-indigo-300 w-64 bg-white"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span>⚠️</span>{error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Nutricionista</th>
                <th className="text-left px-4 py-3">Colegiado</th>
                <th className="text-left px-4 py-3">Pacientes</th>
                <th className="text-left px-4 py-3">Registrado</th>
                <th className="text-left px-4 py-3">Último acceso</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cargando ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">
                    No se encontraron nutricionistas
                  </td>
                </tr>
              ) : rows.map((r) => {
                const inicial = r.nombre.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    {/* Nombre + email */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                          {r.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.avatar_url} alt={r.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                              {inicial || '?'}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{r.nombre || '—'}</p>
                          <p className="text-xs text-slate-400 truncate">{r.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Colegiado */}
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                      {r.numero_cedula ?? <span className="text-slate-300">—</span>}
                    </td>

                    {/* Cantidad pacientes */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        🧑 {r.num_pacientes}
                      </span>
                    </td>

                    {/* Fecha registro */}
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {fmtFecha(r.created_at)}
                    </td>

                    {/* Último acceso */}
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {fmtFecha(r.last_sign_in_at)}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full',
                        r.activo
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500',
                      )}>
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full flex-shrink-0',
                          r.activo ? 'bg-green-500' : 'bg-slate-400',
                        )} />
                        {r.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Acción */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActivo(r)}
                        disabled={toggling === r.usuario_id}
                        className={cn(
                          'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                          r.activo
                            ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                            : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200',
                          toggling === r.usuario_id && 'opacity-50 cursor-default',
                        )}
                      >
                        {toggling === r.usuario_id
                          ? '…'
                          : r.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
