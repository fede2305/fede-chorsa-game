// Agarra birras INFINITO: move el Corsa para juntar las birras que caen.
// No termina por tiempo: cae cada vez mas rapido. Pierdes si se te
// escapan 3 birras (los mates son bonus, no cuentan en contra).

import { makeGame, clamp, lerp, rand, drawRoad, rampFactor } from './base.js';
import { drawCar, drawBeer, drawMate } from '../engine/sprites.js';
import { driftOffset } from '../engine/effects.js';
import { sfx } from '../engine/audio.js';

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
          sfx('catch');
          g.score += it.mate ? 25 : 10;
        } else if (!it.done && it.y > stage.h + 30) {
          it.done = true;
          if (!it.mate) {
            sfx('miss');
            g.miss++;
            g.hud.label = `Birras perdidas: ${g.miss}/${MAX_MISS}`;
            g.recentLossT = 1;
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

      // ── LIVES (hearts) — más grandes y con animación de "rotura" ─────────
      const livesLeft = MAX_MISS - g.miss;
      for (let i = 0; i < MAX_MISS; i++) {
        const alive = i < livesLeft;
        const justLost = i === livesLeft && g.recentLossT > 0;
        const scale = justLost ? 1 + Math.sin((1 - g.recentLossT) * Math.PI * 2) * 0.25 : 1;
        ctx.save();
        const hx = w - 32 - i * 54;
        const hy = 55;
        ctx.translate(hx, hy);
        ctx.scale(scale, scale);
        if (alive) {
          ctx.fillStyle = '#e23b2e';
          ctx.shadowColor = 'rgba(226,59,46,0.55)';
          ctx.shadowBlur = 10;
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
        }
        drawHeart(ctx, 0, 0, 18);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
      // tick down lost animation
      if (g.recentLossT > 0) g.recentLossT = Math.max(0, g.recentLossT - 0.02);

      // ── LEGEND chip (first 4 seconds only) ───────────────────────────────
      if (g.playT < 5) {
        const a = Math.min(1, Math.min(g.playT, 5 - g.playT) * 1.5);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(16,16,24,0.85)';
        roundChip(ctx, w / 2 - 150, h * 0.52, 300, 76, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(243,193,75,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = '800 17px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f3c14b';
        ctx.fillText('🍺 BIRRA = +10 pts — perder 3 = fin', w / 2, h * 0.535);
        ctx.fillStyle = '#2de07a';
        ctx.fillText('🧉 MATE = +25 pts bonus (no perjudica)', w / 2, h * 0.565);
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

function drawHeart(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.arc(cx - size * 0.35, cy - size * 0.1, size * 0.45, Math.PI * 1.1, Math.PI * 1.95);
  ctx.arc(cx + size * 0.35, cy - size * 0.1, size * 0.45, Math.PI * 1.05, Math.PI * 1.9);
  ctx.lineTo(cx, cy + size * 0.65);
  ctx.closePath();
  ctx.fill();
}
