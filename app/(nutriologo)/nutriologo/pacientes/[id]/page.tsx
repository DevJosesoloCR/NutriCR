'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import PorcionesSelector from '@/components/nutriologo/PorcionesSelector';

// ─── Constants ────────────────────────────────────────────────────────────────

const OBJETIVOS = [
  'Bajar grasa',
  'Aumentar músculo',
  'Mantenimiento',
  'Mejorar salud general',
  'Control de enfermedad',
];

const RESTRICCIONES_OPCIONES = [
  'Sin gluten',
  'Sin lácteos',
  'Vegetariano',
  'Vegano',
  'Sin azúcar',
  'Alto en fibra',
];

const METRICAS = [
  { key: 'grasa_porcentaje', label: '% Grasa',      color: '#ef4444', axis: 'left',  unit: '%'  },
  { key: 'agua_porcentaje',  label: '% Agua',        color: '#3b82f6', axis: 'left',  unit: '%'  },
  { key: 'musculo_kg',       label: 'Músculo',       color: '#10b981', axis: 'right', unit: 'kg' },
  { key: 'peso',             label: 'Peso',          color: '#8b5cf6', axis: 'right', unit: 'kg' },
  { key: 'masa_osea',        label: 'Masa ósea',     color: '#f59e0b', axis: 'right', unit: 'kg' },
] as const;

type MetricaKey = (typeof METRICAS)[number]['key'];

// ─── Tipos del plan clínico ───────────────────────────────────────────────────

const TIEMPOS_COMIDA_CONFIG = [
  { key: 'desayuno'        as const, label: 'Desayuno',        icon: '🌅', defaultHorario: '7:30 AM'  },
  { key: 'merienda_am'     as const, label: 'Merienda AM',     icon: '☕', defaultHorario: '10:00 AM' },
  { key: 'almuerzo'        as const, label: 'Almuerzo',        icon: '☀️', defaultHorario: '12:00 PM' },
  { key: 'merienda_pm'     as const, label: 'Merienda PM',     icon: '🍎', defaultHorario: '3:00 PM'  },
  { key: 'cena'            as const, label: 'Cena',            icon: '🌙', defaultHorario: '6:00 PM'  },
  { key: 'colado_nocturno' as const, label: 'Colado Nocturno', icon: '🌛', defaultHorario: '8:00 PM'  },
];

type TiempoKey = (typeof TIEMPOS_COMIDA_CONFIG)[number]['key'];

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

function planClinicoInicial(): PlanClinico {
  const tiempos = {} as Record<TiempoKey, TiempoComida>;
  for (const t of TIEMPOS_COMIDA_CONFIG) {
    tiempos[t.key] = { horario: t.defaultHorario, porciones: '', ejemplo_menu: '' };
  }
  return { tiempos, observaciones: '', restricciones_especiales: '', mensaje_motivacional: '' };
}

