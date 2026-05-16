// Estaciona el Corsa: gas + freno + volante manual.
// Tocá la pantalla para dar gas (X del dedo = dirección).
// Botón R/D abajo-izquierda para cambiar marcha.

import { makeGame, clamp } from './base.js';
import { drawCar, roundRect } from '../engine/sprites.js';
import { driftOffset } from '../engine/effects.js';
import { sfx } from '../engine/audio.js';

const RBX = 0.13; // R button x fraction
const RBY = 0.915; // R button y fraction
const RBR = 24;    // R button radius px

export function createParking(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.carW = stage.w * 0.14;
      g.carH = g.carW * 1.7;
      g.x = stage.w * 0.5;
      g.y = stage.h * 0.80;
      g.angle = 0;
      g.speed = 0;
      g.steer = 0;
      g.reverse = false;
      g.maxSpeed = stage.h * 0.21;
      g.maxRevSpeed = stage.h * 0.11;
      g.accel = stage.h * 0.30;
      g.drag = 4.5;
      g.maxSteerRate = 2.0 + chorsaLevel * 0.07;
      g.timeLeft = Math.max(10, 24 - chorsaLevel * 2.0);
      g.wheelAngle = 0;

      const side = Math.random() < 0.5 ? 0.22 : 0.78;
      g.box = {
        x: stage.w * side,
        y: stage.h * (0.18 + Math.random() * 0.16),
        w: g.carW * (2.0 - chorsaLevel * 0.06),
        h: g.carH * (1.65 - chorsaLevel * 0.05),
      };
      g.graceScore = 10;
      g.hud.hint = 'Tocá y mantené para arrancar. La posición X del dedo dirige el volante. Botón R = marcha atrás.';
      g.hud.label = 'D';
    },

    step(dt, stage, t, g) {
      const chorsa = g.chorsa;
      g.timeLeft -= dt;
      g.hud.time = g.timeLeft;
      g.hud.label = g.reverse ? 'R' : 'D';

      const rbx = stage.w * RBX;
      const rby = stage.h * RBY;

      // toggle reverse on tap of R/D button
      if (stage.pointer.justDown) {
        if (Math.hypot(stage.pointer.x - rbx, stage.pointer.y - rby) < RBR * 1.4) {
          g.reverse = !g.reverse;
        }
      }

      // gas = touching anywhere except the R button area
      const onBtn = stage.pointer.down &&
        Math.hypot(stage.pointer.x - rbx, stage.pointer.y - rby) < RBR * 1.5;
      const gas = stage.pointer.down && !onBtn;

      // steering from X position (0=full left, 1=full right, 0.5=straight)
      let targetSteer = 0;
      if (gas) {
        targetSteer = clamp((stage.pointer.x / stage.w - 0.5) * 2.4, -1, 1);
      }
      g.steer += (targetSteer - g.steer) * Math.min(1, dt * 7);

      // speed
      if (gas) {
        const dir = g.reverse ? -1 : 1;
        const maxSpd = g.reverse ? g.maxRevSpeed : g.maxSpeed;
        // if going wrong direction, brake first
        if (g.speed * dir < 0) {
          g.speed += dir * g.accel * 1.8 * dt;
        } else {
          g.speed += dir * g.accel * dt;
          g.speed = g.reverse
            ? Math.max(-g.maxRevSpeed, g.speed)
            : Math.min(g.maxSpeed, g.speed);
        }
      } else {
        g.speed *= Math.max(0, 1 - dt * g.drag);
        if (Math.abs(g.speed) < 2) g.speed = 0;
      }

      // steer (scales with speed)
      const speedFrac = Math.abs(g.speed) / g.maxSpeed;
      g.angle += g.steer * g.maxSteerRate * speedFrac * dt;
      g.angle += driftOffset(chorsa, t, 11) * dt * 1.6;

      g.wheelAngle += g.speed * dt * 0.05;

      // move
      g.x += Math.sin(g.angle) * g.speed * dt;
      g.y -= Math.cos(g.angle) * g.speed * dt;

      // bounce off edges
      if (g.x < g.carW / 2 || g.x > stage.w - g.carW / 2) {
        g.angle = -g.angle;
        g.speed *= -0.3;
        g.x = clamp(g.x, g.carW / 2, stage.w - g.carW / 2);
      }
      if (g.y < g.carH / 2 || g.y > stage.h - g.carH / 2) {
        g.angle = Math.PI - g.angle;
        g.speed *= -0.3;
        g.y = clamp(g.y, g.carH / 2, stage.h - g.carH / 2);
      }

      // parked check: inside box and nearly stopped
      const b = g.box;
      const inside =
        g.x > b.x - b.w / 2 + g.carW * 0.3 &&
        g.x < b.x + b.w / 2 - g.carW * 0.3 &&
        g.y > b.y - b.h / 2 + g.carH * 0.25 &&
        g.y < b.y + b.h / 2 - g.carH * 0.25;
      if (inside && Math.abs(g.speed) < g.maxSpeed * 0.22) {
        g.score = Math.round(g.timeLeft * 12) + 60;
        g.parked = true;
        g.done = true;
        sfx('park');
        return;
      }

      if (g.timeLeft <= 0) {
        const d = Math.hypot(g.x - b.x, g.y - b.y);
        g.score = Math.max(0, Math.round(70 - (d / stage.w) * 110));
        g.done = true;
      }
    },

    render(stage, ctx, t, g) {
      const w = stage.w, h = stage.h;

      // parking lot background
      ctx.fillStyle = '#1a1a24';
      ctx.fillRect(0, 0, w, h);

      // floor grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        ctx.beginPath(); ctx.moveTo(0, h * i * 0.1); ctx.lineTo(w, h * i * 0.1); ctx.stroke();
      }
      for (let i = 1; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(w * i * 0.25, 0); ctx.lineTo(w * i * 0.25, h); ctx.stroke();
      }

      // target box
      const b = g.box;
      ctx.save();
      ctx.strokeStyle = g.parked ? '#2de07a' : '#f3c14b';
      ctx.lineWidth = g.parked ? 5 : 4;
      ctx.setLineDash([12, 10]);
      roundRect(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = g.parked ? 'rgba(45,224,122,0.1)' : 'rgba(243,193,75,0.07)';
      ctx.fill();
      ctx.fillStyle = g.parked ? 'rgba(45,224,122,0.45)' : 'rgba(243,193,75,0.3)';
      ctx.font = '900 26px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('P', b.x, b.y);
      ctx.restore();

      // neighbour cars
      ctx.globalAlpha = 0.45;
      drawCar(ctx, b.x - b.w * 0.92, b.y, g.carW, g.carH, '#5a5a68');
      drawCar(ctx, b.x + b.w * 0.92, b.y, g.carW, g.carH, '#3a5a48');
      ctx.globalAlpha = 1;

      // player car
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      drawCar(ctx, 0, 0, g.carW, g.carH, '#e23b2e');
      ctx.restore();

      // ── CONTROLS HUD ────────────────────────────────────────────────────────
      const rbx = w * RBX, rby = h * RBY;

      // R/D gear button
      ctx.save();
      ctx.fillStyle = g.reverse ? '#e23b2e' : 'rgba(35,35,50,0.92)';
      ctx.strokeStyle = g.reverse ? '#ff6655' : '#555';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(rbx, rby, RBR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '900 15px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.reverse ? 'R' : 'D', rbx, rby);
      ctx.restore();

      // steering wheel (center bottom)
      const swx = w * 0.5, swy = h * 0.915, swr = 27;
      ctx.save();
      ctx.translate(swx, swy);
      ctx.rotate(g.steer * 0.65);
      // rim
      const gasOn = stage.pointer.down &&
        Math.hypot(stage.pointer.x - w * RBX, stage.pointer.y - h * RBY) > RBR * 1.6;
      ctx.strokeStyle = gasOn ? '#f3c14b' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.arc(0, 0, swr, 0, Math.PI * 2); ctx.stroke();
      // spokes
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * swr * 0.78, Math.sin(a) * swr * 0.78);
        ctx.stroke();
      }
      // hub
      ctx.fillStyle = gasOn ? '#f3c14b' : '#333';
      ctx.beginPath(); ctx.arc(0, 0, swr * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // GAS pedal label (right side, lights up when pressing)
      const gpx = w * 0.87, gpy = h * 0.915;
      ctx.save();
      ctx.fillStyle = gasOn ? 'rgba(243,193,75,0.22)' : 'rgba(40,40,55,0.7)';
      ctx.strokeStyle = gasOn ? '#f3c14b' : '#444';
      ctx.lineWidth = 2;
      roundRect(ctx, gpx - 28, gpy - 18, 56, 36, 10);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = gasOn ? '#f3c14b' : 'rgba(255,255,255,0.3)';
      ctx.font = `${gasOn ? '900' : '700'} 13px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.reverse ? '◀ R' : 'GAS', gpx, gpy);
      ctx.restore();

      // speed bar (small, above wheel)
      if (g.speed !== 0) {
        const bw = 60, bh = 6, bx = w / 2 - bw / 2, by = h * 0.915 - swr - 14;
        const frac = Math.abs(g.speed) / (g.reverse ? g.maxRevSpeed : g.maxSpeed);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        roundRect(ctx, bx, by, bw, bh, 3); ctx.fill();
        ctx.fillStyle = g.reverse ? '#e23b2e' : '#2de07a';
        roundRect(ctx, bx, by, bw * frac, bh, 3); ctx.fill();
      }
    },
  });
}
