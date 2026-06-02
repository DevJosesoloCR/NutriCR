import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePaciente } from '@/lib/supabase/auth-helpers';

// ─── GET /api/notificaciones ──────────────────────────────────────────────────
// Devuelve las notificaciones del paciente autenticado (máx 30).

export async function GET() {
  const auth = await requirePaciente();
  if (!auth.ok) return auth.response;

  const { data, error } = await createAdminClient()
    .from('notificaciones')
    .select('id, tipo, mensaje, leida, created_at')
    .eq('paciente_id', auth.data.pacienteId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const noLeidas = (data ?? []).filter((n) => !n.leida).length;
  return NextResponse.json({ data: data ?? [], noLeidas });
}

// ─── PATCH /api/notificaciones ────────────────────────────────────────────────
// Marca todas (o una) notificación como leída.
// Body: {} → marca todas. { id } → marca solo esa.
// También sincroniza notas.leida para que el dashboard del nutricionista
// refleje el estado actualizado en tiempo real.

export async function PATCH(request: Request) {
  const auth = await requirePaciente();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({})) as { id?: string };
  const admin = createAdminClient();

  // 1. Actualizar tabla notificaciones
  let query = admin
    .from('notificaciones')
    .update({ leida: true })
    .eq('paciente_id', auth.data.pacienteId)
    .eq('leida', false);

  if (body.id) query = query.eq('id', body.id) as typeof query;

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2. Sincronizar tabla notas — marcar como leídas las notas no leídas
  //    del mismo paciente (la notificación de tipo 'nota' corresponde a una nota).
  if (body.id) {
    const { data: notif, error: notifErr } = await admin
      .from('notificaciones')
      .select('mensaje, tipo')
      .eq('id', body.id)
      .single();

    if (notifErr) {
      console.error('[notificaciones PATCH] Error buscando notificación:', notifErr.message);
    } else if (notif?.tipo === 'nota' && notif.mensaje) {
      const { error: notaErr, count } = await admin
        .from('notas')
        .update({ leida: true })
        .eq('paciente_id', auth.data.pacienteId)
        .eq('mensaje', notif.mensaje)
        .eq('leida', false)
        .select('id', { count: 'exact', head: true });

      if (notaErr) {
        console.error('[notificaciones PATCH] Error actualizando nota:', notaErr.message);
      } else {
        console.log(`[notificaciones PATCH] ✓ Nota marcada como leída (1 notif). notas actualizadas: ${count}`);
      }
    }
  } else {
    // Marcar todas → sincronizar todas las notas no leídas del paciente
    const { error: notasErr, count } = await admin
      .from('notas')
      .update({ leida: true })
      .eq('paciente_id', auth.data.pacienteId)
      .eq('leida', false)
      .select('id', { count: 'exact', head: true });

    if (notasErr) {
      console.error('[notificaciones PATCH] Error actualizando notas (bulk):', notasErr.message);
    } else {
      console.log(`[notificaciones PATCH] ✓ Notas marcadas como leídas (bulk). notas actualizadas: ${count}`);
    }
  }

  return NextResponse.json({ ok: true });
}
