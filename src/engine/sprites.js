// Sprites dibujados con primitivas de canvas, con sombreado, reflejos y
// detalle, inspirados en un Chevrolet Corsa hatchback rojo (modelo ~2011):
// hatchback compacto y redondeado, faros tipo gota, llantas de aleacion.

// ---- helpers de color ----
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
// amt: -1 (negro) .. +1 (blanco)
export function shade(hex, amt) {
  let [r, g, b] = hexToRgb(hex);
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Llanta de aleacion vista de costado.
function drawAlloyWheel(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  // neumatico
  ctx.fillStyle = '#181820';
  circle(ctx, 0, 0, r);
  ctx.fillStyle = '#26262e';
  circle(ctx, 0, 0, r * 0.92);
  // llanta
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 0.72);
  g.addColorStop(0, '#f2f2f5');
  g.addColorStop(0.6, '#b9bcc4');
  g.addColorStop(1, '#7c7f88');
  ctx.fillStyle = g;
  circle(ctx, 0, 0, r * 0.72);
  // rayos
  ctx.strokeStyle = '#6c6f78';
  ctx.lineWidth = r * 0.14;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
    ctx.stroke();
  }
  // centro
  ctx.fillStyle = '#5a5d65';
  circle(ctx, 0, 0, r * 0.2);
  ctx.restore();
}

// ============================================================
//  AUTO VISTO DESDE ARRIBA  -- mira hacia ARRIBA. (x,y) = centro.
//  w = ancho del auto, h = largo del auto.
// ============================================================
export function drawCar(ctx, x, y, w, h, color = '#d62828') {
  ctx.save();
  ctx.translate(x, y);

  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.04, w * 0.58, h * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // carroceria con gradiente lateral (da volumen redondeado)
  const body = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  body.addColorStop(0, shade(color, -0.4));
  body.addColorStop(0.2, shade(color, -0.05));
  body.addColorStop(0.5, shade(color, 0.28));
  body.addColorStop(0.8, shade(color, -0.05));
  body.addColorStop(1, shade(color, -0.4));
  ctx.fillStyle = body;
  roundRect(ctx, -w / 2, -h / 2, w, h, w * 0.26);
  ctx.fill();

  // contorno suave
  ctx.strokeStyle = shade(color, -0.55);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // capot y baul: leve gradiente longitudinal
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, -w * 0.4, -h * 0.46, w * 0.8, h * 0.22, w * 0.12);
  ctx.fill();

  // vidrios (parabrisas, techo, luneta)
  ctx.fillStyle = '#1d2630';
  // parabrisas
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, -h * 0.2);
  ctx.lineTo(w * 0.3, -h * 0.2);
  ctx.lineTo(w * 0.38, -h * 0.04);
  ctx.lineTo(-w * 0.38, -h * 0.04);
  ctx.closePath();
  ctx.fill();
  // luneta trasera
  ctx.beginPath();
  ctx.moveTo(-w * 0.36, h * 0.12);
  ctx.lineTo(w * 0.36, h * 0.12);
  ctx.lineTo(w * 0.3, h * 0.26);
  ctx.lineTo(-w * 0.3, h * 0.26);
  ctx.closePath();
  ctx.fill();
  // techo
  const roof = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  roof.addColorStop(0, shade(color, -0.25));
  roof.addColorStop(0.5, shade(color, 0.45));
  roof.addColorStop(1, shade(color, -0.25));
  ctx.fillStyle = roof;
  roundRect(ctx, -w * 0.34, -h * 0.04, w * 0.68, h * 0.16, w * 0.08);
  ctx.fill();
  // ventanas laterales
  ctx.fillStyle = '#1d2630';
  ctx.fillRect(-w * 0.42, -h * 0.04, w * 0.07, h * 0.16);
  ctx.fillRect(w * 0.35, -h * 0.04, w * 0.07, h * 0.16);

  // reflejo del parabrisas
  ctx.fillStyle = 'rgba(150,190,220,0.28)';
  ctx.beginPath();
  ctx.moveTo(-w * 0.24, -h * 0.18);
  ctx.lineTo(w * 0.02, -h * 0.18);
  ctx.lineTo(-w * 0.06, -h * 0.06);
  ctx.lineTo(-w * 0.3, -h * 0.06);
  ctx.closePath();
  ctx.fill();

  // espejos
  ctx.fillStyle = shade(color, -0.15);
  roundRect(ctx, -w * 0.56, -h * 0.06, w * 0.1, h * 0.05, 2);
  ctx.fill();
  roundRect(ctx, w * 0.46, -h * 0.06, w * 0.1, h * 0.05, 2);
  ctx.fill();

  // faros delanteros
  ctx.fillStyle = '#fdf3c6';
  roundRect(ctx, -w * 0.4, -h * 0.49, w * 0.22, h * 0.07, 3);
  ctx.fill();
  roundRect(ctx, w * 0.18, -h * 0.49, w * 0.22, h * 0.07, 3);
  ctx.fill();
  // parrilla + mono
  ctx.fillStyle = '#15151a';
  ctx.fillRect(-w * 0.14, -h * 0.5, w * 0.28, h * 0.04);
  ctx.fillStyle = '#f5b301';
  roundRect(ctx, -w * 0.05, -h * 0.5, w * 0.1, h * 0.03, 2);
  ctx.fill();

  // luces traseras
  ctx.fillStyle = '#c41e1e';
  roundRect(ctx, -w * 0.42, h * 0.42, w * 0.2, h * 0.07, 3);
  ctx.fill();
  roundRect(ctx, w * 0.22, h * 0.42, w * 0.2, h * 0.07, 3);
  ctx.fill();

  // brillo especular sobre la carroceria
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  roundRect(ctx, -w * 0.16, -h * 0.46, w * 0.06, h * 0.92, w * 0.03);
  ctx.fill();

  ctx.restore();
}

