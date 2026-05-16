// Frenada de emergencia (VERTICAL): el Corsa avanza hacia arriba y ves el
// obstaculo venir desde lejos. Toca para frenar lo mas cerca posible sin
// chocarlo. 5 rondas. Chorsa: el input llega con retardo (motor), mas
// velocidad.

import { makeGame, rand, clamp, drawRoad } from './base.js';
import { drawCar } from '../engine/sprites.js';

const ROUNDS = 5;

export function createFrenada(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.round = 0;
      g.carX = stage.w / 2;
      g.carY = stage.h * 0.82;
      g.carW = stage.w * 0.17;
      g.carH = g.carW * 1.85;
      g.v0 = stage.h * 0.55 * chorsa.speedMult;
      g.decel = stage.h * 1.05;
      startRound(stage, g);
    },

    step(dt, stage, t, g) {
      if (g.locked) {
        g.lockT -= dt;
        if (g.lockT <= 0) {
          if (g.round >= ROUNDS) g.done = true;
          else startRound(stage, g);
        }
        return;
      }

      if (stage.pointer.justDown) g.braking = true;
      if (g.braking) g.v = Math.max(0, g.v - g.decel * dt);

      g.carPos += g.v * dt;
      g.roadOff = (g.roadOff + g.v * dt) % 64;

      const gap = g.dist - g.carPos; // px que faltan al obstaculo
      if (gap <= g.carH * 0.5) {
        finishRound(stage, g, 0, true);
        return;
      }
      if (g.braking && g.v <= 0) {
        const pts = clamp(Math.round(240 - (gap / stage.h) * 480), 0, 240);
        finishRound(stage, g, pts, false);
      }
    },

    render(stage, ctx, t, g) {
      const w = stage.w;
      const h = stage.h;
      drawRoad(ctx, w, h, g.roadOff, 3);

      // obstaculo (auto parado adelante) - se ve venir desde el inicio
      const obstY = g.carY - (g.dist - g.carPos);
      drawCar(ctx, g.carX, obstY, g.carW * 1.05, g.carH, '#6a6d78');

      // el Corsa
      drawCar(ctx, g.carX, g.carY, g.carW, g.carH, '#e23b2e');

      ctx.textAlign = 'center';
      if (g.locked) {
        ctx.font = '900 30px system-ui, sans-serif';
        ctx.fillStyle = g.crashed ? '#e23b2e' : '#22a559';
        ctx.fillText(g.crashed ? 'CHOCASTE' : `+${g.lastPts}`, w / 2, h * 0.5);
      } else {
        ctx.font = '900 26px system-ui, sans-serif';
        ctx.fillStyle = g.braking ? '#f5b301' : '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;
        ctx.fillText(g.braking ? 'FRENANDO...' : 'TOCA PARA FRENAR', w / 2, h * 0.93);
        ctx.shadowBlur = 0;
      }
      ctx.textAlign = 'left';
    },
  });
}

function startRound(stage, g) {
  g.round++;
  g.hud.label = `Frenada ${g.round}/${ROUNDS}`;
  g.carPos = 0;
  g.v = g.v0;
  g.braking = false;
  g.locked = false;
  g.crashed = false;
  g.lastPts = 0;
  g.roadOff = 0;
  // distancia al obstaculo: lejos para dar tiempo de calcular la frenada
  g.dist = rand(stage.h * 0.95, stage.h * 1.25);
}

function finishRound(stage, g, pts, crashed) {
  g.lastPts = pts;
  g.crashed = crashed;
  g.score += pts;
  g.locked = true;
  g.lockT = 1.2;
}
