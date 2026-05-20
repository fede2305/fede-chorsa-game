// Base comun de los minijuegos.
//
// Un minijuego se define con un "impl":
//   setup(stage, chorsa, g)        -> inicializa estado (g es el objeto del juego)
//   step(dt, stage, t, g)          -> avanza la logica; setea g.score y g.done
//   render(stage, ctx, t, g)       -> dibuja
//
// g expone: g.score, g.done, g.chorsa, g.playT (segundos desde que arranco),
//           g.hud.time (opcional, muestra timer), g.hud.label (opcional).
//
// PERIODO DE GRACIA: el juego queda congelado mostrando "TOCA PARA ARRANCAR"
// hasta el primer toque. Recien ahi corre impl.step (y ese primer toque
// tambien le llega al juego). Asi nadie pierde un intento sin haber jugado.

import { getChorsa } from '../chorsa.js';
import { sfx } from '../engine/audio.js';

export function makeGame(chorsaLevel, impl) {
  const chorsa = getChorsa(chorsaLevel);
  const g = {
    chorsa,
    score: 0,
    done: false,
    playT: 0,
    // Periodo de gracia por puntaje: mientras score < graceScore, si fallas
    // el intento NO se pierde -> reinicio silencioso. Sirve para aprender el
    // juego sin que los primeros segundos malos te arruinen el intento.
    // Lo setea cada minijuego en su setup (0 = sin gracia).
    graceScore: 0,
    hud: { time: null, label: null },
    _ready: false,
    _started: false,
    _graceFlash: 0,
    // Juegos async (ej: necesitan permiso de mic) setean esto a false en setup.
    // El juego no puede arrancar hasta que lo pongan en true.
    _asyncReady: true,
  };
  g.update = (dt, stage, t) => {
    if (!g._ready) {
      impl.setup(stage, chorsa, g);
      g._ready = true;
    }
    if (g.done) return;
    if (!g._asyncReady) {
      impl.asyncStep?.(dt, stage, t, g);
      return;
    }
    if (!g._started) {
      // El primer toque SOLO arranca el juego (no cuenta como jugada).
      // Asi nadie pierde un intento sin haberse dado cuenta que empezo.
      if (stage.pointer.justDown) g._started = true;
      return;
    }
    if (g._graceFlash > 0) g._graceFlash -= dt;
    g.playT += dt;
    impl.step(dt, stage, t, g);
    // Gracia por puntaje: fallaste antes de graceScore -> no cuenta, va de nuevo.
    if (g.done && g.score < g.graceScore) {
      sfx('score'); // confirmación suave de que fue gracia, no penalidad
      g.done = false;
      g.score = 0;
      g.playT = 0;
      g._ready = false; // se re-inicializa en el proximo frame
      g._graceFlash = 1.7;
    }
    // Si el juego terminó de verdad (no fue grace), llamar cleanup opcional.
    if (g.done) impl.cleanup?.(stage, g);
  };
  g.draw = (stage, ctx, t) => {
    if (!g._ready) return;
    impl.render(stage, ctx, t, g);
    drawHud(stage, ctx, t, g);
    if (!g._asyncReady) {
      impl.renderPreStart?.(stage, ctx, t, g);
    } else if (!g._started) {
      drawStartPrompt(stage, ctx, t, g);
    } else if (g._graceFlash > 0) {
      drawGraceFlash(stage, ctx, g);
    }
  };
  return g;
}

