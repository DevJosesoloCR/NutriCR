'use client';

/**
 * ImageCropper
 * ─────────────
 * Modal full-screen para recortar una imagen en círculo.
 * Recibe imageSrc como data-URL o blob-URL y devuelve el recorte
 * como Blob JPEG via `onConfirm`.
 *
 * El CSS de react-easy-crop v6 se carga en app/globals.css (NO aquí) para
 * evitar que TypeScript intente resolver react-easy-crop.css.d.ts, que tiene
 * un carácter inválido (bug del paquete → TS1127). Webpack también usa
 * tsconfig.paths para su resolución, así que cualquier path override en
 * tsconfig redirige el import real y el CSS nunca llegaría al bundle.
 */

import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

// ── getCroppedImg helper ──────────────────────────────────────────────────────

/** Carga la imagen — sin crossOrigin (data-URLs son same-origin) */
function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img   = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src     = src;
  });
}

/**
 * Recorta `imageSrc` según `pixelCrop` y devuelve un Blob JPEG ≤ 512 px.
 * Aplica bounds-clamping para que las coordenadas nunca queden fuera de la imagen.
 */
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);

  // Clamp: evitar valores negativos o fuera del tamaño real de la imagen
  const sx = Math.max(0, Math.round(pixelCrop.x));
  const sy = Math.max(0, Math.round(pixelCrop.y));
  const sw = Math.min(Math.round(pixelCrop.width),  image.naturalWidth  - sx);
  const sh = Math.min(Math.round(pixelCrop.height), image.naturalHeight - sy);

  if (sw <= 0 || sh <= 0) {
    throw new Error('getCroppedImg: área de recorte vacía o fuera de imagen');
  }

  const outputSize = Math.min(sw, sh, 512);
  const canvas     = document.createElement('canvas');
  canvas.width     = outputSize;
  canvas.height    = outputSize;
  canvas.getContext('2d')!.drawImage(image, sx, sy, sw, sh, 0, 0, outputSize, outputSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('canvas.toBlob devolvió null')),
      'image/jpeg',
      0.9,
    );
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Data-URL o blob-URL de la imagen seleccionada por el usuario */
  imageSrc:  string;
  /** Recibe el Blob JPEG del recorte confirmado */
  onConfirm: (blob: Blob) => void;
  /** Llamada al cancelar sin subir nada */
  onCancel:  () => void;
}

/** Altura fija del panel de controles (slider + botones) */
const CONTROLS_H = 152;

export default function ImageCropper({ imageSrc, onConfirm, onCancel }: Props) {
  const [crop,    setCrop]    = useState({ x: 0, y: 0 });
  const [zoom,    setZoom]    = useState(1);
  const [pixels,  setPixels]  = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  // react-easy-crop dispara esto al cargar la imagen (crop inicial) Y cada vez
  // que el usuario mueve/zoomea → pixels nunca queda null tras cargar la imagen.
  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setPixels(croppedAreaPixels);
  }, []);

  // ── DEBUG: verificar que imageSrc llega con valor al montar ──────────────
  useEffect(() => {
    console.log(
      '[ImageCropper] montado — imageSrc:',
      imageSrc
        ? `✅ data:URL (${imageSrc.length} chars) → ${imageSrc.slice(0, 60)}…`
        : '❌ VACÍO o null',
    );
    return () => { console.log('[ImageCropper] desmontado'); };
  }, [imageSrc]);

  async function handleConfirm() {
    if (!pixels || pixels.width === 0 || pixels.height === 0) return;
    setWorking(true);
    try {
      const blob = await getCroppedImg(imageSrc, pixels);
      onConfirm(blob);
    } catch (err) {
      console.error('[ImageCropper] getCroppedImg error:', err);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black select-none touch-none">

      {/*
        ── Área de crop ──────────────────────────────────────────────────────
        Posicionamiento absoluto con bottom explícito en lugar de flex-1.
        react-easy-crop mide el contenedor via getBoundingClientRect /
        ResizeObserver: con dimensiones absolutas las lee correctamente
        desde el primer render.
      */}
      <div
        className="absolute inset-x-0 top-0"
        style={{ bottom: CONTROLS_H }}
      >
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          objectFit="contain"
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* ── Controles (altura = CONTROLS_H px) ── */}
      <div
        className="absolute inset-x-0 bottom-0 bg-black/90 flex flex-col"
        style={{ height: CONTROLS_H }}
      >
        <div className="px-6 pt-3 pb-1">
          <p className="text-white/50 text-xs text-center mb-2 tracking-wide">
            Mové y hacé zoom para encuadrar
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

        <div className="flex gap-3 px-5 pb-4 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="flex-1 py-2.5 rounded-xl border border-white/30 text-white text-sm font-semibold
                       hover:bg-white/10 active:bg-white/20 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={working || !pixels || pixels.width === 0}
            className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800
                       text-white text-sm font-semibold transition-colors disabled:opacity-40"
          >
            {working ? 'Procesando…' : 'Confirmar recorte'}
          </button>
        </div>
      </div>

    </div>
  );
}
