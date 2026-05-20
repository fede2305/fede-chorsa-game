// Estacioná el Corsa: volante drag + pedal acelerador + pedal freno.
// Multitouch real: podés tocar el volante mientras pisás un pedal.
// Hay 4-6 autos vecinos para esquivar. Choque = rebote suave + penalidad de tiempo.

import { makeGame, clamp } from './base.js';
import { drawCar, roundRect } from '../engine/sprites.js';
import { driftOffset } from '../engine/effects.js';
import { sfx } from '../engine/audio.js';

const VOLANTE_CX_F = 0.50;
const VOLANTE_CY_F = 0.86;
const VOLANTE_R = 64;
const PEDAL_R = 48;
const GAS_CX_F = 0.82;
const GAS_CY_F = 0.87;
const BRAKE_CX_F = 0.18;
const BRAKE_CY_F = 0.87;
// Umbral Y del panel de control (zonas de gas/freno/volante)
const PANEL_Y_F = 0.74;
const MAX_STEER_ANGLE = Math.PI * 0.85;
const STEER_RETURN_RATE = 5;

const NEIGHBOR_COLORS = ['#5a5a68', '#3a5a48', '#4a3a5a', '#5a4a3a', '#3a4a5a', '#6a5a4a', '#404054'];

export function createParking(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.carW = stage.w * 0.125;
      g.carH = g.carW * 1.7;
      g.x = stage.w * 0.5;
      g.y = stage.h * 0.72;
      g.angle = 0;
      g.speed = 0;
      g.steerAngle = 0;
      g.gas = false;
      g.brake = false;
      g.brakeHeldT = 0;
      g.reverse = false;
      g.maxSpeed = stage.h * 0.20;
      g.maxRevSpeed = stage.h * 0.11;
      g.accel = stage.h * 0.28;
      g.brakeDecel = stage.h * 0.55;
      g.drag = 1.8;
      g.maxSteerRate = 2.6 + chorsaLevel * 0.08;
      g.timeLeft = 30;
      g.parked = false;
      g.collisionFlash = 0;
      g.wheelAngle = 0;

      // box objetivo: en fila superior, a un costado
      const side = Math.random() < 0.5 ? 0.30 : 0.70;
      g.box = {
        x: stage.w * side,
        y: stage.h * 0.20,
        w: g.carW * (1.85 - chorsaLevel * 0.05),
        h: g.carH * (1.40 - chorsaLevel * 0.03),
      };

      // autos vecinos: 2 al lado del box + fila opuesta
      g.neighbors = [];
      // vecinos directos del box (los flanquean)
      g.neighbors.push({
        x: g.box.x - g.box.w * 1.05,
        y: g.box.y,
        w: g.carW,
        h: g.carH,
        color: NEIGHBOR_COLORS[0],
      });
      g.neighbors.push({
        x: g.box.x + g.box.w * 1.05,
        y: g.box.y,
        w: g.carW,
        h: g.carH,
        color: NEIGHBOR_COLORS[1],
      });
      // fila opuesta — posición fija en el medio del campo, lejos del spawn del jugador
      const oppositeY = stage.h * 0.42;
      const opCols = [0.20, 0.50, 0.80];
      for (let i = 0; i < opCols.length; i++) {
        if (Math.random() < 0.72) {
          g.neighbors.push({
            x: stage.w * opCols[i],
            y: oppositeY,
            w: g.carW,
            h: g.carH,
            color: NEIGHBOR_COLORS[2 + i],
          });
        }
      }
      // auto extra entre el jugador y la fila opuesta
      if (Math.random() < 0.55) {
        const exX = side < 0.5 ? stage.w * 0.78 : stage.w * 0.22;
        g.neighbors.push({
          x: exX,
          y: stage.h * 0.57,
          w: g.carW,
          h: g.carH,
          color: NEIGHBOR_COLORS[5],
        });
      }

      g.graceScore = 10;
      g.hud.hint = 'Volante = arrastrá izq/der. Pedal verde acelera, rojo frena. Estacioná en el box.';
      g.hud.label = 'D 0';

      // multitouch state — listeners propios sobre el canvas
      g.fingers = new Map();
      g.touchVolante = null;
      g.touchVolanteStartAngle = 0;
      g.touchVolanteStartSteer = 0;

      const canvas = stage.canvas;
      const posOf = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scale = canvas.clientWidth / stage.w;
        return {
          x: (e.clientX - rect.left) / scale,
          y: (e.clientY - rect.top) / scale,
        };
      };
      g._onDown = (e) => {
        e.preventDefault();
        g.fingers.set(e.pointerId, posOf(e));
      };
      g._onMove = (e) => {
        if (g.fingers.has(e.pointerId)) g.fingers.set(e.pointerId, posOf(e));
      };
      g._onUp = (e) => {
        g.fingers.delete(e.pointerId);
        if (g.touchVolante === e.pointerId) g.touchVolante = null;
      };
      canvas.addEventListener('pointerdown', g._onDown);
      canvas.addEventListener('pointermove', g._onMove);
      window.addEventListener('pointerup', g._onUp);
      window.addEventListener('pointercancel', g._onUp);
    },

    step(dt, stage, t, g) {
      const chorsa = g.chorsa;
      g.timeLeft -= dt;
      g.hud.time = g.timeLeft;
      g.collisionFlash = Math.max(0, g.collisionFlash - dt);

      const vx = stage.w * VOLANTE_CX_F;
      const vy = stage.h * VOLANTE_CY_F;
      const gx = stage.w * GAS_CX_F;
      const gy = stage.h * GAS_CY_F;
      const bx = stage.w * BRAKE_CX_F;
      const by = stage.h * BRAKE_CY_F;

      // ── PROCESS FINGERS ───────────────────────────────────────────────
      // Zonas grandes: derecha = gas, izquierda = freno, centro = volante.
      // También se chequea stage.pointer como fallback para single-touch.
      g.gas = false;
      g.brake = false;

      if (g.touchVolante !== null && !g.fingers.has(g.touchVolante)) {
        g.touchVolante = null;
      }

      const panelY = stage.h * PANEL_Y_F;
      const gasX   = stage.w * 0.58; // derecha del centro = gas
      const brakeX = stage.w * 0.42; // izquierda del centro = freno

      const checkFinger = (id, p) => {
        if (p.y > panelY) {
          if (p.x > gasX)   g.gas   = true;
          if (p.x < brakeX) g.brake = true;
        }
        // Volante: zona central del panel
        if (
          g.touchVolante === null &&
          p.y > panelY &&
          p.x >= brakeX && p.x <= gasX
        ) {
          g.touchVolante = id;
          g.touchVolanteStartAngle = Math.atan2(p.y - vy, p.x - vx);
          g.touchVolanteStartSteer = g.steerAngle;
        }
      };

      for (const [id, p] of g.fingers) checkFinger(id, p);

      // Fallback: stage.pointer (un solo dedo con input lag de chorsa)
      if (stage.pointer.down) {
        const sp = stage.pointer;
        if (sp.y > panelY) {
          if (sp.x > gasX)   g.gas   = true;
          if (sp.x < brakeX) g.brake = true;
        }
      }

      // ── STEERING ─────────────────────────────────────────────────────
      if (g.touchVolante !== null && g.fingers.has(g.touchVolante)) {
        const p = g.fingers.get(g.touchVolante);
        const curAngle = Math.atan2(p.y - vy, p.x - vx);
        let delta = curAngle - g.touchVolanteStartAngle;
        // normalizar a -π..π
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        g.steerAngle = clamp(
          g.touchVolanteStartSteer + delta,
          -MAX_STEER_ANGLE,
          MAX_STEER_ANGLE
        );
      } else {
        // retorno al centro
        g.steerAngle += (0 - g.steerAngle) * Math.min(1, dt * STEER_RETURN_RATE);
      }
      const steer = g.steerAngle / MAX_STEER_ANGLE; // normalizado -1..1

      // ── FRENO + REVERSA ──────────────────────────────────────────────
      if (g.brake) {
        g.brakeHeldT += dt;
        // si está casi parado y mantengo freno, activo reversa
        if (Math.abs(g.speed) < 4 && g.brakeHeldT > 0.45 && !g.reverse) {
          g.reverse = true;
          sfx('shift');
        }
      } else {
        g.brakeHeldT = 0;
        // si pisás acelerador y estás en reversa con velocidad ≈ 0, sale de reversa
        if (g.reverse && g.gas && g.speed > -2) {
          g.reverse = false;
          sfx('shift');
        }
      }

      // ── ACELERACIÓN / FRENO / DRAG ───────────────────────────────────
      if (g.gas && !g.brake) {
        const dir = g.reverse ? -1 : 1;
        const maxSpd = g.reverse ? g.maxRevSpeed : g.maxSpeed;
        if (g.speed * dir < 0) {
          // si voy en dirección contraria, freno primero
          g.speed += dir * g.accel * 1.6 * dt;
        } else {
          g.speed += dir * g.accel * dt;
          g.speed = g.reverse
            ? Math.max(-maxSpd, g.speed)
            : Math.min(maxSpd, g.speed);
        }
      } else if (g.brake) {
        if (Math.abs(g.speed) > 1) {
          g.speed -= Math.sign(g.speed) * g.brakeDecel * dt;
          if (g.speed > -1 && g.speed < 1) g.speed = 0;
        }
      } else {
        // drag natural
        g.speed *= Math.max(0, 1 - dt * g.drag);
        if (Math.abs(g.speed) < 1.5) g.speed = 0;
      }

      // ── STEERING APLICADO / DRIFT ────────────────────────────────────
      const speedFrac = Math.abs(g.speed) / g.maxSpeed;
      // Drift solo cuando el auto se mueve (evita que gire en el eje parado)
      g.angle += driftOffset(chorsa, t, 13) * dt * 0.9 * speedFrac;
      g.angle += steer * g.maxSteerRate * speedFrac * dt;

      g.wheelAngle += g.speed * dt * 0.05;

      // ── MOVIMIENTO ───────────────────────────────────────────────────
      g.x += Math.sin(g.angle) * g.speed * dt;
      g.y -= Math.cos(g.angle) * g.speed * dt;

      // bounce bordes
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

      // ── COLISIONES CON AUTOS VECINOS ─────────────────────────────────
      for (const n of g.neighbors) {
        const dx = Math.abs(g.x - n.x);
        const dy = Math.abs(g.y - n.y);
        const collW = (g.carW + n.w) * 0.46;
        const collH = (g.carH + n.h) * 0.46;
        if (dx < collW && dy < collH) {
          // rebote: empujar afuera por el lado menos invadido
          const overlapX = collW - dx;
          const overlapY = collH - dy;
          if (overlapX < overlapY) {
            g.x += (g.x < n.x ? -1 : 1) * overlapX;
          } else {
            g.y += (g.y < n.y ? -1 : 1) * overlapY;
          }
          if (g.collisionFlash <= 0) {
            // solo penaliza si no chocó hace un instante (evita penalty repetido por solapamiento)
            g.timeLeft -= 1.5;
            sfx('crash');
          }
          g.collisionFlash = 0.45;
          g.speed *= -0.35;
        }
      }

      // ── CHECK ESTACIONAMIENTO ────────────────────────────────────────
      const b = g.box;
      const inside =
        g.x > b.x - b.w / 2 + g.carW * 0.25 &&
        g.x < b.x + b.w / 2 - g.carW * 0.25 &&
        g.y > b.y - b.h / 2 + g.carH * 0.20 &&
        g.y < b.y + b.h / 2 - g.carH * 0.20;
      // bonus extra si está derecho (ángulo cerca de 0 o π)
      const angleNorm = ((g.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const straight = Math.min(angleNorm, Math.PI * 2 - angleNorm, Math.abs(angleNorm - Math.PI)) < 0.35;
      if (inside && Math.abs(g.speed) < g.maxSpeed * 0.18) {
        const straightBonus = straight ? 40 : 0;
        g.score = Math.round(g.timeLeft * 11) + 70 + straightBonus;
        g.parked = true;
        g.done = true;
        sfx('park');
        cleanupListeners(g);
        return;
      }

      if (g.timeLeft <= 0) {
        const d = Math.hypot(g.x - b.x, g.y - b.y);
        g.score = Math.max(0, Math.round(80 - (d / stage.w) * 110));
        g.done = true;
        cleanupListeners(g);
      }

      // Update label HUD: marcha + velocidad
      const speedKmh = Math.round(Math.abs(g.speed) * 0.12);
      g.hud.label = `${g.reverse ? 'R' : 'D'} ${speedKmh} km/h`;
    },

    render(stage, ctx, t, g) {
      const w = stage.w, h = stage.h;

      // ── FONDO: PARKING LOT ───────────────────────────────────────────
      ctx.fillStyle = '#1a1a24';
      ctx.fillRect(0, 0, w, h);

      // grid de piso
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        ctx.beginPath(); ctx.moveTo(0, h * i * 0.1); ctx.lineTo(w, h * i * 0.1); ctx.stroke();
      }
      for (let i = 1; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(w * i * 0.25, 0); ctx.lineTo(w * i * 0.25, h); ctx.stroke();
      }

      // ── BOX OBJETIVO ─────────────────────────────────────────────────
      const b = g.box;
      ctx.save();
      ctx.strokeStyle = g.parked ? '#2de07a' : '#f3c14b';
      ctx.lineWidth = g.parked ? 5 : 4;
      ctx.setLineDash([12, 10]);
      roundRect(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = g.parked ? 'rgba(45,224,122,0.12)' : 'rgba(243,193,75,0.08)';
      ctx.fill();
      ctx.fillStyle = g.parked ? 'rgba(45,224,122,0.5)' : 'rgba(243,193,75,0.35)';
      ctx.font = '900 32px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('P', b.x, b.y);
      ctx.restore();

      // ── AUTOS VECINOS ────────────────────────────────────────────────
      for (const n of g.neighbors) {
        drawCar(ctx, n.x, n.y, n.w, n.h, n.color);
      }

      // ── AUTO DEL JUGADOR ─────────────────────────────────────────────
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      drawCar(ctx, 0, 0, g.carW, g.carH, '#e23b2e');
      ctx.restore();

      // ── COLLISION FLASH ──────────────────────────────────────────────
      if (g.collisionFlash > 0) {
        ctx.fillStyle = `rgba(226,59,46,${0.25 * g.collisionFlash / 0.45})`;
        ctx.fillRect(0, 0, w, h);
      }

      // ── CONTROL PANEL DE FONDO ───────────────────────────────────────
      const panelY = h * PANEL_Y_F;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, panelY, w, h - panelY);

      // Zonas de toque (visual sutil)
      const gasX = w * 0.58, brakeX = w * 0.42;
      if (g.gas) {
        ctx.fillStyle = 'rgba(45,224,122,0.10)';
        ctx.fillRect(gasX, panelY, w - gasX, h - panelY);
      }
      if (g.brake) {
        ctx.fillStyle = 'rgba(226,59,46,0.10)';
        ctx.fillRect(0, panelY, brakeX, h - panelY);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, panelY);
      ctx.lineTo(w, panelY);
      ctx.stroke();

      // ── PEDAL GAS (verde) ────────────────────────────────────────────
      const gx = w * GAS_CX_F, gy = h * GAS_CY_F;
      drawPedal(ctx, gx, gy, PEDAL_R, g.gas, '#2de07a', '#16a04e', 'GAS');

      // ── PEDAL FRENO (rojo) ───────────────────────────────────────────
      const bxp = w * BRAKE_CX_F, byp = h * BRAKE_CY_F;
      drawPedal(ctx, bxp, byp, PEDAL_R, g.brake, '#e23b2e', '#8e1a13', 'FRENO');

      // ── VOLANTE ──────────────────────────────────────────────────────
      const vx = w * VOLANTE_CX_F, vy = h * VOLANTE_CY_F;
      drawVolante(ctx, vx, vy, VOLANTE_R, g.steerAngle, g.touchVolante !== null);

      // ── INDICADOR MARCHA grande (encima del volante) ─────────────────
      ctx.save();
      ctx.fillStyle = g.reverse ? '#e23b2e' : '#2de07a';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 6;
      ctx.fillText(g.reverse ? 'R' : 'D', vx, vy - VOLANTE_R - 18);
      ctx.shadowBlur = 0;
      ctx.restore();
    },
  });
}

