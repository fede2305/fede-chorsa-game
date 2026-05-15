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
  };
  g.update = (dt, stage, t) => {
    if (!g._ready) {
      impl.setup(stage, chorsa, g);
      g._ready = true;
    }
    if (g.done) return;
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
      g.done = false;
      g.score = 0;
      g.playT = 0;
      g._ready = false; // se re-inicializa en el proximo frame
      g._graceFlash = 1.7;
    }
  };
  g.draw = (stage, ctx, t) => {
    if (!g._ready) return;
    impl.render(stage, ctx, t, g);
    drawHud(stage, ctx, g);
    if (!g._started) drawStartPrompt(stage, ctx, t);
    else if (g._graceFlash > 0) drawGraceFlash(stage, ctx, g);
  };
  return g;
}

function drawHud(stage, ctx, g) {
  ctx.save();
  ctx.font = '900 30px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  // chip de puntaje
  const txt = String(g.score);
  ctx.font = '900 30px system-ui, sans-serif';
  const tw = ctx.measureText(txt).width;
  roundRectPath(ctx, 14, 14, tw + 28, 42, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.fillStyle = '#16161c';
  ctx.fillText(txt, 28, 19);

  if (g.hud.label) {
    ctx.font = '800 14px system-ui, sans-serif';
    const lw = ctx.measureText(g.hud.label).width;
    roundRectPath(ctx, 14, 62, lw + 22, 26, 9);
    ctx.fillStyle = 'rgba(20,20,28,0.6)';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(g.hud.label, 25, 68);
  }

  if (g.hud.time != null) {
    ctx.font = '900 30px system-ui, sans-serif';
    const tt = Math.max(0, g.hud.time).toFixed(1);
    const ttw = ctx.measureText(tt).width;
    roundRectPath(ctx, stage.w - ttw - 42, 14, ttw + 28, 42, 12);
    ctx.fillStyle = g.hud.time < 3 ? 'rgba(232,73,58,0.95)' : 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.fillStyle = g.hud.time < 3 ? '#fff' : '#16161c';
    ctx.fillText(tt, stage.w - ttw - 28, 19);
  }
  ctx.restore();
}

function drawStartPrompt(stage, ctx, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(12,14,22,0.55)';
  ctx.fillRect(0, 0, stage.w, stage.h);
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = '900 40px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 12;
  ctx.globalAlpha = 0.7 + 0.3 * pulse;
  ctx.fillText('TOCA PARA', stage.w / 2, stage.h / 2 - 28);
  ctx.fillText('ARRANCAR', stage.w / 2, stage.h / 2 + 24);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('tomate tu tiempo, no corre hasta que toques', stage.w / 2, stage.h / 2 + 70);
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
