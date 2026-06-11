'use client';

/**
 * AvatarUploader
 * ──────────────
 * Componente unificado para cambiar la foto de perfil.
 * Compartido entre paciente y nutricionista. Sin dependencias externas
 * de cropper — solo canvas nativo del browser.
 *
 * Flujo:
 *   1. "Subir foto" → file input
 *   2. Preview inmediato en el círculo (URL.createObjectURL)
 *   3. "Guardar foto":
 *      a. Canvas redimensiona a máx 400×400 px, JPEG calidad 0.8
 *      b. POST /api/user/avatar (multipart) → servidor sube a Storage
 *         con admin client (bypass RLS) y actualiza usuarios.avatar_url
 *      c. onUploadSuccess(url) → padre actualiza el contexto global
 *   4. Muestra "✅ Foto actualizada" 3 s
 *
 * Props (sin dependencia interna de AvatarContext):
 *   userId           – ID del usuario. null mientras auth carga → deshabilita botón
 *   currentAvatarUrl – URL de la DB / contexto (fuente de verdad)
 *   iniciales        – Fallback cuando no hay foto
 *   onUploadSuccess  – Callback con la nueva URL pública
 */

import { useState, useRef } from 'react';

// ─── Helper: redimensionar y convertir a JPEG ─────────────────────────────────

function resizeToJpeg(file: File, maxPx: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img       = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { naturalWidth: sw, naturalHeight: sh } = img;
      const scale  = Math.min(1, maxPx / Math.max(sw, sh));
      const w      = Math.round(sw * scale);
      const h      = Math.round(sh * scale);

      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (b) => b ? resolve(b) : reject(new Error('canvas.toBlob devolvió null')),
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo cargar la imagen'));
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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [imgError,     setImgError]     = useState(false);
  const [uploadError,  setUploadError]  = useState<string | null>(null);

  // ── Selección de archivo ──────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revocar el objectURL anterior para evitar fugas de memoria
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setImgError(false);
    setSaved(false);
    setUploadError(null);
  }

  // ── Cancelar selección ────────────────────────────────────────────────────
  function handleCancel() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    // Limpiar el input para que vuelva a disparar onChange si se elige el mismo archivo
    if (inputRef.current) inputRef.current.value = '';
  }

  // ── Guardar foto ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedFile || !userId) return;

    setSaving(true);
    setUploadError(null);

    try {
      // a. Redimensionar con canvas: máx 400×400 px, JPEG 0.8
      const blob = await resizeToJpeg(selectedFile, 400, 0.8);

      // b-d. POST /api/user/avatar — servidor sube a Storage con admin client
      //      y hace UPDATE en tabla usuarios (bypass RLS, actualización garantizada)
      const fd = new FormData();
      fd.append('file', blob, 'avatar.jpg');

      const res  = await fetch('/api/user/avatar', { method: 'POST', body: fd });
      const json = await res.json() as { url?: string; error?: string };

      if (!res.ok) throw new Error(json.error ?? `Error HTTP ${res.status}`);
      if (!json.url) throw new Error('El servidor no devolvió URL');

      // e. Actualizar contexto global
      onUploadSuccess(json.url);

      // Limpiar preview
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = '';

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

    } catch (err) {
      console.error('[AvatarUploader]', err);
      setUploadError('No se pudo guardar la foto. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  // ── Qué mostrar en el círculo ─────────────────────────────────────────────
  // Prioridad: preview de selección → URL de DB/contexto → iniciales
  const foto = previewUrl ?? (imgError ? null : currentAvatarUrl);

  return (
    <div className="flex flex-col items-center gap-3">

      {/* ── Círculo de foto ── */}
      <div className="w-[100px] h-[100px] rounded-full overflow-hidden flex-shrink-0">
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
          <div className="w-full h-full bg-brand-600 flex items-center justify-center
                          text-3xl font-bold text-white select-none">
            {iniciales || 'U'}
          </div>
        )}
      </div>

      {/* ── Acciones ── */}
      {!selectedFile ? (
        /* Estado: sin foto seleccionada */
        <button
          type="button"
          onClick={() => userId && inputRef.current?.click()}
          disabled={!userId}
          className="text-sm text-brand-600 hover:text-brand-800 font-medium
                     transition-colors disabled:opacity-40"
        >
          Subir foto
        </button>
      ) : (
        /* Estado: foto seleccionada — confirmar o cancelar */
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
            onClick={handleCancel}
            disabled={saving}
            className="px-4 py-1.5 border border-slate-200 text-slate-600 text-sm
                       font-medium rounded-lg hover:bg-slate-50 transition-colors
                       disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Mensajes de estado ── */}
      {saved && (
        <p className="text-sm text-green-600 font-medium flex items-center gap-1.5">
          <span>✅</span> Foto actualizada
        </p>
      )}
      {uploadError && (
        <p className="text-sm text-red-600 flex items-center gap-1.5">
          <span>⚠️</span> {uploadError}
        </p>
      )}

      {/* Input oculto */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
