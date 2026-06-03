'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const searchParams = useSearchParams();
  const next         = searchParams.get('next');

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // ── Recuperar contraseña ────────────────────────────────────────────────────
  const [showReset,   setShowReset]   = useState(false);
  const [resetEmail,  setResetEmail]  = useState('');
  const [resetLoad,   setResetLoad]   = useState(false);
  const [resetSent,   setResetSent]   = useState(false);
  const [resetError,  setResetError]  = useState<string | null>(null);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoad(true);
    setResetError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (err) { setResetError(err.message); return; }
      setResetSent(true);
    } catch {
      setResetError('Error de conexión. Intentá de nuevo.');
    } finally {
      setResetLoad(false);
    }
  }

  function cerrarReset() {
    setShowReset(false);
    setResetEmail('');
    setResetSent(false);
    setResetError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email:    email.trim(),
        password,
      });

      // ── Error de autenticación ───────────────────────────────────────────────
      if (authError) {
        if (authError.message === 'Email not confirmed') {
          setError('Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.');
        } else if (authError.message === 'Invalid login credentials') {
          setError('Email o contraseña incorrectos.');
        } else {
          setError(authError.message);
        }
        return;    // finally → setLoading(false)
      }

      if (!data.user) {
        setError('No se pudo obtener la sesión. Intenta de nuevo.');
        return;
      }

      // ── Determinar destino ───────────────────────────────────────────────────
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
      const tipo     = data.user.user_metadata?.tipo_usuario as string | undefined;
      const destino  = safeNext ?? (tipo === 'paciente' ? '/paciente/inicio' : '/nutriologo/dashboard');

      window.location.href = destino;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
      {/* ── Fondo hero ──────────────────────────────────────────────────────── */}
      <img
        src="/images/hero5.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* ── Overlay ─────────────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(255,255,255,0.15)' }}
      />

      {/* ── Logo + nombre ───────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center gap-3 mb-6">
        <img
          src="/icons/icon-192x192.png"
          alt="Nutri Smart CR"
          width={52}
          height={52}
          className="rounded-xl shadow-md"
        />
        <span
          className="text-2xl font-bold text-white"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.45)' }}
        >
          Nutri Smart CR
        </span>
      </div>

      {/* ── Card del formulario ─────────────────────────────────────────────── */}
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl shadow-2xl p-8"
        style={{ background: 'rgba(255,255,255,0.90)' }}
      >
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Iniciar sesión</h2>
        <p className="text-slate-400 text-sm mb-6">Ingresa tus credenciales para continuar.</p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <span className="text-red-500 flex-shrink-0 mt-0.5">⚠️</span>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="email"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Ingresando…
              </span>
            ) : (
              'Iniciar sesión'
            )}
          </button>

          {/* ── Olvidé mi contraseña ── */}
          <button
            type="button"
            onClick={() => { setShowReset(true); setResetEmail(email); }}
            className="w-full text-center text-sm text-brand-600 hover:text-brand-800 transition-colors mt-1"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-200">
          <p className="text-sm text-slate-500 text-center mb-4">¿Eres nuevo en Nutri Smart CR?</p>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/auth/registro/nutriologo"
              className="flex flex-col items-center gap-1.5 border border-slate-200 rounded-xl p-4 text-center hover:border-brand-300 hover:bg-brand-50 transition-all"
            >
              <span className="text-2xl">🩺</span>
              <span className="text-xs font-semibold text-slate-700">Soy Nutricionista</span>
            </Link>
            <Link
              href="/auth/registro/paciente"
              className="flex flex-col items-center gap-1.5 border border-slate-200 rounded-xl p-4 text-center hover:border-brand-300 hover:bg-brand-50 transition-all"
            >
              <span className="text-2xl">🙋</span>
              <span className="text-xs font-semibold text-slate-700">Soy Paciente</span>
            </Link>
          </div>
        </div>
      </div>
      {/* ── Modal recuperar contraseña ── */}
      {showReset && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={cerrarReset}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {!resetSent ? (
              <>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Recuperar contraseña</h3>
                <p className="text-sm text-slate-400 mb-5">
                  Ingresá tu correo y te enviaremos un enlace para restablecer tu contraseña.
                </p>

                {resetError && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <span>⚠️</span> {resetError}
                  </div>
                )}

                <form onSubmit={handleReset} className="space-y-4">
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    autoFocus
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={resetLoad || !resetEmail.trim()}
                    className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {resetLoad ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Enviando…
                      </>
                    ) : 'Enviar enlace de recuperación'}
                  </button>
                  <button type="button" onClick={cerrarReset} className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors">
                    Cancelar
                  </button>
                </form>
              </>
            ) : (
              /* ── Confirmación enviada ── */
              <div className="text-center py-4 space-y-4">
                <div className="text-5xl">📬</div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">¡Correo enviado!</h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Revisá tu bandeja de entrada en <span className="font-semibold text-slate-700">{resetEmail}</span> para restablecer tu contraseña.
                  </p>
                </div>
                <button
                  onClick={cerrarReset}
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Entendido
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
