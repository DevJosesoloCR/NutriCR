-- ── Seed: Alimentos INCAP (Centro América / Costa Rica) ─────────────────────────
-- Fuente: Tabla de composición de alimentos de Centro América, INCAP/OPS (8ª ed.)
--         + valores específicos de alimentos costarricenses.
-- Ejecutar DESPUÉS de migration_20250530_alimentos_incap.sql
-- Todos los valores son por 100 g de porción comestible.
-- ────────────────────────────────────────────────────────────────────────────────

INSERT INTO alimentos
  (nombre, calorias_100g, proteina_100g, carbos_100g, grasas_100g, fibra_100g, fuente, validado)
VALUES

-- ═══════════════════════════════ LÁCTEOS ════════════════════════════════════════
('Leche entera de vaca',         61,   3.2,  4.7,  3.5,  0.0, 'incap', TRUE),
('Leche descremada',             35,   3.5,  5.1,  0.1,  0.0, 'incap', TRUE),
('Queso blanco fresco',         263,  17.0,  2.0, 21.0,  0.0, 'incap', TRUE),
('Queso turrialba',             260,  18.0,  2.5, 20.0,  0.0, 'incap', TRUE),
('Natilla',                     181,   2.5,  4.0, 18.0,  0.0, 'incap', TRUE),
('Yogur natural entero',         60,   3.5,  4.7,  3.3,  0.0, 'incap', TRUE),
('Queso mozzarella',            280,  19.9,  2.2, 22.0,  0.0, 'incap', TRUE),
('Leche condensada azucarada',  321,   7.9, 54.4,  8.7,  0.0, 'incap', TRUE),

-- ═══════════════════════════════ HUEVOS ════════════════════════════════════════
('Huevo entero cocido',         155,  13.0,  1.1, 11.0,  0.0, 'incap', TRUE),
('Clara de huevo cocida',        52,  11.0,  0.7,  0.2,  0.0, 'incap', TRUE),
('Yema de huevo',               322,  16.0,  3.6, 27.0,  0.0, 'incap', TRUE),

-- ═══════════════════════════════ AVES ══════════════════════════════════════════
('Pollo pechuga sin piel cocida',165,  31.0,  0.0,  3.6,  0.0, 'incap', TRUE),
('Pollo muslo sin piel cocido',  209,  26.0,  0.0, 11.0,  0.0, 'incap', TRUE),
('Pollo entero cocido',          239,  27.3,  0.0, 13.6,  0.0, 'incap', TRUE),
('Hígado de pollo cocido',       172,  27.4,  0.9,  5.5,  0.0, 'incap', TRUE),

-- ═══════════════════════════════ RES ═══════════════════════════════════════════
('Carne de res magra cocida',    250,  30.0,  0.0, 14.0,  0.0, 'incap', TRUE),
('Carne molida de res cocida',   254,  26.0,  0.0, 16.0,  0.0, 'incap', TRUE),
('Hígado de res cocido',         191,  29.0,  3.9,  6.5,  0.0, 'incap', TRUE),
('Bistec de res cocido',         271,  28.5,  0.0, 17.0,  0.0, 'incap', TRUE),
('Lengua de res cocida',         284,  21.8,  0.0, 22.0,  0.0, 'incap', TRUE),

-- ══════════════════════════════ CERDO ══════════════════════════════════════════
('Carne de cerdo magra cocida',  242,  27.0,  0.0, 14.0,  0.0, 'incap', TRUE),
('Chicharrón',                   544,  31.0,  0.0, 46.0,  0.0, 'incap', TRUE),
('Costilla de cerdo cocida',     321,  27.0,  0.0, 22.0,  0.0, 'incap', TRUE),
('Lomo de cerdo cocido',         230,  28.5,  0.0, 12.5,  0.0, 'incap', TRUE),

