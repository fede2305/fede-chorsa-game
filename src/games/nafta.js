// Carga nafta: manten apretado para llenar el tanque, solta cerca del 100%
// sin pasarte. Chorsa: la barra se llena mas rapido y vibra.

import { makeGame } from './base.js';
import { drawCarSide } from '../engine/sprites.js';

const ROUNDS = 5;

export function createNafta(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.round = 0;
      g.fillSpeed = 32 + chorsa.colorWarp * 70 + (chorsa.speedMult - 1) * 50;
      g.jitter = chorsa.drift * 14;
      startRound(g);
    },

    step(dt, stage, t, g) {
      if (g.locked) {
        g.lockT -= dt;
        if (g.lockT <= 0) {
          if (g.round >= ROUNDS) {
            g.done = true;
          } else {
            startRound(g);
          }
        }
        return;
      }

      if (stage.pointer.down) {
        g.fill += g.fillSpeed * dt;
        if (g.fill > 118) {
          // se desbordo
          g.fill = 118;
          g.spill = true;
          finishRound(g, 0);
        }
      } else if (g.fill > 1 && stage.pointer.justUp) {
        // solto: puntua segun cuan cerca de 100 quedo
        const pts = g.fill <= 100 ? Math.round(g.fill) : 0;
        finishRound(g, pts);
      }
    },

    render(stage, ctx, t, g) {
      const w = stage.w;
      const h = stage.h;
      ctx.fillStyle = '#13131c';
      ctx.fillRect(0, 0, w, h);

      drawCarSide(ctx, w * 0.36, h * 0.5, w * 0.52, h * 0.26, '#e23b2e');

      // tanque (barra vertical)
      const bx = w * 0.74;
      const bw = w * 0.16;
      const by = h * 0.16;
      const bh = h * 0.62;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by, bw, bh);

      // zona objetivo (90-100%)
      ctx.fillStyle = 'rgba(46,164,79,0.45)';
      ctx.fillRect(bx, by + bh * 0.0, bw, bh * 0.1);

      // nafta cargada
      const jit = g.locked ? 0 : (Math.random() - 0.5) * g.jitter;
      const lvl = Math.min(g.fill, 118) / 100;
      const fh = Math.min(bh, bh * lvl) + jit;
      ctx.fillStyle = g.fill > 100 ? '#e23b2e' : '#f3c14b';
      ctx.fillRect(bx, by + bh - fh, bw, fh);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(bx, by, bw, bh);

      // linea del 100%
      ctx.strokeStyle = '#2ea44f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx - 6, by);
      ctx.lineTo(bx + bw + 6, by);
      ctx.stroke();
      ctx.lineWidth = 1;

      ctx.fillStyle = '#fff';
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(g.fill)}%`, bx + bw / 2, by + bh + 26);

      if (g.locked) {
        ctx.font = '800 22px system-ui, sans-serif';
        ctx.fillStyle = g.spill ? '#e23b2e' : '#2ea44f';
        ctx.fillText(g.spill ? 'SE DERRAMO!' : `+${g.lastPts}`, w / 2, h * 0.9);
      } else {
        ctx.font = '700 15px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('manten apretado... solta cerca del 100%', w / 2, h * 0.9);
      }
      ctx.textAlign = 'left';
    },
  });
}

function startRound(g) {
  g.round++;
  g.fill = 0;
  g.locked = false;
  g.spill = false;
  g.lastPts = 0;
  g.hud.label = `Tanque ${g.round}/${ROUNDS}`;
}

function finishRound(g, pts) {
  g.lastPts = pts;
  g.score += pts;
  g.locked = true;
  g.lockT = 1.1;
}
