'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface AlertaNutriologo {
  id:      string;
  nombre:  string;
  tipo:    'urgente' | 'revisar' | 'nuevo';
  mensaje: string;
}

const pageTitles: Record<string, string> = {
  '/nutriologo/dashboard':  'Dashboard',
  '/nutriologo/pacientes':  'Pacientes',
  '/nutriologo/planes':     'Planes Nutricionales',
  '/nutriologo/inventario': 'Inventario',
  '/nutriologo/recetas':    'Recetas con IA',
  '/nutriologo/perfil':     'Mi Perfil',
};

const TIPO_COLOR: Record<AlertaNutriologo['tipo'], string> = {
  urgente: 'text-red-500',
  revisar: 'text-amber-500',
  nuevo:   'text-green-500',
};

const TIPO_EMOJI: Record<AlertaNutriologo['tipo'], string> = {
  urgente: '🔴',
  revisar: '🟡',
  nuevo:   '🟢',
};

interface NutriHeaderProps {
  onToggle: () => void;
}

export default function NutriHeader({ onToggle }: NutriHeaderProps) {
  const pathname = usePathname();
  const title    = pageTitles[pathname] ?? 'Nutri Smart CR';

  // ── Usuario / avatar ────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [iniciales, setIniciales] = useState('N');

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const nombre   = user.user_metadata?.nombre    as string | undefined;
      const apellido = user.user_metadata?.apellido  as string | undefined;
      const avatar   = user.user_metadata?.avatar_url as string | undefined;
      if (nombre) setIniciales((nombre.charAt(0) + (apellido?.charAt(0) ?? '')).toUpperCase());
      if (avatar) setAvatarUrl(avatar);
    });
  }, []);

  // ── Alertas / notificaciones ────────────────────────────────────────────────
  const [showNotifs, setShowNotifs] = useState(false);
  const [alertas,    setAlertas]    = useState<AlertaNutriologo[]>([]);
  const [cargando,   setCargando]   = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const cargarAlertas = useCallback(async () => {
    setCargando(true);
    try {
      const res  = await fetch('/api/nutriologo/alertas');
      if (!res.ok) return;
      const json = await res.json();
      setAlertas(json.alertas ?? []);
    } catch { /* silencioso */ }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargarAlertas(); }, [cargarAlertas]);

  // Cerrar panel al hacer clic fuera
  useEffect(() => {
    if (!showNotifs) return;
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showNotifs]);

  const urgentes = alertas.filter((a) => a.tipo === 'urgente').length;

  return (
    <header className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center gap-3 flex-shrink-0">

      {/* Hamburger */}
      <button
        onClick={onToggle}
        className="xl:hidden flex flex-col gap-1.5 p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        aria-label="Abrir menú"
      >
        <span className="block w-5 h-0.5 bg-current rounded-full" />
        <span className="block w-5 h-0.5 bg-current rounded-full" />
        <span className="block w-5 h-0.5 bg-current rounded-full" />
      </button>

      {/* Título */}
      <h2 className="flex-1 font-semibold text-slate-800 text-base">{title}</h2>

      {/* Acciones */}
      <div className="flex items-center gap-1.5">

        {/* ── Campana de notificaciones ── */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setShowNotifs((v) => !v)}
            className="relative w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Notificaciones"
          >
            <span className="text-2xl leading-none">🔔</span>
            {urgentes > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {urgentes > 9 ? '9+' : urgentes}
              </span>
            )}
          </button>

          {/* Panel de notificaciones */}
          {showNotifs && (
            <div className="absolute right-0 top-13 mt-1 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">Alertas de pacientes</h3>
                <button
                  onClick={() => { setShowNotifs(false); cargarAlertas(); }}
                  className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                >
                  Actualizar
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {cargando ? (
                  <div className="space-y-2 p-3">
                    {[1,2,3].map((i) => (
                      <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : alertas.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <span className="text-3xl block mb-2">✅</span>
                    <p className="text-sm font-medium">Todos los pacientes al día</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {alertas.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/nutriologo/pacientes/${a.id}`}
                          onClick={() => setShowNotifs(false)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <span className="text-lg flex-shrink-0 mt-0.5">{TIPO_EMOJI[a.tipo]}</span>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold ${TIPO_COLOR[a.tipo]}`}>
                              {a.tipo === 'urgente' ? 'Urgente' : a.tipo === 'revisar' ? 'Revisar' : 'Nuevo paciente'}
                            </p>
                            <p className="text-sm font-medium text-slate-800 truncate">{a.nombre}</p>
                            <p className="text-xs text-slate-400">{a.mensaje}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {alertas.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-100 text-center">
                  <Link
                    href="/nutriologo/pacientes"
                    onClick={() => setShowNotifs(false)}
                    className="text-xs text-brand-600 hover:text-brand-800 font-semibold"
                  >
                    Ver todos los pacientes →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Avatar → perfil ── */}
        <Link
          href="/nutriologo/perfil"
          className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 hover:ring-2 hover:ring-brand-300 transition-all"
          aria-label="Mi perfil"
          title="Mi perfil"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-xl" />
          ) : (
            <div className="w-full h-full rounded-xl bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{iniciales}</span>
            </div>
          )}
        </Link>
      </div>
    </header>
  );
}