// ============================================================
//  AUTO VISTO DE COSTADO -- mira a la DERECHA. (x,y) = centro.
//  w = largo del auto, h = alto total (incluye ruedas).
// ============================================================
export function drawCarSide(ctx, x, y, w, h, color = '#d62828') {
  ctx.save();
  ctx.translate(x, y);

  const rw = h * 0.23; // radio de rueda
  const wheelY = h * 0.30;
  const frontWX = w * 0.30;
  const rearWX = -w * 0.30;

  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.52, w * 0.52, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // ruedas (detras de la carroceria)
  drawAlloyWheel(ctx, rearWX, wheelY, rw);
  drawAlloyWheel(ctx, frontWX, wheelY, rw);

  // cuerpo inferior
  const body = ctx.createLinearGradient(0, -h * 0.1, 0, h * 0.35);
  body.addColorStop(0, shade(color, 0.35));
  body.addColorStop(0.45, shade(color, 0.05));
  body.addColorStop(1, shade(color, -0.4));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-w * 0.47, h * 0.06);
  ctx.lineTo(-w * 0.47, -h * 0.06);
  // techo / perfil hatchback
  ctx.lineTo(-w * 0.34, -h * 0.12);
  ctx.lineTo(-w * 0.16, -h * 0.45); // pilar trasero
  ctx.lineTo(w * 0.04, -h * 0.48); // techo
  ctx.lineTo(w * 0.16, -h * 0.12); // parabrisas
  ctx.lineTo(w * 0.30, -h * 0.14); // capot
  ctx.lineTo(w * 0.47, -h * 0.02);
  ctx.lineTo(w * 0.47, h * 0.12);
  ctx.lineTo(-w * 0.47, h * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(color, -0.55);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // arcos de rueda (recortes oscuros)
  ctx.fillStyle = '#101014';
  ctx.beginPath();
  ctx.arc(frontWX, wheelY, rw * 1.18, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rearWX, wheelY, rw * 1.18, Math.PI, 0);
  ctx.fill();
  // redibujar ruedas encima del arco
  drawAlloyWheel(ctx, rearWX, wheelY, rw);
  drawAlloyWheel(ctx, frontWX, wheelY, rw);

  // greenhouse / vidrios
  const glass = ctx.createLinearGradient(0, -h * 0.48, 0, -h * 0.1);
  glass.addColorStop(0, '#acd3e8');
  glass.addColorStop(1, '#3f5566');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, -h * 0.13);
  ctx.lineTo(-w * 0.15, -h * 0.4);
  ctx.lineTo(w * 0.03, -h * 0.42);
  ctx.lineTo(w * 0.13, -h * 0.14);
  ctx.closePath();
  ctx.fill();
  // parante central
  ctx.strokeStyle = shade(color, -0.3);
  ctx.lineWidth = w * 0.018;
  ctx.beginPath();
  ctx.moveTo(-w * 0.05, -h * 0.41);
  ctx.lineTo(-w * 0.05, -h * 0.13);
  ctx.stroke();
  // reflejo del vidrio
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(-w * 0.12, -h * 0.36);
  ctx.lineTo(-w * 0.02, -h * 0.38);
  ctx.lineTo(-w * 0.06, -h * 0.16);
  ctx.lineTo(-w * 0.16, -h * 0.16);
  ctx.closePath();
  ctx.fill();

  // linea de cintura / puerta
  ctx.strokeStyle = shade(color, -0.45);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-w * 0.45, -h * 0.06);
  ctx.lineTo(w * 0.30, -h * 0.08);
  ctx.stroke();
  // corte de puerta
  ctx.beginPath();
  ctx.moveTo(-w * 0.04, -h * 0.12);
  ctx.lineTo(-w * 0.04, h * 0.1);
  ctx.stroke();
  // manija
  ctx.fillStyle = shade(color, -0.5);
  roundRect(ctx, -w * 0.18, -h * 0.04, w * 0.1, h * 0.035, 2);
  ctx.fill();

  // brillo especular horizontal
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(ctx, -w * 0.4, -h * 0.02, w * 0.78, h * 0.02, h * 0.01);
  ctx.fill();

  // faro delantero (gota) y optica trasera
  ctx.fillStyle = '#fdf3c6';
  ctx.beginPath();
  ctx.ellipse(w * 0.42, -h * 0.04, w * 0.06, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c41e1e';
  roundRect(ctx, -w * 0.48, -h * 0.06, w * 0.05, h * 0.13, 2);
  ctx.fill();

  // espejo
  ctx.fillStyle = shade(color, -0.1);
  ctx.beginPath();
  ctx.moveTo(w * 0.13, -h * 0.14);
  ctx.lineTo(w * 0.2, -h * 0.18);
  ctx.lineTo(w * 0.2, -h * 0.1);
  ctx.closePath();
  ctx.fill();

  // paragolpes
  ctx.fillStyle = shade(color, -0.3);
  roundRect(ctx, w * 0.4, h * 0.0, w * 0.09, h * 0.12, 3);
  ctx.fill();
  roundRect(ctx, -w * 0.49, h * 0.0, w * 0.09, h * 0.12, 3);
  ctx.fill();

  ctx.restore();
}

