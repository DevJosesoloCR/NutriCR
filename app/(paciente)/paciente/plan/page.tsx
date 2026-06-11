'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// ─── Chips de porciones (display-only) ───────────────────────────────────────

const GRUPO_ESTILOS: Record<string, { icon: string; bg: string; text: string }> = {
  harina:   { icon: '🌾', bg: 'bg-amber-100',  text: 'text-amber-800'  },
  carne:    { icon: '🥩', bg: 'bg-red-100',    text: 'text-red-800'    },
  vegetal:  { icon: '🥦', bg: 'bg-green-100',  text: 'text-green-800'  },
  fruta:    { icon: '🍎', bg: 'bg-pink-100',   text: 'text-pink-800'   },
  grasa:    { icon: '🫒', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  lácteo:   { icon: '🥛', bg: 'bg-sky-100',    text: 'text-sky-800'    },
  lacteo:   { icon: '🥛', bg: 'bg-sky-100',    text: 'text-sky-800'    },
  azúcar:   { icon: '🍬', bg: 'bg-purple-100', text: 'text-purple-800' },
  azucar:   { icon: '🍬', bg: 'bg-purple-100', text: 'text-purple-800' },
  libre:    { icon: '✅', bg: 'bg-teal-100',   text: 'text-teal-800'   },
};

// Normaliza sin acento y en minúsculas para buscar estilo
function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface PorcionChip { cantidad: number; label: string; estilo: { icon: string; bg: string; text: string } | null }

function parsearPorciones(texto: string): PorcionChip[] | null {
  if (!texto.trim()) return null;
  const partes = texto.split(/\s*·\s*/);
  const chips: PorcionChip[] = [];
  for (const parte of partes) {
    const m = parte.trim().match(/^(\d+)\s+(.+)$/);
    if (!m) return null; // texto libre antiguo → fallback
    const cantidad = parseInt(m[1], 10);
    const label    = m[2].trim();
    const key      = norm(label).replace(/s$/, ''); // singular aproximado
    const estilo   = GRUPO_ESTILOS[norm(label)] ?? GRUPO_ESTILOS[key] ?? null;
    chips.push({ cantidad, label, estilo });
  }
  return chips.length ? chips : null;
}

function PorcionesDisplay({ texto }: { texto: string }) {
  const chips = parsearPorciones(texto);
  if (!chips) {
    // Texto libre o formato antiguo — mostrar tal cual
    return <p className="text-sm text-slate-700 font-medium">{texto}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(({ cantidad, label, estilo }) => (
        <span
          key={label}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
            estilo ? cn(estilo.bg, estilo.text) : 'bg-slate-100 text-slate-700',
          )}
        >
          {estilo?.icon && <span>{estilo.icon}</span>}
          <span className="font-bold">{cantidad}</span>
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TiempoComida {
  horario:      string;
  porciones:    string;
  ejemplo_menu: string;
}

type TiempoKey =
  | 'desayuno'
  | 'merienda_am'
  | 'almuerzo'
  | 'merienda_pm'
  | 'cena'
  | 'colado_nocturno';

interface PlanClinico {
  tiempos:                  Partial<Record<TiempoKey, TiempoComida>>;
  observaciones:            string;
  restricciones_especiales: string;
  mensaje_motivacional:     string;
}

interface PlanNutricional {
  id:                      string;
  nombre:                  string;
  calorias_diarias:        number | null;
  restricciones_dieteticas: string[] | null;
  contenido_json:          PlanClinico | null;
}

interface MacrosComida {
  calorias: number;
  proteina: number;
  carbos:   number;
  grasas:   number;
}

interface ComidaReceta {
  nombre:        string;
  ingredientes:  string[];
  instrucciones: string[];
  macros:        MacrosComida;
}

interface MenuDia {
  desayuno: ComidaReceta;
  almuerzo: ComidaReceta;
  cena:     ComidaReceta;
  merienda: ComidaReceta;
}

// ─── Config de tiempos de comida ─────────────────────────────────────────────

const TIEMPOS_CONFIG: {
  key:      TiempoKey;
  label:    string;
  icon:     string;
  bg:       string;
  border:   string;
  iconBg:   string;
}[] = [
  { key: 'desayuno',        label: 'Desayuno',        icon: '🌅', bg: 'bg-amber-50',  border: 'border-amber-200',  iconBg: 'bg-amber-100'  },
  { key: 'merienda_am',     label: 'Merienda AM',     icon: '☕', bg: 'bg-orange-50', border: 'border-orange-200', iconBg: 'bg-orange-100' },
  { key: 'almuerzo',        label: 'Almuerzo',        icon: '☀️', bg: 'bg-yellow-50', border: 'border-yellow-200', iconBg: 'bg-yellow-100' },
  { key: 'merienda_pm',     label: 'Merienda PM',     icon: '🍎', bg: 'bg-lime-50',   border: 'border-lime-200',   iconBg: 'bg-lime-100'   },
  { key: 'cena',            label: 'Cena',            icon: '🌙', bg: 'bg-blue-50',   border: 'border-blue-200',   iconBg: 'bg-blue-100'   },
  { key: 'colado_nocturno', label: 'Colado Nocturno', icon: '🌛', bg: 'bg-indigo-50', border: 'border-indigo-200', iconBg: 'bg-indigo-100' },
];

const RECETAS_CONFIG: { key: keyof MenuDia; label: string; icon: string }[] = [
  { key: 'desayuno', label: 'Desayuno', icon: '🌅' },
  { key: 'almuerzo', label: 'Almuerzo', icon: '☀️' },
  { key: 'merienda', label: 'Merienda', icon: '🍎' },
  { key: 'cena',     label: 'Cena',     icon: '🌙' },
];

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 bg-slate-200 rounded-lg w-48" />
      <div className="h-20 bg-slate-100 rounded-xl" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 bg-slate-100 rounded-xl" />
      ))}
    </div>
  );
}

