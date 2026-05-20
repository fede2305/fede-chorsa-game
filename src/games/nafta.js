// Carga nafta: manten apretado para llenar el tanque, solta cerca del 100%
// sin pasarte demasiado. El puntaje es simetrico: 95% = 105%.
// Chorsa: la barra se llena mas rapido y vibra.
// La barra desborda visualmente cuando superas el 100%.

import { makeGame, clamp } from './base.js';
import { drawCarSide } from '../engine/sprites.js';
import { sfx } from '../engine/audio.js';

const ROUNDS = 5;

export function createNafta(chorsaLevel) {
  return makeGame(chorsaLevel, {
    setup(stage, chorsa, g) {
      g.round = 0;
      g.fillSpeed = 32 + chorsa.colorWarp * 70 + (chorsa.speedMult - 1) * 50;
      g.jitter = chorsa.drift * 14;
      g.hud.hint = 'Manten apretado para cargar. Soltá cerca del 100% — un poco de más también está bien.';
      g.graceScore = 15;
      g.pump = []; // animated pump particles
      g.lastPumpT = 0;
      g.tutoFlash = 0;
      startRound(g);
    },

    step(dt, stage, t, g) {
      if (g.locked) {
        g.lockT -= dt;
        if (g.lockT <= 0) {
          if (g.round >= ROUNDS) g.done = true;
          else startRound(g);
        }
        // update particles even while locked
        for (const p of g.pump) { p.x += p.vx * dt; p.y += p.vy * dt; p.a -= dt * 2.2; }
        g.pump = g.pump.filter((p) => p.a > 0);
        return;
      }

      if (stage.pointer.down) {
        g.fill += g.fillSpeed * dt;
        // spawn pump particles while holding
        g.lastPumpT -= dt;
        if (g.lastPumpT <= 0) {
          g.lastPumpT = 0.08;
          sfx('pump');
          // particle flows from pump nozzle toward car fuel cap
          const capX = stage.w * 0.285;
          const capY = stage.h * 0.475;
          g.pump.push({
            x: stage.w * 0.72 + (Math.random() - 0.5) * 12,
            y: stage.h * 0.46 + (Math.random() - 0.5) * 8,
            vx: (capX - stage.w * 0.72) * 1.4,
            vy: (capY - stage.h * 0.46) * 1.4,
            a: 0.9,
            r: 3 + Math.random() * 3,
          });
        }
        if (g.fill > 122) {
          g.fill = 122;
          g.spill = true;
          finishRound(g, 0);
        }
      } else {
        // drain particles when not holding
        for (const p of g.pump) { p.x += p.vx * dt; p.y += p.vy * dt; p.a -= dt * 3; }
        g.pump = g.pump.filter((p) => p.a > 0);
        if (g.fill > 1 && stage.pointer.justUp) {
          if (g.fill < 20) {
            // Intento no consumido — resetear y mostrar tutorial
            g.fill = 0;
            g.pump = [];
            g.tutoFlash = 2.8;
          } else {
            const dist = Math.abs(g.fill - 100);
            const pts = Math.max(0, Math.round(100 - dist * 4));
            if (pts > 0) sfx('score');
            finishRound(g, pts);
          }
        }
        if (g.tutoFlash > 0) g.tutoFlash -= dt;
      }
    },

    render(stage, ctx, t, g) {
      const w = stage.w;
      const h = stage.h;
      ctx.fillStyle = '#13131c';
      ctx.fillRect(0, 0, w, h);

      // ── CAR (slightly animated when filling) ──────────────────────────────
      const fillBounce = stage.pointer?.down && !g.locked
        ? Math.sin(t * 18) * (g.fill / 200) * 3
        : 0;
      drawCarSide(ctx, w * 0.36, h * 0.5 + fillBounce, w * 0.54, h * 0.25, '#e23b2e');

      // ── PUMP PARTICLES ────────────────────────────────────────────────────
      for (const p of g.pump) {
        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.fillStyle = '#f5c518';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── PUMP NOZZLE LINE when holding ────────────────────────────────────
      if (stage.pointer?.down && !g.locked && g.fill < 122) {
        const capX = w * 0.285;
        const capY = h * 0.475;
        const pumpX = w * 0.74;
        const pumpY = h * 0.46;
        ctx.save();
        ctx.strokeStyle = 'rgba(245,197,24,0.45)';
        ctx.lineWidth = 5;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -(t * 80) % 14;
        ctx.beginPath();
        ctx.moveTo(pumpX, pumpY);
        ctx.bezierCurveTo(pumpX - 40, pumpY + 30, capX + 40, capY - 20, capX, capY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ── TANK BAR ──────────────────────────────────────────────────────────
      const bx = w * 0.70;
      const bw = w * 0.22;
      const by = h * 0.16;
      const bh = h * 0.62;

      // container background
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by, bw, bh);

      // green target zone (90–100%)
      ctx.fillStyle = 'rgba(46,164,79,0.28)';
      ctx.fillRect(bx, by, bw, bh * 0.1);

      // fill bar — extends above container when >100%
      const jit = g.locked ? 0 : (Math.random() - 0.5) * g.jitter;
      const fillFrac = clamp(g.fill, 0, 122) / 100;
      const barH = bh * fillFrac + jit;
      const barTopY = by + bh - barH;

      // inside-container portion
      let barColor = g.fill > 112 ? '#e23b2e' : g.fill > 100 ? '#f5a623' : '#f3c14b';
      const insideTop = Math.max(by, barTopY);
      const insideH = by + bh - insideTop;
      if (insideH > 0) {
        ctx.fillStyle = barColor;
        ctx.fillRect(bx, insideTop, bw, insideH);
      }

      // overflow portion (above container = >100%) - drawn wider like a spill
      if (barTopY < by) {
        const spillH = by - Math.max(0, barTopY);
        ctx.fillStyle = '#e23b2e';
        ctx.fillRect(bx - 3, Math.max(0, barTopY), bw + 6, spillH);
        // drip drops
        const dropCount = Math.floor(g.fill - 100);
        for (let i = 0; i < Math.min(dropCount, 6); i++) {
          const dx = bx + (i * 11) % bw;
          const dy = by + (t * 60 + i * 22) % (h * 0.15);
          ctx.fillStyle = `rgba(226,59,46,${0.5 - i * 0.07})`;
          ctx.beginPath();
          ctx.arc(dx + bw * 0.3, dy, 3 + i * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);

      // 100% line
      ctx.strokeStyle = '#2ea44f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bx - 10, by);
      ctx.lineTo(bx + bw + 10, by);
      ctx.stroke();

      // 110% line (above container)
      const y110 = by - bh * 0.1;
      if (y110 > 0) {
        ctx.strokeStyle = 'rgba(245,166,35,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(bx - 4, y110);
        ctx.lineTo(bx + bw + 4, y110);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.lineWidth = 1;

      // percentage label
      ctx.fillStyle = g.fill > 112 ? '#e23b2e' : g.fill > 90 && g.fill <= 110 ? '#2ea44f' : '#fff';
      ctx.font = '900 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 6;
      ctx.fillText(`${Math.round(g.fill)}%`, bx + bw / 2, by + bh + 36);
      ctx.shadowBlur = 0;

      if (g.locked) {
        ctx.font = '900 30px system-ui, sans-serif';
        ctx.fillStyle = g.spill ? '#e23b2e' : '#2ea44f';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;
        ctx.fillText(g.spill ? '¡SE DERRAMÓ!' : `+${g.lastPts}`, w / 2, h * 0.9);
        ctx.shadowBlur = 0;
      } else if (g.tutoFlash > 0) {
        // Recordatorio prominente cuando suelta antes del 20%
        const a = Math.min(1, g.tutoFlash / 0.4);
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(226,59,46,0.18)';
        ctx.fillRect(0, h * 0.82, w, h * 0.18);
        ctx.globalAlpha = 1;
        ctx.font = '900 20px system-ui, sans-serif';
        ctx.fillStyle = '#e23b2e';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 8;
        ctx.fillText('¡Mantené APRETADO!', w / 2, h * 0.885);
        ctx.shadowBlur = 0;
        ctx.font = '700 14px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText('No sueltes hasta llegar cerca del 100%', w / 2, h * 0.93);
      } else {
        ctx.font = '800 18px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('mantené apretado... soltá cerca del 100%', w / 2, h * 0.9);
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(200,200,200,0.65)';
        ctx.fillText('(pasarte un poco también suma)', w / 2, h * 0.94);
      }
      ctx.textAlign = 'left';
    },
  });
}

function startRound(g) {
  g.round++;
  g.fill = 0;
  g.locked = false;
  g.spill = false;
  g.lastPts = 0;
  g.pump = [];
  g.hud.label = `Tanque ${g.round}/${ROUNDS}`;
}

function finishRound(g, pts) {
  g.lastPts = pts;
  g.score += pts;
  g.locked = true;
  g.lockT = 1.1;
}
