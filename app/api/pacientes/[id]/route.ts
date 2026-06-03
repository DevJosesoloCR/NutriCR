import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireNutriologo } from '@/lib/supabase/auth-helpers';
import { calcAdherencia, calcEstado, toCRDateKey } from '@/lib/adherencia';

// ── GET /api/pacientes/[id] ────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const { id } = params;

  const { data: paciente, error: pErr } = await supabase
    .from('pacientes')
    .select('*, usuarios(nombre, apellido, email, avatar_url)')
    .eq('id', id)
    .single();

  if (pErr || !paciente) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
  }

  // Verificar que el paciente pertenece al nutricionista autenticado
  if (paciente.nutriologo_id !== auth.data.nutriologoId) {
    return NextResponse.json({ error: 'Sin acceso a este paciente' }, { status: 403 });
  }

  const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const hace3 = new Date(Date.now() - 3 * 86_400_000).toISOString();

  const [planRes, fotosRes, recetasRes] = await Promise.all([

    supabase
      .from('planes_nutricionales')
      .select('*')
      .eq('paciente_id', id)
      .eq('activo', true)
      .maybeSingle(),

    supabase
      .from('diario_comidas')
      .select('created_at')
      .eq('paciente_id', id)
      .gte('created_at', hace7),

    supabase
      .from('recetas_generadas')
      .select('created_at')
      .eq('paciente_id', id)
      .gte('created_at', hace7),

    // Placeholder — escaneos se obtienen por separado (requiere migración en BD)
    Promise.resolve({ data: [] as never[] }),
  ]);

  const plan = planRes.data;

  // Escaneos de tiquete: query separada hasta que se aplique la migración de paciente_id
  // ALTER TABLE inventario ADD COLUMN IF NOT EXISTS paciente_id uuid REFERENCES pacientes(id);
  let escaneosRaw: { data: { id: string }[] | null } = { data: null };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    escaneosRaw = await (supabase as any)
      .from('inventario')
      .select('id')
      .eq('paciente_id', id)
      .gte('created_at', hace7);
  } catch {
    // La columna paciente_id aún no existe — ejecutar migración SQL pendiente
  }

  // Días únicos con foto en los últimos 7 días
  const fotosUnicos = new Set(
    (fotosRes.data ?? []).map((f) => toCRDateKey(f.created_at as string)),
  ).size;

  const recetasCount  = (recetasRes.data  ?? []).length;
  const escaneosCount = (escaneosRaw.data ?? []).length;

  // Días activos desde el registro (mín. 1, máx. 7) — denominador real de fotos
  const daysSinceReg = Math.floor((Date.now() - new Date(paciente.created_at).getTime()) / 86_400_000);
  const diasActivos  = Math.min(7, daysSinceReg + 1);

  // ¿Tiene alguna foto en los últimos 3 días?
  // Pacientes registrados hace menos de 3 días no se marcan como "sin foto reciente".
  const sinFotoReciente = daysSinceReg >= 3 && !(fotosRes.data ?? []).some(
    (f) => (f.created_at as string) >= hace3,
  );

  const adherencia = calcAdherencia({ fotosUnicos, recetasCount, escaneosCount, diasActivos });
  const estado     = calcEstado(adherencia, sinFotoReciente);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usuario = (paciente as any).usuarios as { nombre: string; apellido: string | null; email: string; avatar_url: string | null } | null;

  return NextResponse.json({
    paciente: {
      id:                  paciente.id,
      nombre:              usuario?.nombre              ?? '',
      apellido:            usuario?.apellido            ?? null,
      email:               usuario?.email               ?? '',
      avatar_url:          usuario?.avatar_url          ?? null,
      objetivo:            paciente.objetivo,
      condiciones_medicas: paciente.condiciones_medicas ?? [],
      alergias:            paciente.alergias            ?? [],
      peso:                paciente.peso,
      altura:              paciente.altura,
      fecha_nacimiento:    paciente.fecha_nacimiento,
      // Datos extendidos de perfil
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sexo:            (paciente as any).sexo            ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      estatura_cm:     (paciente as any).estatura_cm     ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      peso_meta_kg:    (paciente as any).peso_meta_kg    ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nivel_actividad: (paciente as any).nivel_actividad ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ocupacion:       (paciente as any).ocupacion       ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      telefono:        (paciente as any).telefono        ?? null,
    },
    plan: plan ?? null,
    adherencia,
    estado,          // 'Al día' | 'Revisar' | 'Urgente'
  });
}

// ── PATCH /api/pacientes/[id] ──────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const body = await request.json() as {
    objetivo?: string | null;
    condiciones_medicas?: string[];
    alergias?: string[];            // ← nuevo
  };

  const { error } = await supabase
    .from('pacientes')
    .update({
      ...(body.objetivo !== undefined            && { objetivo:            body.objetivo }),
      ...(body.condiciones_medicas !== undefined && { condiciones_medicas: body.condiciones_medicas }),
      ...(body.alergias            !== undefined && { alergias:            body.alergias }),  // ← nuevo
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('nutriologo_id', auth.data.nutriologoId); // guard

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
