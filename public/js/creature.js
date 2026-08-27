// The character renderer.
//
// Every fighter in the game — bee, doctor, virus, goblin, mosquito, robot — is
// drawn by this one function from a small declarative spec. That is the whole
// trick behind "anything vs anything": a new matchup is data, not new artwork.
//
// Local space: the origin is the ground under the fighter's feet, and the body
// is built upwards in -y. Everything is authored FACING RIGHT; render.js flips
// the attackers.

import {
  TAU, clamp, lerp, circle, ellipse, blob, roundRect, leaf,
  outline, lit, ball, glint, eye,
} from './util.js';

const DARK = '#22301c';

// ---------------------------------------------------------------- body shapes

const SHAPES = {
  blob(ctx, o, st) {
    blob(ctx, o.cx, o.cy, o.rx, o.ry, o.lobes || 7, o.wob ?? 0.045, st.seed * 6);
  },
  round(ctx, o) { circle(ctx, o.cx, o.cy, o.rx); },
  egg(ctx, o) {
    ctx.beginPath();
    ctx.moveTo(o.cx, o.cy - o.ry);
    ctx.bezierCurveTo(o.cx + o.rx * 0.9, o.cy - o.ry * 0.8, o.cx + o.rx, o.cy + o.ry * 0.55, o.cx, o.cy + o.ry);
    ctx.bezierCurveTo(o.cx - o.rx, o.cy + o.ry * 0.55, o.cx - o.rx * 0.9, o.cy - o.ry * 0.8, o.cx, o.cy - o.ry);
    ctx.closePath();
  },
  capsule(ctx, o) { roundRect(ctx, o.cx - o.rx, o.cy - o.ry, o.rx * 2, o.ry * 2, Math.min(o.rx, o.ry) * (o.round ?? 0.9)); },
  drop(ctx, o) {
    ctx.beginPath();
    ctx.moveTo(o.cx, o.cy - o.ry * 1.35);
    ctx.bezierCurveTo(o.cx + o.rx * 0.7, o.cy - o.ry * 0.3, o.cx + o.rx, o.cy + o.ry * 0.25, o.cx, o.cy + o.ry);
    ctx.bezierCurveTo(o.cx - o.rx, o.cy + o.ry * 0.25, o.cx - o.rx * 0.7, o.cy - o.ry * 0.3, o.cx, o.cy - o.ry * 1.35);
    ctx.closePath();
  },
  bell(ctx, o) {
    ctx.beginPath();
    ctx.moveTo(o.cx - o.rx, o.cy + o.ry);
    ctx.quadraticCurveTo(o.cx - o.rx * 1.05, o.cy - o.ry * 0.9, o.cx, o.cy - o.ry);
    ctx.quadraticCurveTo(o.cx + o.rx * 1.05, o.cy - o.ry * 0.9, o.cx + o.rx, o.cy + o.ry);
    ctx.quadraticCurveTo(o.cx, o.cy + o.ry * 1.3, o.cx - o.rx, o.cy + o.ry);
    ctx.closePath();
  },
  crystal(ctx, o) {
    const n = o.points || 6;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * TAU;
      const k = i % 2 ? 0.72 : 1;
      const x = o.cx + Math.cos(a) * o.rx * k;
      const y = o.cy + Math.sin(a) * o.ry * k;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  },
  cube(ctx, o) { roundRect(ctx, o.cx - o.rx, o.cy - o.ry, o.rx * 2, o.ry * 2, o.round ?? 12); },
  flask(ctx, o) {
    ctx.beginPath();
    ctx.moveTo(o.cx - o.rx * 0.32, o.cy - o.ry);
    ctx.lineTo(o.cx - o.rx * 0.32, o.cy - o.ry * 0.35);
    ctx.lineTo(o.cx - o.rx, o.cy + o.ry * 0.85);
    ctx.quadraticCurveTo(o.cx, o.cy + o.ry * 1.25, o.cx + o.rx, o.cy + o.ry * 0.85);
    ctx.lineTo(o.cx + o.rx * 0.32, o.cy - o.ry * 0.35);
    ctx.lineTo(o.cx + o.rx * 0.32, o.cy - o.ry);
    ctx.closePath();
  },
  cloud(ctx, o) {
    ctx.beginPath();
    const pts = [[-0.72, 0.18, 0.5], [-0.3, -0.35, 0.62], [0.28, -0.3, 0.58], [0.72, 0.16, 0.48], [0, 0.3, 0.6]];
    for (const [dx, dy, r] of pts) ctx.arc(o.cx + dx * o.rx, o.cy + dy * o.ry, r * o.rx, 0, TAU);
    ctx.closePath();
  },
  worm(ctx, o) {
    ctx.beginPath();
    const seg = o.segs || 4;
    for (let i = 0; i < seg; i++) {
      const y = o.cy + o.ry - (o.ry * 2 / seg) * (i + 0.5);
      ctx.arc(o.cx + Math.sin(i * 1.4) * o.rx * 0.16, y, o.rx * (1 - i * 0.06), 0, TAU);
    }
    ctx.closePath();
  },
};

function paintBody(ctx, o, st) {
  (SHAPES[o.shape] || SHAPES.blob)(ctx, o, st);
  if (o.grad === 'flat') { ctx.fillStyle = o.fill[0]; ctx.fill(); }
  else if (o.grad === 'lit') lit(ctx, o.cy - o.ry, o.cy + o.ry, o.fill[0], o.fill[1]);
  else ball(ctx, o.cx - o.rx * 0.15, o.cy - o.ry * 0.25, Math.max(o.rx, o.ry) * 1.05, o.fill[0], o.fill[1]);
  outline(ctx, o.line ?? 5, o.stroke || DARK);
}

