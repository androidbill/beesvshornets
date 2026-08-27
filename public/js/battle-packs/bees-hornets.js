// Bees vs Hornets — the first data-driven battle pack.
// The combat callbacks currently adapt the proven prototype simulation while
// all identity, tuning, art and progression live here as replaceable content.

import { PLANTS as LEGACY_DEFENDERS } from '../plants.js';
import { ZOMBIES as LEGACY_INVADERS } from '../zombies.js';
import { drawCreature } from '../creature.js';
import { cellCX, groundY } from '../config.js';
import { rnd } from '../util.js';

const beeBody = (fill = ['#ffd85b', '#e39a1f'], size = 1) => ({
  scale: size, bobAmp: 4,
  back: [{ p: 'wings', x: -8, y: -66, len: 58, thin: .23, fill: ['#effcff', '#9edceb'], stroke: '#52818d', a: .68 }],
  body: { shape: 'egg', cx: 0, cy: -62, rx: 34, ry: 42, fill, stroke: '#493414' },
  parts: [
    { p: 'marks', style: 'stripes', y: -60, gap: 16, w: 19, h: 25, thick: 10, color: '#493414', a: .9 },
    { p: 'antennae', y: -96, spread: 10, len: 25, color: '#493414', tip: '#ffd85b' },
    { p: 'eyes', y: -73, r: 8, gap: 22, lookX: .45 },
    { p: 'mouth', y: -52, w: 10 },
    { p: 'legs', style: 'insect', y: -38, len: 27, spread: 12, fill: ['#5a4221', '#34250f'] },
  ],
});

const hornetBody = (fill = ['#ffbf3f', '#b8681d'], size = 1) => ({
  scale: size, bobAmp: 5,
  back: [{ p: 'wings', x: -10, y: -68, len: 62, thin: .18, hz: 31, fill: ['#e7f7ef', '#88c8c7'], stroke: '#365e62', a: .58 }],
  body: { shape: 'drop', cx: 0, cy: -63, rx: 31, ry: 45, fill, stroke: '#3b2417' },
  parts: [
    { p: 'marks', style: 'stripes', y: -61, gap: 14, w: 18, h: 26, thick: 9, color: '#3b2417', a: .95 },
    { p: 'antennae', y: -98, spread: 10, len: 29, color: '#3b2417', tip: '#e98328' },
    { p: 'eyes', y: -75, r: 9, gap: 22, style: 'angry', brow: '#3b2417' },
    { p: 'mouth', y: -50, w: 11, style: 'fangs' },
    { p: 'legs', style: 'insect', y: -38, len: 30, spread: 12, fill: ['#4d2f1c', '#2c190f'] },
  ],
});

function withParts(spec, ...parts) { return { ...spec, parts: [...spec.parts, ...parts] }; }
function paintDefender(spec) {
  return (ctx, unit, t) => {
    ctx.save(); ctx.translate(unit.x, unit.y);
    drawCreature(ctx, spec, { t, walk: unit.t * .1, fire: unit.fireAnim || unit.punch || 0, act: unit.foodT || 0, blink: unit.blink, seed: unit.seed });
    ctx.restore();
  };
}
function paintInvader(spec) {
  return (ctx, unit, t) => drawCreature(ctx, spec, {
    t, walk: unit.walkT * .15, act: unit.state === 'eat' ? .85 : unit.smash || 0,
    blink: unit.blink, seed: unit.seed, rage: unit.rage > 0,
    armorDmg: unit.def.armor ? 1 - unit.armorHp / unit.def.armor : 1,
    shieldDmg: unit.def.shield ? 1 - unit.shieldHp / unit.def.shield : 1,
  });
}

const defender = (id, legacyId, meta, spec, extra = {}) => ({
  ...LEGACY_DEFENDERS[legacyId], id, theme: 'bees-hornets', rarity: meta.rarity || 'common',
  unlockRequirement: meta.unlockRequirement || 1, animationSet: 'winged', soundSet: 'bee',
  ...meta, ...extra, draw: paintDefender(spec),
});

