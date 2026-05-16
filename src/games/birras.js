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
      g.graceScore = 15;
      g.hud.hint = 'Movete con el dedo para agarrar las BIRRAS (🍺) — se te caen 3 y perdés. Los mates son puntos bonus.';
      g.hud.label = `Birras perdidas: 0/${MAX_MISS}`;
    },

    step(dt, stage, t, g) {
      const chorsa = g.chorsa;
      const ramp = rampFactor(g.playT, 0.10, 3.0);
      const fall = g.baseFall * ramp;
      const spawnEvery = clamp(0.7 / ramp, 0.26, 0.7);

      g.roadOff = (g.roadOff + fall * dt) % 64;

      let target = stage.pointer.down ? stage.pointer.x : g.carX;
      target += driftOffset(chorsa, t, 7) * stage.w * 0.22;
      const grip = clamp(dt * (7 - chorsa.drift * 4), 0, 1);
      g.carX = lerp(g.carX, target, grip);
      g.carX = clamp(g.carX, g.carW / 2, stage.w - g.carW / 2);

      g.spawnT += dt;
      if (g.spawnT >= spawnEvery) {
        g.spawnT = 0;
        g.items.push({
          x: rand(stage.w * 0.12, stage.w * 0.88),
          y: -30,
          mate: Math.random() < 0.18,
          flash: 0,
        });
      }

      for (const it of g.items) {
        it.y += fall * dt;
        if (it.flash > 0) it.flash -= dt * 3;
        if (
          !it.done &&
          Math.abs(it.x - g.carX) < g.carW * 0.62 &&
          Math.abs(it.y - g.carY) < g.carH * 0.45
        ) {
          it.done = true;
          it.flash = 1;
          g.score += it.mate ? 25 : 10;
        } else if (!it.done && it.y > stage.h + 30) {
          it.done = true;
          if (!it.mate) {
            g.miss++;
            g.hud.label = `Birras perdidas: ${g.miss}/${MAX_MISS}`;
            if (g.miss >= MAX_MISS) {
              g.done = true;
              return;
            }
          }
        }
      }
      g.items = g.items.filter((it) => !it.done || it.flash > 0);
    },

    render(stage, ctx, t, g) {
      const w = stage.w;
      const h = stage.h;
      drawRoad(ctx, w, h, g.roadOff, 1);

      for (const it of g.items) {
        if (it.mate) drawMate(ctx, it.x, it.y, 15);
        else drawBeer(ctx, it.x, it.y, 13);

        // catch flash ring
        if (it.flash > 0) {
          ctx.save();
          ctx.strokeStyle = it.mate ? `rgba(46,164,79,${it.flash})` : `rgba(243,193,75,${it.flash})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(it.x, it.y, 20 + (1 - it.flash) * 14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      drawCar(ctx, g.carX, g.carY, g.carW, g.carH, '#e23b2e');

      // ── LIVES (hearts) ────────────────────────────────────────────────────
      const livesLeft = MAX_MISS - g.miss;
      for (let i = 0; i < MAX_MISS; i++) {
        ctx.fillStyle = i < livesLeft ? '#e23b2e' : 'rgba(255,255,255,0.22)';
        const hx = w - 30 - i * 34;
        const hy = 32;
        ctx.beginPath();
        ctx.arc(hx - 5, hy, 6, 0, Math.PI * 2);
        ctx.arc(hx + 5, hy, 6, 0, Math.PI * 2);
        ctx.moveTo(hx - 11, hy + 2);
        ctx.lineTo(hx, hy + 14);
        ctx.lineTo(hx + 11, hy + 2);
        ctx.fill();
      }

      // ── LEGEND chip (first 4 seconds only) ───────────────────────────────
      if (g.playT < 4.5) {
        const a = Math.min(1, Math.min(g.playT, 4.5 - g.playT) * 1.5);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(16,16,24,0.78)';
        roundChip(ctx, w / 2 - 118, h * 0.55, 236, 56, 14);
        ctx.fill();
        ctx.font = '700 13px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f3c14b';
        ctx.fillText('🍺 birra = +10 pts  —  perder 3 = fin', w / 2, h * 0.555);
        ctx.fillStyle = '#2de07a';
        ctx.fillText('☕ mate = +25 pts bonus  (no perjudica)', w / 2, h * 0.578);
        ctx.restore();
      }
    },
  });
}

function roundChip(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
