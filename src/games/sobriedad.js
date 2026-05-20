// Control de alcoholemia: soplá el micrófono y mantené la barra en zona verde.

import { makeGame, clamp } from './base.js';
import { roundRect } from '../engine/sprites.js';
import { sfx } from '../engine/audio.js';

const DURATION         = 10.0;
const MILESTONE        = 2.4;  // primer hito visual; no termina el juego
const SCORE_PER_SEC    = 22;   // puntos por segundo en zona verde (máx teórico: 220)

const MIC_THRESHOLD = 4;
const MIC_FULL      = 22;

export function createSobriedad(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      stopMic(g);

      g.noShake = true;

      g.barra          = 0;
      g.displayedBarra = 0;
      g.targetMin      = 60;
      g.targetMax      = 82;
      g.fase1Time      = DURATION;
      g.timeInZone     = 0;
      g.lastInZone     = false;
      g.milestone      = false; // primer hito alcanzado

      g.graceScore     = 15;
      g.hud.hint       = `Soplá el micrófono y mantená la barra en zona VERDE los ${DURATION}s. Más tiempo en verde = más puntos.`;
      g.hud.label      = 'Alcoholímetro';

      g.micState          = 'requesting';
      g.micVolume         = 0;
      g.micStream         = null;
      g.micAudioCtx       = null;
      g.micAnalyser       = null;
      g.micBuffer         = null;
      g.micFallback       = false;
      g._micStreamPending = false;

      g._asyncReady = false;

      if (!navigator.mediaDevices?.getUserMedia) {
        g.micState    = 'granted';
        g.micFallback = true;
        g._asyncReady = true;
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
          g._asyncReady       = true;
        })
        .catch(() => {
          g.micState = 'denied';
        });
    },

    renderPreStart(stage, ctx, t, g) {
      drawMicScreen(stage, ctx, t, g);
    },

    step(dt, stage, t, g) {
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

      g.fase1Time -= dt;
      g.hud.time   = g.fase1Time;

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
        if (!g.milestone && g.timeInZone >= MILESTONE) {
          g.milestone = true;
          sfx('score'); // feedback del primer hito
        }
      }
      g.lastInZone = inZone;

      // Puntuación continua: acumula mientras está en verde
      g.score = Math.round(g.timeInZone * SCORE_PER_SEC);

      if (g.fase1Time <= 0) {
        sfx(g.score > 30 ? 'score' : 'wrong');
        g.done = true;
      }
    },

    cleanup(stage, g) {
      stopMic(g);
    },

    render(stage, ctx, t, g) {
      renderAlcoholimetro(stage, ctx, t, g);
    },
  });
}

function stopMic(g) {
  if (g.micStream) {
    g.micStream.getTracks().forEach(tr => tr.stop());
    g.micStream = null;
  }
  if (g.micAudioCtx) { g.micAudioCtx.close(); g.micAudioCtx = null; }
  g.micAnalyser = null;
}

// ── Pantalla de permiso ────────────────────────────────────────────────────

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

// ── Render ─────────────────────────────────────────────────────────────────

function renderAlcoholimetro(stage, ctx, t, g) {
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

  // Barra de progreso continua: llena al tener DURATION segundos en verde
  const pgY=h*0.875, pgW=w*0.72, pgH=18, pgX=(w-pgW)/2;
  ctx.fillStyle='rgba(255,255,255,0.10)'; roundRect(ctx,pgX,pgY,pgW,pgH,9); ctx.fill();
  const pf=clamp(g.timeInZone/DURATION,0,1);
  if(pf>0){
    const pgGrad=ctx.createLinearGradient(pgX,0,pgX+pgW*pf,0);
    pgGrad.addColorStop(0,'#1a7a40'); pgGrad.addColorStop(1,'#2de07a');
    ctx.fillStyle=pgGrad; roundRect(ctx,pgX,pgY,pgW*pf,pgH,9); ctx.fill();
  }
  // Marca del primer hito
  const milestoneX = pgX + (MILESTONE/DURATION)*pgW;
  ctx.strokeStyle = g.milestone ? '#f3c14b' : 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(milestoneX, pgY-3); ctx.lineTo(milestoneX, pgY+pgH+3); ctx.stroke();

  ctx.fillStyle='#fff'; ctx.font='800 11px system-ui, sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const pts = Math.round(g.timeInZone * SCORE_PER_SEC);
  ctx.fillText(`${g.timeInZone.toFixed(1)}s en verde  ·  ${pts} pts`, w/2, pgY+pgH/2);

  ctx.fillStyle = blow>0.1 ? '#2de07a' : 'rgba(255,255,255,0.65)';
  ctx.font='700 13px system-ui, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(blow>0.1 ? '🌬  SOPLANDO' : (g.micFallback?'MANTENÉ APRETADO':'SOPLÁ EL MICRÓFONO'), w/2, h*0.955);
}