function cleanupListeners(g) {
  // no podemos saber el canvas — los listeners se limpian cuando stage.destroy() remueve el canvas.
  // pero por las dudas removemos el window-level
  if (g._onUp) {
    window.removeEventListener('pointerup', g._onUp);
    window.removeEventListener('pointercancel', g._onUp);
  }
}

function drawPedal(ctx, x, y, r, pressed, colorActive, colorBase, label) {
  ctx.save();
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.arc(x, y + 4, r, 0, Math.PI * 2);
  ctx.fill();

  // base
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
  if (pressed) {
    grad.addColorStop(0, colorActive);
    grad.addColorStop(1, colorBase);
  } else {
    grad.addColorStop(0, '#3a3a48');
    grad.addColorStop(1, '#202028');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // borde
  ctx.strokeStyle = pressed ? colorActive : '#555';
  ctx.lineWidth = 3;
  ctx.stroke();

  // label
  ctx.fillStyle = pressed ? '#fff' : 'rgba(255,255,255,0.7)';
  ctx.font = `900 ${pressed ? 16 : 14}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  ctx.restore();
}

function drawVolante(ctx, x, y, r, angle, active) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.arc(0, 4, r, 0, Math.PI * 2);
  ctx.fill();

  // rim exterior
  const rim = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
  rim.addColorStop(0, active ? '#3a3a48' : '#28282e');
  rim.addColorStop(1, active ? '#1a1a22' : '#0e0e14');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // anillo interior (hole)
  ctx.fillStyle = '#1a1a24';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // borde grueso
  ctx.strokeStyle = active ? '#f3c14b' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = active ? '#f3c14b' : 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();

  // spokes (3 radios)
  ctx.strokeStyle = active ? '#f3c14b' : '#666';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18);
    ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
    ctx.stroke();
  }

  // hub central
  const hubGrad = ctx.createRadialGradient(-r * 0.05, -r * 0.05, r * 0.05, 0, 0, r * 0.3);
  hubGrad.addColorStop(0, active ? '#f3c14b' : '#4a4a54');
  hubGrad.addColorStop(1, active ? '#a87a1f' : '#1a1a22');
  ctx.fillStyle = hubGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // logo (raya horizontal)
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.13, 0);
  ctx.lineTo(r * 0.13, 0);
  ctx.stroke();

  ctx.restore();
}