const nectarSpec = withParts(beeBody(['#ffe76f', '#e6a722']), { p: 'petals', y: -62, r: 38, len: 16, w: 8, n: 9, fill: ['#fff19b', '#ffbd42'], stroke: '#83551c' });
const workerSpec = withParts(beeBody(), { p: 'emitter', style: 'stinger', x: 29, y: -64, s: .72, fill: ['#f6d15b', '#8a5a1f'], stroke: '#493414' });
const bumbleSpec = withParts(beeBody(['#ffd348', '#ba741e'], 1.18), { p: 'shield', style: 'round', x: 32, y: -66, fill: ['#ffe18a', '#b97921'], stroke: '#5d3a16' });
const guardSpec = withParts(beeBody(['#f7c83b', '#c47c1c']), { p: 'hat', style: 'helm', y: -102, r: 29, fill: ['#d8e6ea', '#8298a0'] }, { p: 'emitter', style: 'stinger', x: 30, y: -58, s: .82, fill: ['#d8e6ea', '#6e858e'] });
const stingerSpec = withParts(beeBody(['#ffd65a', '#d57f1c']), { p: 'emitter', style: 'stinger', x: 34, y: -66, s: 1.05, fill: ['#ffe58a', '#7c4d20'], stroke: '#3b2814' }, { p: 'aura', y: -63, r: 64, color: '#ffcb4c', a: .14 });
const healerSpec = withParts(beeBody(['#ffe995', '#e7ae35']), { p: 'hat', style: 'halo', y: -108, fill: ['#fff3a4'] }, { p: 'aura', y: -62, r: 78, color: '#9bffbd', a: .26 });
const bomberSpec = withParts(beeBody(['#f8c84a', '#b97620']), { p: 'carry', style: 'pack', x: -28, y: -72, fill: ['#c97cd5', '#713d91'] }, { p: 'emitter', style: 'cannon', x: 28, y: -66, s: .72, fill: ['#ce85dc', '#6d3a8c'] });
const royalSpec = withParts(beeBody(['#fff08b', '#d89722'], 1.12), { p: 'hat', style: 'crown', y: -112 }, { p: 'emitter', style: 'cannon', x: 30, y: -65, s: .85, fill: ['#f3d873', '#95611c'] }, { p: 'aura', y: -64, r: 82, color: '#ffe270', a: .2 });

export const DEFENDERS = {
  nectarBee: defender('nectarBee', 'sunflower', { name: 'Nectar Bee', description: 'Gathers nectar that funds the whole hive.', blurb: 'Produces 25 Nectar regularly.', role: 'Generator', cost: 50, rarity: 'common' }, nectarSpec),
  workerBee: defender('workerBee', 'peashooter', { name: 'Worker Bee', description: 'A dependable pollen-shot attacker.', blurb: 'Reliable ranged damage in one lane.', role: 'Attacker', cost: 100, rarity: 'common' }, workerSpec),
  bumbleGuard: defender('bumbleGuard', 'wallnut', { name: 'Bumble Guard', description: 'A fluffy wall with a stubborn streak.', blurb: 'Soaks up damage and protects the row.', role: 'Tank', cost: 75, rarity: 'common', unlockRequirement: 2 }, bumbleSpec),
  guardBee: defender('guardBee', 'bonkchoy', { name: 'Guard Bee', description: 'Swats anything that enters its airspace.', blurb: 'Devastating at close range.', role: 'Brawler', cost: 150, rarity: 'uncommon', unlockRequirement: 3 }, guardSpec),
  stingerBee: defender('stingerBee', 'repeater', { name: 'Stinger Bee', description: 'Fires paired royal-jelly darts.', blurb: 'Fast double-shot ranged attacker.', role: 'Rapid', cost: 200, rarity: 'uncommon', unlockRequirement: 3 }, stingerSpec),
  honeyHealer: defender('honeyHealer', 'sunflower', { name: 'Honey Healer', description: 'Restores nearby hive defenders.', blurb: 'Heals its row instead of gathering.', role: 'Support', cost: 125, recharge: 10, rarity: 'rare', unlockRequirement: 4 }, healerSpec, {
    place(p) { p.cd = 5; },
    update(p, dt, w) { p.cd -= dt; if (p.cd > 0) return; p.cd = 9; for (const ally of w.plants) if (ally.row === p.row && Math.abs(ally.col - p.col) <= 2) ally.hp = Math.min(ally.maxHp, ally.hp + 65); w.particles.sparkle(p.x, p.y - 55, '#9bffbd', 12); },
  }),
  pollenBomber: defender('pollenBomber', 'cherrybomb', { name: 'Pollen Bomber', description: 'Drops a volatile pollen charge.', blurb: 'One-use blast across nearby lanes.', role: 'Area Blast', cost: 150, rarity: 'rare', unlockRequirement: 5 }, bomberSpec),
  royalDefender: defender('royalDefender', 'melon', { name: 'Royal Defender', description: 'Lobs heavy honeycombs into clustered enemies.', blurb: 'Slow, powerful splash damage.', role: 'Heavy', cost: 300, rarity: 'epic', unlockRequirement: 6 }, royalSpec),
};

export const DEFENDER_ORDER = ['nectarBee', 'workerBee', 'bumbleGuard', 'guardBee', 'stingerBee', 'honeyHealer', 'pollenBomber', 'royalDefender'];

