import { NextResponse }                              from 'next/server';
import { createAdminClient, createAuthClient }       from '@/lib/supabase/server';

const BUCKET  = 'avatares';
const MAX_MB  = 5;
const MAX_B   = MAX_MB * 1024 * 1024;

// ─── POST /api/user/avatar ────────────────────────────────────────────────────
// Acepta multipart/form-data con campo 'file' (imagen ya convertida a JPEG).
// 1. Verifica sesión con createAuthClient (lee cookies del request)
// 2. Sube a Storage con admin client (bypass RLS, service role key)
// 3. Actualiza tabla usuarios.avatar_url con admin client
// 4. Actualiza user_metadata con auth client autenticado
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {

  // ── 1. Verificar sesión ──────────────────────────────────────────────────
  // IMPORTANTE: createAuthClient() lee las cookies del request (sb-*-auth-token).
  // createServerClient() usa solo anon key sin cookies → getUser() siempre null.
  const authClient = createAuthClient();
  const { data: { user }, error: authErr } = await authClient.auth.getUser();

  if (authErr || !user) {
    console.error('[avatar] Auth error:', authErr?.message ?? 'No user in session');
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  console.log('[avatar] Usuario autenticado:', user.id);

  // ── 2. Parsear form data ──────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    console.error('[avatar] Error al parsear FormData:', e);
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;

  if (!file || file.size === 0) {
    console.error('[avatar] No se recibió archivo o está vacío');
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
  }

  if (file.size > MAX_B) {
    console.error(`[avatar] Archivo demasiado grande: ${file.size} bytes`);
    return NextResponse.json(
      { error: `La imagen no puede superar ${MAX_MB} MB` },
      { status: 413 },
    );
  }

  console.log(`[avatar] Archivo recibido: ${file.name}, ${file.size} bytes, ${file.type}`);

  // ── 3. Subir a Storage ────────────────────────────────────────────────────
  const admin    = createAdminClient();
  const buffer   = Buffer.from(await file.arrayBuffer());
  // Ruta plana: {userId}.jpg  (upsert = sobreescribe el avatar anterior)
  const filePath = `${user.id}.jpg`;

  console.log(`[avatar] Subiendo a storage: ${BUCKET}/${filePath}`);

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType: 'image/jpeg', upsert: true });

  if (uploadErr) {
    console.error('[avatar] Error en storage.upload:', uploadErr.message, uploadErr);
    return NextResponse.json({ error: `Storage: ${uploadErr.message}` }, { status: 500 });
  }

  console.log('[avatar] Upload exitoso');

  // ── 4. URL pública ────────────────────────────────────────────────────────
  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(filePath);
  // Cache-buster: fuerza recarga en el browser aunque la ruta sea la misma
  const urlFinal = `${publicUrl}?t=${Date.now()}`;

  console.log('[avatar] URL pública:', urlFinal);

  // ── 5. Actualizar tabla usuarios ──────────────────────────────────────────
  const { error: dbErr } = await admin
    .from('usuarios')
    .update({ avatar_url: urlFinal, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (dbErr) {
    console.error('[avatar] Error al actualizar tabla usuarios:', dbErr.message, dbErr);
    return NextResponse.json({ error: `DB: ${dbErr.message}` }, { status: 500 });
  }

  console.log('[avatar] tabla usuarios actualizada correctamente');

  // ── 6. Actualizar user_metadata (acceso rápido sin DB query) ─────────────
  // Usar authClient (con sesión real del usuario) para updateUser
  const { error: metaErr } = await authClient.auth.updateUser({
    data: { avatar_url: urlFinal },
  });

  if (metaErr) {
    // No crítico: la tabla usuarios ya tiene la URL. Solo loguear.
    console.warn('[avatar] updateUser metadata falló (no crítico):', metaErr.message);
  }

  return NextResponse.json({ url: urlFinal });
}
