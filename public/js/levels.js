// The campaign. Waves are generated at run time from a budget and a zombie
// pool, so a level is a short row of numbers rather than a hand-typed script.

import { ZOMBIES } from './zombies.js';

export const WORLDS = [
  { id: 'day', name: 'Front Lawn', scene: 'day', from: 1, to: 7,
    tagline: 'Sunny, quiet, and about to stop being either.' },
  { id: 'night', name: 'Midnight Yard', scene: 'night', from: 8, to: 14,
    tagline: 'No sun falls after dark. Graves, though — plenty of those.' },
  { id: 'dusk', name: 'Sunset Terrace', scene: 'dusk', from: 15, to: 20,
    tagline: 'Fog on the far side and something enormous behind it.' },
];

const L = (id, o) => ({
  id,
  scene: 'day',
  slots: 6,
  sun: 50,
  waves: 10,
  flagEvery: 5,
  rate: 1,
  rows: [0, 1, 2, 3, 4],
  pool: ['shambler'],
  graves: 0,
  fog: 0,
  unlock: null,
  ...o,
});

export const LEVELS = [
  // ------------------------------------------------- world 1: Front Lawn
  L(1, {
    title: 'A Bit of Weather',
    intro: 'One lane. One kind of zombie. Plant sunflowers, then a peashooter.',
    rows: [2], slots: 2, waves: 6, flagEvery: 6, rate: 0.55, sun: 100,
    pool: ['shambler'], unlock: 'wallnut',
  }),
  L(2, {
    title: 'Three Lanes Wide',
    intro: 'Wall Nut is yours. Put it in front of something worth protecting.',
    rows: [1, 2, 3], slots: 3, waves: 8, rate: 0.7,
    pool: ['shambler', 'cone'], unlock: 'potatomine',
  }),
  L(3, {
    title: 'The Whole Lawn',
    intro: 'All five lanes now. Potato Mine is cheap — use it when you are caught short.',
    slots: 4, waves: 9, rate: 0.85,
    pool: ['shambler', 'cone'], unlock: 'frostpea',
  }),
  L(4, {
    title: 'Cold Front',
    intro: 'Frost Pea halves their speed. One per lane changes everything.',
    slots: 5, waves: 10, rate: 1,
    pool: ['shambler', 'cone', 'bucket'], unlock: 'cherrybomb',
  }),
  L(5, {
    title: 'Bucket Brigade',
    intro: 'Steel pails soak peas. Cherry Bomb does not care about pails.',
    slots: 5, waves: 11, rate: 1.15,
    pool: ['shambler', 'cone', 'bucket', 'polevault'], unlock: 'repeater',
  }),
  L(6, {
    title: 'Over the Top',
    intro: 'Pole Vaulters clear your front plant. Give them two things to get past.',
    slots: 5, waves: 11, rate: 1.3,
    pool: ['shambler', 'cone', 'bucket', 'polevault', 'tabloid'], unlock: 'bonkchoy',
  }),
  L(7, {
    title: 'Read All About It',
    intro: 'Bonk Choy hits hard but only next door. Wall it and let it swing.',
    slots: 6, waves: 12, rate: 1.45,
    pool: ['shambler', 'cone', 'bucket', 'polevault', 'tabloid', 'screendoor'],
    unlock: 'twinsun',
  }),

  // ---------------------------------------------- world 2: Midnight Yard
  L(8, {
    title: 'Lights Out',
    scene: 'night', slots: 6, waves: 10, rate: 1.2, sun: 100, graves: 3,
    intro: 'No sun falls at night. Twin Sun pays for itself — and mind the graves.',
    pool: ['shambler', 'cone', 'bucket', 'screendoor'], unlock: 'spikeweed',
  }),
  L(9, {
    title: 'Underfoot',
    scene: 'night', slots: 6, waves: 11, rate: 1.35, sun: 100, graves: 4,
    intro: 'Spikeweed sits flat and shreds anything that walks over it.',
    pool: ['shambler', 'cone', 'bucket', 'polevault', 'imp'], unlock: 'chomper',
  }),
  L(10, {
    title: 'Something Purple',
    scene: 'night', slots: 6, waves: 12, rate: 1.5, sun: 100, graves: 4,
    intro: 'Chomper swallows one zombie whole, then chews for twelve long seconds.',
    pool: ['shambler', 'cone', 'bucket', 'tabloid', 'screendoor', 'imp'],
    unlock: 'emberwood',
  }),
  L(11, {
    title: 'Kindling',
    scene: 'night', slots: 6, waves: 12, rate: 1.65, sun: 100, graves: 5,
    intro: 'Peas fired through Emberwood come out on fire: double damage and splash.',
    pool: ['shambler', 'cone', 'bucket', 'polevault', 'screendoor', 'linebacker'],
    unlock: 'threepeater',
  }),
  L(12, {
    title: 'Three at Once',
    scene: 'night', slots: 7, waves: 13, rate: 1.8, sun: 75, graves: 5,
    intro: 'Threepeater covers three lanes from the middle row.',
    pool: ['shambler', 'cone', 'bucket', 'polevault', 'tabloid', 'linebacker', 'imp'],
  }),
  L(13, {
    title: 'The Big One',
    scene: 'night', slots: 7, waves: 13, rate: 1.95, sun: 75, graves: 6,
    intro: 'Something enormous is out there. It does not eat plants — it flattens them.',
    pool: ['shambler', 'cone', 'bucket', 'screendoor', 'linebacker', 'gargantuar'],
    unlock: 'melon',
  }),
  L(14, {
    title: 'Graveyard Shift',
    scene: 'night', slots: 7, waves: 14, rate: 2.1, sun: 75, graves: 7,
    intro: 'Melon Lobber arcs over walls and splashes everything around the hit.',
    pool: ['shambler', 'cone', 'bucket', 'polevault', 'tabloid', 'screendoor', 'linebacker', 'imp', 'gargantuar'],
  }),

  // --------------------------------------------- world 3: Sunset Terrace
  L(15, {
    title: 'Long Shadows',
    scene: 'dusk', slots: 7, waves: 13, rate: 2.2, fog: 2,
    intro: 'Fog on the far columns. You will hear them before you see them.',
    pool: ['shambler', 'cone', 'bucket', 'polevault', 'screendoor', 'linebacker'],
  }),
  L(16, {
    title: 'Thick Air',
    scene: 'dusk', slots: 8, waves: 14, rate: 2.4, fog: 3,
    intro: 'An eighth seed slot. You are going to want all of it.',
    pool: ['shambler', 'cone', 'bucket', 'tabloid', 'screendoor', 'linebacker', 'imp'],
  }),
  L(17, {
    title: 'Iron and Steel',
    scene: 'dusk', slots: 8, waves: 14, rate: 2.6, fog: 3,
    intro: 'Buckets and doors, most of the way down. Bring something that burns.',
    pool: ['bucket', 'screendoor', 'cone', 'linebacker', 'polevault', 'shambler'],
  }),
  L(18, {
    title: 'Blitz',
    scene: 'dusk', slots: 8, waves: 15, rate: 2.8, fog: 3,
    intro: 'Fast ones. Lots of them. Slow the lanes down or lose them.',
    pool: ['linebacker', 'polevault', 'imp', 'cone', 'bucket', 'tabloid', 'shambler'],
  }),
  L(19, {
    title: 'Heavy Traffic',
    scene: 'dusk', slots: 8, waves: 15, rate: 3, fog: 4,
    intro: 'Two giants at a time is normal from here.',
    pool: ['gargantuar', 'bucket', 'screendoor', 'linebacker', 'cone', 'imp', 'shambler'],
  }),
  L(20, {
    title: 'Last Light',
    scene: 'dusk', slots: 8, waves: 18, rate: 3.4, fog: 4, sun: 75,
    intro: 'Everything they have, all at once. Hold the lawn.',
    pool: ['gargantuar', 'linebacker', 'bucket', 'screendoor', 'polevault', 'tabloid', 'cone', 'imp', 'shambler'],
  }),
];

