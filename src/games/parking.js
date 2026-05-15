// Estaciona el Corsa: el auto avanza solo, manten apretado izquierda o
// derecha para doblar. Meti el auto dentro del recuadro antes de que se
// acabe el tiempo. Chorsa: el auto se desvia solo, los controles tiemblan,
// menos tiempo.

import { makeGame, clamp, rand } from './base.js';
import { drawCar, roundRect } from '../engine/sprites.js';
import { driftOffset } from '../engine/effects.js';

export function createParking(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.carW = stage.w * 0.14;
      g.carH = g.carW * 1.7;
      g.x = stage.w * 0.5;
      g.y = stage.h * 0.82;
      g.angle = 0; // 0 = mirando hacia arriba
      g.speed = stage.h * 0.2;
      g.steerRate = 2.3;
      g.timeLeft = Math.max(7, 16 - chorsaLevel * 1.6);

      // recuadro objetivo, a un costado de la zona superior
      const side = Math.random() < 0.5 ? 0.22 : 0.78;
      g.box = {
        x: stage.w * side,
        y: stage.h * rand(0.2, 0.34),
        w: g.carW * 1.7,
        h: g.carH * 1.45,
      };
      g.hud.label = 'Meti el auto en el recuadro';
    },

    step(dt, stage, t, g) {
      const chorsa = g.chorsa;
      g.timeLeft -= dt;
      g.hud.time = g.timeLeft;

      // direccion
      let steer = 0;
      if (stage.pointer.down) {
        steer = stage.pointer.x < stage.w / 2 ? -1 : 1;
      }
      // la chorsa mete ruido en la direccion
      g.angle += steer * g.steerRate * dt;
      g.angle += driftOffset(chorsa, t, 11) * dt * 2.2;

      // avanzar
      g.x += Math.sin(g.angle) * g.speed * dt;
      g.y -= Math.cos(g.angle) * g.speed * dt;

      // rebote contra los bordes
      if (g.x < g.carW / 2 || g.x > stage.w - g.carW / 2) {
        g.angle = -g.angle;
        g.x = clamp(g.x, g.carW / 2, stage.w - g.carW / 2);
      }
      if (g.y < g.carH / 2 || g.y > stage.h - g.carH / 2) {
        g.angle = Math.PI - g.angle;
        g.y = clamp(g.y, g.carH / 2, stage.h - g.carH / 2);
      }

      // dentro del recuadro?
      const b = g.box;
      const inside =
        g.x > b.x - b.w / 2 + g.carW * 0.3 &&
        g.x < b.x + b.w / 2 - g.carW * 0.3 &&
        g.y > b.y - b.h / 2 + g.carH * 0.25 &&
        g.y < b.y + b.h / 2 - g.carH * 0.25;
      if (inside) {
        g.score = Math.round(g.timeLeft * 12) + 60;
        g.parked = true;
        g.done = true;
        return;
      }

      if (g.timeLeft <= 0) {
        // no llego: puntaje por cercania
        const d = Math.hypot(g.x - b.x, g.y - b.y);
        g.score = Math.max(0, Math.round(70 - (d / stage.w) * 110));
        g.done = true;
      }
    },

    render(stage, ctx, t, g) {
      ctx.fillStyle = '#1a1a24';
      ctx.fillRect(0, 0, stage.w, stage.h);

      // recuadro objetivo
      const b = g.box;
      ctx.save();
      ctx.strokeStyle = '#f3c14b';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 10]);
      roundRect(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(243,193,75,0.08)';
      ctx.fill();
      ctx.restore();

      // autos estacionados a los lados del recuadro (decorado/guia)
      ctx.globalAlpha = 0.5;
      drawCar(ctx, b.x - b.w * 0.92, b.y, g.carW, g.carH, '#5a5a68');
      drawCar(ctx, b.x + b.w * 0.92, b.y, g.carW, g.carH, '#5a5a68');
      ctx.globalAlpha = 1;

      // el Corsa
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      drawCar(ctx, 0, 0, g.carW, g.carH, '#e23b2e');
      ctx.restore();
    },
  });
}
