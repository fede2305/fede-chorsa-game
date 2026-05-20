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
      // Limpiar stream previo si el juego se reinició (grace o retry)
      stopMic(g);

      g.noShake = true; // deshabilita shake/blur/wobble de canvas.js

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
    },

    cleanup(stage, g) {
      stopMic(g);
    },

    render(stage, ctx, t, g) {
      if (g.fase === 1) renderFase1(stage, ctx, t, g);
      else {
        if (!g.fase2Init) initFase2(stage, g);
        renderFase2(stage, ctx, t, g);
      }
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

  // Fondo comisaría
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1a2a3e');
  bg.addColorStop(1, '#0d1828');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Luces patrullero
  const flash = Math.sin(t * 4) > 0 ? '#3a7df0' : '#e23b2e';
  ctx.fillStyle = flash;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(0, 0, w, h * 0.10);
  ctx.globalAlpha = 1;

  // Título
  ctx.fillStyle = '#fff';
  ctx.font = '900 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CONTROL DE ALCOHOLEMIA', w / 2, h * 0.13);
  ctx.fillStyle = '#f3c14b';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText('Soplá hasta la zona VERDE', w / 2, h * 0.17);

  const inZone = g.displayedBarra >= g.targetMin && g.displayedBarra <= g.targetMax;
  const tooHigh = g.displayedBarra > g.targetMax;
  const blow = g.micFallback
    ? (stage.pointer.down ? 1 : 0)
    : clamp((g.micVolume - MIC_THRESHOLD) / (MIC_FULL - MIC_THRESHOLD), 0, 1);

  // ── CUERPO DEL ALCOHOLÍMETRO ───────────────────────────────────────
  const devW = 220;
  const devH = 270;
  const devX = (w - devW) / 2;
  const devY = h * 0.21;

  // Sombra del dispositivo
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, devX + 7, devY + 9, devW, devH, 20);
  ctx.fill();

  // Cuerpo principal
  const devGrad = ctx.createLinearGradient(devX, devY, devX + devW, devY + devH);
  devGrad.addColorStop(0, '#2e3244');
  devGrad.addColorStop(0.5, '#232535');
  devGrad.addColorStop(1, '#181925');
  ctx.fillStyle = devGrad;
  roundRect(ctx, devX, devY, devW, devH, 20);
  ctx.fill();
  ctx.strokeStyle = '#4a4c60';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Reflejo superior (brillo)
  const shineGrad = ctx.createLinearGradient(devX, devY, devX, devY + 50);
  shineGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
  shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shineGrad;
  roundRect(ctx, devX + 4, devY + 4, devW - 8, 50, 16);
  ctx.fill();

  // Etiqueta "POLICÍA FEDERAL"
  ctx.fillStyle = '#f3c14b';
  ctx.font = '700 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POLICÍA FEDERAL  ·  ALCO-TEST 3000', w / 2, devY + 18);

  // ── PANTALLA LCD ───────────────────────────────────────────────────
  const lcdX = devX + 16;
  const lcdY = devY + 32;
  const lcdW = devW - 32;
  const lcdH = 168;

  // Brillo de zona verde en LCD
  if (inZone) {
    ctx.fillStyle = 'rgba(45,224,122,0.10)';
    roundRect(ctx, lcdX - 4, lcdY - 4, lcdW + 8, lcdH + 8, 10);
    ctx.fill();
  }

  // Fondo LCD
  ctx.fillStyle = '#05100a';
  roundRect(ctx, lcdX, lcdY, lcdW, lcdH, 8);
  ctx.fill();
  ctx.strokeStyle = '#1e3a28';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── Barra horizontal de nivel ──────────────────────────────────────
  const barX = lcdX + 10;
  const barY = lcdY + 14;
  const barW = lcdW - 20;
  const barH = 28;

  // Fondo barra
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, barX, barY, barW, barH, 5);
  ctx.fill();

  // Zona verde
  const zoneStartX = barX + (g.targetMin / 100) * barW;
  const zoneEndX   = barX + (g.targetMax / 100) * barW;
  const zoneW = zoneEndX - zoneStartX;
  ctx.fillStyle = 'rgba(45,224,122,0.20)';
  ctx.fillRect(zoneStartX, barY, zoneW, barH);
  ctx.strokeStyle = '#2de07a';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(zoneStartX, barY, zoneW, barH);
  ctx.setLineDash([]);

  // Ticks de zona
  ctx.fillStyle = '#2de07a';
  ctx.font = '700 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('VERDE', zoneStartX + zoneW / 2, barY + barH + 3);

  // Relleno de la barra (fill actual)
  const fillW = (g.displayedBarra / 100) * barW;
  if (fillW > 2) {
    const barColor = inZone ? '#2de07a' : tooHigh ? '#e23b2e' : '#f3c14b';
    const barFill = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    barFill.addColorStop(0, 'rgba(0,0,0,0.3)');
    barFill.addColorStop(1, barColor);
    ctx.fillStyle = barFill;
    roundRect(ctx, barX, barY, fillW, barH, 5);
    ctx.fill();
  }

  // ── Lectura digital grande ─────────────────────────────────────────
  const readingY = barY + barH + 18;
  const readingColor = inZone ? '#2de07a' : tooHigh ? '#e23b2e' : '#c8c8d8';
  ctx.fillStyle = readingColor;
  ctx.font = '900 56px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(g.displayedBarra.toFixed(0), w / 2, readingY);

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillText('mg/L', w / 2, readingY + 58);

  // Estado
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillStyle = inZone ? '#2de07a' : tooHigh ? '#e23b2e' : '#f3c14b';
  ctx.fillText(
    inZone ? '✓  ZONA VÁLIDA' : tooHigh ? '▲  SOPLÁ MENOS' : '▼  SOPLÁ MÁS FUERTE',
    w / 2, readingY + 72
  );

  // ── Botones decorativos y serial ───────────────────────────────────
  const btnY = devY + devH - 28;
  ['#e23b2e', '#2de07a', '#f3c14b'].forEach((c, i) => {
    const bx = devX + 28 + i * 24;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.arc(bx + 1, btnY + 1, 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(bx, btnY, 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font = '600 7px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('SN: FC-2024-009', devX + devW - 12, btnY);

  // ── TUBO / PIPETA (hacia abajo) ─────────────────────────────────────
  const tubeW = 34;
  const tubeH = 72;
  const tubeX = w / 2 - tubeW / 2;
  const tubeY = devY + devH;

  // Sombra tubo
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, tubeX + 4, tubeY + 4, tubeW, tubeH, 5);
  ctx.fill();

  // Cuerpo tubo
  const tubeGrad = ctx.createLinearGradient(tubeX, 0, tubeX + tubeW, 0);
  tubeGrad.addColorStop(0, '#2e2e3e');
  tubeGrad.addColorStop(0.25, '#58586e');
  tubeGrad.addColorStop(0.75, '#48485a');
  tubeGrad.addColorStop(1, '#22222e');
  ctx.fillStyle = tubeGrad;
  roundRect(ctx, tubeX, tubeY, tubeW, tubeH, 5);
  ctx.fill();
  ctx.strokeStyle = '#5a5a70';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Anillos de agarre
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const ry = tubeY + (tubeH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(tubeX + 3, ry);
    ctx.lineTo(tubeX + tubeW - 3, ry);
    ctx.stroke();
  }

  // ── BOQUILLA / MOUTHPIECE ─────────────────────────────────────────
  const capW = tubeW + 14;
  const capH = 24;
  const capX = w / 2 - capW / 2;
  const capY = tubeY + tubeH;

  ctx.fillStyle = '#18181e';
  roundRect(ctx, capX, capY, capW, capH, capH / 2);
  ctx.fill();
  ctx.strokeStyle = '#42424e';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Interior boquilla
  ctx.fillStyle = '#0a0a10';
  const ip = 5;
  roundRect(ctx, capX + ip, capY + ip, capW - ip * 2, capH - ip * 2, (capH - ip * 2) / 2);
  ctx.fill();

  // ── ANIMACIÓN SOPLIDO (partículas subiendo por el tubo) ───────────
  if (blow > 0.05) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(tubeX - 2, tubeY - 10, tubeW + 4, tubeH + 14);
    ctx.clip();
    const n = Math.ceil(blow * 6);
    for (let i = 0; i < n; i++) {
      const phase = ((t * 2.8 + i * 0.38) % 1);
      const py = capY - phase * (tubeH + capH + 10);
      const px = w / 2 + Math.sin(t * 4 + i * 2.1) * (tubeW * 0.22);
      const pr = 2.5 + blow * 3;
      ctx.globalAlpha = blow * (0.9 - phase) * 0.75;
      ctx.fillStyle = inZone ? '#2de07a' : '#7ee8ff';
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ── BARRA DE PROGRESO (tiempo en zona verde) ───────────────────────
  const progY = h * 0.875;
  const progW = w * 0.72;
  const progH = 18;
  const progX = (w - progW) / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundRect(ctx, progX, progY, progW, progH, 9);
  ctx.fill();
  const progFill = clamp(g.timeInZone / FASE1_REQUIRED_IN_ZONE, 0, 1);
  if (progFill > 0) {
    const pgGrad = ctx.createLinearGradient(progX, 0, progX + progW * progFill, 0);
    pgGrad.addColorStop(0, '#1a7a40');
    pgGrad.addColorStop(1, '#2de07a');
    ctx.fillStyle = pgGrad;
    roundRect(ctx, progX, progY, progW * progFill, progH, 9);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${g.timeInZone.toFixed(1)}s / ${FASE1_REQUIRED_IN_ZONE.toFixed(1)}s en verde`,
    w / 2, progY + progH / 2
  );

  // Hint inferior
  const isSoplando = blow > 0.1;
  ctx.fillStyle = isSoplando ? '#2de07a' : 'rgba(255,255,255,0.65)';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    isSoplando ? '🌬  SOPLANDO' : (g.micFallback ? 'MANTENÉ APRETADO' : 'SOPLÁ EL MICRÓFONO'),
    w / 2, h * 0.955
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
