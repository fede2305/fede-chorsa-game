// Control de alcoholemia: dos fases seguidas.
// Fase 1: soplá el micrófono y mantené la barra en zona verde 2.5s.
// Fase 2: caminá derecho sobre la línea blanca, sin desviarte.

import { makeGame, clamp } from './base.js';
import { roundRect } from '../engine/sprites.js';
import { driftOffset } from '../engine/effects.js';
import { sfx } from '../engine/audio.js';

const FASE1_DURATION = 7.0;
const FASE1_REQUIRED_IN_ZONE = 2.4;
const FASE2_DURATION = 11.0;
const FASE1_MAX_SCORE = 80;
const FASE2_MAX_SCORE = 120;

// Mic volume thresholds (RMS 0–100 scale)
const MIC_THRESHOLD = 4; // below = silence
const MIC_FULL = 22;     // above = full blow

export function createSobriedad(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.fase = 1;
      g.scoreFase1 = 0;
      g.scoreFase2 = 0;

      // Fase 1
      g.barra = 0;
      g.targetMin = 60;
      g.targetMax = 82;
      g.fase1Time = FASE1_DURATION;
      g.timeInZone = 0;
      g.lastInZone = false;
      g.displayedBarra = 0;

      // Fase 2 (se inicializa al cambiar de fase)
      g.fase2Init = false;

      g.graceScore = 15;
      g.hud.hint = 'Soplá fuerte el micrófono para subir la barra. Mantené en zona verde. Después caminá derecho.';
      g.hud.label = 'Fase 1: Soplá';

      // Mic state
      g.micState = 'requesting'; // 'requesting' | 'granted' | 'denied'
      g.micVolume = 0;
      g.micStream = null;
      g.micAudioCtx = null;
      g.micAnalyser = null;
      g.micBuffer = null;
      g.micFallback = false;
      g._micStreamPending = false;
      g._asyncReady = false;

      if (!navigator.mediaDevices?.getUserMedia) {
        // No mic API: fallback a toque
        g.micState = 'granted';
        g.micFallback = true;
        g._asyncReady = true;
        return;
      }

      // Sin procesado de audio para detectar soplido crudo; usa el mic de llamadas (bottom)
      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      })
        .then(stream => {
          g.micStream = stream;
          g.micState = 'granted';
          g._micStreamPending = true;
          g._asyncReady = true;
        })
        .catch(() => {
          g.micState = 'denied';
          // _asyncReady queda false: juego bloqueado
        });
    },

    renderPreStart(stage, ctx, t, g) {
      drawMicScreen(stage, ctx, t, g);
    },

    step(dt, stage, t, g) {
      // Primer step tras el tap: crear AudioContext (requiere gesto de usuario)
      if (g._micStreamPending && g.micStream) {
        g._micStreamPending = false;
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.25;
          audioCtx.createMediaStreamSource(g.micStream).connect(analyser);
          g.micAudioCtx = audioCtx;
          g.micAnalyser = analyser;
          g.micBuffer = new Uint8Array(analyser.fftSize);
        } catch (e) {
          g.micFallback = true;
        }
      }

      // Resumir AudioContext si estaba suspendido (iOS)
      if (g.micAudioCtx?.state === 'suspended') g.micAudioCtx.resume();

      // Leer volumen del micrófono
      if (g.micAnalyser && g.micBuffer) {
        g.micAnalyser.getByteTimeDomainData(g.micBuffer);
        let sum = 0;
        for (let i = 0; i < g.micBuffer.length; i++) {
          const v = (g.micBuffer[i] - 128) / 128;
          sum += v * v;
        }
        g.micVolume = Math.sqrt(sum / g.micBuffer.length) * 100;
      }

      const chorsa = g.chorsa;

      if (g.fase === 1) {
        runFase1(dt, stage, t, g, chorsa);
      } else if (g.fase === 2) {
        if (!g.fase2Init) initFase2(stage, g);
        runFase2(dt, stage, t, g, chorsa);
      }

      g.score = g.scoreFase1 + g.scoreFase2;

      if (g.done) stopMic(g);
    },

    render(stage, ctx, t, g) {
      if (g.fase === 1) renderFase1(stage, ctx, t, g);
      else renderFase2(stage, ctx, t, g);
    },
  });
}

function stopMic(g) {
  if (g.micStream) {
    g.micStream.getTracks().forEach(t => t.stop());
    g.micStream = null;
  }
  if (g.micAudioCtx) {
    g.micAudioCtx.close();
    g.micAudioCtx = null;
  }
}

// ============================================================
// PANTALLA DE PERMISO DE MICRÓFONO
// ============================================================

