// Control de alcoholemia: dos fases seguidas.
// Fase 1: soplá el alcoholímetro y mantené la barra en zona verde 2.5s.
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

      // Fase 2 (se inicializa al cambiar de fase)
      g.fase2Init = false;

      g.graceScore = 15;
      g.hud.hint = 'Sopla el alcoholímetro hasta zona verde. Después caminá derecho sobre la línea.';
      g.hud.label = 'Fase 1: Soplá';
    },

    step(dt, stage, t, g) {
      const chorsa = g.chorsa;

      if (g.fase === 1) {
        runFase1(dt, stage, t, g, chorsa);
      } else if (g.fase === 2) {
        if (!g.fase2Init) initFase2(stage, g);
        runFase2(dt, stage, t, g, chorsa);
      }

      g.score = g.scoreFase1 + g.scoreFase2;
    },

    render(stage, ctx, t, g) {
      if (g.fase === 1) renderFase1(stage, ctx, t, g);
      else renderFase2(stage, ctx, t, g);
    },
  });
}

// ============================================================
// FASE 1 — SOPLAR ALCOHOLÍMETRO
// ============================================================

function runFase1(dt, stage, t, g, chorsa) {
  g.fase1Time -= dt;
  g.hud.time = g.fase1Time;
  g.hud.label = 'Fase 1: Soplá';

  // tap-hold sube la barra; sin tap, baja
  const subir = stage.pointer.down ? 38 : 0;
  const bajar = stage.pointer.down ? 0 : 28;
  g.barra += subir * dt;
  g.barra -= bajar * dt;
  g.barra = clamp(g.barra, 0, 100);

  // valor mostrado con drift del chorsa
  const driftVal = driftOffset(chorsa, t, 7) * 7;
  g.displayedBarra = clamp(g.barra + driftVal, 0, 100);

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

  // fondo: comisaría — pared azul oscura
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1a2a3e');
  bg.addColorStop(1, '#0d1828');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // luces patrullero arriba (pulsantes)
  const flash = Math.sin(t * 4) > 0 ? '#3a7df0' : '#e23b2e';
  ctx.fillStyle = flash;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(0, 0, w, h * 0.12);
  ctx.globalAlpha = 1;

  // título
  ctx.fillStyle = '#fff';
  ctx.font = '900 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CONTROL DE ALCOHOLEMIA', w / 2, h * 0.18);
  ctx.fillStyle = '#f3c14b';
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillText('Mantené la aguja en VERDE', w / 2, h * 0.22);

  // ── ALCOHOLÍMETRO (display LCD vertical) ──────────────────────────────
  const meterX = w * 0.5;
  const meterY = h * 0.55;
  const meterW = w * 0.30;
  const meterH = h * 0.46;

  // carcasa
  ctx.fillStyle = '#16161e';
  roundRect(ctx, meterX - meterW / 2 - 18, meterY - meterH / 2 - 28, meterW + 36, meterH + 56, 16);
  ctx.fill();
  ctx.strokeStyle = '#3a3a48';
  ctx.lineWidth = 2;
  ctx.stroke();

  // pantalla LCD
  ctx.fillStyle = '#0a1a14';
  roundRect(ctx, meterX - meterW / 2, meterY - meterH / 2, meterW, meterH, 8);
  ctx.fill();

  // marcas escala
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

  // zona verde objetivo (banda)
  const zoneTopY = meterY + meterH / 2 - (g.targetMax / 100) * meterH;
  const zoneBotY = meterY + meterH / 2 - (g.targetMin / 100) * meterH;
  ctx.fillStyle = 'rgba(45,224,122,0.22)';
  ctx.fillRect(meterX - meterW / 2 + 4, zoneTopY, meterW - 8, zoneBotY - zoneTopY);
  ctx.strokeStyle = '#2de07a';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(meterX - meterW / 2 + 4, zoneTopY, meterW - 8, zoneBotY - zoneTopY);
  ctx.setLineDash([]);

  // barra de presión actual (con drift)
  const barTopY = meterY + meterH / 2 - (g.displayedBarra / 100) * meterH;
  const inZone = g.displayedBarra >= g.targetMin && g.displayedBarra <= g.targetMax;
  const tooHigh = g.displayedBarra > g.targetMax;
  const barColor = inZone ? '#2de07a' : tooHigh ? '#e23b2e' : '#f3c14b';
  const barGrad = ctx.createLinearGradient(0, barTopY, 0, meterY + meterH / 2);
  barGrad.addColorStop(0, barColor);
  barGrad.addColorStop(1, '#1a1a1f');
  ctx.fillStyle = barGrad;
  ctx.fillRect(meterX - meterW / 2 + 8, barTopY, meterW - 16, meterY + meterH / 2 - barTopY);

  // valor numérico digital
  ctx.fillStyle = inZone ? '#2de07a' : tooHigh ? '#e23b2e' : '#fff';
  ctx.font = '900 28px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(g.displayedBarra.toFixed(0), meterX, meterY + meterH / 2 + 8);
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('mg/L', meterX, meterY + meterH / 2 + 38);

  // ── PROGRESO EN ZONA ────────────────────────────────────────────────
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

  // hint
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(stage.pointer.down ? '🌬 SOPLANDO' : 'MANTENÉ APRETADO PARA SOPLAR', w / 2, h * 0.95);
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
  g.tolerance = stage.w * 0.075; // ancho de línea + margen
  g.footPhase = 0;
  g.hud.label = 'Fase 2: Caminá';
}

