'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import AdminSidebar from './AdminSidebar';

const STORAGE_KEY = 'nutricr-admin-sidebar';

export default function AdminShell({
  children,
  adminEmail,
}: {
  children:   React.ReactNode;
  adminEmail: string;
}) {
  const [expanded, setExpanded] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setExpanded(stored !== null ? stored === 'true' : window.innerWidth >= 1280);
  }, []);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  function close() {
    setExpanded(false);
    localStorage.setItem(STORAGE_KEY, 'false');
  }

  const isExpanded = expanded ?? false;
  const isReady    = expanded !== null;

  return (
    <div className="h-screen bg-slate-100 overflow-hidden">
      <AdminSidebar expanded={isExpanded} animated={isReady} onToggle={toggle} />

      {/* Backdrop móvil */}
      {isExpanded && (
        <div
          className="xl:hidden fixed inset-0 bg-black/50 z-20"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Contenido */}
      <div
        className={cn(
          'flex flex-col h-screen overflow-hidden',
          'ml-0',
          isExpanded ? 'xl:ml-56' : 'xl:ml-14',
          isReady && 'transition-[margin-left] duration-300 ease-in-out',
        )}
      >
        {/* Header */}
        <header className="h-14 flex-shrink-0 bg-white border-b border-slate-200
                           flex items-center justify-between px-5">
          <button
            onClick={toggle}
            className="xl:hidden w-8 h-8 rounded-lg flex items-center justify-center
                       text-slate-500 hover:bg-slate-100 transition-colors"
          >
            ☰
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500 font-medium">Admin:</span>
            <span className="text-xs text-slate-700 font-semibold">{adminEmail}</span>
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold ml-1">
              A
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
