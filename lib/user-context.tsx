'use client';

/**
 * user-context.tsx
 * ─────────────────
 * Contexto de usuario autenticado — avatar_url, iniciales, nombre completo.
 *
 * Re-exporta desde context/AvatarContext.tsx para mantener un único
 * proveedor de estado (evitar duplicar fetches y estado desincronizado).
 *
 * Usar en cualquier componente:
 *   import { useAvatar } from '@/lib/user-context';
 *   const { avatarUrl, iniciales, nombreCompleto, setAvatarUrl } = useAvatar();
 */

export { AvatarProvider, useAvatar } from '@/context/AvatarContext';
