// Agarra birras INFINITO: move el Corsa para juntar las birras que caen.
// No termina por tiempo: cae cada vez mas rapido. Pierdes si se te
// escapan 3 birras (los mates son bonus, no cuentan en contra).

import { makeGame, clamp, lerp, rand, drawRoad, rampFactor } from './base.js';
import { drawCar, drawBeer, drawMate } from '../engine/sprites.js';
import { driftOffset } from '../engine/effects.js';

const MAX_MISS = 3;

export function createBirras(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.carX = stage.w / 2;
      g.carW = stage.w * 0.2;
      g.carH = g.carW * 1.85;
      g.carY = stage.h * 0.82;
      g.items = [];
      g.spawnT = -0.6;
      g.baseFall = stage.h * 0.4 * chorsa.speedMult;
      g.miss = 0;
      g.roadOff = 0;
      g.hud.label = `Se te escaparon: 0/${MAX_MISS}`;
    },

    step(dt, stage, t, g) {
      const chorsa = g.chorsa;
      const ramp = rampFactor(g.playT, 0.05, 3.0);
      const fall = g.baseFall * ramp;
      const spawnEvery = clamp(0.7 / ramp, 0.26, 0.7);

      g.roadOff = (g.roadOff + fall * dt) % 64;

      // el auto sigue al dedo; la chorsa lo hace resbalar
      let target = stage.pointer.down ? stage.pointer.x : g.carX;
      target += driftOffset(chorsa, t, 7) * stage.w * 0.22;
      const grip = clamp(dt * (7 - chorsa.drift * 4), 0, 1);
      g.carX = lerp(g.carX, target, grip);
      g.carX = clamp(g.carX, g.carW / 2, stage.w - g.carW / 2);

      // spawn
      g.spawnT += dt;
      if (g.spawnT >= spawnEvery) {
        g.spawnT = 0;
        g.items.push({
          x: rand(stage.w * 0.12, stage.w * 0.88),
          y: -30,
          mate: Math.random() < 0.16,
        });
      }

      // caer + recolectar + contar las que se escapan
      for (const it of g.items) {
        it.y += fall * dt;
        if (
          !it.done &&
          Math.abs(it.x - g.carX) < g.carW * 0.62 &&
          Math.abs(it.y - g.carY) < g.carH * 0.45
        ) {
          it.done = true;
          g.score += it.mate ? 25 : 10;
        } else if (!it.done && it.y > stage.h + 30) {
          it.done = true;
          if (!it.mate) {
            g.miss++;
            g.hud.label = `Se te escaparon: ${g.miss}/${MAX_MISS}`;
            if (g.miss >= MAX_MISS) {
              g.done = true;
              return;
            }
          }
        }
      }
      g.items = g.items.filter((it) => !it.done);
    },

    render(stage, ctx, t, g) {
      drawRoad(ctx, stage.w, stage.h, g.roadOff, 1);
      for (const it of g.items) {
        if (it.mate) drawMate(ctx, it.x, it.y, 15);
        else drawBeer(ctx, it.x, it.y, 13);
      }
      drawCar(ctx, g.carX, g.carY, g.carW, g.carH, '#e23b2e');

      // corazones / vidas restantes
      const livesLeft = MAX_MISS - g.miss;
      for (let i = 0; i < MAX_MISS; i++) {
        ctx.fillStyle = i < livesLeft ? '#e23b2e' : 'rgba(255,255,255,0.25)';
        const hx = stage.w - 30 - i * 34;
        const hy = 32;
        ctx.beginPath();
        ctx.arc(hx - 5, hy, 6, 0, Math.PI * 2);
        ctx.arc(hx + 5, hy, 6, 0, Math.PI * 2);
        ctx.moveTo(hx - 11, hy + 2);
        ctx.lineTo(hx, hy + 14);
        ctx.lineTo(hx + 11, hy + 2);
        ctx.fill();
      }
    },
  });
}
