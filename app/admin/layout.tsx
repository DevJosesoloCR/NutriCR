import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createAuthClient } from '@/lib/supabase/server';
import AdminShell from '@/components/admin/AdminShell';

/**
 * Layout del panel de administrador.
 *
 * Lee el header `x-pathname` inyectado por el middleware para saber
 * exactamente qué ruta se está sirviendo dentro de /admin:
 *
 *  - /admin/login  → página pública de acceso: no aplica auth ni shell
 *  - todo lo demás → verifica sesión + correo y envuelve con AdminShell
 *
 * El middleware ya protege las rutas antes de que este layout se ejecute
 * (primera línea de defensa). La verificación aquí es la segunda defensa:
 * valida la firma del JWT vía createAuthClient().auth.getUser().
 */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = headers().get('x-pathname') ?? '';

  // ── Pantalla de login del admin — pública, sin shell ─────────────────────
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // ── Rutas protegidas — verificar sesión real ──────────────────────────────
  const { data: { user } } = await createAuthClient().auth.getUser();

  console.log('ADMIN_EMAIL env:', process.env.ADMIN_EMAIL, 'user email:', user?.email);

  const adminEmail = (process.env.ADMIN_EMAIL ?? '').toLowerCase().trim();

  if (!user || !adminEmail || (user.email ?? '').toLowerCase() !== adminEmail) {
    redirect('/admin/login');
  }

  return (
    <AdminShell adminEmail={user.email!}>
      {children}
    </AdminShell>
  );
}
