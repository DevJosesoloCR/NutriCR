export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/**
 * Tipos de base de datos generados para NutriCR.
 *
 * Estructura exigida por el SDK de Supabase (@supabase/supabase-js v2):
 *   Database['public'] debe extender GenericSchema, que requiere:
 *     { Tables: Record<string, GenericTable>, Views: ..., Functions: ... }
 *
 *   GenericTable requiere el campo Relationships: GenericRelationship[]
 *   Sin él, Database['public'] no satisface GenericSchema y Schema resuelve
 *   a never, haciendo que todos los tipos de .from() sean never[].
 *
 * Notas sobre Insert/Update:
 *   - id es opcional (tiene DEFAULT gen_random_uuid() en Postgres)
 *   - created_at / updated_at son opcionales (DEFAULT NOW() + triggers)
 */
export interface Database {
  public: {
    /**
     * Views y Functions vacíos — requeridos por GenericSchema.
     * Agregar entradas cuando se creen vistas o funciones RPC en Supabase.
     */
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };

    Tables: {
      alimentos: {
        Row: {
          id:            string;
          nombre:        string;
          codigo_barras: string | null;
          calorias_100g: number;
          proteina_100g: number;
          carbos_100g:   number;
          grasas_100g:   number;
          fibra_100g:    number | null;
          fuente:          'openfoodfacts' | 'usda' | 'manual' | 'ia';
          validado:        boolean;
          nombre_original: string | null;
          pais:            string | null;
          imagen_url:      string | null;
          created_at:      string;
        };
        Insert: {
          id?:              string;
          nombre:           string;
          codigo_barras?:   string | null;
          calorias_100g?:   number;
          proteina_100g?:   number;
          carbos_100g?:     number;
          grasas_100g?:     number;
          fibra_100g?:      number | null;
          fuente?:          'openfoodfacts' | 'usda' | 'manual' | 'ia';
          validado?:        boolean;
          nombre_original?: string | null;
          pais?:            string | null;
          imagen_url?:      string | null;
          created_at?:      string;
        };
        Update: {
          id?:              string;
          nombre?:          string;
          codigo_barras?:   string | null;
          calorias_100g?:   number;
          proteina_100g?:   number;
          carbos_100g?:     number;
          grasas_100g?:     number;
          fibra_100g?:      number | null;
          fuente?:          'openfoodfacts' | 'usda' | 'manual' | 'ia';
          validado?:        boolean;
          nombre_original?: string | null;
          pais?:            string | null;
          imagen_url?:      string | null;
        };
        Relationships: [];
      };

      usuarios: {
        Row: {
          id: string;
          email: string;
          nombre: string;
          apellido: string | null;
          tipo_usuario: 'nutriologo' | 'paciente';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          nombre: string;
          apellido?: string | null;
          tipo_usuario: 'nutriologo' | 'paciente';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          nombre?: string;
          apellido?: string | null;
          tipo_usuario?: 'nutriologo' | 'paciente';
          updated_at?: string;
        };
        Relationships: [];
      };

      nutriologos: {
        Row: {
          id: string;
          usuario_id: string;
          numero_cedula: string | null;
          especialidad: string | null;
          descripcion: string | null;
          foto_url: string | null;
          codigo_invitacion: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          numero_cedula?: string | null;
          especialidad?: string | null;
          descripcion?: string | null;
          foto_url?: string | null;
          codigo_invitacion?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          numero_cedula?: string | null;
          especialidad?: string | null;
          descripcion?: string | null;
          foto_url?: string | null;
          codigo_invitacion?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'nutriologos_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: true;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };

      pacientes: {
        Row: {
          id: string;
          usuario_id: string;
          nutriologo_id: string | null;
          fecha_nacimiento: string | null;
          peso: number | null;
          altura: number | null;
          objetivo: string | null;
          alergias: string[] | null;
          condiciones_medicas: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          nutriologo_id?: string | null;
          fecha_nacimiento?: string | null;
          peso?: number | null;
          altura?: number | null;
          objetivo?: string | null;
          alergias?: string[] | null;
          condiciones_medicas?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          nutriologo_id?: string | null;
          fecha_nacimiento?: string | null;
          peso?: number | null;
          altura?: number | null;
          objetivo?: string | null;
          alergias?: string[] | null;
          condiciones_medicas?: string[] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pacientes_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: true;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pacientes_nutriologo_id_fkey';
            columns: ['nutriologo_id'];
            isOneToOne: false;
            referencedRelation: 'nutriologos';
            referencedColumns: ['id'];
          },
        ];
      };

      planes_nutricionales: {
        Row: {
          id: string;
          paciente_id: string;
          nutriologo_id: string;
          nombre: string;
          descripcion: string | null;
          fecha_inicio: string | null;
          fecha_fin: string | null;
          calorias_diarias: number | null;
          proteinas_g: number | null;
          carbohidratos_g: number | null;
          grasas_g: number | null;
          /** Requiere: ALTER TABLE planes_nutricionales ADD COLUMN IF NOT EXISTS restricciones_dieteticas text[]; */
          restricciones_dieteticas: string[] | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paciente_id: string;
          nutriologo_id: string;
          nombre: string;
          descripcion?: string | null;
          fecha_inicio?: string | null;
          fecha_fin?: string | null;
          calorias_diarias?: number | null;
          proteinas_g?: number | null;
          carbohidratos_g?: number | null;
          grasas_g?: number | null;
          restricciones_dieteticas?: string[] | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paciente_id?: string;
          nutriologo_id?: string;
          nombre?: string;
          descripcion?: string | null;
          fecha_inicio?: string | null;
          fecha_fin?: string | null;
          calorias_diarias?: number | null;
          proteinas_g?: number | null;
          carbohidratos_g?: number | null;
          grasas_g?: number | null;
          restricciones_dieteticas?: string[] | null;
          activo?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'planes_nutricionales_paciente_id_fkey';
            columns: ['paciente_id'];
            isOneToOne: false;
            referencedRelation: 'pacientes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'planes_nutricionales_nutriologo_id_fkey';
            columns: ['nutriologo_id'];
            isOneToOne: false;
            referencedRelation: 'nutriologos';
            referencedColumns: ['id'];
          },
        ];
      };

      inventario: {
        Row: {
          id: string;
          nutriologo_id: string;
          paciente_id: string | null;
          nombre: string;
          categoria: string | null;
          unidad_medida: string | null;
          calorias_por_100g: number | null;
          proteinas_por_100g: number | null;
          carbohidratos_por_100g: number | null;
          grasas_por_100g: number | null;
          stock: number;
          fecha_vencimiento: string | null;
          alimento_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nutriologo_id: string;
          paciente_id?: string | null;
          nombre: string;
          categoria?: string | null;
          unidad_medida?: string | null;
          calorias_por_100g?: number | null;
          proteinas_por_100g?: number | null;
          carbohidratos_por_100g?: number | null;
          grasas_por_100g?: number | null;
          stock?: number;
          fecha_vencimiento?: string | null;
          alimento_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nutriologo_id?: string;
          paciente_id?: string | null;
          nombre?: string;
          categoria?: string | null;
          unidad_medida?: string | null;
          calorias_por_100g?: number | null;
          proteinas_por_100g?: number | null;
          carbohidratos_por_100g?: number | null;
          grasas_por_100g?: number | null;
          stock?: number;
          fecha_vencimiento?: string | null;
          alimento_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventario_nutriologo_id_fkey';
            columns: ['nutriologo_id'];
            isOneToOne: false;
            referencedRelation: 'nutriologos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventario_paciente_id_fkey';
            columns: ['paciente_id'];
            isOneToOne: false;
            referencedRelation: 'pacientes';
            referencedColumns: ['id'];
          },
        ];
      };

