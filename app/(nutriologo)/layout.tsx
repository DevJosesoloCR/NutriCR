import NutriShell         from '@/components/nutriologo/NutriShell';
import { AvatarProvider } from '@/context/AvatarContext';

/**
 * Layout del panel del nutricionista.
 * Mantiene el AvatarProvider aquí (Server Component puede importar
 * Client Components sin problema en Next.js 14 App Router).
 */
export default function NutriologoLayout({ children }: { children: React.ReactNode }) {
  return (
    <AvatarProvider>
      <NutriShell>{children}</NutriShell>
    </AvatarProvider>
  );
}