function TiempoCard({
  config,
  tiempo,
}: {
  config: (typeof TIEMPOS_CONFIG)[number];
  tiempo: TiempoComida;
}) {
  const tieneDatos = tiempo.porciones || tiempo.ejemplo_menu;
  if (!tieneDatos) return null;

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', config.bg, config.border)}>
      {/* Header: icono + nombre + horario */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-lg', config.iconBg)}>
            {config.icon}
          </div>
          <span className="font-semibold text-slate-800">{config.label}</span>
        </div>
        {tiempo.horario && (
          <span className="flex items-center gap-1 text-sm text-slate-500 font-medium">
            <span className="text-base">⏰</span>
            {tiempo.horario}
          </span>
        )}
      </div>

      {/* Porciones */}
      {tiempo.porciones && (
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
            Porciones
          </p>
          <PorcionesDisplay texto={tiempo.porciones} />
        </div>
      )}

      {/* Opciones de menú */}
      {tiempo.ejemplo_menu && (
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">
            Opciones
          </p>
          <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
            {tiempo.ejemplo_menu}
          </p>
        </div>
      )}
    </div>
  );
}

function RecetaCard({
  config,
  comida,
}: {
  config: (typeof RECETAS_CONFIG)[number];
  comida: ComidaReceta;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none">{config.icon}</span>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {config.label}
            </p>
            <p className="text-sm font-semibold text-slate-800">{comida.nombre}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium hidden sm:block">
            {comida.macros.calorias} kcal
          </span>
          <svg
            className={cn(
              'w-4 h-4 text-slate-400 transition-transform duration-200',
              abierto && 'rotate-180',
            )}
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      {/* Detalle expandible */}
      {abierto && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          {/* Macros en chips */}
          <div className="flex flex-wrap gap-2 pt-3">
            {[
              { label: 'Calorías',    value: `${comida.macros.calorias} kcal`, color: 'bg-orange-100 text-orange-700' },
              { label: 'Proteína',    value: `${comida.macros.proteina}g`,     color: 'bg-blue-100   text-blue-700'   },
              { label: 'Carbos',      value: `${comida.macros.carbos}g`,       color: 'bg-amber-100  text-amber-700'  },
              { label: 'Grasas',      value: `${comida.macros.grasas}g`,       color: 'bg-rose-100   text-rose-700'   },
            ].map((m) => (
              <span
                key={m.label}
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full',
                  m.color,
                )}
              >
                {m.label}: {m.value}
              </span>
            ))}
          </div>

          {/* Ingredientes */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              Ingredientes
            </p>
            <ul className="space-y-1">
              {comida.ingredientes.map((ing, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-brand-500 flex-shrink-0 mt-0.5">•</span>
                  {ing}
                </li>
              ))}
            </ul>
          </div>

          {/* Instrucciones */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              Preparación
            </p>
            <ol className="space-y-1.5">
              {comida.instrucciones.map((paso, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {paso}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [plan,      setPlan]      = useState<PlanNutricional | null | undefined>(undefined); // undefined = cargando
  const [menuHoy,   setMenuHoy]   = useState<MenuDia | null>(null);
  const [generando, setGenerando] = useState(false);
  const [genError,  setGenError]  = useState<string | null>(null);
  const [usandoPlan, setUsandoPlan] = useState(false);

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function cargar() {
      const [resPlan, resMenu] = await Promise.all([
        fetch('/api/paciente/plan'),
        fetch('/api/generar-recetas'),
      ]);

      if (resPlan.ok) {
        const json = await resPlan.json();
        setPlan(json.data ?? null);  // null = sin plan asignado
      } else {
        setPlan(null);
      }

      if (resMenu.ok) {
        const json = await resMenu.json();
        if (json.menu) setMenuHoy(json.menu as MenuDia);
      }
    }
    cargar();
  }, []);

  // ── Generar recetas ──────────────────────────────────────────────────────────
  async function handleGenerarRecetas() {
    setGenerando(true);
    setGenError(null);
    try {
      const res = await fetch('/api/generar-recetas', { method: 'POST' });
      const json = await res.json() as { menu?: MenuDia; error?: string; usandoPlan?: boolean };
      if (!res.ok) throw new Error(json.error ?? 'Error al generar recetas');
      if (!json.menu) throw new Error('No se recibió el menú del servidor');
      setMenuHoy(json.menu);
      setUsandoPlan(json.usandoPlan ?? false);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setGenerando(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (plan === undefined) {
    return (
      <div className="space-y-5 px-1 pb-24">
        <h1 className="text-2xl font-bold text-slate-800">Mi Plan Alimentario</h1>
        <Skeleton />
      </div>
    );
  }

  // ── Sin plan asignado ────────────────────────────────────────────────────────
  if (!plan) {
    return (
      <div className="space-y-5 px-1 pb-24">
        <h1 className="text-2xl font-bold text-slate-800">Mi Plan Alimentario</h1>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 text-center">
          <span className="text-5xl block mb-4">📋</span>
          <p className="font-semibold text-slate-700 text-lg">Sin plan asignado</p>
          <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
            Tu nutricionista aún no ha asignado tu plan alimentario.
            Cuando lo haga, aparecerá aquí.
          </p>
        </div>
      </div>
    );
  }

  const clinico = plan.contenido_json;

  return (
    <div className="space-y-5 px-1 pb-24">

      {/* ── Encabezado ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mi Plan Alimentario</h1>
        {plan.nombre && (
          <p className="text-slate-500 text-sm mt-0.5">{plan.nombre}</p>
        )}
      </div>

      {/* ── Mensaje motivacional ── */}
      {clinico?.mensaje_motivacional && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🎉</span>
          <div>
            <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1">
              Mensaje de tu nutricionista
            </p>
            <p className="text-green-800 font-medium text-sm leading-relaxed">
              {clinico.mensaje_motivacional}
            </p>
          </div>
        </div>
      )}

      {/* ── Tiempos de comida ── */}
      {clinico ? (
        <>
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
              Tiempos de comida
            </h2>
            <div className="space-y-3">
              {TIEMPOS_CONFIG.map((cfg) => {
                const tiempo = clinico.tiempos?.[cfg.key];
                if (!tiempo) return null;
                return <TiempoCard key={cfg.key} config={cfg} tiempo={tiempo} />;
              })}
            </div>
          </div>

          {/* ── Observaciones ── */}
          {clinico.observaciones && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📝</span>
                <h2 className="font-semibold text-slate-800 text-sm">
                  Observaciones / Alimentos libres
                </h2>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {clinico.observaciones}
              </p>
            </div>
          )}

          {/* ── Restricciones especiales ── */}
          {clinico.restricciones_especiales && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🚫</span>
                <h2 className="font-semibold text-red-700 text-sm">
                  Restricciones especiales
                </h2>
              </div>
              <p className="text-sm text-red-800 leading-relaxed whitespace-pre-line">
                {clinico.restricciones_especiales}
              </p>
            </div>
          )}
        </>
      ) : (
        /* Plan sin estructura clínica (solo macros en DB) */
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📊</span>
            <h2 className="font-semibold text-slate-800">Objetivos nutricionales</h2>
          </div>
          {plan.calorias_diarias && (
            <p className="text-sm text-slate-600">
              <span className="font-bold text-slate-800">{plan.calorias_diarias}</span> kcal / día
            </p>
          )}
          {plan.restricciones_dieteticas && plan.restricciones_dieteticas.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {plan.restricciones_dieteticas.map((r) => (
                <span
                  key={r}
                  className="text-xs bg-brand-50 text-brand-700 font-medium px-3 py-1 rounded-full"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          RECETAS BASADAS EN EL PLAN
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-slate-100 pt-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">✨</span>
          <h2 className="font-semibold text-slate-800">Recetas del día</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          {clinico
            ? 'Recetas generadas por IA respetando tu plan alimentario'
            : 'Recetas sugeridas por IA con ingredientes típicos costarricenses'}
        </p>

        {/* Botón generar */}
        <button
          type="button"
          onClick={handleGenerarRecetas}
          disabled={generando}
          className={cn(
            'w-full flex items-center justify-center gap-2.5',
            'py-3.5 rounded-xl font-semibold text-sm transition-all',
            'bg-brand-600 hover:bg-brand-700 text-white shadow-sm active:scale-[0.98]',
            'disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        >
          {generando ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Generando recetas con IA…
            </>
          ) : (
            <>
              <span className="text-lg leading-none">✨</span>
              {menuHoy
                ? 'Regenerar recetas del día'
                : 'Generar recetas del día basadas en mi plan'}
            </>
          )}
        </button>

        {/* Contexto del plan usado */}
        {menuHoy && usandoPlan && (
          <p className="text-center text-xs text-green-600 font-medium mt-2">
            ✓ Generado respetando tu plan alimentario
          </p>
        )}

        {/* Error */}
        {genError && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <span className="text-red-500 flex-shrink-0">⚠️</span>
            <p className="text-sm text-red-700">{genError}</p>
          </div>
        )}

        {/* Recetas del día */}
        {menuHoy && (
          <div className="mt-5 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              Recetas de hoy
            </p>
            {RECETAS_CONFIG.map((cfg) => {
              const comida = menuHoy[cfg.key];
              if (!comida) return null;
              return <RecetaCard key={cfg.key} config={cfg} comida={comida} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
