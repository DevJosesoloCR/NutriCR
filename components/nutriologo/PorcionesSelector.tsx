'use client';

/**
 * PorcionesSelector
 *
 * Selector interactivo de porciones por grupo de intercambio alimenticio.
 * Recibe y emite el valor como string resumen ("1 Harina · 3 Carnes · 1 Vegetal")
 * para mantener compatibilidad con el campo `porciones: string` de TiempoComida.
 *
 * Ciclo de datos:
 *   value (string) → parsePorciones → conteos internos
 *   conteos internos → buildResumen → onChange(string) → padre guarda en DB
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// ─── Grupos de intercambio ────────────────────────────────────────────────────

type GrupoKey = 'harina' | 'carne' | 'vegetal' | 'fruta' | 'grasa' | 'lacteo' | 'azucar' | 'libre';

interface Grupo {
  key:      GrupoKey;
  label:    string;   // singular — lo que se muestra en el chip
  plural:   string;   // para el resumen cuando n > 1
  icon:     string;
  color:    string;   // clases Tailwind activas (verde base)
  colorBg:  string;
}

const GRUPOS: Grupo[] = [
  { key: 'harina',  label: 'Harina',  plural: 'Harinas',   icon: '🌾', color: 'text-amber-800',  colorBg: 'bg-amber-50  border-amber-300'  },
  { key: 'carne',   label: 'Carne',   plural: 'Carnes',    icon: '🥩', color: 'text-red-800',    colorBg: 'bg-red-50    border-red-300'    },
  { key: 'vegetal', label: 'Vegetal', plural: 'Vegetales', icon: '🥦', color: 'text-green-800',  colorBg: 'bg-green-50  border-green-300'  },
  { key: 'fruta',   label: 'Fruta',   plural: 'Frutas',    icon: '🍎', color: 'text-pink-800',   colorBg: 'bg-pink-50   border-pink-300'   },
  { key: 'grasa',   label: 'Grasa',   plural: 'Grasas',    icon: '🫒', color: 'text-yellow-800', colorBg: 'bg-yellow-50 border-yellow-300' },
  { key: 'lacteo',  label: 'Lácteo',  plural: 'Lácteos',   icon: '🥛', color: 'text-sky-800',    colorBg: 'bg-sky-50    border-sky-300'    },
  { key: 'azucar',  label: 'Azúcar',  plural: 'Azúcares',  icon: '🍬', color: 'text-purple-800', colorBg: 'bg-purple-50 border-purple-300' },
  { key: 'libre',   label: 'Libre',   plural: 'Libres',    icon: '✅', color: 'text-teal-800',   colorBg: 'bg-teal-50   border-teal-300'   },
];

// ─── Helpers de parse / build ─────────────────────────────────────────────────

function ceroConteos(): Record<GrupoKey, number> {
  return { harina: 0, carne: 0, vegetal: 0, fruta: 0, grasa: 0, lacteo: 0, azucar: 0, libre: 0 };
}

// Normaliza acentos y pasa a minúsculas para comparación flexible
function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const ETIQUETAS = GRUPOS.flatMap((g) => [
  { key: g.key, n: norm(g.label)  },
  { key: g.key, n: norm(g.plural) },
]);

/**
 * Intenta reconstruir los conteos desde el resumen guardado.
 * Ej: "1 Harina · 3 Carnes · 1 Vegetal" → { harina:1, carne:3, vegetal:1, … }
 * Si el texto es texto libre antiguo que no parsea, devuelve ceros.
 */
function parsePorciones(text: string): Record<GrupoKey, number> {
  const counts = ceroConteos();
  if (!text.trim()) return counts;

  // Separar por · o ,
  const partes = text.split(/\s*[·,]\s*/);
  for (const parte of partes) {
    const m = parte.trim().match(/^(\d+)\s+(.+)$/);
    if (!m) continue;
    const n     = parseInt(m[1], 10);
    const label = norm(m[2].trim());
    const hit   = ETIQUETAS.find((e) => e.n === label);
    if (hit) counts[hit.key] = n;
  }
  return counts;
}

/**
 * Construye el string resumen desde los conteos.
 * Ej: { harina:1, carne:3 } → "1 Harina · 3 Carnes"
 */