// -------------------------------------------------------------------- parts

const PARTS = {

  aura(ctx, o, st) {
    const pulse = 0.6 + Math.sin(st.t * (o.hz || 3) + st.seed * 6) * 0.4;
    ctx.save();
    ctx.globalAlpha = (o.a ?? 0.3) * pulse;
    const g = ctx.createRadialGradient(o.x || 0, o.y || -60, 4, o.x || 0, o.y || -60, o.r || 80);
    g.addColorStop(0, o.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    circle(ctx, o.x || 0, o.y || -60, o.r || 80);
    ctx.fill();
    ctx.restore();
  },

  wings(ctx, o, st) {
    const flap = Math.sin(st.t * (o.hz || 26) + st.seed * 4);
    const n = o.n || 2;
    for (let i = 0; i < n; i++) {
      const back = i === 0;
      ctx.save();
      ctx.translate((o.x || -6) + i * 8, (o.y || -78) + i * 6);
      ctx.rotate((o.tilt ?? -0.5) + flap * (back ? 0.42 : 0.32));
      ctx.globalAlpha = o.a ?? 0.65;
      if (o.style === 'feather') {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-o.len * 0.5, -o.len * 0.42, -o.len, -o.len * 0.1);
        ctx.quadraticCurveTo(-o.len * 0.55, o.len * 0.28, 0, 0);
        ctx.closePath();
        lit(ctx, -o.len * 0.4, o.len * 0.2, o.fill[0], o.fill[1]);
        outline(ctx, 4, o.stroke || DARK);
      } else {
        ellipse(ctx, -o.len * 0.5, -o.len * 0.1, o.len * 0.5, o.len * (o.thin ?? 0.2), -0.25);
        const g = ctx.createLinearGradient(-o.len, 0, 0, 0);
        g.addColorStop(0, o.fill[0]);
        g.addColorStop(1, o.fill[1]);
        ctx.fillStyle = g;
        ctx.fill();
        outline(ctx, 3.4, o.stroke || 'rgba(40,60,80,.55)');
        ctx.globalAlpha = (o.a ?? 0.65) * 0.5;
        for (let k = 1; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(-o.len * 0.92, -o.len * 0.1);
          ctx.lineTo(-o.len * 0.1, -o.len * 0.1 + (k - 2) * o.len * 0.09);
          outline(ctx, 1.8, o.stroke || 'rgba(40,60,80,.5)');
        }
      }
      ctx.restore();
    }
  },

  legs(ctx, o, st) {
    const swing = st.still ? 0 : Math.sin(st.walk * TAU);
    const style = o.style || 'stubs';
    const c = o.fill || ['#4a5a72', '#333f52'];
    const sk = o.stroke || DARK;
    if (style === 'insect') {
      for (let i = 0; i < 3; i++) {
        for (const side of [-1, 1]) {
          const ph = swing * (i % 2 ? -1 : 1) * side;
          ctx.save();
          ctx.translate((o.x || 0) + (i - 1) * (o.spread || 14), o.y || -34);
          ctx.rotate(side * (0.5 + i * 0.28) + ph * 0.22);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(o.len * 0.5, o.len * 0.35, o.len * 0.42, o.len);
          outline(ctx, o.w || 5, c[1]);
          ctx.restore();
        }
      }
      return;
    }
    if (style === 'roots') {
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.translate(o.x || 0, o.y || -12);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(i * 16, 6, i * 30, 12);
        outline(ctx, o.w || 7, c[1]);
        ctx.restore();
      }
      return;
    }
    if (style === 'wheels') {
      for (const side of [-1, 1]) {
        circle(ctx, (o.x || 0) + side * (o.spread || 18), (o.y || -18), o.len || 18);
        ball(ctx, (o.x || 0) + side * (o.spread || 18), o.y || -18, o.len || 18, c[0], c[1]);
        outline(ctx, 4.5, sk);
        ctx.save();
        ctx.translate((o.x || 0) + side * (o.spread || 18), o.y || -18);
        ctx.rotate(st.walk * TAU);
        for (let k = 0; k < 4; k++) {
          ctx.rotate(TAU / 4);
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(0, -(o.len || 18) * 0.7);
          outline(ctx, 3, sk);
        }
        ctx.restore();
      }
      return;
    }
    if (style === 'float') return;
    // stubs / human
    const len = o.len || (style === 'human' ? 38 : 22);
    for (const side of [1, -1]) {
      ctx.save();
      ctx.translate((o.x || 0) + side * (o.spread || 8), o.y || -34);
      ctx.rotate(swing * side * (o.amp ?? 0.5));
      roundRect(ctx, -(o.w || 8) / 2 - 3, 0, (o.w || 8) + 6, len, 8);
      lit(ctx, 0, len, c[0], c[1]);
      outline(ctx, 4.5, sk);
      if (o.foot !== false) {
        roundRect(ctx, -(o.w || 8) - 3, len - 8, (o.w || 8) * 2 + 8, 13, 6);
        lit(ctx, len - 8, len + 5, o.footFill?.[0] || '#5b4630', o.footFill?.[1] || '#3b2c1c');
        outline(ctx, 4.5, sk);
      }
      ctx.restore();
    }
  },

  arms(ctx, o, st) {
    const style = o.style || 'human';
    const reach = o.reach ?? 1;
    const act = st.act || 0;
    const c = o.fill || ['#9fd07a', '#5d8f42'];
    const sk = o.stroke || DARK;
    const n = o.n ?? 2;
    for (let i = 0; i < n; i++) {
      const side = o.both ? (i ? 1 : -1) : 1;
      ctx.save();
      ctx.translate((o.x || 0) + i * (o.stagger ?? 8) * side, (o.y || -78) + i * 5);
      const base = o.angle ?? -1.45;
      ctx.rotate(base * side + Math.sin(st.walk * TAU + i) * 0.06 - act * 0.5 * side);
      const len = (o.len || 44) * reach;
      if (style === 'noodle') {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(len * 0.3, len * 0.55, len * 0.1, len);
        outline(ctx, o.w || 9, c[1]);
      } else {
        roundRect(ctx, -(o.w || 8), 0, (o.w || 8) * 2, len, 8);
        lit(ctx, 0, len, c[0], c[1]);
        outline(ctx, 4.5, sk);
      }
      const hx = style === 'noodle' ? len * 0.1 : 0;
      if (o.hand === 'claw') {
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(hx, len);
          ctx.quadraticCurveTo(hx + k * 9, len + 12, hx + k * 13, len + 20);
          outline(ctx, 4.5, c[1]);
        }
      } else if (o.hand === 'mitt') {
        circle(ctx, hx, len + 8, (o.w || 8) * 1.9);
        ball(ctx, hx, len + 8, (o.w || 8) * 1.9, o.mitt?.[0] || c[0], o.mitt?.[1] || c[1]);
        outline(ctx, 4.5, sk);
      } else if (o.hand !== 'none') {
        circle(ctx, hx, len + 6, (o.w || 8) * 1.35);
        ball(ctx, hx, len + 6, (o.w || 8) * 1.35, c[0], c[1]);
        outline(ctx, 4.5, sk);
      }
      ctx.restore();
    }
  },

  tendrils(ctx, o, st) {
    const n = o.n || 5;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * (o.arc ?? 2.4);
      const wig = Math.sin(st.t * 3 + i * 1.7 + st.seed * 5) * (o.wig ?? 8);
      ctx.save();
      ctx.translate(o.x || 0, o.y || -60);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(wig, -(o.len || 30) * 0.6, wig * 0.5, -(o.len || 30));
      outline(ctx, o.w || 5, o.color || '#7a3fb0');
      if (o.tip) { circle(ctx, wig * 0.5, -(o.len || 30), o.w || 5); ctx.fillStyle = o.tip; ctx.fill(); }
      ctx.restore();
    }
  },

  spikes(ctx, o) {
    const n = o.n || 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const cx = (o.x || 0) + Math.cos(a) * (o.rx || 34);
      const cy = (o.y || -60) + Math.sin(a) * (o.ry || 34);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-(o.w || 8), 0);
      ctx.lineTo(0, -(o.len || 16));
      ctx.lineTo(o.w || 8, 0);
      ctx.closePath();
      ctx.fillStyle = o.color || '#c94f4f';
      ctx.fill();
      outline(ctx, 3.4, o.stroke || DARK);
      ctx.restore();
    }
  },

  antennae(ctx, o, st) {
    const wig = Math.sin(st.t * 2.6 + st.seed * 4) * 0.12;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate((o.x || 0) + side * (o.spread || 10), o.y || -96);
      ctx.rotate(side * (o.tilt ?? 0.5) + wig * side);
      if (o.style === 'horn') {
        ctx.beginPath();
        ctx.moveTo(-6, 0); ctx.lineTo(0, -(o.len || 24)); ctx.lineTo(6, 0);
        ctx.closePath();
        lit(ctx, -(o.len || 24), 0, o.color || '#d8d2c4', o.color2 || '#9b9484');
        outline(ctx, 3.6, o.stroke || DARK);
      } else {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(side * 6, -(o.len || 26) * 0.7, side * (o.style === 'coil' ? 2 : 12), -(o.len || 26));
        outline(ctx, o.w || 4.5, o.color || DARK);
        circle(ctx, side * (o.style === 'coil' ? 2 : 12), -(o.len || 26), o.tipR || 6);
        ctx.fillStyle = o.tip || '#f7d94a';
        ctx.fill();
        outline(ctx, 3, o.stroke || DARK);
      }
      ctx.restore();
    }
  },

  eyes(ctx, o, st) {
    const n = o.n ?? 2;
    const r = o.r || 9;
    const lookX = o.lookX ?? 0.35;
    const open = (o.style === 'sleepy' ? 0.55 : 1) * (st.blink ?? 1);
    if (o.style === 'compound') {
      for (let i = 0; i < n; i++) {
        const x = (o.x || 0) + (n === 1 ? 0 : (i - (n - 1) / 2) * (o.gap || 22));
        ellipse(ctx, x, o.y || -74, r, r * 1.2, -0.2);
        ball(ctx, x, (o.y || -74) - r * 0.3, r * 1.3, o.fill?.[0] || '#4a2b1a', o.fill?.[1] || '#20110a');
        outline(ctx, 3.6, o.stroke || DARK);
        glint(ctx, x - r * 0.35, (o.y || -74) - r * 0.5, r * 0.4, r * 0.25, -0.5, 0.75);
      }
      return;
    }
    if (o.style === 'visor') {
      roundRect(ctx, (o.x || 0) - (o.w || 34), (o.y || -76) - (o.h || 11), (o.w || 34) * 2, (o.h || 11) * 2, o.h || 11);
      const g = ctx.createLinearGradient(0, (o.y || -76) - 12, 0, (o.y || -76) + 12);
      g.addColorStop(0, o.fill?.[0] || '#8ff0ff');
      g.addColorStop(1, o.fill?.[1] || '#1f7fa8');
      ctx.fillStyle = g;
      ctx.fill();
      outline(ctx, 4.5, o.stroke || DARK);
      ctx.save();
      ctx.globalAlpha = 0.55;
      circle(ctx, (o.x || 0) + (o.w || 34) * 0.4, (o.y || -76) - 2, 5);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.restore();
      return;
    }
    for (let i = 0; i < n; i++) {
      const x = (o.x || 0) + (n === 1 ? 0 : (i - (n - 1) / 2) * (o.gap || 24));
      const y = (o.y || -74) + (o.stagger ? (i % 2) * o.stagger : 0);
      eye(ctx, x, y, r, lookX, o.lookY ?? 0.1, open, o.white || '#ffffff');
      if (o.style === 'angry') {
        ctx.beginPath();
        ctx.moveTo(x - r * 1.15, y - r * 1.5);
        ctx.lineTo(x + r * 0.8, y - r * 0.75);
        outline(ctx, r * 0.45, o.brow || DARK);
      }
      if (o.style === 'goggles') {
        circle(ctx, x, y, r * 1.5);
        outline(ctx, 5, o.brow || '#4a5a72');
      }
    }
  },

  mouth(ctx, o, st) {
    const x = o.x || 0;
    const y = o.y || -52;
    const w = o.w || 13;
    const open = clamp((st.act || 0) * (o.reactive ?? 1), 0, 1);
    const sk = o.stroke || DARK;
    switch (o.style) {
      case 'grin':
        ctx.beginPath();
        ctx.moveTo(x - w, y - 3);
        ctx.quadraticCurveTo(x, y + w * 1.15 + open * 8, x + w, y - 3);
        ctx.closePath();
        ctx.fillStyle = o.fill || '#5b1f2a';
        ctx.fill();
        outline(ctx, 4, sk);
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * w * 0.55, y - 2);
          ctx.lineTo(x + i * w * 0.55 + w * 0.2, y + w * 0.42);
          ctx.lineTo(x + i * w * 0.55 + w * 0.42, y - 2);
          ctx.closePath();
          ctx.fillStyle = '#fff6e8';
          ctx.fill();
        }
        break;
      case 'fangs':
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.quadraticCurveTo(x, y + w * 0.8, x + w, y);
        outline(ctx, 4, sk);
        for (const s of [-0.5, 0.5]) {
          ctx.beginPath();
          ctx.moveTo(x + s * w - 4, y + 2);
          ctx.lineTo(x + s * w, y + 13);
          ctx.lineTo(x + s * w + 4, y + 2);
          ctx.closePath();
          ctx.fillStyle = '#fff6e8';
          ctx.fill();
          outline(ctx, 2.4, sk);
        }
        break;
      case 'maw': {
        const g = 10 + open * 26;
        ctx.beginPath();
        ctx.ellipse(x, y + g * 0.25, w * 1.25, g, 0, 0, TAU);
        ctx.fillStyle = o.fill || '#4a1020';
        ctx.fill();
        outline(ctx, 4.5, sk);
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * w * 0.42, y + g * 0.25 - g * 0.9);
          ctx.lineTo(x + i * w * 0.42 + w * 0.18, y + g * 0.25 - g * 0.45);
          ctx.lineTo(x + i * w * 0.42 + w * 0.36, y + g * 0.25 - g * 0.9);
          ctx.closePath();
          ctx.fillStyle = '#fff6e8';
          ctx.fill();
        }
        break;
      }
      case 'beak':
        ctx.beginPath();
        ctx.moveTo(x - w * 0.4, y - w * 0.5);
        ctx.lineTo(x + w * 1.6, y - open * 4);
        ctx.lineTo(x - w * 0.4, y + w * 0.5 + open * 6);
        ctx.closePath();
        lit(ctx, y - w, y + w, o.fill || '#f4b942', o.fill2 || '#c88a1c');
        outline(ctx, 4, sk);
        break;
      case 'flat':
        ctx.beginPath();
        ctx.moveTo(x - w, y); ctx.lineTo(x + w, y);
        outline(ctx, 4, sk);
        break;
      case 'oh':
        ellipse(ctx, x, y, w * 0.55, w * 0.7);
        ctx.fillStyle = o.fill || '#5b1f2a';
        ctx.fill();
        outline(ctx, 3.6, sk);
        break;
      case 'frown':
        ctx.beginPath();
        ctx.arc(x, y + w, w, -Math.PI + 0.3, -0.3);
        outline(ctx, 4, sk);
        break;
      default: // smile
        ctx.beginPath();
        ctx.arc(x, y - w * 0.3, w, 0.25, Math.PI - 0.25);
        outline(ctx, 4, sk);
    }
  },

  emitter(ctx, o, st) {
    const rec = (st.fire || 0) * 10;
    const x = (o.x || 30) - rec;
    const y = o.y || -70;
    const s = o.s || 1;
    const c = o.fill || ['#84e35c', '#3f8f27'];
    const sk = o.stroke || DARK;
    ctx.save();
    switch (o.style) {
      case 'stinger':
        ctx.beginPath();
        ctx.moveTo(x - 10 * s, y - 12 * s);
        ctx.lineTo(x + 40 * s, y);
        ctx.lineTo(x - 10 * s, y + 12 * s);
        ctx.closePath();
        lit(ctx, y - 12 * s, y + 12 * s, c[0], c[1]);
        outline(ctx, 4.5, sk);
        break;
      case 'syringe':
        roundRect(ctx, x - 26 * s, y - 11 * s, 44 * s, 22 * s, 6 * s);
        lit(ctx, y - 11 * s, y + 11 * s, '#eaf6ff', '#a9c6d8');
        outline(ctx, 4.5, sk);
        roundRect(ctx, x - 20 * s, y - 6 * s, 26 * s, 12 * s, 4 * s);
        ctx.fillStyle = o.fluid || '#63d2a8';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 18 * s, y);
        ctx.lineTo(x + 44 * s, y);
        outline(ctx, 4 * s, '#c8d6de');
        break;
      case 'nozzle':
        roundRect(ctx, x - 22 * s, y - 15 * s, 40 * s, 30 * s, 8 * s);
        lit(ctx, y - 15 * s, y + 15 * s, c[0], c[1]);
        outline(ctx, 5, sk);
        roundRect(ctx, x + 12 * s, y - 9 * s, 20 * s, 18 * s, 6 * s);
        lit(ctx, y - 9 * s, y + 9 * s, '#cfd8de', '#8b98a4');
        outline(ctx, 4.5, sk);
        break;
      case 'cannon':
        roundRect(ctx, x - 26 * s, y - 18 * s, 52 * s, 36 * s, 10 * s);
        lit(ctx, y - 18 * s, y + 18 * s, c[0], c[1]);
        outline(ctx, 5, sk);
        ellipse(ctx, x + 26 * s, y, 8 * s, 16 * s);
        ctx.fillStyle = '#20262e';
        ctx.fill();
        outline(ctx, 4, sk);
        break;
      case 'wand':
        ctx.beginPath();
        ctx.moveTo(x - 24 * s, y + 14 * s);
        ctx.lineTo(x + 26 * s, y - 16 * s);
        outline(ctx, 7 * s, o.shaft || '#8b6238');
        circle(ctx, x + 28 * s, y - 18 * s, 9 * s);
        ctx.fillStyle = o.gem || '#8fd9ff';
        ctx.fill();
        outline(ctx, 3.6, sk);
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(st.t * 5) * 0.3;
        circle(ctx, x + 28 * s, y - 18 * s, 15 * s);
        ctx.fillStyle = o.gem || '#8fd9ff';
        ctx.fill();
        ctx.restore();
        break;
      case 'straw':
        ctx.beginPath();
        ctx.moveTo(x - 16 * s, y);
        ctx.lineTo(x + 40 * s, y);
        outline(ctx, 9 * s, c[1]);
        ctx.beginPath();
        ctx.moveTo(x - 16 * s, y);
        ctx.lineTo(x + 40 * s, y);
        outline(ctx, 4 * s, c[0]);
        break;
      case 'horn':
        ctx.beginPath();
        ctx.moveTo(x - 20 * s, y - 10 * s);
        ctx.lineTo(x + 34 * s, y - 22 * s);
        ctx.lineTo(x + 34 * s, y + 22 * s);
        ctx.lineTo(x - 20 * s, y + 10 * s);
        ctx.closePath();
        lit(ctx, y - 22 * s, y + 22 * s, c[0], c[1]);
        outline(ctx, 5, sk);
        break;
      default: { // snout
        ctx.beginPath();
        ctx.moveTo(x - 26 * s, y - 22 * s);
        ctx.quadraticCurveTo(x + 4 * s, y - 30 * s, x + 30 * s, y - 20 * s);
        ctx.lineTo(x + 30 * s, y + 20 * s);
        ctx.quadraticCurveTo(x + 4 * s, y + 30 * s, x - 26 * s, y + 22 * s);
        ctx.closePath();
        ball(ctx, x - 4 * s, y - 6 * s, 34 * s, c[0], c[1]);
        outline(ctx, 5, sk);
        ellipse(ctx, x + 29 * s, y, 7 * s, 19 * s);
        ctx.fillStyle = '#20300f';
        ctx.fill();
      }
    }
    ctx.restore();
  },

  hat(ctx, o, st) {
    const x = o.x || 0;
    const y = o.y || -104;
    const sk = o.stroke || DARK;
    switch (o.style) {
      case 'hardhat':
        ctx.beginPath();
        ctx.arc(x, y, o.r || 30, Math.PI, TAU);
        ctx.lineTo(x + (o.r || 30) + 8, y + 4);
        ctx.lineTo(x - (o.r || 30) - 8, y + 4);
        ctx.closePath();
        lit(ctx, y - (o.r || 30), y + 4, o.fill?.[0] || '#ffd23f', o.fill?.[1] || '#d99a12');
        outline(ctx, 5, sk);
        ctx.beginPath();
        ctx.moveTo(x, y - (o.r || 30)); ctx.lineTo(x, y + 2);
        outline(ctx, 4, 'rgba(0,0,0,.2)');
        break;
      case 'cap':
        ctx.beginPath();
        ctx.arc(x, y, o.r || 28, Math.PI, TAU);
        ctx.closePath();
        lit(ctx, y - (o.r || 28), y, o.fill?.[0] || '#4f7fd8', o.fill?.[1] || '#2d539c');
        outline(ctx, 5, sk);
        roundRect(ctx, x + 6, y - 6, (o.r || 28) + 16, 10, 5);
        ctx.fillStyle = o.fill?.[1] || '#2d539c';
        ctx.fill();
        outline(ctx, 4.5, sk);
        break;
      case 'chef':
        roundRect(ctx, x - 22, y - 14, 44, 22, 6);
        ctx.fillStyle = '#f6f3ea';
        ctx.fill();
        outline(ctx, 4.5, sk);
        for (let i = -1; i <= 1; i++) { circle(ctx, x + i * 15, y - 24, 15); }
        ctx.fillStyle = '#fbf9f2';
        ctx.fill();
        outline(ctx, 4.5, sk);
        break;
      case 'crown':
        ctx.beginPath();
        ctx.moveTo(x - 26, y + 8);
        ctx.lineTo(x - 26, y - 14);
        ctx.lineTo(x - 13, y - 2);
        ctx.lineTo(x, y - 22);
        ctx.lineTo(x + 13, y - 2);
        ctx.lineTo(x + 26, y - 14);
        ctx.lineTo(x + 26, y + 8);
        ctx.closePath();
        lit(ctx, y - 22, y + 8, '#ffd85c', '#d19b18');
        outline(ctx, 4.5, '#7d5a0c');
        break;
      case 'helm':
        ctx.beginPath();
        ctx.arc(x, y + 2, o.r || 30, Math.PI * 0.98, TAU + 0.04);
        ctx.lineTo(x + (o.r || 30), y + 16);
        ctx.lineTo(x - (o.r || 30), y + 16);
        ctx.closePath();
        lit(ctx, y - (o.r || 30), y + 16, o.fill?.[0] || '#c9d4dc', o.fill?.[1] || '#7c868c');
        outline(ctx, 5, sk);
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 30); ctx.lineTo(x - 3, y + 16);
        outline(ctx, 5, '#5e6a72');
        break;
      case 'mask':
        roundRect(ctx, x - 24, y + 22, 48, 26, 10);
        ctx.fillStyle = o.fill?.[0] || '#cfe8f7';
        ctx.fill();
        outline(ctx, 4.5, sk);
        ctx.beginPath();
        ctx.moveTo(x - 24, y + 28); ctx.lineTo(x - 38, y + 20);
        ctx.moveTo(x + 24, y + 28); ctx.lineTo(x + 38, y + 20);
        outline(ctx, 3.4, sk);
        break;
      case 'band':
        roundRect(ctx, x - 30, y - 6, 60, 14, 6);
        ctx.fillStyle = o.fill?.[0] || '#e34a4a';
        ctx.fill();
        outline(ctx, 4.5, sk);
        break;
      case 'halo':
        ctx.save();
        ctx.globalAlpha = 0.85;
        ellipse(ctx, x, y - 18, 26, 8);
        outline(ctx, 6, o.fill?.[0] || '#ffe98a');
        ctx.restore();
        break;
      case 'stetho':
        ctx.beginPath();
        ctx.moveTo(x - 20, y + 30);
        ctx.quadraticCurveTo(x - 30, y + 62, x - 6, y + 70);
        outline(ctx, 5, '#2b3946');
        ctx.beginPath();
        ctx.moveTo(x + 20, y + 30);
        ctx.quadraticCurveTo(x + 32, y + 58, x + 16, y + 74);
        outline(ctx, 5, '#2b3946');
        circle(ctx, x + 14, y + 78, 9);
        lit(ctx, y + 68, y + 88, '#d8dee4', '#98a2ab');
        outline(ctx, 4, '#2b3946');
        break;
      default:
        break;
    }
  },

  /** Damage-tracked head armour. `dmg` 0..1 comes from the sim. */
  armor(ctx, o, st) {
    const dmg = st.armorDmg ?? 0;
    const x = o.x || 0;
    const y = o.y || -112;
    if (o.style === 'shellA') {
      ctx.beginPath();
      ctx.moveTo(x - 28, y + 8);
      ctx.lineTo(x, y - 48);
      ctx.lineTo(x + 28, y + 8);
      ctx.closePath();
      lit(ctx, y - 48, y + 8, o.fill?.[0] || '#f19a3c', o.fill?.[1] || '#c46a1c');
      outline(ctx, 5, o.stroke || '#7d3d0c');
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(x - 17, y - 6); ctx.lineTo(x + 17, y - 6);
      outline(ctx, 5, '#fbe0b8');
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.moveTo(x - 29, y + 10);
      ctx.lineTo(x - 24, y - 40);
      ctx.lineTo(x + 24, y - 40);
      ctx.lineTo(x + 29, y + 10);
      ctx.closePath();
      lit(ctx, y - 40, y + 10, o.fill?.[0] || '#c9d4dc', o.fill?.[1] || '#8b98a4');
      outline(ctx, 5, o.stroke || '#4a545e');
      roundRect(ctx, x - 27, y - 47, 54, 11, 5);
      ctx.fillStyle = o.fill?.[0] || '#aab6c1';
      ctx.fill();
      outline(ctx, 4.5, o.stroke || '#4a545e');
    }
    if (dmg > 0.35) {
      ctx.save();
      ctx.globalAlpha = clamp((dmg - 0.35) * 1.8, 0, 1);
      ctx.beginPath();
      ctx.moveTo(x - 14, y + 6); ctx.lineTo(x - 4, y - 16); ctx.lineTo(x - 16, y - 26);
      outline(ctx, 4, o.stroke || '#5c6873');
      ctx.restore();
    }
  },

  /** Front-carried shield: blocks straight shots until it breaks. */
  shield(ctx, o, st) {
    const dmg = st.shieldDmg ?? 0;
    ctx.save();
    ctx.translate(o.x ?? 44, o.y ?? -92);
    ctx.rotate(o.tilt ?? 0.05);
    if (o.style === 'soft') {
      roundRect(ctx, -22, -34, 46, 70, 4);
      lit(ctx, -34, 36, o.fill?.[0] || '#f2ead4', o.fill?.[1] || '#cfc4a6');
      outline(ctx, 4.5, o.stroke || '#6d6349');
      ctx.save();
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(-15, -24 + i * 9); ctx.lineTo(15, -24 + i * 9);
        outline(ctx, 2.4, o.stroke || '#8a7f63');
      }
      ctx.restore();
    } else if (o.style === 'round') {
      circle(ctx, 0, 0, 42);
      ball(ctx, -8, -10, 44, o.fill?.[0] || '#b7bfc4', o.fill?.[1] || '#7c868c');
      outline(ctx, 5, o.stroke || '#414a4f');
      circle(ctx, 0, 0, 14);
      ctx.fillStyle = o.boss || '#e0c56a';
      ctx.fill();
      outline(ctx, 4, o.stroke || '#414a4f');
    } else {
      roundRect(ctx, -26, -40, 52, 84, 6);
      lit(ctx, -40, 44, o.fill?.[0] || '#b7bfc4', o.fill?.[1] || '#7c868c');
      outline(ctx, 5, o.stroke || '#414a4f');
      roundRect(ctx, -18, -32, 36, 68, 4);
      ctx.fillStyle = 'rgba(210,235,240,.35)';
      ctx.fill();
      outline(ctx, 3.4, '#5c676d');
    }
    if (dmg > 0.4) {
      ctx.save();
      ctx.globalAlpha = clamp((dmg - 0.4) * 2, 0, 1);
      ctx.beginPath();
      ctx.moveTo(-14, -30); ctx.lineTo(2, -6); ctx.lineTo(-10, 8); ctx.lineTo(6, 30);
      outline(ctx, 3.6, o.stroke || '#404a50');
      ctx.restore();
    }
    ctx.restore();
  },

  /** Something held behind the body: a banner, a pole, a club. */
  carry(ctx, o, st) {
    ctx.save();
    ctx.translate(o.x ?? -24, o.y ?? -96);
    ctx.rotate((o.tilt ?? 0.2) + Math.sin(st.t * 2) * 0.04 - (st.act || 0) * 1.3);
    if (o.style === 'banner') {
      ctx.beginPath();
      ctx.moveTo(0, 44); ctx.lineTo(0, -62);
      outline(ctx, 6, o.pole || '#6b5637');
      const wv = Math.sin(st.t * 4);
      ctx.beginPath();
      ctx.moveTo(0, -58);
      ctx.quadraticCurveTo(-24, -50 + wv * 6, -48, -58 - wv * 5);
      ctx.lineTo(-48, -26 - wv * 5);
      ctx.quadraticCurveTo(-24, -18 + wv * 6, 0, -26);
      ctx.closePath();
      lit(ctx, -58, -20, o.fill?.[0] || '#e34a4a', o.fill?.[1] || '#a92626');
      outline(ctx, 4.5, o.stroke || '#6d1717');
    } else if (o.style === 'pole') {
      ctx.beginPath();
      ctx.moveTo(0, -70); ctx.lineTo(0, 76);
      outline(ctx, 7, o.fill?.[0] || '#c9b48a');
    } else if (o.style === 'club') {
      roundRect(ctx, -14, -10, 28, 84, 9);
      lit(ctx, -10, 74, o.fill?.[0] || '#a97c48', o.fill?.[1] || '#6a4a26');
      outline(ctx, 5.5, o.stroke || '#3a2612');
      for (let i = 0; i < 3; i++) {
        circle(ctx, -5 + (i % 2) * 9, 12 + i * 20, 4);
        ctx.fillStyle = '#4a3018';
        ctx.fill();
      }
    } else if (o.style === 'pack') {
      roundRect(ctx, -6, -20, 34, 50, 8);
      lit(ctx, -20, 30, o.fill?.[0] || '#5c6b3f', o.fill?.[1] || '#3d482a');
      outline(ctx, 4.5, o.stroke || DARK);
    }
    ctx.restore();
  },

  /** Idle flame / smoke / sparkle sitting on the body. */
  flame(ctx, o, st) {
    const x = o.x || 0;
    const y = o.y || -100;
    for (let i = 0; i < 3; i++) {
      const ph = st.t * 6 + i * 2.1 + st.seed * 3;
      const h = (o.h || 42) + Math.sin(ph) * 12 + i * 4;
      const wob = Math.sin(ph * 1.4) * 6;
      ctx.beginPath();
      ctx.moveTo(x - 18 + i * 8, y);
      ctx.quadraticCurveTo(x - 26 + i * 9 + wob, y - h * 0.6, x - 4 + i * 6 + wob, y - h);
      ctx.quadraticCurveTo(x + 12 + i * 5 + wob, y - h * 0.55, x + 16 + i * 6, y);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, y - h, 0, y);
      g.addColorStop(0, o.hot || (i === 2 ? '#fff2b0' : '#ffd25e'));
      g.addColorStop(1, o.cool || (i === 2 ? '#ff9c2e' : '#f4571f'));
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.9 - i * 0.12;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  },

  /** Petals / fins / leaves radiating from a point. */
  petals(ctx, o, st) {
    const n = o.n || 12;
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.translate(o.x || 0, o.y || -80);
      ctx.rotate((i / n) * TAU + Math.sin(st.t * 1.2 + st.seed) * 0.05);
      ctx.beginPath();
      ctx.ellipse(o.r || 40, 0, (o.len || 24), (o.w || 12), 0, 0, TAU);
      const g = ctx.createLinearGradient((o.r || 40) - (o.len || 24), 0, (o.r || 40) + (o.len || 24), 0);
      g.addColorStop(0, o.fill?.[0] || '#ffcf35');
      g.addColorStop(1, o.fill?.[1] || '#ffe98a');
      ctx.fillStyle = g;
      ctx.fill();
      outline(ctx, 4, o.stroke || '#a5691a');
      ctx.restore();
    }
  },

  leaves(ctx, o, st) {
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate((o.x || 0) + dir * 6, o.y || -8);
      ctx.rotate(dir * (0.45 + Math.sin(st.t * 1.7 + st.seed * 5 + dir) * 0.05));
      ctx.scale(dir, 1);
      leaf(ctx, 0, 0, o.len || 46, o.w || 24);
      lit(ctx, -(o.len || 46) * 0.4, 10, o.fill?.[0] || '#6fce4e', o.fill?.[1] || '#4a9c2f');
      outline(ctx, 4.5, o.stroke || DARK);
      ctx.restore();
    }
  },

  stem(ctx, o, st) {
    const bend = Math.sin(st.t * 1.6 + st.seed * 7) * (o.sway ?? 0.05);
    const y = o.y || 0;
    const h = o.h || 60;
    const w = o.w || 9;
    ctx.beginPath();
    ctx.moveTo(-w, y);
    ctx.quadraticCurveTo(-w + bend * 26, y - h * 0.55, -w + 2 + bend * 44, y - h);
    ctx.lineTo(w - 2 + bend * 44, y - h);
    ctx.quadraticCurveTo(w + bend * 26, y - h * 0.55, w, y);
    ctx.closePath();
    lit(ctx, y - h, y, o.fill?.[0] || '#6bc44a', o.fill?.[1] || '#43902c');
    outline(ctx, 4.5, o.stroke || DARK);
  },

  /** Surface decoration on the body. */
  marks(ctx, o, st) {
    ctx.save();
    ctx.globalAlpha = o.a ?? 0.5;
    const x = o.x || 0;
    const y = o.y || -60;
    if (o.style === 'stripes') {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * (o.gap || 16) - (o.w || 22), y - (o.h || 22));
        ctx.quadraticCurveTo(x + i * (o.gap || 16), y, x + i * (o.gap || 16) - (o.w || 22), y + (o.h || 22));
        outline(ctx, o.thick || 11, o.color || '#20262e');
      }
    } else if (o.style === 'spots') {
      for (let i = 0; i < (o.n || 6); i++) {
        const a = i * 2.4 + st.seed * 3;
        circle(ctx, x + Math.cos(a) * (o.rx || 22), y + Math.sin(a) * (o.ry || 20), o.r || 6);
        ctx.fillStyle = o.color || '#20262e';
        ctx.fill();
      }
    } else if (o.style === 'cross') {
      roundRect(ctx, x - (o.w || 6), y - (o.h || 18), (o.w || 6) * 2, (o.h || 18) * 2, 3);
      ctx.fillStyle = o.color || '#e0413c';
      ctx.fill();
      roundRect(ctx, x - (o.h || 18), y - (o.w || 6), (o.h || 18) * 2, (o.w || 6) * 2, 3);
      ctx.fill();
    } else if (o.style === 'panel') {
      roundRect(ctx, x - (o.w || 20), y - (o.h || 14), (o.w || 20) * 2, (o.h || 14) * 2, 6);
      ctx.fillStyle = o.color || 'rgba(20,30,40,.5)';
      ctx.fill();
      ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i++) {
        circle(ctx, x - (o.w || 20) + 10 + i * 14, y, 4);
        ctx.fillStyle = ['#6de08a', '#ffd23f', '#ff6a5a'][i];
        ctx.fill();
      }
    } else if (o.style === 'rings') {
      for (let i = 1; i <= (o.n || 3); i++) {
        ellipse(ctx, x, y, (o.rx || 26) * (i / (o.n || 3)), (o.ry || 26) * (i / (o.n || 3)));
        outline(ctx, 3, o.color || 'rgba(0,0,0,.3)');
      }
    }
    ctx.restore();
  },

  glowSpot(ctx, o, st) {
    const pulse = 0.5 + Math.sin(st.t * (o.hz || 5) + st.seed * 4) * 0.5;
    circle(ctx, o.x || 0, o.y || -60, (o.r || 8));
    ctx.fillStyle = o.color || '#ff5a3c';
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
    outline(ctx, 3, o.stroke || DARK);
  },
};

