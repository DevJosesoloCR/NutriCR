import { NextResponse } from 'next/server';
import { createAdminClient, createServerClient } from '@/lib/supabase/server';

const BUCKET = 'avatares';

// ─── POST /api/user/avatar ────────────────────────────────────────────────────
// Acepta multipart/form-data con campo 'file' (imagen).
// Sube a avatares/{userId}/avatar.jpg y actualiza usuarios.avatar_url
// + auth user_metadata.avatar_url para acceso rápido en el cliente.

export async function POST(request: Request) {
  // Verificar sesión (cualquier usuario autenticado)
  const supabaseUser = createServerClient();
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Parsear form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'La imagen no puede superar 5 MB' }, { status: 413 });
  }

  const buffer   = Buffer.from(await file.arrayBuffer());
  const filePath = `${user.id}/avatar.jpg`;
  const admin    = createAdminClient();

  // Subir (upsert para sobreescribir avatar anterior)
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType: 'image/jpeg', upsert: true });

  if (uploadErr) {
    console.error('[avatar] upload error:', uploadErr.message);
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Obtener URL pública (añadir cache-buster para forzar recarga)
  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(filePath);
  const urlConCache = `${publicUrl}?t=${Date.now()}`;

  // Actualizar tabla usuarios
  const { error: dbErr } = await admin
    .from('usuarios')
    .update({ avatar_url: urlConCache, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (dbErr) {
    console.error('[avatar] db update error:', dbErr.message);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  // Guardar también en user_metadata para acceso rápido sin DB query
  await supabaseUser.auth.updateUser({ data: { avatar_url: urlConCache } });

  return NextResponse.json({ url: urlConCache });
}
