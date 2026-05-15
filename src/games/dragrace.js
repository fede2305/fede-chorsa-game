// Drag race: toca para cambiar de marcha cuando la aguja del tacometro
// este en la zona verde. Chorsa: la zona verde es chica y se mueve,
// la aguja va mas rapido.

import { makeGame, clamp, rand, drawRoad } from './base.js';
import { drawCarSide } from '../engine/sprites.js';

const GEARS = 6;
const TIME_CAP = 16;

export function createDragrace(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.gear = 0;
      g.needle = 0;
      g.needleDir = 1;
      g.needleSpeed = 0.85 + chorsaLevel * 0.22;
      g.greenW = Math.max(0.13, 0.32 - chorsaLevel * 0.038);
      g.greenVel = chorsa.drift * 0.55;
      placeGreen(g);
      g.speed = stage.h * 0.25;
      g.boost = stage.h * 0.5;
      g.dist = 0;
      g.roadOff = 0;
      g.timeLeft = TIME_CAP;
      g.flash = 0;
      g.hud.label = `Marcha ${g.gear + 1}/${GEARS}`;
    },

    step(dt, stage, t, g) {
      g.timeLeft -= dt;
      g.hud.time = g.timeLeft;
      if (g.timeLeft <= 0) {
        g.done = true;
        return;
      }

      // aguja
      g.needle += g.needleSpeed * g.needleDir * dt;
      if (g.needle > 1) {
        g.needle = 1;
        g.needleDir = -1;
      } else if (g.needle < 0) {
        g.needle = 0;
        g.needleDir = 1;
      }

      // la zona verde se desplaza con la chorsa
      if (g.greenVel) {
        g.greenPos += g.greenVel * dt;
        if (g.greenPos < 0.05 || g.greenPos > 0.95 - g.greenW) g.greenVel *= -1;
        g.greenPos = clamp(g.greenPos, 0.05, 0.95 - g.greenW);
      }

      g.dist += g.speed * dt;
      g.roadOff = (g.roadOff + g.speed * dt) % 52;
      g.score = Math.floor(g.dist / 6);
      g.flash = Math.max(0, g.flash - dt * 4);

      if (stage.pointer.justDown) {
        const inGreen =
          g.needle >= g.greenPos && g.needle <= g.greenPos + g.greenW;
        if (inGreen) {
          g.speed += g.boost;
          g.flash = 1;
          g.flashGood = true;
        } else {
          g.speed += g.boost * 0.18;
          g.flash = 1;
          g.flashGood = false;
        }
        g.gear++;
        g.hud.label = `Marcha ${Math.min(g.gear + 1, GEARS)}/${GEARS}`;
        placeGreen(g);
        if (g.gear >= GEARS) {
          g.done = true;
        }
      }
    },

    render(stage, ctx, t, g) {
      const w = stage.w;
      const h = stage.h;
      drawRoad(ctx, w, h, g.roadOff, 1);
      drawCarSide(ctx, w * 0.5, h * 0.72, w * 0.5, h * 0.24, '#e23b2e');

      // tacometro
      const cx = w / 2;
      const cy = h * 0.36;
      const r = w * 0.34;
      const A0 = Math.PI * 0.85;
      const A1 = Math.PI * 0.15;
      const ang = (v) => A0 + (A1 - A0) * v;

      ctx.lineWidth = 16;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, A0, A1, true);
      ctx.stroke();

      // zona verde
      ctx.strokeStyle = '#2ea44f';
      ctx.beginPath();
      ctx.arc(cx, cy, r, ang(g.greenPos), ang(g.greenPos + g.greenW), true);
      ctx.stroke();

      // aguja
      const na = ang(g.needle);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(na) * r, cy + Math.sin(na) * r);
      ctx.stroke();
      ctx.fillStyle = '#e23b2e';
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;

      if (g.flash > 0) {
        ctx.fillStyle = g.flashGood
          ? `rgba(46,164,79,${g.flash * 0.3})`
          : `rgba(226,59,46,${g.flash * 0.3})`;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('toca en verde para cambiar', w / 2, h * 0.92);
      ctx.textAlign = 'left';
    },
  });
}

function placeGreen(g) {
  g.greenPos = rand(0.08, 0.92 - g.greenW);
}
