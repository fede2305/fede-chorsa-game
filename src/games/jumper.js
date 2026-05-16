// Esquiva el bache INFINITO: el Corsa corre solo, toca para saltar.
// No termina por tiempo: se acelera y los obstaculos vienen mas seguido
// hasta que pegas contra uno.

import { makeGame, rand, clamp, drawRoad, rampFactor } from './base.js';
import { drawCarSide, drawCone, drawPothole } from '../engine/sprites.js';

export function createJumper(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.carX = stage.w * 0.28;
      g.carW = stage.w * 0.34;
      g.carH = g.carW * 0.52;
      g.groundY = stage.h * 0.74;
      g.y = g.groundY;
      g.vy = 0;
      g.gravity = stage.h * 3.6;
      g.jump = stage.h * 1.5;
      g.baseSpeed = stage.h * 0.6 * chorsa.speedMult;
      g.obst = [];
      g.spawnT = -1.0;
      g.dist = 0;
      g.roadOff = 0;
      g.graceScore = 20;
      g.hud.hint = 'Tocá para saltar los baches y los conos — se acelera solo';
      g.hud.label = 'Toca para saltar';
    },

    step(dt, stage, t, g) {
      const ramp = rampFactor(g.playT, 0.14, 3.5);
      const speed = g.baseSpeed * ramp;
      const gap = clamp(1.25 / ramp, 0.45, 1.25);
      const jitter = g.chorsa.drift * 0.8;

      const onGround = g.y >= g.groundY - 0.5;
      if (stage.pointer.justDown && onGround) {
        g.vy = -g.jump;
      }
      g.vy += g.gravity * dt;
      g.y += g.vy * dt;
      if (g.y > g.groundY) {
        g.y = g.groundY;
        g.vy = 0;
      }

      g.roadOff = (g.roadOff + speed * dt) % 64;
      g.dist += speed * dt;
      g.score = Math.floor(g.dist / 9);

      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        g.spawnT = gap + rand(-jitter, jitter * 1.3);
        g.obst.push({ x: stage.w + 50, big: Math.random() < 0.42 });
      }

      for (const o of g.obst) {
        o.x -= speed * dt;
        const s = o.big ? g.carH * 0.95 : g.carH * 0.7;
        if (
          Math.abs(o.x - g.carX) < g.carW * 0.4 + s * 0.45 &&
          g.y > g.groundY - s
        ) {
          g.done = true;
          return;
        }
      }
      g.obst = g.obst.filter((o) => o.x > -70);
    },

    render(stage, ctx, t, g) {
      drawRoad(ctx, stage.w, stage.h, g.roadOff, 1);
      ctx.fillStyle = '#101015';
      ctx.fillRect(0, g.groundY + g.carH * 0.5, stage.w, stage.h);

      for (const o of g.obst) {
        const s = o.big ? g.carH * 0.95 : g.carH * 0.7;
        if (o.big) {
          drawPothole(ctx, o.x, g.groundY + g.carH * 0.42, s * 0.8, s * 0.34);
        } else {
          drawCone(ctx, o.x, g.groundY + g.carH * 0.42 - s * 0.55, s * 0.6);
        }
      }
      drawCarSide(ctx, g.carX, g.y, g.carW, g.carH, '#e23b2e');
    },
  });
}
