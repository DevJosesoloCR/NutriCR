import { NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/auth/check
 *
 * Verifica si el usuario autenticado actualmente es el administrador
 * de la plataforma (email === ADMIN_EMAIL).
 *
 * Usado por /app/admin/login/page.tsx después de signInWithPassword()
 * para confirmar que el email coincide antes de redirigir al panel.
 *
 * Respuestas:
 *  200 { ok: true }           — es el admin
 *  401 { ok: false }          — sin sesión
 *  403 { ok: false }          — sesión válida pero no es el admin
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: { user } } = await createAuthClient().auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, reason: 'no_session' }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  if (!adminEmail || (user.email?.toLowerCase() ?? '') !== adminEmail) {
    return NextResponse.json({ ok: false, reason: 'not_admin' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
