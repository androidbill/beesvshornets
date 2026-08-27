// Small maths / drawing helpers shared by every module.
// Everything here is pure and stateless so the art files stay readable.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
export const rndInt = (a, b) => Math.floor(rnd(b + 1, a));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const chance = (p) => Math.random() < p;
export const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Easing
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
export const easeOutElastic = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
export const wobble = (t, hz = 1) => Math.sin(t * TAU * hz);

// ---------------------------------------------------------------- shapes

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

export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU);
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.abs(r), 0, TAU);
}

/** A wobbling organic blob — the base shape for most of the plant bodies. */
export function blob(ctx, x, y, rx, ry, lobes = 7, amp = 0.06, phase = 0) {
  ctx.beginPath();
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU;
    const k = 1 + Math.sin(a * lobes + phase) * amp;
    const px = x + Math.cos(a) * rx * k;
    const py = y + Math.sin(a) * ry * k;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/** A pointed leaf lying along +x, hinged at (x, y). */
export function leaf(ctx, x, y, len, wide, bend = 0.35) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + len * 0.5, y - wide, x + len, y - len * bend * 0.25);
  ctx.quadraticCurveTo(x + len * 0.5, y + wide * 0.55, x, y);
  ctx.closePath();
}

// ---------------------------------------------------------------- paint

export function outline(ctx, w = 5, color = '#1b2a16') {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Fill the current path with a top-lit vertical gradient. */
export function lit(ctx, y0, y1, top, bottom) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fill();
}

/** Radial "ball" shading — cheap volume for round bodies. */
export function ball(ctx, x, y, r, top, bottom) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.15);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fill();
}

export function groundShadow(ctx, x, y, rx, ry, alpha = 0.22) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#0d1a08';
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
  ctx.restore();
}

export function glint(ctx, x, y, rx, ry, rot = -0.5, alpha = 0.5) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, x, y, rx, ry, rot);
  ctx.fill();
  ctx.restore();
}

/** Cartoon eye with a pupil that can look around and blink. */
export function eye(ctx, x, y, r, lookX = 0, lookY = 0, open = 1, white = '#ffffff') {
  if (open < 0.12) {
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    outline(ctx, r * 0.5, '#1b2a16');
    return;
  }
  ctx.save();
  ellipse(ctx, x, y, r, r * open);
  ctx.fillStyle = white;
  ctx.fill();
  outline(ctx, r * 0.34, '#1b2a16');
  ctx.clip();
  circle(ctx, x + lookX * r * 0.42, y + lookY * r * 0.42, r * 0.5);
  ctx.fillStyle = '#15200f';
  ctx.fill();
  circle(ctx, x + lookX * r * 0.42 - r * 0.16, y + lookY * r * 0.42 - r * 0.2, r * 0.16);
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.fill();
  ctx.restore();
}

export function text(ctx, str, x, y, {
  size = 30, weight = 800, align = 'center', base = 'middle',
  fill = '#fff', stroke = null, sw = 6, font = 'Baloo2, Nunito, system-ui, sans-serif',
  alpha = 1, shadow = 0,
} = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillText(str, x, y + shadow);
  }
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = sw;
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/** Deterministic value noise — used for grass speckle and dirt. */
export function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
