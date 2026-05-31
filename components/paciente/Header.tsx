'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

interface Notificacion {
  id: string;
  tipo: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
}

const pageTitles: Record<string, string> = {
  '/paciente/inicio':    'Inicio',
  '/paciente/plan':      'Mi Plan',
  '/paciente/diario':    'Diario',
  '/paciente/recetas':   'Recetas',
  '/paciente/perfil':    'Mi Perfil',
  '/paciente/despensa':  'Despensa',
  '/paciente/escanear':  'Factura',
};

function formatFecha(iso: string) {
  const d = new Date(iso);
  const ahora = new Date();
  const diffMs = ahora.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60)  return diffMin <= 1 ? 'Ahora' : `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)    return `Hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)     return `Hace ${diffD}d`;
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
}

export default function PacienteHeader() {
  const pathname = usePathname();
  const title    = pageTitles[pathname] ?? 'Nutri Smart CR';

  const [notifs,      setNotifs]      = useState<Notificacion[]>([]);
  const [noLeidas,    setNoLeidas]    = useState(0);
  const [showModal,   setShowModal]   = useState(false);
  const [marcando,    setMarcando]    = useState(false);

  const cargarNotifs = useCallback(async () => {
    try {
      const res  = await fetch('/api/notificaciones');
      if (!res.ok) return;
      const json = await res.json();
      setNotifs(json.data ?? []);
      setNoLeidas(json.noLeidas ?? 0);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { cargarNotifs(); }, [cargarNotifs]);

  async function abrirModal() {
    setShowModal(true);
    if (noLeidas === 0) return;

    // Marcar todas como leídas optimistamente
    setNoLeidas(0);
    setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));

    setMarcando(true);
    try {
      await fetch('/api/notificaciones', { method: 'PATCH', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } });
    } catch { /* silencioso */ } finally {
      setMarcando(false);
    }
  }

  return (
    <>
      <header className="bg-white border-b border-slate-100 px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center sticky top-0 z-10">
        {/* Izquierda: marca */}
        <span className="font-bold text-brand-700 truncate">Nutri Smart CR</span>

        {/* Centro: título de la página — nunca se solapa con los extremos */}
        <h1 className="text-center font-semibold text-slate-700 text-sm px-2 whitespace-nowrap">
          {title}
        </h1>

        {/* Derecha: campana de notificaciones */}
        <div className="flex justify-end">
          <button
            onClick={abrirModal}
            className="relative w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Notificaciones"
          >
            🔔
            {noLeidas > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {noLeidas > 9 ? '9+' : noLeidas}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Modal de notificaciones ── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-800">Notificaciones</h2>
                {marcando && <p className="text-xs text-slate-400 mt-0.5">Marcando como leídas…</p>}
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 text-xl"
              >
                ×
              </button>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1">
              {notifs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <span className="text-4xl block mb-3">🔕</span>
                  <p className="text-sm font-medium">Sin notificaciones</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {notifs.map((n) => (
                    <li
                      key={n.id}
                      className={`px-5 py-4 ${!n.leida ? 'bg-brand-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl mt-0.5 flex-shrink-0">
                          {n.tipo === 'nota' ? '📝' : '🔔'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 leading-relaxed">{n.mensaje}</p>
                          <p className="text-xs text-slate-400 mt-1">{formatFecha(n.created_at)}</p>
                        </div>
                        {!n.leida && (
                          <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
