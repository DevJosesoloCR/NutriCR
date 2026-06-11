import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePaciente } from '@/lib/supabase/auth-helpers';
import { anthropic } from '@/lib/anthropic/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TiempoComida {
  horario:      string;
  porciones:    string;
  ejemplo_menu: string;
}

type TiempoKey = 'desayuno' | 'merienda_am' | 'almuerzo' | 'merienda_pm' | 'cena' | 'colado_nocturno';

interface PlanClinico {
  tiempos:                  Partial<Record<TiempoKey, TiempoComida>>;
  observaciones:            string;
  restricciones_especiales: string;
  mensaje_motivacional:     string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INGREDIENTES_CR_FALLBACK = [
  'arroz', 'frijoles negros', 'pollo', 'plátano maduro', 'tortillas de maíz',
  'huevos', 'tomate', 'cebolla', 'chile dulce', 'culantro', 'ajo',
  'papa', 'zanahoria', 'repollo', 'aguacate', 'chayote', 'yuca',
];

const TIEMPO_LABELS: Record<TiempoKey, string> = {
  desayuno:        'Desayuno',
  merienda_am:     'Merienda AM',
  almuerzo:        'Almuerzo',
  merienda_pm:     'Merienda PM',
  cena:            'Cena',
  colado_nocturno: 'Colado Nocturno',
};

const JSON_SCHEMA_COMIDA =
  '{"nombre": string, "ingredientes": string[], "instrucciones": string[], ' +
  '"macros": {"calorias": number, "proteina": number, "carbos": number, "grasas": number}}';

/** Prompt sin plan clínico — usa ingredientes de la despensa */
function buildPromptSinPlan(listaProductos: string): string {
  return (
    `Eres un nutricionista costarricense. ` +
    `Con estos ingredientes disponibles: ${listaProductos}, ` +
    `genera un menú para el día con desayuno, almuerzo, cena y una merienda. ` +
    `Usa ingredientes típicos costarricenses cuando sea posible. ` +
    `Para cada comida incluye: nombre del plato, ingredientes con cantidades, ` +
    `instrucciones simples y macros aproximados (calorías, proteína, carbohidratos, grasas). ` +
    `Responde ÚNICAMENTE en JSON con esta estructura: ` +
    `{ "menu": { "desayuno": ${JSON_SCHEMA_COMIDA}, "almuerzo": ${JSON_SCHEMA_COMIDA}, ` +
    `"cena": ${JSON_SCHEMA_COMIDA}, "merienda": ${JSON_SCHEMA_COMIDA} } }`
  );
}

/** Prompt con plan clínico — respeta horarios, porciones y restricciones */
function buildPromptConPlan(listaProductos: string, plan: PlanClinico): string {
  const tiemposStr = (Object.entries(plan.tiempos) as [TiempoKey, TiempoComida][])
    .filter(([, t]) => t.horario || t.porciones)
    .map(([k, t]) => {
      const partes: string[] = [`${TIEMPO_LABELS[k]} a las ${t.horario || '—'}`];
      if (t.porciones)    partes.push(`Porciones: ${t.porciones}`);
      if (t.ejemplo_menu) partes.push(`Ejemplo indicado: ${t.ejemplo_menu}`);
      return partes.join(' | ');
    })
    .join('\n');

  return (
    `Eres un nutricionista costarricense. ` +
    `El paciente tiene el siguiente plan alimentario clínico asignado:\n\n` +
    `TIEMPOS DE COMIDA:\n${tiemposStr}\n` +
    (plan.restricciones_especiales
      ? `\nRESTRICCIONES ESPECIALES: ${plan.restricciones_especiales}\n`
      : '') +
    (plan.observaciones
      ? `\nOBSERVACIONES DEL NUTRICIONISTA: ${plan.observaciones}\n`
      : '') +
    `\nCon los ingredientes disponibles: ${listaProductos}, ` +
    `genera recetas concretas para hoy respetando el plan del nutricionista. ` +
    `Respeta los horarios, las porciones y las restricciones indicadas. ` +
    `Usa ingredientes típicos costarricenses cuando sea posible. ` +
    `Para cada comida incluye: nombre del plato, ingredientes con cantidades, ` +
    `instrucciones simples y macros aproximados (calorías, proteína, carbohidratos, grasas). ` +
    `Responde ÚNICAMENTE en JSON con esta estructura: ` +
    `{ "menu": { "desayuno": ${JSON_SCHEMA_COMIDA}, "almuerzo": ${JSON_SCHEMA_COMIDA}, ` +
    `"cena": ${JSON_SCHEMA_COMIDA}, "merienda": ${JSON_SCHEMA_COMIDA} } }`
  );
}

/** Fecha de hoy en zona horaria de Costa Rica (UTC-6, sin DST). */
function hoyEnCR(): string {
  const crMs = Date.now() - 6 * 60 * 60 * 1000;
  return new Date(crMs).toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// ─── GET /api/generar-recetas ─────────────────────────────────────────────────
// Devuelve el menú ya guardado para HOY si existe, o { menu: null } si no.

export async function GET() {
  try {
    const auth = await requirePaciente();
    if (!auth.ok) return auth.response;

    const { pacienteId } = auth.data;
    const hoy = hoyEnCR();

    console.log(`[generar-recetas] GET — pacienteId: ${pacienteId} — fecha: ${hoy}`);

    const { data, error } = await createAdminClient()
      .from('recetas_generadas')
      .select('menu, created_at')
      .eq('paciente_id', pacienteId)
      .eq('fecha', hoy)
      .is('tipo_comida', null)
      .maybeSingle();

    if (error) {
      console.error('[generar-recetas] GET Supabase error:', error.message);
      return NextResponse.json({ menu: null, debugError: error.message });
    }

    if (data?.menu) {
      console.log('[generar-recetas] GET — menú encontrado para hoy ✓');
    } else {
      console.log('[generar-recetas] GET — no hay menú guardado para hoy');
    }

    return NextResponse.json({ menu: data?.menu ?? null, fecha: hoy });

  } catch (err) {
    console.error('[generar-recetas] GET catch:', err);
    return NextResponse.json({ menu: null });
  }
}

// ─── POST /api/generar-recetas ────────────────────────────────────────────────
// Genera un nuevo menú con Claude usando:
//   1. El plan clínico del paciente (si existe) → prompt contextualizado
//   2. Ingredientes de la despensa (si hay) o ingredientes típicos CR como fallback
// Persiste el menú generado y lo devuelve.

export async function POST() {
  try {
    const auth = await requirePaciente();
    if (!auth.ok) return auth.response;

    const { pacienteId, nutriologoId } = auth.data;
    const admin = createAdminClient();
    const hoy   = hoyEnCR();

    // ── 1. Plan clínico del paciente ────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: planData } = await (admin.from('planes_nutricionales') as any)
      .select('contenido_json')
      .eq('paciente_id', pacienteId)
      .eq('activo', true)
      .maybeSingle() as { data: { contenido_json: PlanClinico | null } | null };

    const planClinico: PlanClinico | null = planData?.contenido_json ?? null;

    // ── 2. Despensa del nutricionista (si tiene uno asignado) ────────────────
    let inventario: { nombre: string; stock: number; unidad_medida: string | null }[] = [];

    if (nutriologoId) {
      const { data, error: invError } = await admin
        .from('inventario')
        .select('nombre, stock, unidad_medida')
        .eq('nutriologo_id', nutriologoId)
        .eq('categoria', 'tiquete-escaneado')
        .order('created_at', { ascending: false });

      if (invError) {
        console.error('[generar-recetas] fetch inventario:', invError);
      } else {
        inventario = data ?? [];
      }
    }

    // ── 3. Lista de ingredientes ─────────────────────────────────────────────
    const usandoDespensa = inventario.length > 0;
    const listaProductos = usandoDespensa
      ? inventario
          .map((item) => `${item.nombre} (${item.stock} ${item.unidad_medida ?? 'und'})`)
          .join(', ')
      : INGREDIENTES_CR_FALLBACK.join(', ');

    // ── 4. Construir prompt ──────────────────────────────────────────────────
    const prompt = planClinico
      ? buildPromptConPlan(listaProductos, planClinico)
      : buildPromptSinPlan(listaProductos);

    console.log(`[generar-recetas] usandoPlan: ${!!planClinico} | usandoDespensa: ${usandoDespensa}`);

    // ── 5. Llamar a Claude ───────────────────────────────────────────────────
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-5',
      max_tokens: 2048,
      messages:   [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    if (block.type !== 'text') {
      return NextResponse.json({ error: 'El modelo no devolvió texto' }, { status: 500 });
    }

    // ── 6. Parsear respuesta ─────────────────────────────────────────────────
    const raw = block.text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');

    let parsed: { menu: Record<string, unknown> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error('[generar-recetas] JSON inválido de Claude:', raw.slice(0, 300));
      return NextResponse.json(
        { error: 'La IA devolvió una respuesta con formato inválido' },
        { status: 500 },
      );
    }

    const COMIDAS_REQUERIDAS = ['desayuno', 'almuerzo', 'cena', 'merienda'];
    if (!parsed?.menu || COMIDAS_REQUERIDAS.some((c) => !parsed.menu[c])) {
      return NextResponse.json(
        { error: 'La respuesta de la IA no incluye todas las comidas del día' },
        { status: 500 },
      );
    }

    // ── 7. Persistir (sobreescribir si ya hay menú de hoy) ──────────────────
    const { error: deleteErr, count: deleteCount } = await admin
      .from('recetas_generadas')
      .delete({ count: 'exact' })
      .eq('paciente_id', pacienteId)
      .eq('fecha', hoy)
      .is('tipo_comida', null);

    if (deleteErr) {
      console.error('[generar-recetas] delete error:', deleteErr);
    } else {
      console.log(`[generar-recetas] delete OK — filas eliminadas: ${deleteCount ?? 0}`);
    }

    const insertPayload = {
      paciente_id:     pacienteId,
      nombre:          `menu_diario_${hoy}`,
      generada_por_ia: true,
      tipo_comida:     null,
      fecha:           hoy,
      menu:            JSON.parse(JSON.stringify(parsed.menu)),
    };

    const { error: insertErr, data: insertData } = await admin
      .from('recetas_generadas')
      .insert(insertPayload)
      .select('id, fecha')
      .single();

    if (insertErr) {
      console.error('[generar-recetas] insert ERROR:', insertErr.message);
    } else {
      console.log('[generar-recetas] insert OK — id:', insertData?.id, '— fecha:', insertData?.fecha);
    }

    return NextResponse.json({
      menu:               parsed.menu,
      usandoIngredientes: usandoDespensa ? 'despensa' : 'tipicos_cr',
      usandoPlan:         !!planClinico,
      fecha:              hoy,
    });

  } catch (err) {
    console.error('[generar-recetas] catch:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
