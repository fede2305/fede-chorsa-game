// Parametros del "modo chorsa" por nivel 1-5.
// Cada minijuego lee estos valores para escalar dificultad y distorsion visual.
// drift        -> cuanto se desvia solo el auto / controles (0-1)
// shake        -> amplitud del temblor de pantalla en px
// colorWarp    -> intensidad de distorsion de color (0-1)
// speedMult    -> multiplicador de velocidad general
// inputLagMs   -> retardo aplicado al input del jugador
// wobbleHz     -> frecuencia del bamboleo de pantalla
// blur         -> desenfoque en px

const LEVELS = {
  1: { drift: 0.0,  shake: 0,  colorWarp: 0.0,  speedMult: 1.0, inputLagMs: 0,   wobbleHz: 0.0, blur: 0 },
  2: { drift: 0.15, shake: 3,  colorWarp: 0.1,  speedMult: 1.15, inputLagMs: 40,  wobbleHz: 0.3, blur: 0 },
  3: { drift: 0.35, shake: 7,  colorWarp: 0.25, speedMult: 1.35, inputLagMs: 90,  wobbleHz: 0.6, blur: 1 },
  4: { drift: 0.6,  shake: 12, colorWarp: 0.45, speedMult: 1.6,  inputLagMs: 150, wobbleHz: 1.0, blur: 2 },
  5: { drift: 0.9,  shake: 20, colorWarp: 0.7,  speedMult: 1.95, inputLagMs: 230, wobbleHz: 1.6, blur: 3 },
};

export function getChorsa(level) {
  return LEVELS[Math.max(1, Math.min(5, level || 1))];
}

export const ETAPA_NAMES = {
  1: 'Corsa',
  2: 'Corsa alegre',
  3: 'Corsa en pedo',
  4: 'Chorsa',
  5: 'Full chorsa',
};