function drawHud(stage, ctx, t, g) {
  ctx.save();
  ctx.textBaseline = 'top';

  // ── chip de puntaje (arriba-izquierda) ─────────────────────────────────
  const txt = String(g.score);
  ctx.font = '900 42px system-ui, sans-serif';
  const tw = ctx.measureText(txt).width;
  roundRectPath(ctx, 12, 12, tw + 32, 56, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#16161c';
  ctx.fillText(txt, 28, 19);

  // ── label (chip oscuro debajo) ─────────────────────────────────────────
  if (g.hud.label) {
    ctx.font = '800 18px system-ui, sans-serif';
    const lw = ctx.measureText(g.hud.label).width;
    roundRectPath(ctx, 12, 76, lw + 26, 32, 10);
    ctx.fillStyle = 'rgba(20,20,28,0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(243,193,75,0.32)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(g.hud.label, 25, 83);
  }

  // ── timer (arriba-derecha) ─────────────────────────────────────────────
  if (g.hud.time != null) {
    const tt = Math.max(0, g.hud.time).toFixed(1);
    ctx.font = '900 42px system-ui, sans-serif';
    const ttw = ctx.measureText(tt).width;
    const urgent = g.hud.time < 3;
    if (urgent) {
      // pulsación visible
      ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(t * 7));
    }
    roundRectPath(ctx, stage.w - ttw - 44, 12, ttw + 32, 56, 14);
    ctx.fillStyle = urgent ? 'rgba(226,59,46,0.96)' : 'rgba(255,255,255,0.94)';
    ctx.shadowColor = urgent ? 'rgba(226,59,46,0.55)' : 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = urgent ? 14 : 8;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = urgent ? '#fff' : '#16161c';
    ctx.fillText(tt, stage.w - ttw - 28, 19);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawStartPrompt(stage, ctx, t, g) {
  ctx.save();
  const w = stage.w;
  const h = stage.h;

  // dim overlay
  ctx.fillStyle = 'rgba(10,11,20,0.82)';
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // ── INSTRUCTION CARD (center of screen) ──────────────────────────────────
  const hint = g.hud.hint;
  if (hint) {
    const lines = wrapText(hint, 26);
    const lineH = 30;
    const padV = 22;
    const padH = 28;
    const cardW = w * 0.86;
    const cardH = lines.length * lineH + padV * 2 + 46; // 46 = title bar
    const cardX = (w - cardW) / 2;
    const cardY = h * 0.5 - cardH / 2 - 50; // above center

    // card background
    ctx.fillStyle = 'rgba(22,23,36,0.97)';
    roundRectPath(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fill();
    // accent border
    ctx.strokeStyle = 'rgba(243,193,75,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // "COMO JUGAR" header
    ctx.fillStyle = '#f3c14b';
    ctx.font = '900 13px system-ui, sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText('CÓMO JUGAR', w / 2, cardY + 20);
    ctx.letterSpacing = '0px';

    // divider
    ctx.strokeStyle = 'rgba(243,193,75,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 16, cardY + 36);
    ctx.lineTo(cardX + cardW - 16, cardY + 36);
    ctx.stroke();

    // hint lines
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 19px system-ui, sans-serif';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], w / 2, cardY + 36 + padV + lineH / 2 + i * lineH);
    }
  }

  // ── TOCA PARA ARRANCAR ───────────────────────────────────────────────────
  const pulse = 0.65 + 0.35 * Math.sin(t * 4);
  const tapY = hint ? h * 0.5 + 100 : h * 0.5;

  // pill background
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#e23b2e';
  roundRectPath(ctx, w * 0.5 - 160, tapY - 40, 320, 80, 40);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#fff';
  ctx.font = '900 32px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 10;
  ctx.fillText('TOCÁ PARA EMPEZAR', w / 2, tapY);
  ctx.shadowBlur = 0;

  // mini-icono debajo (pulgar)
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4);
  ctx.fillText('👆', w / 2, tapY + 50);
  ctx.globalAlpha = 1;

  ctx.font = '500 14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('el juego no corre hasta que toques', w / 2, tapY + 88);

  ctx.restore();
}

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawGraceFlash(stage, ctx, g) {
  ctx.save();
  const a = Math.min(1, g._graceFlash / 1.7);
  ctx.fillStyle = `rgba(20,200,80,${0.22 * a})`;
  ctx.fillRect(0, 0, stage.w, stage.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = a;
  ctx.fillStyle = '#2de07a';
  ctx.font = '900 38px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 12;
  ctx.fillText('¡CASI! Seguí intentando', stage.w / 2, stage.h / 2);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Helpers comunes.
export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, k) {
  return a + (b - a) * k;
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}

// Curva de dificultad: arranca en 1 y crece suave con el tiempo de juego.
// Para los juegos infinitos (runner, jumper, birras).
export function rampFactor(playT, ratePerSec = 0.06, max = 3.2) {
  return Math.min(max, 1 + playT * ratePerSec);
}

// Fondo de ruta nocturna scrolleable con bordes y textura simple.
export function drawRoad(ctx, w, h, offset, lanes = 3) {
  // pasto / vereda a los costados
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#3a3f2e');
  grad.addColorStop(1, '#2b2f22');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // asfalto
  const roadX = w * 0.07;
  const roadW = w * 0.86;
  const asph = ctx.createLinearGradient(roadX, 0, roadX + roadW, 0);
  asph.addColorStop(0, '#34343c');
  asph.addColorStop(0.5, '#3d3d46');
  asph.addColorStop(1, '#34343c');
  ctx.fillStyle = asph;
  ctx.fillRect(roadX, 0, roadW, h);

  // cordon
  ctx.fillStyle = '#c9c9cf';
  ctx.fillRect(roadX - 5, 0, 5, h);
  ctx.fillRect(roadX + roadW, 0, 5, h);

  // lineas de carril punteadas
  ctx.strokeStyle = 'rgba(243,225,160,0.85)';
  ctx.lineWidth = 5;
  ctx.setLineDash([34, 30]);
  ctx.lineDashOffset = -offset;
  for (let i = 1; i < lanes; i++) {
    const x = roadX + (roadW * i) / lanes;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}
