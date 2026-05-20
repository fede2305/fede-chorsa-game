// Control de alcoholemia: dos fases.
// Fase 1: soplá el micrófono y mantené la barra en zona verde.
// Fase 2: hacé el 4 — mantenete en equilibrio usando el giroscopio.

import { makeGame, clamp } from './base.js';
import { roundRect } from '../engine/sprites.js';
import { driftOffset } from '../engine/effects.js';
import { sfx } from '../engine/audio.js';

const FASE1_DURATION         = 7.0;
const FASE1_REQUIRED_IN_ZONE = 2.4;
const FASE2_DURATION         = 12.0;
const FASE1_MAX_SCORE        = 80;
const FASE2_MAX_SCORE        = 120;

// Mic
const MIC_THRESHOLD = 4;
const MIC_FULL      = 22;

// Balance (fase 2)
const TILT_SAFE      = 12;   // grados — zona segura, no drena
const TILT_DANGER    = 32;   // grados — drenaje máximo
const BALANCE_MAX    = 1.0;
const BALANCE_DRAIN  = 0.75; // por segundo a máximo peligro
const BALANCE_RECOVER= 0.35; // por segundo en zona segura

export function createSobriedad(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      stopMic(g);
      stopGyro(g);

      g.noShake = true;

      g.fase = 1;
      g.scoreFase1 = 0;
      g.scoreFase2 = 0;

      // Fase 1
      g.barra        = 0;
      g.displayedBarra = 0;
      g.targetMin    = 60;
      g.targetMax    = 82;
      g.fase1Time    = FASE1_DURATION;
      g.timeInZone   = 0;
      g.lastInZone   = false;

      // Fase 2
      g.fase2Init = false;

      g.graceScore = 15;
      g.hud.hint   = 'Soplá el micrófono (Fase 1) · Hacé el 4 con el giroscopio (Fase 2)';
      g.hud.label  = 'Fase 1: Soplá';

      // Mic state
      g.micState          = 'requesting';
      g.micVolume         = 0;
      g.micStream         = null;
      g.micAudioCtx       = null;
      g.micAnalyser       = null;
      g.micBuffer         = null;
      g.micFallback       = false;
      g._micStreamPending = false;

      // Gyro state
      g.gyroState    = 'idle'; // 'idle' | 'granted' | 'denied'
      g.gyroTilt     = 0;     // gamma en grados
      g.gyroListener = null;
      g.gyroFallback = false;
      g._gyroBtn     = null;

      g._asyncReady = false;

      // Pedir mic primero
      if (!navigator.mediaDevices?.getUserMedia) {
        g.micState    = 'granted';
        g.micFallback = true;
        setupGyroPermission(stage, g);
        return;
      }

      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      })
        .then(stream => {
          g.micStream         = stream;
          g.micState          = 'granted';
          g._micStreamPending = true;
          setupGyroPermission(stage, g);
        })
        .catch(() => {
          g.micState = 'denied';
          // _asyncReady queda false
        });
    },

    renderPreStart(stage, ctx, t, g) {
      if (g.micState !== 'granted') {
        drawMicScreen(stage, ctx, t, g);
      } else if (g.gyroState === 'denied') {
        drawGyroErrorScreen(stage, ctx, t, g);
      } else {
        // Gyro pendiente (idle o requesting en iOS) — DOM button visible encima
        drawGyroWaitScreen(stage, ctx, t, g);
      }
    },

    step(dt, stage, t, g) {
      // Crear AudioContext tras el primer tap (gesto de usuario)
      if (g._micStreamPending && g.micStream) {
        g._micStreamPending = false;
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const analyser  = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.25;
          audioCtx.createMediaStreamSource(g.micStream).connect(analyser);
          g.micAudioCtx = audioCtx;
          g.micAnalyser = analyser;
          g.micBuffer   = new Uint8Array(analyser.fftSize);
        } catch (e) {
          g.micFallback = true;
        }
      }

      if (g.micAudioCtx?.state === 'suspended') g.micAudioCtx.resume();

      if (g.micAnalyser && g.micBuffer) {
        g.micAnalyser.getByteTimeDomainData(g.micBuffer);
        let sum = 0;
        for (let i = 0; i < g.micBuffer.length; i++) {
          const v = (g.micBuffer[i] - 128) / 128;
          sum += v * v;
        }
        g.micVolume = Math.sqrt(sum / g.micBuffer.length) * 100;
      }

      // Fallback giroscopio: usar posición X del puntero
      if (g.gyroFallback) {
        g.gyroTilt = ((stage.pointer.x / stage.w) - 0.5) * 55;
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
      stopGyro(g);
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

// ── Helpers de cleanup ─────────────────────────────────────────────────────

function stopMic(g) {
  if (g.micStream) {
    g.micStream.getTracks().forEach(tr => tr.stop());
    g.micStream = null;
  }
  if (g.micAudioCtx) { g.micAudioCtx.close(); g.micAudioCtx = null; }
  g.micAnalyser = null;
}

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

  // Sin API de orientación → fallback puntero
  if (typeof DeviceOrientationEvent === 'undefined') {
    g.gyroFallback = true;
    g.gyroState    = 'granted';
    g._asyncReady  = true;
    return;
  }

  // iOS 13+ requiere permiso explícito con gesto del usuario
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
    // Android / desktop sin API de permiso → auto-grant
    attachListener();
  }
}

