'use client';

/**
 * AvatarUpload
 * ─────────────
 * Componente compartido para subir/cambiar la foto de perfil.
 * Usado en el perfil del paciente y del nutricionista.
 *
 * Flujo:
 *   1. Clic en "Cambiar foto" → file input
 *   2. Seleccionar archivo → FileReader genera data-URL → ImageCropper se abre
 *   3. Usuario ajusta recorte → "Confirmar recorte" → Blob JPEG creado
 *   4. ImageCropper se cierra → preview local muestra el recorte mientras sube
 *   5. Upload a /api/user/avatar → actualiza AvatarContext (persiste en toda la UI)
 *   6. Preview local se descarta; el contexto tiene la URL final
 */

import { useState, useRef }     from 'react';
import dynamic                  from 'next/dynamic';
import { useAvatar }            from '@/context/AvatarContext';

// Importación dinámica para evitar SSR (react-easy-crop usa APIs del browser)
const ImageCropper = dynamic(() => import('./ImageCropper'), { ssr: false });

// ── Helper: Blob → data-URL ───────────────────────────────────────────────────

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r      = new FileReader();
    r.onloadend  = () => typeof r.result === 'string' ? resolve(r.result) : reject();
    r.onerror    = reject;
    r.readAsDataURL(blob);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Iniciales del usuario para el fallback cuando no hay foto */
  iniciales: string;
}

export default function AvatarUpload({ iniciales }: Props) {
  const inputRef               = useRef<HTMLInputElement>(null);
  const { avatarUrl, setAvatarUrl } = useAvatar();

  const [cropSrc,  setCropSrc]  = useState<string | null>(null); // data-URL para el cropper
  const [localUrl, setLocalUrl] = useState<string | null>(null); // preview post-crop mientras sube
  const [subiendo, setSubiendo] = useState(false);
  const [imgError, setImgError] = useState(false);               // avatarUrl guardada está rota

  // ── Al seleccionar un archivo ─────────────────────────────────────────────
  // Usamos FileReader.readAsDataURL (produce un data: URL autocontenido que
  // NO expira, a diferencia de blob: URLs creados con URL.createObjectURL).
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
    // No reseteamos e.target.value aquí porque puede invalidar el File en Safari
    // antes de que el FileReader termine de leer.
  }

  // ── Al confirmar el recorte ───────────────────────────────────────────────
  async function handleCropConfirm(blob: Blob) {
    setCropSrc(null); // cierra el cropper

    // Preview local inmediato (data-URL del recorte)
    try {
      setLocalUrl(await blobToDataUrl(blob));
    } catch { /* sin preview local, no es crítico */ }

    // Upload
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('file', blob, 'avatar.jpg');
      const res  = await fetch('/api/user/avatar', { method: 'POST', body: fd });
      const json = await res.json() as { url?: string };
      if (res.ok && json.url) {
        setAvatarUrl(json.url); // actualiza contexto global → se refleja en Header/Sidebar/BottomNav
        setImgError(false);
      }
    } catch { /* silencioso */ }
    finally {
      setSubiendo(false);
      setLocalUrl(null); // el contexto ya tiene la URL nueva
    }
  }

  // ── Qué mostrar en el círculo ─────────────────────────────────────────────
  // Prioridad: preview local (mientras sube) → avatarUrl del contexto → iniciales
  const foto = localUrl ?? (imgError ? null : avatarUrl);

  return (
    <>
      {/* Cropper modal — full-screen, z-60 */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <div className="flex flex-col items-center gap-3">

        {/* ── Círculo 100 px ── */}
        <div
          className="relative w-[100px] h-[100px] rounded-full overflow-hidden flex-shrink-0
                     cursor-pointer group"
          onClick={() => !subiendo && inputRef.current?.click()}
          role="button"
          aria-label="Cambiar foto de perfil"
          title="Cambiar foto"
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
              {iniciales || 'N'}
            </div>
          )}

          {/* Overlay hover (📷) */}
          {!subiendo && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100
                            transition-opacity flex items-center justify-center pointer-events-none">
              <span className="text-white text-2xl">📷</span>
            </div>
          )}

          {/* Spinner mientras sube */}
          {subiendo && (
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
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="text-sm text-brand-600 hover:text-brand-800 font-medium
                     transition-colors disabled:opacity-50"
        >
          {subiendo ? 'Subiendo…' : 'Cambiar foto'}
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
