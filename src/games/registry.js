// Registro de minijuegos: clave -> { name, tip, create }.
// Las claves coinciden con el campo `game` del lineup (src/lineup.js).

import { createRunner } from './runner.js';
import { createAcelera } from './acelera.js';
import { createFindCorsa } from './findcorsa.js';
import { createBirras } from './birras.js';
import { createNafta } from './nafta.js';
import { createSobriedad } from './sobriedad.js';
import { createFrenada } from './frenada.js';
import { createDragrace } from './dragrace.js';
import { createParking } from './parking.js';
import { createEl4 } from './el4.js';

export const GAMES = {
  runner: {
    name: 'Runner',
    tip: 'Tocá izquierda o derecha para cambiar de carril y esquivar el tráfico.',
    tipBullets: [
      'Tocá el lado IZQUIERDO o DERECHO de la pantalla para cambiar de carril',
      'El tráfico viene cada vez más rápido — no te dormís',
      'Es infinito: sobreviví lo máximo posible',
    ],
    controlIcon: '◀ ▶',
    create: createRunner,
  },
  acelera: {
    name: 'Acelera',
    tip: 'Tocá lo más rápido que puedas para acelerar el Corsa.',
    tipBullets: [
      'Cada toque suma un pisotón al acelerador',
      'La fricción te frena — si parás, perdés velocidad',
      'Tenés 7 segundos para llegar lo más lejos posible',
    ],
    controlIcon: '👆 👆',
    create: createAcelera,
  },
  findcorsa: {
    name: 'Encontrá el Corsa rojo',
    tip: 'Tocá el Corsa rojo lo antes posible. Cuidado con los otros autos.',
    tipBullets: [
      'Hay autos parecidos pero NO son el Corsa rojo',
      'Si tocás el equivocado perdés 1.3 segundos',
      'Los autos se mueven — apuntá rápido y preciso',
    ],
    controlIcon: '🎯',
    create: createFindCorsa,
  },
  birras: {
    name: 'Agarrá birras',
    tip: 'Movete con el dedo para agarrar las birras (🍺). Mate (🧉) = bonus.',
    tipBullets: [
      'Movete con el dedo para mover al Corsa',
      'Birras = 10 puntos. Mates = 25 puntos bonus',
      'Si se te caen 3 birras, perdés. Los mates no descuentan',
    ],
    controlIcon: '↔',
    create: createBirras,
  },
  nafta: {
    name: 'Carga nafta',
    tip: 'Mantené apretado para cargar. Soltá cerca del tanque lleno, sin pasarte.',
    tipBullets: [
      'Tap-hold = cargás nafta. Soltá para detener',
      'El objetivo es llegar exactamente al 100%',
      'Si te pasás, derramás. 5 tanques en total',
    ],
    controlIcon: '✋',
    create: createNafta,
  },
  sobriedad: {
    name: 'Control de alcoholemia',
    tip: 'Soplá el micrófono y mantené la barra en zona VERDE durante 2.4 segundos.',
    tipBullets: [
      'Soplá el micrófono para subir la barra',
      'Mantenela en la zona VERDE 2.4 segundos seguidos',
      'Si soplás demasiado se pasa — calibrá la fuerza',
    ],
    controlIcon: '🎤',
    create: createSobriedad,
  },
  el4: {
    name: 'Hacé el 4',
    tip: 'Mantené el teléfono derecho para equilibrar la figura sobre un pie. Si se cae, perdés.',
    tipBullets: [
      'Inclinás el teléfono = la figura se inclina',
      'El marcador verde muestra cuánto te alejás del centro',
      'Si el equilibrio llega a 0, la figura cae',
    ],
    controlIcon: '📱',
    create: createEl4,
  },
  frenada: {
    name: 'Frenada de emergencia',
    tip: 'Frená lo más cerca posible del obstáculo, sin chocarlo.',
    tipBullets: [
      'El Corsa va a fondo — vas a chocar si no frenás',
      'Tocá para frenar. Cuanto más cerca pares, más puntos',
      '5 rondas con autos cada vez más cerca',
    ],
    controlIcon: '👆',
    create: createFrenada,
  },
  dragrace: {
    name: 'Drag race',
    tip: 'Esperá el VERDE del semáforo. Después tocá cuando la aguja esté en la zona verde para cambiar de marcha.',
    tipBullets: [
      'Esperá los 3 destellos rojos del semáforo → arranca con VERDE',
      'Tocá cuando la aguja del tacómetro esté en la zona verde',
      '6 marchas. Cada cambio mal te penaliza',
    ],
    controlIcon: '🚦',
    create: createDragrace,
  },
  parking: {
    name: 'Estaciona el Corsa',
    tip: 'Arrastrá el volante para girar. Pedal verde acelera, rojo frena. Metelo en el box.',
    tipBullets: [
      'Volante: arrastrá izq/der para girar las ruedas',
      'Pedal VERDE (derecha) = acelerar. Pedal ROJO (izquierda) = frenar',
      'Mantené freno cuando estés parado para reversa',
      'Esquivá los autos vecinos y metete derecho en el box',
    ],
    controlIcon: '🎮',
    create: createParking,
  },
};