// ---- objetos del juego ----
export function drawBeer(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  // botella
  const g = ctx.createLinearGradient(-r, 0, r, 0);
  g.addColorStop(0, '#7a5d12');
  g.addColorStop(0.5, '#caa12e');
  g.addColorStop(1, '#7a5d12');
  ctx.fillStyle = g;
  roundRect(ctx, -r * 0.5, -r * 1.1, r, r * 2.2, r * 0.3);
  ctx.fill();
  // pico
  ctx.fillStyle = '#5e480e';
  ctx.fillRect(-r * 0.18, -r * 1.5, r * 0.36, r * 0.5);
  // etiqueta
  ctx.fillStyle = '#f4e9c4';
  ctx.fillRect(-r * 0.5, -r * 0.15, r, r * 0.6);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-r * 0.5, r * 0.05, r, r * 0.16);
  // brillo
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(-r * 0.32, -r * 1.0, r * 0.14, r * 1.9);
  ctx.restore();
}

export function drawMate(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  // mate
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
  g.addColorStop(0, '#8a5a2b');
  g.addColorStop(1, '#3f2710');
  ctx.fillStyle = g;
  circle(ctx, 0, r * 0.1, r);
  // borde
  ctx.fillStyle = '#2a1908';
  circle(ctx, 0, -r * 0.6, r * 0.55);
  ctx.fillStyle = '#6b8f3a';
  circle(ctx, 0, -r * 0.6, r * 0.42);
  // bombilla
  ctx.strokeStyle = '#d9d9de';
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.moveTo(r * 0.1, -r * 0.7);
  ctx.lineTo(r * 0.8, -r * 1.5);
  ctx.stroke();
  ctx.restore();
}

export function drawCone(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  // base
  ctx.fillStyle = '#d24e0e';
  ctx.beginPath();
  ctx.ellipse(0, s, s * 0.95, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  // cuerpo
  const g = ctx.createLinearGradient(-s, 0, s, 0);
  g.addColorStop(0, '#c2440a');
  g.addColorStop(0.5, '#ff7a1a');
  g.addColorStop(1, '#c2440a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.15);
  ctx.lineTo(s * 0.7, s * 0.9);
  ctx.lineTo(-s * 0.7, s * 0.9);
  ctx.closePath();
  ctx.fill();
  // franjas reflectivas
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, -s * 0.1);
  ctx.lineTo(s * 0.42, -s * 0.1);
  ctx.lineTo(s * 0.5, s * 0.15);
  ctx.lineTo(-s * 0.5, s * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawPothole(ctx, x, y, rx, ry) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#0a0a0d';
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5a5a64';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -ry * 0.15, rx * 0.96, ry * 0.9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