function lineXAtY(stage, t, screenY) {
  // serpenteo: depende de coord absoluta (y - scroll) para que se vea fluir
  return stage.w / 2 + Math.sin(screenY * 0.011 + t * 0.55) * stage.w * 0.20;
}

function runFase2(dt, stage, t, g, chorsa) {
  g.fase2Time -= dt;
  g.hud.time = g.fase2Time;

  // movimiento controlado por dedo (drag horizontal)
  if (stage.pointer.down) {
    const target = stage.pointer.x;
    g.peatonX += (target - g.peatonX) * Math.min(1, dt * 8);
  }

  // drift del chorsa lo ladea solo
  g.peatonX += driftOffset(chorsa, t, 11) * stage.w * 0.14 * dt;
  g.peatonX = clamp(g.peatonX, stage.w * 0.08, stage.w * 0.92);

  // scroll de línea
  g.lineScrollY += stage.h * 0.18 * dt;
  g.footPhase += dt * 6;

  // chequear distancia a la línea (a la altura del peatón)
  const lineAtPeaton = lineXAtY(stage, t, g.peatonY + g.lineScrollY);
  const dist = Math.abs(g.peatonX - lineAtPeaton);
  if (dist <= g.tolerance) {
    g.timeOnLine += dt;
  }

  // fin de fase
  if (g.fase2Time <= 0) {
    g.scoreFase2 = Math.round((g.timeOnLine / FASE2_DURATION) * FASE2_MAX_SCORE);
    g.done = true;
    sfx(g.scoreFase2 > 60 ? 'park' : 'wrong');
  }
}

function renderFase2(stage, ctx, t, g) {
  const w = stage.w, h = stage.h;

  // fondo: vereda nocturna iluminada por luz amarillenta
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#3a3225');
  bg.addColorStop(0.55, '#2a241c');
  bg.addColorStop(1, '#1c1812');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // textura sutil de pavimento (puntos)
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 60; i++) {
    const seed = i * 137.5 + g.lineScrollY * 0.5;
    const px = (seed * 31) % w;
    const py = (seed * 17 + g.lineScrollY) % h;
    ctx.fillRect(px, py, 2, 2);
  }

  // línea blanca serpenteante (se dibuja como una serie de segmentos)
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

  // banda de "tolerancia" sutil
  ctx.strokeStyle = 'rgba(245,243,236,0.10)';
  ctx.lineWidth = g.tolerance * 2;
  ctx.stroke();

  // peatón (vista cenital — círculo cabeza + cuerpo + pies alternando)
  drawPeaton(ctx, g.peatonX, g.peatonY, g.peatonR, g.footPhase);

  // indicador rojo si está fuera de línea
  const lineAtPeaton = lineXAtY(stage, t, g.peatonY + g.lineScrollY);
  const dist = Math.abs(g.peatonX - lineAtPeaton);
  if (dist > g.tolerance) {
    ctx.strokeStyle = '#e23b2e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(g.peatonX, g.peatonY, g.peatonR * 1.8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // progreso "tiempo en línea"
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

  // hint inferior
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Arrastrá el dedo para mantenerlo centrado', w / 2, h * 0.95);
}

function drawPeaton(ctx, x, y, r, footPhase) {
  ctx.save();
  ctx.translate(x, y);

  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.3, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // pies (dos elipses alternando)
  const footOffset = Math.sin(footPhase) * r * 0.4;
  ctx.fillStyle = '#1a1a22';
  ctx.beginPath();
  ctx.ellipse(-r * 0.45, footOffset, r * 0.2, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.45, -footOffset, r * 0.2, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // cuerpo (camisa)
  const body = ctx.createRadialGradient(0, -r * 0.2, r * 0.2, 0, 0, r * 1.2);
  body.addColorStop(0, '#e23b2e');
  body.addColorStop(1, '#8a1d14');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.9, r * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  // cabeza
  ctx.fillStyle = '#d9b48f';
  ctx.beginPath();
  ctx.arc(0, -r * 0.35, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // pelo
  ctx.fillStyle = '#2a1f12';
  ctx.beginPath();
  ctx.arc(0, -r * 0.55, r * 0.5, Math.PI, 0);
  ctx.fill();

  ctx.restore();
}