function drawMicScreen(stage, ctx, t, g) {
  const w = stage.w, h = stage.h;

  ctx.fillStyle = 'rgba(10,11,20,0.90)';
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (g.micState === 'denied') {
    ctx.fillStyle = '#e23b2e';
    ctx.font = '900 46px system-ui, sans-serif';
    ctx.fillText('🎤', w / 2, h * 0.32);

    ctx.strokeStyle = '#e23b2e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.32, 38, 0, Math.PI * 2);
    ctx.stroke();

    // X sobre el ícono
    ctx.strokeStyle = '#e23b2e';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const cx = w / 2, cy = h * 0.32, d = 24;
    ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillText('MICRÓFONO BLOQUEADO', w / 2, h * 0.50);

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('Este juego requiere acceso al micrófono.', w / 2, h * 0.59);
    ctx.fillText('Habilitalo en los permisos del navegador', w / 2, h * 0.645);
    ctx.fillText('y recargá la página.', w / 2, h * 0.70);
  } else {
    // requesting
    const pulse = 0.5 + 0.5 * Math.abs(Math.sin(t * 2.2));
    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    ctx.fillStyle = '#f3c14b';
    ctx.font = '46px system-ui, sans-serif';
    ctx.fillText('🎤', w / 2, h * 0.32);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#fff';
    ctx.font = '900 19px system-ui, sans-serif';
    ctx.fillText('PERMISO DE MICRÓFONO', w / 2, h * 0.49);

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('Aceptá el permiso para jugar.', w / 2, h * 0.56);
    ctx.fillText('Vas a tener que soplar el micrófono.', w / 2, h * 0.615);

    // puntos animados de espera
    for (let i = 0; i < 3; i++) {
      const a = (t * 3 + i * (Math.PI * 2 / 3)) % (Math.PI * 2);
      ctx.globalAlpha = 0.35 + 0.65 * ((Math.sin(a) + 1) / 2);
      ctx.fillStyle = '#f3c14b';
      ctx.beginPath();
      ctx.arc(w / 2 + (i - 1) * 22, h * 0.72, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// FASE 1 — SOPLAR ALCOHOLÍMETRO
// ============================================================

function runFase1(dt, stage, t, g, chorsa) {
  g.fase1Time -= dt;
  g.hud.time = g.fase1Time;
  g.hud.label = 'Fase 1: Soplá';

  // soplido desde mic (o fallback táctil)
  let blow;
  if (g.micFallback) {
    blow = stage.pointer.down ? 1 : 0;
  } else {
    blow = clamp((g.micVolume - MIC_THRESHOLD) / (MIC_FULL - MIC_THRESHOLD), 0, 1);
  }

  const subir = blow * 48;
  const bajar = (1 - blow) * 30;
  g.barra += subir * dt;
  g.barra -= bajar * dt;
  g.barra = clamp(g.barra, 0, 100);

  g.displayedBarra = g.barra;

  // chequear zona verde
  const inZone = g.displayedBarra >= g.targetMin && g.displayedBarra <= g.targetMax;
  if (inZone) {
    g.timeInZone += dt;
    if (!g.lastInZone) sfx('tick');
  }
  g.lastInZone = inZone;

  // condiciones de fin de fase
  if (g.timeInZone >= FASE1_REQUIRED_IN_ZONE) {
    g.scoreFase1 = FASE1_MAX_SCORE;
    sfx('score');
    g.fase = 2;
    g.hud.time = null;
  } else if (g.fase1Time <= 0) {
    g.scoreFase1 = Math.round((g.timeInZone / FASE1_REQUIRED_IN_ZONE) * FASE1_MAX_SCORE);
    sfx(g.scoreFase1 > 30 ? 'score' : 'wrong');
    g.fase = 2;
    g.hud.time = null;
  }
}

function renderFase1(stage, ctx, t, g) {
  const w = stage.w, h = stage.h;

  // fondo: comisaría
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1a2a3e');
  bg.addColorStop(1, '#0d1828');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // luces patrullero arriba
  const flash = Math.sin(t * 4) > 0 ? '#3a7df0' : '#e23b2e';
  ctx.fillStyle = flash;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(0, 0, w, h * 0.12);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#fff';
  ctx.font = '900 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CONTROL DE ALCOHOLEMIA', w / 2, h * 0.18);
  ctx.fillStyle = '#f3c14b';
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillText('Mantené la aguja en VERDE', w / 2, h * 0.22);

  // ── ALCOHOLÍMETRO ──────────────────────────────────────────
  const meterX = w * 0.5;
  const meterY = h * 0.55;
  const meterW = w * 0.30;
  const meterH = h * 0.46;

  ctx.fillStyle = '#16161e';
  roundRect(ctx, meterX - meterW / 2 - 18, meterY - meterH / 2 - 28, meterW + 36, meterH + 56, 16);
  ctx.fill();
  ctx.strokeStyle = '#3a3a48';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#0a1a14';
  roundRect(ctx, meterX - meterW / 2, meterY - meterH / 2, meterW, meterH, 8);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) {
    const ly = meterY + meterH / 2 - (i / 10) * meterH;
    const lw = i % 5 === 0 ? meterW * 0.32 : meterW * 0.16;
    ctx.beginPath();
    ctx.moveTo(meterX - meterW / 2 + 6, ly);
    ctx.lineTo(meterX - meterW / 2 + 6 + lw, ly);
    ctx.stroke();
  }

  // zona verde objetivo
  const zoneTopY = meterY + meterH / 2 - (g.targetMax / 100) * meterH;
  const zoneBotY = meterY + meterH / 2 - (g.targetMin / 100) * meterH;
  ctx.fillStyle = 'rgba(45,224,122,0.22)';
  ctx.fillRect(meterX - meterW / 2 + 4, zoneTopY, meterW - 8, zoneBotY - zoneTopY);
  ctx.strokeStyle = '#2de07a';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(meterX - meterW / 2 + 4, zoneTopY, meterW - 8, zoneBotY - zoneTopY);
  ctx.setLineDash([]);

  // barra de presión
  const barTopY = meterY + meterH / 2 - (g.displayedBarra / 100) * meterH;
  const inZone = g.displayedBarra >= g.targetMin && g.displayedBarra <= g.targetMax;
  const tooHigh = g.displayedBarra > g.targetMax;
  const barColor = inZone ? '#2de07a' : tooHigh ? '#e23b2e' : '#f3c14b';
  const barGrad = ctx.createLinearGradient(0, barTopY, 0, meterY + meterH / 2);
  barGrad.addColorStop(0, barColor);
  barGrad.addColorStop(1, '#1a1a1f');
  ctx.fillStyle = barGrad;
  ctx.fillRect(meterX - meterW / 2 + 8, barTopY, meterW - 16, meterY + meterH / 2 - barTopY);

  ctx.fillStyle = inZone ? '#2de07a' : tooHigh ? '#e23b2e' : '#fff';
  ctx.font = '900 28px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(g.displayedBarra.toFixed(0), meterX, meterY + meterH / 2 + 8);
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('mg/L', meterX, meterY + meterH / 2 + 38);

  // ── MIC LEVEL INDICATOR ────────────────────────────────────
  if (!g.micFallback) {
    const blow = clamp((g.micVolume - MIC_THRESHOLD) / (MIC_FULL - MIC_THRESHOLD), 0, 1);
    const micX = meterX - meterW / 2 - 44;
    const micH = meterH * 0.6;
    const micY = meterY - micH / 2;
    const micW = 14;

    // fondo del indicador
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, micX - micW / 2, micY, micW, micH, 4);
    ctx.fill();

    // nivel de soplido
    const lvlH = micH * blow;
    const lvlColor = blow > 0.8 ? '#e23b2e' : blow > 0.3 ? '#2de07a' : '#555';
    ctx.fillStyle = lvlColor;
    roundRect(ctx, micX - micW / 2, micY + micH - lvlH, micW, lvlH, 4);
    ctx.fill();

    // ícono mic
    ctx.fillStyle = blow > 0.1 ? '#2de07a' : 'rgba(255,255,255,0.4)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎤', micX, micY - 14);
  }

  // ── PROGRESO EN ZONA ────────────────────────────────────────
  const progY = h * 0.88;
  const progW = w * 0.7;
  const progH = 18;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, (w - progW) / 2, progY, progW, progH, 9);
  ctx.fill();
  const progFill = clamp(g.timeInZone / FASE1_REQUIRED_IN_ZONE, 0, 1);
  ctx.fillStyle = '#2de07a';
  roundRect(ctx, (w - progW) / 2, progY, progW * progFill, progH, 9);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${g.timeInZone.toFixed(1)}s / ${FASE1_REQUIRED_IN_ZONE.toFixed(1)}s en verde`,
    w / 2,
    progY + progH / 2
  );

  // hint inferior
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const isSoplando = g.micFallback ? stage.pointer.down : g.micVolume > MIC_THRESHOLD;
  ctx.fillText(
    isSoplando ? '🌬 SOPLANDO' : (g.micFallback ? 'MANTENÉ APRETADO PARA SOPLAR' : 'SOPLÁ EL MICRÓFONO'),
    w / 2,
    h * 0.95
  );
}

// ============================================================
// FASE 2 — CAMINAR LA LÍNEA
// ============================================================

function initFase2(stage, g) {
  g.fase2Init = true;
  g.fase2Time = FASE2_DURATION;
  g.timeOnLine = 0;
  g.peatonX = stage.w / 2;
  g.peatonY = stage.h * 0.78;
  g.peatonR = stage.w * 0.045;
  g.lineScrollY = 0;
  g.lineWidth = stage.w * 0.035;
  g.tolerance = stage.w * 0.075;
  g.footPhase = 0;
  g.hud.label = 'Fase 2: Caminá';
}

function lineXAtY(stage, t, screenY) {
  return stage.w / 2 + Math.sin(screenY * 0.011 + t * 0.55) * stage.w * 0.20;
}

function runFase2(dt, stage, t, g, chorsa) {
  g.fase2Time -= dt;
  g.hud.time = g.fase2Time;

  if (stage.pointer.down) {
    const target = stage.pointer.x;
    g.peatonX += (target - g.peatonX) * Math.min(1, dt * 8);
  }

  g.peatonX += driftOffset(chorsa, t, 11) * stage.w * 0.14 * dt;
  g.peatonX = clamp(g.peatonX, stage.w * 0.08, stage.w * 0.92);

  g.lineScrollY += stage.h * 0.18 * dt;
  g.footPhase += dt * 6;

  const lineAtPeaton = lineXAtY(stage, t, g.peatonY + g.lineScrollY);
  const dist = Math.abs(g.peatonX - lineAtPeaton);
  if (dist <= g.tolerance) {
    g.timeOnLine += dt;
  }

  if (g.fase2Time <= 0) {
    g.scoreFase2 = Math.round((g.timeOnLine / FASE2_DURATION) * FASE2_MAX_SCORE);
    g.done = true;
    sfx(g.scoreFase2 > 60 ? 'park' : 'wrong');
  }
}

function renderFase2(stage, ctx, t, g) {
  const w = stage.w, h = stage.h;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#3a3225');
  bg.addColorStop(0.55, '#2a241c');
  bg.addColorStop(1, '#1c1812');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 60; i++) {
    const seed = i * 137.5 + g.lineScrollY * 0.5;
    const px = (seed * 31) % w;
    const py = (seed * 17 + g.lineScrollY) % h;
    ctx.fillRect(px, py, 2, 2);
  }

  ctx.strokeStyle = '#f5f3ec';
  ctx.lineWidth = g.lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const step = 10;
  for (let y = -20; y < h + 20; y += step) {
    const lx = lineXAtY(stage, t, y + g.lineScrollY);
    if (y === -20) ctx.moveTo(lx, y);
    else ctx.lineTo(lx, y);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(245,243,236,0.10)';
  ctx.lineWidth = g.tolerance * 2;
  ctx.stroke();

  drawPeaton(ctx, g.peatonX, g.peatonY, g.peatonR, g.footPhase);

  const lineAtPeaton = lineXAtY(stage, t, g.peatonY + g.lineScrollY);
  const dist = Math.abs(g.peatonX - lineAtPeaton);
  if (dist > g.tolerance) {
    ctx.strokeStyle = '#e23b2e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(g.peatonX, g.peatonY, g.peatonR * 1.8, 0, Math.PI * 2);
    ctx.stroke();
  }

  const progY = h * 0.06;
  const progW = w * 0.5;
  const progH = 14;
  const progX = (w - progW) / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, progX, progY, progW, progH, 7);
  ctx.fill();
  const progFill = clamp(g.timeOnLine / FASE2_DURATION, 0, 1);
  ctx.fillStyle = '#2de07a';
  roundRect(ctx, progX, progY, progW * progFill, progH, 7);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TIEMPO SOBRE LA LÍNEA', w / 2, progY + progH / 2);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Arrastrá el dedo para mantenerlo centrado', w / 2, h * 0.95);
}

function drawPeaton(ctx, x, y, r, footPhase) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.3, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  const footOffset = Math.sin(footPhase) * r * 0.4;
  ctx.fillStyle = '#1a1a22';
  ctx.beginPath();
  ctx.ellipse(-r * 0.45, footOffset, r * 0.2, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.45, -footOffset, r * 0.2, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(0, -r * 0.2, r * 0.2, 0, 0, r * 1.2);
  body.addColorStop(0, '#e23b2e');
  body.addColorStop(1, '#8a1d14');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.9, r * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#d9b48f';
  ctx.beginPath();
  ctx.arc(0, -r * 0.35, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1f12';
  ctx.beginPath();
  ctx.arc(0, -r * 0.55, r * 0.5, Math.PI, 0);
  ctx.fill();

  ctx.restore();
}
