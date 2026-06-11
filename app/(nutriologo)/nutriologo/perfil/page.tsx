'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function comprimirImagen(file: File): Promise<Blob> {
  const MAX = 512;
  const objectUrl = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image(); el.onload = () => res(el); el.onerror = rej; el.src = objectUrl;
  }).finally(() => URL.revokeObjectURL(objectUrl));
  let w = img.naturalWidth; let h = img.naturalHeight;
  if (w > MAX || h > MAX) {
    if (w >= h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; }
  }
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error('canvas')), 'image/jpeg', 0.85));
}

// ─── AvatarUpload ──────────────────────────────────────────────────────────────

function AvatarUpload({ iniciales }: { iniciales: string }) {
  const inputRef      = useRef<HTMLInputElement>(null);
  // Guardamos el object URL del preview en un ref para poder revocarlo
  // correctamente sin depender de closures sobre el estado.
  const previewUrlRef = useRef<string | null>(null);

  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null); // foto guardada en BD
  const [preview,      setPreview]      = useState<string | null>(null); // object URL local antes de confirmar
  const [blobPend,     setBlobPend]     = useState<Blob | null>(null);   // blob comprimido listo para subir
  const [comprimiendo, setComprimiendo] = useState(false);               // canvas procesando
  const [subiendo,     setSubiendo]     = useState(false);               // upload en curso
  const [imgError,     setImgError]     = useState(false);               // URL guardada da 404/broken

  // Limpiar object URL al desmontar el componente
  useEffect(() => {
    return () => { revocarPreview(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar avatar guardado desde la BD (fuente de verdad, no user_metadata)
  useEffect(() => {
    fetch('/api/user/me')
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        const url = json?.data?.avatar_url as string | undefined;
        if (url) { setAvatarUrl(url); setImgError(false); }
      })
      .catch(() => {});
  }, []);

  /** Revoca el object URL del preview y limpia el ref */
  function revocarPreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }

  /**
   * Cuando el usuario selecciona un archivo:
   * 1. URL.createObjectURL → preview inmediato (síncrono, sin FileReader)
   * 2. comprimirImagen     → blob listo para subir (async, en paralelo)
   */
  async function handleSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revocar preview anterior si había uno
    revocarPreview();

    // Object URL síncrono — disponible de inmediato para el <img>
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreview(objectUrl);
    setBlobPend(null);
    setComprimiendo(true);

    // Comprimir en paralelo para obtener el blob final
    try {
      const blob = await comprimirImagen(file);
      setBlobPend(blob);
    } catch {
      setBlobPend(null);
    } finally {
      setComprimiendo(false);
    }

    // Reset input para permitir seleccionar el mismo archivo otra vez
    e.target.value = '';
  }

  /** Confirmar: subir blob comprimido al servidor */
  async function handleConfirmar() {
    if (!blobPend) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('file', blobPend, 'avatar.jpg');
      const res  = await fetch('/api/user/avatar', { method: 'POST', body: fd });
      const json = await res.json();
      if (res.ok) {
        setAvatarUrl(json.url);
        setImgError(false);
      }
    } catch { /* silencioso */ }
    finally {
      revocarPreview();
      setSubiendo(false);
      setPreview(null);
      setBlobPend(null);
    }
  }

  /** Cancelar: descartar preview sin subir nada */
  function handleCancelar() {
    revocarPreview();
    setPreview(null);
    setBlobPend(null);
    setComprimiendo(false);
  }

  // Qué mostrar en el círculo:
  // - preview (object URL local) mientras estamos en modo confirmación
  // - avatarUrl guardada si no dio error al cargar
  // - iniciales como fallback final
  const mostrarFoto     = preview ?? (imgError ? null : avatarUrl);
  const confirmDisabled = subiendo || comprimiendo || !blobPend;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Círculo 100 px */}
      <div className="relative w-[100px] h-[100px] rounded-full overflow-hidden flex-shrink-0">
        {mostrarFoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mostrarFoto}
            alt=""
            className="w-full h-full object-cover"
            // onError solo aplica a la URL guardada, no al object URL de preview
            onError={() => { if (!preview) setImgError(true); }}
          />
        ) : (
          <div className="w-full h-full bg-brand-600 flex items-center justify-center text-3xl font-bold text-white select-none">
            {iniciales || 'N'}
          </div>
        )}

        {/* Overlay de carga (comprimiendo o subiendo) */}
        {(subiendo || comprimiendo) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <svg className="animate-spin h-7 w-7 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
          </div>
        )}
      </div>

      {/* Botones según estado */}
      {!preview ? (
        // Estado normal: botón "Cambiar foto"
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors"
        >
          Cambiar foto
        </button>
      ) : (
        // Estado con preview: Confirmar / Cancelar
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={confirmDisabled}
            className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white text-sm font-semibold transition-colors"
          >
            {subiendo ? 'Subiendo…' : comprimiendo ? 'Procesando…' : 'Confirmar'}
          </button>
          <button
            type="button"
            onClick={handleCancelar}
            disabled={subiendo}
            className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSeleccionar}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const ESPECIALIDADES = [
  'Pérdida de peso',
  'Deportiva',
  'Clínica',
  'Pediátrica',
  'Otra',
];

// ─── Componente reutilizable de cambio de contraseña ─────────────────────────

function CambiarPassword({ email }: { email: string }) {
  const [currPwd,    setCurrPwd]    = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [ok,         setOk]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    if (newPwd.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Verificar contraseña actual
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currPwd });
      if (signInErr) { setError('La contraseña actual es incorrecta.'); return; }

      // 2. Actualizar a la nueva contraseña
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd });
      if (updateErr) { setError(updateErr.message); return; }

      setOk(true);
      setCurrPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setTimeout(() => setOk(false), 4000);
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Contraseña actual */}
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">Contraseña actual</label>
        <input
          type="password"
          value={currPwd}
          onChange={(e) => setCurrPwd(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
        />
      </div>

      {/* Nueva contraseña */}
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">Nueva contraseña</label>
        <input
          type="password"
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          required
          autoComplete="new-password"
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
        />
      </div>

      {/* Confirmar contraseña */}
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">Confirmar nueva contraseña</label>
        <input
          type="password"
          value={confirmPwd}
          onChange={(e) => setConfirmPwd(e.target.value)}
          placeholder="Repetí la nueva contraseña"
          required
          autoComplete="new-password"
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span>⚠️</span> {error}
        </p>
      )}
      {ok && (
        <p className="text-sm text-green-700 flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-xl px-4 py-3 font-medium">
          <span>✅</span> ¡Contraseña actualizada correctamente!
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !currPwd || !newPwd || !confirmPwd}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Guardando…
          </>
        ) : 'Cambiar contraseña'}
      </button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PerfilNutriologoPage() {
  const router = useRouter();
  const [user,       setUser]      = useState<User | null>(null);
  const [loading,    setLoading]   = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // ── Datos profesionales ──────────────────────────────────────────────────────
  const [prof, setProf] = useState({ especialidad: '', descripcion: '', telefono: '' });
  const [cargandoProf, setCargandoProf] = useState(true);
  const [guardandoProf, setGuardandoProf] = useState(false);
  const [profError, setProfError] = useState<string | null>(null);
  const [profOk,    setProfOk]    = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    fetch('/api/nutriologo/perfil')
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data) {
          setProf({
            especialidad: json.data.especialidad ?? '',
            descripcion:  json.data.descripcion  ?? '',
            telefono:     json.data.telefono     ?? '',
          });
        }
      })
      .finally(() => setCargandoProf(false));
  }, []);

  async function handleGuardarProf(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoProf(true);
    setProfError(null);
    setProfOk(false);
    try {
      const res  = await fetch('/api/nutriologo/perfil', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          especialidad: prof.especialidad || null,
          descripcion:  prof.descripcion.trim()  || null,
          telefono:     prof.telefono.trim()     || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setProfError(json.error ?? 'Error al guardar.'); return; }
      setProfOk(true);
      setTimeout(() => setProfOk(false), 3000);
    } catch {
      setProfError('Error de conexión. Intentá de nuevo.');
    } finally {
      setGuardandoProf(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await createClient().auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  const nombre   = user?.user_metadata?.nombre  as string | undefined;
  const apellido = user?.user_metadata?.apellido as string | undefined;
  const email    = user?.email ?? '';
  const iniciales = nombre
    ? (nombre.charAt(0) + (apellido?.charAt(0) ?? '')).toUpperCase()
    : '👤';

  return (
    <div className="max-w-xl mx-auto space-y-6 py-6 px-4">
      <h1 className="text-2xl font-bold text-slate-800">Mi Perfil</h1>

      {/* ── Avatar + datos ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        {/* Avatar centrado */}
        <div className="flex flex-col items-center mb-5">
          {loading ? (
            <div className="w-[100px] h-[100px] rounded-full bg-slate-100 animate-pulse mb-3" />
          ) : (
            <AvatarUpload iniciales={iniciales} />
          )}
          {!loading && (
            <div className="text-center mt-1">
              <p className="font-semibold text-slate-800 text-lg">
                {nombre ? `${nombre}${apellido ? ' ' + apellido : ''}` : 'Nutricionista'}
              </p>
              <p className="text-slate-500 text-sm">{email || '—'}</p>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          {[
            { label: 'Nombre',  value: nombre ? `${nombre}${apellido ? ' ' + apellido : ''}` : '—' },
            { label: 'Correo',  value: email || '—' },
            { label: 'Rol',     value: 'Nutricionista' },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center text-sm">
              <span className="text-slate-500">{item.label}</span>
              <span className="font-medium text-slate-800">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Datos profesionales ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span>🩺</span> Datos del consultorio
        </h2>
        {cargandoProf ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <form onSubmit={handleGuardarProf} className="space-y-4">
            {/* Especialidad */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Especialidad</label>
              <select
                value={prof.especialidad}
                onChange={(e) => setProf((p) => ({ ...p, especialidad: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
              >
                <option value="">Seleccionar…</option>
                {ESPECIALIDADES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Teléfono de contacto</label>
              <input
                type="tel"
                value={prof.telefono}
                onChange={(e) => setProf((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="8888-8888"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
              />
            </div>
            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Descripción del consultorio
                <span className="ml-2 font-normal text-slate-400 text-xs">{prof.descripcion.length}/200</span>
              </label>
              <textarea
                rows={3}
                value={prof.descripcion}
                onChange={(e) => setProf((p) => ({ ...p, descripcion: e.target.value.slice(0, 200) }))}
                placeholder="Ej: Consultorio especializado en nutrición deportiva y pérdida de peso con enfoque integral…"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all resize-none"
              />
            </div>

            {profError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <span>⚠️</span> {profError}
              </p>
            )}
            {profOk && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 font-medium">
                <span>✅</span> Datos actualizados correctamente
              </p>
            )}

            <button
              type="submit"
              disabled={guardandoProf}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {guardandoProf ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  Guardando…
                </>
              ) : 'Guardar cambios'}
            </button>
          </form>
        )}
      </div>

      {/* ── Cambiar contraseña ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span>🔒</span> Cambiar contraseña
        </h2>
        {!loading && email ? (
          <CambiarPassword email={email} />
        ) : (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}
      </div>

      {/* ── Cerrar sesión ── */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {loggingOut ? 'Cerrando sesión…' : <><span>🚪</span> Cerrar sesión</>}
      </button>
    </div>
  );
}
