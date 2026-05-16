// Runner INFINITO: el Corsa esquiva trafico en 3 carriles.
// No termina por tiempo: se va poniendo cada vez mas rapido y con mas
// trafico hasta que chocas. Toca izquierda/derecha para cambiar de carril.
//
// Aleatoriedad: pesos por carril (menor probabilidad en el carril del jugador),
// jitter de cadencia, descarte si el carril ya tiene obstáculo cercano,
// y ráfagas ocasionales para evitar patrón predecible.
// Aceleración: SIN TOPE — crece lineal con el tiempo.

import { makeGame, clamp, lerp, drawRoad } from './base.js';
import { drawCar } from '../engine/sprites.js';
import { driftOffset } from '../engine/effects.js';
import { sfx } from '../engine/audio.js';

const LANES = 3;
const OBST_COLORS = ['#2d7dd2', '#22a559', '#f5b301', '#8a8f9a', '#e8e8ec', '#7b4fd8'];

function laneX(stage, lane) {
  const left = stage.w * 0.07;
  const span = stage.w * 0.86;
  return left + (span * (lane + 0.5)) / LANES;
}

function spawnObstacle(g, stage, lane, yOffset = 0) {
  g.obst.push({
    lane,
    x: laneX(stage, lane),
    y: -g.carH * 1.5 + yOffset,
    color: OBST_COLORS[(Math.random() * OBST_COLORS.length) | 0],
  });
}

export function createRunner(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.lane = 1;
      g.carX = laneX(stage, 1);
      g.carW = stage.w * 0.17;
      g.carH = g.carW * 1.85;
      g.carY = stage.h * 0.8;
      g.dist = 0;
      g.baseSpeed = stage.h * 0.48 * chorsa.speedMult;
      g.roadOff = 0;
      g.obst = [];
      g.spawnT = -0.9;
      g.spawnJitter = 1.0;
      g.nextBurst = 7 + Math.random() * 3; // primera ráfaga entre 7-10s
      g.graceScore = 20;
      g.hud.hint = 'Tocá el lado IZQUIERDO o DERECHO de la pantalla para cambiar de carril';
      g.hud.label = '◀ izq | der ▶';
    },

    step(dt, stage, t, g) {
      const chorsa = g.chorsa;
      // dificultad creciente sin tope: +4.5% por segundo
      const ramp = 1 + g.playT * 0.045;
      const speed = g.baseSpeed * ramp;
      const spawnEvery = Math.max(0.30, 1.05 / ramp);

      // cambio de carril
      if (stage.pointer.justDown) {
        const prevLane = g.lane;
        if (stage.pointer.x < stage.w / 2) g.lane = clamp(g.lane - 1, 0, LANES - 1);
        else g.lane = clamp(g.lane + 1, 0, LANES - 1);
        if (g.lane !== prevLane) sfx('tap');
      }

      // el auto tiende al carril; la chorsa lo desvia
      const target = laneX(stage, g.lane) + driftOffset(chorsa, t, 3) * stage.w * 0.16;
      g.carX = lerp(g.carX, target, clamp(dt * 8, 0, 1));
      g.carX = clamp(g.carX, stage.w * 0.1, stage.w * 0.9);

      // avance
      g.dist += speed * dt;
      g.roadOff = (g.roadOff + speed * dt) % 64;
      g.score = Math.floor(g.dist / 7);

      // ── SPAWN PRINCIPAL ──────────────────────────────────────────────
      g.spawnT += dt;
      const targetSpawn = spawnEvery * g.spawnJitter;
      if (g.spawnT >= targetSpawn) {
        g.spawnT = 0;
        g.spawnJitter = 0.75 + Math.random() * 0.5; // 0.75x–1.25x

        // pesos por carril: el del jugador tiene menos chance
        const weights = [1.0, 1.0, 1.0];
        weights[g.lane] = 0.55;
        const total = weights[0] + weights[1] + weights[2];
        let r = Math.random() * total;
        let lane = 0;
        for (let i = 0; i < weights.length; i++) {
          r -= weights[i];
          if (r <= 0) { lane = i; break; }
        }

        // si el carril elegido ya tiene un obstáculo demasiado cerca del spawn, abortamos
        const tooCloseY = stage.h * 0.18;
        const tooClose = g.obst.some(
          (o) => o.lane === lane && o.y < tooCloseY && o.y > -g.carH * 4
        );
        if (!tooClose) {
          spawnObstacle(g, stage, lane);
        }
      }

      // ── RÁFAGAS ocasionales ─────────────────────────────────────────
      if (g.playT > g.nextBurst) {
        g.nextBurst = g.playT + 6 + Math.random() * 4.5;
        // 2 obstáculos en carriles distintos, dejando uno libre
        const freeLane = (Math.random() * LANES) | 0;
        const others = [0, 1, 2].filter((l) => l !== freeLane);
        // asegurar que ninguno tenga obstáculo muy cercano
        for (let i = 0; i < others.length; i++) {
          const l = others[i];
          const occupied = g.obst.some(
            (o) => o.lane === l && o.y < stage.h * 0.25 && o.y > -g.carH * 4
          );
          if (!occupied) {
            spawnObstacle(g, stage, l, -i * g.carH * 1.6);
          }
        }
      }

      // mover y chequear choque
      for (const o of g.obst) {
        o.y += speed * dt;
        const dx = Math.abs(o.x - g.carX);
        const dy = Math.abs(o.y - g.carY);
        if (dx < g.carW * 0.82 && dy < g.carH * 0.82) {
          sfx('crash');
          g.done = true;
          return;
        }
      }
      g.obst = g.obst.filter((o) => o.y < stage.h + g.carH);

      // velocidad-tag visible (lo usa el render)
      g.speedRamp = ramp;
    },

    render(stage, ctx, t, g) {
      drawRoad(ctx, stage.w, stage.h, g.roadOff, LANES);

      // Lane warning triangles at top — show when an obstacle is off-screen above
      const offscreenByLane = new Map();
      for (const o of g.obst) {
        if (o.y < 0) {
          offscreenByLane.set(o.lane, Math.min(offscreenByLane.get(o.lane) ?? Infinity, o.y));
        }
      }
      for (const [lane, y] of offscreenByLane) {
        const wx = laneX(stage, lane);
        const alpha = Math.min(1, (-y / (g.carH * 1.5)));
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = '#f5b301';
        ctx.beginPath();
        ctx.moveTo(wx, 16);
        ctx.lineTo(wx - 14, 42);
        ctx.lineTo(wx + 14, 42);
        ctx.closePath();
        ctx.fill();
        // signo de exclamación en el triángulo
        ctx.fillStyle = '#000';
        ctx.font = '900 14px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('!', wx, 32);
        ctx.restore();
      }

      for (const o of g.obst) {
        drawCar(ctx, o.x, o.y, g.carW, g.carH, o.color);
      }
      drawCar(ctx, g.carX, g.carY, g.carW, g.carH, '#e23b2e');

      // velocidad tag (abajo derecha)
      if (g.speedRamp) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(stage.w - 95, stage.h - 38, 90, 30);
        ctx.fillStyle = g.speedRamp > 2.5 ? '#e23b2e' : g.speedRamp > 1.8 ? '#f3c14b' : '#fff';
        ctx.font = '900 16px system-ui, sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(`${g.speedRamp.toFixed(1)}× speed`, stage.w - 12, stage.h - 23);
        ctx.restore();
      }
    },
  });
}