// Todos los campos InBody — usados en el tooltip para mostrar TODOS los valores del punto
const INBODY_FIELDS: { key: keyof MedicionInbody; label: string; unit: string; color: string }[] = [
  { key: 'peso',             label: 'Peso total',     unit: ' kg', color: '#8b5cf6' },
  { key: 'grasa_porcentaje', label: '% Grasa',        unit: '%',   color: '#ef4444' },
  { key: 'musculo_kg',       label: 'Masa muscular',  unit: ' kg', color: '#10b981' },
  { key: 'agua_porcentaje',  label: '% Agua',         unit: '%',   color: '#3b82f6' },
  { key: 'masa_osea',        label: 'Masa ósea',      unit: ' kg', color: '#f59e0b' },
  { key: 'grasa_visceral',   label: 'Grasa visceral', unit: '',    color: '#ec4899' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface PacienteDetalle {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string;
  avatar_url: string | null;
  objetivo: string | null;
  condiciones_medicas: string[];
  alergias: string[];
  peso: number | null;
  altura: number | null;
  fecha_nacimiento: string | null;
  // Datos extendidos de perfil
  sexo:            'masculino' | 'femenino' | null;
  estatura_cm:     number | null;
  peso_meta_kg:    number | null;
  nivel_actividad: string | null;
  ocupacion:       string | null;
  telefono:        string | null;
}

interface PlanNutricional {
  id:                       string;
  calorias_diarias:         number | null;
  proteinas_g:              number | null;
  carbohidratos_g:          number | null;
  grasas_g:                 number | null;
  restricciones_dieteticas: string[] | null;
  contenido_json:           PlanClinico | null;
}

interface MedicionInbody {
  id: string;
  paciente_id: string;
  fecha: string;
  peso: number | null;
  grasa_porcentaje: number | null;
  musculo_kg: number | null;
  agua_porcentaje: number | null;
  masa_osea: number | null;
  grasa_visceral: number | null;
}

interface Nota {
  id: string;
  paciente_id: string;
  nutriologo_id: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
}

interface FotoDiario {
  id: string;
  foto_url: string;
  descripcion: string | null;
  revisada: boolean;
  created_at: string;
}

// ─── Mock data (cuando el paciente no existe en la BD) ────────────────────────

const MOCK_PACIENTE: PacienteDetalle = {
  id:                  'mock-detalle',
  nombre:              'Ana',
  apellido:            'González Mora',
  email:               'ana.gonzalez@email.com',
  avatar_url:          null,
  objetivo:            'Bajar grasa',
  condiciones_medicas: ['Hipotiroidismo', 'Resistencia a la insulina'],
  alergias:            ['Mariscos', 'Nueces'],
  peso:                68.8,
  altura:              1.62,
  fecha_nacimiento:    '1990-04-15',
  sexo:                'femenino',
  estatura_cm:         162,
  peso_meta_kg:        60,
  nivel_actividad:     'moderado',
  ocupacion:           'Oficinista',
  telefono:            null,
};

const MOCK_MEDICIONES: MedicionInbody[] = [
  { id: 'm1', paciente_id: 'mock-detalle', fecha: '2025-02-15', peso: 74.2, grasa_porcentaje: 33.5, musculo_kg: 27.8, agua_porcentaje: 50.5, masa_osea: 2.4, grasa_visceral: 9  },
  { id: 'm2', paciente_id: 'mock-detalle', fecha: '2025-03-10', peso: 72.1, grasa_porcentaje: 31.8, musculo_kg: 28.3, agua_porcentaje: 52.1, masa_osea: 2.4, grasa_visceral: 8  },
  { id: 'm3', paciente_id: 'mock-detalle', fecha: '2025-04-05', peso: 70.5, grasa_porcentaje: 30.2, musculo_kg: 28.9, agua_porcentaje: 53.4, masa_osea: 2.5, grasa_visceral: 7  },
  { id: 'm4', paciente_id: 'mock-detalle', fecha: '2025-05-01', peso: 68.8, grasa_porcentaje: 28.5, musculo_kg: 29.4, agua_porcentaje: 55.0, masa_osea: 2.5, grasa_visceral: 6  },
];

const MOCK_PLAN: PlanNutricional = {
  id:                       'plan-mock',
  calorias_diarias:         1800,
  proteinas_g:              140,
  carbohidratos_g:          180,
  grasas_g:                 60,
  restricciones_dieteticas: ['Sin azúcar', 'Alto en fibra'],
  contenido_json:           null,
};

const MOCK_NOTAS: Nota[] = [
  {
    id:            'nota-1',
    paciente_id:   'mock-detalle',
    nutriologo_id: '22222222-2222-2222-2222-222222222222',
    mensaje:       'Tu progreso es excelente. Recuerda tomar la tiroxina en ayunas, 30 minutos antes del desayuno. Sigue con el plan y nos vemos la próxima semana.',
    fecha:         '2025-05-10T10:30:00',
    leida:         true,
  },
  {
    id:            'nota-2',
    paciente_id:   'mock-detalle',
    nutriologo_id: '22222222-2222-2222-2222-222222222222',
    mensaje:       'Ajustamos las calorías a 1800 kcal para acelerar la pérdida de grasa sin perder masa muscular. El objetivo para junio es llegar a 26% de grasa.',
    fecha:         '2025-04-20T15:00:00',
    leida:         true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEstado(estado: string) {
  if (estado === 'Al día')  return { label: 'Al día',  bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' };
  if (estado === 'Revisar') return { label: 'Revisar', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' };
  return                           { label: 'Urgente', bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500'   };
}

function formatFecha(iso: string) {
  const d = new Date(iso + 'T12:00:00'); // evitar offset timezone
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
}

function formatFechaLarga(iso: string) {
  return new Date(iso).toLocaleDateString('es-CR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function macroCalc(proteinas: number, carbos: number, grasas: number) {
  const total = proteinas * 4 + carbos * 4 + grasas * 9;
  if (total === 0) return { pPct: 0, cPct: 0, gPct: 0 };
  return {
    pPct: Math.round((proteinas * 4 / total) * 100),
    cPct: Math.round((carbos * 4 / total) * 100),
    gPct: Math.round((grasas * 9 / total) * 100),
  };
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
  action,
  badge,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{icon}</span>
          <h2 className="font-semibold text-slate-800">{title}</h2>
          {badge}
        </div>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium',
      type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
    )}>
      <span>{type === 'ok' ? '✓' : '⚠'}</span>
      {msg}
    </div>
  );
}

// ─── Modal: Agregar medición ──────────────────────────────────────────────────

function ModalMedicion({
  onGuardar,
  onClose,
  saving,
}: {
  onGuardar: (m: Omit<MedicionInbody, 'id' | 'paciente_id'>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const hoy = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    fecha:            hoy,
    peso:             '',
    grasa_porcentaje: '',
    musculo_kg:       '',
    agua_porcentaje:  '',
    masa_osea:        '',
    grasa_visceral:   '',
  });

  function handleChange(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const gv = form.grasa_visceral ? parseInt(form.grasa_visceral, 10) : null;
    onGuardar({
      fecha:            form.fecha,
      peso:             form.peso             ? parseFloat(form.peso)             : null,
      grasa_porcentaje: form.grasa_porcentaje ? parseFloat(form.grasa_porcentaje) : null,
      musculo_kg:       form.musculo_kg       ? parseFloat(form.musculo_kg)       : null,
      agua_porcentaje:  form.agua_porcentaje  ? parseFloat(form.agua_porcentaje)  : null,
      masa_osea:        form.masa_osea        ? parseFloat(form.masa_osea)        : null,
      grasa_visceral:   gv !== null && gv >= 1 && gv <= 20 ? gv : null,
    });
  }

  const field = (
    label: string,
    key: keyof typeof form,
    unit: string,
    placeholder: string,
    opts?: { optional?: boolean; min?: number; max?: number; step?: string },
  ) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
        {label}
        {opts?.optional && <span className="ml-1 font-normal text-slate-400">(opcional)</span>}
      </label>
      <div className="relative">
        <input
          type={key === 'fecha' ? 'date' : 'number'}
          step={opts?.step ?? '0.1'}
          min={opts?.min}
          max={opts?.max}
          value={form[key]}
          onChange={(e) => handleChange(key, e.target.value)}
          placeholder={placeholder}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 pr-10"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
            {unit}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Nueva medición InBody</h3>
            <p className="text-xs text-slate-400 mt-0.5">Todos los campos son opcionales excepto la fecha</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 text-xl">×</button>
        </div>

        {/* Body con scroll */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {field('Fecha de medición', 'fecha', '', '')}

          {/* Campos principales */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Composición corporal</p>
            <div className="grid grid-cols-2 gap-3">
              {field('Peso',            'peso',             'kg', '70.5')}
              {field('% Grasa',         'grasa_porcentaje', '%',  '28.5')}
              {field('Masa muscular',   'musculo_kg',       'kg', '29.4')}
              {field('% Agua corporal', 'agua_porcentaje',  '%',  '55.0')}
            </div>
          </div>

          {/* Campos opcionales */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Campos adicionales</p>
            <div className="grid grid-cols-2 gap-3">
              {field('Masa ósea',       'masa_osea',       'kg', '2.5', { optional: true })}
              {field('Grasa visceral',  'grasa_visceral',  '',   '8',   { optional: true, step: '1', min: 1, max: 20 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Grasa visceral: valor entre 1 y 20 (escala InBody)</p>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!form.fecha || saving}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar medición'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Custom tooltip para recharts ─────────────────────────────────────────────
// Muestra TODOS los valores del punto (incluyendo campos no graficados),
// independientemente de qué líneas estén visibles en ese momento.

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: MedicionInbody }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const campos = INBODY_FIELDS.filter((f) => d[f.key] != null);
  if (!campos.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[168px]">
      <p className="font-bold text-slate-700 mb-2">{label}</p>
      <div className="space-y-1">
        {campos.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-4">
            <span className="text-slate-500">{f.label}</span>
            <span className="font-semibold" style={{ color: f.color }}>
              {d[f.key] as number}{f.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Carrusel de fotos del diario ────────────────────────────────────────────

function CarruselDiario({
  fotos,
  indiceInicial,
  onClose,
}: {
  fotos: FotoDiario[];
  indiceInicial: number;
  onClose: () => void;
}) {
  const [idx, setIdx]   = useState(indiceInicial);
  const touchStartX     = useRef(0);
  const total           = fotos.length;
  const foto            = fotos[idx];

  const goPrev = () => setIdx((i) => (i - 1 + total) % total);
  const goNext = () => setIdx((i) => (i + 1) % total);

  // Teclado: ← → Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft')  setIdx((i) => (i - 1 + total) % total);
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % total);
      if (e.key === 'Escape')     onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, onClose]);

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col select-none"
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) { diff > 0 ? goNext() : goPrev(); }
      }}
    >
      {/* Keyframe fade */}
      <style>{`@keyframes cf { from { opacity:0; transform:scale(0.96) } to { opacity:1; transform:scale(1) } }`}</style>

      {/* ── Header: contador + cerrar ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <span className="text-white/70 text-sm font-semibold">
          {idx + 1}
          <span className="text-white/35 mx-1">/</span>
          {total}
        </span>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center text-base transition-colors"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      {/* ── Foto principal con flechas ── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden px-14">
        {/* ← Anterior */}
        {total > 1 && (
          <button
            onClick={goPrev}
            className="absolute left-2 z-10 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 text-white text-2xl leading-none flex items-center justify-center transition-colors"
            aria-label="Foto anterior"
          >
            ‹
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={foto.id}
          src={foto.foto_url}
          alt={foto.descripcion ?? 'Foto de comida'}
          className="max-w-full max-h-full object-contain rounded-lg"
          style={{ animation: 'cf 0.18s ease' }}
          draggable={false}
        />

        {/* Siguiente → */}
        {total > 1 && (
          <button
            onClick={goNext}
            className="absolute right-2 z-10 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 text-white text-2xl leading-none flex items-center justify-center transition-colors"
            aria-label="Foto siguiente"
          >
            ›
          </button>
        )}
      </div>

      {/* ── Footer: fecha + descripción + dots ── */}
      <div className="px-6 pb-8 pt-4 flex-shrink-0 text-center">
        {foto.descripcion && (
          <p className="text-white font-medium text-sm mb-1 leading-snug">{foto.descripcion}</p>
        )}
        <p className="text-white/50 text-xs">
          {new Date(foto.created_at).toLocaleDateString('es-CR', {
            weekday: 'long', day: 'numeric', month: 'long',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>

        {/* Dot strip (máximo 20 fotos) */}
        {total > 1 && total <= 20 && (
          <div className="flex justify-center gap-1.5 mt-4">
            {fotos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Ir a foto ${i + 1}`}
                className={cn(
                  'rounded-full transition-all duration-200',
                  i === idx
                    ? 'w-5 h-1.5 bg-white'
                    : 'w-1.5 h-1.5 bg-white/35 hover:bg-white/60',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PacienteDetallePage({ params }: { params: { id: string } }) {
  const pacienteId = params.id;

  // ── Data state ──────────────────────────────────────────────────────────────
  const [paciente,    setPaciente]    = useState<PacienteDetalle | null>(null);
  const [plan,        setPlan]        = useState<PlanNutricional | null>(null);
  const [mediciones,  setMediciones]  = useState<MedicionInbody[]>([]);
  const [notas,       setNotas]       = useState<Nota[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [adherencia,  setAdherencia]  = useState(0);
  const [estadoStr,   setEstadoStr]   = useState<string>('');
  const [isMock,      setIsMock]      = useState(false);

  // ── Section edit state ──────────────────────────────────────────────────────

  // Header / objetivo
  const [objetivo,      setObjetivo]      = useState('');
  const [savingObj,     setSavingObj]     = useState(false);

  // Padecimientos
  const [padecimientos,    setPadecimientos]    = useState<string[]>([]);
  const [nuevoPad,         setNuevoPad]         = useState('');
  const [savingPad,        setSavingPad]        = useState(false);

  // Alergias
  const [alergias,         setAlergias]         = useState<string[]>([]);
  const [nuevaAlergia,     setNuevaAlergia]     = useState('');
  const [savingAlergias,   setSavingAlergias]   = useState(false);

  // Plan nutricional (macros legacy — se conservan en DB)
  const [planEdit, setPlanEdit] = useState({
    calorias:  0,
    proteinas: 0,
    carbos:    0,
    grasas:    0,
    restricciones: [] as string[],
  });
  const [savingPlan,         setSavingPlan]         = useState(false);
  const [planDirty,          setPlanDirty]          = useState(false);
  const [savingRestr,        setSavingRestr]        = useState(false);
  const [restriccionesDirty, setRestriccionesDirty] = useState(false);

  // Plan clínico estructurado (formulario de tiempos de comida)
  const [planClinico,        setPlanClinico]        = useState<PlanClinico>(() => planClinicoInicial());
  const [savingPlanClinico,  setSavingPlanClinico]  = useState(false);
  const [planClinicoDirty,   setPlanClinicoDirty]   = useState(false);

  // Diario de comidas
  const [fotoDiario,       setFotoDiario]      = useState<FotoDiario[]>([]);
  const [cargandoDiario,   setCargandoDiario]  = useState(true);
  const [sinRevisar,       setSinRevisar]      = useState(0);
  const [carruselIdx,      setCarruselIdx]     = useState<number | null>(null); // null = cerrado
  const [marcandoRevisadas, setMarcandoRevisadas] = useState(false);

  // Notas
  const [nuevaNota,     setNuevaNota]     = useState('');
  const [sendingNota,   setSendingNota]   = useState(false);

  // InBody chart
  const [visibleMetrics, setVisibleMetrics] = useState<Set<MetricaKey>>(
    new Set<MetricaKey>(['grasa_porcentaje', 'musculo_kg', 'peso', 'agua_porcentaje']),
  );
  const [modalMedicion,  setModalMedicion]  = useState(false);
  const [savingMedicion, setSavingMedicion] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // ── Toast helper ────────────────────────────────────────────────────────────
  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Load all data ───────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [resP, resM, resN, resD] = await Promise.all([
        fetch(`/api/pacientes/${pacienteId}`),
        fetch(`/api/pacientes/${pacienteId}/mediciones`),
        fetch(`/api/pacientes/${pacienteId}/notas`),
        fetch(`/api/pacientes/${pacienteId}/diario`),
      ]);

      if (!resP.ok) {
        // Paciente no encontrado → usar datos de ejemplo
        setIsMock(true);
        setPaciente(MOCK_PACIENTE);
        setObjetivo(MOCK_PACIENTE.objetivo ?? '');
        setPadecimientos(MOCK_PACIENTE.condiciones_medicas);
        setAlergias(MOCK_PACIENTE.alergias);
        setPlan(MOCK_PLAN);
        setPlanEdit({
          calorias:     MOCK_PLAN.calorias_diarias  ?? 0,
          proteinas:    MOCK_PLAN.proteinas_g        ?? 0,
          carbos:       MOCK_PLAN.carbohidratos_g    ?? 0,
          grasas:       MOCK_PLAN.grasas_g           ?? 0,
          restricciones: MOCK_PLAN.restricciones_dieteticas ?? [],
        });
        setMediciones(MOCK_MEDICIONES);
        setNotas(MOCK_NOTAS);
        setAdherencia(72);
        setEstadoStr('Al día');
        setCargandoDiario(false);
        return;
      }

      const { paciente: p, plan: pl, adherencia: adh, estado: est } = await resP.json();
      setPaciente(p);
      setObjetivo(p.objetivo ?? '');
      setPadecimientos(p.condiciones_medicas ?? []);
      setAlergias(p.alergias ?? []);
      setAdherencia(adh ?? 0);
      setEstadoStr(est ?? '');

      if (pl) {
        setPlan(pl);
        setPlanEdit({
          calorias:      pl.calorias_diarias         ?? 0,
          proteinas:     pl.proteinas_g               ?? 0,
          carbos:        pl.carbohidratos_g           ?? 0,
          grasas:        pl.grasas_g                  ?? 0,
          restricciones: pl.restricciones_dieteticas  ?? [],
        });
        // Cargar plan clínico si existe
        if (pl.contenido_json) {
          setPlanClinico(pl.contenido_json);
        }
      }

      if (resM.ok) {
        const { data } = await resM.json();
        setMediciones(data ?? []);
      }
      if (resN.ok) {
        const { data } = await resN.json();
        setNotas(data ?? []);
      }
      if (resD.ok) {
        const { data, sinRevisar: sr } = await resD.json();
        setFotoDiario(data ?? []);
        setSinRevisar(sr ?? 0);
      }
      setCargandoDiario(false);
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Realtime + polling: sincronizar estado leída de notas ────────────────────
  useEffect(() => {
    if (!pacienteId || pacienteId === 'mock-detalle') return;

    // Helper para recargar sólo las notas desde la API
    async function refrescarNotas() {
      try {
        const res  = await fetch(`/api/pacientes/${pacienteId}/notas`);
        if (!res.ok) return;
        const json = await res.json();
        setNotas(json.data ?? []);
        console.log('[dashboard] notas actualizadas por polling/realtime');
      } catch { /* silencioso */ }
    }

    // 1. Polling cada 20 s — funciona aunque Realtime no esté habilitado en Supabase
    const intervalo = setInterval(refrescarNotas, 20_000);

    // 2. Realtime — si la tabla notas tiene replicación activa, actualiza al instante
    const supabase = createClient();
    const channel  = supabase
      .channel(`notas-paciente-${pacienteId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'notas',
          filter: `paciente_id=eq.${pacienteId}`,
        },
        (payload) => {
          console.log('[dashboard] realtime UPDATE notas:', payload.new);
          setNotas((prev) =>
            prev.map((n) =>
              n.id === (payload.new as Nota).id ? { ...n, ...(payload.new as Nota) } : n,
            ),
          );
        },
      )
      .subscribe((status) => {
        console.log('[dashboard] realtime notas status:', status);
      });

    return () => {
      clearInterval(intervalo);
      supabase.removeChannel(channel);
    };
  }, [pacienteId]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleObjetivoChange(value: string) {
    setObjetivo(value);
    if (isMock) { showToast('Modo demo — cambios no persisten', 'err'); return; }
    setSavingObj(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objetivo: value }),
      });
      if (!res.ok) throw new Error();
      showToast('Objetivo actualizado');
    } catch {
      showToast('Error al guardar objetivo', 'err');
    } finally {
      setSavingObj(false);
    }
  }

  function handleAgregarPadecimiento() {
    const trim = nuevoPad.trim();
    if (!trim || padecimientos.includes(trim)) return;
    setPadecimientos((prev) => [...prev, trim]);
    setNuevoPad('');
  }

  function handleEliminarPadecimiento(pad: string) {
    setPadecimientos((prev) => prev.filter((p) => p !== pad));
  }

  async function handleGuardarPadecimientos() {
    if (isMock) { showToast('Modo demo — cambios no persisten', 'err'); return; }
    setSavingPad(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condiciones_medicas: padecimientos }),
      });
      if (!res.ok) throw new Error();
      showToast('Padecimientos guardados');
    } catch {
      showToast('Error al guardar padecimientos', 'err');
    } finally {
      setSavingPad(false);
    }
  }

  // ── Alergias ────────────────────────────────────────────────────────────────

  function handleAgregarAlergia() {
    const trim = nuevaAlergia.trim();
    if (!trim || alergias.includes(trim)) return;
    setAlergias((prev) => [...prev, trim]);
    setNuevaAlergia('');
  }

  function handleEliminarAlergia(a: string) {
    setAlergias((prev) => prev.filter((x) => x !== a));
  }

  async function handleGuardarAlergias() {
    if (isMock) { showToast('Modo demo — cambios no persisten', 'err'); return; }
    setSavingAlergias(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alergias }),
      });
      if (!res.ok) throw new Error();
      showToast('Alergias guardadas');
    } catch {
      showToast('Error al guardar alergias', 'err');
    } finally {
      setSavingAlergias(false);
    }
  }

  async function handleGuardarPlan() {
    if (isMock) { showToast('Modo demo — cambios no persisten', 'err'); return; }
    setSavingPlan(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calorias_diarias:        planEdit.calorias   || null,
          proteinas_g:             planEdit.proteinas  || null,
          carbohidratos_g:         planEdit.carbos     || null,
          grasas_g:                planEdit.grasas     || null,
          restricciones_dieteticas: planEdit.restricciones,
        }),
      });
      if (!res.ok) throw new Error();
      setPlanDirty(false);
      setRestriccionesDirty(false);
      showToast('Plan nutricional guardado');
    } catch {
      showToast('Error al guardar el plan', 'err');
    } finally {
      setSavingPlan(false);
    }
  }

  function updatePlanField(key: keyof typeof planEdit, value: number | string[]) {
    setPlanEdit((prev) => ({ ...prev, [key]: value }));
    setPlanDirty(true);
  }

  // ── Plan clínico ─────────────────────────────────────────────────────────────

  function updateTiempo(key: TiempoKey, field: keyof TiempoComida, value: string) {
    setPlanClinico((prev) => ({
      ...prev,
      tiempos: { ...prev.tiempos, [key]: { ...prev.tiempos[key], [field]: value } },
    }));
    setPlanClinicoDirty(true);
  }

  function updatePlanClinicoField(
    field: keyof Omit<PlanClinico, 'tiempos'>,
    value: string,
  ) {
    setPlanClinico((prev) => ({ ...prev, [field]: value }));
    setPlanClinicoDirty(true);
  }

  async function handleGuardarPlanClinico() {
    if (isMock) { showToast('Modo demo — cambios no persisten', 'err'); return; }
    setSavingPlanClinico(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/plan`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ contenido_json: planClinico }),
      });
      if (!res.ok) throw new Error();
      setPlanClinicoDirty(false);
      showToast('✓ Plan guardado — ya visible para el paciente');
    } catch {
      showToast('Error al guardar el plan', 'err');
    } finally {
      setSavingPlanClinico(false);
    }
  }

  function toggleRestriccion(r: string) {
    setPlanEdit((prev) => {
      const next = prev.restricciones.includes(r)
        ? prev.restricciones.filter((x) => x !== r)
        : [...prev.restricciones, r];
      return { ...prev, restricciones: next };
    });
    setRestriccionesDirty(true);
  }

  async function handleGuardarRestricciones() {
    if (isMock) { showToast('Modo demo — cambios no persisten', 'err'); return; }
    setSavingRestr(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calorias_diarias:         planEdit.calorias   || null,
          proteinas_g:              planEdit.proteinas  || null,
          carbohidratos_g:          planEdit.carbos     || null,
          grasas_g:                 planEdit.grasas     || null,
          restricciones_dieteticas: planEdit.restricciones,
        }),
      });
      if (!res.ok) throw new Error();
      setRestriccionesDirty(false);
      showToast('Restricciones guardadas');
    } catch {
      showToast('Error al guardar las restricciones', 'err');
    } finally {
      setSavingRestr(false);
    }
  }

  async function handleEnviarNota() {
    if (!nuevaNota.trim()) return;
    if (isMock) {
      const fake: Nota = {
        id:            `nota-${Date.now()}`,
        paciente_id:   pacienteId,
        nutriologo_id: '22222222-2222-2222-2222-222222222222',
        mensaje:       nuevaNota.trim(),
        fecha:         new Date().toISOString(),
        leida:         false,
      };
      setNotas((prev) => [fake, ...prev]);
      setNuevaNota('');
      showToast('Nota enviada (demo)');
      return;
    }
    setSendingNota(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: nuevaNota }),
      });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setNotas((prev) => [data, ...prev]);
      setNuevaNota('');
      showToast('Nota enviada al paciente');
    } catch {
      showToast('Error al enviar la nota', 'err');
    } finally {
      setSendingNota(false);
    }
  }

  async function handleGuardarMedicion(m: Omit<MedicionInbody, 'id' | 'paciente_id'>) {
    if (isMock) {
      const fake: MedicionInbody = { id: `m${Date.now()}`, paciente_id: pacienteId, ...m };
      setMediciones((prev) => [...prev, fake].sort((a, b) => a.fecha.localeCompare(b.fecha)));
      setModalMedicion(false);
      showToast('Medición agregada (demo)');
      return;
    }
    setSavingMedicion(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/mediciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(m),
      });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setMediciones((prev) => [...prev, data].sort((a, b) => a.fecha.localeCompare(b.fecha)));
      setModalMedicion(false);
      showToast('Medición guardada');
    } catch {
      showToast('Error al guardar medición', 'err');
    } finally {
      setSavingMedicion(false);
    }
  }

  async function handleMarcarRevisadas() {
    if (sinRevisar === 0) return;
    setMarcandoRevisadas(true);
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/diario`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      setFotoDiario((prev) => prev.map((f) => ({ ...f, revisada: true })));
      setSinRevisar(0);
      showToast('Fotos marcadas como revisadas');
    } catch {
      showToast('Error al marcar las fotos', 'err');
    } finally {
      setMarcandoRevisadas(false);
    }
  }

  /** Abre el carrusel en el índice dado y marca todas como revisadas en el servidor. */
  function openCarrusel(idx: number) {
    setCarruselIdx(idx);
    if (sinRevisar > 0 && !isMock) {
      // Actualización optimista inmediata
      setFotoDiario((prev) => prev.map((f) => ({ ...f, revisada: true })));
      setSinRevisar(0);
      // PATCH silencioso en el fondo
      fetch(`/api/pacientes/${pacienteId}/diario`, { method: 'PATCH' })
        .catch((err) => console.error('[carrusel] mark revisadas error:', err));
    }
  }

  function toggleMetrica(key: MetricaKey) {
    setVisibleMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  // Usar estado de la API si está disponible; si no, calcularlo del porcentaje (fallback)
  const estadoLabel = estadoStr || (adherencia >= 70 ? 'Al día' : adherencia >= 40 ? 'Revisar' : 'Urgente');
  const estado      = getEstado(estadoLabel);
  const nombreCompleto = paciente ? `${paciente.nombre}${paciente.apellido ? ' ' + paciente.apellido : ''}` : '';
  const hasLeftAxis   = METRICAS.some((m) => m.axis === 'left'  && visibleMetrics.has(m.key));
  const hasRightAxis  = METRICAS.some((m) => m.axis === 'right' && visibleMetrics.has(m.key));

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-100 rounded-xl w-64" />
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (!paciente) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Mock banner ── */}
      {isMock && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-amber-500">⚠️</span>
          <p className="text-sm text-amber-700">
            <strong>Datos de ejemplo</strong> — Este paciente no existe en la base de datos.
            Los cambios no se guardarán permanentemente.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          1. HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-6 py-5">
        {/* Back link */}
        <Link
          href="/nutriologo/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-4 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver al dashboard
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
              {paciente.avatar_url
                ? <img src={paciente.avatar_url} alt={paciente.nombre} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-brand-100 text-brand-700 text-xl font-bold flex items-center justify-center">
                    {(paciente.nombre.charAt(0) + (paciente.apellido?.charAt(0) ?? '')).toUpperCase()}
                  </div>
              }
            </div>
            <div>
              {/* Nombre */}
              <h1 className="text-2xl font-bold text-slate-800 leading-tight">{nombreCompleto}</h1>
              {/* Email */}
              <p className="text-sm text-slate-400 mt-0.5">{paciente.email}</p>

              {/* Objetivo selector */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-400 font-medium">Meta:</span>
                <div className="relative">
                  <select
                    value={objetivo}
                    disabled={savingObj}
                    onChange={(e) => handleObjetivoChange(e.target.value)}
                    className="text-sm font-semibold text-brand-700 bg-brand-50 border-0 rounded-lg px-3 py-1 pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-300 appearance-none disabled:opacity-50"
                  >
                    <option value="">Sin meta definida</option>
                    {OBJETIVOS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-500" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {savingObj && <span className="text-xs text-slate-400">Guardando…</span>}
              </div>
            </div>
          </div>

          {/* Badge de estado + seguimiento */}
          <div className="flex flex-col items-end gap-2">
            <span className={cn(
              'inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full',
              estado.bg, estado.text,
            )}>
              <span className={cn('w-2 h-2 rounded-full', estado.dot)} />
              {estado.label}
            </span>
            <p className="text-xs text-slate-400">Seguimiento: <strong className="text-slate-700">{adherencia}%</strong> esta semana</p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. DATOS DEL PACIENTE
      ══════════════════════════════════════════════════════════════════════ */}
      {paciente && (paciente.sexo || paciente.estatura_cm || paciente.peso_meta_kg || paciente.nivel_actividad || paciente.ocupacion || paciente.telefono) && (
        <SectionCard title="Datos del paciente" icon="👤">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {paciente.fecha_nacimiento && (() => {
              const hoy  = new Date();
              const nac  = new Date(paciente.fecha_nacimiento!);
              let edad   = hoy.getFullYear() - nac.getFullYear();
              const m    = hoy.getMonth() - nac.getMonth();
              if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
              return (
                <div>
                  <p className="text-xs text-slate-400">Edad</p>
                  <p className="text-sm font-semibold text-slate-800">{edad} años</p>
                </div>
              );
            })()}
            {paciente.sexo && (
              <div>
                <p className="text-xs text-slate-400">Sexo</p>
                <p className="text-sm font-semibold text-slate-800 capitalize">{paciente.sexo}</p>
              </div>
            )}
            {paciente.estatura_cm && (
              <div>
                <p className="text-xs text-slate-400">Estatura</p>
                <p className="text-sm font-semibold text-slate-800">{paciente.estatura_cm} cm</p>
              </div>
            )}
            {paciente.peso_meta_kg && (
              <div>
                <p className="text-xs text-slate-400">Peso meta</p>
                <p className="text-sm font-semibold text-slate-800">{paciente.peso_meta_kg} kg</p>
              </div>
            )}
            {paciente.nivel_actividad && (
              <div>
                <p className="text-xs text-slate-400">Actividad física</p>
                <p className="text-sm font-semibold text-slate-800 capitalize">
                  {paciente.nivel_actividad.replace('_', ' ')}
                </p>
              </div>
            )}
            {paciente.ocupacion && (
              <div>
                <p className="text-xs text-slate-400">Ocupación</p>
                <p className="text-sm font-semibold text-slate-800">{paciente.ocupacion}</p>
              </div>
            )}
            {paciente.telefono && (
              <div>
                <p className="text-xs text-slate-400">Teléfono</p>
                <p className="text-sm font-semibold text-slate-800">{paciente.telefono}</p>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. INBODY
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="InBody — Evolución corporal"
        icon="📈"
        action={
          <button
            onClick={() => setModalMedicion(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <span className="text-sm leading-none">+</span> Agregar medición
          </button>
        }
      >
        {/* Toggles de métricas */}
        <div className="flex flex-wrap gap-2 mb-5">
          {METRICAS.map((m) => {
            const active = visibleMetrics.has(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMetrica(m.key)}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
                  active
                    ? 'text-white border-transparent'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300',
                )}
                style={active ? { backgroundColor: m.color, borderColor: m.color } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: active ? 'rgba(255,255,255,0.7)' : m.color }}
                />
                {m.label}
              </button>
            );
          })}
        </div>

        {mediciones.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-4xl">📊</span>
            <p className="font-medium text-slate-600">Sin mediciones registradas</p>
            <p className="text-sm text-slate-400">Agrega la primera medición InBody del paciente</p>
            <button
              onClick={() => setModalMedicion(true)}
              className="text-sm text-brand-600 hover:underline mt-1"
            >
              + Agregar primera medición
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={mediciones} margin={{ top: 5, right: hasRightAxis ? 20 : 10, bottom: 5, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="fecha"
                tickFormatter={formatFecha}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              {hasLeftAxis && (
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                  domain={['auto', 'auto']}
                  width={50}
                />
              )}
              {hasRightAxis && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  unit="kg"
                  domain={['auto', 'auto']}
                  width={50}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              {METRICAS.map((m) => (
                <Line
                  key={m.key}
                  yAxisId={m.axis}
                  type="monotone"
                  dataKey={m.key}
                  stroke={m.color}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: m.color, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  hide={!visibleMetrics.has(m.key)}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════════════
          3. PADECIMIENTOS + ALERGIAS (grid 2 columnas)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

        {/* ── Padecimientos ── */}
        <SectionCard
          title="Padecimientos"
          icon="🩺"
          action={
            <button
              onClick={handleGuardarPadecimientos}
              disabled={savingPad}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 disabled:opacity-50 transition-colors"
            >
              {savingPad ? 'Guardando…' : 'Guardar'}
            </button>
          }
        >
          {/* Chips */}
          <div className="flex flex-wrap gap-2 mb-4 min-h-[2rem]">
            {padecimientos.length === 0 && (
              <p className="text-sm text-slate-400">Sin padecimientos registrados</p>
            )}
            {padecimientos.map((pad) => (
              <span
                key={pad}
                className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 text-sm font-medium px-3 py-1.5 rounded-full"
              >
                {pad}
                <button
                  onClick={() => handleEliminarPadecimiento(pad)}
                  className="text-red-400 hover:text-red-700 leading-none ml-0.5 text-base"
                  aria-label={`Eliminar ${pad}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {/* Agregar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={nuevoPad}
              onChange={(e) => setNuevoPad(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAgregarPadecimiento()}
              placeholder="Ej: Diabetes tipo 2…"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button
              onClick={handleAgregarPadecimiento}
              disabled={!nuevoPad.trim()}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium disabled:opacity-40 transition-colors"
            >
              + Agregar
            </button>
          </div>
        </SectionCard>

        {/* ── Alergias ── */}
        <SectionCard
          title="Alergias"
          icon="⚠️"
          action={
            <button
              onClick={handleGuardarAlergias}
              disabled={savingAlergias}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 disabled:opacity-50 transition-colors"
            >
              {savingAlergias ? 'Guardando…' : 'Guardar'}
            </button>
          }
        >
          {/* Chips */}
          <div className="flex flex-wrap gap-2 mb-4 min-h-[2rem]">
            {alergias.length === 0 && (
              <p className="text-sm text-slate-400">Sin alergias registradas</p>
            )}
            {alergias.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-sm font-medium px-3 py-1.5 rounded-full"
              >
                {a}
                <button
                  onClick={() => handleEliminarAlergia(a)}
                  className="text-amber-400 hover:text-amber-700 leading-none ml-0.5 text-base"
                  aria-label={`Eliminar ${a}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {/* Agregar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={nuevaAlergia}
              onChange={(e) => setNuevaAlergia(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAgregarAlergia()}
              placeholder="Ej: Mariscos, Maní…"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button
              onClick={handleAgregarAlergia}
              disabled={!nuevaAlergia.trim()}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium disabled:opacity-40 transition-colors"
            >
              + Agregar
            </button>
          </div>
        </SectionCard>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          4. RESTRICCIONES DIETÉTICAS
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Restricciones dietéticas"
        icon="🚫"
        action={
          restriccionesDirty ? (
            <button
              onClick={handleGuardarRestricciones}
              disabled={savingRestr}
              className="text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {savingRestr ? 'Guardando…' : 'Guardar cambios'}
            </button>
          ) : (
            <span className="text-xs text-slate-400">Sin cambios pendientes</span>
          )
        }
      >
        <div className="flex flex-wrap gap-2">
          {RESTRICCIONES_OPCIONES.map((r) => {
            const active = planEdit.restricciones.includes(r);
            return (
              <button
                key={r}
                onClick={() => toggleRestriccion(r)}
                className={cn(
                  'text-sm font-medium px-3 py-1.5 rounded-full border transition-all',
                  active
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:text-brand-600',
                )}
              >
                {active && <span className="mr-1">✓</span>}{r}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════════════
          5. PLAN ALIMENTARIO CLÍNICO
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Plan alimentario clínico"
        icon="📋"
        action={
          planClinicoDirty ? (
            <button
              onClick={handleGuardarPlanClinico}
              disabled={savingPlanClinico}
              className="text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {savingPlanClinico ? 'Guardando…' : '💾 Guardar plan'}
            </button>
          ) : (
            <span className="text-xs text-slate-400">Sin cambios pendientes</span>
          )
        }
      >
        {/* ── Tabla de tiempos de comida ── */}
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-brand-50">
                <th className="text-left px-3 py-2.5 text-xs font-bold text-brand-700 uppercase tracking-wide rounded-tl-lg w-36">
                  Tiempo
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-bold text-brand-700 uppercase tracking-wide w-24">
                  Horario
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-bold text-brand-700 uppercase tracking-wide w-64">
                  Porciones por grupo
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-bold text-brand-700 uppercase tracking-wide rounded-tr-lg">
                  Ejemplo de menú
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TIEMPOS_COMIDA_CONFIG.map(({ key, label, icon }) => (
                <tr key={key} className="align-top hover:bg-slate-50 transition-colors">
                  {/* Tiempo de comida */}
                  <td className="px-3 py-3 font-medium text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{icon}</span>
                      <span className="text-sm">{label}</span>
                    </div>
                  </td>

                  {/* Horario */}
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      value={planClinico.tiempos[key].horario}
                      onChange={(e) => updateTiempo(key, 'horario', e.target.value)}
                      placeholder="7:30 AM"
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
                    />
                  </td>

                  {/* Porciones — selector interactivo por grupo de intercambio */}
                  <td className="px-3 py-3">
                    <PorcionesSelector
                      value={planClinico.tiempos[key].porciones}
                      onChange={(txt) => updateTiempo(key, 'porciones', txt)}
                      compact
                    />
                  </td>

                  {/* Ejemplo de menú */}
                  <td className="px-3 py-3">
                    <textarea
                      value={planClinico.tiempos[key].ejemplo_menu}
                      onChange={(e) => updateTiempo(key, 'ejemplo_menu', e.target.value)}
                      placeholder={`Opciones para ${label.toLowerCase()}…`}
                      rows={3}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none bg-white placeholder:text-slate-300"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Secciones de texto ── */}
        <div className="space-y-4 mt-5 border-t border-slate-100 pt-5">

          {/* Observaciones / Alimentos libres */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              📝 Observaciones / Alimentos libres
            </label>
            <textarea
              value={planClinico.observaciones}
              onChange={(e) => updatePlanClinicoField('observaciones', e.target.value)}
              placeholder="Ej: Puede consumir frutas libremente entre comidas. El agua es libre…"
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none placeholder:text-slate-300"
            />
          </div>

          {/* Restricciones especiales */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              🚫 Restricciones especiales
            </label>
            <textarea
              value={planClinico.restricciones_especiales}
              onChange={(e) => updatePlanClinicoField('restricciones_especiales', e.target.value)}
              placeholder="Ej: Los picadillos no deben llevar maíz dulce ni papa. Evitar embutidos…"
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none placeholder:text-slate-300"
            />
          </div>

          {/* Mensaje motivacional */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              🎉 Mensaje motivacional
            </label>
            <input
              type="text"
              value={planClinico.mensaje_motivacional}
              onChange={(e) => updatePlanClinicoField('mensaje_motivacional', e.target.value)}
              placeholder="Ej: ¡Felicidades! Bajaste 4.4 kg de grasa. Vas muy bien…"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-300 placeholder:text-slate-300"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Este mensaje aparecerá destacado en la pantalla de plan del paciente.
            </p>
          </div>
        </div>

        {/* ── Botón guardar al final (acceso rápido) ── */}
        {planClinicoDirty && (
          <div className="mt-5 flex justify-end">
            <button
              onClick={handleGuardarPlanClinico}
              disabled={savingPlanClinico}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
            >
              {savingPlanClinico ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  Guardando…
                </>
              ) : (
                <>💾 Guardar plan</>
              )}
            </button>
          </div>
        )}
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════════════
          6. REGISTRO DE COMIDAS
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Registro de comidas"
        icon="📸"
        action={
          sinRevisar > 0 ? (
            <button
              onClick={handleMarcarRevisadas}
              disabled={marcandoRevisadas}
              className="flex items-center gap-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {marcandoRevisadas ? 'Marcando…' : `Marcar ${sinRevisar} como revisada${sinRevisar > 1 ? 's' : ''}`}
            </button>
          ) : fotoDiario.length > 0 ? (
            <span className="text-xs text-green-600 font-medium">✓ Todo revisado</span>
          ) : undefined
        }
      >
        {cargandoDiario ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="aspect-square rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : fotoDiario.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <span className="text-3xl block mb-2">🍽️</span>
            <p className="text-sm">El paciente aún no ha subido fotos de comidas</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {fotoDiario.map((foto, i) => (
              <button
                key={foto.id}
                onClick={() => openCarrusel(i)}
                className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto.foto_url}
                  alt={foto.descripcion ?? 'Foto de comida'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                {/* Badge de fecha */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                  <p className="text-white text-[9px] leading-tight">
                    {new Date(foto.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                {/* Punto verde = no revisada */}
                {!foto.revisada && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white shadow" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Badge resumen */}
        {!cargandoDiario && fotoDiario.length > 0 && (
          <p className="text-xs text-slate-400 mt-3 text-right">
            {fotoDiario.length} foto{fotoDiario.length > 1 ? 's' : ''} en total
            {sinRevisar > 0 && (
              <span className="ml-2 text-red-500 font-semibold">· {sinRevisar} sin revisar</span>
            )}
          </p>
        )}
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════════════
          7. NOTAS DEL NUTRICIONISTA
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Notas para el paciente"
        icon="📝"
        badge={(() => {
          const noLeidas = notas.filter((n) => !n.leida).length;
          return noLeidas > 0 ? (
            <span className="min-w-[20px] h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {noLeidas}
            </span>
          ) : null;
        })()}
      >
        {/* Nueva nota */}
        <div className="space-y-3 mb-6">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Nueva nota
          </label>
          <textarea
            value={nuevaNota}
            onChange={(e) => setNuevaNota(e.target.value)}
            placeholder="Escribe un mensaje o nota para el paciente… aparecerá en su app."
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none placeholder:text-slate-300"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {nuevaNota.length > 0 ? `${nuevaNota.length} caracteres` : 'El paciente recibirá la nota en su app'}
            </span>
            <button
              onClick={handleEnviarNota}
              disabled={!nuevaNota.trim() || sendingNota}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sendingNota ? (
                'Enviando…'
              ) : (
                <>
                  <span>📨</span> Enviar nota
                </>
              )}
            </button>
          </div>
        </div>

        {/* Historial */}
        {notas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Historial</p>
            <div className="space-y-3">
              {notas.map((nota) => (
                <div
                  key={nota.id}
                  className="bg-slate-50 rounded-xl p-4 border border-slate-100 relative"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-xs text-slate-400">{formatFechaLarga(nota.fecha)}</p>
                    {nota.leida ? (
                      <span className="text-xs text-green-600 font-medium flex-shrink-0">✓ Leída</span>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium flex-shrink-0">● Sin leer</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{nota.mensaje}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {notas.length === 0 && (
          <div className="text-center py-6 text-slate-400">
            <span className="text-3xl">📭</span>
            <p className="text-sm mt-2">Sin notas enviadas aún</p>
          </div>
        )}
      </SectionCard>

      {/* ── Carrusel de fotos del diario ── */}
      {carruselIdx !== null && fotoDiario.length > 0 && (
        <CarruselDiario
          fotos={fotoDiario}
          indiceInicial={carruselIdx}
          onClose={() => setCarruselIdx(null)}
        />
      )}

      {/* ── Modal medición ── */}
      {modalMedicion && (
        <ModalMedicion
          onGuardar={handleGuardarMedicion}
          onClose={() => setModalMedicion(false)}
          saving={savingMedicion}
        />
      )}

      {/* ── Toast ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
