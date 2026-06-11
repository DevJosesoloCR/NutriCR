'use client';

/**
 * AvatarUploader
 * ──────────────
 * Componente unificado para cambiar la foto de perfil.
 * Compartido entre paciente y nutricionista. Sin dependencias externas.
 *
 * Flujo:
 *   1. "Subir foto" → file input (acepta image/*, .heic, .heif)
 *   2. Conversión inmediata a JPEG con canvas (máx 400×400, calidad 0.85)
 *      → preview en el círculo desde el primer momento (sin imagen rota)
 *      → funciona con HEIC en Safari/iOS de forma nativa
 *   3. "Guardar foto":
 *      POST /api/user/avatar con el blob ya convertido
 *      → servidor sube a Storage y actualiza usuarios.avatar_url (admin client)
 *   4. onUploadSuccess(url) → padre actualiza el contexto global
 *   5. "✅ Foto actualizada" durante 3 s
 *
 * Props (sin dependencia interna de AvatarContext):
 *   userId           – ID del usuario (null mientras auth carga → deshabilita botón)
 *   currentAvatarUrl – URL guardada en DB / contexto (fuente de verdad)
 *   iniciales        – Fallback cuando no hay foto
 *   onUploadSuccess  – Callback con la nueva URL pública
 */

import { useState, useRef } from 'react';

// ─── Helper: convertir cualquier formato a JPEG vía canvas ───────────────────
//
// Carga el archivo en un <img> nativo y lo redibuja en canvas.
// - PNG, WEBP, GIF → soportados por todos los browsers modernos
// - HEIC/HEIF → soportado nativamente en Safari (macOS/iOS); en Chrome solo si
//   el sistema operativo lo decodifica (macOS Monterey+). En Chrome/Windows no
//   funciona sin librería externa.
// Si la imagen no se puede cargar, lanza Error para que el llamador lo muestre.

function convertToJpeg(file: File, maxPx: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img       = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { naturalWidth: sw, naturalHeight: sh } = img;

      if (!sw || !sh) {
        reject(new Error('La imagen tiene dimensiones inválidas'));
        return;
      }

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
        (b) => b
          ? resolve(b)
          : reject(new Error('No se pudo generar el JPEG')),
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(
        'No se pudo leer la imagen. ' +
        'Si es un archivo HEIC, abrilo en Fotos y exportalo como JPG, ' +
        'o usá Safari en iPhone/Mac.',
      ));
    };

    img.src = objectUrl;
  });
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

  // Blob JPEG ya convertido (listo para subir)
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  // URL del blob convertido (para mostrar el preview)
  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null);

  const [converting,    setConverting]    = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [imgError,      setImgError]      = useState(false);
  const [uploadError,   setUploadError]   = useState<string | null>(null);

  // ── Limpiar estado de selección ───────────────────────────────────────────
  function clearSelection() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setConvertedBlob(null);
    setPreviewUrl(null);
    setUploadError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  // ── Selección de archivo → conversión inmediata a JPEG ────────────────────
  //
  // Convertimos en este momento (no al guardar) para que:
  //  a) El preview use siempre un JPEG válido → nunca imagen rota en el browser
  //  b) Al guardar usamos el blob ya preparado (sin doble conversión)
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    clearSelection();
    setImgError(false);
    setSaved(false);
    setConverting(true);

    try {
      const blob       = await convertToJpeg(file, 400, 0.85);
      const blobObjUrl = URL.createObjectURL(blob);

      setConvertedBlob(blob);
      setPreviewUrl(blobObjUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo procesar la imagen';
      console.error('[AvatarUploader] conversión:', err);
      setUploadError(msg);
    } finally {
      setConverting(false);
    }
  }

  // ── Guardar foto ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!convertedBlob || !userId) return;

    setSaving(true);
    setUploadError(null);

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
      setUploadError(`No se pudo guardar la foto: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Qué mostrar en el círculo ─────────────────────────────────────────────
  // Prioridad: preview JPEG convertido → URL de DB/contexto → iniciales
  const foto = previewUrl ?? (imgError ? null : currentAvatarUrl);

  return (
    <div className="flex flex-col items-center gap-3">

      {/* ── Círculo de foto 120 px ── */}
      <div className="relative w-[120px] h-[120px] rounded-full overflow-hidden flex-shrink-0
                      bg-brand-600">
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

        {/* Spinner de conversión superpuesto */}
        {converting && (
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

      {/* ── Botones de acción ── */}
      {!convertedBlob && !converting ? (
        /* Sin imagen seleccionada */
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
        /* Imagen convertida lista — confirmar o cancelar */
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
      ) : null /* converting: el spinner en el círculo ya da feedback */ }

      {/* ── Mensajes de estado ── */}
      {saved && (
        <p className="text-sm text-green-600 font-medium flex items-center gap-1.5">
          <span>✅</span> Foto actualizada
        </p>
      )}
      {uploadError && (
        <p className="text-xs text-red-600 flex items-center gap-1 text-center max-w-[200px]">
          <span className="flex-shrink-0">⚠️</span> {uploadError}
        </p>
      )}

      {/* Input oculto — acepta imágenes comunes y HEIC/HEIF */}
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
