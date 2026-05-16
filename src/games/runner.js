// Runner INFINITO: el Corsa esquiva trafico en 3 carriles.
// No termina por tiempo: se va poniendo cada vez mas rapido y con mas
// trafico hasta que chocas. Toca izquierda/derecha para cambiar de carril.

import { makeGame, clamp, lerp, drawRoad, rampFactor } from './base.js';
import { drawCar } from '../engine/sprites.js';
import { driftOffset } from '../engine/effects.js';

const LANES = 3;
const OBST_COLORS = ['#2d7dd2', '#22a559', '#f5b301', '#8a8f9a', '#e8e8ec', '#7b4fd8'];

function laneX(stage, lane) {
  const left = stage.w * 0.07;
  const span = stage.w * 0.86;
  return left + (span * (lane + 0.5)) / LANES;
}

export function createRunner(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.lane = 1;
      g.carX = laneX(stage, 1);
      g.carW = stage.w * 0.17;
      g.carH = g.carW * 1.85;
      g.carY = stage.h * 0.8;
      g.dist = 0;
      g.baseSpeed = stage.h * 0.5 * chorsa.speedMult;
      g.roadOff = 0;
      g.obst = [];
      g.spawnT = -0.9;
      g.graceScore = 20;
      g.hud.hint = 'Tocá izquierda o derecha para cambiar de carril y esquivar el tráfico';
      g.hud.label = 'Toca izq/der para cambiar carril';
    },

    step(dt, stage, t, g) {
      const chorsa = g.chorsa;
      // dificultad creciente con el tiempo jugado
      const ramp = rampFactor(g.playT, 0.14, 3.5);
      const speed = g.baseSpeed * ramp;
      const spawnEvery = clamp(1.0 / ramp, 0.32, 1.0);

      // cambio de carril
      if (stage.pointer.justDown) {
        if (stage.pointer.x < stage.w / 2) g.lane = clamp(g.lane - 1, 0, LANES - 1);
        else g.lane = clamp(g.lane + 1, 0, LANES - 1);
      }

      // el auto tiende al carril; la chorsa lo desvia
      const target = laneX(stage, g.lane) + driftOffset(chorsa, t, 3) * stage.w * 0.16;
      g.carX = lerp(g.carX, target, clamp(dt * 8, 0, 1));
      g.carX = clamp(g.carX, stage.w * 0.1, stage.w * 0.9);

      // avance
      g.dist += speed * dt;
      g.roadOff = (g.roadOff + speed * dt) % 64;
      g.score = Math.floor(g.dist / 7);

      // spawn de trafico
      g.spawnT += dt;
      if (g.spawnT >= spawnEvery) {
        g.spawnT = 0;
        const lane = (Math.random() * LANES) | 0;
        g.obst.push({
          lane,
          x: laneX(stage, lane),
          y: -g.carH,
          color: OBST_COLORS[(Math.random() * OBST_COLORS.length) | 0],
        });
      }

      // mover y chequear choque
      for (const o of g.obst) {
        o.y += speed * dt;
        const dx = Math.abs(o.x - g.carX);
        const dy = Math.abs(o.y - g.carY);
        if (dx < g.carW * 0.82 && dy < g.carH * 0.82) {
          g.done = true;
          return;
        }
      }
      g.obst = g.obst.filter((o) => o.y < stage.h + g.carH);
    },

    render(stage, ctx, t, g) {
      drawRoad(ctx, stage.w, stage.h, g.roadOff, LANES);
      for (const o of g.obst) {
        drawCar(ctx, o.x, o.y, g.carW, g.carH, o.color);
      }
      drawCar(ctx, g.carX, g.carY, g.carW, g.carH, '#e23b2e');
    },
  });
}
