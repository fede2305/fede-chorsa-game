// Hacé el 4: mantenete en equilibrio sobre un pie usando el giroscopio.
// El jugador debe mantener el teléfono recto; inclinarlo drena el equilibrio.
// Si el balance llega a 0, la figura se cae y el juego termina.

import { makeGame, clamp } from './base.js';
import { roundRect } from '../engine/sprites.js';
import { driftOffset } from '../engine/effects.js';
import { sfx } from '../engine/audio.js';

const DURATION       = 15.0;
const MAX_SCORE      = 200;

const TILT_SAFE      = 12;   // grados — zona segura, no drena
const TILT_DANGER    = 32;   // grados — drenaje máximo
const BALANCE_MAX    = 1.0;
const BALANCE_DRAIN  = 0.75; // por segundo a máximo peligro
const BALANCE_RECOVER= 0.35; // por segundo en zona segura

export function createEl4(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      stopGyro(g);

      g.noShake = true;

      g.gyroState    = 'idle';
      g.gyroTilt     = 0;
      g.gyroListener = null;
      g.gyroFallback = false;
      g._gyroBtn     = null;

      g.gameTime     = DURATION;
      g.balance      = BALANCE_MAX;
      g.sway         = 0;
      g.fallen       = false;
      g.fallDir      = 1;
      g.fallAngle    = 0;
      g.timeBalanced = 0;

      g.graceScore   = 20;
      g.hud.hint     = 'Mantené el teléfono derecho para que la figura no se caiga';
      g.hud.label    = 'Hacé el 4';

      g._asyncReady  = false;
      setupGyroPermission(stage, g);
    },

    renderPreStart(stage, ctx, t, g) {
      if (g.gyroState === 'denied') {
        drawGyroErrorScreen(stage, ctx, t, g);
      } else {
        drawGyroWaitScreen(stage, ctx, t, g);
      }
    },

    step(dt, stage, t, g) {
      if (g.gyroFallback) {
        g.gyroTilt = ((stage.pointer.x / stage.w) - 0.5) * 55;
      }

      const chorsa = g.chorsa;

      if (g.fallen) {
        g.fallAngle = Math.min(g.fallAngle + dt * 170, 90);
        if (g.fallAngle >= 88) {
          g.score = Math.round((g.timeBalanced / DURATION) * MAX_SCORE);
          g.done  = true;
          sfx('wrong');
        }
        return;
      }

      g.gameTime -= dt;
      g.hud.time  = g.gameTime;

      const rawTilt = g.gyroTilt || 0;
      const drift   = g.gyroFallback ? 0 : driftOffset(chorsa, t, 13) * 16;
      g.sway        = rawTilt + drift;

      const absSway = Math.abs(g.sway);

      if (absSway <= TILT_SAFE) {
        g.balance = Math.min(BALANCE_MAX, g.balance + BALANCE_RECOVER * dt);
        g.timeBalanced += dt;
      } else {
        const danger = clamp((absSway - TILT_SAFE) / (TILT_DANGER - TILT_SAFE), 0, 1);
        g.balance = Math.max(0, g.balance - BALANCE_DRAIN * danger * dt);
      }

      if (g.balance <= 0) {
        g.fallen  = true;
        g.fallDir = g.sway >= 0 ? 1 : -1;
        sfx('wrong');
        return;
      }

      if (g.gameTime <= 0) {
        g.score = Math.round((g.timeBalanced / DURATION) * MAX_SCORE);
        g.done  = true;
        sfx(g.score > 100 ? 'park' : 'wrong');
      }
    },

    cleanup(stage, g) {
      stopGyro(g);
    },

    render(stage, ctx, t, g) {
      renderEl4(stage, ctx, t, g);
    },
  });
}

// ── Cleanup ────────────────────────────────────────────────────────────────

function stopGyro(g) {
  if (g.gyroListener) {
    window.removeEventListener('deviceorientation', g.gyroListener);
    g.gyroListener = null;
  }
  if (g._gyroBtn) { g._gyroBtn.remove(); g._gyroBtn = null; }
}

// ── Gyro permission ────────────────────────────────────────────────────────

