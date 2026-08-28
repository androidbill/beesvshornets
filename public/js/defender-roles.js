// The defender roles the engine knows how to run: what each costs, what it
// does, and a procedural fallback drawing. A battle pack maps its own cast onto
// these ids, so "producer" is the one that earns you resource whether that is a
// sunflower, a nectar bee or a hospital fundraiser.

import {
  TAU, clamp, rnd, circle, ellipse, blob, leaf, outline, lit, ball, glint,
  eye, easeOutBack, easeOutElastic,
} from './util.js';
import { CELL_W, groundY, L } from './config.js';
import { sfx } from './audio.js';

const OUT = '#21361a';
const NUTOUT = '#4a2f18';

// ------------------------------------------------------------------ drawing bits

function sway(p, t, amt = 0.05) {
  return Math.sin(t * 1.6 + p.seed * 7) * amt;
}

/** Two leaves at the base of an upright plant. */
function baseLeaves(ctx, x, y, s, t, seed, tone = ['#6fce4e', '#4a9c2f']) {
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(x + dir * 6 * s, y - 4 * s);
    ctx.rotate(dir * (0.45 + Math.sin(t * 1.7 + seed * 5 + dir) * 0.05));
    ctx.scale(dir, 1);
    leaf(ctx, 0, 0, 46 * s, 24 * s);
    lit(ctx, -20 * s, 10 * s, tone[0], tone[1]);
    outline(ctx, 4.5, OUT);
    ctx.restore();
  }
}

function stem(ctx, x, y, h, bend, s = 1, tone = ['#6bc44a', '#43902c']) {
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, y);
  ctx.quadraticCurveTo(x - 8 * s + bend * 26, y - h * 0.55, x - 7 * s + bend * 44, y - h);
  ctx.lineTo(x + 7 * s + bend * 44, y - h);
  ctx.quadraticCurveTo(x + 8 * s + bend * 26, y - h * 0.55, x + 9 * s, y);
  ctx.closePath();
  lit(ctx, y - h, y, tone[0], tone[1]);
  outline(ctx, 4.5, OUT);
}

/** The shared shooter snout, pointing right. Returns the muzzle point. */
function snout(ctx, x, y, s, tone, recoil = 0, dark = OUT) {
  ctx.save();
  ctx.translate(-recoil * 10, 0);
  ctx.beginPath();
  ctx.moveTo(x - 26 * s, y - 22 * s);
  ctx.quadraticCurveTo(x + 4 * s, y - 30 * s, x + 30 * s, y - 20 * s);
  ctx.lineTo(x + 30 * s, y + 20 * s);
  ctx.quadraticCurveTo(x + 4 * s, y + 30 * s, x - 26 * s, y + 22 * s);
  ctx.closePath();
  ball(ctx, x - 4 * s, y - 6 * s, 34 * s, tone[0], tone[1]);
  outline(ctx, 5, dark);
  ellipse(ctx, x + 29 * s, y, 7 * s, 19 * s);
  ctx.fillStyle = '#20300f';
  ctx.fill();
  ellipse(ctx, x + 28 * s, y - 4 * s, 4 * s, 10 * s);
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.fill();
  ctx.restore();
  return { mx: x + 34 * s - recoil * 10, my: y };
}

// ------------------------------------------------------------------ helpers

const zRowRange = (w, row, minX, maxX) =>
  w.zombies.filter((z) => z.row === row && !z.dead && z.x > minX && z.x < maxX);

function anyTarget(w, row, fromX) {
  for (const z of w.zombies) if (!z.dead && z.row === row && z.x > fromX - 30 && z.hittable) return true;
  return false;
}

/** Standard straight-shooter behaviour, shared by four plants. */
function shooterUpdate(opts) {
  const { rate, dmg, kind = 'pea', shots = 1, gap = 0.14, muzzleY = -66 } = opts;
  return (p, dt, w) => {
    p.cd -= dt;
    p.fireAnim = Math.max(0, (p.fireAnim || 0) - dt * 4);
    if (p.burst > 0) {
      p.burstT -= dt;
      if (p.burstT <= 0) {
        p.burstT = 0.06;
        p.burst--;
        fire(p, w, dmg * 2, kind, muzzleY);
      }
      return;
    }
    if (p.cd > 0) return;
    if (!anyTarget(w, p.row, p.x)) return;
    p.cd = rate;
    for (let i = 0; i < shots; i++) {
      w.after(i * gap, () => fire(p, w, dmg, kind, muzzleY));
    }
  };
}

function fire(p, w, dmg, kind, muzzleY) {
  if (p.dead) return;
  p.fireAnim = 1;
  w.spawnPea({
    x: p.x + (p.def?.muzzleX ?? 40), y: p.y + (p.def?.muzzleY ?? muzzleY), row: p.row, dmg, kind,
    speed: kind === 'ice' ? 470 : 540,
  });
  sfx(kind === 'ice' ? 'shootIce' : 'shoot', 0.045);
}

// ==================================================================== plants

