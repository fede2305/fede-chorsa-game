// Acelera: toca lo mas rapido posible para acelerar el Corsa.
// Chorsa: mas friccion, la barra se va sola para atras.

import { makeGame, clamp, drawRoad } from './base.js';
import { drawCarSide } from '../engine/sprites.js';

const DURATION = 7;

export function createAcelera(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.speed = 0;
      g.maxSpeed = stage.h * 1.3;
      g.tapKick = stage.h * 0.16;
      g.friction = stage.h * (0.3 + (chorsa.speedMult - 1) * 0.9 + chorsa.drift * 0.6);
      g.dist = 0;
      g.roadOff = 0;
      g.timeLeft = DURATION;
      g.hud.hint = 'Tocá la pantalla lo más rápido que puedas — cada toque acelera el Corsa';
      g.hud.label = 'Toca rapido!';
      g.flash = 0;
    },

    step(dt, stage, t, g) {
      g.timeLeft -= dt;
      g.hud.time = g.timeLeft;
      if (g.timeLeft <= 0) {
        g.done = true;
        return;
      }
      if (stage.pointer.justDown) {
        g.speed += g.tapKick;
        g.flash = 1;
      }
      g.flash = Math.max(0, g.flash - dt * 5);
      g.speed = clamp(g.speed - g.friction * dt, 0, g.maxSpeed);
      g.dist += g.speed * dt;
      g.roadOff = (g.roadOff + g.speed * dt) % 52;
      g.score = Math.floor(g.dist / 12);
    },

    render(stage, ctx, t, g) {
      const w = stage.w;
      const h = stage.h;
      drawRoad(ctx, w, h, g.roadOff, 1);

      // Corsa de costado, rebota con la velocidad
      const bounce = Math.sin(t * 22) * (g.speed / g.maxSpeed) * 6;
      drawCarSide(ctx, w * 0.5, h * 0.62 + bounce, w * 0.5, h * 0.26, '#e23b2e');

      // barra de RPM a la derecha
      const barH = h * 0.5;
      const barX = w - 46;
      const barY = h * 0.25;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, 26, barH);
      const fill = (g.speed / g.maxSpeed) * barH;
      const grd = ctx.createLinearGradient(0, barY + barH, 0, barY);
      grd.addColorStop(0, '#2ea44f');
      grd.addColorStop(0.6, '#f3c14b');
      grd.addColorStop(1, '#e23b2e');
      ctx.fillStyle = grd;
      ctx.fillRect(barX, barY + barH - fill, 26, fill);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.strokeRect(barX, barY, 26, barH);

      // pulso al tocar
      if (g.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${g.flash * 0.15})`;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TOCA TOCA TOCA', w / 2, h * 0.86);
      ctx.textAlign = 'left';
    },
  });
}
