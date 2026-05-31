/**
 * Datos nutricionales INCAP para Costa Rica / Centroamérica
 *
 * Fuente: Tabla de Composición de Alimentos de Centroamérica, INCAP/OPS (8ª ed.)
 *         + valores específicos de alimentos costarricenses.
 *
 * Valores expresados por 100 g de porción comestible.
 */

export interface AlimentoINCAPData {
  nombre: string;
  categoria: string;
  calorias100g: number;
  proteina100g: number;
  carbos100g: number;
  grasas100g: number;
  fibra100g: number | null;
}

export const ALIMENTOS_INCAP: AlimentoINCAPData[] = [
  // ─── Lácteos ────────────────────────────────────────────────────────────────
  { nombre: 'Leche entera de vaca',        categoria: 'Lácteos',   calorias100g:  61, proteina100g:  3.2, carbos100g:  4.7, grasas100g:  3.5, fibra100g: 0.0 },
  { nombre: 'Leche descremada',            categoria: 'Lácteos',   calorias100g:  35, proteina100g:  3.5, carbos100g:  5.1, grasas100g:  0.1, fibra100g: 0.0 },
  { nombre: 'Queso blanco fresco',         categoria: 'Lácteos',   calorias100g: 263, proteina100g: 17.0, carbos100g:  2.0, grasas100g: 21.0, fibra100g: 0.0 },
  { nombre: 'Queso turrialba',             categoria: 'Lácteos',   calorias100g: 260, proteina100g: 18.0, carbos100g:  2.5, grasas100g: 20.0, fibra100g: 0.0 },
  { nombre: 'Natilla',                     categoria: 'Lácteos',   calorias100g: 181, proteina100g:  2.5, carbos100g:  4.0, grasas100g: 18.0, fibra100g: 0.0 },
  { nombre: 'Yogur natural entero',        categoria: 'Lácteos',   calorias100g:  60, proteina100g:  3.5, carbos100g:  4.7, grasas100g:  3.3, fibra100g: 0.0 },
  { nombre: 'Queso mozzarella',            categoria: 'Lácteos',   calorias100g: 280, proteina100g: 19.9, carbos100g:  2.2, grasas100g: 22.0, fibra100g: 0.0 },
  { nombre: 'Leche condensada azucarada',  categoria: 'Lácteos',   calorias100g: 321, proteina100g:  7.9, carbos100g: 54.4, grasas100g:  8.7, fibra100g: 0.0 },

  // ─── Huevos ─────────────────────────────────────────────────────────────────
  { nombre: 'Huevo entero cocido',         categoria: 'Huevos',    calorias100g: 155, proteina100g: 13.0, carbos100g:  1.1, grasas100g: 11.0, fibra100g: 0.0 },
  { nombre: 'Clara de huevo cocida',       categoria: 'Huevos',    calorias100g:  52, proteina100g: 11.0, carbos100g:  0.7, grasas100g:  0.2, fibra100g: 0.0 },
  { nombre: 'Yema de huevo',               categoria: 'Huevos',    calorias100g: 322, proteina100g: 16.0, carbos100g:  3.6, grasas100g: 27.0, fibra100g: 0.0 },

  // ─── Aves ────────────────────────────────────────────────────────────────────
  { nombre: 'Pollo pechuga sin piel cocida', categoria: 'Aves',    calorias100g: 165, proteina100g: 31.0, carbos100g:  0.0, grasas100g:  3.6, fibra100g: 0.0 },
  { nombre: 'Pollo muslo sin piel cocido',   categoria: 'Aves',    calorias100g: 209, proteina100g: 26.0, carbos100g:  0.0, grasas100g: 11.0, fibra100g: 0.0 },
  { nombre: 'Pollo entero cocido',           categoria: 'Aves',    calorias100g: 239, proteina100g: 27.3, carbos100g:  0.0, grasas100g: 13.6, fibra100g: 0.0 },
  { nombre: 'Hígado de pollo cocido',        categoria: 'Aves',    calorias100g: 172, proteina100g: 27.4, carbos100g:  0.9, grasas100g:  5.5, fibra100g: 0.0 },

  // ─── Res ─────────────────────────────────────────────────────────────────────
  { nombre: 'Carne de res magra cocida',   categoria: 'Res',       calorias100g: 250, proteina100g: 30.0, carbos100g:  0.0, grasas100g: 14.0, fibra100g: 0.0 },
  { nombre: 'Carne molida de res cocida',  categoria: 'Res',       calorias100g: 254, proteina100g: 26.0, carbos100g:  0.0, grasas100g: 16.0, fibra100g: 0.0 },
  { nombre: 'Hígado de res cocido',        categoria: 'Res',       calorias100g: 191, proteina100g: 29.0, carbos100g:  3.9, grasas100g:  6.5, fibra100g: 0.0 },
  { nombre: 'Bistec de res cocido',        categoria: 'Res',       calorias100g: 271, proteina100g: 28.5, carbos100g:  0.0, grasas100g: 17.0, fibra100g: 0.0 },
  { nombre: 'Lengua de res cocida',        categoria: 'Res',       calorias100g: 284, proteina100g: 21.8, carbos100g:  0.0, grasas100g: 22.0, fibra100g: 0.0 },

  // ─── Cerdo ───────────────────────────────────────────────────────────────────
  { nombre: 'Carne de cerdo magra cocida', categoria: 'Cerdo',     calorias100g: 242, proteina100g: 27.0, carbos100g:  0.0, grasas100g: 14.0, fibra100g: 0.0 },
  { nombre: 'Chicharrón',                  categoria: 'Cerdo',     calorias100g: 544, proteina100g: 31.0, carbos100g:  0.0, grasas100g: 46.0, fibra100g: 0.0 },
  { nombre: 'Costilla de cerdo cocida',    categoria: 'Cerdo',     calorias100g: 321, proteina100g: 27.0, carbos100g:  0.0, grasas100g: 22.0, fibra100g: 0.0 },
  { nombre: 'Lomo de cerdo cocido',        categoria: 'Cerdo',     calorias100g: 230, proteina100g: 28.5, carbos100g:  0.0, grasas100g: 12.5, fibra100g: 0.0 },

  // ─── Embutidos ───────────────────────────────────────────────────────────────
  { nombre: 'Salchicha de res',            categoria: 'Embutidos', calorias100g: 290, proteina100g: 13.0, carbos100g:  2.0, grasas100g: 26.0, fibra100g: 0.0 },
  { nombre: 'Jamón cocido',               categoria: 'Embutidos', calorias100g: 135, proteina100g: 17.0, carbos100g:  2.0, grasas100g:  6.5, fibra100g: 0.0 },
  { nombre: 'Mortadela',                   categoria: 'Embutidos', calorias100g: 259, proteina100g: 13.0, carbos100g:  3.0, grasas100g: 22.0, fibra100g: 0.0 },
  { nombre: 'Salami',                      categoria: 'Embutidos', calorias100g: 336, proteina100g: 19.3, carbos100g:  1.6, grasas100g: 28.1, fibra100g: 0.0 },

  // ─── Mariscos y Pescados ─────────────────────────────────────────────────────
  { nombre: 'Atún en agua enlatado',       categoria: 'Mariscos',  calorias100g: 116, proteina100g: 26.0, carbos100g:  0.0, grasas100g:  1.0, fibra100g: 0.0 },
  { nombre: 'Tilapia cocida',              categoria: 'Mariscos',  calorias100g: 128, proteina100g: 26.0, carbos100g:  0.0, grasas100g:  2.7, fibra100g: 0.0 },
  { nombre: 'Camarón cocido',              categoria: 'Mariscos',  calorias100g:  99, proteina100g: 24.0, carbos100g:  0.0, grasas100g:  0.3, fibra100g: 0.0 },
  { nombre: 'Sardina en aceite enlatada',  categoria: 'Mariscos',  calorias100g: 208, proteina100g: 24.0, carbos100g:  0.0, grasas100g: 12.0, fibra100g: 0.0 },
  { nombre: 'Corvina cocida',              categoria: 'Mariscos',  calorias100g: 105, proteina100g: 22.0, carbos100g:  0.0, grasas100g:  1.8, fibra100g: 0.0 },
  { nombre: 'Dorado cocido',               categoria: 'Mariscos',  calorias100g: 109, proteina100g: 24.0, carbos100g:  0.0, grasas100g:  1.2, fibra100g: 0.0 },

  // ─── Leguminosas ─────────────────────────────────────────────────────────────
  { nombre: 'Frijoles negros cocidos',     categoria: 'Leguminosas', calorias100g: 132, proteina100g:  8.9, carbos100g: 23.7, grasas100g:  0.5, fibra100g:  8.7 },
  { nombre: 'Frijoles rojos cocidos',      categoria: 'Leguminosas', calorias100g: 127, proteina100g:  8.7, carbos100g: 22.8, grasas100g:  0.5, fibra100g:  7.4 },
  { nombre: 'Lentejas cocidas',            categoria: 'Leguminosas', calorias100g: 116, proteina100g:  9.0, carbos100g: 20.1, grasas100g:  0.4, fibra100g:  7.9 },
  { nombre: 'Garbanzos cocidos',           categoria: 'Leguminosas', calorias100g: 164, proteina100g:  8.9, carbos100g: 27.4, grasas100g:  2.6, fibra100g:  7.6 },
  { nombre: 'Soya cocida',                 categoria: 'Leguminosas', calorias100g: 173, proteina100g: 16.6, carbos100g:  9.9, grasas100g:  9.0, fibra100g:  6.0 },
  { nombre: 'Arvejas verdes cocidas',      categoria: 'Leguminosas', calorias100g:  84, proteina100g:  5.4, carbos100g: 15.6, grasas100g:  0.2, fibra100g:  5.7 },
  { nombre: 'Frijol mungo (soya verde) cocido', categoria: 'Leguminosas', calorias100g: 105, proteina100g: 7.0, carbos100g: 19.1, grasas100g: 0.4, fibra100g: 7.6 },

  // ─── Verduras y Hortalizas ───────────────────────────────────────────────────
  { nombre: 'Chayote cocido',              categoria: 'Verduras',  calorias100g:  24, proteina100g:  0.8, carbos100g:  5.4, grasas100g:  0.1, fibra100g:  1.7 },
  { nombre: 'Yuca cocida',                 categoria: 'Verduras',  calorias100g: 160, proteina100g:  1.4, carbos100g: 38.1, grasas100g:  0.3, fibra100g:  1.8 },
  { nombre: 'Plátano verde cocido',        categoria: 'Verduras',  calorias100g: 116, proteina100g:  0.8, carbos100g: 31.2, grasas100g:  0.1, fibra100g:  2.2 },
  { nombre: 'Plátano maduro frito',        categoria: 'Verduras',  calorias100g: 196, proteina100g:  1.3, carbos100g: 40.3, grasas100g:  4.7, fibra100g:  2.9 },
  { nombre: 'Ayote cocido',                categoria: 'Verduras',  calorias100g:  26, proteina100g:  1.0, carbos100g:  6.5, grasas100g:  0.1, fibra100g:  0.5 },
  { nombre: 'Zanahoria cocida',            categoria: 'Verduras',  calorias100g:  35, proteina100g:  0.8, carbos100g:  8.2, grasas100g:  0.2, fibra100g:  3.0 },
  { nombre: 'Pepino crudo',                categoria: 'Verduras',  calorias100g:  16, proteina100g:  0.7, carbos100g:  3.6, grasas100g:  0.1, fibra100g:  0.5 },
  { nombre: 'Tomate crudo',                categoria: 'Verduras',  calorias100g:  18, proteina100g:  0.9, carbos100g:  3.9, grasas100g:  0.2, fibra100g:  1.2 },
  { nombre: 'Cebolla cruda',               categoria: 'Verduras',  calorias100g:  40, proteina100g:  1.1, carbos100g:  9.3, grasas100g:  0.1, fibra100g:  1.7 },
  { nombre: 'Brócoli cocido',              categoria: 'Verduras',  calorias100g:  35, proteina100g:  2.4, carbos100g:  7.2, grasas100g:  0.4, fibra100g:  3.3 },
  { nombre: 'Espinaca cocida',             categoria: 'Verduras',  calorias100g:  23, proteina100g:  3.0, carbos100g:  3.8, grasas100g:  0.3, fibra100g:  2.2 },
  { nombre: 'Repollo crudo',               categoria: 'Verduras',  calorias100g:  25, proteina100g:  1.3, carbos100g:  5.8, grasas100g:  0.1, fibra100g:  2.5 },
  { nombre: 'Chile dulce (pimiento)',      categoria: 'Verduras',  calorias100g:  31, proteina100g:  1.0, carbos100g:  6.0, grasas100g:  0.3, fibra100g:  2.1 },
  { nombre: 'Papa cocida',                 categoria: 'Verduras',  calorias100g:  87, proteina100g:  1.9, carbos100g: 20.1, grasas100g:  0.1, fibra100g:  1.8 },
  { nombre: 'Camote cocido',               categoria: 'Verduras',  calorias100g:  76, proteina100g:  1.4, carbos100g: 17.7, grasas100g:  0.1, fibra100g:  2.5 },
  { nombre: 'Ñampí cocido',                categoria: 'Verduras',  calorias100g:  98, proteina100g:  2.1, carbos100g: 23.3, grasas100g:  0.1, fibra100g:  2.0 },
  { nombre: 'Quequisque cocido',           categoria: 'Verduras',  calorias100g: 109, proteina100g:  1.5, carbos100g: 26.4, grasas100g:  0.1, fibra100g:  1.5 },
  { nombre: 'Tiquisque cocido',            categoria: 'Verduras',  calorias100g:  94, proteina100g:  1.2, carbos100g: 22.8, grasas100g:  0.1, fibra100g:  1.3 },

  // ─── Frutas ──────────────────────────────────────────────────────────────────
  { nombre: 'Mango',                       categoria: 'Frutas',    calorias100g:  65, proteina100g:  0.5, carbos100g: 17.0, grasas100g:  0.3, fibra100g:  1.8 },
  { nombre: 'Papaya',                      categoria: 'Frutas',    calorias100g:  43, proteina100g:  0.5, carbos100g: 10.8, grasas100g:  0.3, fibra100g:  1.7 },
  { nombre: 'Piña',                        categoria: 'Frutas',    calorias100g:  50, proteina100g:  0.5, carbos100g: 13.1, grasas100g:  0.1, fibra100g:  1.4 },
  { nombre: 'Banano (guineo)',             categoria: 'Frutas',    calorias100g:  89, proteina100g:  1.1, carbos100g: 23.0, grasas100g:  0.3, fibra100g:  2.6 },
  { nombre: 'Naranja',                     categoria: 'Frutas',    calorias100g:  47, proteina100g:  0.9, carbos100g: 11.8, grasas100g:  0.1, fibra100g:  2.4 },
  { nombre: 'Melón',                       categoria: 'Frutas',    calorias100g:  34, proteina100g:  0.8, carbos100g:  8.2, grasas100g:  0.2, fibra100g:  0.9 },
  { nombre: 'Sandía',                      categoria: 'Frutas',    calorias100g:  30, proteina100g:  0.6, carbos100g:  7.6, grasas100g:  0.2, fibra100g:  0.4 },
  { nombre: 'Guayaba',                     categoria: 'Frutas',    calorias100g:  68, proteina100g:  2.6, carbos100g: 14.3, grasas100g:  0.9, fibra100g:  5.4 },
  { nombre: 'Aguacate',                    categoria: 'Frutas',    calorias100g: 160, proteina100g:  2.0, carbos100g:  8.5, grasas100g: 15.0, fibra100g:  6.7 },
  { nombre: 'Limón',                       categoria: 'Frutas',    calorias100g:  29, proteina100g:  1.1, carbos100g:  9.3, grasas100g:  0.3, fibra100g:  2.8 },
  { nombre: 'Cas (guayaba costarricense)', categoria: 'Frutas',    calorias100g:  36, proteina100g:  0.5, carbos100g:  8.5, grasas100g:  0.2, fibra100g:  3.0 },
  { nombre: 'Carambola',                   categoria: 'Frutas',    calorias100g:  31, proteina100g:  1.0, carbos100g:  6.7, grasas100g:  0.3, fibra100g:  2.8 },
  { nombre: 'Nance',                       categoria: 'Frutas',    calorias100g:  57, proteina100g:  0.4, carbos100g: 14.7, grasas100g:  0.5, fibra100g:  5.9 },
  { nombre: 'Maracuyá',                    categoria: 'Frutas',    calorias100g:  97, proteina100g:  2.2, carbos100g: 23.4, grasas100g:  0.7, fibra100g: 10.4 },
  { nombre: 'Tamarindo pulpa',             categoria: 'Frutas',    calorias100g: 239, proteina100g:  2.8, carbos100g: 62.5, grasas100g:  0.6, fibra100g:  5.1 },
  { nombre: 'Marañón (jocote marañón)',    categoria: 'Frutas',    calorias100g:  54, proteina100g:  0.8, carbos100g: 13.2, grasas100g:  0.3, fibra100g:  1.5 },

  // ─── Cereales y Granos ───────────────────────────────────────────────────────
  { nombre: 'Arroz blanco cocido',         categoria: 'Cereales',  calorias100g: 130, proteina100g:  2.7, carbos100g: 28.2, grasas100g:  0.3, fibra100g:  0.4 },
  { nombre: 'Arroz integral cocido',       categoria: 'Cereales',  calorias100g: 111, proteina100g:  2.6, carbos100g: 23.0, grasas100g:  0.9, fibra100g:  1.8 },
  { nombre: 'Pan blanco de molde',         categoria: 'Cereales',  calorias100g: 266, proteina100g:  8.9, carbos100g: 50.6, grasas100g:  3.3, fibra100g:  2.7 },
  { nombre: 'Pan integral',                categoria: 'Cereales',  calorias100g: 247, proteina100g: 13.0, carbos100g: 41.3, grasas100g:  4.2, fibra100g:  6.9 },
  { nombre: 'Tortilla de maíz',            categoria: 'Cereales',  calorias100g: 218, proteina100g:  5.7, carbos100g: 45.9, grasas100g:  2.5, fibra100g:  4.7 },
  { nombre: 'Avena cocida',                categoria: 'Cereales',  calorias100g:  71, proteina100g:  2.5, carbos100g: 12.0, grasas100g:  1.4, fibra100g:  1.7 },
  { nombre: 'Pasta cocida',                categoria: 'Cereales',  calorias100g: 158, proteina100g:  5.8, carbos100g: 31.0, grasas100g:  0.9, fibra100g:  1.8 },
  { nombre: 'Maíz tierno cocido',          categoria: 'Cereales',  calorias100g:  96, proteina100g:  3.4, carbos100g: 21.0, grasas100g:  1.5, fibra100g:  2.9 },
  { nombre: 'Harina de maíz (masa)',       categoria: 'Cereales',  calorias100g: 362, proteina100g:  8.3, carbos100g: 76.8, grasas100g:  3.9, fibra100g:  7.3 },
  { nombre: 'Granola',                     categoria: 'Cereales',  calorias100g: 471, proteina100g: 10.0, carbos100g: 64.0, grasas100g: 20.0, fibra100g:  7.0 },
  { nombre: 'Galletas de soda',            categoria: 'Cereales',  calorias100g: 421, proteina100g:  9.0, carbos100g: 70.0, grasas100g: 13.0, fibra100g:  2.0 },

  // ─── Aceites y Grasas ────────────────────────────────────────────────────────
  { nombre: 'Aceite vegetal de palma',     categoria: 'Grasas',    calorias100g: 884, proteina100g:  0.0, carbos100g:  0.0, grasas100g:100.0, fibra100g: null },
  { nombre: 'Aceite de oliva',             categoria: 'Grasas',    calorias100g: 884, proteina100g:  0.0, carbos100g:  0.0, grasas100g:100.0, fibra100g: null },
  { nombre: 'Margarina',                   categoria: 'Grasas',    calorias100g: 717, proteina100g:  0.2, carbos100g:  0.7, grasas100g: 80.0, fibra100g: null },
  { nombre: 'Mantequilla',                 categoria: 'Grasas',    calorias100g: 717, proteina100g:  0.9, carbos100g:  0.1, grasas100g: 81.1, fibra100g: null },
  { nombre: 'Manteca de cerdo',            categoria: 'Grasas',    calorias100g: 898, proteina100g:  0.0, carbos100g:  0.0, grasas100g: 99.5, fibra100g: null },

  // ─── Azúcares ────────────────────────────────────────────────────────────────
  { nombre: 'Azúcar blanca refinada',      categoria: 'Azúcares',  calorias100g: 387, proteina100g:  0.0, carbos100g: 99.9, grasas100g:  0.0, fibra100g: null },
  { nombre: 'Azúcar morena',               categoria: 'Azúcares',  calorias100g: 377, proteina100g:  0.1, carbos100g: 97.3, grasas100g:  0.0, fibra100g: null },
  { nombre: 'Tapa de dulce (dulce de tapa)', categoria: 'Azúcares', calorias100g: 374, proteina100g:  0.0, carbos100g: 96.7, grasas100g:  0.0, fibra100g: null },
  { nombre: 'Miel de abeja',               categoria: 'Azúcares',  calorias100g: 304, proteina100g:  0.3, carbos100g: 82.4, grasas100g:  0.0, fibra100g: null },

  // ─── Bebidas ─────────────────────────────────────────────────────────────────
  { nombre: 'Café negro sin azúcar',       categoria: 'Bebidas',   calorias100g:   2, proteina100g:  0.3, carbos100g:  0.0, grasas100g:  0.0, fibra100g: null },
  { nombre: 'Fresco de naranja natural',   categoria: 'Bebidas',   calorias100g:  45, proteina100g:  0.7, carbos100g: 10.4, grasas100g:  0.2, fibra100g: null },
  { nombre: 'Agua de pipa (agua de coco)', categoria: 'Bebidas',   calorias100g:  19, proteina100g:  0.7, carbos100g:  3.7, grasas100g:  0.2, fibra100g: null },
  { nombre: 'Leche de soya',               categoria: 'Bebidas',   calorias100g:  42, proteina100g:  3.6, carbos100g:  2.9, grasas100g:  2.0, fibra100g: null },
  { nombre: 'Horchata de arroz',           categoria: 'Bebidas',   calorias100g:  47, proteina100g:  0.3, carbos100g: 10.2, grasas100g:  0.5, fibra100g: null },

  // ─── Comidas Típicas CR ──────────────────────────────────────────────────────
  { nombre: 'Gallo pinto',                 categoria: 'Comidas CR', calorias100g: 136, proteina100g:  5.5, carbos100g: 26.5, grasas100g:  1.5, fibra100g:  3.2 },
  { nombre: 'Casado completo',             categoria: 'Comidas CR', calorias100g: 350, proteina100g: 22.0, carbos100g: 42.0, grasas100g:  9.0, fibra100g:  4.5 },
  { nombre: 'Olla de carne (sopa)',        categoria: 'Comidas CR', calorias100g:  98, proteina100g:  6.5, carbos100g: 12.0, grasas100g:  2.5, fibra100g:  2.0 },
  { nombre: 'Picadillo de papa con carne', categoria: 'Comidas CR', calorias100g:  98, proteina100g:  3.5, carbos100g: 15.0, grasas100g:  2.5, fibra100g:  2.0 },
  { nombre: 'Tamales de maíz',             categoria: 'Comidas CR', calorias100g: 185, proteina100g:  5.5, carbos100g: 28.0, grasas100g:  6.0, fibra100g:  2.5 },
  { nombre: 'Arroz con leche',             categoria: 'Comidas CR', calorias100g: 123, proteina100g:  3.2, carbos100g: 23.5, grasas100g:  2.0, fibra100g:  0.2 },
  { nombre: 'Sopa de frijoles',            categoria: 'Comidas CR', calorias100g:  75, proteina100g:  4.5, carbos100g: 13.0, grasas100g:  0.8, fibra100g:  3.5 },
  { nombre: 'Chorreadas (tortillas de elote)', categoria: 'Comidas CR', calorias100g: 202, proteina100g: 4.2, carbos100g: 36.5, grasas100g: 5.0, fibra100g: 2.8 },
  { nombre: 'Arroz frito',                 categoria: 'Comidas CR', calorias100g: 181, proteina100g:  3.6, carbos100g: 29.0, grasas100g:  5.8, fibra100g:  0.7 },
  { nombre: 'Picadillo de arracache',      categoria: 'Comidas CR', calorias100g:  78, proteina100g:  2.0, carbos100g: 14.5, grasas100g:  1.5, fibra100g:  2.2 },
  { nombre: 'Sopa de mondongo',            categoria: 'Comidas CR', calorias100g:  95, proteina100g:  7.5, carbos100g:  9.5, grasas100g:  2.5, fibra100g:  1.5 },
  { nombre: 'Pozol de maíz',               categoria: 'Comidas CR', calorias100g:  60, proteina100g:  1.5, carbos100g: 13.5, grasas100g:  0.3, fibra100g:  1.0 },

  // ─── Nueces y Semillas ───────────────────────────────────────────────────────
  { nombre: 'Maní (cacahuate)',            categoria: 'Semillas',  calorias100g: 567, proteina100g: 25.8, carbos100g: 16.1, grasas100g: 49.2, fibra100g:  8.5 },
  { nombre: 'Semillas de girasol',         categoria: 'Semillas',  calorias100g: 584, proteina100g: 20.8, carbos100g: 20.0, grasas100g: 51.5, fibra100g:  8.6 },
  { nombre: 'Ajonjolí (semillas de sésamo)', categoria: 'Semillas', calorias100g: 573, proteina100g: 17.7, carbos100g: 23.5, grasas100g: 49.7, fibra100g: 11.8 },
  { nombre: 'Almendras',                   categoria: 'Semillas',  calorias100g: 579, proteina100g: 21.2, carbos100g: 21.6, grasas100g: 49.9, fibra100g: 12.5 },
  { nombre: 'Nuez de marañón (cashew)',    categoria: 'Semillas',  calorias100g: 553, proteina100g: 18.2, carbos100g: 30.2, grasas100g: 43.9, fibra100g:  3.3 },
  { nombre: 'Semillas de calabaza',        categoria: 'Semillas',  calorias100g: 559, proteina100g: 30.2, carbos100g: 10.7, grasas100g: 49.1, fibra100g:  6.0 },
];

/** Categorías únicas disponibles */
export const CATEGORIAS_INCAP = Array.from(
  new Set(ALIMENTOS_INCAP.map((a) => a.categoria)),
) as string[];

/** Total de registros */
export const TOTAL_INCAP = ALIMENTOS_INCAP.length;
