import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireNutriologo } from '@/lib/supabase/auth-helpers';

// ── POST /api/planes/[id]/asignar ─────────────────────────────────────────────
// Asigna la plantilla de plan a uno o más pacientes.
// Body: { paciente_id: string }
//
// Lógica:
//   - Verifica que el plan y el paciente pertenecen al nutricionista autenticado.
//   - Si el paciente ya tiene un plan activo → actualiza contenido_json.
//   - Si no tiene plan activo → crea uno nuevo con activo = true.
// Un plan puede asignarse a múltiples pacientes (es una copia del contenido_json).

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;

  const body = await request.json() as { paciente_id?: string };
  const { paciente_id } = body;

  if (!paciente_id) {
    return NextResponse.json({ error: 'paciente_id es requerido' }, { status: 400 });
  }

  const admin  = createAdminClient();

  // ── 1. Obtener la plantilla ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: template, error: tplErr } = await (admin.from('planes_nutricionales') as any)
    .select('id, nombre, contenido_json')
    .eq('id', params.id)
    .eq('nutriologo_id', auth.data.nutriologoId)
    .is('paciente_id', null)  // solo plantillas
    .single() as { data: { id: string; nombre: string; contenido_json: unknown } | null; error: unknown };

  if (tplErr || !template) {
    return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
  }

  // ── 2. Verificar que el paciente pertenece a este nutricionista ─────────────
  const { data: paciente, error: pacErr } = await admin
    .from('pacientes')
    .select('id, usuarios(nombre, apellido)')
    .eq('id', paciente_id)
    .eq('nutriologo_id', auth.data.nutriologoId)
    .maybeSingle();

  if (pacErr || !paciente) {
    return NextResponse.json(
      { error: 'Paciente no encontrado o no asignado a este nutricionista' },
      { status: 404 },
    );
  }

  const usuData = Array.isArray(paciente.usuarios)
    ? paciente.usuarios[0]
    : paciente.usuarios;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pTbl = admin.from('planes_nutricionales') as any;

  // ── 3. Buscar plan activo existente del paciente ────────────────────────────
  const { data: existing } = await admin
    .from('planes_nutricionales')
    .select('id')
    .eq('paciente_id', paciente_id)
    .eq('activo', true)
    .maybeSingle();

  if (existing) {
    // ── 4a. Actualizar plan existente ─────────────────────────────────────────
    const { error } = await pTbl
      .update({
        nombre:         template.nombre,
        contenido_json: template.contenido_json,
        updated_at:     new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // ── 4b. Crear nuevo plan para el paciente ─────────────────────────────────
    const { error } = await pTbl.insert({
      paciente_id,
      nutriologo_id:  auth.data.nutriologoId,
      nombre:         template.nombre,
      contenido_json: template.contenido_json,
      activo:         true,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── 5. Devolver nombre del paciente para el mensaje de confirmación ─────────
  const nombrePaciente = [
    (usuData as { nombre?: string })?.nombre,
    (usuData as { apellido?: string })?.apellido,
  ]
    .filter(Boolean)
    .join(' ') || 'el paciente';

  return NextResponse.json({ ok: true, nombrePaciente });
}
