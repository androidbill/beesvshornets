// The invader roles: a stat block plus a fallback drawing each. The walking,
// eating and dying are shared and live in world.js, so a pack only supplies
// names, art and tuning.

import {
  clamp, circle, ellipse, blob, roundRect, outline, lit, ball, glint, eye,
} from './util.js';

import { sfx } from './audio.js';

const SKIN = ['#9fd07a', '#6ba24d'];
const SKIN_DARK = '#31541f';
const BONE = '#e8e2cf';

// ------------------------------------------------------------------ shared art

function legs(ctx, z, t, spread = 1) {
  const ph = z.walkT * 5.2;
  const swing = z.state === 'eat' ? 0.1 : Math.sin(ph);
  for (const side of [1, -1]) {
    const a = swing * side * 0.55 * spread;
    ctx.save();
    ctx.translate(side * 7, -34);
    ctx.rotate(a);
    roundRect(ctx, -8, 0, 16, 38, 8);
    lit(ctx, 0, 38, '#4a5a72', '#333f52');
    outline(ctx, 4.5, '#20293a');
    roundRect(ctx, -11, 30, 24, 13, 6);
    lit(ctx, 30, 43, '#5b4630', '#3b2c1c');
    outline(ctx, 4.5, '#231a10');
    ctx.restore();
  }
}

function arms(ctx, z, t, reach = 1) {
  const ph = z.walkT * 5.2;
  const chomp = z.state === 'eat' ? Math.sin(t * 13) * 0.12 : 0;
  for (let i = 0; i < 2; i++) {
    const lift = i ? 0.06 : -0.06;
    ctx.save();
    ctx.translate(-6 + i * 8, -78 + i * 5);
    ctx.rotate(-1.45 + lift + Math.sin(ph + i) * 0.06 + chomp);
    roundRect(ctx, -8, 0, 16, 46 * reach, 8);
    lit(ctx, 0, 46, i ? '#8ec46a' : '#9fd07a', '#5d8f42');
    outline(ctx, 4.5, SKIN_DARK);
    circle(ctx, 0, 46 * reach + 6, 11);
    ball(ctx, 0, 46 * reach + 6, 12, '#a8d884', '#6b9f4c');
    outline(ctx, 4.5, SKIN_DARK);
    ctx.restore();
  }
}

function torso(ctx, z, shirt = ['#5f7fb0', '#3f5a83'], hem = 5) {
  ctx.beginPath();
  ctx.moveTo(-24, -84);
  ctx.quadraticCurveTo(-30, -50, -26, -34);
  for (let i = 0; i <= hem; i++) {
    const x = -26 + (52 / hem) * i;
    ctx.lineTo(x, -34 + (i % 2 ? 9 : 0));
  }
  ctx.quadraticCurveTo(30, -52, 24, -84);
  ctx.closePath();
  lit(ctx, -84, -30, shirt[0], shirt[1]);
  outline(ctx, 5, '#22304a');
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(-2, -84); ctx.lineTo(-6, -40);
  outline(ctx, 3.4, '#22304a');
  ctx.restore();
}

function head(ctx, z, t, opts = {}) {
  const { jaw = 1, hair = true } = opts;
  const chomp = z.state === 'eat' ? (Math.sin(t * 13) * 0.5 + 0.5) : 0;
  ctx.save();
  ctx.translate(-4, -104);
  ctx.rotate(z.state === 'eat' ? -0.16 : Math.sin(z.walkT * 5.2) * 0.05);
  // jaw
  ctx.save();
  ctx.translate(-6, 16 + chomp * 7 * jaw);
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.quadraticCurveTo(-14, 20, 6, 19);
  ctx.quadraticCurveTo(20, 17, 20, 2);
  ctx.closePath();
  lit(ctx, 0, 20, '#8ec46a', '#5d8f42');
  outline(ctx, 4.5, SKIN_DARK);
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, -12 + i * 11, -2, 7, 8, 2);
    ctx.fillStyle = BONE;
    ctx.fill();
    outline(ctx, 2.4, SKIN_DARK);
  }
  ctx.restore();
  // skull
  blob(ctx, 0, 0, 30, 28, 6, 0.035, z.seed * 6);
  ball(ctx, -6, -8, 32, SKIN[0], SKIN[1]);
  outline(ctx, 5, SKIN_DARK);
  // brow + sunken eye
  ctx.save();
  ellipse(ctx, -12, -4, 13, 12);
  ctx.fillStyle = 'rgba(40,70,25,.45)';
  ctx.fill();
  ctx.restore();
  eye(ctx, -12, -4, 8.5, -0.5, 0.1, z.blink, '#f6ffe9');
  eye(ctx, 10, -6, 6, -0.5, 0.1, z.blink * 0.7, '#e6f3d6');
  // ear
  circle(ctx, 24, 2, 7);
  ctx.fillStyle = '#8ec46a';
  ctx.fill();
  outline(ctx, 3.6, SKIN_DARK);
  if (hair) {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-4 + i * 6, -26);
      ctx.quadraticCurveTo(-6 + i * 6, -40 - (i % 2) * 6, 4 + i * 6, -34 - (i % 2) * 6);
      outline(ctx, 4, '#2e3f26');
    }
  }
  ctx.restore();
}

