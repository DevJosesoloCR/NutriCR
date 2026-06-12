import { redirect } from 'next/navigation';
import { createAuthClient } from '@/lib/supabase/server';
import AdminShell from '@/components/admin/AdminShell';

/**
 * Layout del panel de administrador.
 * Server Component: verifica en el servidor que el usuario autenticado
 * sea el administrador de la plataforma (ADMIN_EMAIL).
 * Si no cumple, redirige a /.
 */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: { user } } = await createAuthClient().auth.getUser();

  console.log('ADMIN_EMAIL env:', process.env.ADMIN_EMAIL, 'user email:', user?.email);

  const adminEmail = (process.env.ADMIN_EMAIL ?? '').toLowerCase().trim();

  if (!user || !adminEmail || (user.email ?? '').toLowerCase() !== adminEmail) {
    redirect('/');
  }

  return (
    <AdminShell adminEmail={user.email!}>
      {children}
    </AdminShell>
  );
}
