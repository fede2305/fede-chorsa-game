// Drag race: toca para cambiar de marcha cuando la aguja del tacometro
// este en la zona verde. Semaforo de largada. Ruedas giratorias.
// Palanca H visible con marcha actual. Chorsa: zona verde mas chica y rapida.

import { makeGame, clamp, rand, drawRoad } from './base.js';
import { drawCarSide } from '../engine/sprites.js';
import { sfx } from '../engine/audio.js';

const GEARS = 6;
const TIME_CAP = 18;

// H-pattern positions for 6 gears (row, col)
const GEAR_POS = [null,
  { r: 0, c: 0 }, { r: 0, c: 1 },
  { r: 1, c: 0 }, { r: 1, c: 1 },
  { r: 2, c: 0 }, { r: 2, c: 1 },
];

export function createDragrace(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.gear = 0;
      g.needle = 0.05;
      g.needleDir = 1;
      g.needleSpeed = 0.75 + chorsaLevel * 0.20;
      g.greenW = Math.max(0.10, 0.28 - chorsaLevel * 0.035);
      g.greenPos = 0.62;
      g.speed = stage.h * 0.22;
      g.boost = stage.h * 0.5;
      g.dist = 0;
      g.roadOff = 0;
      g.timeLeft = TIME_CAP;
      g.flash = 0;
      g.flashGood = false;
      g.smoke = [];
      g.wheelAngle = 0;
      g.graceScore = 10;
      // Semáforo countdown (runs from step after _started)
      g.semLights = 0;    // how many red lights are lit (0–3)
      g.semT = 0;
      g.semDone = false;  // game actually active after semaphore
      g.hud.hint = 'Esperá el VERDE del semáforo, después tocá para cambiar de marcha';
      g.hud.label = 'Marcha 1/6';
      // Speed lines (background streaks)
      g.streaks = [];
      for (let i = 0; i < 14; i++) {
        g.streaks.push({ x: rand(0, stage.w), y: rand(0, stage.h), len: rand(15, 55) });
      }
    },

    step(dt, stage, t, g) {
      // ── SEMÁFORO COUNTDOWN ───────────────────────────────────────────────
      if (!g.semDone) {
        g.semT += dt;
        if (g.semLights < 3 && g.semT >= (g.semLights + 1) * 0.65) {
          g.semLights++;
          sfx('tick');
        }
        if (g.semLights >= 3 && g.semT >= 3 * 0.65 + 0.55) {
          g.semDone = true;
          sfx('go');
        }
        // No game logic yet — just countdown
        return;
      }

      g.timeLeft -= dt;
      g.hud.time = g.timeLeft;
      if (g.timeLeft <= 0) { g.done = true; return; }

      const gearSpeed = g.needleSpeed * (1 + g.gear * 0.12);
      g.needle += gearSpeed * g.needleDir * dt;
      if (g.needle > 1)      { g.needle = 1;  g.needleDir = -1; }
      else if (g.needle < 0) { g.needle = 0;  g.needleDir =  1; }

      g.dist += g.speed * dt;
      g.roadOff = (g.roadOff + g.speed * dt) % 52;
      g.score = Math.floor(g.dist / 6);
      g.flash = Math.max(0, g.flash - dt * 3);
      g.wheelAngle += (g.speed / 300) * dt * 12;

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
          sfx('shift');
          for (let i = 0; i < 10; i++) {
            const carY = stage.h * 0.72;
            const carX = stage.w * 0.5;
            g.smoke.push({ x: carX + rand(-30, 30), y: carY + rand(10, 20), r: rand(5, 14), a: rand(0.5, 0.85), vx: rand(-15, 15) });
          }
        } else if (inYellow) {
          g.speed += g.boost * 0.55;
          g.flash = 0.6;
          g.flashGood = false;
          sfx('shift');
        } else {
          g.speed += g.boost * 0.18;
          g.flash = 0.5;
          g.flashGood = false;
          sfx('shift_bad');
        }
        g.gear++;
        g.hud.label = `Marcha ${Math.min(g.gear + 1, GEARS)}/${GEARS}`;
        if (g.gear >= GEARS) { g.done = true; }
      }
    },

    render(stage, ctx, t, g) {
      const w = stage.w;
      const h = stage.h;
      const speedFrac = Math.min(1, g.speed / (stage.h * 2.5));

      drawRoad(ctx, w, h, g.roadOff, 1);

      // ── SPEED STREAKS ─────────────────────────────────────────────────────
      if (speedFrac > 0.15) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${speedFrac * 0.14})`;
        ctx.lineWidth = 1.5;
        for (const sk of g.streaks) {
          const yy = ((sk.y + g.roadOff * 3) % h);
          ctx.beginPath();
          ctx.moveTo(sk.x, yy);
          ctx.lineTo(sk.x, yy + sk.len * speedFrac);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ── SMOKE ─────────────────────────────────────────────────────────────
      for (const s of g.smoke) {
        ctx.save();
        ctx.globalAlpha = s.a * 0.7;
        ctx.fillStyle = '#c8c8d8';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── CAR ───────────────────────────────────────────────────────────────
      const carY = h * 0.72;
      const carX = w * 0.5;
      const carW = w * 0.5;
      const carH = h * 0.24;
      drawCarSide(ctx, carX, carY, carW, carH, '#e23b2e');

      // Spinning wheels overlay
      const rw = carH * 0.23;
      const wheelY = carY + carH * 0.30;
      const frontWX = carX + carW * 0.30;
      const rearWX  = carX - carW * 0.30;
      const blurSpokes = speedFrac > 0.4;
      ctx.save();
      ctx.strokeStyle = blurSpokes ? 'rgba(140,140,150,0.55)' : 'rgba(140,140,150,0.8)';
      ctx.lineWidth = rw * 0.13;
      for (const wx of [frontWX, rearWX]) {
        const spokeCount = blurSpokes ? 10 : 5;
        for (let i = 0; i < spokeCount; i++) {
          const a = g.wheelAngle + (i / spokeCount) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(wx, wheelY);
          ctx.lineTo(wx + Math.cos(a) * rw * 0.58, wheelY + Math.sin(a) * rw * 0.58);
          ctx.stroke();
        }
      }
      ctx.restore();

      // ── TACHOMETER ────────────────────────────────────────────────────────
      const cx = w / 2;
      const cy = h * 0.34;
      const R  = w * 0.44;
      const A0 = Math.PI * 0.78;
      const A1 = Math.PI * 0.22;
      const ang = (v) => A0 + (A1 - A0) * v;

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

      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.arc(cx, cy, R, A0, A1, true);
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '700 16px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 8; i++) {
        const v = i / 8;
        const a = ang(v);
        const isMajor = i % 2 === 0;
        const r1 = R - (isMajor ? 32 : 20);
        const r2 = R - 4;
        ctx.strokeStyle = `rgba(255,255,255,${isMajor ? 0.85 : 0.4})`;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();
        if (isMajor) {
          const lr = R - 50;
          ctx.fillText(`${i}`, cx + Math.cos(a) * lr, cy + Math.sin(a) * lr);
        }
      }

      // needle
      const na = ang(g.needle);
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy + 2);
      ctx.lineTo(cx + Math.cos(na) * (R - 10) + 2, cy + Math.sin(na) * (R - 10) + 2);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(na) * (R - 10), cy + Math.sin(na) * (R - 10));
      ctx.stroke();
      ctx.fillStyle = '#e23b2e';
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const inGreen = g.needle >= g.greenPos && g.needle <= g.greenPos + g.greenW;
      if (inGreen && g.semDone) {
        const pulse = 0.75 + 0.25 * Math.sin(t * 14);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.font = '900 30px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#2ea44f';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 8;
        ctx.fillText('¡CAMBIÁ!', cx, cy + R + 38);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // ── H-PATTERN GEAR LEVER ──────────────────────────────────────────────
      drawHPattern(ctx, w - 88, h - 130, g.gear);

      // flash overlay
      if (g.flash > 0) {
        ctx.fillStyle = g.flashGood
          ? `rgba(46,164,79,${g.flash * 0.28})`
          : `rgba(226,59,46,${g.flash * 0.22})`;
        ctx.fillRect(0, 0, w, h);
      }

      // ── SEMÁFORO ──────────────────────────────────────────────────────────
      if (!g.semDone) {
        drawSemaforo(ctx, w, h, g.semLights, t);
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    },
  });
}

function drawHPattern(ctx, ox, oy, currentGear) {
  const spacing = 30;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2.5;
  // vertical bar
  ctx.beginPath();
  ctx.moveTo(ox + spacing / 2, oy);
  ctx.lineTo(ox + spacing / 2, oy + spacing * 2);
  ctx.stroke();
  // horizontal bars
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + r * spacing);
    ctx.lineTo(ox + spacing, oy + r * spacing);
    ctx.stroke();
  }
  // gear dots
  for (let gi = 1; gi <= 6; gi++) {
    const gp = GEAR_POS[gi];
    const gx = ox + gp.c * spacing;
    const gy = oy + gp.r * spacing;
    const active = gi === currentGear;
    ctx.fillStyle = active ? '#e23b2e' : 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(gx, gy, active ? 11 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = active ? '#fff' : 'rgba(255,255,255,0.5)';
    ctx.font = `${active ? '900' : '700'} 14px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gi, gx, gy);
  }
  ctx.restore();
}