// ---------------------------------------------------------------- interpreter

/**
 * @param spec  { body, parts:[], scale, bob }
 * @param st    { t, walk, fire, act, blink, seed, still, armorDmg, shieldDmg }
 */
export function drawCreature(ctx, spec, st) {
  const s = st || {};
  s.t ??= 0; s.walk ??= 0; s.fire ??= 0; s.act ??= 0; s.blink ??= 1; s.seed ??= 0.4;
  ctx.save();
  if (spec.scale && spec.scale !== 1) ctx.scale(spec.scale, spec.scale);
  const bob = spec.bob === false ? 0 : Math.sin(s.walk * TAU * 2) * (spec.bobAmp ?? 3);
  ctx.translate(0, bob + (spec.y || 0));

  for (const part of spec.back || []) PARTS[part.p]?.(ctx, part, s);
  if (spec.body) paintBody(ctx, spec.body, s);
  for (const part of spec.parts || []) {
    if (part.when === 'armor' && (s.armorDmg ?? 1) >= 1) continue;
    if (part.when === 'shield' && (s.shieldDmg ?? 1) >= 1) continue;
    if (part.when === 'rage' && !s.rage) continue;
    if (part.when === 'calm' && s.rage) continue;
    PARTS[part.p]?.(ctx, part, s);
  }
  ctx.restore();
}

/** Rough bounding height, used to centre a fighter inside a card. */
export function creatureHeight(spec) {
  return (spec.h || 130) * (spec.scale || 1);
}

export { PARTS };