function cone(ctx, dmg) {
  ctx.save();
  ctx.translate(-8, -132);
  ctx.beginPath();
  ctx.moveTo(-26, 6);
  ctx.lineTo(0, -50);
  ctx.lineTo(26, 6);
  ctx.closePath();
  lit(ctx, -50, 6, '#f19a3c', '#c46a1c');
  outline(ctx, 5, '#7d3d0c');
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(-16, -8); ctx.lineTo(16, -8);
  outline(ctx, 5, '#fbe0b8');
  ctx.restore();
  if (dmg > 0.35) {
    ctx.save();
    ctx.globalAlpha = clamp(dmg, 0, 1);
    ctx.beginPath();
    ctx.moveTo(-14, 4); ctx.lineTo(-4, -18); ctx.lineTo(-16, -26);
    outline(ctx, 4, '#7d3d0c');
    ctx.restore();
  }
  ctx.restore();
}

function bucket(ctx, dmg) {
  ctx.save();
  ctx.translate(-8, -128);
  ctx.beginPath();
  ctx.moveTo(-28, 8);
  ctx.lineTo(-23, -40);
  ctx.lineTo(23, -40);
  ctx.lineTo(28, 8);
  ctx.closePath();
  lit(ctx, -40, 8, '#c9d4dc', '#8b98a4');
  outline(ctx, 5, '#4a545e');
  roundRect(ctx, -26, -46, 52, 10, 5);
  ctx.fillStyle = '#aab6c1';
  ctx.fill();
  outline(ctx, 4.5, '#4a545e');
  glint(ctx, -14, -22, 6, 16, 0.1, 0.4);
  if (dmg > 0.3) {
    ctx.save();
    ctx.globalAlpha = clamp(dmg, 0, 1);
    ctx.beginPath();
    ctx.moveTo(10, 6); ctx.lineTo(2, -14); ctx.lineTo(16, -22); ctx.lineTo(6, -32);
    outline(ctx, 4, '#5c6873');
    ctx.restore();
  }
  ctx.restore();
}

