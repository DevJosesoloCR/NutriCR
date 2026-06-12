'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin',               label: 'Dashboard',       icon: '📊' },
  { href: '/admin/nutricionistas', label: 'Nutricionistas',  icon: '👩‍⚕️' },
  { href: '/admin/pacientes',      label: 'Pacientes',       icon: '🧑‍🤝‍🧑' },
  { href: '/admin/actividad',      label: 'Actividad',       icon: '⚡' },
];

export default function AdminSidebar({
  expanded,
  animated,
  onToggle,
}: {
  expanded:  boolean;
  animated:  boolean;
  onToggle:  () => void;
}) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-30 flex flex-col',
        'bg-slate-900 border-r border-slate-700/60',
        expanded ? 'w-56' : 'w-14',
        animated && 'transition-[width] duration-300 ease-in-out',
      )}
    >
      {/* Logo / Toggle */}
      <div className={cn(
        'flex items-center h-14 px-3 border-b border-slate-700/60 flex-shrink-0',
        expanded ? 'gap-3' : 'justify-center',
      )}>
        <button
          onClick={onToggle}
          aria-label={expanded ? 'Colapsar menú' : 'Expandir menú'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400
                     hover:bg-slate-800 hover:text-white transition-colors flex-shrink-0"
        >
          {expanded ? '◀' : '▶'}
        </button>
        {expanded && (
          <div className="min-w-0">
            <span className="text-white font-bold text-sm leading-tight block truncate">
              Admin Panel
            </span>
            <span className="text-slate-500 text-[10px] leading-tight block truncate">
              NutriCR
            </span>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 space-y-0.5 px-1.5 overflow-y-auto">
        {NAV.map(({ href, label, icon }) => {
          // Exact match for dashboard, starts-with for the rest
          const active = href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={!expanded ? label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                !expanded && 'justify-center px-0',
              )}
            >
              <span className="text-base leading-none flex-shrink-0">{icon}</span>
              {expanded && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer: sign out */}
      <div className="px-1.5 pb-4 border-t border-slate-700/60 pt-3 flex-shrink-0">
        <button
          onClick={handleSignOut}
          title={!expanded ? 'Cerrar sesión' : undefined}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium',
            'text-slate-400 hover:bg-red-900/60 hover:text-red-300 transition-colors',
            !expanded && 'justify-center px-0',
          )}
        >
          <span className="text-base flex-shrink-0">🚪</span>
          {expanded && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