export const DEFENDER_ROLES = {

  // ------------------------------------------------------------- sunflower
  producer: {
    id: 'producer', name: 'Sunflower', cost: 50, recharge: 7.5, hp: 300,
    blurb: 'Grows sun. Plant these first — every other plant is paid for by them.',
    foodDesc: 'Bursts out five suns at once.',
    tag: 'Sun',
    place(p) { p.cd = 6; },
    update(p, dt, w) {
      p.cd -= dt;
      p.glow = Math.max(0, (p.glow || 0) - dt * 1.6);
      if (p.cd <= 0) {
        p.cd = 20;
        p.glow = 1;
        w.spawnSun({ x: p.x + rnd(26, -26), y: p.y - 70, value: 25, hop: true });
      }
    },
    food(p, w) {
      for (let i = 0; i < 5; i++) {
        w.after(i * 0.09, () => w.spawnSun({ x: p.x + rnd(70, -70), y: p.y - 80, value: 25, hop: true }));
      }
      p.glow = 1.6;
    },
    draw(ctx, p, t) {
      const s = 1;
      const bend = sway(p, t, 0.055);
      const pop = 1 + (p.glow || 0) * 0.09;
      baseLeaves(ctx, p.x, p.y - 4, s, t, p.seed);
      stem(ctx, p.x, p.y - 2, 62, bend, s);
      ctx.save();
      ctx.translate(p.x + bend * 44, p.y - 66);
      ctx.scale(pop, pop);
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.sin(t * 1.2 + p.seed) * 0.05;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(40, 0, 24, 12, 0, 0, TAU);
        const g = ctx.createLinearGradient(16, 0, 64, 0);
        g.addColorStop(0, '#ffcf35');
        g.addColorStop(1, '#ffe98a');
        ctx.fillStyle = g;
        ctx.fill();
        outline(ctx, 4, '#a5691a');
        ctx.restore();
      }
      circle(ctx, 0, 0, 33);
      ball(ctx, 0, 0, 34, '#e8a63a', '#b8761f');
      outline(ctx, 5, '#7d4b12');
      ctx.save();
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 22; i++) {
        const a = i * 2.4;
        circle(ctx, Math.cos(a) * (5 + i * 1.1), Math.sin(a) * (5 + i * 1.1), 2.4);
        ctx.fillStyle = '#6d3f10';
        ctx.fill();
      }
      ctx.restore();
      eye(ctx, -12, -6, 8, 0.2, 0.1, p.blink);
      eye(ctx, 12, -6, 8, 0.2, 0.1, p.blink);
      ctx.beginPath();
      ctx.arc(0, 6, 11, 0.25, Math.PI - 0.25);
      outline(ctx, 4, '#5d3a0e');
      ctx.restore();
      if (p.glow > 0) {
        ctx.save();
        ctx.globalAlpha = p.glow * 0.35;
        const g = ctx.createRadialGradient(p.x + bend * 44, p.y - 66, 10, p.x + bend * 44, p.y - 66, 90);
        g.addColorStop(0, '#fff2a8');
        g.addColorStop(1, 'rgba(255,242,168,0)');
        ctx.fillStyle = g;
        circle(ctx, p.x + bend * 44, p.y - 66, 90);
        ctx.fill();
        ctx.restore();
      }
    },
  },

  // ------------------------------------------------------------ twin sun
  producer2: {
    id: 'producer2', name: 'Twin Sun', cost: 150, recharge: 22, hp: 300,
    blurb: 'Two heads, twice the sun. The engine room of any long level.',
    foodDesc: 'Showers the lawn with eight suns.',
    tag: 'Sun',
    place(p) { p.cd = 5; },
    update(p, dt, w) {
      p.cd -= dt;
      p.glow = Math.max(0, (p.glow || 0) - dt * 1.6);
      if (p.cd <= 0) {
        p.cd = 20;
        p.glow = 1;
        w.spawnSun({ x: p.x - 26, y: p.y - 92, value: 25, hop: true });
        w.after(0.16, () => w.spawnSun({ x: p.x + 30, y: p.y - 70, value: 25, hop: true }));
      }
    },
    food(p, w) {
      for (let i = 0; i < 8; i++) {
        w.after(i * 0.08, () => w.spawnSun({ x: p.x + rnd(80, -80), y: p.y - 90, value: 25, hop: true }));
      }
      p.glow = 1.6;
    },
    draw(ctx, p, t) {
      const bend = sway(p, t, 0.05);
      baseLeaves(ctx, p.x, p.y - 4, 1.05, t, p.seed);
      stem(ctx, p.x, p.y - 2, 44, bend, 1);
      const heads = [[-26, -96, 0.82, 0], [28, -74, 0.78, 1.4]];
      for (const [dx, dy, hs, ph] of heads) {
        ctx.save();
        ctx.translate(p.x + dx + bend * 40, p.y + dy);
        ctx.scale(hs * (1 + (p.glow || 0) * 0.08), hs * (1 + (p.glow || 0) * 0.08));
        const n = 12;
        for (let i = 0; i < n; i++) {
          ctx.save();
          ctx.rotate((i / n) * TAU + Math.sin(t * 1.3 + ph) * 0.06);
          ctx.beginPath();
          ctx.ellipse(40, 0, 24, 12, 0, 0, TAU);
          const g = ctx.createLinearGradient(16, 0, 64, 0);
          g.addColorStop(0, '#ffd84a');
          g.addColorStop(1, '#fff0a0');
          ctx.fillStyle = g;
          ctx.fill();
          outline(ctx, 4, '#a5691a');
          ctx.restore();
        }
        circle(ctx, 0, 0, 31);
        ball(ctx, 0, 0, 32, '#eaae44', '#bb7c22');
        outline(ctx, 5, '#7d4b12');
        eye(ctx, -11, -5, 7.5, 0.2, 0.1, p.blink);
        eye(ctx, 12, -5, 7.5, 0.2, 0.1, p.blink);
        ctx.beginPath();
        ctx.arc(0, 7, 10, 0.25, Math.PI - 0.25);
        outline(ctx, 4, '#5d3a0e');
        ctx.restore();
      }
    },
  },

  // ------------------------------------------------------------ peashooter
  shooter: {
    id: 'shooter', name: 'Peashooter', cost: 100, recharge: 5, hp: 300,
    blurb: 'Fires a pea down its lane. Cheap, reliable, always worth having.',
    foodDesc: 'Unloads sixty peas in three seconds.',
    tag: 'Attack',
    place(p) { p.cd = 0.4; },
    update: shooterUpdate({ rate: 1.4, dmg: 20 }),
    food(p, w) { p.burst = 40; p.burstT = 0; sfx('foodUse'); },
    draw(ctx, p, t) {
      const bend = sway(p, t, 0.045);
      const rec = (p.fireAnim || 0);
      baseLeaves(ctx, p.x, p.y - 4, 1, t, p.seed);
      stem(ctx, p.x, p.y - 2, 58, bend * 0.6, 1);
      const hx = p.x + bend * 26 - 4;
      const hy = p.y - 68;
      ctx.save();
      circle(ctx, hx, hy, 30);
      ball(ctx, hx, hy, 31, '#7ede56', '#3f8f27');
      outline(ctx, 5, OUT);
      ctx.restore();
      snout(ctx, hx + 22, hy - 2, 0.72, ['#84e35c', '#3f8f27'], rec);
      eye(ctx, hx - 6, hy - 8, 8, 0.35, 0, p.blink);
      glint(ctx, hx - 12, hy - 18, 10, 6, -0.6, 0.35);
    },
  },

  // ------------------------------------------------------------- repeater
  repeater: {
    id: 'repeater', name: 'Repeater', cost: 200, recharge: 8, hp: 300,
    blurb: 'Two peas per shot. Twice the damage in the same tile.',
    foodDesc: 'Unloads a hundred peas.',
    tag: 'Attack',
    place(p) { p.cd = 0.4; },
    update: shooterUpdate({ rate: 1.4, dmg: 20, shots: 2, gap: 0.16 }),
    food(p, w) { p.burst = 70; p.burstT = 0; sfx('foodUse'); },
    draw(ctx, p, t) {
      const bend = sway(p, t, 0.04);
      const rec = (p.fireAnim || 0);
      baseLeaves(ctx, p.x, p.y - 4, 1.05, t, p.seed);
      stem(ctx, p.x, p.y - 2, 56, bend * 0.6, 1.05);
      const hx = p.x + bend * 26 - 8;
      const hy = p.y - 70;
      circle(ctx, hx, hy, 32);
      ball(ctx, hx, hy, 33, '#66cf46', '#2f7a1e');
      outline(ctx, 5, OUT);
      snout(ctx, hx + 20, hy - 16, 0.6, ['#6fd94e', '#2f7a1e'], rec);
      snout(ctx, hx + 24, hy + 14, 0.6, ['#6fd94e', '#2f7a1e'], rec * 0.6);
      eye(ctx, hx - 8, hy - 10, 8, 0.35, 0, p.blink);
      glint(ctx, hx - 14, hy - 20, 10, 6, -0.6, 0.3);
    },
  },

  // ------------------------------------------------------------- frost pea
  chiller: {
    id: 'chiller', name: 'Frost Pea', cost: 175, recharge: 8, hp: 300,
    blurb: 'Chilled peas slow whatever they hit by half for four seconds.',
    foodDesc: 'Freezes every zombie on the lawn solid.',
    tag: 'Attack',
    place(p) { p.cd = 0.4; },
    update: shooterUpdate({ rate: 1.4, dmg: 20, kind: 'ice' }),
    food(p, w) {
      sfx('freeze');
      w.flash('#bfe9ff', 0.5);
      for (const z of w.zombies) if (!z.dead) { w.chill(z, 6, true); z.hp -= 60; }
      w.particles.frost(w.L.gx, w.L.gy, w.L.gw, w.L.gh);
    },
    draw(ctx, p, t) {
      const bend = sway(p, t, 0.04);
      const rec = (p.fireAnim || 0);
      baseLeaves(ctx, p.x, p.y - 4, 1, t, p.seed, ['#8fe6d8', '#42a08f']);
      stem(ctx, p.x, p.y - 2, 58, bend * 0.6, 1, ['#7fdcd0', '#3d968a']);
      const hx = p.x + bend * 26 - 4;
      const hy = p.y - 68;
      circle(ctx, hx, hy, 30);
      ball(ctx, hx, hy, 31, '#d9f6ff', '#5fb8dc');
      outline(ctx, 5, '#20505f');
      snout(ctx, hx + 22, hy - 2, 0.72, ['#e6fbff', '#63bede'], rec, '#20505f');
      // frost crystals
      ctx.save();
      ctx.translate(hx, hy);
      for (let i = 0; i < 5; i++) {
        const a = -1.9 + i * 0.42;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
        ctx.lineTo(Math.cos(a) * (36 + Math.sin(t * 3 + i) * 2), Math.sin(a) * (36 + Math.sin(t * 3 + i) * 2));
        outline(ctx, 5, '#a9e6ff');
      }
      ctx.restore();
      eye(ctx, hx - 6, hy - 8, 8, 0.35, 0, p.blink, '#f2fdff');
      glint(ctx, hx - 12, hy - 18, 11, 6, -0.6, 0.5);
    },
  },

  // ----------------------------------------------------------- threepeater
  trishot: {
    id: 'trishot', name: 'Threepeater', cost: 325, recharge: 9, hp: 300,
    blurb: 'One plant, three lanes. Put it in the middle row and let it work.',
    foodDesc: 'Ninety peas across all three lanes.',
    tag: 'Attack',
    place(p) { p.cd = 0.5; },
    update(p, dt, w) {
      p.cd -= dt;
      p.fireAnim = Math.max(0, (p.fireAnim || 0) - dt * 4);
      const rows = [p.row - 1, p.row, p.row + 1].filter((r) => r >= 0 && r < 5);
      if (p.burst > 0) {
        p.burstT -= dt;
        if (p.burstT <= 0) {
          p.burstT = 0.08;
          p.burst--;
          p.fireAnim = 1;
          rows.forEach((r) => w.spawnPea({ x: p.x + 30, y: p.y - 76, row: r, dmg: 40, kind: 'pea', speed: 560, arriveY: true }));
          sfx('shoot', 0.05);
        }
        return;
      }
      if (p.cd > 0) return;
      if (!rows.some((r) => anyTarget(w, r, p.x))) return;
      p.cd = 1.5;
      p.fireAnim = 1;
      rows.forEach((r) => w.spawnPea({ x: p.x + 30, y: p.y - 76, row: r, dmg: 20, kind: 'pea', speed: 540, arriveY: true }));
      sfx('shoot', 0.05);
    },
    food(p, w) { p.burst = 30; p.burstT = 0; sfx('foodUse'); },
    draw(ctx, p, t) {
      const bend = sway(p, t, 0.035);
      const rec = (p.fireAnim || 0);
      baseLeaves(ctx, p.x, p.y - 4, 1.1, t, p.seed);
      stem(ctx, p.x, p.y - 2, 46, bend * 0.5, 1.15);
      const necks = [[-8, -104, -0.5], [10, -76, 0], [-6, -50, 0.42]];
      for (const [dx, dy, ang] of necks) {
        const hx = p.x + dx + bend * 22;
        const hy = p.y + dy;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p.x - 6, p.y - 40);
        ctx.quadraticCurveTo(p.x + dx * 0.5, hy + 24, hx, hy + 6);
        outline(ctx, 15, '#3f8f27');
        ctx.beginPath();
        ctx.moveTo(p.x - 6, p.y - 40);
        ctx.quadraticCurveTo(p.x + dx * 0.5, hy + 24, hx, hy + 6);
        outline(ctx, 8, '#79d95a');
        ctx.restore();
        circle(ctx, hx, hy, 24);
        ball(ctx, hx, hy, 25, '#7ede56', '#3f8f27');
        outline(ctx, 5, OUT);
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(ang * 0.5);
        snout(ctx, 18, 0, 0.56, ['#84e35c', '#3f8f27'], rec);
        ctx.restore();
        eye(ctx, hx - 5, hy - 7, 6.5, 0.35, 0, p.blink);
      }
    },
  },

  // --------------------------------------------------------------- wall-nut
  wall: {
    id: 'wall', name: 'Wall Nut', cost: 50, recharge: 22, hp: 4000,
    blurb: 'Does nothing but soak. Buys the peashooters behind it a long time.',
    foodDesc: 'Heals to full and hardens — half damage for twenty seconds.',
    tag: 'Defence',
    place(p) { p.wob = 0; },
    update(p, dt) {
      p.wob = Math.max(0, (p.wob || 0) - dt * 3);
      if (p.armorT > 0) p.armorT -= dt;
    },
    food(p, w) {
      p.hp = p.maxHp;
      p.armorT = 20;
      w.particles.ring(p.x, p.y - 40, '#ffe08a');
    },
    draw(ctx, p, t) {
      const k = p.hp / p.maxHp;
      const w = 1 + (p.wob || 0) * 0.12 * Math.sin(t * 40);
      ctx.save();
      ctx.translate(p.x, p.y - 4);
      ctx.scale(w, 2 - w);
      blob(ctx, 0, -44, 44, 48, 7, 0.03, p.seed * 4);
      ball(ctx, 0, -50, 52, p.armorT > 0 ? '#f2d79a' : '#dfa262', p.armorT > 0 ? '#b98b3c' : '#95612c');
      outline(ctx, 5.5, NUTOUT);
      // grain
      ctx.save();
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(-6 + i * 3, -44, 30 - i * 5, 40 - i * 6, 0.3, 0.4, 2.6);
        outline(ctx, 3, '#7a4c22');
      }
      ctx.restore();
      // cracks appear as it takes damage
      if (k < 0.72) {
        ctx.save();
        ctx.globalAlpha = clamp((0.72 - k) * 3, 0, 1);
        ctx.beginPath();
        ctx.moveTo(-4, -84); ctx.lineTo(4, -64); ctx.lineTo(-8, -52); ctx.lineTo(2, -34);
        outline(ctx, 4, '#6d4318');
        if (k < 0.4) {
          ctx.beginPath();
          ctx.moveTo(26, -70); ctx.lineTo(14, -56); ctx.lineTo(28, -44);
          outline(ctx, 3.6, '#6d4318');
          ctx.beginPath();
          ctx.moveTo(-30, -58); ctx.lineTo(-18, -46);
          outline(ctx, 3.6, '#6d4318');
        }
        ctx.restore();
      }
      const squint = k < 0.4 ? 0.55 : 1;
      eye(ctx, -15, -54, 9, 0, 0.1, p.blink * squint);
      eye(ctx, 15, -54, 9, 0, 0.1, p.blink * squint);
      ctx.beginPath();
      if (k > 0.6) ctx.arc(0, -32, 12, 0.2, Math.PI - 0.2);
      else { ctx.moveTo(-11, -28); ctx.quadraticCurveTo(0, -38, 11, -28); }
      outline(ctx, 4.2, '#6d4318');
      ctx.restore();
      if (p.armorT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(t * 6) * 0.1;
        circle(ctx, p.x, p.y - 52, 62);
        outline(ctx, 4, '#ffe08a');
        ctx.restore();
      }
    },
  },

  // ------------------------------------------------------------ potato mine
  mine: {
    id: 'mine', name: 'Potato Mine', cost: 25, recharge: 22, hp: 300,
    blurb: 'Cheap panic button. Takes fourteen seconds to arm, then deletes one zombie.',
    foodDesc: 'Arms instantly and blows a much bigger hole.',
    tag: 'Bomb',
    ground: true,
    place(p) { p.arm = 14; p.armed = false; },
    update(p, dt, w) {
      if (!p.armed) {
        p.arm -= dt;
        if (p.arm <= 0) { p.armed = true; sfx('pop'); w.particles.puff(p.x, p.y - 10, '#c9a869'); }
        return;
      }
      const hit = zRowRange(w, p.row, p.x - CELL_W * 0.55, p.x + CELL_W * 0.65)[0];
      if (hit) {
        w.explode({ x: p.x, y: p.y - 20, row: p.row, radius: CELL_W * 0.85, dmg: 1800, kind: 'dirt' });
        w.kill(p);
      }
    },
    food(p, w) {
      p.armed = true;
      w.after(0.15, () => {
        w.explode({ x: p.x, y: p.y - 20, row: p.row, radius: CELL_W * 1.7, dmg: 2600, kind: 'dirt', rows: 1 });
        w.kill(p);
      });
    },
    draw(ctx, p, t) {
      if (!p.armed) {
        // buried: just a mound and a sprout
        const k = 1 - p.arm / 14;
        ellipse(ctx, p.x, p.y - 6, 34, 15);
        lit(ctx, p.y - 20, p.y + 4, '#8b6a41', '#6d5130');
        outline(ctx, 4.5, '#4b3720');
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 10);
        ctx.quadraticCurveTo(p.x + 4, p.y - 22 - k * 10, p.x + 12, p.y - 26 - k * 12);
        outline(ctx, 5, '#4f9e33');
        ctx.save();
        ctx.translate(p.x + 12, p.y - 26 - k * 12);
        ctx.rotate(-0.5);
        leaf(ctx, 0, 0, 18, 9);
        ctx.fillStyle = '#6fce4e';
        ctx.fill();
        outline(ctx, 3.4, OUT);
        ctx.restore();
        return;
      }
      const pulse = 0.5 + Math.sin(t * 5) * 0.5;
      ctx.save();
      ctx.translate(p.x, p.y - 22);
      blob(ctx, 0, 0, 40, 27, 6, 0.05, p.seed * 3);
      ball(ctx, -6, -8, 40, '#d9b073', '#a07a45');
      outline(ctx, 5, '#5c4222');
      ctx.save();
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 7; i++) {
        circle(ctx, -26 + i * 9, -8 + Math.sin(i * 2) * 8, 2.6);
        ctx.fillStyle = '#7b5a2e';
        ctx.fill();
      }
      ctx.restore();
      eye(ctx, -13, -6, 8, 0.2, 0, p.blink);
      eye(ctx, 12, -6, 8, 0.2, 0, p.blink);
      ctx.beginPath();
      ctx.moveTo(-10, 10); ctx.quadraticCurveTo(0, 20, 10, 10);
      outline(ctx, 4, '#5c4222');
      circle(ctx, 0, -26, 7);
      ctx.fillStyle = `rgba(255,${60 + pulse * 60},50,${0.55 + pulse * 0.45})`;
      ctx.fill();
      outline(ctx, 3, '#5c4222');
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = pulse * 0.3;
      circle(ctx, p.x, p.y - 48, 16 + pulse * 8);
      ctx.fillStyle = '#ff5a3c';
      ctx.fill();
      ctx.restore();
    },
  },

  // ----------------------------------------------------------- cherry bomb
  bomb: {
    id: 'bomb', name: 'Cherry Bomb', cost: 150, recharge: 30, hp: 4000,
    blurb: 'A three-by-three crater, one second after you plant it.',
    foodDesc: 'A five-by-five crater instead.',
    tag: 'Bomb',
    place(p) { p.fuse = 1.05; },
    update(p, dt, w) {
      p.fuse -= dt;
      if (p.fuse <= 0) {
        w.explode({ x: p.x, y: p.y - 40, row: p.row, radius: CELL_W * 1.45, dmg: 1800, kind: 'fire', rows: 1 });
        w.kill(p);
      }
    },
    food(p, w) {
      p.fuse = 0.2;
      p.big = true;
    },
    draw(ctx, p, t) {
      const k = clamp(1 - p.fuse / 1.05, 0, 1);
      const pop = 1 + k * k * 0.45 + Math.sin(t * (12 + k * 40)) * 0.04 * k;
      ctx.save();
      ctx.translate(p.x, p.y - 34);
      ctx.scale(pop, pop);
      // stems
      ctx.beginPath();
      ctx.moveTo(-20, -22); ctx.quadraticCurveTo(-6, -56, 6, -50);
      outline(ctx, 6, '#3f8f27');
      ctx.beginPath();
      ctx.moveTo(20, -20); ctx.quadraticCurveTo(10, -52, 4, -50);
      outline(ctx, 6, '#3f8f27');
      ctx.save();
      ctx.translate(4, -52);
      ctx.rotate(-0.4);
      leaf(ctx, 0, 0, 30, 14);
      lit(ctx, -12, 6, '#7ede56', '#3f8f27');
      outline(ctx, 4, OUT);
      ctx.restore();
      for (const dx of [-21, 21]) {
        circle(ctx, dx, 4, 27);
        ball(ctx, dx, 4, 28, k > 0.55 ? '#ff7d6a' : '#e2382c', k > 0.55 ? '#e03a2a' : '#a71d1d');
        outline(ctx, 5, '#661212');
        glint(ctx, dx - 9, -8, 8, 5, -0.6, 0.5);
      }
      eye(ctx, -26, 0, 7.5, 0.1, 0, 1);
      eye(ctx, -14, 0, 7.5, 0.1, 0, 1);
      eye(ctx, 15, 0, 7.5, -0.1, 0, 1);
      eye(ctx, 27, 0, 7.5, -0.1, 0, 1);
      ctx.beginPath();
      ctx.moveTo(-30, -10); ctx.lineTo(-10, -4);
      outline(ctx, 4, '#661212');
      ctx.beginPath();
      ctx.moveTo(30, -10); ctx.lineTo(10, -4);
      outline(ctx, 4, '#661212');
      ctx.restore();
      if (k > 0.5) {
        ctx.save();
        ctx.globalAlpha = (k - 0.5) * 1.4;
        const g = ctx.createRadialGradient(p.x, p.y - 34, 10, p.x, p.y - 34, 120);
        g.addColorStop(0, 'rgba(255,220,140,.9)');
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        circle(ctx, p.x, p.y - 34, 120);
        ctx.fill();
        ctx.restore();
      }
    },
  },

  // -------------------------------------------------------------- bonk choy
  brawler: {
    id: 'brawler', name: 'Bonk Choy', cost: 150, recharge: 8, hp: 320,
    blurb: 'Punches anything next to it, on both sides. Needs a wall in front.',
    foodDesc: 'A flurry that knocks the whole lane backwards.',
    tag: 'Melee',
    place(p) { p.cd = 0.3; p.punch = 0; p.dir = 1; },
    update(p, dt, w) {
      p.cd -= dt;
      p.punch = Math.max(0, p.punch - dt * 5);
      if (p.flurry > 0) {
        p.flurry -= dt;
        p.punch = 1;
        for (const z of zRowRange(w, p.row, p.x - CELL_W * 1.4, p.x + CELL_W * 1.6)) {
          w.hurt(z, 90 * dt * 6, 'punch');
          z.knock = Math.max(z.knock || 0, 0.4);
        }
        return;
      }
      if (p.cd > 0) return;
      const right = zRowRange(w, p.row, p.x + 10, p.x + CELL_W * 1.05)[0];
      const left = zRowRange(w, p.row, p.x - CELL_W * 0.95, p.x + 10)[0];
      const target = right || left;
      if (!target) return;
      p.dir = right ? 1 : -1;
      p.cd = 0.55;
      p.punch = 1;
      w.hurt(target, 32, 'punch');
      target.knock = 0.16;
      sfx('punch', 0.05);
    },
    food(p, w) { p.flurry = 2.4; sfx('foodUse'); },
    draw(ctx, p, t) {
      const bend = sway(p, t, 0.05);
      const jab = easeOutBack(clamp(p.punch, 0, 1)) * (p.dir || 1);
      ctx.save();
      ctx.translate(p.x + bend * 14, p.y - 6);
      // leafy body
      for (let i = 0; i < 5; i++) {
        const a = -1.9 + i * 0.7;
        ctx.save();
        ctx.rotate(a * 0.42);
        leaf(ctx, 0, -34, 52 - i * 3, 26);
        lit(ctx, -60, -10, i % 2 ? '#8ce063' : '#6cc945', '#3d8b26');
        outline(ctx, 4.5, OUT);
        ctx.restore();
      }
      blob(ctx, 0, -40, 30, 36, 7, 0.05, p.seed);
      ball(ctx, -6, -50, 34, '#e9f7c0', '#a8cf74');
      outline(ctx, 5, OUT);
      eye(ctx, -11, -50, 8, (p.dir || 1) * 0.4, 0, p.blink);
      eye(ctx, 11, -50, 8, (p.dir || 1) * 0.4, 0, p.blink);
      ctx.beginPath();
      ctx.moveTo(-9, -30); ctx.quadraticCurveTo(0, -22, 9, -30);
      outline(ctx, 4, OUT);
      // fists
      for (const side of [-1, 1]) {
        const reach = side === (p.dir || 1) ? jab * side * 34 : -side * 4;
        const fx = side * 30 + reach;
        ctx.beginPath();
        ctx.moveTo(side * 16, -44);
        ctx.lineTo(fx, -38);
        outline(ctx, 9, '#4f9e33');
        circle(ctx, fx, -38, 15);
        ball(ctx, fx, -38, 16, '#9be070', '#4f9e33');
        outline(ctx, 4.5, OUT);
      }
      ctx.restore();
    },
  },

  // ------------------------------------------------------------- spikeweed
  trap: {
    id: 'trap', name: 'Spikeweed', cost: 100, recharge: 7, hp: 300,
    blurb: 'Sits flat. Zombies walk right over it and shred their feet.',
    foodDesc: 'Spikes erupt down the whole lane.',
    tag: 'Ground',
    ground: true,
    walkover: true,
    place(p) { p.cd = 0; },
    update(p, dt, w) {
      p.cd -= dt;
      p.hit = Math.max(0, (p.hit || 0) - dt * 5);
      if (p.cd > 0) return;
      const on = zRowRange(w, p.row, p.x - CELL_W * 0.5, p.x + CELL_W * 0.5);
      if (!on.length) return;
      p.cd = 0.35;
      p.hit = 1;
      for (const z of on) {
        w.hurt(z, z.crusher ? 0 : 14, 'spike');
        if (z.tyres) w.hurt(z, 900, 'spike');
      }
      sfx('spike', 0.2);
    },
    food(p, w) {
      sfx('foodUse');
      p.hit = 1.6;
      for (let i = 0; i < 9; i++) {
        w.after(i * 0.05, () => {
          const x = w.L.gx + (i + 0.5) * CELL_W;
          w.particles.spikes(x, groundY(p.row));
          for (const z of zRowRange(w, p.row, x - CELL_W * 0.5, x + CELL_W * 0.5)) w.hurt(z, 320, 'spike');
        });
      }
    },
    draw(ctx, p, t) {
      const pop = 1 + (p.hit || 0) * 0.3;
      ctx.save();
      ctx.translate(p.x, p.y - 4);
      ellipse(ctx, 0, 4, 54, 18);
      ctx.fillStyle = 'rgba(20,50,10,.18)';
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-52, 2 + (i - 1) * 8);
        ctx.quadraticCurveTo(0, -6 + (i - 1) * 10, 52, 2 + (i - 1) * 8);
        outline(ctx, 6, '#3f7a2a');
      }
      for (let i = 0; i < 7; i++) {
        const x = -44 + i * 15;
        const h = (16 + (i % 2) * 7) * pop;
        ctx.beginPath();
        ctx.moveTo(x - 7, 4);
        ctx.lineTo(x, 4 - h);
        ctx.lineTo(x + 7, 4);
        ctx.closePath();
        lit(ctx, 4 - h, 4, '#e3ecef', '#8fa2a8');
        outline(ctx, 3.4, '#3c4a4e');
      }
      ctx.restore();
    },
  },

  // --------------------------------------------------------------- chomper
  devourer: {
    id: 'devourer', name: 'Chomper', cost: 150, recharge: 9, hp: 340,
    blurb: 'Swallows a zombie whole — then chews for twelve seconds, wide open.',
    foodDesc: 'Eats three zombies instantly and skips the chewing.',
    tag: 'Melee',
    place(p) { p.chew = 0; p.bite = 0; },
    update(p, dt, w) {
      p.bite = Math.max(0, p.bite - dt * 3);
      if (p.chew > 0) { p.chew -= dt; return; }
      const target = zRowRange(w, p.row, p.x + 12, p.x + CELL_W * 1.25)[0];
      if (!target) return;
      p.bite = 1;
      sfx('chomp');
      if (target.crusher) {
        w.hurt(target, 900, 'chomp');
        p.chew = 4;
      } else {
        w.hurt(target, 9999, 'chomp');
        w.particles.puff(target.x, target.y - 50, '#8e4fd0');
        sfx('gulp');
        p.chew = 12;
      }
    },
    food(p, w) {
      sfx('foodUse');
      p.chew = 0;
      for (let i = 0; i < 3; i++) {
        w.after(i * 0.22, () => {
          const target = zRowRange(w, p.row, p.x, p.x + CELL_W * 4)[0];
          if (!target) return;
          p.bite = 1;
          sfx('chomp');
          w.hurt(target, 9999, 'chomp');
        });
      }
    },
    draw(ctx, p, t) {
      const bend = sway(p, t, 0.05);
      const open = p.chew > 0 ? 1 : 1 - easeOutBack(clamp(p.bite, 0, 1)) * 0.95;
      const chewWob = p.chew > 0 ? Math.sin(t * 14) * 0.12 : 0;
      ctx.save();
      ctx.translate(p.x - 6, p.y - 4);
      baseLeaves(ctx, 0, 0, 1.15, t, p.seed, ['#7ad657', '#3f8f27']);
      // stalk
      ctx.beginPath();
      ctx.moveTo(-11, 0);
      ctx.quadraticCurveTo(-6 + bend * 20, -40, 8 + bend * 30, -62);
      ctx.lineTo(24 + bend * 30, -52);
      ctx.quadraticCurveTo(10 + bend * 20, -34, 11, 0);
      ctx.closePath();
      lit(ctx, -62, 0, '#7bd35c', '#3f8f27');
      outline(ctx, 5, OUT);
      ctx.translate(16 + bend * 30, -62);
      ctx.rotate(-0.25 + chewWob);
      // lower jaw
      ctx.save();
      ctx.rotate(open * 0.55);
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.quadraticCurveTo(6, 34, 42, 8);
      ctx.quadraticCurveTo(10, 16, -26, 4);
      ctx.closePath();
      lit(ctx, 0, 34, '#9a5cd8', '#6c33a4');
      outline(ctx, 5, '#3d1a63');
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-14 + i * 15, 6 + i * 1.5);
        ctx.lineTo(-8 + i * 15, -6 + i * 0.5);
        ctx.lineTo(-2 + i * 15, 7 + i * 1.5);
        ctx.closePath();
        ctx.fillStyle = '#fff8ff';
        ctx.fill();
        outline(ctx, 2.6, '#3d1a63');
      }
      ctx.restore();
      // upper head
      ctx.save();
      ctx.rotate(-open * 0.62);
      ctx.beginPath();
      ctx.moveTo(-28, 2);
      ctx.quadraticCurveTo(-14, -46, 22, -38);
      ctx.quadraticCurveTo(48, -30, 44, 2);
      ctx.quadraticCurveTo(10, 12, -28, 2);
      ctx.closePath();
      ball(ctx, 0, -24, 46, '#b273e8', '#6c33a4');
      outline(ctx, 5, '#3d1a63');
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-14 + i * 15, 0);
        ctx.lineTo(-8 + i * 15, 13);
        ctx.lineTo(-2 + i * 15, 0);
        ctx.closePath();
        ctx.fillStyle = '#fff8ff';
        ctx.fill();
        outline(ctx, 2.6, '#3d1a63');
      }
      eye(ctx, 2, -26, 8, 0.4, 0, p.blink, '#ffeaff');
      eye(ctx, 24, -22, 7, 0.4, 0, p.blink, '#ffeaff');
      ctx.restore();
      ctx.restore();
      if (p.chew > 0) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.font = '700 20px Nunito, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e9d6ff';
        ctx.fillText('chewing', p.x, p.y - 108);
        ctx.restore();
      }
    },
  },

  // ------------------------------------------------------------- emberwood
  amplifier: {
    id: 'amplifier', name: 'Emberwood', cost: 175, recharge: 9, hp: 300,
    // Read by world.js: any friendly shot crossing this tile is upgraded.
    amplifies: true,
    blurb: 'Sets fire to any pea that flies through it: double damage and splash.',
    foodDesc: 'Rolls a wall of fire down the lane.',
    tag: 'Support',
    place(p) { p.flame = 0; },
    update(p, dt) { p.flame = (p.flame || 0) + dt; },
    food(p, w) {
      sfx('foodUse');
      w.fireWave(p.row, p.x);
    },
    draw(ctx, p, t) {
      ctx.save();
      ctx.translate(p.x, p.y - 4);
      // stump
      ctx.beginPath();
      ctx.moveTo(-34, 0);
      ctx.lineTo(-27, -54);
      ctx.lineTo(27, -54);
      ctx.lineTo(34, 0);
      ctx.closePath();
      lit(ctx, -54, 0, '#8b6238', '#5d3f21');
      outline(ctx, 5, '#3a2612');
      ellipse(ctx, 0, -54, 28, 11);
      ctx.fillStyle = '#a97c48';
      ctx.fill();
      outline(ctx, 4.5, '#3a2612');
      ctx.save();
      ctx.globalAlpha = 0.4;
      for (let i = 1; i < 4; i++) { ellipse(ctx, 0, -54, 7 * i, 2.8 * i); outline(ctx, 2.4, '#6d4a26'); }
      ctx.restore();
      eye(ctx, -12, -34, 7.5, 0.3, 0, p.blink);
      eye(ctx, 12, -34, 7.5, 0.3, 0, p.blink);
      ctx.beginPath();
      ctx.arc(0, -20, 9, 0.2, Math.PI - 0.2);
      outline(ctx, 3.6, '#3a2612');
      // flame
      for (let i = 0; i < 3; i++) {
        const ph = t * 6 + i * 2.1;
        const h = 42 + Math.sin(ph) * 12 + i * 4;
        const wob = Math.sin(ph * 1.4) * 6;
        ctx.beginPath();
        ctx.moveTo(-18 + i * 8, -56);
        ctx.quadraticCurveTo(-26 + i * 9 + wob, -56 - h * 0.6, -4 + i * 6 + wob, -56 - h);
        ctx.quadraticCurveTo(12 + i * 5 + wob, -56 - h * 0.55, 16 + i * 6, -56);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, -56 - h, 0, -56);
        g.addColorStop(0, i === 2 ? '#fff2b0' : '#ffd25e');
        g.addColorStop(1, i === 2 ? '#ff9c2e' : '#f4571f');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.9 - i * 0.12;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.sin(t * 5) * 0.05;
      const g = ctx.createRadialGradient(p.x, p.y - 92, 6, p.x, p.y - 92, 100);
      g.addColorStop(0, '#ffb347');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      circle(ctx, p.x, p.y - 92, 100);
      ctx.fill();
      ctx.restore();
    },
  },

  // ----------------------------------------------------------------- melon
  lobber: {
    id: 'lobber', name: 'Melon Lobber', cost: 300, recharge: 9, hp: 300,
    blurb: 'Lobs over walls and splashes the whole neighbourhood of the hit.',
    foodDesc: 'Rains melons across the entire lawn.',
    tag: 'Attack',
    place(p) { p.cd = 1; },
    update(p, dt, w) {
      p.cd -= dt;
      p.fireAnim = Math.max(0, (p.fireAnim || 0) - dt * 3);
      if (p.cd > 0) return;
      const target = w.nearestZombie(p.row, p.x);
      if (!target) return;
      p.cd = 2.6;
      p.fireAnim = 1;
      w.spawnLob({ x: p.x, y: p.y - 82, row: p.row, tx: target.x, dmg: 80, splash: 40 });
      sfx('lob');
    },
    food(p, w) {
      sfx('foodUse');
      for (let i = 0; i < 12; i++) {
        w.after(i * 0.1, () => {
          const row = i % 5;
          w.spawnLob({
            x: p.x, y: p.y - 90, row,
            tx: w.L.gx + rnd(w.L.gw * 0.95, w.L.gw * 0.15),
            dmg: 200, splash: 120,
          });
          sfx('lob', 0.05);
        });
      }
    },
    draw(ctx, p, t) {
      const bend = sway(p, t, 0.04);
      const rec = easeOutElastic(clamp(1 - p.fireAnim, 0, 1));
      ctx.save();
      ctx.translate(p.x, p.y - 4);
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(-1.4 + i * 0.9);
        leaf(ctx, 0, -14, 50, 24);
        lit(ctx, -40, 0, '#6fce4e', '#3f8f27');
        outline(ctx, 4.5, OUT);
        ctx.restore();
      }
      ctx.translate(bend * 16, -58 - (1 - rec) * 12);
      ctx.rotate(-(1 - rec) * 0.25);
      blob(ctx, 0, 0, 45, 39, 5, 0.03, p.seed);
      ball(ctx, -8, -12, 48, '#7fd45e', '#3d8b2c');
      outline(ctx, 5.5, '#25501a');
      ctx.save();
      ctx.clip();
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 17 - 6, -44);
        ctx.quadraticCurveTo(i * 21, 0, i * 17 - 6, 44);
        outline(ctx, 7, 'rgba(28,80,20,.55)');
      }
      ctx.restore();
      glint(ctx, -16, -20, 13, 7, -0.6, 0.4);
      eye(ctx, -13, -4, 8, 0.35, 0, p.blink);
      eye(ctx, 13, -4, 8, 0.35, 0, p.blink);
      ctx.beginPath();
      ctx.arc(0, 12, 11, 0.25, Math.PI - 0.25);
      outline(ctx, 4, '#25501a');
      ctx.restore();
    },
  },
};

/**
 * Every defender role the engine knows how to run. A battle pack maps its own
 * cast onto these ids; the behaviour, tuning and balance live here so a new
 * matchup is names and artwork rather than new code.
 */
export const DEFENDER_ROLE_ORDER = [
  'producer', 'shooter', 'wall', 'mine', 'chiller', 'bomb',
  'repeater', 'brawler', 'producer2', 'trap', 'devourer', 'amplifier',
  'trishot', 'lobber',
];
