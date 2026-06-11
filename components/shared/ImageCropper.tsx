'use client';

/**
 * ImageCropper
 * ─────────────
 * Modal full-screen para recortar una imagen en círculo.
 * Recibe la imagen como data-URL (FileReader.readAsDataURL) y devuelve
 * el recorte como Blob JPEG via `onConfirm`.
 *
 * Usa react-easy-crop para la interacción de crop/zoom.
 */

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

// ── Canvas helper ─────────────────────────────────────────────────────────────

/** Recorta `imageSrc` según `pixelCrop` y devuelve un Blob JPEG ≤512 px. */
async function createCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    img.onload  = () => {
      // Limitar el lado mayor a 512 px
      const SIZE    = Math.min(pixelCrop.width, pixelCrop.height, 512);
      const canvas  = document.createElement('canvas');
      canvas.width  = SIZE;
      canvas.height = SIZE;
      canvas
        .getContext('2d')!
        .drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, SIZE, SIZE);
      canvas.toBlob(
        (b) => b ? resolve(b) : reject(new Error('canvas:toBlob devolvió null')),
        'image/jpeg',
        0.9,
      );
    };
    img.onerror = () => reject(new Error('img:load falló'));
    img.src     = imageSrc;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Data-URL de la imagen seleccionada por el usuario */
  imageSrc:  string;
  /** Llamada con el Blob del recorte al confirmar */
  onConfirm: (blob: Blob) => void;
  /** Llamada al cancelar (sin subir nada) */
  onCancel:  () => void;
}

export default function ImageCropper({ imageSrc, onConfirm, onCancel }: Props) {
  const [crop,    setCrop]    = useState({ x: 0, y: 0 });
  const [zoom,    setZoom]    = useState(1);
  const [pixels,  setPixels]  = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setPixels(croppedAreaPixels);
  }, []);

  async function handleConfirm() {
    if (!pixels) return;
    setWorking(true);
    try {
      const blob = await createCroppedBlob(imageSrc, pixels);
      onConfirm(blob);
    } catch {
      /* silencioso — el usuario puede intentar de nuevo */
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col select-none touch-none">

      {/* ── Área de crop ── */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* ── Controles ── */}
      <div className="px-6 pt-4 pb-2 bg-black/90 text-center space-y-2">
        <p className="text-white/50 text-xs tracking-wide">
          Mové y hacé zoom para centrar tu cara
        </p>
        <input
          type="range"
          min={1} max={3} step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-brand-500"
          aria-label="Zoom"
        />
      </div>

      {/* ── Botones ── */}
      <div className="flex gap-3 px-5 py-4 bg-black/90">
        <button
          type="button"
          onClick={onCancel}
          disabled={working}
          className="flex-1 py-3 rounded-xl border border-white/30 text-white text-sm font-semibold
                     hover:bg-white/10 active:bg-white/20 transition-colors disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={working || !pixels}
          className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800
                     text-white text-sm font-semibold transition-colors disabled:opacity-40"
        >
          {working ? 'Procesando…' : 'Confirmar recorte'}
        </button>
      </div>

    </div>
  );
}
