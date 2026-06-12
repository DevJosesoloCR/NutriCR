'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Paciente {
  id:                string;
  usuario_id:        string;
  nutriologo_id:     string | null;
  nombre:            string;
  email:             string;
  avatar_url:        string | null;
  nutriologo_nombre: string | null;
  created_at:        string;
  last_sign_in_at:   string | null;
}

interface NutriOption { id: string; nombre: string }

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  const d     = new Date(iso);
  const ahora = new Date();
  const diffH = (ahora.getTime() - d.getTime()) / 3_600_000;
  if (diffH < 1)      return 'Hace <1h';
  if (diffH < 24)     return `Hace ${Math.floor(diffH)}h`;
  if (diffH < 24 * 7) return `Hace ${Math.floor(diffH / 24)}d`;
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminPacientes() {
  const [rows,       setRows]       = useState<Paciente[]>([]);
  const [nutris,     setNutris]     = useState<NutriOption[]>([]);
  const [cargando,   setCargando]   = useState(true);
  const [query,      setQuery]      = useState('');
  const [filtroNutri, setFiltroNutri] = useState('');
  const [error,      setError]      = useState<string | null>(null);

  const cargar = useCallback(async (q: string, nId: string) => {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q)   params.set('q', q);
      if (nId) params.set('nutriologo_id', nId);
      const res  = await fetch(`/api/admin/pacientes?${params}`);
      const json = await res.json() as { data?: Paciente[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      setRows(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setCargando(false);
    }
  }, []);

  // Cargar también lista de nutricionistas para el filtro
  useEffect(() => {
    (async () => {
      const res  = await fetch('/api/admin/nutricionistas');
      const json = await res.json() as { data?: Array<{ id: string; nombre: string }> };
      setNutris(json.data?.map((n) => ({ id: n.id, nombre: n.nombre })) ?? []);
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => cargar(query, filtroNutri), 350);
    return () => clearTimeout(t);
  }, [query, filtroNutri, cargar]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pacientes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{rows.length} pacientes</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Buscador */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre…"
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none
                         focus:ring-2 focus:ring-indigo-300 w-52 bg-white"
            />
          </div>

          {/* Filtro nutricionista */}
          <select
            value={filtroNutri}
            onChange={(e) => setFiltroNutri(e.target.value)}
            className="border border-slate-200 rounded-xl text-sm px-3 py-2 bg-white
                       focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700"
          >
            <option value="">Todos los nutricionistas</option>
            {nutris.map((n) => (
              <option key={n.id} value={n.id}>{n.nombre || n.id.slice(0, 8)}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span>⚠️</span>{error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Paciente</th>
                <th className="text-left px-4 py-3">Nutricionista</th>
                <th className="text-left px-4 py-3">Registrado</th>
                <th className="text-left px-4 py-3">Último acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cargando ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-sm">
                    No se encontraron pacientes
                  </td>
                </tr>
              ) : rows.map((p) => {
                const inicial = p.nombre.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    {/* Nombre + email */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                          {p.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.avatar_url} alt={p.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">
                              {inicial || '?'}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{p.nombre || '—'}</p>
                          <p className="text-xs text-slate-400 truncate">{p.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Nutricionista */}
                    <td className="px-4 py-3">
                      {p.nutriologo_nombre ? (
                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">
                          👩‍⚕️ {p.nutriologo_nombre}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">Sin asignar</span>
                      )}
                    </td>

                    {/* Fechas */}
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {fmtFecha(p.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {fmtFecha(p.last_sign_in_at)}
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
