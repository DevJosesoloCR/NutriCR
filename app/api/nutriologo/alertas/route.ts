import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireNutriologo } from '@/lib/supabase/auth-helpers';

export interface AlertaNutriologo {
  id:      string;
  nombre:  string;
  tipo:    'urgente' | 'revisar' | 'nuevo';
  mensaje: string;
}

// ─── GET /api/nutriologo/alertas ──────────────────────────────────────────────
// Devuelve alertas para el panel de notificaciones del nutricionista:
//   • Pacientes sin foto en los últimos 3 días → 'urgente'
//   • Pacientes sin foto en los últimos 5 días → 'revisar'
//   • Pacientes registrados en los últimos 7 días → 'nuevo'

export async function GET() {
  const auth = await requireNutriologo();
  if (!auth.ok) return auth.response;
  const { nutriologoId } = auth.data;

  const admin = createAdminClient();

  // Pacientes del nutricionista con datos de usuario
  const { data: pacientes, error } = await admin
    .from('pacientes')
    .select('id, created_at, usuarios(nombre, apellido)')
    .eq('nutriologo_id', nutriologoId)
    .order('created_at', { ascending: false });

  if (error || !pacientes?.length) {
    return NextResponse.json({ alertas: [] });
  }

  const ahora    = Date.now();
  const hace3d   = new Date(ahora - 3 * 86_400_000).toISOString();
  const hace5d   = new Date(ahora - 5 * 86_400_000).toISOString();
  const hace7d   = new Date(ahora - 7 * 86_400_000).toISOString();

  const pacienteIds = pacientes.map((p) => p.id);

  // Última foto por paciente
  const { data: fotos } = await admin
    .from('diario_comidas')
    .select('paciente_id, created_at')
    .in('paciente_id', pacienteIds)
    .gte('created_at', hace7d)
    .order('created_at', { ascending: false });

  // Mapa: pacienteId → fecha de última foto
  const ultimaFoto = new Map<string, string>();
  for (const f of fotos ?? []) {
    if (!ultimaFoto.has(f.paciente_id)) {
      ultimaFoto.set(f.paciente_id, f.created_at as string);
    }
  }

  const alertas: AlertaNutriologo[] = [];

  for (const p of pacientes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usuario = (p as any).usuarios as { nombre: string; apellido: string | null } | null;
    const nombre  = usuario ? `${usuario.nombre}${usuario.apellido ? ' ' + usuario.apellido : ''}` : 'Paciente';
    const registrado = new Date(p.created_at as string).toISOString();
    const ultima  = ultimaFoto.get(p.id);

    // Nuevo (registrado en últimos 7 días)
    if (registrado >= hace7d) {
      alertas.push({ id: p.id, nombre, tipo: 'nuevo', mensaje: 'Se registró recientemente' });
      continue;
    }

    // Sin foto en últimos 3 días → urgente
    if (!ultima || ultima < hace3d) {
      alertas.push({ id: p.id, nombre, tipo: 'urgente', mensaje: 'Sin registro de comidas en 3+ días' });
      continue;
    }

    // Sin foto en últimos 5 días → revisar
    if (ultima < hace5d) {
      alertas.push({ id: p.id, nombre, tipo: 'revisar', mensaje: 'Poca actividad esta semana' });
    }
  }

  // Ordenar: urgente → revisar → nuevo; máx 8
  const orden = { urgente: 0, revisar: 1, nuevo: 2 };
  alertas.sort((a, b) => orden[a.tipo] - orden[b.tipo]);

  return NextResponse.json({ alertas: alertas.slice(0, 8) });
}
