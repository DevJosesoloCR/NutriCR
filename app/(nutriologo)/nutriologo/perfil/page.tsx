'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import AvatarUploader from '@/components/AvatarUploader';
import { useAvatar }    from '@/context/AvatarContext';


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
  const { avatarUrl, iniciales: ctxIniciales, setAvatarUrl } = useAvatar();
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
  // Usar iniciales del contexto (DB) cuando estén disponibles, con fallback a user_metadata
  const iniciales = ctxIniciales || (nombre
    ? (nombre.charAt(0) + (apellido?.charAt(0) ?? '')).toUpperCase()
    : 'N');

  return (
    <div className="max-w-xl mx-auto space-y-6 py-6 px-4">
      <h1 className="text-2xl font-bold text-slate-800">Mi Perfil</h1>

      {/* ── Avatar + datos ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        {/* Avatar centrado */}
        <div className="flex flex-col items-center mb-5">
          <AvatarUploader
            userId={user?.id ?? null}
            currentAvatarUrl={avatarUrl}
            iniciales={ctxIniciales || (loading ? '' : iniciales)}
            onUploadSuccess={setAvatarUrl}
          />
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
