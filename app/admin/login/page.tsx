'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * /admin/login — Pantalla de acceso exclusiva para el administrador.
 *
 * Diseño: fondo oscuro, minimalista. Independiente del login de
 * nutricionistas y pacientes.
 *
 * Flujo:
 *  1. signInWithPassword() con Supabase Auth
 *  2. GET /api/admin/auth/check → verifica que el email sea ADMIN_EMAIL
 *  3. OK → window.location = /admin
 *     No OK → signOut() + muestra error "Acceso no autorizado"
 */
export default function AdminLogin() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // ── 1. Autenticar con Supabase ────────────────────────────────────────
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          setError('Correo o contraseña incorrectos.');
        } else if (authError.message === 'Email not confirmed') {
          setError('Confirma tu correo antes de acceder.');
        } else {
          setError(authError.message);
        }
        return;
      }

      if (!data.user) {
        setError('No se pudo obtener la sesión. Intenta de nuevo.');
        return;
      }

      // ── 2. Verificar que el usuario sea el admin (server-side) ───────────
      // No podemos acceder a process.env.ADMIN_EMAIL desde el cliente,
      // por eso usamos un endpoint que lo verifica en el servidor.
      const check = await fetch('/api/admin/auth/check');

      if (!check.ok) {
        // Sesión activa pero no es el admin → cerrar sesión y mostrar error
        await supabase.auth.signOut();
        setError('Acceso no autorizado. Este panel es exclusivo para administradores.');
        return;
      }

      // ── 3. Admin verificado → ir al panel ────────────────────────────────
      window.location.href = '/admin';

    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060b18] flex items-center justify-center px-4">

      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm">

        {/* Ícono de acceso */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30
                          flex items-center justify-center text-2xl mb-4 shadow-lg
                          shadow-indigo-500/10">
            🔐
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Panel de Administración
          </h1>
          <p className="text-slate-500 text-sm mt-1">Acceso restringido · NutriCR</p>
        </div>

        {/* Card del formulario */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-7
                        shadow-2xl shadow-black/40 backdrop-blur-sm">

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 bg-red-950/60 border border-red-800/60
                            text-red-300 text-sm rounded-xl px-4 py-3">
              <span className="flex-shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase
                                tracking-wider mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ejemplo.com"
                autoComplete="email"
                required
                className="w-full bg-slate-800/80 border border-slate-700 text-white
                           placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm
                           focus:outline-none focus:border-indigo-500 focus:ring-1
                           focus:ring-indigo-500/50 transition-colors"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase
                                tracking-wider mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full bg-slate-800/80 border border-slate-700 text-white
                           placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm
                           focus:outline-none focus:border-indigo-500 focus:ring-1
                           focus:ring-indigo-500/50 transition-colors"
              />
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
                         disabled:opacity-40 disabled:cursor-not-allowed
                         text-white font-semibold rounded-xl py-2.5 text-sm
                         transition-colors shadow-md shadow-indigo-900/40
                         flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white
                                   rounded-full animate-spin" />
                  Verificando…
                </>
              ) : (
                'Acceder al panel'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-700 text-xs mt-6">
          Acceso exclusivo para administradores de la plataforma
        </p>
      </div>
    </div>
  );
}
