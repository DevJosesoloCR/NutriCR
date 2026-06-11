'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAvatar } from '@/context/AvatarContext';

// ─── Config ───────────────────────────────────────────────────────────────────

const NAV_ITEMS: { href?: string; label: string; icon: string; fab?: boolean }[] = [
  { href: '/paciente/inicio',   label: 'Inicio',   icon: '🏠' },
  { href: '/paciente/plan',     label: 'Plan',     icon: '📋' },
  { fab:  true,                 label: 'Registro', icon: '➕' },
  { href: '/paciente/despensa', label: 'Despensa', icon: '🥫' },
  { href: '/paciente/perfil',   label: 'Perfil',   icon: '👤' },
];

// Arc positions relative to the FAB center (dx = horizontal, dy = vertical)
// Negative dy = up (screen Y increases downward)
const ARC_OPTIONS = [
  { href: '/paciente/escanear', icon: '🧾', label: 'Factura', dx: -92, dy: -96 },
  { href: '/paciente/diario',   icon: '📸', label: 'Comida',  dx:  92, dy: -96 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const fabRef   = useRef<HTMLButtonElement>(null);
  const { avatarUrl, iniciales } = useAvatar();

  const [open,   setOpen]   = useState(false);
  const [fabPos, setFabPos] = useState({ x: 0, y: 0 });

  // Routes covered by this FAB
  const fabActive = pathname === '/paciente/escanear' || pathname === '/paciente/diario';

  // Measure the FAB's screen position so arc buttons bloom from its exact center
  function toggleOpen() {
    if (!open && fabRef.current) {
      const r = fabRef.current.getBoundingClientRect();
      setFabPos({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    setOpen((v) => !v);
  }

  function handleArcClick(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      {/* ── Overlay ───────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-30 bg-black/50 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setOpen(false)}
      />

      {/* ── Arc buttons (bloom from FAB center) ───────────────────────────── */}
      {ARC_OPTIONS.map((btn) => (
        <div
          key={btn.href}
          style={{
            position:      'fixed',
            top:            fabPos.y,
            left:           fabPos.x,
            zIndex:         40,
            pointerEvents:  open ? 'auto' : 'none',
            // Spring easing: scale + translate out from FAB center
            transform: open
              ? `translate(calc(-50% + ${btn.dx}px), calc(-50% + ${btn.dy}px)) scale(1)`
              : 'translate(-50%, -50%) scale(0)',
            opacity:    open ? 1 : 0,
            transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 180ms ease',
          }}
        >
          <button
            onClick={() => handleArcClick(btn.href)}
            className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            {/* Circle */}
            <div className="w-20 h-20 rounded-full bg-white shadow-2xl border border-white/60 flex items-center justify-center text-4xl">
              {btn.icon}
            </div>
            {/* Label */}
            <span
              className="text-xs font-bold text-white"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
            >
              {btn.label}
            </span>
          </button>
        </div>
      ))}

      {/* ── Nav bar ───────────────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-100 safe-bottom z-20">
        <div className="flex items-end">
          {NAV_ITEMS.map((item, idx) => {

            /* ── FAB ── */
            if (item.fab) {
              return (
                <button
                  key="fab"
                  ref={fabRef}
                  onClick={toggleOpen}
                  className="flex-1 flex flex-col items-center pb-2 -mt-5"
                >
                  <span
                    className={cn(
                      'w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg',
                      'transition-all duration-200',
                      open || fabActive
                        ? 'bg-brand-700 scale-110 rotate-45'
                        : 'bg-brand-600',
                    )}
                  >
                    ➕
                  </span>
                  <span className={cn(
                    'text-xs font-medium mt-1 transition-colors',
                    open || fabActive ? 'text-brand-700' : 'text-slate-400',
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            }

            /* ── Regular nav link ── */
            if (!item.href) return null;
            const active = pathname === item.href;
            const isPerfil = item.href === '/paciente/perfil';
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center py-2.5 text-xs font-medium transition-colors',
                  active ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600',
                )}
              >
                {isPerfil ? (
                  /* Avatar circular en vez del ícono 👤 */
                  <div className={cn(
                    'w-[22px] h-[22px] rounded-full overflow-hidden mb-0.5 flex-shrink-0 flex-shrink-0',
                    active && 'ring-2 ring-brand-400',
                  )}>
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : iniciales ? (
                      <div className="w-full h-full bg-brand-600 flex items-center justify-center
                                      text-[8px] font-bold text-white leading-none">
                        {iniciales}
                      </div>
                    ) : (
                      <span className="text-xl leading-none">{item.icon}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xl mb-0.5">{item.icon}</span>
                )}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
