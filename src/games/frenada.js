// Frenada de emergencia (VERTICAL): el Corsa avanza hacia arriba y ves el
// obstaculo venir desde lejos. Toca para frenar lo mas cerca posible sin
// chocarlo. 5 rondas. Chorsa: el input llega con retardo (motor), mas
// velocidad.

import { makeGame, rand, clamp, drawRoad } from './base.js';
import { drawCar, drawCone } from '../engine/sprites.js';
import { sfx } from '../engine/audio.js';

const ROUNDS = 5;

export function createFrenada(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.round = 0;
      g.carX = stage.w / 2;
      g.carY = stage.h * 0.82;
      g.carW = stage.w * 0.17;
      g.carH = g.carW * 1.85;
      g.hud.hint = 'El Corsa va a fondo. Tocá para frenar lo más cerca posible del auto de adelante — sin chocarlo.';
      // Cap speed so full-chorsa is hard but not impossible
      g.v0 = Math.min(stage.h * 0.88, stage.h * 0.48 * chorsa.speedMult);
      g.decel = stage.h * 1.05;
      g.graceScore = 20;
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

      if (stage.pointer.justDown) {
        if (!g.braking) sfx('brake');
        g.braking = true;
      }
      if (g.braking) g.v = Math.max(0, g.v - g.decel * dt);

      g.carPos += g.v * dt;
      g.roadOff = (g.roadOff + g.v * dt) % 64;

      // Correct hitbox: crash when front of Corsa reaches rear of obstacle
      // Both cars drawn at their center; combined half-heights = carH * 1.025
      const gap = g.dist - g.carPos;
      if (gap <= g.carH * 1.0) {
        sfx('crash');
        finishRound(stage, g, 0, true);
        return;
      }
      if (g.braking && g.v <= 0) {
        const pts = clamp(Math.round(240 - (gap / stage.h) * 480), 0, 240);
        if (pts > 0) sfx('score');
        finishRound(stage, g, pts, false);
      }
    },

    render(stage, ctx, t, g) {
      const w = stage.w;
      const h = stage.h;
      drawRoad(ctx, w, h, g.roadOff, 3);

      const gap = g.dist - g.carPos;

      // obstaculo (auto parado adelante)
      const obstY = g.carY - gap;

      // ── BRAKING CONES — posición ideal de frenado (justo atrás del obstáculo) ──
      const idealStopY = obstY + g.carH * 1.05;
      if (idealStopY > -30 && idealStopY < h + 30) {
        const cs = w * 0.038;
        drawCone(ctx, w * 0.115, idealStopY, cs);
        drawCone(ctx, w * 0.885, idealStopY, cs);
        ctx.save();
        ctx.strokeStyle = 'rgba(243,193,75,0.80)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 7]);
        ctx.beginPath();
        ctx.moveTo(w * 0.13, idealStopY);
        ctx.lineTo(w * 0.87, idealStopY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      drawCar(ctx, g.carX, obstY, g.carW * 1.05, g.carH, '#6a6d78');

      // el Corsa
      drawCar(ctx, g.carX, g.carY, g.carW, g.carH, '#e23b2e');

      ctx.textAlign = 'center';
      if (g.locked) {
        ctx.font = '900 42px system-ui, sans-serif';
        ctx.fillStyle = g.crashed ? '#e23b2e' : '#22a559';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 10;
        ctx.fillText(g.crashed ? '¡CHOCASTE!' : `+${g.lastPts}`, w / 2, h * 0.5);
        ctx.shadowBlur = 0;
      } else {
        ctx.font = '900 38px system-ui, sans-serif';
        ctx.fillStyle = g.braking ? '#f5b301' : '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 10;
        ctx.fillText(g.braking ? 'FRENANDO...' : 'TOCÁ PARA FRENAR', w / 2, h * 0.93);
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
  g.dist = rand(stage.h * 1.1, stage.h * 1.55);
}

function finishRound(stage, g, pts, crashed) {
  g.lastPts = pts;
  g.crashed = crashed;
  g.score += pts;
  g.locked = true;
  g.lockT = 1.2;
}