export function buildResumen(counts: Record<GrupoKey, number>): string {
  return GRUPOS
    .filter((g) => counts[g.key] > 0)
    .map((g) => `${counts[g.key]} ${counts[g.key] === 1 ? g.label : g.plural}`)
    .join(' · ');
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  value:    string;                  // porciones como string (lo que se guarda)
  onChange: (text: string) => void;  // devuelve el resumen actualizado
  /** 2 columnas siempre (para celda de tabla). Sin compact → 4 cols en pantallas anchas. */
  compact?: boolean;
}

export default function PorcionesSelector({ value, onChange, compact = false }: Props) {
  const [counts, setCounts] = useState<Record<GrupoKey, number>>(() => parsePorciones(value));

  // Sincronizar desde el padre cuando value cambia externamente
  // (ej: carga de plan existente, reset del formulario)
  useEffect(() => {
    const parsed = parsePorciones(value);
    setCounts((prev) => {
      // Evitar re-render si los conteos son idénticos (ya fuimos nosotros quienes lo generamos)
      const changed = GRUPOS.some((g) => parsed[g.key] !== prev[g.key]);
      return changed ? parsed : prev;
    });
  }, [value]);

  function adjust(key: GrupoKey, delta: number) {
    setCounts((prev) => {
      const next = { ...prev, [key]: Math.max(0, (prev[key] ?? 0) + delta) };
      // Notificar al padre con el nuevo resumen
      onChange(buildResumen(next));
      return next;
    });
  }

  const resumen     = buildResumen(counts);
  const tieneAlguno = GRUPOS.some((g) => counts[g.key] > 0);

  return (
    <div className="space-y-1.5">
      {/*
        Grid de chips — siempre 2 columnas en modo compact (tabla).
        Cada chip tiene un ancho mínimo garantizado para que el label
        nunca se recorte: los controles ocupan ~62 px fijos y el label
        "Vegetal" (el más largo) ~42 px → chip total ~110 px.
        Con la columna de Porciones en w-80 (320 px) cada celda del
        grid mide (320-24)/2-2 = 146 px → sobra margen de ~36 px.
      */}
      <div className={cn(
        'grid gap-1.5',
        compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4',
      )}>
        {GRUPOS.map(({ key, label, icon, color, colorBg }) => {
          const n      = counts[key];
          const active = n > 0;
          return (
            <div
              key={key}
              className={cn(
                // El chip no recorta: whitespace-nowrap en el label
                // y el contenedor es flex sin overflow hidden.
                'flex items-center gap-1 rounded-lg border px-2 py-1.5 transition-all',
                active
                  ? cn(colorBg, 'shadow-sm')
                  : 'bg-slate-50 border-slate-200',
              )}
            >
              {/* Botón − */}
              <button
                type="button"
                onClick={() => adjust(key, -1)}
                disabled={n === 0}
                className={cn(
                  'w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
                  'text-xs font-black leading-none select-none transition-colors',
                  active
                    ? 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900'
                    : 'bg-slate-200 text-slate-300 disabled:opacity-40 cursor-default',
                )}
                aria-label={`Restar ${label}`}
              >
                −
              </button>

              {/* Contador */}
              <span className={cn(
                'w-4 text-center text-[11px] font-bold leading-none flex-shrink-0 tabular-nums',
                active ? color : 'text-slate-400',
              )}>
                {n}
              </span>

              {/* Botón + */}
              <button
                type="button"
                onClick={() => adjust(key, +1)}
                className={cn(
                  'w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
                  'text-xs font-black leading-none select-none transition-colors',
                  active
                    ? 'bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700',
                )}
                aria-label={`Sumar ${label}`}
              >
                +
              </button>

              {/* Icono + Etiqueta — sin truncate, sin min-w-0 */}
              <span className={cn(
                'flex items-center gap-0.5 flex-shrink-0',
                active ? color : 'text-slate-500',
              )}>
                <span className="text-[11px] leading-none">{icon}</span>
                <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
                  {label}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Resumen */}
      <div className={cn(
        'rounded-lg px-2.5 py-1.5 min-h-[26px] transition-colors',
        tieneAlguno
          ? 'bg-green-50 border border-green-200'
          : 'bg-slate-50 border border-slate-100',
      )}>
        {tieneAlguno ? (
          <p className="text-[10px] font-semibold text-green-700 leading-snug">
            {resumen}
          </p>
        ) : (
          <p className="text-[10px] text-slate-400 italic leading-snug">
            Sin porciones asignadas
          </p>
        )}
      </div>
    </div>
  );
}
