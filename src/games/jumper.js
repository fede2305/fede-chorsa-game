// Esquiva baches: camino en perspectiva tipo Outrun. Toca izquierda/derecha
// para cambiar de carril antes de que te alcancen los baches y conos.

import { makeGame, clamp, rampFactor } from './base.js';
import { drawCar } from '../engine/sprites.js';
import { sfx } from '../engine/audio.js';

const LANES = 3;
const SWITCH_S = 0.18;
const HY_F = 0.27;   // horizon Y fraction
const BY_F = 0.96;   // road bottom Y fraction
const HW_F = 0.065;  // road half-width at horizon (fraction of w)
const BW_F = 0.44;   // road half-width at bottom (fraction of w)
const DASH_PERIOD = 0.09;
const DASH_LEN = 0.04;

function roadHW(w, depth) {
  return w * HW_F + (w * BW_F - w * HW_F) * depth;
}

function proj(stage, lane, depth) {
  const hY = stage.h * HY_F;
  const bY = stage.h * BY_F;
  const hw = roadHW(stage.w, depth);
  const y = hY + (bY - hY) * depth;
  const laneOff = ((lane + 0.5) / LANES) * 2 - 1; // -1/3, 0, +1/3
  const x = stage.w / 2 + hw * laneOff;
  const scale = 0.06 + 0.94 * depth;
  return { x, y, scale };
}

