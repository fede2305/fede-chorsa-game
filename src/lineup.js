// Orden FIJO de los 15 slots. Igual para todos los jugadores (justicia competitiva).
// No cambiar el orden una vez que arranco el evento.
// game -> clave del minijuego (debe existir en src/games/registry.js)

export const LINEUP = [
  // Etapa 1 - Corsa - chorsa 1
  { slot: 1,  etapa: 1, chorsa: 1, game: 'findcorsa' },
  { slot: 2,  etapa: 1, chorsa: 1, game: 'acelera' },
  { slot: 3,  etapa: 1, chorsa: 1, game: 'runner' },
  // Etapa 2 - Corsa alegre - chorsa 2
  { slot: 4,  etapa: 2, chorsa: 2, game: 'birras' },
  { slot: 5,  etapa: 2, chorsa: 2, game: 'nafta' },
  { slot: 6,  etapa: 2, chorsa: 2, game: 'sobriedad' },
  // Etapa 3 - Corsa en pedo - chorsa 3
  { slot: 7,  etapa: 3, chorsa: 3, game: 'frenada' },
  { slot: 8,  etapa: 3, chorsa: 3, game: 'dragrace' },
  { slot: 9,  etapa: 3, chorsa: 3, game: 'runner' },
  // Etapa 4 - Chorsa - chorsa 4
  { slot: 10, etapa: 4, chorsa: 4, game: 'parking' },
  { slot: 11, etapa: 4, chorsa: 4, game: 'sobriedad' },
  { slot: 12, etapa: 4, chorsa: 4, game: 'birras' },
  // Etapa 5 - Full chorsa - chorsa 5
  { slot: 13, etapa: 5, chorsa: 5, game: 'frenada' },
  { slot: 14, etapa: 5, chorsa: 5, game: 'dragrace' },
  { slot: 15, etapa: 5, chorsa: 5, game: 'parking', boss: true },
];

export function slotsForEtapa(etapa) {
  return LINEUP.filter((s) => s.etapa === etapa);
}

export function totalEtapas() {
  return Math.max(...LINEUP.map((s) => s.etapa));
}
