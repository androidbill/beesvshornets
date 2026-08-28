// BEE_WORLD was a leftover from an earlier multi-world menu (see the project
// README - this pack now IS the whole game, so its name and tagline live
// directly in index.html rather than as unused duplicate data here.
import { INVADERS } from './bees-hornets.js';

const level = (id, data) => ({
  id, pack: 'bees-hornets', scene: 'day', slots: 6, nectar: 75, sun: 75,
  waves: 8, flagEvery: 4, rate: 1, rows: [0, 1, 2, 3, 4], pool: ['scoutHornet'],
  environment: 'wind', powers: { freeze: 1, blast: 1, rally: 1 }, ...data,
});

export const BEE_LEVELS = [
  level(1, { title: 'First Flight', intro: 'Choose Worker Bee, then place it in the glowing middle lane.', rows: [2], slots: 2, nectar: 150, sun: 150, waves: 5, flagEvery: 5, rate: .58, pool: ['scoutHornet'] }),
  level(2, { title: 'Sweet Supply', intro: 'Nectar Bees fund your defense. Build your economy before the swarm arrives.', rows: [1, 2, 3], slots: 3, waves: 7, rate: .75, pool: ['scoutHornet', 'workerHornet'] }),
  level(3, { title: 'Wasp Rush', intro: 'Fast Wasps vault the first defender they meet. Layer your formation.', slots: 4, waves: 8, rate: .95, pool: ['scoutHornet', 'workerHornet', 'fastWasp'] }),
  level(4, { title: 'Shell Game', intro: 'Armored Hornets absorb light attacks. Focus fire or let Guard Bees brawl.', slots: 5, waves: 9, rate: 1.15, pool: ['scoutHornet', 'fastWasp', 'armoredHornet', 'diveWasp'] }),
  level(5, { title: 'Battle for the Blooms', intro: 'A mixed swarm is coming. Bring healing, blockers and something explosive.', slots: 6, waves: 11, rate: 1.45, pool: ['scoutHornet', 'workerHornet', 'fastWasp', 'armoredHornet', 'diveWasp', 'shieldHornet', 'hornetCaptain'] }),
  level(6, { title: 'Queen of the Nest', intro: 'The Hornet Queen summons hornets, relocates lanes, then dive-charges. Watch her health bar for the next phase.', slots: 6, nectar: 125, sun: 125, waves: 10, flagEvery: 5, rate: 1.7, boss: 'hornetQueen', powers: { freeze: 2, blast: 1, rally: 1 }, pool: ['scoutHornet', 'armoredHornet', 'diveWasp', 'shieldHornet', 'hornetCaptain', 'hornetQueen'] }),
];

export const BEE_SURVIVAL = level(0, { title: 'Endless Swarm', intro: 'No final wave. How long can your hive hold?', slots: 6, nectar: 175, sun: 175, waves: Infinity, flagEvery: 5, rate: 1.1, survival: true, powers: { freeze: 2, blast: 2, rally: 2 }, pool: Object.keys(INVADERS) });

export function buildWave(levelData, waveNo, rng = Math.random) {
  const flag = levelData.flagEvery && waveNo % levelData.flagEvery === 0;
  const final = Number.isFinite(levelData.waves) && waveNo === levelData.waves;
  const growth = levelData.survival ? 2.2 + waveNo * 1.25 + Math.pow(waveNo, 1.5) * .14 : 1.5 + (waveNo - 1) * 1.15;
  let budget = growth * levelData.rate * (flag ? 1.75 : 1) * (final ? 2.7 : 1);
  const unlockAt = { fastWasp: 2, armoredHornet: 3, shieldHornet: 4, hornetCaptain: 5, hornetQueen: levelData.waves || 8 };
  let pool = levelData.pool.filter((id) => waveNo >= (unlockAt[id] || 1) || levelData.survival);
  if (final && levelData.boss) pool = pool.filter((id) => id !== levelData.boss);
  const out = flag ? ['workerHornet'] : [];
  let guard = 0;
  while (budget >= 1 && guard++ < 70) {
    const choices = pool.filter((id) => INVADERS[id].cost <= budget);
    if (!choices.length) break;
    const sorted = choices.slice().sort((a, b) => INVADERS[b].cost - INVADERS[a].cost);
    const id = sorted[Math.min(sorted.length - 1, Math.floor(Math.pow(rng(), 1.55) * sorted.length))];
    out.push(id); budget -= INVADERS[id].cost;
  }
  if (final && levelData.boss) out.push(levelData.boss);
  if (!out.length) out.push('scoutHornet');
  return out;
}

export function waveGap(levelData, waveNo) {
  const flag = levelData.flagEvery && waveNo % levelData.flagEvery === 0;
  const base = levelData.survival ? 19 : 22 - Math.min(8, waveNo * .55);
  return Math.max(10, base * (flag ? 1.2 : 1));
}
