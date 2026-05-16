// Drag race: toca para cambiar de marcha cuando la aguja del tacometro
// este en la zona verde. Tacometro fijo con zonas coloreadas.
// Chorsa: la zona verde es mas chica y la aguja va mas rapido.

import { makeGame, clamp, rand, drawRoad } from './base.js';
import { drawCarSide } from '../engine/sprites.js';

const GEARS = 6;
const TIME_CAP = 18;

export function createDragrace(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.gear = 0;
      g.needle = 0.05;
      g.needleDir = 1;
      g.needleSpeed = 0.75 + chorsaLevel * 0.20;
      // green zone: narrower at higher chorsa
      g.greenW = Math.max(0.10, 0.28 - chorsaLevel * 0.035);
      g.greenPos = 0.62; // fixed position in optimal shift range
      g.speed = stage.h * 0.22;
      g.boost = stage.h * 0.5;
      g.dist = 0;
      g.roadOff = 0;
      g.timeLeft = TIME_CAP;
      g.flash = 0;
      g.flashGood = false;
      g.smoke = [];
      g.wheelSpin = 0;
      g.hud.hint = 'Tocá para cambiar de marcha cuando la aguja esté en la zona VERDE';
      g.hud.label = `Marcha ${g.gear + 1}/${GEARS}`;
    },

    step(dt, stage, t, g) {
      g.timeLeft -= dt;
      g.hud.time = g.timeLeft;
      if (g.timeLeft <= 0) { g.done = true; return; }

      // needle oscillates, speeds up with each gear
      const gearSpeed = g.needleSpeed * (1 + g.gear * 0.12);
      g.needle += gearSpeed * g.needleDir * dt;
      if (g.needle > 1)      { g.needle = 1; g.needleDir = -1; }
      else if (g.needle < 0) { g.needle = 0; g.needleDir =  1; }

      g.dist += g.speed * dt;
      g.roadOff = (g.roadOff + g.speed * dt) % 52;
      g.score = Math.floor(g.dist / 6);
      g.flash = Math.max(0, g.flash - dt * 3);
      g.wheelSpin = Math.max(0, g.wheelSpin - dt * 2.5);

      // animate smoke particles
      for (const s of g.smoke) {
        s.x += (s.vx || 0) * dt;
        s.y -= 22 * dt;
        s.a -= 1.4 * dt;
        s.r += 6 * dt;
      }
      g.smoke = g.smoke.filter((s) => s.a > 0);

      if (stage.pointer.justDown) {
        const inGreen = g.needle >= g.greenPos && g.needle <= g.greenPos + g.greenW;
        const inYellow = !inGreen && g.needle >= g.greenPos + g.greenW && g.needle <= g.greenPos + g.greenW + 0.12;

        if (inGreen) {
          g.speed += g.boost;
          g.flash = 1;
          g.flashGood = true;
          g.wheelSpin = 1;
          // spawn smoke
          const carY = stage.h * 0.72;
          const carX = stage.w * 0.5;
          for (let i = 0; i < 10; i++) {
            g.smoke.push({
              x: carX + rand(-30, 30),
              y: carY + rand(10, 20),
              r: rand(5, 14),
              a: rand(0.5, 0.85),
              vx: rand(-15, 15),
            });
          }
        } else if (inYellow) {
          g.speed += g.boost * 0.55;
          g.flash = 0.6;
          g.flashGood = false;
        } else {
          g.speed += g.boost * 0.18;
          g.flash = 0.5;
          g.flashGood = false;
        }
        g.gear++;
        g.hud.label = `Marcha ${Math.min(g.gear + 1, GEARS)}/${GEARS}`;
        if (g.gear >= GEARS) { g.done = true; }
      }
    },

    render(stage, ctx, t, g) {
      const w = stage.w;
      const h = stage.h;
      drawRoad(ctx, w, h, g.roadOff, 1);

      // ── SMOKE BEHIND CAR ─────────────────────────────────────────────────
      for (const s of g.smoke) {
        ctx.save();
        ctx.globalAlpha = s.a * 0.7;
        ctx.fillStyle = '#c8c8d8';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── CAR ──────────────────────────────────────────────────────────────
      const carY = h * 0.72;
      const carX = w * 0.5;
      // wheel spin blur when burning rubber
      if (g.wheelSpin > 0) {
        ctx.save();
        ctx.globalAlpha = g.wheelSpin * 0.5;
        drawCarSide(ctx, carX + rand(-2, 2) * g.wheelSpin, carY, w * 0.5, h * 0.24, '#e23b2e');
        ctx.restore();
      }
      drawCarSide(ctx, carX, carY, w * 0.5, h * 0.24, '#e23b2e');

      // ── TACHOMETER ───────────────────────────────────────────────────────
      const cx = w / 2;
      const cy = h * 0.33;
      const R  = w * 0.36;
      // arc spans ~240° from bottom-left to bottom-right (7 o'clock → 5 o'clock)
      const A0 = Math.PI * 0.78;   // start (0 RPM)
      const A1 = Math.PI * 0.22;   // end   (max RPM) — going counter-clockwise
      const ang = (v) => A0 + (A1 - A0) * v;

      // ── draw colored arc zones ────────────────────────────────────────────
      const zones = [
        { from: 0.00, to: 0.55, color: 'rgba(180,180,200,0.25)' },
        { from: 0.55, to: g.greenPos, color: 'rgba(255,255,255,0.35)' },
        { from: g.greenPos, to: g.greenPos + g.greenW, color: '#2ea44f' },
        { from: g.greenPos + g.greenW, to: g.greenPos + g.greenW + 0.12, color: '#f5b301' },
        { from: g.greenPos + g.greenW + 0.12, to: 1.0, color: '#e23b2e' },
      ];
      ctx.lineWidth = 20;
      for (const z of zones) {
        ctx.strokeStyle = z.color;
        ctx.beginPath();
        ctx.arc(cx, cy, R, ang(z.from), ang(z.to), true);
        ctx.stroke();
      }

      // outer ring
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.arc(cx, cy, R, A0, A1, true);
      ctx.stroke();

      // tick marks + RPM labels
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '600 11px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 8; i++) {
        const v = i / 8;
        const a = ang(v);
        const isMajor = i % 2 === 0;
        const r1 = R - (isMajor ? 28 : 18);
        const r2 = R - 4;
        ctx.strokeStyle = `rgba(255,255,255,${isMajor ? 0.7 : 0.35})`;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();
        if (isMajor) {
          const lr = R - 42;
          ctx.fillText(`${i}`, cx + Math.cos(a) * lr, cy + Math.sin(a) * lr);
        }
      }

      // needle
      const na = ang(g.needle);
      ctx.save();
      // needle shadow
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy + 2);
      ctx.lineTo(cx + Math.cos(na) * (R - 10) + 2, cy + Math.sin(na) * (R - 10) + 2);
      ctx.stroke();
      // needle
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(na) * (R - 10), cy + Math.sin(na) * (R - 10));
      ctx.stroke();
      // center cap
      ctx.fillStyle = '#e23b2e';
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(cx - 3, cy - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // SHIFT! label when in green
      const inGreen = g.needle >= g.greenPos && g.needle <= g.greenPos + g.greenW;
      if (inGreen) {
        const pulse = 0.75 + 0.25 * Math.sin(t * 14);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.font = '900 22px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#2ea44f';
        ctx.fillText('¡CAMBIA!', cx, cy + R + 28);
        ctx.restore();
      }

      // flash overlay
      if (g.flash > 0) {
        ctx.fillStyle = g.flashGood
          ? `rgba(46,164,79,${g.flash * 0.28})`
          : `rgba(226,59,46,${g.flash * 0.22})`;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.textAlign = 'left';
    },
  });
}
