// Acelera: toca lo mas rapido posible para acelerar el Corsa.
// Chorsa: mas friccion, la barra se va sola para atras.
// Visual: auto mas ancho/realista, humo de escape, lineas de velocidad.

import { makeGame, clamp, rand, drawRoad } from './base.js';
import { drawCarSide } from '../engine/sprites.js';
import { sfx, startEngine, updateEngine, shiftEngine, stopEngine } from '../engine/audio.js';

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
      g.exhaust = [];
      g.speedLines = [];
      g.engine = null;
      g.graceScore = 15;
      // Pre-seed speed-line positions (deterministic, no flicker)
      for (let i = 0; i < 18; i++) {
        g.speedLines.push({ x: rand(0, stage.w), y: rand(0, stage.h), len: rand(20, 90), phase: rand(0, Math.PI * 2) });
      }
    },

    step(dt, stage, t, g) {
      g.timeLeft -= dt;
      g.hud.time = g.timeLeft;
      if (g.timeLeft <= 0) {
        g.done = true;
        return;
      }
      if (stage.pointer.justDown) {
        if (!g.engine) g.engine = startEngine();
        shiftEngine(g.engine, g.speed / g.maxSpeed);
        g.speed += g.tapKick;
        g.flash = 1;
        sfx('tap');
        // spawn exhaust puff
        const carCX = stage.w * 0.5;
        const carBackX = carCX - stage.w * 0.35;
        const carCY = stage.h * 0.7;
        for (let i = 0; i < 3; i++) {
          g.exhaust.push({
            x: carBackX + rand(-6, 6),
            y: carCY + stage.h * 0.07 + rand(-4, 4),
            vx: rand(-18, -6),
            vy: rand(-15, 5),
            r: rand(8, 18),
            a: rand(0.5, 0.75),
          });
        }
      }

      g.flash = Math.max(0, g.flash - dt * 5);
      g.speed = clamp(g.speed - g.friction * dt, 0, g.maxSpeed);
      updateEngine(g.engine, g.speed / g.maxSpeed);
      g.dist += g.speed * dt;
      g.roadOff = (g.roadOff + g.speed * dt) % 52;
      g.score = Math.floor(g.dist / 12);

      // update exhaust particles
      for (const e of g.exhaust) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.r += dt * 22;
        e.a -= dt * 1.8;
      }
      g.exhaust = g.exhaust.filter((e) => e.a > 0);
    },

    cleanup(stage, g) {
      stopEngine(g.engine);
      g.engine = null;
    },

    render(stage, ctx, t, g) {
      const w = stage.w;
      const h = stage.h;
      drawRoad(ctx, w, h, g.roadOff, 1);

      const speedFrac = g.speed / g.maxSpeed;

      // ── SPEED LINES ───────────────────────────────────────────────────────
      if (speedFrac > 0.2) {
        ctx.save();
        const alpha = speedFrac * 0.18;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1.5;
        for (const sl of g.speedLines) {
          const len = sl.len * speedFrac;
          // scroll the lines downward with road
          const yy = ((sl.y + g.roadOff * 2.5) % h);
          ctx.beginPath();
          ctx.moveTo(sl.x, yy);
          ctx.lineTo(sl.x, yy + len);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ── EXHAUST SMOKE ─────────────────────────────────────────────────────
      for (const e of g.exhaust) {
        ctx.save();
        ctx.globalAlpha = e.a * 0.6;
        ctx.fillStyle = '#b0b0c0';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── CAR — wider, proper side proportions ──────────────────────────────
      const bounce = Math.sin(t * 22) * speedFrac * 7;
      // Car: w*0.7 wide × h*0.16 tall → ~2.7:1 ratio (realistic side view)
      drawCarSide(ctx, w * 0.5, h * 0.69 + bounce, w * 0.72, h * 0.16, '#e23b2e');

      // ── RPM BAR ───────────────────────────────────────────────────────────
      const barW = 36;
      const barH = h * 0.5;
      const barX = w - barW - 14;
      const barY = h * 0.25;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(barX, barY, barW, barH);
      const fill = speedFrac * barH;
      const grd = ctx.createLinearGradient(0, barY + barH, 0, barY);
      grd.addColorStop(0, '#2ea44f');
      grd.addColorStop(0.6, '#f3c14b');
      grd.addColorStop(1, '#e23b2e');
      ctx.fillStyle = grd;
      ctx.fillRect(barX, barY + barH - fill, barW, fill);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barW, barH);

      // needle pulse on the bar when tapping
      if (g.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${g.flash * 0.18})`;
        ctx.fillRect(0, 0, w, h);
      }

      // ── SPEED READOUT ─────────────────────────────────────────────────────
      const kmh = Math.round(speedFrac * 220);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = '900 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText(`${kmh} km/h`, w * 0.42, h * 0.86);
      ctx.shadowBlur = 0;

      ctx.font = '900 18px system-ui, sans-serif';
      ctx.fillStyle = g.flash > 0.5 ? '#f3c14b' : 'rgba(255,255,255,0.7)';
      ctx.fillText('TOCÁ TOCÁ TOCÁ', w * 0.42, h * 0.92);
      ctx.textAlign = 'left';
    },
  });
}
