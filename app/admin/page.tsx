'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Metricas {
  totalNutri:      number;
  totalPac:        number;
  nuevosNutri:     number;
  nuevosPac:       number;
  activosSemana:   number;
  planesActivos:   number;
  totalFotos:      number;
  totalMediciones: number;
}

interface PuntoCrecimiento { semana: string; nutriologos: number; pacientes: number }
interface PuntoActividad   { dia: string; fotos: number }

interface UsuarioReciente {
  id:          string;
  nombre:      string;
  apellido:    string | null;
  email:       string;
  tipo_usuario: string;
  avatar_url:  string | null;
  created_at:  string;
  nutriologo:  string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Componente MetricCard ────────────────────────────────────────────────────

function MetricCard({
  icon, label, valor, sub, color = 'slate',
}: {
  icon:   string;
  label:  string;
  valor:  number | string;
  sub?:   string;
  color?: 'slate' | 'indigo' | 'green' | 'blue' | 'orange' | 'purple';
}) {
  const colorMap = {
    slate:  'bg-slate-50  border-slate-200  text-slate-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    green:  'bg-green-50  border-green-200  text-green-700',
    blue:   'bg-blue-50   border-blue-200   text-blue-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={cn('rounded-xl border p-4 space-y-1.5', colorMap[color])}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        {sub && (
          <span className="text-[11px] font-semibold bg-white/70 rounded-full px-2 py-0.5">
            {sub}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums">{valor.toLocaleString()}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [metricas,       setMetricas]       = useState<Metricas | null>(null);
  const [crecimiento,    setCrecimiento]    = useState<PuntoCrecimiento[]>([]);
  const [actividadDiaria, setActividadDiaria] = useState<PuntoActividad[]>([]);
  const [ultimosUsuarios, setUltimosUsuarios] = useState<UsuarioReciente[]>([]);
  const [cargando,       setCargando]       = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/admin/stats');
        if (!res.ok) throw new Error('Error al cargar métricas');
        const json = await res.json();
        setMetricas(json.metricas);
        setCrecimiento(json.crecimiento);
        setActividadDiaria(json.actividadDiaria);
        setUltimosUsuarios(json.ultimosUsuarios);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  if (cargando) return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-200 animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-slate-200 animate-pulse rounded-xl" />
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
      ⚠️ {error}
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl">

      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Vista general de la plataforma NutriCR</p>
      </div>

      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon="👩‍⚕️" label="Nutricionistas registrados" valor={metricas!.totalNutri} color="indigo" />
        <MetricCard icon="🧑‍🤝‍🧑" label="Pacientes registrados"     valor={metricas!.totalPac}   color="green"  />
        <MetricCard icon="✨" label="Nutri. nuevos esta semana"   valor={metricas!.nuevosNutri} sub="+7d" color="indigo" />
        <MetricCard icon="🆕" label="Pacientes nuevos esta semana" valor={metricas!.nuevosPac}   sub="+7d" color="green"  />
        <MetricCard icon="🟢" label="Usuarios activos (7 días)"   valor={metricas!.activosSemana}        color="blue"   />
        <MetricCard icon="📋" label="Planes nutricionales activos" valor={metricas!.planesActivos}        color="orange" />
        <MetricCard icon="📷" label="Fotos de comida subidas"      valor={metricas!.totalFotos}           color="purple" />
        <MetricCard icon="⚖️" label="Mediciones InBody registradas" valor={metricas!.totalMediciones}    color="slate"  />
      </div>

      {/* ── Gráficas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Crecimiento de usuarios */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4">
            Crecimiento de usuarios — últimas 8 semanas
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={crecimiento} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone" dataKey="nutriologos" name="Nutricionistas"
                stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone" dataKey="pacientes" name="Pacientes"
                stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Actividad diaria */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4">
            Fotos de comida subidas — últimos 14 días
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={actividadDiaria} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}
              />
              <Bar dataKey="fotos" name="Fotos" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Últimos registros ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700">Últimos 10 usuarios registrados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Usuario</th>
                <th className="text-left px-4 py-3">Rol</th>
                <th className="text-left px-4 py-3">Nutricionista</th>
                <th className="text-left px-4 py-3">Fecha registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ultimosUsuarios.map((u) => {
                const inicial = ((u.nombre?.[0] ?? '') + (u.apellido?.[0] ?? '')).toUpperCase();
                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                          {u.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar_url} alt={u.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <div className={cn(
                              'w-full h-full flex items-center justify-center text-white text-xs font-bold',
                              u.tipo_usuario === 'nutriologo' ? 'bg-indigo-500' : 'bg-green-500',
                            )}>
                              {inicial || '?'}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 leading-tight">
                            {[u.nombre, u.apellido].filter(Boolean).join(' ') || '—'}
                          </p>
                          <p className="text-xs text-slate-400 truncate max-w-[180px]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
                        u.tipo_usuario === 'nutriologo'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-green-100 text-green-700',
                      )}>
                        {u.tipo_usuario === 'nutriologo' ? '👩‍⚕️ Nutricionista' : '🧑 Paciente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {u.nutriologo ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {fmtFecha(u.created_at)}
                    </td>
                  </tr>
                );
              })}
              {ultimosUsuarios.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-sm">
                    Sin registros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