export function createJumper(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.lane = 1;
      g.toLane = 1;
      g.fromLane = 1;
      g.switchT = SWITCH_S;
      g.obst = [];
      g.spawnT = -1.5;
      g.dashOff = 0;
      g.baseSpeed = 0.46 * chorsa.speedMult;
      g.dist = 0;
      g.graceScore = 20;
      g.hud.hint = 'Tocá el lado IZQUIERDO o DERECHO de la pantalla para cambiar de carril. Esquivá los baches y los conos.';
      g.hud.label = '';
    },

    step(dt, stage, t, g) {
      const chorsa = g.chorsa;
      const ramp = rampFactor(g.playT, 0.09, 3.0);
      const spd = g.baseSpeed * ramp;
      const spawnEvery = clamp(1.5 / ramp, 0.46, 1.5);

      g.dist += spd * dt;
      g.score = Math.floor(g.dist * 20);
      g.dashOff += spd * dt;

      // lane switch animation (ease-out)
      if (g.switchT < SWITCH_S) {
        g.switchT = Math.min(SWITCH_S, g.switchT + dt);
        const ease = 1 - (1 - g.switchT / SWITCH_S) ** 2;
        g.lane = g.fromLane + (g.toLane - g.fromLane) * ease;
      } else {
        g.lane = g.toLane;
      }

      // input: left/right tap → change lane
      if (stage.pointer.justDown) {
        const dir = stage.pointer.x < stage.w / 2 ? -1 : 1;
        const next = clamp(g.toLane + dir, 0, LANES - 1);
        if (next !== g.toLane) {
          g.fromLane = g.lane;
          g.toLane = next;
          g.switchT = 0;
          sfx('tap');
        }
      }

      // chorsa drift: random lane nudge
      if (Math.random() < chorsa.drift * dt * 1.4) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        const next = clamp(g.toLane + dir, 0, LANES - 1);
        if (next !== g.toLane) {
          g.fromLane = g.lane;
          g.toLane = next;
          g.switchT = 0;
        }
      }

      // spawn — 78% chance obstacle avoids current target lane
      g.spawnT += dt;
      if (g.spawnT >= spawnEvery) {
        g.spawnT = 0;
        let lane;
        if (Math.random() < 0.78) {
          const opts = [];
          for (let i = 0; i < LANES; i++) if (i !== g.toLane) opts.push(i);
          lane = opts[(Math.random() * opts.length) | 0];
        } else {
          lane = (Math.random() * LANES) | 0;
        }
        g.obst.push({ depth: 0.01, lane, big: Math.random() < 0.45 });
      }

      // advance + collide
      for (const o of g.obst) {
        o.depth += spd * dt;
        if (o.depth >= 0.88 && o.depth < 1.0) {
          if (Math.round(g.lane) === o.lane) {
            sfx('crash');
            g.done = true;
            return;
          }
        }
      }
      g.obst = g.obst.filter((o) => o.depth < 1.02);
    },

    render(stage, ctx, t, g) {
      const w = stage.w, h = stage.h;
      const hY = h * HY_F, bY = h * BY_F;
      const hW = w * HW_F, bW = w * BW_F;
      const cx = w / 2;

      // SKY
      const sky = ctx.createLinearGradient(0, 0, 0, hY);
      sky.addColorStop(0, '#06060c');
      sky.addColorStop(1, '#14142a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, hY);

      // STARS
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 28; i++) {
        const sx = (i * 137.5 + 17) % w;
        const sy = (i * 89.3 + 9) % (hY * 0.88);
        ctx.fillRect(sx, sy, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
      }

      // GROUND (side of road)
      const ground = ctx.createLinearGradient(0, hY, 0, h);
      ground.addColorStop(0, '#22281a');
      ground.addColorStop(1, '#161c10');
      ctx.fillStyle = ground;
      ctx.fillRect(0, hY, w, h - hY);

      // ROAD TRAPEZOID
      ctx.fillStyle = '#30303c';
      ctx.beginPath();
      ctx.moveTo(cx - hW, hY); ctx.lineTo(cx + hW, hY);
      ctx.lineTo(cx + bW, bY); ctx.lineTo(cx - bW, bY);
      ctx.closePath();
      ctx.fill();

      // ROAD EDGES
      ctx.strokeStyle = '#d0d0d8';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - hW, hY); ctx.lineTo(cx - bW, bY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + hW, hY); ctx.lineTo(cx + bW, bY); ctx.stroke();

      // LANE DIVIDERS — animated perspective dashes
      ctx.strokeStyle = 'rgba(243,225,160,0.78)';
      const startOff = g.dashOff % DASH_PERIOD;
      for (let div = 1; div < LANES; div++) {
        const laneF = (div / LANES) * 2 - 1; // -1/3 or +1/3
        for (let d0 = startOff; d0 < 1; d0 += DASH_PERIOD) {
          const d1 = Math.min(d0 + DASH_LEN, 1);
          if (d0 >= 0.998) break;
          ctx.lineWidth = 1.5 + d0 * 3.5;
          ctx.beginPath();
          ctx.moveTo(cx + roadHW(w, d0) * laneF, hY + (bY - hY) * d0);
          ctx.lineTo(cx + roadHW(w, d1) * laneF, hY + (bY - hY) * d1);
          ctx.stroke();
        }
      }

      // OBSTACLES (back-to-front)
      const sorted = [...g.obst].sort((a, b) => a.depth - b.depth);
      for (const o of sorted) {
        const { x, y, scale: sc } = proj(stage, o.lane, o.depth);
        if (o.big) {
          ctx.save();
          ctx.fillStyle = '#080810';
          ctx.beginPath(); ctx.ellipse(x, y, 28 * sc, 11 * sc, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#5a5a6e'; ctx.lineWidth = 1.5 * sc;
          ctx.beginPath(); ctx.ellipse(x, y - 1, 24 * sc, 8.5 * sc, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        } else {
          const s = 20 * sc;
          ctx.save(); ctx.translate(x, y);
          ctx.fillStyle = '#d24e0e';
          ctx.beginPath(); ctx.ellipse(0, s * 0.4, s * 0.9, s * 0.28, 0, 0, Math.PI * 2); ctx.fill();
          const cg = ctx.createLinearGradient(-s, 0, s, 0);
          cg.addColorStop(0, '#c2440a'); cg.addColorStop(0.5, '#ff7a1a'); cg.addColorStop(1, '#c2440a');
          ctx.fillStyle = cg;
          ctx.beginPath(); ctx.moveTo(0, -s * 1.1); ctx.lineTo(s * 0.68, s * 0.38); ctx.lineTo(-s * 0.68, s * 0.38); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.1); ctx.lineTo(s * 0.42, -s * 0.1); ctx.lineTo(s * 0.52, s * 0.13); ctx.lineTo(-s * 0.52, s * 0.13); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }

      // PLAYER CAR (top-down, facing toward horizon)
      const pp = proj(stage, g.lane, 0.87);
      const carW = w * 0.128;
      const carH = carW * 1.72;
      ctx.save();
      ctx.translate(pp.x, pp.y - carH * 0.25);
      drawCar(ctx, 0, 0, carW, carH, '#e23b2e');
      ctx.restore();

      // GUTTER below road
      ctx.fillStyle = '#0e0e14';
      ctx.fillRect(0, bY, w, h - bY);

      // LANE DOTS HUD
      for (let i = 0; i < LANES; i++) {
        const active = Math.abs(g.lane - i) < 0.32;
        ctx.beginPath();
        ctx.arc(cx + (i - 1) * 30, h - 22, active ? 9 : 5, 0, Math.PI * 2);
        ctx.fillStyle = active ? '#e23b2e' : 'rgba(255,255,255,0.22)';
        ctx.fill();
      }

      // ARROW HINTS (first 5.5s)
      if (g.playT < 5.5) {
        const a = Math.max(0, Math.min(1, 6 - g.playT)) * 0.6;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#f3c14b';
        ctx.font = '900 34px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('◀', w * 0.09, h * 0.87);
        ctx.fillText('▶', w * 0.91, h * 0.87);
        ctx.restore();
      }
    },
  });
}
