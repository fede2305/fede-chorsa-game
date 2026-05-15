// Encontra el Corsa rojo: tocalo entre los demas autos lo antes posible.
// Chorsa: mas autos, los autos se mueven, los colores se parecen mas al rojo.

import { makeGame, clamp, rand } from './base.js';
import { drawCar } from '../engine/sprites.js';

const ROUNDS = 6;
const ROUND_TIME = 5;
const TARGET = '#e23b2e';
const SAFE = ['#3b7de2', '#2ea44f', '#d8b62e', '#8a8f9a', '#b94fd8', '#e0a32e'];
const NEAR_RED = ['#c0392b', '#a83a2f', '#d35400', '#bf4030', '#b8412e'];

export function createFindCorsa(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.round = 0;
      g.hud.label = '';
      startRound(stage, chorsa, g);
    },

    step(dt, stage, t, g) {
      const chorsa = g.chorsa;
      g.roundTime -= dt;
      g.hud.time = g.roundTime;

      // mover autos (rebotan en el area de juego)
      for (const c of g.cars) {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.x < g.area.x || c.x > g.area.x + g.area.w) c.vx *= -1;
        if (c.y < g.area.y || c.y > g.area.y + g.area.h) c.vy *= -1;
        c.x = clamp(c.x, g.area.x, g.area.x + g.area.w);
        c.y = clamp(c.y, g.area.y, g.area.y + g.area.h);
      }

      if (g.roundTime <= 0) {
        nextRound(stage, chorsa, g);
        return;
      }

      if (stage.pointer.justDown) {
        const px = stage.pointer.x;
        const py = stage.pointer.y;
        let hitTarget = false;
        let hitAny = false;
        for (const c of g.cars) {
          if (
            Math.abs(px - c.x) < g.cw * 0.6 &&
            Math.abs(py - c.y) < g.ch * 0.6
          ) {
            hitAny = true;
            if (c.isTarget) hitTarget = true;
          }
        }
        if (hitTarget) {
          g.score += Math.round(40 + g.roundTime * 30);
          nextRound(stage, chorsa, g);
        } else if (hitAny) {
          g.roundTime = Math.max(0.2, g.roundTime - 1.3); // penalidad
          g.wrongFlash = 1;
        }
      }
      g.wrongFlash = Math.max(0, (g.wrongFlash || 0) - dt * 4);
    },

    render(stage, ctx, t, g) {
      ctx.fillStyle = '#101018';
      ctx.fillRect(0, 0, stage.w, stage.h);
      for (const c of g.cars) {
        drawCar(ctx, c.x, c.y, g.cw, g.ch, c.color);
      }
      if (g.wrongFlash > 0) {
        ctx.fillStyle = `rgba(226,59,46,${g.wrongFlash * 0.25})`;
        ctx.fillRect(0, 0, stage.w, stage.h);
      }
    },
  });
}

function startRound(stage, chorsa, g) {
  g.round++;
  g.hud.label = `Ronda ${g.round}/${ROUNDS}`;
  g.roundTime = ROUND_TIME;
  g.wrongFlash = 0;

  const n = Math.min(30, 5 + g.round + Math.round(chorsa.colorWarp * 14));
  g.cw = stage.w * (0.17 - Math.min(0.08, n * 0.004));
  g.ch = g.cw * 1.7;
  g.area = {
    x: g.cw,
    y: stage.h * 0.12 + g.ch,
    w: stage.w - g.cw * 2,
    h: stage.h * 0.82 - g.ch * 2,
  };

  const moveSpeed = stage.h * 0.18 * chorsa.drift;
  g.cars = [];
  const targetIdx = (Math.random() * n) | 0;
  for (let i = 0; i < n; i++) {
    const isTarget = i === targetIdx;
    let color = TARGET;
    if (!isTarget) {
      // a mas chorsa, mas autos rojizos parecidos al objetivo
      const pool = Math.random() < chorsa.colorWarp ? NEAR_RED : SAFE;
      color = pool[(Math.random() * pool.length) | 0];
    }
    const ang = rand(0, Math.PI * 2);
    g.cars.push({
      x: rand(g.area.x, g.area.x + g.area.w),
      y: rand(g.area.y, g.area.y + g.area.h),
      vx: Math.cos(ang) * moveSpeed,
      vy: Math.sin(ang) * moveSpeed,
      color,
      isTarget,
    });
  }
}

function nextRound(stage, chorsa, g) {
  if (g.round >= ROUNDS) {
    g.done = true;
    return;
  }
  startRound(stage, chorsa, g);
}