function shieldDoor(ctx, dmg, kind) {
  ctx.save();
  ctx.translate(-44, -92);
  ctx.rotate(-0.05);
  if (kind === 'paper') {
    roundRect(ctx, -22, -34, 46, 70, 4);
    lit(ctx, -34, 36, '#f2ead4', '#cfc4a6');
    outline(ctx, 4.5, '#6d6349');
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(-16, -24 + i * 9); ctx.lineTo(16, -24 + i * 9);
      outline(ctx, 2.4, '#8a7f63');
    }
    ctx.restore();
  } else {
    roundRect(ctx, -26, -40, 52, 84, 6);
    lit(ctx, -40, 44, '#b7bfc4', '#7c868c');
    outline(ctx, 5, '#414a4f');
    roundRect(ctx, -18, -32, 36, 68, 4);
    ctx.fillStyle = 'rgba(210,235,240,.35)';
    ctx.fill();
    outline(ctx, 3.4, '#5c676d');
    ctx.save();
    ctx.globalAlpha = 0.45;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-18, i * 10); ctx.lineTo(18, i * 10);
      outline(ctx, 1.6, '#6f7c82');
      ctx.beginPath();
      ctx.moveTo(i * 6, -32); ctx.lineTo(i * 6, 36);
      outline(ctx, 1.6, '#6f7c82');
    }
    ctx.restore();
  }
  if (dmg > 0.4) {
    ctx.save();
    ctx.globalAlpha = clamp((dmg - 0.4) * 2, 0, 1);
    ctx.beginPath();
    ctx.moveTo(-14, -30); ctx.lineTo(2, -6); ctx.lineTo(-10, 8); ctx.lineTo(6, 30);
    outline(ctx, 3.6, kind === 'paper' ? '#8a7f63' : '#404a50');
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ roster

export const INVADER_ROLES = {

  grunt: {
    id: 'grunt', name: 'Shambler', hp: 200, speed: 26, dps: 55, cost: 1,
    blurb: 'The standard issue. Slow, dim, and never alone.',
    draw(ctx, z, t) { legs(ctx, z, t); torso(ctx, z); arms(ctx, z, t); head(ctx, z, t); },
  },

  armored: {
    id: 'armored', name: 'Cone Head', hp: 200, armor: 340, speed: 26, dps: 55, cost: 2,
    blurb: 'Found a traffic cone. Takes about three times the peas.',
    draw(ctx, z, t) {
      legs(ctx, z, t); torso(ctx, z, ['#6b7f5f', '#4a5b41']); arms(ctx, z, t); head(ctx, z, t, { hair: false });
      cone(ctx, 1 - z.armorHp / z.def.armor);
    },
  },

  armored2: {
    id: 'armored2', name: 'Bucket Head', hp: 200, armor: 900, speed: 25, dps: 55, cost: 4,
    blurb: 'A steel pail beats a traffic cone. Bring something explosive.',
    draw(ctx, z, t) {
      legs(ctx, z, t); torso(ctx, z, ['#7b6f8f', '#554b66']); arms(ctx, z, t); head(ctx, z, t, { hair: false });
      bucket(ctx, 1 - z.armorHp / z.def.armor);
    },
  },

  leader: {
    id: 'leader', name: 'Flag Bearer', hp: 200, speed: 34, dps: 55, cost: 1,
    blurb: 'Leads a wave in. Where there is one, there are twenty behind.',
    draw(ctx, z, t) {
      // flag first, behind the body
      ctx.save();
      ctx.translate(20, -96);
      ctx.rotate(0.2 + Math.sin(t * 2) * 0.04);
      ctx.beginPath();
      ctx.moveTo(0, 40); ctx.lineTo(0, -60);
      outline(ctx, 6, '#6b5637');
      const wv = Math.sin(t * 4);
      ctx.beginPath();
      ctx.moveTo(0, -58);
      ctx.quadraticCurveTo(24, -50 + wv * 6, 48, -58 - wv * 5);
      ctx.lineTo(48, -26 - wv * 5);
      ctx.quadraticCurveTo(24, -18 + wv * 6, 0, -26);
      ctx.closePath();
      lit(ctx, -58, -20, '#e34a4a', '#a92626');
      outline(ctx, 4.5, '#6d1717');
      ctx.restore();
      legs(ctx, z, t); torso(ctx, z, ['#9a5f5f', '#6f4141']); arms(ctx, z, t); head(ctx, z, t);
    },
  },

  shielded: {
    id: 'shielded', name: 'Screen Door', hp: 220, shield: 780, speed: 22, dps: 55, cost: 4,
    blurb: 'Peas bounce off the door. Lob over it, burn it, or hit it from behind.',
    shieldKind: 'door',
    draw(ctx, z, t) {
      legs(ctx, z, t); torso(ctx, z, ['#6d7a86', '#4b5560']); head(ctx, z, t);
      arms(ctx, z, t, 0.8);
      if (z.shieldHp > 0) shieldDoor(ctx, 1 - z.shieldHp / z.def.shield, 'door');
    },
  },

  rager: {
    id: 'rager', name: 'Tabloid', hp: 200, shield: 320, speed: 22, dps: 62, cost: 3,
    blurb: 'Reading the paper. Shred it and he gets very, very angry.',
    shieldKind: 'paper',
    onShieldBreak(z, w) {
      z.speed = z.def.speed * 3.2;
      z.rage = 1;
      sfx('groan');
      w.particles.paper(z.x - 40, z.y - 90);
    },
    draw(ctx, z, t) {
      legs(ctx, z, t, z.rage ? 1.5 : 1);
      torso(ctx, z, z.rage ? ['#b05252', '#7c3535'] : ['#8b8577', '#5f5a4f']);
      head(ctx, z, t);
      if (z.rage) {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(t * 12) * 0.2;
        circle(ctx, -8, -104, 40);
        outline(ctx, 4, '#ff7a4a');
        ctx.restore();
      }
      arms(ctx, z, t, z.rage ? 1.1 : 0.8);
      if (z.shieldHp > 0) shieldDoor(ctx, 1 - z.shieldHp / z.def.shield, 'paper');
    },
  },

  vaulter: {
    id: 'vaulter', name: 'Pole Vaulter', hp: 360, speed: 40, dps: 55, cost: 3,
    blurb: 'Jumps clean over your first plant. Whatever is second had better be good.',
    vault: true,
    draw(ctx, z, t) {
      legs(ctx, z, t, 1.25);
      torso(ctx, z, ['#d8d2c4', '#a49d8d']);
      head(ctx, z, t, { hair: true });
      arms(ctx, z, t, 0.7);
      if (!z.vaulted) {
        ctx.save();
        ctx.translate(-30, -70);
        ctx.rotate(z.state === 'vault' ? 1.2 : -0.35);
        ctx.beginPath();
        ctx.moveTo(0, -70); ctx.lineTo(0, 74);
        outline(ctx, 7, '#c9b48a');
        ctx.restore();
      }
    },
  },

  runt: {
    id: 'runt', name: 'Imp', hp: 140, speed: 54, dps: 40, cost: 1,
    small: true,
    blurb: 'Small, quick, and often arrives by air.',
    draw(ctx, z, t) {
      ctx.save();
      ctx.scale(0.62, 0.62);
      ctx.translate(0, 34);
      legs(ctx, z, t, 1.4);
      torso(ctx, z, ['#7d6bb0', '#544684']);
      arms(ctx, z, t, 0.9);
      head(ctx, z, t);
      ctx.restore();
    },
  },

  charger: {
    id: 'charger', name: 'Linebacker', hp: 340, armor: 1100, speed: 58, dps: 100, cost: 6,
    blurb: 'Fast and armoured. Slow him down or he is through the line.',
    draw(ctx, z, t) {
      legs(ctx, z, t, 1.4);
      ctx.save();
      ctx.scale(1.14, 1.08);
      torso(ctx, z, ['#c0392b', '#8e2820'], 4);
      ctx.restore();
      arms(ctx, z, t, 0.95);
      head(ctx, z, t, { hair: false });
      // helmet
      const dmg = 1 - z.armorHp / z.def.armor;
      ctx.save();
      ctx.translate(-8, -112);
      ctx.beginPath();
      ctx.arc(0, 0, 34, Math.PI * 0.98, Math.PI * 2.05);
      ctx.lineTo(30, 12);
      ctx.lineTo(-30, 12);
      ctx.closePath();
      lit(ctx, -34, 12, '#e2564a', '#a12b22');
      outline(ctx, 5, '#5d1611');
      ctx.beginPath();
      ctx.moveTo(-2, -34); ctx.lineTo(-2, 6);
      outline(ctx, 5, '#f4f0e6');
      ctx.beginPath();
      ctx.moveTo(-34, 6);
      ctx.quadraticCurveTo(-44, 22, -26, 30);
      outline(ctx, 6, '#e8e2cf');
      if (dmg > 0.4) {
        ctx.save();
        ctx.globalAlpha = clamp((dmg - 0.4) * 2, 0, 1);
        ctx.beginPath();
        ctx.moveTo(12, -26); ctx.lineTo(20, -8); ctx.lineTo(8, 2);
        outline(ctx, 4, '#5d1611');
        ctx.restore();
      }
      ctx.restore();
    },
  },

  giant: {
    id: 'giant', name: 'Gargantuar', hp: 3200, speed: 20, dps: 0, cost: 12,
    crusher: true, big: true, throwsImp: true,
    blurb: 'Does not eat plants. Flattens them. Halfway down it throws an Imp at your back line.',
    draw(ctx, z, t) {
      const s = 1.62;
      ctx.save();
      ctx.scale(s, s);
      ctx.translate(0, 8);
      legs(ctx, z, t, 0.8);
      ctx.save();
      ctx.scale(1.25, 1.16);
      torso(ctx, z, ['#4c5f78', '#2f3d4f'], 4);
      ctx.restore();
      // club arm
      const swing = z.smash > 0 ? Math.sin(clamp(1 - z.smash / 0.5, 0, 1) * Math.PI) : 0;
      ctx.save();
      ctx.translate(-14, -86);
      ctx.rotate(-0.5 - swing * 1.5 + Math.sin(z.walkT * 4) * 0.08);
      roundRect(ctx, -10, 0, 20, 54, 9);
      lit(ctx, 0, 54, '#9fd07a', '#5d8f42');
      outline(ctx, 5, SKIN_DARK);
      ctx.translate(0, 60);
      ctx.rotate(0.4);
      roundRect(ctx, -13, -8, 26, 76, 8);
      lit(ctx, -8, 68, '#a97c48', '#6a4a26');
      outline(ctx, 5.5, '#3a2612');
      for (let i = 0; i < 3; i++) {
        circle(ctx, -4 + (i % 2) * 8, 10 + i * 20, 4);
        ctx.fillStyle = '#4a3018';
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.translate(6, -78);
      ctx.rotate(-1.2);
      roundRect(ctx, -9, 0, 18, 50, 8);
      lit(ctx, 0, 50, '#8ec46a', '#5d8f42');
      outline(ctx, 4.5, SKIN_DARK);
      ctx.restore();
      ctx.save();
      ctx.scale(1.3, 1.3);
      ctx.translate(0, -18);
      head(ctx, z, t, { hair: true });
      ctx.restore();
      ctx.restore();
    },
  },
};

/** Every invader role the engine knows how to run. See defender-roles.js. */
export const INVADER_ROLE_ORDER = [
  'grunt', 'leader', 'armored', 'armored2', 'vaulter', 'rager',
  'shielded', 'runt', 'charger', 'giant',
];
