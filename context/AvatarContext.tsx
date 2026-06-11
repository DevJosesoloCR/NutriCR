'use client';

/**
 * AvatarContext
 * ─────────────
 * Estado global del avatar + datos básicos del usuario autenticado.
 * Compartido entre Header, Sidebar, BottomNav y páginas de perfil.
 *
 * Estrategia de persistencia (3 capas):
 *
 * 1. localStorage  → muestra el avatar en el primer render sin parpadeo.
 *    La clave "nutricr_avatar_url" se actualiza cada vez que setAvatarUrl se llama.
 *
 * 2. Supabase browser client (getSession + query directa)
 *    → NO depende de cookies de sesión; lee desde localStorage/IndexedDB.
 *    Esto resuelve el caso de PWA reabierta: las cookies pueden estar vencidas
 *    pero el token en localStorage se refresca automáticamente.
 *
 * 3. onAuthStateChange (INITIAL_SESSION | SIGNED_IN | TOKEN_REFRESHED)
 *    → recarga en cuanto la sesión esté disponible, sin importar cuándo se monta
 *    el proveedor respecto al ciclo de auth del cliente Supabase.
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
  setAvatarUrl:   (url: string | null) => void;
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

// ── Clave de caché ────────────────────────────────────────────────────────────
const CACHE_KEY = 'nutricr_avatar_url';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AvatarProvider({ children }: { children: ReactNode }) {

  // Inicializar desde localStorage para que el avatar aparezca sin parpadeo
  const [avatarUrl, _setAvatarUrl] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CACHE_KEY);
  });
  const [iniciales,      setIniciales]      = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');

  /** setAvatarUrl mantiene localStorage sincronizado */
  const setAvatarUrl = useCallback((url: string | null) => {
    _setAvatarUrl(url);
    if (typeof window !== 'undefined') {
      if (url) localStorage.setItem(CACHE_KEY, url);
      else     localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  /**
   * Carga nombre, apellido y avatar_url desde la tabla `usuarios`.
   * Usa el cliente Supabase del BROWSER (lee sesión desde localStorage/IndexedDB),
   * por lo que funciona aunque las cookies de sesión estén vencidas.
   */
  const loadFromDB = useCallback(async () => {
    try {
      const supabase = createClient();

      // getSession() lee del almacenamiento local — no hace fetch al servidor
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('usuarios') as any)
        .select('nombre, apellido, avatar_url')
        .eq('id', session.user.id)
        .single();

      if (!data) return;

      const nombre:     string | null = data.nombre     ?? null;
      const apellido:   string | null = data.apellido   ?? null;
      const avatar_url: string | null = data.avatar_url ?? null;

      if (nombre) {
        setIniciales(
          (nombre.charAt(0) + (apellido?.charAt(0) ?? '')).toUpperCase(),
        );
        setNombreCompleto(`${nombre}${apellido ? ' ' + apellido : ''}`);
      }

      // Actualiza avatar Y localStorage
      setAvatarUrl(avatar_url);

    } catch { /* silencioso — fallos de red no deben crashear la UI */ }
  }, [setAvatarUrl]);

  useEffect(() => {
    // ── Carga inicial ──────────────────────────────────────────────────────
    loadFromDB();

    // ── Listener de cambios de sesión ──────────────────────────────────────
    // INITIAL_SESSION: se dispara cuando el cliente Supabase restaura una
    //   sesión existente en localStorage al abrir la app (PWA reabierta).
    // SIGNED_IN / TOKEN_REFRESHED: login y renovación de token.
    // SIGNED_OUT: limpiar estado y caché.
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN'       ||
        event === 'TOKEN_REFRESHED'
      ) {
        // Pequeño delay para que el token se persista antes de la query
        setTimeout(loadFromDB, 100);
      }
      if (event === 'SIGNED_OUT') {
        _setAvatarUrl(null);
        setIniciales('');
        setNombreCompleto('');
        if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY);
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
