'use client';

/**
 * AvatarUploader
 * ──────────────
 * Componente unificado para cambiar la foto de perfil.
 * Compartido entre paciente y nutricionista.
 *
 * Soporta: JPG, PNG, WEBP, GIF, HEIC, HEIF (y cualquier formato nativo del browser).
 *
 * Flujo:
 *   1. "Subir foto" → file input (accept="image/*,.heic,.heif")
 *   2. Conversión inmediata a JPEG:
 *      - HEIC/HEIF → heic2any (importación dinámica, solo cuando se necesita)
 *                    → canvas resize máx 400×400, calidad 0.85
 *      - Otros      → canvas resize directamente
 *      Muestra "Procesando imagen…" mientras convierte.
 *   3. Preview en círculo 120 px con el blob JPEG ya convertido
 *   4. "Guardar foto" → POST /api/user/avatar → onUploadSuccess(url)
 *   5. "✅ Foto actualizada" durante 3 s
 */

import { useState, useRef } from 'react';

// ─── Detección de HEIC/HEIF ───────────────────────────────────────────────────

function isHeicFile(file: File): boolean {
  if (file.type === 'image/heic' || file.type === 'image/heif') return true;
  // Algunos browsers no reportan el MIME type de HEIC → verificar extensión
  return /\.(heic|heif)$/i.test(file.name);
}

// ─── Helpers de canvas ───────────────────────────────────────────────────────

/**
 * Carga un Blob en un <img> y lo redibuja en canvas redimensionado.
 * Usado después de convertir HEIC o directamente para PNG/WEBP/JPG.
 */
function blobToResizedJpeg(source: Blob, maxPx: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img       = new Image();
    const objectUrl = URL.createObjectURL(source);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { naturalWidth: sw, naturalHeight: sh } = img;
      if (!sw || !sh) { reject(new Error('Dimensiones inválidas')); return; }

      const scale  = Math.min(1, maxPx / Math.max(sw, sh));
      const w      = Math.max(1, Math.round(sw * scale));
      const h      = Math.max(1, Math.round(sh * scale));

      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas no disponible')); return; }

      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (b) => b ? resolve(b) : reject(new Error('canvas.toBlob devolvió null')),
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo decodificar la imagen'));
    };

    img.src = objectUrl;
  });
}

// ─── Conversión completa: detecta formato y aplica pipeline correcto ──────────

async function prepareJpeg(file: File): Promise<Blob> {
  const MAX_PX  = 400;
  const QUALITY = 0.85;

  if (isHeicFile(file)) {
    // heic2any: importación dinámica → no impacta el bundle si no se usa HEIC.
    // Convierte HEIC/HEIF a JPEG en el browser sin soporte nativo del SO.
    const heic2any = (await import('heic2any')).default;

    const result = await heic2any({
      blob:    file,
      toType:  'image/jpeg',
      quality: 0.9,          // alta calidad; canvas rebaja después
    });

    // heic2any puede devolver un Blob o Blob[] (álbumes multi-imagen)
    const heicBlob = Array.isArray(result) ? result[0] : result;

    // Redimensionar el JPEG resultante
    return blobToResizedJpeg(heicBlob, MAX_PX, QUALITY);
  }

  // Para todos los demás formatos el browser puede decodificarlos nativamente
  return blobToResizedJpeg(file, MAX_PX, QUALITY);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AvatarUploaderProps {
  /** null mientras el auth aún carga → deshabilita el upload */
  userId:           string | null;
  /** URL guardada en DB / contexto. null = sin foto */
  currentAvatarUrl: string | null;
  /** Iniciales de fallback cuando no hay foto */
  iniciales:        string;
  /** Se llama con la URL pública nueva cuando el guardado en DB es exitoso */
  onUploadSuccess:  (url: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AvatarUploader({
  userId,
  currentAvatarUrl,
  iniciales,
  onUploadSuccess,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null);

  const [converting,   setConverting]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [imgError,     setImgError]     = useState(false);
  const [statusMsg,    setStatusMsg]    = useState<string | null>(null);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);

  // ── Limpiar selección ──────────────────────────────────────────────────────
  function clearSelection() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setConvertedBlob(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    setStatusMsg(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  // ── Selección de archivo ───────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    clearSelection();
    setImgError(false);
    setSaved(false);
    setConverting(true);
    setStatusMsg(isHeicFile(file) ? 'Convirtiendo HEIC…' : 'Procesando imagen…');

    try {
      const blob    = await prepareJpeg(file);
      const objUrl  = URL.createObjectURL(blob);
      setConvertedBlob(blob);
      setPreviewUrl(objUrl);
      setStatusMsg(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('[AvatarUploader] conversión:', err);
      setErrorMsg(`No se pudo procesar la imagen: ${msg}`);
      setStatusMsg(null);
    } finally {
      setConverting(false);
    }
  }

  // ── Guardar foto ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!convertedBlob || !userId) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const fd = new FormData();
      fd.append('file', convertedBlob, 'avatar.jpg');

      const res  = await fetch('/api/user/avatar', { method: 'POST', body: fd });
      const json = await res.json() as { url?: string; error?: string };

      if (!res.ok) throw new Error(json.error ?? `Error HTTP ${res.status}`);
      if (!json.url) throw new Error('El servidor no devolvió URL');

      onUploadSuccess(json.url);
      clearSelection();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('[AvatarUploader] guardado:', err);
      setErrorMsg(`No se pudo guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  // Prioridad: preview convertido → URL de DB/contexto → iniciales
  const foto = previewUrl ?? (imgError ? null : currentAvatarUrl);

  return (
    <div className="flex flex-col items-center gap-3">

      {/* ── Círculo 120 px ── */}
      <div className="relative w-[120px] h-[120px] rounded-full overflow-hidden
                      flex-shrink-0 bg-brand-600">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={foto}
            src={foto}
            alt="Foto de perfil"
            className="w-full h-full object-cover"
            onError={() => { if (!previewUrl) setImgError(true); }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center
                          text-3xl font-bold text-white select-none">
            {iniciales || 'U'}
          </div>
        )}

        {/* Spinner durante conversión o guardado */}
        {(converting || saving) && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
            <svg className="animate-spin h-7 w-7 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        )}
      </div>

      {/* ── Mensaje de proceso (bajo el círculo) ── */}
      {statusMsg && (
        <p className="text-xs text-slate-500 animate-pulse">{statusMsg}</p>
      )}

      {/* ── Botones ── */}
      {!convertedBlob && !converting ? (
        <button
          type="button"
          onClick={() => userId && inputRef.current?.click()}
          disabled={!userId}
          className="text-sm text-brand-600 hover:text-brand-800 font-medium
                     transition-colors disabled:opacity-40"
        >
          Subir foto
        </button>
      ) : convertedBlob && !converting ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300
                       text-white text-sm font-semibold rounded-lg transition-colors
                       flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Guardando…
              </>
            ) : 'Guardar foto'}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={saving}
            className="px-4 py-1.5 border border-slate-200 text-slate-600 text-sm
                       font-medium rounded-lg hover:bg-slate-50 transition-colors
                       disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      ) : null}

      {/* ── Mensajes de estado ── */}
      {saved && (
        <p className="text-sm text-green-600 font-medium flex items-center gap-1.5">
          <span>✅</span> Foto actualizada
        </p>
      )}
      {errorMsg && (
        <p className="text-xs text-red-600 flex items-center gap-1 text-center max-w-[220px]">
          <span className="flex-shrink-0">⚠️</span> {errorMsg}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
