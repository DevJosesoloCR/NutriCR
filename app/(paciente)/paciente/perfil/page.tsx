'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import AvatarUploader from '@/components/AvatarUploader';
import { useAvatar }    from '@/context/AvatarContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NutriologoInfo {
  nombre:           string;
  apellido:         string | null;
  codigoInvitacion: string | null;
}

type NivelActividad = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy_activo';

interface DatosPerfil {
  fecha_nacimiento: string;
  sexo:             'masculino' | 'femenino' | '';
  estatura_cm:      string;
  peso_meta_kg:     string;
  nivel_actividad:  NivelActividad | '';
  ocupacion:        string;
  telefono:         string;
}

const NIVEL_ACTIVIDAD_LABELS: Record<NivelActividad, string> = {
  sedentario: 'Sedentario',
  ligero:     'Ligero',
  moderado:   'Moderado',
  activo:     'Activo',
  muy_activo: 'Muy activo',
};

function calcularEdad(fechaNacimiento: string): number | null {
  if (!fechaNacimiento) return null;
  const hoy  = new Date();
  const nac  = new Date(fechaNacimiento);
  let edad   = hoy.getFullYear() - nac.getFullYear();
  const m    = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Auto-formatea el input del código a XXXX-XXXX mientras el usuario escribe. */
function formatCodigo(raw: string): string {
  const clean = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PerfilPage() {
  const router = useRouter();
  const { avatarUrl, iniciales: ctxIniciales, setAvatarUrl } = useAvatar();

  // ── Auth user ──────────────────────────────────────────────────────────────
  const [user,       setUser]      = useState<User | null>(null);
  const [loading,    setLoading]   = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // ── Mis datos (biométricos) ──────────────────────────────────────────────────
  const EMPTY_DATOS: DatosPerfil = {
    fecha_nacimiento: '', sexo: '', estatura_cm: '',
    peso_meta_kg: '', nivel_actividad: '', ocupacion: '', telefono: '',
  };
  const [datos,        setDatos]        = useState<DatosPerfil>(EMPTY_DATOS);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [datosError,   setDatosError]   = useState<string | null>(null);
  const [datosOk,      setDatosOk]      = useState(false);

  useEffect(() => {
    fetch('/api/paciente/perfil')
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.data) {
          const d = json.data;
          setDatos({
            fecha_nacimiento: d.fecha_nacimiento ?? '',
            sexo:             d.sexo             ?? '',
            estatura_cm:      d.estatura_cm      != null ? String(d.estatura_cm)  : '',
            peso_meta_kg:     d.peso_meta_kg     != null ? String(d.peso_meta_kg) : '',
            nivel_actividad:  d.nivel_actividad  ?? '',
            ocupacion:        d.ocupacion        ?? '',
            telefono:         d.telefono         ?? '',
          });
        }
      })
      .finally(() => setCargandoDatos(false));
  }, []);

  async function handleGuardarDatos(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoDatos(true);
    setDatosError(null);
    setDatosOk(false);
    try {
      const res = await fetch('/api/paciente/perfil', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_nacimiento: datos.fecha_nacimiento || null,
          sexo:             datos.sexo             || null,
          estatura_cm:      datos.estatura_cm      ? parseFloat(datos.estatura_cm)  : null,
          peso_meta_kg:     datos.peso_meta_kg     ? parseFloat(datos.peso_meta_kg) : null,
          nivel_actividad:  datos.nivel_actividad  || null,
          ocupacion:        datos.ocupacion.trim() || null,
          telefono:         datos.telefono.trim()  || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setDatosError(json.error ?? 'Error al guardar.'); return; }
      setDatosOk(true);
      setTimeout(() => setDatosOk(false), 3000);
    } catch {
      setDatosError('Error de conexión. Intentá de nuevo.');
    } finally {
      setGuardandoDatos(false);
    }
  }

  // ── Nutricionista vinculado ───────────────────────────────────────────────────
  const [nutriologo,    setNutriologo]    = useState<NutriologoInfo | null | undefined>(undefined); // undefined = cargando
  const [nuevoCodigo,   setNuevoCodigo]   = useState('');
  const [vinculando,    setVinculando]    = useState(false);
  const [errorCodigo,   setErrorCodigo]   = useState<string | null>(null);
  const [exitoVinculo,  setExitoVinculo]  = useState(false);
  const [mostrarForm,   setMostrarForm]   = useState(false);

  // ── Cargar usuario auth ───────────────────────────────────────────────────
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  // ── Cargar nutricionista vinculado ───────────────────────────────────────────
  const cargarNutriologo = useCallback(async () => {
    try {
      const res  = await fetch('/api/paciente/nutriologo');
      if (!res.ok) { setNutriologo(null); return; }
      const json = await res.json();
      setNutriologo(json.nutriologo ?? null);
      // Si no tiene nutricionista, abrir el formulario automáticamente
      if (!json.nutriologo) setMostrarForm(true);
    } catch {
      setNutriologo(null);
    }
  }, []);

  useEffect(() => { cargarNutriologo(); }, [cargarNutriologo]);

  // ── Vincular / cambiar nutricionista ─────────────────────────────────────────
  async function handleVincular(e: React.FormEvent) {
    e.preventDefault();
    const codigo = nuevoCodigo.trim();
    if (!codigo || codigo.length < 9) return;

    setVinculando(true);
    setErrorCodigo(null);
    setExitoVinculo(false);

    try {
      const res  = await fetch('/api/paciente/nutriologo', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ codigo }),
      });
      const json = await res.json();

      if (!res.ok) {
        setErrorCodigo(json.error ?? 'Código inválido.');
        return;
      }

      setNutriologo(json.nutriologo);
      setNuevoCodigo('');
      setMostrarForm(false);
      setExitoVinculo(true);
      setTimeout(() => setExitoVinculo(false), 4000);
    } catch {
      setErrorCodigo('Error de conexión. Intentá de nuevo.');
    } finally {
      setVinculando(false);
    }
  }

  // ── Cambiar contraseña ───────────────────────────────────────────────────────
  const [currPwd,    setCurrPwd]    = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdError,   setPwdError]   = useState<string | null>(null);
  const [pwdOk,      setPwdOk]      = useState(false);

  async function handleCambiarPwd(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(null);
    setPwdOk(false);

    if (newPwd.length < 6) { setPwdError('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (newPwd !== confirmPwd) { setPwdError('Las contraseñas no coinciden.'); return; }

    setChangingPwd(true);
    const supabase = createClient();
    try {
      // Verificar contraseña actual
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: email ?? '', password: currPwd });
      if (signInErr) { setPwdError('La contraseña actual es incorrecta.'); return; }

      // Actualizar
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd });
      if (updateErr) { setPwdError(updateErr.message); return; }

      setPwdOk(true);
      setCurrPwd(''); setNewPwd(''); setConfirmPwd('');
      setTimeout(() => setPwdOk(false), 4000);
    } catch {
      setPwdError('Error de conexión. Intentá de nuevo.');
    } finally {
      setChangingPwd(false);
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function handleLogout() {
    setLoggingOut(true);
    await createClient().auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const nombre   = user?.user_metadata?.nombre  as string | undefined;
  const apellido = user?.user_metadata?.apellido as string | undefined;
  const email    = user?.email;
  const iniciales = nombre
    ? (nombre.charAt(0) + (apellido?.charAt(0) ?? '')).toUpperCase()
    : '👤';

  const nombreNutr = nutriologo
    ? `${nutriologo.nombre}${nutriologo.apellido ? ' ' + nutriologo.apellido : ''}`
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-4">
      <h1 className="text-2xl font-bold text-slate-800">Mi Perfil</h1>

      {/* ── Avatar + nombre ── */}
      <div className="flex flex-col items-center py-6">
        <AvatarUploader
          userId={user?.id ?? null}
          currentAvatarUrl={avatarUrl}
          iniciales={ctxIniciales || (loading ? '' : iniciales)}
          onUploadSuccess={setAvatarUrl}
        />
        {loading ? (
          <div className="h-4 bg-slate-100 rounded animate-pulse w-32 mb-2" />
        ) : (
          <>
            <p className="font-semibold text-slate-800 text-lg">
              {nombre ? `${nombre}${apellido ? ' ' + apellido : ''}` : 'Paciente'}
            </p>
            <p className="text-slate-500 text-sm">{email ?? '—'}</p>
          </>
        )}
      </div>

      {/* ── Datos de la cuenta ── */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-slate-700">Datos de la cuenta</h2>
        {[
          { label: 'Nombre', value: nombre ? `${nombre}${apellido ? ' ' + apellido : ''}` : '—' },
          { label: 'Correo', value: email ?? '—' },
          { label: 'Tipo',   value: 'Paciente' },
        ].map((item) => (
          <div
            key={item.label}
            className="flex justify-between items-center border-b border-slate-100 pb-3 last:border-0 last:pb-0"
          >
            <span className="text-slate-500 text-sm">{item.label}</span>
            <span className="font-medium text-slate-800 text-sm">{item.value}</span>
          </div>
        ))}
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          MIS DATOS
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="p-5">
        <h2 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
          <span>📋</span> Mis datos
        </h2>

        {cargandoDatos ? (
          <div className="space-y-3">
            {[1,2,3,4].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleGuardarDatos} className="space-y-4">

            {/* Fecha de nacimiento */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Fecha de nacimiento
                {datos.fecha_nacimiento && (
                  <span className="ml-2 text-brand-600 font-semibold">
                    ({calcularEdad(datos.fecha_nacimiento)} años)
                  </span>
                )}
              </label>
              <input
                type="date"
                value={datos.fecha_nacimiento}
                onChange={(e) => setDatos((p) => ({ ...p, fecha_nacimiento: e.target.value }))}
                max={new Date().toISOString().split('T')[0]}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
              />
            </div>

            {/* Sexo biológico */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Sexo biológico</p>
              <div className="grid grid-cols-2 gap-2">
                {(['masculino', 'femenino'] as const).map((s) => (
                  <button
                    key={s} type="button"
                    onClick={() => setDatos((p) => ({ ...p, sexo: s }))}
                    className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      datos.sexo === s
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                    }`}
                  >
                    {s === 'masculino' ? '♂ Masculino' : '♀ Femenino'}
                  </button>
                ))}
              </div>
            </div>

            {/* Estatura y Peso meta */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Estatura (cm)</label>
                <input
                  type="number" min="100" max="250" step="0.1"
                  value={datos.estatura_cm}
                  onChange={(e) => setDatos((p) => ({ ...p, estatura_cm: e.target.value }))}
                  placeholder="170"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Peso meta (kg)</label>
                <input
                  type="number" min="30" max="300" step="0.1"
                  value={datos.peso_meta_kg}
                  onChange={(e) => setDatos((p) => ({ ...p, peso_meta_kg: e.target.value }))}
                  placeholder="65"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
                />
              </div>
            </div>

            {/* Nivel de actividad */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Nivel de actividad física</label>
              <select
                value={datos.nivel_actividad}
                onChange={(e) => setDatos((p) => ({ ...p, nivel_actividad: e.target.value as NivelActividad | '' }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
              >
                <option value="">Seleccionar…</option>
                {(Object.entries(NIVEL_ACTIVIDAD_LABELS) as [NivelActividad, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Ocupación */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Ocupación</label>
              <input
                type="text"
                value={datos.ocupacion}
                onChange={(e) => setDatos((p) => ({ ...p, ocupacion: e.target.value }))}
                placeholder="Ej: Oficinista, Ama de casa, Estudiante…"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Teléfono</label>
              <input
                type="tel"
                value={datos.telefono}
                onChange={(e) => setDatos((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="8888-8888"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
              />
            </div>

            {datosError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-center gap-1.5">
                <span>⚠️</span> {datosError}
              </p>
            )}
            {datosOk && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 flex items-center gap-1.5 font-medium">
                <span>✅</span> Datos guardados correctamente
              </p>
            )}

            <button
              type="submit"
              disabled={guardandoDatos}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {guardandoDatos ? (
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
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          MI NUTRICIONISTA
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <span>👨‍⚕️</span> Mi Nutricionista
          </h2>
          {/* Botón cambiar — solo visible cuando hay nutricionista y el form está cerrado */}
          {nutriologo && !mostrarForm && (
            <button
              onClick={() => { setMostrarForm(true); setErrorCodigo(null); }}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors"
            >
              Cambiar
            </button>
          )}
        </div>

        {/* ── Estado actual ── */}
        {nutriologo === undefined ? (
          /* Cargando */
          <div className="space-y-2">
            <div className="h-4 bg-slate-100 rounded animate-pulse w-40" />
            <div className="h-3 bg-slate-100 rounded animate-pulse w-24" />
          </div>

        ) : nutriologo === null ? (
          /* Sin nutricionista */
          <div className="flex items-start gap-3 bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
            <span className="text-amber-500 text-lg mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Sin nutricionista vinculado</p>
              <p className="text-xs text-amber-600 mt-0.5">Ingresá el código que te dio tu nutricionista para vincularte.</p>
            </div>
          </div>

        ) : (
          /* Nutricionista vinculado */
          <div className="flex items-center gap-3 bg-green-50 rounded-xl px-4 py-3 border border-green-100">
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
              {(nutriologo.nombre.charAt(0) + (nutriologo.apellido?.charAt(0) ?? '')).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{nombreNutr}</p>
              {nutriologo.codigoInvitacion && (
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Código: <span className="text-slate-600 font-semibold">{nutriologo.codigoInvitacion}</span>
                </p>
              )}
            </div>
            <span className="text-green-500 text-lg flex-shrink-0">✓</span>
          </div>
        )}

        {/* ── Toast éxito vinculación ── */}
        {exitoVinculo && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-xl px-4 py-3">
            <span>✅</span>
            <span>¡Vinculado correctamente!</span>
          </div>
        )}

        {/* ── Formulario vincular / cambiar ── */}
        {mostrarForm && (
          <form onSubmit={handleVincular} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                {nutriologo ? 'Código del nuevo nutricionista' : 'Código de tu nutricionista'}
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoCodigo}
                  onChange={(e) => {
                    setNuevoCodigo(formatCodigo(e.target.value));
                    setErrorCodigo(null);
                  }}
                  placeholder="ABCD-1234"
                  maxLength={9}
                  autoComplete="off"
                  autoCapitalize="characters"
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-300 uppercase placeholder:normal-case placeholder:tracking-normal"
                />
                <button
                  type="submit"
                  disabled={vinculando || nuevoCodigo.length < 9}
                  className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  {vinculando ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : 'Vincular'}
                </button>
              </div>

              {errorCodigo && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <span>⚠️</span> {errorCodigo}
                </p>
              )}

              <p className="text-xs text-slate-400 mt-1.5">
                El formato es 4 letras/números, un guion, 4 letras/números. Ej: <span className="font-mono">NUTR-2025</span>
              </p>
            </div>

            {/* Cancelar — solo si ya tiene un nutricionista */}
            {nutriologo && (
              <button
                type="button"
                onClick={() => { setMostrarForm(false); setNuevoCodigo(''); setErrorCodigo(null); }}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancelar
              </button>
            )}
          </form>
        )}
      </Card>

      {/* ── Cambiar contraseña ── */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-slate-700 flex items-center gap-2">
          <span>🔒</span> Cambiar contraseña
        </h2>
        <form onSubmit={handleCambiarPwd} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Contraseña actual</label>
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
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Nueva contraseña</label>
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
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Confirmar nueva contraseña</label>
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

          {pwdError && (
            <p className="text-xs text-red-600 flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <span>⚠️</span> {pwdError}
            </p>
          )}
          {pwdOk && (
            <p className="text-xs text-green-700 flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 font-medium">
              <span>✅</span> ¡Contraseña actualizada correctamente!
            </p>
          )}

          <button
            type="submit"
            disabled={changingPwd || !currPwd || !newPwd || !confirmPwd}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {changingPwd ? (
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
      </Card>

      {/* ── Cerrar sesión ── */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50"
      >
        {loggingOut ? 'Cerrando sesión…' : (
          <>
            <span>🚪</span>
            Cerrar sesión
          </>
        )}
      </button>
    </div>
  );
}