      recetas_generadas: {
        Row: {
          id: string;
          plan_nutricional_id: string | null;
          paciente_id: string | null;
          nutriologo_id: string | null;
          nombre: string;
          descripcion: string | null;
          ingredientes: Json | null;
          instrucciones: string | null;
          calorias: number | null;
          tiempo_preparacion: number | null;
          tipo_comida: 'desayuno' | 'almuerzo' | 'cena' | 'merienda' | null;
          generada_por_ia: boolean;
          prompt_usado: string | null;
          /** Fecha del menú diario (YYYY-MM-DD). Requiere migración: ALTER TABLE recetas_generadas ADD COLUMN IF NOT EXISTS fecha DATE */
          fecha: string | null;
          /** Menú completo del día como JSON. Requiere migración: ALTER TABLE recetas_generadas ADD COLUMN IF NOT EXISTS menu JSONB */
          menu: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_nutricional_id?: string | null;
          paciente_id?: string | null;
          nutriologo_id?: string | null;
          nombre: string;
          descripcion?: string | null;
          ingredientes?: Json | null;
          instrucciones?: string | null;
          calorias?: number | null;
          tiempo_preparacion?: number | null;
          tipo_comida?: 'desayuno' | 'almuerzo' | 'cena' | 'merienda' | null;
          generada_por_ia?: boolean;
          prompt_usado?: string | null;
          fecha?: string | null;
          menu?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_nutricional_id?: string | null;
          paciente_id?: string | null;
          nutriologo_id?: string | null;
          nombre?: string;
          descripcion?: string | null;
          ingredientes?: Json | null;
          instrucciones?: string | null;
          calorias?: number | null;
          tiempo_preparacion?: number | null;
          tipo_comida?: 'desayuno' | 'almuerzo' | 'cena' | 'merienda' | null;
          generada_por_ia?: boolean;
          prompt_usado?: string | null;
          fecha?: string | null;
          menu?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'recetas_generadas_plan_nutricional_id_fkey';
            columns: ['plan_nutricional_id'];
            isOneToOne: false;
            referencedRelation: 'planes_nutricionales';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recetas_generadas_paciente_id_fkey';
            columns: ['paciente_id'];
            isOneToOne: false;
            referencedRelation: 'pacientes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recetas_generadas_nutriologo_id_fkey';
            columns: ['nutriologo_id'];
            isOneToOne: false;
            referencedRelation: 'nutriologos';
            referencedColumns: ['id'];
          },
        ];
      };

      pagos: {
        Row: {
          id: string;
          nutriologo_id: string;
          paciente_id: string;
          monto: number;
          moneda: string;
          estado: 'pendiente' | 'completado' | 'fallido' | 'reembolsado';
          stripe_payment_intent_id: string | null;
          stripe_customer_id: string | null;
          descripcion: string | null;
          fecha_pago: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nutriologo_id: string;
          paciente_id: string;
          monto: number;
          moneda?: string;
          estado?: 'pendiente' | 'completado' | 'fallido' | 'reembolsado';
          stripe_payment_intent_id?: string | null;
          stripe_customer_id?: string | null;
          descripcion?: string | null;
          fecha_pago?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nutriologo_id?: string;
          paciente_id?: string;
          monto?: number;
          moneda?: string;
          estado?: 'pendiente' | 'completado' | 'fallido' | 'reembolsado';
          stripe_payment_intent_id?: string | null;
          stripe_customer_id?: string | null;
          descripcion?: string | null;
          fecha_pago?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pagos_nutriologo_id_fkey';
            columns: ['nutriologo_id'];
            isOneToOne: false;
            referencedRelation: 'nutriologos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagos_paciente_id_fkey';
            columns: ['paciente_id'];
            isOneToOne: false;
            referencedRelation: 'pacientes';
            referencedColumns: ['id'];
          },
        ];
      };

      codigos_invitacion: {
        Row: {
          id:            string;
          nutriologo_id: string;
          codigo:        string;
          usado:         boolean;
          created_at:    string;
          usado_at:      string | null;
        };
        Insert: {
          id?:           string;
          nutriologo_id: string;
          codigo:        string;
          usado?:        boolean;
          created_at?:   string;
          usado_at?:     string | null;
        };
        Update: {
          id?:           string;
          nutriologo_id?: string;
          codigo?:       string;
          usado?:        boolean;
          usado_at?:     string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'codigos_invitacion_nutriologo_id_fkey';
            columns: ['nutriologo_id'];
            isOneToOne: false;
            referencedRelation: 'nutriologos';
            referencedColumns: ['id'];
          },
        ];
      };

      mediciones_inbody: {
        Row: {
          id: string;
          paciente_id: string;
          fecha: string;
          peso: number | null;
          grasa_porcentaje: number | null;
          musculo_kg: number | null;
          agua_porcentaje: number | null;
          masa_osea: number | null;
          grasa_visceral: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          paciente_id: string;
          fecha: string;
          peso?: number | null;
          grasa_porcentaje?: number | null;
          musculo_kg?: number | null;
          agua_porcentaje?: number | null;
          masa_osea?: number | null;
          grasa_visceral?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          paciente_id?: string;
          fecha?: string;
          peso?: number | null;
          grasa_porcentaje?: number | null;
          musculo_kg?: number | null;
          agua_porcentaje?: number | null;
          masa_osea?: number | null;
          grasa_visceral?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'mediciones_inbody_paciente_id_fkey';
            columns: ['paciente_id'];
            isOneToOne: false;
            referencedRelation: 'pacientes';
            referencedColumns: ['id'];
          },
        ];
      };

      diario_comidas: {
        Row: {
          id: string;
          paciente_id: string;
          foto_url: string | null;
          descripcion: string | null;
          descripcion_texto: string | null;
          tipo_comida: 'desayuno' | 'almuerzo' | 'cena' | 'merienda' | null;
          revisada: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          paciente_id: string;
          foto_url?: string | null;
          descripcion?: string | null;
          descripcion_texto?: string | null;
          tipo_comida?: 'desayuno' | 'almuerzo' | 'cena' | 'merienda' | null;
          revisada?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          revisada?: boolean;
          descripcion?: string | null;
          descripcion_texto?: string | null;
          tipo_comida?: 'desayuno' | 'almuerzo' | 'cena' | 'merienda' | null;
        };
        Relationships: [
          {
            foreignKeyName: 'diario_comidas_paciente_id_fkey';
            columns: ['paciente_id'];
            isOneToOne: false;
            referencedRelation: 'pacientes';
            referencedColumns: ['id'];
          },
        ];
      };

      notificaciones: {
        Row: {
          id: string;
          paciente_id: string;
          tipo: string;
          mensaje: string;
          leida: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          paciente_id: string;
          tipo?: string;
          mensaje: string;
          leida?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          leida?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'notificaciones_paciente_id_fkey';
            columns: ['paciente_id'];
            isOneToOne: false;
            referencedRelation: 'pacientes';
            referencedColumns: ['id'];
          },
        ];
      };

      notas: {
        Row: {
          id: string;
          paciente_id: string;
          nutriologo_id: string;
          mensaje: string;
          fecha: string;
          leida: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          paciente_id: string;
          nutriologo_id: string;
          mensaje: string;
          fecha?: string;
          leida?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          paciente_id?: string;
          nutriologo_id?: string;
          mensaje?: string;
          fecha?: string;
          leida?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'notas_paciente_id_fkey';
            columns: ['paciente_id'];
            isOneToOne: false;
            referencedRelation: 'pacientes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notas_nutriologo_id_fkey';
            columns: ['nutriologo_id'];
            isOneToOne: false;
            referencedRelation: 'nutriologos';
            referencedColumns: ['id'];
          },
        ];
      };

      push_subscriptions: {
        Row: {
          id: string;
          paciente_id: string;
          endpoint: string;
          subscription: Json;   // Full PushSubscriptionJSON stored for webpush.sendNotification()
          created_at: string;
        };
        Insert: {
          id?: string;
          paciente_id: string;
          endpoint: string;
          subscription: Json;
          created_at?: string;
        };
        Update: {
          subscription?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_paciente_id_fkey';
            columns: ['paciente_id'];
            isOneToOne: false;
            referencedRelation: 'pacientes';
            referencedColumns: ['id'];
          },
        ];
      };
    };
  };
}
