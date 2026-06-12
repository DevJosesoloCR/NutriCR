'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import PorcionesSelector from '@/components/nutriologo/PorcionesSelector';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TiempoKey =
  | 'desayuno'
  | 'merienda_am'
  | 'almuerzo'
  | 'merienda_pm'
  | 'cena'
  | 'colado_nocturno';

interface TiempoComida {
  horario:      string;
  porciones:    string;
  ejemplo_menu: string;
}

interface PlanClinico {
  tiempos:                  Record<TiempoKey, TiempoComida>;
  observaciones:            string;
  restricciones_especiales: string;
  mensaje_motivacional:     string;
}

interface PlanTemplate {
  id:             string;
  nombre:         string;
  contenido_json: PlanClinico | null;
  created_at:     string;
  updated_at:     string | null;
}

interface PacienteResult {
  id:         string;
  nombre:     string;
  apellido:   string | null;
  avatar_url: string | null;
}

// ─── Config de tiempos ────────────────────────────────────────────────────────

const TIEMPOS_CONFIG = [
  { key: 'desayuno'        as TiempoKey, label: 'Desayuno',        icon: '🌅', defaultHorario: '7:30 AM'  },
  { key: 'merienda_am'     as TiempoKey, label: 'Merienda AM',     icon: '☕', defaultHorario: '10:00 AM' },
  { key: 'almuerzo'        as TiempoKey, label: 'Almuerzo',        icon: '☀️', defaultHorario: '12:00 PM' },
  { key: 'merienda_pm'     as TiempoKey, label: 'Merienda PM',     icon: '🍎', defaultHorario: '3:00 PM'  },
  { key: 'cena'            as TiempoKey, label: 'Cena',            icon: '🌙', defaultHorario: '6:00 PM'  },
  { key: 'colado_nocturno' as TiempoKey, label: 'Colado Nocturno', icon: '🌛', defaultHorario: '8:00 PM'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tiemposInicial(): Record<TiempoKey, TiempoComida> {
  const t = {} as Record<TiempoKey, TiempoComida>;
  for (const cfg of TIEMPOS_CONFIG) {
    t[cfg.key] = { horario: cfg.defaultHorario, porciones: '', ejemplo_menu: '' };
  }
  return t;
}

interface FormPlan {
  nombre:                   string;
  tiempos:                  Record<TiempoKey, TiempoComida>;
  observaciones:            string;
  restricciones_especiales: string;
  mensaje_motivacional:     string;
}

function formInicial(): FormPlan {
  return {
    nombre:                   '',
    tiempos:                  tiemposInicial(),
    observaciones:            '',
    restricciones_especiales: '',
    mensaje_motivacional:     '',
  };
}

function planAForm(plan: PlanTemplate): FormPlan {
  const base = formInicial();
  const c    = plan.contenido_json;
  return {
    nombre:                   plan.nombre,
    tiempos:                  c?.tiempos                  ? { ...base.tiempos, ...c.tiempos } : base.tiempos,
    observaciones:            c?.observaciones            ?? '',
    restricciones_especiales: c?.restricciones_especiales ?? '',
    mensaje_motivacional:     c?.mensaje_motivacional     ?? '',
  };
}

function formatRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  if (min < 60)  return min <= 1 ? 'Ahora' : `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h  < 24)   return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d  < 30)   return `Hace ${d}d`;
  return new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Componente: Modal de crear/editar plan ───────────────────────────────────

function ModalPlan({
  planEditando,
  onClose,
  onSaved,
}: {
  planEditando: PlanTemplate | null;  // null = nuevo plan
  onClose:  () => void;
  onSaved:  (plan: PlanTemplate) => void;
}) {
  const [form,   setForm]   = useState<FormPlan>(() =>
    planEditando ? planAForm(planEditando) : formInicial(),
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const formRef             = useRef<HTMLFormElement>(null);

  const updateTiempo = (key: TiempoKey, field: keyof TiempoComida, value: string) =>
    setForm((f) => ({
      ...f,
      tiempos: { ...f.tiempos, [key]: { ...f.tiempos[key], [field]: value } },
    }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre del plan es obligatorio'); return; }
    setSaving(true);
    setError(null);

    const payload = {
      nombre: form.nombre.trim(),
      contenido_json: {
        tiempos:                  form.tiempos,
        observaciones:            form.observaciones.trim(),
        restricciones_especiales: form.restricciones_especiales.trim(),
        mensaje_motivacional:     form.mensaje_motivacional.trim(),
      } as PlanClinico,
    };

    try {
      const url    = planEditando ? `/api/planes/${planEditando.id}` : '/api/planes';
      const method = planEditando ? 'PATCH' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { data?: PlanTemplate; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      onSaved(json.data!);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // Textarea rows helper
  const ta = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    rows = 2,
    icon = '',
  ) => (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
        {icon && <span className="mr-1">{icon}</span>}{label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700
                   focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none
                   placeholder:text-slate-300"
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {planEditando ? 'Editar plan' : 'Nuevo plan nutricional'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              La plantilla se guardará y podrás asignarla a uno o varios pacientes
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400
                       hover:bg-slate-100 text-xl transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body con scroll */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Nombre del plan */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              📋 Nombre del plan
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Plan pérdida de grasa — Jimena García"
              autoFocus
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium
                         text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-300
                         placeholder:text-slate-300"
            />
          </div>

          {/* Tabla de tiempos de comida */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
              Tiempos de comida
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              {/*
                Distribución de columnas (ancho mínimo total 740 px):
                  Tiempo    : 132 px  — icono + "Colado Nocturno" caben con holgura
                  Horario   :  76 px  — input "10:00 AM" a text-xs
                  Porciones : 320 px  — 2 cols × 146 px/chip + 4 px gap + 24 px padding
                  Menú      : resto   — textarea crece libre
              */}
              <table className="w-full text-sm border-collapse min-w-[740px]">
                <thead>
                  <tr className="bg-brand-50">
                    <th className="text-left px-2 py-2.5 text-xs font-bold text-brand-700 uppercase tracking-wide w-[132px]">
                      Tiempo
                    </th>
                    <th className="text-left px-2 py-2.5 text-xs font-bold text-brand-700 uppercase tracking-wide w-[76px]">
                      Horario
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-brand-700 uppercase tracking-wide w-[320px]">
                      Porciones por grupo
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-brand-700 uppercase tracking-wide">
                      Ejemplo de menú
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {TIEMPOS_CONFIG.map(({ key, label, icon }) => (
                    <tr key={key} className="align-top hover:bg-slate-50/60">
                      {/* Tiempo */}
                      <td className="px-2 py-3 font-medium text-slate-700 whitespace-nowrap text-sm">
                        <span className="mr-1 text-base">{icon}</span>{label}
                      </td>
                      {/* Horario */}
                      <td className="px-2 py-3">
                        <input
                          type="text"
                          value={form.tiempos[key].horario}
                          onChange={(e) => updateTiempo(key, 'horario', e.target.value)}
                          placeholder="7:30 AM"
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs
                                     focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
                        />
                      </td>
                      {/* Porciones */}
                      <td className="px-3 py-3">
                        <PorcionesSelector
                          value={form.tiempos[key].porciones}
                          onChange={(txt) => updateTiempo(key, 'porciones', txt)}
                          compact
                        />
                      </td>
                      {/* Ejemplo de menú */}
                      <td className="px-3 py-3">
                        <textarea
                          value={form.tiempos[key].ejemplo_menu}
                          onChange={(e) => updateTiempo(key, 'ejemplo_menu', e.target.value)}
                          placeholder={`Opciones para ${label.toLowerCase()}…`}
                          rows={3}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs
                                     focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none
                                     bg-white placeholder:text-slate-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Campos adicionales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ta(
              'Observaciones / Alimentos libres',
              form.observaciones,
              (v) => setForm((f) => ({ ...f, observaciones: v })),
              'Ej: Puede tomar fruta libremente entre comidas. El agua es libre…',
              3,
              '📝',
            )}
            {ta(
              'Restricciones especiales',
              form.restricciones_especiales,
              (v) => setForm((f) => ({ ...f, restricciones_especiales: v })),
              'Ej: Los picadillos no deben llevar maíz dulce ni papa…',
              3,
              '🚫',
            )}
          </div>

          {/* Mensaje motivacional */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              🎉 Mensaje motivacional
            </label>
            <input
              type="text"
              value={form.mensaje_motivacional}
              onChange={(e) => setForm((f) => ({ ...f, mensaje_motivacional: e.target.value }))}
              placeholder="Ej: ¡Felicidades! Bajaste 4.4 kg de grasa. Vas muy bien 🌟"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700
                         focus:outline-none focus:ring-2 focus:ring-brand-300 placeholder:text-slate-300"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Aparece destacado en verde en la pantalla de plan del paciente.
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <span>⚠️</span> {error}
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm
                       font-medium hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700
                       text-white text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
                Guardando…
              </>
            ) : (
              <>💾 {planEditando ? 'Guardar cambios' : 'Crear plan'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente: Modal de asignar plan a paciente ─────────────────────────────

function ModalAsignar({
  plan,
  onClose,
  onAsignado,
}: {
  plan:       PlanTemplate;
  onClose:    () => void;
  onAsignado: (nombrePaciente: string) => void;
}) {
  const [query,       setQuery]       = useState('');
  const [resultados,  setResultados]  = useState<PacienteResult[]>([]);
  const [buscando,    setBuscando]    = useState(false);
  const [seleccionado, setSeleccionado] = useState<PacienteResult | null>(null);
  const [asignando,   setAsignando]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 1) { setResultados([]); return; }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(
          `/api/nutriologo/pacientes/buscar?q=${encodeURIComponent(query.trim())}`,
        );
        if (res.ok) {
          const json = await res.json() as { data: PacienteResult[] };
          setResultados(json.data ?? []);
        }
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Auto-foco al abrir
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleAsignar() {
    if (!seleccionado) return;
    setAsignando(true);
    setError(null);
    try {
      const res = await fetch(`/api/planes/${plan.id}/asignar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paciente_id: seleccionado.id }),
      });
      const json = await res.json() as { ok?: boolean; error?: string; nombrePaciente?: string };
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      onAsignado(json.nombrePaciente ?? `${seleccionado.nombre} ${seleccionado.apellido ?? ''}`.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar');
    } finally {
      setAsignando(false);
    }
  }

  const nombrePlan = plan.nombre.length > 40 ? plan.nombre.slice(0, 37) + '…' : plan.nombre;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800">Asignar plan a paciente</h2>
            <p className="text-xs text-slate-400 mt-0.5 max-w-[280px] truncate">
              📋 {nombrePlan}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400
                       hover:bg-slate-100 text-xl transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">

          {/* Buscador */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {buscando ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16">
                  <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSeleccionado(null); }}
              placeholder="Buscar por nombre o apellido…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>

          {/* Resultados */}
          {resultados.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {resultados.map((p) => {
                const nombreCompleto = [p.nombre, p.apellido].filter(Boolean).join(' ');
                const inicial = (p.nombre.charAt(0) + (p.apellido?.charAt(0) ?? '')).toUpperCase();
                const activo  = seleccionado?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSeleccionado(activo ? null : p)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      activo ? 'bg-brand-50' : 'hover:bg-slate-50',
                    )}
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                      {p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.avatar_url} alt={p.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">
                          {inicial}
                        </div>
                      )}
                    </div>
                    {/* Nombre */}
                    <span className={cn(
                      'flex-1 text-sm font-medium',
                      activo ? 'text-brand-700' : 'text-slate-800',
                    )}>
                      {nombreCompleto}
                    </span>
                    {/* Check */}
                    {activo && (
                      <span className="text-brand-600 text-base">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Sin resultados */}
          {query.trim().length >= 1 && !buscando && resultados.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-3">
              No se encontraron pacientes con "{query}"
            </p>
          )}

          {/* Paciente seleccionado (confirmación visual) */}
          {seleccionado && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="text-brand-600">👤</span>
              <p className="text-sm text-brand-700 font-medium">
                {[seleccionado.nombre, seleccionado.apellido].filter(Boolean).join(' ')}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <span>⚠️</span> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm
                       font-medium hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAsignar}
            disabled={!seleccionado || asignando}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700
                       text-white text-sm font-semibold disabled:opacity-40 transition-colors"
          >
            {asignando ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
                Asignando…
              </>
            ) : (
              '✓ Asignar plan'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente: Tarjeta de plan ──────────────────────────────────────────────

function PlanCard({
  plan,
  onEditar,
  onEliminar,
  onAsignar,
}: {
  plan:       PlanTemplate;
  onEditar:   () => void;
  onEliminar: () => void;
  onAsignar:  () => void;
}) {
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  const tiemposConDatos = TIEMPOS_CONFIG.filter(({ key }) => {
    const t = plan.contenido_json?.tiempos?.[key];
    return t?.porciones || t?.ejemplo_menu;
  });

  const fecha = plan.updated_at ?? plan.created_at;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden
                    hover:shadow-md transition-shadow">
      {/* Header de la tarjeta */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800 text-base leading-tight truncate">
              {plan.nombre}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatRelativo(fecha)}
            </p>
          </div>
          {/* Botón asignar */}
          <button
            onClick={onAsignar}
            className="flex-shrink-0 flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700
                       text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors
                       whitespace-nowrap"
          >
            <span>👤</span> Asignar a paciente
          </button>
        </div>
      </div>

      {/* Cuerpo: preview de tiempos */}
      <div className="px-5 py-3">
        {tiemposConDatos.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {TIEMPOS_CONFIG.map(({ key, icon, label }) => {
              const t       = plan.contenido_json?.tiempos?.[key];
              const tieneDatos = t?.porciones || t?.ejemplo_menu;
              return (
                <span
                  key={key}
                  title={tieneDatos ? `${label}: ${t?.horario ?? ''}` : `${label}: sin datos`}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium',
                    tieneDatos
                      ? 'bg-brand-50 text-brand-700'
                      : 'bg-slate-100 text-slate-400',
                  )}
                >
                  <span>{icon}</span>
                  {label}
                  {tieneDatos && t?.horario && (
                    <span className="text-brand-400 ml-0.5">{t.horario}</span>
                  )}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Sin tiempos de comida definidos</p>
        )}

        {/* Preview mensaje motivacional */}
        {plan.contenido_json?.mensaje_motivacional && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg
                         px-3 py-2 mt-3 leading-relaxed">
            🎉 {plan.contenido_json.mensaje_motivacional}
          </p>
        )}
      </div>

      {/* Footer: acciones secundarias */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onEditar}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1
                       transition-colors px-2 py-1 rounded-lg hover:bg-slate-100"
          >
            ✏️ Editar
          </button>
          {confirmarEliminar ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
              <button
                onClick={onEliminar}
                className="text-xs font-bold text-white bg-red-500 hover:bg-red-600
                           px-2.5 py-1 rounded-lg transition-colors"
              >
                Sí
              </button>
              <button
                onClick={() => setConfirmarEliminar(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700
                           px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmarEliminar(true)}
              className="text-xs font-medium text-slate-400 hover:text-red-500 flex items-center gap-1
                         transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
            >
              🗑️ Eliminar
            </button>
          )}
        </div>
        <span className="text-[10px] text-slate-300 font-mono">{plan.id.slice(0, 8)}</span>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3',
      'rounded-xl shadow-xl text-sm font-semibold max-w-sm',
      type === 'ok'
        ? 'bg-green-600 text-white'
        : 'bg-red-600 text-white',
    )}>
      <span>{type === 'ok' ? '✓' : '⚠'}</span>
      {msg}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlanesPage() {
  const [planes,        setPlanes]        = useState<PlanTemplate[]>([]);
  const [cargando,      setCargando]      = useState(true);
  const [errorCarga,    setErrorCarga]    = useState<string | null>(null);
  const [modalNuevo,    setModalNuevo]    = useState(false);
  const [planEditando,  setPlanEditando]  = useState<PlanTemplate | null>(null);
  const [planAsignando, setPlanAsignando] = useState<PlanTemplate | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const cargarPlanes = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res  = await fetch('/api/planes');
      const json = await res.json() as { data?: PlanTemplate[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      setPlanes(json.data ?? []);
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : 'Error al cargar los planes');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarPlanes(); }, [cargarPlanes]);

  // Guardar plan (nuevo o editado)
  function handleSaved(planGuardado: PlanTemplate) {
    setPlanes((prev) => {
      const existeIdx = prev.findIndex((p) => p.id === planGuardado.id);
      if (existeIdx >= 0) {
        // Actualizar existente
        const next = [...prev];
        next[existeIdx] = planGuardado;
        return next;
      }
      // Agregar al inicio (nuevo)
      return [planGuardado, ...prev];
    });
    setModalNuevo(false);
    setPlanEditando(null);
    showToast(planEditando ? 'Plan actualizado correctamente' : '¡Plan creado! Ahora puedes asignarlo a pacientes');
  }

  // Eliminar plan
  async function handleEliminar(plan: PlanTemplate) {
    try {
      const res = await fetch(`/api/planes/${plan.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? `Error ${res.status}`);
      }
      setPlanes((prev) => prev.filter((p) => p.id !== plan.id));
      showToast('Plan eliminado');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al eliminar', 'err');
    }
  }

  // Plan asignado a paciente
  function handleAsignado(nombrePaciente: string) {
    setPlanAsignando(null);
    showToast(`✓ Plan asignado a ${nombrePaciente}`);
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Planes Nutricionales</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Crea plantillas de planes clínicos y asígnalas a tus pacientes
          </p>
        </div>
        <button
          onClick={() => setModalNuevo(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white
                     font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <span className="text-base">+</span> Nuevo plan
        </button>
      </div>

      {/* ── Estado de carga ── */}
      {cargando && (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-slate-100 rounded-xl" />
          ))}
        </div>
      )}

      {/* ── Error de carga ── */}
      {!cargando && errorCarga && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <span className="text-red-500">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Error al cargar los planes</p>
            <p className="text-xs text-red-600 mt-0.5">{errorCarga}</p>
          </div>
          <button
            onClick={cargarPlanes}
            className="ml-auto text-xs text-red-600 hover:text-red-800 font-semibold underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Estado vacío ── */}
      {!cargando && !errorCarga && planes.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center">
          <span className="text-5xl block mb-4">📋</span>
          <p className="font-semibold text-slate-700 text-lg">Sin planes creados</p>
          <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
            Crea tu primer plan nutricional clínico y asígnalo a tus pacientes con un solo clic.
          </p>
          <button
            onClick={() => setModalNuevo(true)}
            className="mt-5 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700
                       text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <span>+</span> Crear primer plan
          </button>
        </div>
      )}

      {/* ── Lista de planes ── */}
      {!cargando && planes.length > 0 && (
        <div className="space-y-4">
          {planes.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEditar={() => setPlanEditando(plan)}
              onEliminar={() => handleEliminar(plan)}
              onAsignar={() => setPlanAsignando(plan)}
            />
          ))}
          <p className="text-xs text-slate-400 text-right">
            {planes.length} plan{planes.length !== 1 ? 'es' : ''} en tu biblioteca
          </p>
        </div>
      )}

      {/* ── Modal: Nuevo plan ── */}
      {(modalNuevo || planEditando) && (
        <ModalPlan
          planEditando={planEditando}
          onClose={() => { setModalNuevo(false); setPlanEditando(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* ── Modal: Asignar a paciente ── */}
      {planAsignando && (
        <ModalAsignar
          plan={planAsignando}
          onClose={() => setPlanAsignando(null)}
          onAsignado={handleAsignado}
        />
      )}

      {/* ── Toast ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