function drawSemaforo(ctx, w, h, lights, t) {
  // Dark overlay
  ctx.fillStyle = 'rgba(8,8,16,0.82)';
  ctx.fillRect(0, 0, w, h);

  // Panel
  const pw = 220;
  const ph = 86;
  const px = (w - pw) / 2;
  const py = h * 0.36;
  ctx.fillStyle = '#1a1a24';
  ctx.beginPath();
  roundRectPath(ctx, px, py, pw, ph, 16);
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Lights
  const lx = [px + 30, px + 84, px + 138, px + 192];
  for (let i = 0; i < 3; i++) {
    const lit = i < lights;
    ctx.fillStyle = lit ? '#e23b2e' : 'rgba(100,20,20,0.6)';
    if (lit) {
      ctx.shadowColor = '#e23b2e';
      ctx.shadowBlur = 24;
    }
    ctx.beginPath();
    ctx.arc(lx[i], py + ph / 2, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // "LISTO" green light when done
  if (lights >= 3) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 12);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#2ea44f';
    ctx.shadowColor = '#2ea44f';
    ctx.shadowBlur = 28;
    ctx.beginPath();
    ctx.arc(lx[3], py + ph / 2, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Label
  ctx.fillStyle = lights >= 3 ? '#2ea44f' : '#f3c14b';
  ctx.font = '900 24px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 8;
  ctx.fillText(lights >= 3 ? '¡TOCÁ AHORA!' : 'PREPARATE...', w / 2, py + ph + 32);
  ctx.shadowBlur = 0;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