-- ══════════════════════════════ EMBUTIDOS ══════════════════════════════════════
('Salchicha de res',             290,  13.0,  2.0, 26.0,  0.0, 'incap', TRUE),
('Jamón cocido',                 135,  17.0,  2.0,  6.5,  0.0, 'incap', TRUE),
('Mortadela',                    259,  13.0,  3.0, 22.0,  0.0, 'incap', TRUE),
('Salami',                       336,  19.3,  1.6, 28.1,  0.0, 'incap', TRUE),

-- ════════════════════════════ MARISCOS Y PESCADOS ══════════════════════════════
('Atún en agua enlatado',        116,  26.0,  0.0,  1.0,  0.0, 'incap', TRUE),
('Tilapia cocida',               128,  26.0,  0.0,  2.7,  0.0, 'incap', TRUE),
('Camarón cocido',                99,  24.0,  0.0,  0.3,  0.0, 'incap', TRUE),
('Sardina en aceite enlatada',   208,  24.0,  0.0, 12.0,  0.0, 'incap', TRUE),
('Corvina cocida',               105,  22.0,  0.0,  1.8,  0.0, 'incap', TRUE),
('Dorado cocido',                109,  24.0,  0.0,  1.2,  0.0, 'incap', TRUE),

-- ══════════════════════════════ LEGUMINOSAS ════════════════════════════════════
('Frijoles negros cocidos',      132,   8.9, 23.7,  0.5,  8.7, 'incap', TRUE),
('Frijoles rojos cocidos',       127,   8.7, 22.8,  0.5,  7.4, 'incap', TRUE),
('Lentejas cocidas',             116,   9.0, 20.1,  0.4,  7.9, 'incap', TRUE),
('Garbanzos cocidos',            164,   8.9, 27.4,  2.6,  7.6, 'incap', TRUE),
('Soya cocida',                  173,  16.6,  9.9,  9.0,  6.0, 'incap', TRUE),
('Arvejas verdes cocidas',        84,   5.4, 15.6,  0.2,  5.7, 'incap', TRUE),
('Frijol mungo (soya verde) cocido', 105, 7.0, 19.1, 0.4, 7.6, 'incap', TRUE),

-- ════════════════════════════ VERDURAS Y HORTALIZAS ════════════════════════════
('Chayote cocido',                24,   0.8,  5.4,  0.1,  1.7, 'incap', TRUE),
('Yuca cocida',                  160,   1.4, 38.1,  0.3,  1.8, 'incap', TRUE),
('Plátano verde cocido',         116,   0.8, 31.2,  0.1,  2.2, 'incap', TRUE),
('Plátano maduro frito',         196,   1.3, 40.3,  4.7,  2.9, 'incap', TRUE),
('Ayote cocido',                  26,   1.0,  6.5,  0.1,  0.5, 'incap', TRUE),
('Zanahoria cocida',              35,   0.8,  8.2,  0.2,  3.0, 'incap', TRUE),
('Pepino crudo',                  16,   0.7,  3.6,  0.1,  0.5, 'incap', TRUE),
('Tomate crudo',                  18,   0.9,  3.9,  0.2,  1.2, 'incap', TRUE),
('Cebolla cruda',                 40,   1.1,  9.3,  0.1,  1.7, 'incap', TRUE),
('Brócoli cocido',                35,   2.4,  7.2,  0.4,  3.3, 'incap', TRUE),
('Espinaca cocida',               23,   3.0,  3.8,  0.3,  2.2, 'incap', TRUE),
('Repollo crudo',                 25,   1.3,  5.8,  0.1,  2.5, 'incap', TRUE),
('Chile dulce (pimiento)',        31,   1.0,  6.0,  0.3,  2.1, 'incap', TRUE),
('Papa cocida',                   87,   1.9, 20.1,  0.1,  1.8, 'incap', TRUE),
('Camote cocido',                 76,   1.4, 17.7,  0.1,  2.5, 'incap', TRUE),
('Ñampí cocido',                  98,   2.1, 23.3,  0.1,  2.0, 'incap', TRUE),
('Quequisque cocido',            109,   1.5, 26.4,  0.1,  1.5, 'incap', TRUE),
('Tiquisque cocido',              94,   1.2, 22.8,  0.1,  1.3, 'incap', TRUE),