function setupGyroPermission(stage, g) {
  function attachListener() {
    const handler = (e) => { if (e.gamma != null) g.gyroTilt = e.gamma; };
    window.addEventListener('deviceorientation', handler);
    g.gyroListener = handler;
    g.gyroState    = 'granted';
    g._asyncReady  = true;
    if (g._gyroBtn) { g._gyroBtn.remove(); g._gyroBtn = null; }
  }

  if (typeof DeviceOrientationEvent === 'undefined') {
    g.gyroFallback = true;
    g.gyroState    = 'granted';
    g._asyncReady  = true;
    return;
  }

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    g.gyroState = 'idle';
    const btn = document.createElement('button');
    btn.textContent = 'Permitir sensor de movimiento →';
    btn.style.cssText = [
      'position:fixed', 'bottom:36%', 'left:50%',
      'transform:translateX(-50%)', 'z-index:600',
      'background:#f3c14b', 'color:#14121e',
      'border:none', 'border-radius:40px',
      'padding:18px 34px',
      'font:900 17px system-ui,sans-serif',
      'cursor:pointer', 'white-space:nowrap',
      'box-shadow:0 6px 28px rgba(0,0,0,0.55)',
    ].join(';');
    document.body.appendChild(btn);
    g._gyroBtn = btn;

    btn.addEventListener('click', () => {
      g.gyroState = 'requesting';
      btn.textContent = 'Esperando...';
      btn.style.opacity = '0.6';
      DeviceOrientationEvent.requestPermission()
        .then(state => {
          if (state === 'granted') {
            attachListener();
          } else {
            g.gyroState = 'denied';
            if (g._gyroBtn) { g._gyroBtn.remove(); g._gyroBtn = null; }
          }
        })
        .catch(() => {
          g.gyroState = 'denied';
          if (g._gyroBtn) { g._gyroBtn.remove(); g._gyroBtn = null; }
        });
    });
  } else {
    attachListener();
  }
}

// ── Pantallas de permiso ───────────────────────────────────────────────────

function drawGyroWaitScreen(stage, ctx, t, g) {
  const w = stage.w, h = stage.h;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1a1c2e'); bg.addColorStop(1, '#0e1018');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(10,11,20,0.75)'; ctx.fillRect(0, 0, w, h);

  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 1.8));
  ctx.globalAlpha = pulse;
  ctx.font = '52px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('📱', w/2, h * 0.28);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#fff'; ctx.font = '900 19px system-ui, sans-serif';
  ctx.fillText('SENSOR DE MOVIMIENTO', w/2, h * 0.44);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText('Lo necesitás para hacer el 4', w/2, h * 0.51);
  ctx.fillText('y mantener el equilibrio.', w/2, h * 0.56);

  ctx.fillStyle = '#f3c14b'; ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText('↓  Tocá el botón amarillo  ↓', w/2, h * 0.64);
}

function drawGyroErrorScreen(stage, ctx, t, g) {
  const w = stage.w, h = stage.h;
  ctx.fillStyle = 'rgba(10,11,20,0.92)'; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  ctx.font = '44px system-ui, sans-serif'; ctx.fillText('📱', w/2, h*0.30);
  const cx = w/2, cy = h*0.30;
  ctx.strokeStyle = '#e23b2e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI*2); ctx.stroke();
  ctx.lineWidth = 5; ctx.lineCap = 'round'; const d = 24;
  ctx.beginPath(); ctx.moveTo(cx-d,cy-d); ctx.lineTo(cx+d,cy+d); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+d,cy-d); ctx.lineTo(cx-d,cy+d); ctx.stroke();

  ctx.fillStyle = '#fff'; ctx.font = '900 20px system-ui, sans-serif';
  ctx.fillText('SENSOR BLOQUEADO', w/2, h*0.50);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText('Habilitá el sensor de movimiento', w/2, h*0.59);
  ctx.fillText('en los ajustes del navegador y recargá.', w/2, h*0.645);
}

// ── Render principal ───────────────────────────────────────────────────────

