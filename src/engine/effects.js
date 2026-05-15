// Efectos visuales del "modo chorsa": temblor, bamboleo, distorsion de color, vignette.
// Se aplican alrededor del draw de cada minijuego de forma uniforme.

export class Effects {
  constructor(chorsa) {
    this.c = chorsa;
  }

  // Llamar ANTES de dibujar el minijuego (dentro de un ctx.save()).
  preDraw(ctx, w, h, t) {
    const c = this.c;
    let dx = 0;
    let dy = 0;
    if (c.shake) {
      dx += (Math.random() - 0.5) * c.shake;
      dy += (Math.random() - 0.5) * c.shake;
    }
    if (c.wobbleHz) {
      dx += Math.sin(t * c.wobbleHz * Math.PI * 2) * c.shake * 0.8;
      dy += Math.cos(t * c.wobbleHz * Math.PI * 2 * 0.7) * c.shake * 0.6;
    }
    ctx.translate(dx, dy);
  }

  // Llamar DESPUES de dibujar el minijuego (fuera del save del preDraw).
  postDraw(ctx, w, h, t) {
    const c = this.c;
    if (c.colorWarp <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = c.colorWarp * 0.5;
    const hue = (Math.sin(t * 0.6) * 0.5 + 0.5) * 360;
    ctx.fillStyle = `hsl(${hue}, 90%, 55%)`;
    ctx.fillRect(-60, -60, w + 120, h + 120);
    ctx.restore();

    ctx.save();
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.25 + c.colorWarp * 0.5})`);
    ctx.fillStyle = g;
    ctx.fillRect(-60, -60, w + 120, h + 120);
    ctx.restore();
  }
}

// Deriva lateral suave y pseudo-aleatoria ("el auto se va solo").
// Devuelve un valor en ~[-1,1] escalado por chorsa.drift.
export function driftOffset(chorsa, t, seed = 0) {
  return (
    (Math.sin(t * 1.3 + seed) + Math.sin(t * 0.7 + seed * 2.1) * 0.6) * chorsa.drift
  );
}