// ── Pantallas de permiso ───────────────────────────────────────────────────

function drawMicScreen(stage, ctx, t, g) {
  const w = stage.w, h = stage.h;
  ctx.fillStyle = 'rgba(10,11,20,0.90)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (g.micState === 'denied') {
    const cx = w / 2, cy = h * 0.33;
    ctx.fillStyle = '#e23b2e';
    ctx.font = '44px system-ui, sans-serif';
    ctx.fillText('🎤', cx, cy);
    ctx.strokeStyle = '#e23b2e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, 37, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    const d = 22;
    ctx.beginPath(); ctx.moveTo(cx-d,cy-d); ctx.lineTo(cx+d,cy+d); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+d,cy-d); ctx.lineTo(cx-d,cy+d); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillText('MICRÓFONO BLOQUEADO', cx, h * 0.50);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('Habilitá el micrófono en los permisos', cx, h * 0.59);
    ctx.fillText('del navegador y recargá la página.', cx, h * 0.645);
  } else {
    const pulse = 0.7 + 0.3 * Math.abs(Math.sin(t * 2.2));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#f3c14b'; ctx.font = '46px system-ui, sans-serif';
    ctx.fillText('🎤', w/2, h * 0.32);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.font = '900 19px system-ui, sans-serif';
    ctx.fillText('PERMISO DE MICRÓFONO', w/2, h * 0.49);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('Aceptá para poder soplar el alcoholímetro.', w/2, h * 0.57);
    for (let i = 0; i < 3; i++) {
      const a = (t * 3 + i * (Math.PI * 2 / 3)) % (Math.PI * 2);
      ctx.globalAlpha = 0.35 + 0.65 * ((Math.sin(a) + 1) / 2);
      ctx.fillStyle = '#f3c14b';
      ctx.beginPath(); ctx.arc(w/2 + (i-1)*22, h*0.68, 7, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawGyroWaitScreen(stage, ctx, t, g) {
  const w = stage.w, h = stage.h;
  // Fondo suave — el botón DOM flota encima
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1a1c2e'); bg.addColorStop(1, '#0e1018');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(10,11,20,0.75)';
  ctx.fillRect(0, 0, w, h);

  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 1.8));
  ctx.globalAlpha = pulse;
  ctx.font = '52px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('📱', w/2, h * 0.28);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#fff'; ctx.font = '900 19px system-ui, sans-serif';
  ctx.fillText('SENSOR DE MOVIMIENTO', w/2, h * 0.44);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText('Lo necesitás para mantener el equilibrio', w/2, h * 0.51);
  ctx.fillText('en la Fase 2 (hacer el 4).', w/2, h * 0.565);

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

// ============================================================
// FASE 1 — SOPLAR ALCOHOLÍMETRO
// ============================================================

function runFase1(dt, stage, t, g, chorsa) {
  g.fase1Time -= dt;
  g.hud.time   = g.fase1Time;
  g.hud.label  = 'Fase 1: Soplá';

  const blow = g.micFallback
    ? (stage.pointer.down ? 1 : 0)
    : clamp((g.micVolume - MIC_THRESHOLD) / (MIC_FULL - MIC_THRESHOLD), 0, 1);

  g.barra += blow * 48 * dt;
  g.barra -= (1 - blow) * 30 * dt;
  g.barra = clamp(g.barra, 0, 100);
  g.displayedBarra = g.barra;

  const inZone = g.displayedBarra >= g.targetMin && g.displayedBarra <= g.targetMax;
  if (inZone) {
    g.timeInZone += dt;
    if (!g.lastInZone) sfx('tick');
  }
  g.lastInZone = inZone;

  if (g.timeInZone >= FASE1_REQUIRED_IN_ZONE) {
    g.scoreFase1 = FASE1_MAX_SCORE;
    sfx('score');
    g.fase = 2; g.hud.time = null;
  } else if (g.fase1Time <= 0) {
    g.scoreFase1 = Math.round((g.timeInZone / FASE1_REQUIRED_IN_ZONE) * FASE1_MAX_SCORE);
    sfx(g.scoreFase1 > 30 ? 'score' : 'wrong');
    g.fase = 2; g.hud.time = null;
  }
}

function renderFase1(stage, ctx, t, g) {
  const w = stage.w, h = stage.h;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1a2a3e'); bg.addColorStop(1, '#0d1828');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  const flash = Math.sin(t * 4) > 0 ? '#3a7df0' : '#e23b2e';
  ctx.fillStyle = flash; ctx.globalAlpha = 0.18;
  ctx.fillRect(0, 0, w, h * 0.10); ctx.globalAlpha = 1;

  ctx.fillStyle = '#fff'; ctx.font = '900 20px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('CONTROL DE ALCOHOLEMIA', w/2, h*0.13);
  ctx.fillStyle = '#f3c14b'; ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText('Soplá hasta la zona VERDE', w/2, h*0.17);

  const inZone  = g.displayedBarra >= g.targetMin && g.displayedBarra <= g.targetMax;
  const tooHigh = g.displayedBarra > g.targetMax;
  const blow    = g.micFallback
    ? (stage.pointer.down ? 1 : 0)
    : clamp((g.micVolume - MIC_THRESHOLD) / (MIC_FULL - MIC_THRESHOLD), 0, 1);

  // ── Dispositivo ────────────────────────────────────────────────────
  const devW = 220, devH = 270;
  const devX = (w - devW) / 2, devY = h * 0.21;

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, devX+7, devY+9, devW, devH, 20); ctx.fill();

  const devGrad = ctx.createLinearGradient(devX, devY, devX+devW, devY+devH);
  devGrad.addColorStop(0, '#2e3244'); devGrad.addColorStop(0.5, '#232535'); devGrad.addColorStop(1, '#181925');
  ctx.fillStyle = devGrad; roundRect(ctx, devX, devY, devW, devH, 20); ctx.fill();
  ctx.strokeStyle = '#4a4c60'; ctx.lineWidth = 2; ctx.stroke();

  const shineGrad = ctx.createLinearGradient(devX, devY, devX, devY+50);
  shineGrad.addColorStop(0,'rgba(255,255,255,0.12)'); shineGrad.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = shineGrad; roundRect(ctx, devX+4, devY+4, devW-8, 50, 16); ctx.fill();

  ctx.fillStyle = '#f3c14b'; ctx.font = '700 9px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('POLICÍA FEDERAL  ·  ALCO-TEST 3000', w/2, devY+18);

  // ── LCD ────────────────────────────────────────────────────────────
  const lcdX = devX+16, lcdY = devY+32, lcdW = devW-32, lcdH = 168;
  if (inZone) {
    ctx.fillStyle = 'rgba(45,224,122,0.10)';
    roundRect(ctx, lcdX-4, lcdY-4, lcdW+8, lcdH+8, 10); ctx.fill();
  }
  ctx.fillStyle = '#05100a'; roundRect(ctx, lcdX, lcdY, lcdW, lcdH, 8); ctx.fill();
  ctx.strokeStyle = '#1e3a28'; ctx.lineWidth = 1.5; ctx.stroke();

  // Barra horizontal
  const barX = lcdX+10, barY = lcdY+14, barW = lcdW-20, barH = 28;
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; roundRect(ctx, barX, barY, barW, barH, 5); ctx.fill();

  const zoneX = barX + (g.targetMin/100)*barW;
  const zoneW = ((g.targetMax - g.targetMin)/100)*barW;
  ctx.fillStyle = 'rgba(45,224,122,0.20)'; ctx.fillRect(zoneX, barY, zoneW, barH);
  ctx.strokeStyle = '#2de07a'; ctx.lineWidth = 1.5; ctx.setLineDash([5,3]);
  ctx.strokeRect(zoneX, barY, zoneW, barH); ctx.setLineDash([]);
  ctx.fillStyle = '#2de07a'; ctx.font = '700 8px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('VERDE', zoneX+zoneW/2, barY+barH+3);

  const fillW = (g.displayedBarra/100)*barW;
  if (fillW > 2) {
    const barColor = inZone ? '#2de07a' : tooHigh ? '#e23b2e' : '#f3c14b';
    const barFill = ctx.createLinearGradient(barX, 0, barX+fillW, 0);
    barFill.addColorStop(0,'rgba(0,0,0,0.3)'); barFill.addColorStop(1, barColor);
    ctx.fillStyle = barFill; roundRect(ctx, barX, barY, fillW, barH, 5); ctx.fill();
  }

  // Lectura grande
  const rdY = barY+barH+18;
  ctx.fillStyle = inZone ? '#2de07a' : tooHigh ? '#e23b2e' : '#c8c8d8';
  ctx.font = '900 56px ui-monospace, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(g.displayedBarra.toFixed(0), w/2, rdY);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillText('mg/L', w/2, rdY+58);
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillStyle = inZone ? '#2de07a' : tooHigh ? '#e23b2e' : '#f3c14b';
  ctx.fillText(inZone ? '✓  ZONA VÁLIDA' : tooHigh ? '▲  SOPLÁ MENOS' : '▼  SOPLÁ MÁS FUERTE', w/2, rdY+72);

  // Botones deco
  const btnY = devY+devH-28;
  ['#e23b2e','#2de07a','#f3c14b'].forEach((c,i) => {
    const bx = devX+28+i*24;
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(bx+1,btnY+1,7,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=0.45; ctx.fillStyle=c; ctx.beginPath(); ctx.arc(bx,btnY,7,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  });
  ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.font='600 7px ui-monospace,monospace';
  ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.fillText('SN: FC-2024-009', devX+devW-12, btnY);

  // ── Tubo ───────────────────────────────────────────────────────────
  const tubeW=34, tubeH=72, tubeX=w/2-17, tubeY=devY+devH;
  ctx.fillStyle='rgba(0,0,0,0.35)'; roundRect(ctx,tubeX+4,tubeY+4,tubeW,tubeH,5); ctx.fill();
  const tg = ctx.createLinearGradient(tubeX,0,tubeX+tubeW,0);
  tg.addColorStop(0,'#2e2e3e'); tg.addColorStop(0.3,'#58586e'); tg.addColorStop(0.7,'#48485a'); tg.addColorStop(1,'#22222e');
  ctx.fillStyle=tg; roundRect(ctx,tubeX,tubeY,tubeW,tubeH,5); ctx.fill();
  ctx.strokeStyle='#5a5a70'; ctx.lineWidth=1; ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=2;
  for(let i=1;i<4;i++){const ry=tubeY+(tubeH/4)*i; ctx.beginPath(); ctx.moveTo(tubeX+3,ry); ctx.lineTo(tubeX+tubeW-3,ry); ctx.stroke();}

  const capW=tubeW+14, capH=24, capX=w/2-capW/2, capY=tubeY+tubeH;
  ctx.fillStyle='#18181e'; roundRect(ctx,capX,capY,capW,capH,capH/2); ctx.fill();
  ctx.strokeStyle='#42424e'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='#0a0a10'; const ip=5;
  roundRect(ctx,capX+ip,capY+ip,capW-ip*2,capH-ip*2,(capH-ip*2)/2); ctx.fill();

  // Partículas de soplido
  if (blow > 0.05) {
    ctx.save();
    ctx.beginPath(); ctx.rect(tubeX-2,tubeY-10,tubeW+4,tubeH+14); ctx.clip();
    const n = Math.ceil(blow*6);
    for(let i=0;i<n;i++){
      const phase=((t*2.8+i*0.38)%1);
      const py=capY-phase*(tubeH+capH+10);
      const px=w/2+Math.sin(t*4+i*2.1)*(tubeW*0.22);
      const pr=2.5+blow*3;
      ctx.globalAlpha=blow*(0.9-phase)*0.75;
      ctx.fillStyle=inZone?'#2de07a':'#7ee8ff';
      ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha=1;
  }

  // Progreso zona verde
  const pgY=h*0.875, pgW=w*0.72, pgH=18, pgX=(w-pgW)/2;
  ctx.fillStyle='rgba(255,255,255,0.10)'; roundRect(ctx,pgX,pgY,pgW,pgH,9); ctx.fill();
  const pf=clamp(g.timeInZone/FASE1_REQUIRED_IN_ZONE,0,1);
  if(pf>0){
    const pgGrad=ctx.createLinearGradient(pgX,0,pgX+pgW*pf,0);
    pgGrad.addColorStop(0,'#1a7a40'); pgGrad.addColorStop(1,'#2de07a');
    ctx.fillStyle=pgGrad; roundRect(ctx,pgX,pgY,pgW*pf,pgH,9); ctx.fill();
  }
  ctx.fillStyle='#fff'; ctx.font='800 11px system-ui, sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(`${g.timeInZone.toFixed(1)}s / ${FASE1_REQUIRED_IN_ZONE.toFixed(1)}s en verde`, w/2, pgY+pgH/2);

  ctx.fillStyle = blow>0.1 ? '#2de07a' : 'rgba(255,255,255,0.65)';
  ctx.font='700 13px system-ui, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(blow>0.1 ? '🌬  SOPLANDO' : (g.micFallback?'MANTENÉ APRETADO':'SOPLÁ EL MICRÓFONO'), w/2, h*0.955);
}

// ============================================================
// FASE 2 — HACER EL 4 (giroscopio)
// ============================================================

function initFase2(stage, g) {
  g.fase2Init   = true;
  g.fase2Time   = FASE2_DURATION;
  g.balance     = BALANCE_MAX;
  g.sway        = 0;
  g.fallen      = false;
  g.fallDir     = 1;
  g.fallAngle   = 0;
  g.timeBalanced= 0;
  g.hud.label   = 'Fase 2: El 4';
}

function runFase2(dt, stage, t, g, chorsa) {
  // Animación de caída
  if (g.fallen) {
    g.fallAngle = Math.min(g.fallAngle + dt * 170, 90);
    if (g.fallAngle >= 88) {
      g.scoreFase2 = Math.round((g.timeBalanced / FASE2_DURATION) * FASE2_MAX_SCORE);
      g.done = true;
      sfx('wrong');
    }
    return;
  }

  g.fase2Time -= dt;
  g.hud.time   = g.fase2Time;

  // Inclinación real del teléfono + drift de chorsa como perturbación
  const rawTilt  = g.gyroTilt || 0;
  const drift    = g.gyroFallback ? 0 : driftOffset(chorsa, t, 13) * 16;
  g.sway         = rawTilt + drift;

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

  if (g.fase2Time <= 0) {
    g.scoreFase2 = Math.round((g.timeBalanced / FASE2_DURATION) * FASE2_MAX_SCORE);
    g.done = true;
    sfx(g.scoreFase2 > 60 ? 'park' : 'wrong');
  }
}

function renderFase2(stage, ctx, t, g) {
  const w = stage.w, h = stage.h;

  // Fondo — vereda/calle nocturna
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

  // Títulos
  ctx.fillStyle = '#fff'; ctx.font = '900 18px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PRUEBA DE EQUILIBRIO', w/2, h*0.07);
  ctx.fillStyle = '#f3c14b'; ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('Mantené el teléfono derecho', w/2, h*0.115);

  // ── Indicador de inclinación del teléfono ─────────────────────────
  const indW = 180, indH = 14, indX = (w-indW)/2, indY = h*0.15;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, indX, indY, indW, indH, indH/2); ctx.fill();

  // Zona segura
  const safeW = (TILT_SAFE/90)*indW;
  ctx.fillStyle = 'rgba(45,224,122,0.22)';
  ctx.fillRect(w/2 - safeW, indY, safeW*2, indH);

  // Línea central
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(w/2, indY-5); ctx.lineTo(w/2, indY+indH+5); ctx.stroke();

  // Marcador de inclinación actual
  const tiltFrac = clamp(g.sway / 90, -1, 1);
  const indBall  = w/2 + tiltFrac * indW/2;
  const inSafe   = Math.abs(g.sway) <= TILT_SAFE;
  ctx.fillStyle  = inSafe ? '#2de07a' : '#e23b2e';
  ctx.beginPath(); ctx.arc(indBall, indY+indH/2, indH/2+3, 0, Math.PI*2); ctx.fill();

  // ── Figura "el 4" ─────────────────────────────────────────────────
  const footX   = w / 2;
  const footY   = h * 0.765;
  const swayDeg = g.fallen
    ? g.fallDir * Math.min(g.fallAngle, 88)
    : g.sway * 1.6; // amplificar un poco para drama visual

  drawElCuatro(ctx, footX, footY, swayDeg, t);

  // ── Balance meter ──────────────────────────────────────────────────
  if (!g.fallen) {
    const balW=w*0.68, balH=16, balX=(w-balW)/2, balY=h*0.835;
    ctx.fillStyle='rgba(255,255,255,0.08)'; roundRect(ctx,balX,balY,balW,balH,balH/2); ctx.fill();
    const bf = g.balance;
    const bc = bf>0.6?'#2de07a':bf>0.3?'#f3c14b':'#e23b2e';
    ctx.fillStyle=bc; roundRect(ctx,balX,balY,balW*bf,balH,balH/2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='700 10px system-ui,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('EQUILIBRIO', w/2, balY+balH/2);

    // Pulsación de peligro
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
    // Caído
    ctx.fillStyle = '#e23b2e'; ctx.font = '900 32px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('¡TE CAÍSTE!', w/2, h*0.865);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('Con tanto alcohol no hay forma...', w/2, h*0.912);
  }
}

// Dibuja figura "hacer el 4" — pie en (footX, footY), inclinada swayDeg°
function drawElCuatro(ctx, footX, footY, swayDeg, t) {
  const swayRad = swayDeg * Math.PI / 180;

  // Medidas de la figura
  const legH     = 128; // largo de la pierna parada
  const bodyH    = 78;  // torso
  const headR    = 25;
  const shouldY  = -legH - bodyH + 12; // altura de hombros (coords locales)
  const armLen   = 55;
  const thighW   = 70;  // extensión horizontal del muslo levantado
  const thighRY  = 6;   // el muslo sube levemente desde la cadera
  const calfLen  = 76;  // largo de la pantorrilla colgante
  const lineW    = 7;

  // Los brazos se abren según el bamboleo (compensación de equilibrio)
  const swayN     = clamp(swayDeg / 28, -1, 1);
  const lArmAng   = (-38 - swayN * 28) * Math.PI / 180; // grados sobre horizontal
  const rArmAng   = (-38 + swayN * 28) * Math.PI / 180;

  ctx.save();
  ctx.translate(footX, footY);
  ctx.rotate(swayRad);

  // ── Sombra ──────────────────────────────────────────────────────
  ctx.save();
  ctx.translate(6, 6);
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#000'; ctx.lineWidth = lineW + 3;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  drawFigureLines(ctx, legH, bodyH, shouldY, armLen, lArmAng, rArmAng, thighW, thighRY, calfLen);
  ctx.restore();

  // ── Figura principal ────────────────────────────────────────────
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#eeeeff'; ctx.lineWidth = lineW;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  drawFigureLines(ctx, legH, bodyH, shouldY, armLen, lArmAng, rArmAng, thighW, thighRY, calfLen);

  // Cabeza rellena
  ctx.fillStyle = '#eeeeff';
  ctx.beginPath(); ctx.arc(0, -legH - bodyH - headR, headR, 0, Math.PI * 2); ctx.fill();

  // Pelo oscuro (gorro / flequillo)
  ctx.fillStyle = '#2a2a3e';
  ctx.beginPath(); ctx.arc(0, -legH - bodyH - headR, headR * 0.58, Math.PI, 0); ctx.fill();

  ctx.restore();
}

function drawFigureLines(ctx, legH, bodyH, shouldY, armLen, lArmAng, rArmAng, thighW, thighRY, calfLen) {
  ctx.beginPath();

  // Pierna parada (izquierda)
  ctx.moveTo(0, 0); ctx.lineTo(0, -legH);

  // Torso
  ctx.moveTo(0, -legH); ctx.lineTo(0, -legH - bodyH);

  // Brazo izquierdo
  ctx.moveTo(0, shouldY);
  ctx.lineTo(-Math.cos(lArmAng) * armLen, shouldY - Math.sin(-lArmAng) * armLen);

  // Brazo derecho
  ctx.moveTo(0, shouldY);
  ctx.lineTo(Math.cos(rArmAng) * armLen, shouldY - Math.sin(-rArmAng) * armLen);

  // Pierna levantada — muslo horizontal
  const kneeX = thighW, kneeY = -legH + thighRY;
  ctx.moveTo(0, -legH); ctx.lineTo(kneeX, kneeY);

  // Pantorrilla colgante (forma el "4")
  ctx.moveTo(kneeX, kneeY); ctx.lineTo(kneeX, kneeY + calfLen);

  ctx.stroke();
}
