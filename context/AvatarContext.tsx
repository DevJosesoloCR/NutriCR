'use client';

/**
 * AvatarContext
 * ─────────────
 * Estado global del avatar + datos básicos del usuario autenticado.
 * Compartido entre Header, Sidebar, BottomNav y páginas de perfil.
 *
 * Persistencia:
 *   Los datos se cargan desde la tabla `usuarios` (no de localStorage ni del
 *   JWT cacheado) para que sobrevivan logout/login.  Además se escucha
 *   onAuthStateChange para re-cargar cuando la sesión cambia (SIGNED_IN /
 *   TOKEN_REFRESHED), resolviendo el caso en que el contexto se montara
 *   antes de que las cookies de auth estuvieran disponibles.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AvatarCtx {
  avatarUrl:      string | null;
  iniciales:      string;
  nombreCompleto: string;
  /** Actualizar la URL en el contexto (ej. justo después de subir una foto) */
  setAvatarUrl:   (url: string | null) => void;
  /** Forzar recarga desde la DB (útil tras editar el perfil en otra pestaña) */
  refetch:        () => void;
}

const defaultCtx: AvatarCtx = {
  avatarUrl:      null,
  iniciales:      '',
  nombreCompleto: '',
  setAvatarUrl:   () => {},
  refetch:        () => {},
};

const Ctx = createContext<AvatarCtx>(defaultCtx);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AvatarProvider({ children }: { children: ReactNode }) {
  const [avatarUrl,      setAvatarUrl]      = useState<string | null>(null);
  const [iniciales,      setIniciales]      = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');

  // Carga los datos del usuario desde la DB (tabla usuarios vía /api/user/me)
  const loadFromDB = useCallback(async () => {
    try {
      const res = await fetch('/api/user/me');
      if (!res.ok) return; // 401 = no autenticado todavía, ignorar silenciosamente
      const json = await res.json();
      if (!json?.data) return;

      const nombre:     string | null = json.data.nombre     ?? null;
      const apellido:   string | null = json.data.apellido   ?? null;
      const avatar_url: string | null = json.data.avatar_url ?? null;

      if (nombre) {
        setIniciales(
          (nombre.charAt(0) + (apellido?.charAt(0) ?? '')).toUpperCase(),
        );
        setNombreCompleto(`${nombre}${apellido ? ' ' + apellido : ''}`);
      }

      // Siempre actualizar avatarUrl (incluso si null: puede que la foto haya sido borrada)
      setAvatarUrl(avatar_url);
    } catch { /* silencioso — fallos de red no deben crashear la UI */ }
  }, []);

  useEffect(() => {
    // ── Carga inicial ──────────────────────────────────────────────────────
    loadFromDB();

    // ── Listener de cambios de sesión ──────────────────────────────────────
    // Re-carga los datos cada vez que la sesión cambia.  Esto resuelve el
    // problema de persistencia: si el usuario cierra sesión y vuelve a entrar,
    // el contexto recarga avatar_url desde la DB en vez de quedarse vacío.
    //
    // Pequeño delay en SIGNED_IN: las cookies de sesión se propagan al servidor
    // en la siguiente request; esperar ~200 ms garantiza que /api/user/me
    // reciba el header Authorization correcto.
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTimeout(loadFromDB, 200);
      }
      if (event === 'SIGNED_OUT') {
        // Limpiar estado al cerrar sesión
        setAvatarUrl(null);
        setIniciales('');
        setNombreCompleto('');
      }
    });

    return () => subscription.unsubscribe();
  }, [loadFromDB]);

  return (
    <Ctx.Provider value={{
      avatarUrl,
      iniciales,
      nombreCompleto,
      setAvatarUrl,
      refetch: loadFromDB,
    }}>
      {children}
    </Ctx.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAvatar() {
  return useContext(Ctx);
}
