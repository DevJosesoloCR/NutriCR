'use client';

import { useState, useEffect, useRef } from 'react';

type TipoComida = 'desayuno' | 'almuerzo' | 'cena' | 'merienda';

interface EntradaDiario {
  id: string;
  foto_url: string | null;
  descripcion: string | null;
  descripcion_texto: string | null;
  tipo_comida: TipoComida | null;
  created_at: string;
}

const TIPOS: { value: TipoComida; label: string; emoji: string }[] = [
  { value: 'desayuno',  label: 'Desayuno',  emoji: '🌅' },
  { value: 'almuerzo',  label: 'Almuerzo',  emoji: '☀️'  },
  { value: 'cena',      label: 'Cena',      emoji: '🌙' },
  { value: 'merienda',  label: 'Merienda',  emoji: '🍎' },
];

function formatFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Conversión + compresión a JPEG via canvas ───────────────────────────────
const MAX_PX = 1920;
const JPEG_Q = 0.80;

async function toJpegBlob(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload  = () => resolve(el);
    el.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
    el.src = objectUrl;
  }).finally(() => URL.revokeObjectURL(objectUrl));

  if (img.naturalWidth === 0 || img.naturalHeight === 0) {
    throw new Error('La imagen no tiene dimensiones válidas');
  }

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > MAX_PX || h > MAX_PX) {
    if (w >= h) { h = Math.round(h * MAX_PX / w); w = MAX_PX; }
    else        { w = Math.round(w * MAX_PX / h); h = MAX_PX; }
  }

  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible en este dispositivo');
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Error al generar el JPEG')),
      'image/jpeg',
      JPEG_Q,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DiarioPage() {
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galeriaInputRef = useRef<HTMLInputElement>(null);

  // ── Estado foto ──────────────────────────────────────────────────────────────
  const [preview,      setPreview]      = useState<string | null>(null);
  const [blob,         setBlob]         = useState<Blob | null>(null);
  const [descripcion,  setDesc]         = useState('');
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [subiendo,     setSubiendo]     = useState(false);
  const [errorFoto,    setErrorFoto]    = useState<string | null>(null);

  // ── Estado texto ─────────────────────────────────────────────────────────────
  const [textoComida,    setTextoComida]    = useState('');
  const [tipoComida,     setTipoComida]     = useState<TipoComida>('almuerzo');
  const [guardandoTexto, setGuardandoTexto] = useState(false);
  const [errorTexto,     setErrorTexto]     = useState<string | null>(null);
  const [okTexto,        setOkTexto]        = useState(false);

  // ── Historial ────────────────────────────────────────────────────────────────
  const [historial,    setHistorial]    = useState<EntradaDiario[]>([]);
  const [cargando,     setCargando]     = useState(true);
  const [fotoAmpliada, setFotoAmpliada] = useState<EntradaDiario | null>(null);

  // ── Cargar historial ─────────────────────────────────────────────────────────
  async function cargarHistorial() {
    setCargando(true);
    try {
      const res  = await fetch('/api/diario');
      const json = await res.json();
      if (res.ok) setHistorial(json.data ?? []);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarHistorial(); }, []);

  // ── Foto: seleccionar archivo ─────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 10 * 1024 * 1024) {
      setErrorFoto('La imagen no puede superar 10 MB.');
      return;
    }

    setErrorFoto(null);
    setConvirtiendo(true);

    try {
      const jpeg = await toJpegBlob(selected);
      setBlob(jpeg);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(jpeg);
    } catch (err) {
      setErrorFoto('No se pudo procesar la imagen. Intenta con otra foto.');
      console.error('[diario] toJpegBlob:', err);
    } finally {
      setConvirtiendo(false);
    }
  }

  function cancelarPreview() {
    setPreview(null);
    setBlob(null);
    setDesc('');
    setErrorFoto(null);
    if (cameraInputRef.current)  cameraInputRef.current.value  = '';
    if (galeriaInputRef.current) galeriaInputRef.current.value = '';
  }

  // ── Foto: subir ───────────────────────────────────────────────────────────────
  async function handleSubirFoto() {
    if (!blob) return;
    setSubiendo(true);
    setErrorFoto(null);

    try {
      const fd = new FormData();
      fd.append('file', blob, 'foto.jpg');
      if (descripcion.trim()) fd.append('descripcion', descripcion.trim());

      const res  = await fetch('/api/diario', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok) { setErrorFoto(json.error ?? 'Error al subir la foto.'); return; }

      setHistorial((prev) => [json.data, ...prev].slice(0, 20));
      cancelarPreview();
    } catch {
      setErrorFoto('Error de conexión. Intentá de nuevo.');
    } finally {
      setSubiendo(false);
    }
  }

  // ── Texto: guardar ────────────────────────────────────────────────────────────
  async function handleGuardarTexto() {
    if (!textoComida.trim()) { setErrorTexto('Escribí qué comiste.'); return; }

    setGuardandoTexto(true);
    setErrorTexto(null);

    try {
      const res  = await fetch('/api/diario', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ texto: textoComida.trim(), tipo_comida: tipoComida }),
      });
      const json = await res.json();

      if (!res.ok) { setErrorTexto(json.error ?? 'Error al guardar.'); return; }

      setHistorial((prev) => [json.data, ...prev].slice(0, 20));
      setTextoComida('');
      setTipoComida('almuerzo');
      setOkTexto(true);
      setTimeout(() => setOkTexto(false), 2500);
    } catch {
      setErrorTexto('Error de conexión. Intentá de nuevo.');
    } finally {
      setGuardandoTexto(false);
    }
  }

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Registro de comidas</h2>
        <p className="text-sm text-slate-400 mt-0.5">Fotografiá o anotá lo que comés para que tu nutricionista pueda verlo</p>
      </div>

      {/* ── Zona de captura ── */}
      {convirtiendo ? (

        <div className="border-2 border-dashed border-brand-200 rounded-2xl bg-brand-50 flex flex-col items-center justify-center gap-3 py-12">
          <svg className="animate-spin h-8 w-8 text-brand-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm font-medium text-brand-600">Procesando imagen…</p>
          <p className="text-xs text-brand-400">Convirtiendo a JPEG</p>
        </div>

      ) : !preview ? (

        /* ── Botones de captura + formulario manual ── */
        <div className="space-y-4">

          {/* Foto */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div
                role="button" tabIndex={0}
                onClick={() => cameraInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && cameraInputRef.current?.click()}
                className="border-2 border-dashed border-brand-200 rounded-2xl bg-brand-50 flex flex-col items-center justify-center gap-2.5 py-8 cursor-pointer active:bg-brand-100 transition-colors select-none"
              >
                <span className="text-4xl">📷</span>
                <div className="text-center">
                  <p className="text-sm font-bold text-brand-700">Tomar foto</p>
                  <p className="text-[11px] text-brand-400 mt-0.5">Abre la cámara</p>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              </div>

              <div
                role="button" tabIndex={0}
                onClick={() => galeriaInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && galeriaInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center justify-center gap-2.5 py-8 cursor-pointer active:bg-slate-100 transition-colors select-none"
              >
                <span className="text-4xl">🖼️</span>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-600">Elegir foto</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Desde galería</p>
                </div>
                <input ref={galeriaInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>
            </div>

            {errorFoto && (
              <p className="text-xs text-red-500 flex items-center gap-1"><span>⚠️</span> {errorFoto}</p>
            )}
            <p className="text-center text-[11px] text-slate-300">JPG · PNG · HEIC · WEBP — máximo 10 MB</p>
          </div>

          {/* ── Separador ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100" />
            <p className="text-xs text-slate-400 whitespace-nowrap">o registrá manualmente</p>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* ── Formulario de texto ── */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">

            {/* Campo texto */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                ¿Qué comiste?
              </label>
              <textarea
                value={textoComida}
                onChange={(e) => setTextoComida(e.target.value.slice(0, 200))}
                placeholder="Ej: Arroz con pollo, ensalada verde y agua"
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all resize-none text-slate-800 placeholder:text-slate-300"
              />
              <p className="text-right text-[10px] text-slate-300 mt-0.5">{textoComida.length}/200</p>
            </div>

            {/* Selector tipo de comida */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Tiempo de comida</p>
              <div className="grid grid-cols-4 gap-1.5">
                {TIPOS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTipoComida(t.value)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-semibold transition-colors ${
                      tipoComida === t.value
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-slate-500 border border-slate-200 active:bg-slate-100'
                    }`}
                  >
                    <span className="text-base">{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error / confirmación */}
            {errorTexto && (
              <p className="text-xs text-red-500 flex items-center gap-1"><span>⚠️</span> {errorTexto}</p>
            )}
            {okTexto && (
              <p className="text-xs text-green-600 flex items-center gap-1 font-medium">
                <span>✅</span> ¡Registrado correctamente!
              </p>
            )}

            {/* Botón */}
            <button
              onClick={handleGuardarTexto}
              disabled={guardandoTexto || !textoComida.trim()}
              className="w-full bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {guardandoTexto ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Guardando…
                </>
              ) : (
                <>✏️ Registrar sin foto</>
              )}
            </button>
          </div>
        </div>

      ) : (

        /* ── Preview antes de subir foto ── */
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-square w-full max-w-sm mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={cancelarPreview}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm hover:bg-black/70 transition-colors"
            >
              ✕
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              ¿Qué estás comiendo? <span className="text-slate-300">(opcional)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDesc(e.target.value.slice(0, 100))}
                placeholder="Ej: Almuerzo con arroz, pollo y ensalada"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-12 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all text-slate-800 placeholder:text-slate-300"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-300">
                {descripcion.length}/100
              </span>
            </div>
          </div>

          {errorFoto && (
            <p className="text-xs text-red-500 flex items-center gap-1"><span>⚠️</span> {errorFoto}</p>
          )}

          <button
            onClick={handleSubirFoto}
            disabled={subiendo}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {subiendo ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Subiendo…
              </>
            ) : (
              <>📤 Subir foto</>
            )}
          </button>
        </div>
      )}

      {/* ── Historial mixto (fotos + texto) ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-3">Últimas entradas</h3>

        {cargando ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : historial.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <span className="text-3xl block mb-2">🍽️</span>
            <p className="text-sm">Aún no registraste ninguna comida</p>
          </div>
        ) : (
          <div className="space-y-2">
            {historial.map((entry) =>
              entry.foto_url ? (
                /* ── Entrada con foto ── */
                <button
                  key={entry.id}
                  onClick={() => setFotoAmpliada(entry)}
                  className="w-full flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-2 active:bg-slate-50 transition-colors text-left"
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entry.foto_url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">
                      {entry.descripcion ?? 'Foto de comida'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{formatFecha(entry.created_at)}</p>
                  </div>
                  <span className="text-slate-300 text-lg flex-shrink-0">📷</span>
                </button>
              ) : (
                /* ── Entrada de texto ── */
                <div
                  key={entry.id}
                  className="w-full flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-3"
                >
                  {/* Ícono tipo comida */}
                  <div className="w-14 h-14 rounded-lg bg-slate-50 flex flex-col items-center justify-center flex-shrink-0 border border-slate-100">
                    <span className="text-xl">
                      {TIPOS.find((t) => t.value === entry.tipo_comida)?.emoji ?? '✏️'}
                    </span>
                    {entry.tipo_comida && (
                      <span className="text-[9px] text-slate-400 font-medium capitalize mt-0.5">
                        {entry.tipo_comida}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 leading-snug line-clamp-2">
                      {entry.descripcion_texto}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">{formatFecha(entry.created_at)}</p>
                  </div>
                  <span className="text-slate-300 text-base flex-shrink-0">✏️</span>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ── Modal foto ampliada ── */}
      {fotoAmpliada?.foto_url && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center text-lg hover:bg-white/30"
            onClick={() => setFotoAmpliada(null)}
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoAmpliada.foto_url}
            alt={fotoAmpliada.descripcion ?? 'Foto'}
            className="max-w-full max-h-[70vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mt-3 text-center" onClick={(e) => e.stopPropagation()}>
            {fotoAmpliada.descripcion && (
              <p className="text-white font-medium text-sm mb-1">{fotoAmpliada.descripcion}</p>
            )}
            <p className="text-white/60 text-xs">{formatFecha(fotoAmpliada.created_at)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