function renderEl4(stage, ctx, t, g) {
  const w = stage.w, h = stage.h;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1a1c2e'); bg.addColorStop(0.65, '#14161e'); bg.addColorStop(1, '#0e1014');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  // Suelo
  ctx.fillStyle = '#22242e'; ctx.fillRect(0, h*0.77, w, h*0.23);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, h*0.77); ctx.lineTo(w, h*0.77); ctx.stroke();

  // Flash patrullero
  const flash = Math.sin(t*3.5) > 0 ? '#3a7df0' : '#e23b2e';
  ctx.fillStyle = flash; ctx.globalAlpha = 0.07; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;

  ctx.fillStyle = '#fff'; ctx.font = '900 18px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PRUEBA DE EQUILIBRIO', w/2, h*0.07);
  ctx.fillStyle = '#f3c14b'; ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('Mantené el teléfono derecho', w/2, h*0.115);

  // ── Indicador de inclinación ───────────────────────────────────────
  const indW = 180, indH = 14, indX = (w-indW)/2, indY = h*0.15;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, indX, indY, indW, indH, indH/2); ctx.fill();

  const safeW = (TILT_SAFE/90)*indW;
  ctx.fillStyle = 'rgba(45,224,122,0.22)';
  ctx.fillRect(w/2 - safeW, indY, safeW*2, indH);

  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(w/2, indY-5); ctx.lineTo(w/2, indY+indH+5); ctx.stroke();

  const tiltFrac = clamp(g.sway / 90, -1, 1);
  const indBall  = w/2 + tiltFrac * indW/2;
  const inSafe   = Math.abs(g.sway) <= TILT_SAFE;
  ctx.fillStyle  = inSafe ? '#2de07a' : '#e23b2e';
  ctx.beginPath(); ctx.arc(indBall, indY+indH/2, indH/2+3, 0, Math.PI*2); ctx.fill();

  // ── Figura ────────────────────────────────────────────────────────
  const footX   = w / 2;
  const footY   = h * 0.765;
  const swayDeg = g.fallen
    ? g.fallDir * Math.min(g.fallAngle, 88)
    : g.sway * 1.6;

  drawElCuatro(ctx, footX, footY, swayDeg, t);

  // ── Balance meter ─────────────────────────────────────────────────
  if (!g.fallen) {
    const balW=w*0.68, balH=16, balX=(w-balW)/2, balY=h*0.835;
    ctx.fillStyle='rgba(255,255,255,0.08)'; roundRect(ctx,balX,balY,balW,balH,balH/2); ctx.fill();
    const bf = g.balance;
    const bc = bf>0.6?'#2de07a':bf>0.3?'#f3c14b':'#e23b2e';
    ctx.fillStyle=bc; roundRect(ctx,balX,balY,balW*bf,balH,balH/2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='700 10px system-ui,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('EQUILIBRIO', w/2, balY+balH/2);

    if (!inSafe && g.balance < 0.35) {
      ctx.globalAlpha = 0.25 + 0.25 * Math.abs(Math.sin(t*8));
      ctx.fillStyle = '#e23b2e'; ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = inSafe ? 'rgba(255,255,255,0.5)' : '#e23b2e';
    ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline='middle';
    ctx.fillText(
      inSafe ? '👍 Bien, seguí así' : '⚠️  ¡Te estás cayendo!',
      w/2, h*0.895
    );

    if (g.gyroFallback) {
      ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='600 11px system-ui,sans-serif';
      ctx.fillText('(sin giroscopio: mové el dedo)', w/2, h*0.930);
    }
  } else {
    ctx.fillStyle = '#e23b2e'; ctx.font = '900 32px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('¡TE CAÍSTE!', w/2, h*0.865);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('Con tanto alcohol no hay forma...', w/2, h*0.912);
  }
}

// ── Stick figure ───────────────────────────────────────────────────────────

function drawElCuatro(ctx, footX, footY, swayDeg, t) {
  const swayRad  = swayDeg * Math.PI / 180;
  const legH     = 128;
  const bodyH    = 78;
  const headR    = 25;
  const shouldY  = -legH - bodyH + 12;
  const armLen   = 55;
  const thighW   = 70;
  const thighRY  = 6;
  const calfLen  = 76;
  const lineW    = 7;

  const swayN   = clamp(swayDeg / 28, -1, 1);
  const lArmAng = (-38 - swayN * 28) * Math.PI / 180;
  const rArmAng = (-38 + swayN * 28) * Math.PI / 180;

  ctx.save();
  ctx.translate(footX, footY);
  ctx.rotate(swayRad);

  // Sombra
  ctx.save();
  ctx.translate(6, 6);
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#000'; ctx.lineWidth = lineW + 3;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  drawFigureLines(ctx, legH, bodyH, shouldY, armLen, lArmAng, rArmAng, thighW, thighRY, calfLen);
  ctx.restore();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#eeeeff'; ctx.lineWidth = lineW;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  drawFigureLines(ctx, legH, bodyH, shouldY, armLen, lArmAng, rArmAng, thighW, thighRY, calfLen);

  ctx.fillStyle = '#eeeeff';
  ctx.beginPath(); ctx.arc(0, -legH - bodyH - headR, headR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a2a3e';
  ctx.beginPath(); ctx.arc(0, -legH - bodyH - headR, headR * 0.58, Math.PI, 0); ctx.fill();

  ctx.restore();
}

function drawFigureLines(ctx, legH, bodyH, shouldY, armLen, lArmAng, rArmAng, thighW, thighRY, calfLen) {
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, -legH);
  ctx.moveTo(0, -legH); ctx.lineTo(0, -legH - bodyH);
  ctx.moveTo(0, shouldY);
  ctx.lineTo(-Math.cos(lArmAng) * armLen, shouldY - Math.sin(-lArmAng) * armLen);
  ctx.moveTo(0, shouldY);
  ctx.lineTo(Math.cos(rArmAng) * armLen, shouldY - Math.sin(-rArmAng) * armLen);
  const kneeX = thighW, kneeY = -legH + thighRY;
  ctx.moveTo(0, -legH); ctx.lineTo(kneeX, kneeY);
  ctx.moveTo(kneeX, kneeY); ctx.lineTo(kneeX, kneeY + calfLen);
  ctx.stroke();
}
