// A single flat array of particles with a handful of named emitters. Every
// visual "pop" in the game comes from here — it is most of what makes a hit
// feel like a hit.

import { TAU, rnd, circle, roundRect, outline, clamp } from './util.js';

export class Particles {
  constructor(max = 900) {
    this.list = [];
    this.max = max;
  }

  clear() { this.list.length = 0; }

  add(p) {
    if (this.list.length >= this.max) this.list.shift();
    p.life = p.life ?? 0.6;
    p.maxLife = p.life;
    p.vx = p.vx ?? 0;
    p.vy = p.vy ?? 0;
    p.g = p.g ?? 900;
    p.r = p.r ?? 5;
    p.rot = p.rot ?? 0;
    p.vr = p.vr ?? 0;
    p.drag = p.drag ?? 0;
    p.kind = p.kind ?? 'dot';
    this.list.push(p);
    return p;
  }

  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) { l.splice(i, 1); continue; }
      if (p.drag) {
        p.vx -= p.vx * p.drag * dt;
        p.vy -= p.vy * p.drag * dt;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.floorY != null && p.y > p.floorY) {
        p.y = p.floorY;
        p.vy *= -0.35;
        p.vx *= 0.7;
        if (Math.abs(p.vy) < 40) { p.vy = 0; p.g = 0; }
      }
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const k = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = (p.alpha ?? 1) * (p.fade === false ? 1 : k);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      switch (p.kind) {
        case 'ring':
          ctx.globalAlpha *= 0.9;
          circle(ctx, 0, 0, p.r * (1 + (1 - k) * p.grow));
          outline(ctx, p.w || 6, p.color);
          break;
        case 'rect':
          roundRect(ctx, -p.r, -p.r * 0.6, p.r * 2, p.r * 1.2, 2);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
        case 'spark': {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-p.vx * 0.02, -p.vy * 0.02);
          ctx.lineCap = 'round';
          ctx.lineWidth = p.r;
          ctx.strokeStyle = p.color;
          ctx.stroke();
          break;
        }
        case 'text':
          ctx.font = `800 ${p.size || 28}px Baloo2, Nunito, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 6;
          ctx.lineJoin = 'round';
          ctx.strokeStyle = 'rgba(20,30,15,.7)';
          ctx.strokeText(p.text, 0, 0);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, 0, 0);
          break;
        case 'glow': {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * (1 + (1 - k)));
          g.addColorStop(0, p.color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          circle(ctx, 0, 0, p.r * (1 + (1 - k)));
          ctx.fill();
          break;
        }
        default:
          circle(ctx, 0, 0, p.r * (p.shrink ? k : 1));
          ctx.fillStyle = p.color;
          ctx.fill();
      }
      ctx.restore();
    }
  }

  // --------------------------------------------------------- emitters

  burst(x, y, color, n = 10, spd = 260, r = 6) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU);
      const s = rnd(spd, spd * 0.35);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, r: rnd(r, r * 0.4), color, life: rnd(0.7, 0.35), shrink: true });
    }
  }

  splat(x, y, color = '#7fd45e') {
    for (let i = 0; i < 7; i++) {
      const a = rnd(-2.6, -0.5);
      this.add({ x, y, vx: Math.cos(a) * rnd(240, 60), vy: Math.sin(a) * rnd(240, 60), r: rnd(6, 2.5), color, life: rnd(0.5, 0.25), shrink: true });
    }
  }

  puff(x, y, color = '#cfd8c0', n = 9) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU);
      this.add({
        x: x + rnd(16, -16), y: y + rnd(10, -10),
        vx: Math.cos(a) * rnd(90, 20), vy: Math.sin(a) * rnd(80, 20) - 40,
        g: -30, r: rnd(16, 7), color, life: rnd(0.7, 0.4), drag: 3, shrink: true, alpha: 0.75,
      });
    }
  }

  ring(x, y, color = '#ffe08a', r = 24, grow = 3.4, life = 0.55) {
    this.add({ x, y, kind: 'ring', r, grow, color, life, g: 0, w: 7 });
  }

  boom(x, y) {
    this.add({ x, y, kind: 'glow', r: 90, color: 'rgba(255,220,150,.95)', life: 0.4, g: 0 });
    this.ring(x, y, '#ffd46a', 40, 4.2, 0.5);
    this.ring(x, y, '#ff8a3a', 24, 6.5, 0.7);
    for (let i = 0; i < 26; i++) {
      const a = rnd(TAU);
      const s = rnd(620, 140);
      this.add({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, r: rnd(11, 4),
        color: ['#ffe27a', '#ff9c33', '#ff5f2e', '#6b3a1a'][(Math.random() * 4) | 0],
        life: rnd(0.9, 0.4), drag: 1.6, shrink: true,
      });
    }
    for (let i = 0; i < 10; i++) {
      this.add({
        x: x + rnd(50, -50), y: y + rnd(20, -30), vx: rnd(60, -60), vy: rnd(-30, -90),
        g: -40, r: rnd(30, 14), color: 'rgba(90,80,70,.5)', life: rnd(1.2, 0.6), drag: 2, shrink: true,
      });
    }
  }

  fire(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + rnd(14, -14), y: y + rnd(10, -10),
        vx: rnd(70, -70), vy: rnd(-40, -170), g: -120, r: rnd(13, 5),
        color: ['#ffd766', '#ff9b33', '#ff5f2e'][(Math.random() * 3) | 0],
        life: rnd(0.5, 0.22), shrink: true, drag: 2,
      });
    }
  }

  frostHit(x, y) {
    for (let i = 0; i < 9; i++) {
      const a = rnd(TAU);
      this.add({
        x, y, vx: Math.cos(a) * rnd(200, 40), vy: Math.sin(a) * rnd(180, 40) - 40,
        r: rnd(6, 2), color: ['#dff4ff', '#a8e0f7', '#ffffff'][(Math.random() * 3) | 0],
        life: rnd(0.6, 0.3), g: 260, shrink: true,
      });
    }
  }

  frost(gx, gy, gw, gh) {
    for (let i = 0; i < 90; i++) {
      this.add({
        x: gx + rnd(gw), y: gy + rnd(gh), vx: rnd(60, -60), vy: rnd(-40, -180),
        g: 120, r: rnd(7, 2), color: '#e8f8ff', life: rnd(1.1, 0.5), shrink: true,
      });
    }
  }

  paper(x, y) {
    for (let i = 0; i < 16; i++) {
      this.add({
        x, y, kind: 'rect', vx: rnd(320, -120), vy: rnd(-60, -320), g: 700,
        r: rnd(11, 5), rot: rnd(TAU), vr: rnd(9, -9), color: '#f2ead4', life: rnd(1.3, 0.7),
      });
    }
  }

  spikes(x, y) {
    for (let i = 0; i < 8; i++) {
      this.add({
        x: x + rnd(50, -50), y, vx: rnd(120, -120), vy: rnd(-160, -380), g: 900,
        r: rnd(6, 2), color: '#dfe9ec', life: rnd(0.6, 0.3), shrink: true,
      });
    }
    this.ring(x, y - 10, 'rgba(220,240,245,.8)', 18, 3, 0.35);
  }

  dirt(x, y, n = 12) {
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + rnd(24, -24), y, vx: rnd(220, -220), vy: rnd(-140, -420), g: 1100,
        r: rnd(8, 3), color: ['#8a6a3f', '#6d5130', '#a3805a'][(Math.random() * 3) | 0],
        life: rnd(0.8, 0.4), floorY: y + 6,
      });
    }
  }

  crumbs(x, y, color = '#6ba24d', n = 8) {
    for (let i = 0; i < n; i++) {
      this.add({
        x, y, kind: 'rect', vx: rnd(260, -260), vy: rnd(-120, -380), g: 1200,
        r: rnd(8, 3), rot: rnd(TAU), vr: rnd(12, -12), color, life: rnd(0.9, 0.4),
      });
    }
  }

  sparkle(x, y, color = '#fff3b0', n = 7) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU);
      this.add({
        x, y, kind: 'spark', vx: Math.cos(a) * rnd(300, 80), vy: Math.sin(a) * rnd(300, 80),
        g: 0, drag: 3, r: rnd(5, 2), color, life: rnd(0.5, 0.25),
      });
    }
  }

  float(x, y, str, color = '#fff') {
    this.add({ x, y, kind: 'text', text: str, color, vy: -110, g: 90, life: 1, size: 30 });
  }
}