-- ════════════════════════════════ FRUTAS ═══════════════════════════════════════
('Mango',                         65,   0.5, 17.0,  0.3,  1.8, 'incap', TRUE),
('Papaya',                        43,   0.5, 10.8,  0.3,  1.7, 'incap', TRUE),
('Piña',                          50,   0.5, 13.1,  0.1,  1.4, 'incap', TRUE),
('Banano (guineo)',                89,   1.1, 23.0,  0.3,  2.6, 'incap', TRUE),
('Naranja',                       47,   0.9, 11.8,  0.1,  2.4, 'incap', TRUE),
('Melón',                         34,   0.8,  8.2,  0.2,  0.9, 'incap', TRUE),
('Sandía',                        30,   0.6,  7.6,  0.2,  0.4, 'incap', TRUE),
('Guayaba',                       68,   2.6, 14.3,  0.9,  5.4, 'incap', TRUE),
('Aguacate',                     160,   2.0,  8.5, 15.0,  6.7, 'incap', TRUE),
('Limón',                         29,   1.1,  9.3,  0.3,  2.8, 'incap', TRUE),
('Cas (guayaba costarricense)',   36,   0.5,  8.5,  0.2,  3.0, 'incap', TRUE),
('Carambola',                     31,   1.0,  6.7,  0.3,  2.8, 'incap', TRUE),
('Nance',                         57,   0.4, 14.7,  0.5,  5.9, 'incap', TRUE),
('Maracuyá',                      97,   2.2, 23.4,  0.7, 10.4, 'incap', TRUE),
('Tamarindo pulpa',              239,   2.8, 62.5,  0.6,  5.1, 'incap', TRUE),
('Marañón (jocote marañón)',      54,   0.8, 13.2,  0.3,  1.5, 'incap', TRUE),

-- ════════════════════════════ CEREALES Y GRANOS ════════════════════════════════
('Arroz blanco cocido',          130,   2.7, 28.2,  0.3,  0.4, 'incap', TRUE),
('Arroz integral cocido',        111,   2.6, 23.0,  0.9,  1.8, 'incap', TRUE),
('Pan blanco de molde',          266,   8.9, 50.6,  3.3,  2.7, 'incap', TRUE),
('Pan integral',                 247,  13.0, 41.3,  4.2,  6.9, 'incap', TRUE),
('Tortilla de maíz',             218,   5.7, 45.9,  2.5,  4.7, 'incap', TRUE),
('Avena cocida',                  71,   2.5, 12.0,  1.4,  1.7, 'incap', TRUE),
('Pasta cocida',                 158,   5.8, 31.0,  0.9,  1.8, 'incap', TRUE),
('Maíz tierno cocido',            96,   3.4, 21.0,  1.5,  2.9, 'incap', TRUE),
('Harina de maíz (masa)',        362,   8.3, 76.8,  3.9,  7.3, 'incap', TRUE),
('Granola',                      471,  10.0, 64.0, 20.0,  7.0, 'incap', TRUE),
('Galletas de soda',             421,   9.0, 70.0, 13.0,  2.0, 'incap', TRUE),

-- ══════════════════════════════ ACEITES Y GRASAS ═══════════════════════════════
('Aceite vegetal de palma',      884,   0.0,  0.0,100.0,  NULL, 'incap', TRUE),
('Aceite de oliva',              884,   0.0,  0.0,100.0,  NULL, 'incap', TRUE),
('Margarina',                    717,   0.2,  0.7, 80.0,  NULL, 'incap', TRUE),
('Mantequilla',                  717,   0.9,  0.1, 81.1,  NULL, 'incap', TRUE),
('Manteca de cerdo',             898,   0.0,  0.0, 99.5,  NULL, 'incap', TRUE),

