'use client';

/**
 * AvatarContext
 * ─────────────
 * Estado global del avatar del usuario autenticado.
 * Shared entre Header, Sidebar, BottomNav y las páginas de perfil para que
 * un upload de foto se refleje inmediatamente en toda la UI sin recargar.
 *
 * Se monta una vez por layout (paciente / nutriólogo) mediante <AvatarProvider>.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

interface AvatarCtx {
  avatarUrl:      string | null;
  iniciales:      string;
  nombreCompleto: string;
  /** Actualizar la URL después de subir una foto nueva */
  setAvatarUrl:   (url: string | null) => void;
}

const defaultCtx: AvatarCtx = {
  avatarUrl:      null,
  iniciales:      '',
  nombreCompleto: '',
  setAvatarUrl:   () => {},
};

const Ctx = createContext<AvatarCtx>(defaultCtx);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AvatarProvider({ children }: { children: ReactNode }) {
  const [avatarUrl,      setAvatarUrl]      = useState<string | null>(null);
  const [iniciales,      setIniciales]      = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');

  useEffect(() => {
    fetch('/api/user/me')
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!json?.data) return;
        const nombre: string | null    = json.data.nombre    ?? null;
        const apellido: string | null  = json.data.apellido  ?? null;
        const avatar_url: string | null = json.data.avatar_url ?? null;
        if (nombre) {
          setIniciales((nombre.charAt(0) + (apellido?.charAt(0) ?? '')).toUpperCase());
          setNombreCompleto(`${nombre}${apellido ? ' ' + apellido : ''}`);
        }
        if (avatar_url) setAvatarUrl(avatar_url);
      })
      .catch(() => {});
  }, []);

  return (
    <Ctx.Provider value={{ avatarUrl, iniciales, nombreCompleto, setAvatarUrl }}>
      {children}
    </Ctx.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAvatar() {
  return useContext(Ctx);
}
