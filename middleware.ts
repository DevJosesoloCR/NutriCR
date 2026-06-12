import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware de Next.js — protección de rutas y refresco de sesión.
 *
 * Usa CERO imports externos: solo APIs Web disponibles en Edge Runtime.
 * Motivo: @supabase/ssr → @supabase/realtime-js → ws → net/tls (Node.js)
 * provocaba MIDDLEWARE_INVOCATION_FAILED en Vercel.
 *
 * Seguridad: el middleware solo decide redirecciones.
 * La verificación real del token ocurre en requireNutriologo() /
 * requirePaciente() dentro de cada Route Handler con createAdminClient().
 */

// ─── Helpers base64url ────────────────────────────────────────────────────────

/**
 * Convierte una cadena base64url a string.
 * Usado para decodificar el payload del JWT y el valor de las cookies
 * de @supabase/ssr v0.5+ que usa cookieEncoding: "base64url" por defecto.
 */
function base64URLToString(b64url: string): string {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded  = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  return atob(padded);
}

// ─── JWT decode ───────────────────────────────────────────────────────────────

/**
 * Decodifica el payload de un JWT sin verificar la firma.
 * Suficiente para routing: la firma se verifica en los Route Handlers.
 */
function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(base64URLToString(part)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─── Session reader ───────────────────────────────────────────────────────────

interface SessionUser {
  tipo_usuario: string | undefined;
  email:        string | undefined;
}

/**
 * Lee la sesión de Supabase directamente desde las cookies del request.
 *
 * @supabase/ssr almacena la sesión como JSON en cookies con nombre
 * sb-<project-ref>-auth-token (puede estar dividida en chunks: .0, .1, …)
 *
 * Retorna null si:
 *   - No hay cookie de sesión
 *   - El access_token está expirado (con 60 s de gracia para el refresh del cliente)
 *   - El JSON no puede parsearse
 */
function getSessionUser(request: NextRequest): SessionUser | null {
  // Recolectar todos los chunks de la cookie de auth y ordenarlos.
  // La regex incluye ancla $ para evitar capturar cookies como
  // sb-xxx-auth-token-code-verifier o sb-xxx-auth-token-provider-token,
  // que si se concatenan al JSON hacen fallar el JSON.parse.
  const chunks = request.cookies
    .getAll()
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (chunks.length === 0) return null;

  try {
    const raw = chunks.map((c) => decodeURIComponent(c.value)).join('');

    // @supabase/ssr ≥ 0.5 almacena la cookie con cookieEncoding "base64url"
    // por defecto, prefijando el valor con "base64-".
    // Si no se decodifica antes del JSON.parse, éste falla silenciosamente
    // y el middleware devuelve null (sin sesión) aunque el login fue exitoso.
    const BASE64_PREFIX = 'base64-';
    const jsonStr = raw.startsWith(BASE64_PREFIX)
      ? base64URLToString(raw.slice(BASE64_PREFIX.length))
      : raw;

    const session = JSON.parse(jsonStr) as {
      access_token?: string;
      expires_at?:   number;      // unix timestamp del expirado del access token
    };

    if (!session?.access_token) return null;

    // expires_at viene en el JSON de sesión; si no, lo sacamos del JWT
    const payload    = decodeJWTPayload(session.access_token);
    const expiresAt  = session.expires_at ?? (payload?.exp as number | undefined) ?? 0;

    // Rechazar solo si expiró hace más de 60 s (margen para que el cliente refresque)
    if (expiresAt < Math.floor(Date.now() / 1000) - 60) return null;

    const userMeta = payload?.user_metadata as { tipo_usuario?: string } | undefined;
    const email    = payload?.email as string | undefined;

    return { tipo_usuario: userMeta?.tipo_usuario, email };
  } catch {
    return null;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = getSessionUser(request);

  // ── Admin: detectar si el usuario es el dueño de la plataforma ───────────
  // Comparación de email extraído del JWT con la variable de entorno.
  const adminEmail = (process.env.ADMIN_EMAIL ?? '').toLowerCase().trim();
  const isAdmin    = !!adminEmail && !!(user?.email) &&
                     user.email.toLowerCase() === adminEmail;

  // ── Rutas /admin — protegidas para el admin ───────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user) {
      // Sin sesión → login con ?next=/admin para volver después del login
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('next', '/admin');
      return NextResponse.redirect(loginUrl);
    }
    if (!isAdmin) {
      // Sesión activa pero no es el admin → redirigir al inicio
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Admin confirmado → dejar pasar (el layout hace la verificación final)
    return NextResponse.next();
  }

  // ── Rutas de auth — redirigir si ya hay sesión activa ────────────────────
  if (pathname.startsWith('/auth/') && user) {
    // Admin activo en /auth/* → ir directo al panel admin
    if (isAdmin) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    const dest = user.tipo_usuario === 'paciente'
      ? '/paciente/inicio'
      : '/nutriologo/dashboard';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // ── Rutas protegidas ──────────────────────────────────────────────────────
  const esNutriologo = pathname.startsWith('/nutriologo');
  const esPaciente   = pathname.startsWith('/paciente');

  if (esNutriologo || esPaciente) {
    // Sin sesión → login con ?next= para redirigir de vuelta
    if (!user) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Tipo incorrecto → redirigir al dashboard correcto.
    // Solo bloqueamos si SABEMOS con certeza el tipo equivocado.
    // Si tipo_usuario === undefined (edge case de JWT) dejamos pasar:
    // el Route Handler hará la verificación real con la base de datos.
    if (esNutriologo && user.tipo_usuario === 'paciente') {
      return NextResponse.redirect(new URL('/paciente/inicio', request.url));
    }
    if (esPaciente && user.tipo_usuario === 'nutriologo') {
      return NextResponse.redirect(new URL('/nutriologo/dashboard', request.url));
    }
  }

  // ── Raíz "/" — redirigir al dashboard correcto si hay sesión ─────────────
  if (pathname === '/') {
    if (isAdmin) {
      // Admin en raíz → ir al panel admin
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    if (user) {
      const dest = user.tipo_usuario === 'paciente'
        ? '/paciente/inicio'
        : '/nutriologo/dashboard';
      return NextResponse.redirect(new URL(dest, request.url));
    }
    // Sin sesión → landing page pública
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Ejecutar en todas las rutas EXCEPTO:
     *   - _next/static  (archivos estáticos)
     *   - _next/image   (optimización de imágenes)
     *   - favicon.ico
     *   - icons/        (PWA icons)
     *   - manifest.json (PWA manifest)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icons|manifest\\.json).*)',
  ],
};
