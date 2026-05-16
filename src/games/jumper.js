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
      g.spawnT = -1.2;
      g.dist = 0;
      g.roadOff = 0;
      g.bgOff = 0;   // parallax offset for background
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
      g.bgOff   = (g.bgOff   + speed * 0.28 * dt) % stage.w;
      g.dist += speed * dt;
      g.score = Math.floor(g.dist / 9);

      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        g.spawnT = gap + rand(-jitter, jitter * 1.3);
        // Spawn far right so player sees them coming
        g.obst.push({ x: stage.w + 200, big: Math.random() < 0.42 });
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
      const w = stage.w;
      const h = stage.h;

      // ── SKY ──────────────────────────────────────────────────────────────
      const sky = ctx.createLinearGradient(0, 0, 0, g.groundY);
      sky.addColorStop(0, '#0d0d1a');
      sky.addColorStop(1, '#1e1e32');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, g.groundY);

      // ── STARS (static) ───────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      // deterministic star positions via seeded pattern
      for (let i = 0; i < 28; i++) {
        const sx = ((i * 137.5 + 11) % w);
        const sy = ((i * 89.3 + 7) % (g.groundY * 0.6));
        ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
      }

      // ── DISTANT BUILDINGS (parallax 0.18x) ───────────────────────────────
      const bOff = g.bgOff * 0.65;
      drawBuildings(ctx, w, h, g.groundY, bOff);

      // ── STREETLIGHTS (parallax 0.55x) ────────────────────────────────────
      drawStreetlights(ctx, w, h, g.groundY, (g.bgOff * 1.8) % w);

      // ── ROAD ─────────────────────────────────────────────────────────────
      drawRoad(ctx, w, h, g.roadOff, 1);
      ctx.fillStyle = '#101015';
      ctx.fillRect(0, g.groundY + g.carH * 0.5, w, h);

      // ── OBSTACLES ────────────────────────────────────────────────────────
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

function drawBuildings(ctx, w, h, groundY, offset) {
  const buildings = [
    { x: 0.05, bw: 0.11, bh: 0.38 },
    { x: 0.17, bw: 0.07, bh: 0.52 },
    { x: 0.25, bw: 0.13, bh: 0.30 },
    { x: 0.40, bw: 0.09, bh: 0.46 },
    { x: 0.51, bw: 0.14, bh: 0.34 },
    { x: 0.67, bw: 0.08, bh: 0.55 },
    { x: 0.77, bw: 0.11, bh: 0.28 },
    { x: 0.90, bw: 0.12, bh: 0.42 },
  ];
  ctx.save();
  for (const b of buildings) {
    // draw twice to fill both sides of looping parallax
    for (let rep = -1; rep <= 1; rep++) {
      const bx = ((b.x * w - offset + rep * w + w) % (w * 1.1)) - w * 0.05;
      const bh2 = groundY * b.bh;
      const by = groundY - bh2;
      const bw2 = w * b.bw;

      ctx.fillStyle = '#1c1c2e';
      ctx.fillRect(bx, by, bw2, bh2);

      // windows
      ctx.fillStyle = 'rgba(255,220,80,0.55)';
      const cols = Math.floor(bw2 / 9);
      const rows = Math.floor(bh2 / 12);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if ((r * 7 + c * 3 + b.x * 100) % 4 < 2) {
            ctx.fillRect(bx + c * 9 + 2, by + r * 12 + 3, 5, 6);
          }
        }
      }
    }
  }
  ctx.restore();
}

function drawStreetlights(ctx, w, h, groundY, offset) {
  const spacing = w * 0.38;
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const lx = ((i * spacing - offset + spacing * 4) % (spacing * 3)) + w * 0.1;
    const poleH = groundY * 0.28;
    const poleX = lx;
    const poleY = groundY - poleH;

    // pole
    ctx.strokeStyle = '#4a4a5a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(poleX, groundY);
    ctx.lineTo(poleX, poleY);
    ctx.lineTo(poleX + 18, poleY);
    ctx.stroke();

    // lamp glow
    ctx.fillStyle = 'rgba(255,230,100,0.18)';
    ctx.beginPath();
    ctx.arc(poleX + 18, poleY, 22, 0, Math.PI * 2);
    ctx.fill();

    // lamp head
    ctx.fillStyle = '#fde8a0';
    ctx.fillRect(poleX + 10, poleY - 4, 16, 8);
  }
  ctx.restore();
}