export const LAST_LEVEL = LEVELS.length;
export const getLevel = (id) => LEVELS.find((l) => l.id === id) || LEVELS[0];
export const worldOf = (id) => WORLDS.find((w) => id >= w.from && id <= w.to) || WORLDS[0];

/** Endless mode: the difficulty just keeps climbing. */
export const SURVIVAL = {
  id: 0, title: 'Survival', scene: 'dusk', slots: 8, sun: 150,
  waves: Infinity, flagEvery: 5, rate: 1, rows: [0, 1, 2, 3, 4], graves: 0, fog: 2,
  intro: 'No end. How many waves can you hold?',
  pool: ['shambler', 'cone', 'bucket', 'polevault', 'tabloid', 'screendoor', 'linebacker', 'imp', 'gargantuar'],
  survival: true,
};

// ------------------------------------------------------------ wave building

/**
 * Turn a wave number into a list of zombie ids. Each wave has a points budget;
 * the generator spends it on the most expensive things it can afford first so
 * late waves feel heavy rather than just numerous.
 */
export function buildWave(level, waveNo, rng = Math.random) {
  const flag = level.flagEvery && waveNo % level.flagEvery === 0;
  const last = Number.isFinite(level.waves) && waveNo === level.waves;
  const growth = level.survival
    ? 2.4 + waveNo * 1.35 + Math.pow(waveNo, 1.55) * 0.16
    : 1.6 + (waveNo - 1) * 1.25;
  let budget = growth * level.rate * (flag ? 1.9 : 1) * (last ? 3.2 : 1);

  // What is actually allowed to show up this early
  const unlockAt = { bucket: 3, screendoor: 3, linebacker: 4, gargantuar: 6, tabloid: 2, polevault: 2 };
  const pool = level.pool.filter((id) => waveNo >= (unlockAt[id] || 1) || level.survival);
  const affordable = () => pool.filter((id) => ZOMBIES[id].cost <= budget);

  const out = [];
  if (flag) out.push('flag');
  let guard = 0;
  while (budget >= 1 && guard++ < 80) {
    const can = affordable();
    if (!can.length) break;
    // bias toward the pricier end as waves get bigger
    const sorted = can.slice().sort((a, b) => ZOMBIES[b].cost - ZOMBIES[a].cost);
    const bias = Math.pow(rng(), last ? 0.8 : 1.7);
    const id = sorted[Math.min(sorted.length - 1, Math.floor(bias * sorted.length))];
    out.push(id);
    budget -= ZOMBIES[id].cost;
  }
  if (!out.length) out.push('shambler');
  return out;
}

/** Seconds to wait before the next wave arrives. */
export function waveGap(level, waveNo) {
  const flag = level.flagEvery && waveNo % level.flagEvery === 0;
  const base = level.survival ? 20 : 24 - Math.min(9, waveNo * 0.55);
  return Math.max(11, base * (flag ? 1.25 : 1));
}
