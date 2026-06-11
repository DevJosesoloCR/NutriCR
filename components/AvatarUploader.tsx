'use client';

/**
 * AvatarUploader
 * ──────────────
 * Componente unificado para cambiar la foto de perfil.
 * Compartido entre el perfil del paciente y del nutricionista.
 *
 * Flujo:
 *   1. Clic en círculo / botón "Cambiar foto" → file input
 *   2. FileReader.readAsDataURL → data-URL (no expira)
 *   3. ImageCropper modal (portal en document.body → escapa overflow:hidden del layout)
 *   4. canvas.toBlob → Blob JPEG ≤ 512 px
 *   5. POST /api/user/avatar con multipart/form-data
 *      → servidor sube a Storage y actualiza usuarios.avatar_url
 *        con admin client (bypass de RLS → actualización garantizada)
 *   6. onUploadSuccess(url) → el padre actualiza el contexto global
 *
 * Props explícitas (sin dependencia interna de AvatarContext):
 *   userId           – ID del usuario. null mientras el auth carga → deshabilita upload
 *   currentAvatarUrl – URL guardada en DB / contexto (fuente de verdad)
 *   iniciales        – Texto fallback cuando no hay foto
 *   onUploadSuccess  – Callback con la nueva URL pública al completar
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal }               from 'react-dom';
import dynamic                        from 'next/dynamic';

// Carga dinámica: react-easy-crop usa APIs del browser; nunca SSR.
// El import dinámico siempre es a nivel de módulo para que el chunk
// empiece a descargarse en cuanto el componente se monta (aunque el
// modal aún no esté abierto).
const ImageCropper = dynamic(
  () => import('@/components/shared/ImageCropper'),
  { ssr: false },
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvatarUploaderProps {
  /** ID del usuario autenticado. null mientras el estado de auth aún carga */
  userId:           string | null;
  /** URL del avatar en DB / contexto. null = sin foto, mostrar iniciales */
  currentAvatarUrl: string | null;
  /** Texto de fallback cuando no hay foto (ej: "JG", "N") */
  iniciales:        string;
  /**
   * Se llama con la URL pública nueva cuando el upload y la actualización
   * en la tabla usuarios son exitosos. El padre debe llamar setAvatarUrl(url).
   */
  onUploadSuccess:  (url: string) => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r     = new FileReader();
    r.onloadend = () =>
      typeof r.result === 'string' ? resolve(r.result) : reject(new Error('read error'));
    r.onerror   = () => reject(new Error('read error'));
    r.readAsDataURL(blob);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AvatarUploader({
  userId,
  currentAvatarUrl,
  iniciales,
  onUploadSuccess,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // isMounted: true solo en el cliente — createPortal necesita document.body
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [cropSrc,   setCropSrc]   = useState<string | null>(null);
  const [localUrl,  setLocalUrl]  = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imgError,  setImgError]  = useState(false);

  // ── Selección de archivo ────────────────────────────────────────────────
  // FileReader.readAsDataURL produce un data: URL autocontenido que no expira,
  // a diferencia de blob: URLs creados con URL.createObjectURL.
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader     = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
        setCropSrc(reader.result);
      }
    };
    reader.readAsDataURL(file);
    // No resetear e.target.value aquí: en Safari puede invalidar el File
    // antes de que FileReader termine de leer.
  }

  // ── Confirmar recorte ───────────────────────────────────────────────────
  async function handleCropConfirm(blob: Blob) {
    setCropSrc(null); // cierra el cropper de inmediato

    // Preview local mientras se sube
    blobToDataUrl(blob).then(setLocalUrl).catch(() => {});

    setUploading(true);
    try {
      // POST /api/user/avatar — el servidor usa admin client (bypass RLS).
      // Esto garantiza que usuarios.avatar_url se actualice correctamente
      // independientemente de las políticas de RLS del cliente.
      const fd = new FormData();
      fd.append('file', blob, 'avatar.jpg');

      const res  = await fetch('/api/user/avatar', { method: 'POST', body: fd });
      const json = await res.json() as { url?: string; error?: string };

      if (!res.ok) throw new Error(json.error ?? `Error HTTP ${res.status}`);
      if (!json.url) throw new Error('Respuesta sin URL');

      onUploadSuccess(json.url);
      setImgError(false);
    } catch (err) {
      console.error('[AvatarUploader] Error al subir avatar:', err);
    } finally {
      setUploading(false);
      setLocalUrl(null); // la URL definitiva ya viene del contexto vía onUploadSuccess
    }
  }

  // ── Qué mostrar en el círculo ───────────────────────────────────────────
  // Prioridad: preview local (mientras sube) → avatarUrl de prop → iniciales
  const foto    = localUrl ?? (imgError ? null : currentAvatarUrl);
  const canEdit = !!userId && !uploading;

  return (
    <>
      {/*
        ImageCropper via portal → se renderiza en document.body, fuera del
        árbol DOM del layout padre.  NutriShell apila tres niveles de
        overflow:hidden que en ciertos navegadores (Chrome PWA, iOS Safari)
        interfieren con position:fixed.  El portal los evita por completo.
        El patrón es transparente para el layout del paciente.
      */}
      {cropSrc && isMounted && createPortal(
        <ImageCropper
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />,
        document.body,
      )}

      <div className="flex flex-col items-center gap-3">

        {/* ── Círculo 100 px ── */}
        <div
          className="relative w-[100px] h-[100px] rounded-full overflow-hidden
                     flex-shrink-0 cursor-pointer group"
          onClick={() => canEdit && inputRef.current?.click()}
          role="button"
          aria-label="Cambiar foto de perfil"
          title={canEdit ? 'Cambiar foto' : undefined}
        >
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={foto}
              src={foto}
              alt=""
              className="w-full h-full object-cover"
              onError={() => { if (!localUrl) setImgError(true); }}
            />
          ) : (
            <div className="w-full h-full bg-brand-600 flex items-center justify-center
                            text-3xl font-bold text-white select-none">
              {iniciales || 'U'}
            </div>
          )}

          {/* Overlay hover */}
          {canEdit && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100
                            transition-opacity flex items-center justify-center
                            pointer-events-none">
              <span className="text-white text-2xl">📷</span>
            </div>
          )}

          {/* Spinner durante el upload */}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <svg className="animate-spin h-7 w-7 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          )}
        </div>

        {/* ── Botón de texto ── */}
        <button
          type="button"
          onClick={() => canEdit && inputRef.current?.click()}
          disabled={!canEdit}
          className="text-sm text-brand-600 hover:text-brand-800 font-medium
                     transition-colors disabled:opacity-40"
        >
          {uploading ? 'Subiendo…' : 'Cambiar foto'}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </>
  );
}