const invader = (id, legacyId, meta, spec, extra = {}) => ({
  ...LEGACY_INVADERS[legacyId], id, theme: 'bees-hornets', soundSet: 'hornet', ...meta, ...extra, draw: paintInvader(spec),
});
const scoutSpec = hornetBody();
const workerHornetSpec = withParts(hornetBody(['#f0a82f', '#95501a']), { p: 'emitter', style: 'stinger', x: 28, y: -62, s: .75, fill: ['#d7bb6a', '#5c391b'] });
const fastSpec = withParts(hornetBody(['#ffdb4d', '#d76a20'], .82), { p: 'aura', y: -63, r: 62, color: '#ff9e45', a: .13 });
const armorSpec = withParts(hornetBody(), { p: 'armor', style: 'shellB', x: 0, y: -106, when: 'armor', fill: ['#a8bdc5', '#5f747c'], stroke: '#34484e' });
const diveSpec = withParts(hornetBody(['#ffcf46', '#b84d20'], .72), { p: 'emitter', style: 'stinger', x: 30, y: -61, s: .9, fill: ['#fff0a5', '#7c3b20'] });
const shieldSpec = withParts(hornetBody(['#efac35', '#884318']), { p: 'shield', style: 'round', x: -38, y: -69, when: 'shield', fill: ['#c9dce1', '#647e85'], stroke: '#354b50' });
const captainSpec = withParts(hornetBody(['#e8922b', '#73351a'], 1.12), { p: 'carry', style: 'banner', x: 24, y: -94, fill: ['#b93434', '#661b24'] }, { p: 'hat', style: 'band', y: -105, fill: ['#c63939'] });
const queenSpec = withParts(hornetBody(['#f2a62e', '#783719'], 1.48), { p: 'hat', style: 'crown', y: -113 }, { p: 'carry', style: 'club', x: 22, y: -98, fill: ['#7c4b27', '#3d2213'] }, { p: 'aura', y: -67, r: 90, color: '#e44d42', a: .2 });

export const INVADERS = {
  scoutHornet: invader('scoutHornet', 'shambler', { name: 'Scout Hornet', blurb: 'A steady frontline intruder.', cost: 1 }, scoutSpec),
  workerHornet: invader('workerHornet', 'flag', { name: 'Worker Hornet', blurb: 'Calls the swarm forward.', cost: 1 }, workerHornetSpec),
  fastWasp: invader('fastWasp', 'polevault', { name: 'Fast Wasp', blurb: 'Dashes over the first blocker.', cost: 2 }, fastSpec),
  armoredHornet: invader('armoredHornet', 'cone', { name: 'Armored Hornet', blurb: 'Wears scavenged beetle-shell armor.', cost: 2 }, armorSpec),
  diveWasp: invader('diveWasp', 'imp', { name: 'Dive Wasp', blurb: 'Tiny, fast and easily underestimated.', cost: 2 }, diveSpec),
  shieldHornet: invader('shieldHornet', 'screendoor', { name: 'Shield Hornet', blurb: 'Blocks direct pollen shots.', cost: 4, shieldKind: 'shell' }, shieldSpec),
  hornetCaptain: invader('hornetCaptain', 'linebacker', { name: 'Hornet Captain', blurb: 'Gets faster when its armor breaks.', cost: 5 }, captainSpec),
  hornetQueen: invader('hornetQueen', 'gargantuar', { name: 'Hornet Queen', blurb: 'The towering queen of the hostile nest.', cost: 10, boss: true, throwsImp: true }, queenSpec),
};

export const INVADER_ORDER = ['scoutHornet', 'workerHornet', 'fastWasp', 'armoredHornet', 'diveWasp', 'shieldHornet', 'hornetCaptain', 'hornetQueen'];

export function makeDefender(id, col, row) {
  const def = DEFENDERS[id];
  const unit = { def, id, col, row, x: cellCX(col), y: groundY(row), hp: def.hp, maxHp: def.hp, cd: 0, t: 0, seed: Math.random(), blink: 1, blinkT: rnd(5, 1), hurt: 0, wob: 0, armorT: 0, food: 0, born: 0, dead: false, burst: 0, burstT: 0, flurry: 0 };
  def.place?.(unit); return unit;
}
export function stubDefender(id) { const def = DEFENDERS[id]; return { def, id, col: 0, row: 0, x: 0, y: 0, hp: def.hp, maxHp: def.hp, cd: 99, t: 0, seed: .4, blink: 1, hurt: 0, foodT: 0, fireAnim: 0, punch: 0, armed: true, fuse: 1.05, burst: 0 }; }
export function makeInvader(id, row, x, opts = {}) { const def = INVADERS[id]; return { def, id, row, x, y: groundY(row), hp: def.hp, maxHp: def.hp, armorHp: def.armor || 0, shieldHp: def.shield || 0, speed: def.speed, state: 'walk', walkT: rnd(6), seed: Math.random(), blink: 1, blinkT: rnd(5, 1), chill: 0, frozen: 0, burn: 0, knock: 0, hurtT: 0, dead: false, dying: 0, hittable: true, eatT: 0, target: null, vaulted: false, rage: 0, smash: 0, carriesFood: !!opts.carriesFood, thrown: false, bob: 0, ...opts }; }

export const BEES_VS_HORNETS = {
  id: 'bees-hornets', displayName: 'Bees vs Hornets', shortName: 'Garden War',
  resource: { id: 'nectar', name: 'Nectar', icon: 'drop', color: '#ffd75d' },
  accent: '#ffd75d', dark: '#193b31', defenders: DEFENDERS, defenderOrder: DEFENDER_ORDER,
  invaders: INVADERS, invaderOrder: INVADER_ORDER,
  battlefield: { id: 'bloom-garden', name: 'Bloom Garden', environment: 'wind' },
};
