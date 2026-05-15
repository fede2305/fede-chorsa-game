// Stage: canvas + loop + input tactil. Corre un minijuego y devuelve el puntaje.
//
// RESOLUCION FIJA 9:16: todo minijuego dibuja en un lienzo logico de
// 450 x 800 (9:16). El canvas se escala para entrar en la pantalla con
// barras (letterbox) si hace falta. Asi todos los juegos se ven igual en
// cualquier celular.
//
// Contrato de un minijuego (ver src/games/*.js):
//   - update(dt, stage, t)   : avanza la logica. dt en segundos, t = tiempo total.
//   - draw(stage, ctx, t)    : dibuja en coords logicas (0..450, 0..800).
//   - done  (bool)           : true cuando termino.
//   - score (number)         : puntaje final cuando done = true.
//
// stage expone:
//   - stage.w = 450, stage.h = 800  (siempre, coords logicas)
//   - stage.pointer = { x, y, down, justDown, justUp }  (en coords logicas, con input-lag)
//   - stage.chorsa  = params del nivel de chorsa actual

import { getChorsa } from '../chorsa.js';
import { Effects } from './effects.js';

export const LOGICAL_W = 450;
export const LOGICAL_H = 800;

export class Stage {
  constructor(parent) {
    this.parent = parent;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = LOGICAL_W;
    this.h = LOGICAL_H;
    this.canvas.width = Math.round(LOGICAL_W * this.dpr);
    this.canvas.height = Math.round(LOGICAL_H * this.dpr);
    this._scale = 1; // px de pantalla por unidad logica

    this.pointer = { x: 0, y: 0, down: false, justDown: false, justUp: false };
    this._raw = { x: 0, y: 0, down: false };
    this._destroyed = false;
    this._raf = 0;

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._bindInput();
    this._resize();
  }

  _resize() {
    const rect = this.parent.getBoundingClientRect();
    const cw = rect.width || window.innerWidth;
    const ch = rect.height || window.innerHeight;
    const scale = Math.min(cw / LOGICAL_W, ch / LOGICAL_H);
    const dispW = LOGICAL_W * scale;
    const dispH = LOGICAL_H * scale;
    this._scale = scale;
    this.canvas.style.width = dispW + 'px';
    this.canvas.style.height = dispH + 'px';
    this.canvas.style.left = (cw - dispW) / 2 + 'px';
    this.canvas.style.top = (ch - dispH) / 2 + 'px';
  }

  _bindInput() {
    const posOf = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / this._scale,
        y: (e.clientY - rect.top) / this._scale,
      };
    };
    this._onDown = (e) => {
      e.preventDefault();
      const p = posOf(e);
      this._raw.x = p.x;
      this._raw.y = p.y;
      this._raw.down = true;
    };
    this._onMove = (e) => {
      const p = posOf(e);
      this._raw.x = p.x;
      this._raw.y = p.y;
    };
    this._onUp = () => {
      this._raw.down = false;
    };
    this.canvas.addEventListener('pointerdown', this._onDown);
    this.canvas.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
  }

  run(game, chorsaLevel) {
    this.chorsa = getChorsa(chorsaLevel);
    this.effects = new Effects(this.chorsa);
    this.canvas.style.filter = this.chorsa.blur
      ? `blur(${this.chorsa.blur}px)`
      : 'none';

    return new Promise((resolve) => {
      let last = performance.now();
      let t = 0;
      const snaps = [];

      const step = (now) => {
        if (this._destroyed) return;
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.05) dt = 0.05;
        t += dt;

        // Buffer de input para aplicar el lag del modo chorsa.
        snaps.push({ time: now, x: this._raw.x, y: this._raw.y, down: this._raw.down });
        const lag = this.chorsa.inputLagMs;
        while (snaps.length > 2 && now - snaps[0].time > lag + 200) snaps.shift();
        let sampled = snaps[snaps.length - 1];
        if (lag > 0) {
          for (let i = snaps.length - 1; i >= 0; i--) {
            if (now - snaps[i].time >= lag) {
              sampled = snaps[i];
              break;
            }
          }
        }
        const prevDown = this.pointer.down;
        this.pointer.x = sampled.x;
        this.pointer.y = sampled.y;
        this.pointer.down = sampled.down;
        this.pointer.justDown = sampled.down && !prevDown;
        this.pointer.justUp = !sampled.down && prevDown;

        game.update(dt, this, t);

        const ctx = this.ctx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
        ctx.save();
        this.effects.preDraw(ctx, LOGICAL_W, LOGICAL_H, t);
        game.draw(this, ctx, t);
        ctx.restore();
        this.effects.postDraw(ctx, LOGICAL_W, LOGICAL_H, t);

        if (game.done) {
          resolve(Math.max(0, Math.round(game.score || 0)));
          return;
        }
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
    });
  }

  destroy() {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resize);
    this.canvas.removeEventListener('pointerdown', this._onDown);
    this.canvas.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
    this.canvas.remove();
  }
}
