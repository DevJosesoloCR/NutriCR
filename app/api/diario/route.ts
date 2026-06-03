import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePaciente } from '@/lib/supabase/auth-helpers';

const BUCKET = 'diario-comidas';

// ─── GET /api/diario ──────────────────────────────────────────────────────────
// Devuelve las últimas 20 entradas del paciente (fotos y texto).

export async function GET() {
  const auth = await requirePaciente();
  if (!auth.ok) return auth.response;

  const { data, error } = await createAdminClient()
    .from('diario_comidas')
    .select('id, foto_url, descripcion, descripcion_texto, tipo_comida, created_at')
    .eq('paciente_id', auth.data.pacienteId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// ─── POST /api/diario ─────────────────────────────────────────────────────────
// Acepta dos formatos:
//   • multipart/form-data { file, descripcion? }    → entrada con foto
//   • application/json    { texto, tipo_comida? }   → entrada de texto sin foto

export async function POST(request: Request) {
  const t0          = Date.now();
  const contentType = request.headers.get('content-type') ?? '';

  // ── Rama texto (sin foto) ────────────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    console.log('[diario] POST texto — iniciando');
    const auth = await requirePaciente();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({})) as {
      texto?: string;
      tipo_comida?: string;
    };

    const texto      = body.texto?.trim();
    const tipoComida = body.tipo_comida ?? null;

    if (!texto) {
      return NextResponse.json({ error: 'El texto no puede estar vacío' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('diario_comidas')
      .insert({
        paciente_id:       auth.data.pacienteId,
        foto_url:          null,
        descripcion_texto: texto,
        tipo_comida:       tipoComida as 'desayuno' | 'almuerzo' | 'cena' | 'merienda' | null,
      })
      .select()
      .single();

    if (error) {
      console.error('[diario] POST texto — db error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[diario] POST texto — ok | id: ${data.id} | ${Date.now() - t0}ms`);
    return NextResponse.json({ data }, { status: 201 });
  }

  // ── Rama foto ────────────────────────────────────────────────────────────────
  console.log('[diario] POST — iniciando');

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const auth = await requirePaciente();
    if (!auth.ok) {
      console.warn('[diario] POST — auth fallida');
      return auth.response;
    }
    console.log('[diario] POST — auth ok | pacienteId:', auth.data.pacienteId);

    // ── FormData ────────────────────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseErr) {
      console.error('[diario] POST — error parseando formData:', parseErr);
      return NextResponse.json(
        { error: 'Body inválido — se esperaba multipart/form-data' },
        { status: 400 },
      );
    }

    const file        = formData.get('file') as File | null;
    const descripcion = (formData.get('descripcion') as string | null)?.trim() || null;

    console.log('[diario] POST — archivo recibido:', {
      name:        file?.name        ?? '(null)',
      size:        file?.size        ?? 0,
      type:        file?.type        ?? '(null)',
      sizeKB:      file ? (file.size / 1024).toFixed(1) + ' KB' : '—',
      descripcion: descripcion ?? '(vacía)',
    });

    if (!file || file.size === 0) {
      console.warn('[diario] POST — archivo vacío o ausente');
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      console.warn('[diario] POST — archivo demasiado grande:', file.size);
      return NextResponse.json({ error: 'La imagen no puede superar 10 MB' }, { status: 413 });
    }

    // ── Buffer ──────────────────────────────────────────────────────────────
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
      console.log('[diario] POST — buffer listo | bytes:', buffer.length);
    } catch (bufErr) {
      console.error('[diario] POST — error leyendo arrayBuffer:', bufErr);
      throw bufErr;
    }

    const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const filePath = `${auth.data.pacienteId}/${Date.now()}.${ext}`;
    console.log('[diario] POST — filePath:', filePath, '| bucket:', BUCKET);

    const admin = createAdminClient();

    // ── Storage upload ──────────────────────────────────────────────────────
    const t1 = Date.now();
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType: file.type, upsert: false });

    if (uploadErr) {
      console.error('[diario] POST — upload error completo:', {
        message:    uploadErr.message,
        statusCode: (uploadErr as unknown as Record<string, unknown>).statusCode,
        error:      (uploadErr as unknown as Record<string, unknown>).error,
        cause:      (uploadErr as unknown as Record<string, unknown>).cause,
      });
      return NextResponse.json(
        { error: `Error al subir la imagen: ${uploadErr.message}` },
        { status: 500 },
      );
    }
    console.log('[diario] POST — upload ok en', Date.now() - t1, 'ms');

    // ── URL pública ─────────────────────────────────────────────────────────
    const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(filePath);
    console.log('[diario] POST — publicUrl:', publicUrl);

    // ── DB insert ───────────────────────────────────────────────────────────
    const { data, error: dbErr } = await admin
      .from('diario_comidas')
      .insert({ paciente_id: auth.data.pacienteId, foto_url: publicUrl, descripcion })
      .select()
      .single();

    if (dbErr) {
      console.error('[diario] POST — db insert error:', {
        message: dbErr.message,
        code:    dbErr.code,
        details: dbErr.details,
        hint:    dbErr.hint,
      });
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    console.log('[diario] POST — ok | id:', data.id, '| total:', Date.now() - t0, 'ms');
    return NextResponse.json({ data }, { status: 201 });

  } catch (err) {
    console.error('[diario] POST — excepción inesperada:', {
      message: err instanceof Error ? err.message    : String(err),
      stack:   err instanceof Error ? err.stack      : undefined,
      type:    err instanceof Error ? err.constructor.name : typeof err,
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
