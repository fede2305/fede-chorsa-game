// Carga nafta: manten apretado para llenar el tanque, solta cerca del 100%
// sin pasarte demasiado. El puntaje es simetrico: 95% = 105%.
// Chorsa: la barra se llena mas rapido y vibra.

import { makeGame } from './base.js';
import { drawCarSide } from '../engine/sprites.js';

const ROUNDS = 5;
// Score = max(0, 100 - dist*4) where dist = |fill - 100|
// 100%=100, 95%/105%=80, 90%/110%=60, 85%/115%=40, <=75%/>=125%=0

export function createNafta(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.round = 0;
      g.fillSpeed = 32 + chorsa.colorWarp * 70 + (chorsa.speedMult - 1) * 50;
      g.jitter = chorsa.drift * 14;
      g.hud.hint = 'Manten apretado para cargar. Soltá cerca del 100% — un poco de más también está bien.';
      startRound(g);
    },

    step(dt, stage, t, g) {
      if (g.locked) {
        g.lockT -= dt;
        if (g.lockT <= 0) {
          if (g.round >= ROUNDS) g.done = true;
          else startRound(g);
        }
        return;
      }

      if (stage.pointer.down) {
        g.fill += g.fillSpeed * dt;
        if (g.fill > 122) {
          g.fill = 122;
          g.spill = true;
          finishRound(g, 0);
        }
      } else if (g.fill > 1 && stage.pointer.justUp) {
        const dist = Math.abs(g.fill - 100);
        const pts = Math.max(0, Math.round(100 - dist * 4));
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

      // fondo oscuro
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by, bw, bh);

      // zona verde: 90-100% (top 10% of bar)
      ctx.fillStyle = 'rgba(46,164,79,0.38)';
      ctx.fillRect(bx, by, bw, bh * 0.1);

      // nafta cargada
      const jit = g.locked ? 0 : (Math.random() - 0.5) * g.jitter;
      const clampedFill = Math.min(g.fill, 122);
      const lvl = clampedFill / 100;
      const fh = Math.min(bh * 1.22, bh * lvl) + jit;

      // color: green zone=yellow, over 100 but ok=orange, spill=red
      let barColor;
      if (g.fill > 112) barColor = '#e23b2e';
      else if (g.fill > 100) barColor = '#f5a623';
      else barColor = '#f3c14b';
      ctx.fillStyle = barColor;
      ctx.fillRect(bx, by + bh - Math.min(fh, bh), bw, Math.min(fh, bh));

      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);

      // linea del 100% (tope del bar)
      ctx.strokeStyle = '#2ea44f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx - 7, by);
      ctx.lineTo(bx + bw + 7, by);
      ctx.stroke();

      // linea del 110% (marcador de sobre-llenado aceptable = 10% sobre 100)
      const y110 = by - bh * 0.1; // above the bar
      if (y110 > 0) {
        ctx.strokeStyle = 'rgba(245,166,35,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(bx - 4, y110);
        ctx.lineTo(bx + bw + 4, y110);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
      }

      ctx.lineWidth = 1;

      // porcentaje
      ctx.fillStyle = '#fff';
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(g.fill)}%`, bx + bw / 2, by + bh + 26);

      if (g.locked) {
        ctx.font = '800 22px system-ui, sans-serif';
        ctx.fillStyle = g.spill ? '#e23b2e' : '#2ea44f';
        ctx.fillText(g.spill ? 'SE DERRAMÓ!' : `+${g.lastPts}`, w / 2, h * 0.9);
      } else {
        ctx.font = '700 14px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText('manten apretado... soltá cerca del 100%', w / 2, h * 0.9);
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(200,200,200,0.55)';
        ctx.fillText('(pasarte un poco también suma)', w / 2, h * 0.93);
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
