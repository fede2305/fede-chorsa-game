// Registro de minijuegos: clave -> { name, tip, create }.
// Las claves coinciden con el campo `game` del lineup (src/lineup.js).

import { createRunner } from './runner.js';
import { createAcelera } from './acelera.js';
import { createFindCorsa } from './findcorsa.js';
import { createBirras } from './birras.js';
import { createNafta } from './nafta.js';
import { createJumper } from './jumper.js';
import { createFrenada } from './frenada.js';
import { createDragrace } from './dragrace.js';
import { createParking } from './parking.js';

export const GAMES = {
  runner: {
    name: 'Runner',
    tip: 'Toca izquierda o derecha para cambiar de carril y esquivar el trafico.',
    create: createRunner,
  },
  acelera: {
    name: 'Acelera',
    tip: 'Toca lo mas rapido que puedas para acelerar el Corsa.',
    create: createAcelera,
  },
  findcorsa: {
    name: 'Encontra el Corsa rojo',
    tip: 'Toca el Corsa rojo lo antes posible. Cuidado con los otros autos.',
    create: createFindCorsa,
  },
  birras: {
    name: 'Agarra birras',
    tip: 'Move el Corsa para agarrar las birras que caen.',
    create: createBirras,
  },
  nafta: {
    name: 'Carga nafta',
    tip: 'Manten apretado para cargar. Solta cerca del tanque lleno, sin pasarte.',
    create: createNafta,
  },
  jumper: {
    name: 'Esquiva el bache',
    tip: 'Toca para saltar los baches y conos.',
    create: createJumper,
  },
  frenada: {
    name: 'Frenada de emergencia',
    tip: 'Frena lo mas cerca posible del obstaculo, sin chocarlo.',
    create: createFrenada,
  },
  dragrace: {
    name: 'Drag race',
    tip: 'Toca para cambiar de marcha cuando la aguja este en la zona verde.',
    create: createDragrace,
  },
  parking: {
    name: 'Estaciona el Corsa',
    tip: 'Manten apretado a izquierda o derecha para doblar. Meti el auto en el recuadro.',
    create: createParking,
  },
};