-- ════════════════════════════════ AZÚCARES ═════════════════════════════════════
('Azúcar blanca refinada',       387,   0.0, 99.9,  0.0,  NULL, 'incap', TRUE),
('Azúcar morena',                377,   0.1, 97.3,  0.0,  NULL, 'incap', TRUE),
('Tapa de dulce (dulce de tapa)',374,   0.0, 96.7,  0.0,  NULL, 'incap', TRUE),
('Miel de abeja',                304,   0.3, 82.4,  0.0,  NULL, 'incap', TRUE),

-- ═══════════════════════════════ BEBIDAS ═══════════════════════════════════════
('Café negro sin azúcar',          2,   0.3,  0.0,  0.0,  NULL, 'incap', TRUE),
('Fresco de naranja natural',     45,   0.7, 10.4,  0.2,  NULL, 'incap', TRUE),
('Agua de pipa (agua de coco)',   19,   0.7,  3.7,  0.2,  NULL, 'incap', TRUE),
('Leche de soya',                 42,   3.6,  2.9,  2.0,  NULL, 'incap', TRUE),
('Horchata de arroz',             47,   0.3, 10.2,  0.5,  NULL, 'incap', TRUE),

-- ═════════════════════════════ COMIDAS TÍPICAS CR ══════════════════════════════
('Gallo pinto',                  136,   5.5, 26.5,  1.5,  3.2, 'incap', TRUE),
('Casado completo',              350,  22.0, 42.0,  9.0,  4.5, 'incap', TRUE),
('Olla de carne (sopa)',          98,   6.5, 12.0,  2.5,  2.0, 'incap', TRUE),
('Picadillo de papa con carne',   98,   3.5, 15.0,  2.5,  2.0, 'incap', TRUE),
('Tamales de maíz',              185,   5.5, 28.0,  6.0,  2.5, 'incap', TRUE),
('Arroz con leche',              123,   3.2, 23.5,  2.0,  0.2, 'incap', TRUE),
('Sopa de frijoles',              75,   4.5, 13.0,  0.8,  3.5, 'incap', TRUE),
('Chorreadas (tortillas de elote)',202,  4.2, 36.5,  5.0,  2.8, 'incap', TRUE),
('Arroz frito',                  181,   3.6, 29.0,  5.8,  0.7, 'incap', TRUE),
('Picadillo de arracache',        78,   2.0, 14.5,  1.5,  2.2, 'incap', TRUE),
('Sopa de mondongo',              95,   7.5,  9.5,  2.5,  1.5, 'incap', TRUE),
('Pozol de maíz',                 60,   1.5, 13.5,  0.3,  1.0, 'incap', TRUE),

-- ═════════════════════════════ NUECES Y SEMILLAS ═══════════════════════════════
('Maní (cacahuate)',             567,  25.8, 16.1, 49.2,  8.5, 'incap', TRUE),
('Semillas de girasol',          584,  20.8, 20.0, 51.5,  8.6, 'incap', TRUE),
('Ajonjolí (semillas de sésamo)',573,  17.7, 23.5, 49.7, 11.8, 'incap', TRUE),
('Almendras',                    579,  21.2, 21.6, 49.9, 12.5, 'incap', TRUE),
('Nuez de marañón (cashew)',     553,  18.2, 30.2, 43.9,  3.3, 'incap', TRUE),
('Semillas de calabaza',         559,  30.2, 10.7, 49.1,  6.0, 'incap', TRUE)

ON CONFLICT (nombre, fuente) DO NOTHING;

-- ── Verificar resultado ──────────────────────────────────────────────────────────
SELECT
  COUNT(*)                                       AS total_insertados,
  COUNT(*) FILTER (WHERE validado = TRUE)        AS validados,
  fuente
FROM alimentos
WHERE fuente = 'incap'
GROUP BY fuente;
