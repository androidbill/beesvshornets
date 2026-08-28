// Headless balance check. Nobody has actually played the real economy since
// the debug shortcuts (unlimited nectar, zero cooldowns) were removed, so
// this drives every campaign level and Survival through the real simulation
// with a deliberately simple heuristic bot — not to prove the levels are
// beatable by a clever player, but to catch the things eyeballing the numbers
// can't: a level that's mathematically unwinnable, a producer that never
// pays for itself in time, a wave budget that spikes far past what the
// income curve can support.
//
// The bot is intentionally dumb: fund an economy, spread front-line defenders
// across the open lanes, use powers when things look bad. It plays through
// the real World simulation via the real rules (packet cooldowns, costs,
// row restrictions) — nothing here bypasses what a human player would face.
//
// Usage: node scripts/bot-tournament.mjs [runsPerLevel]

import { World, STEP } from '../public/js/world.js';
import { BEE_LEVELS, BEE_SURVIVAL } from '../public/js/battle-packs/bees-hornets-levels.js';
import { DEFENDERS, DEFENDER_ORDER } from '../public/js/battle-packs/bees-hornets.js';
import { layout, cellCX, groundY } from '../public/js/config.js';

// world.js's imported config.js singleton needs its layout computed exactly
// once, the same way main.js's resize() does for a 16:9 window — otherwise
// world.colAt/rowAt (which the bot relies on indirectly through tapLawn)
// disagree with the coordinates the bot is clicking at.
layout(1600 / 900);

const RUNS = Number(process.argv[2]) || 5;
const MAX_SIM_SECONDS = 20 * 60; // give any level 20 simulated minutes before calling it a stalemate
const DECIDE_EVERY = 0.5; // the bot only "looks" at the board twice a second, like a person would

function availableDefenders(levelId) {
  return DEFENDER_ORDER.filter((id) => DEFENDERS[id].unlockRequirement <= Math.max(1, levelId));
}

function pickLoadout(level) {
  const pool = availableDefenders(level.survival ? 6 : level.id);
  const producers = pool.filter((id) => DEFENDERS[id].role === 'Generator');
  const rest = pool.filter((id) => DEFENDERS[id].role !== 'Generator');
  // One producer is close to mandatory economy; the rest fills out with
  // whatever else has unlocked, cheapest first so early levels aren't stuck
  // with a hand that's all expensive attackers.
  const ordered = [...producers.slice(0, 1), ...rest.sort((a, b) => DEFENDERS[a].cost - DEFENDERS[b].cost)];
  return ordered.slice(0, level.slots);
}

function isBlockerRole(id) { return DEFENDERS[id].role === 'Tank'; }
function isProducerRole(id) { return DEFENDERS[id].role === 'Generator'; }

/** One tick of bot judgement: place what can be placed, spend a power if things look rough. */
function decide(world) {
  // Collect every falling drop first. A producer nobody harvests contributes
  // nothing — the first draft of this script forgot this and every level
  // looked hopeless as a result, which turned out to be the bot, not the game.
  for (const s of world.suns) if (s.state !== 'collect') world.tapLawn(s.x, s.y);
  for (const f of world.foods) world.tapLawn(f.x, f.y);

  const rows = world.rows;
  const loadout = world.packets.map((p) => p.id);
  const producerIdx = loadout.findIndex(isProducerRole);
  const blockerIdx = loadout.findIndex(isBlockerRole);
  const fillerIdxs = loadout.map((_, i) => i).filter((i) => i !== producerIdx && i !== blockerIdx);

  // Economy: keep at most one producer per lane, cheapest way to a base income.
  if (producerIdx >= 0) {
    const pk = world.packets[producerIdx];
    if (pk.cd <= 0 && world.sun >= DEFENDERS[pk.id].cost) {
      for (const r of rows) {
        const producersInRow = [0, 1].some((c) => world.plantAt(c, r)?.id === pk.id);
        if (!producersInRow && !world.plantAt(1, r) && !world.graveAt(1, r)) {
          world.selected = producerIdx;
          if (world.tapLawn(cellCX(1), groundY(r))) return;
        }
      }
    }
  }

  // Front line: a blocker in column 0 of every lane that's under the most pressure.
  if (blockerIdx >= 0) {
    const pk = world.packets[blockerIdx];
    if (pk.cd <= 0 && world.sun >= DEFENDERS[pk.id].cost) {
      const target = rows
        .filter((r) => !world.plantAt(0, r) && !world.graveAt(0, r))
        .sort((a, b) => pressure(world, b) - pressure(world, a))[0];
      if (target != null) {
        world.selected = blockerIdx;
        if (world.tapLawn(cellCX(0), groundY(target))) return;
      }
    }
  }

  // Everything else: round-robin into the emptiest lane, columns 2 upward.
  for (const i of fillerIdxs) {
    const pk = world.packets[i];
    if (pk.cd > 0 || world.sun < DEFENDERS[pk.id].cost) continue;
    const target = rows
      .map((r) => ({ r, open: openColumns(world, r) }))
      .filter((x) => x.open.length)
      .sort((a, b) => pressure(world, b.r) - pressure(world, a.r))[0];
    if (!target) continue;
    world.selected = i;
    if (world.tapLawn(cellCX(target.open[0]), groundY(target.r))) return;
  }

  // Powers: reactive, not proactive — spend them when the board says to.
  const alive = world.zombies.filter((z) => !z.dead);
  if (world.powers.freeze > 0 && alive.length >= 7) {
    world.usePower('freeze', 0, 0);
  } else if (world.powers.rally > 0 && world.plants.some((p) => p.hp < p.maxHp * 0.25)) {
    world.usePower('rally', 0, 0);
  } else if (world.powers.blast > 0 && rows.length) {
    const worst = rows.sort((a, b) => pressure(world, b) - pressure(world, a))[0];
    const closest = alive.filter((z) => z.row === worst).sort((a, b) => a.x - b.x)[0];
    if (closest && closest.x < cellCX(3)) world.usePower('blast', closest.x, closest.y);
  }
}

function pressure(world, row) {
  return world.zombies.filter((z) => !z.dead && z.row === row).length;
}
function openColumns(world, row) {
  const out = [];
  for (let c = 2; c < 9; c++) if (!world.plantAt(c, row) && !world.graveAt(c, row)) out.push(c);
  return out;
}
function runOnce(level) {
  const loadout = pickLoadout(level);
  const world = new World(level, loadout);
  world.status = 'playing'; // skip the 3.2s intro pause, it doesn't affect balance

  let t = 0;
  let sinceDecision = 0;
  while (t < MAX_SIM_SECONDS && world.status === 'playing') {
    world.update(STEP);
    t += STEP;
    sinceDecision += STEP;
    if (sinceDecision >= DECIDE_EVERY) { sinceDecision = 0; decide(world); }
  }

  return {
    result: world.status === 'won' ? 'win' : world.status === 'lost' ? 'loss' : 'stalemate',
    simSeconds: Math.round(t),
    waves: world.stats.waves,
    killed: world.stats.killed,
    sunEarned: world.stats.sun,
    defendersLost: world.stats.defendersLost,
    mowersUsed: world.mowers.filter((m) => m.state !== 'idle').length,
    loadout: loadout.join(', '),
  };
}

function summarize(label, runs) {
  const wins = runs.filter((r) => r.result === 'win').length;
  const avg = (key) => (runs.reduce((s, r) => s + r[key], 0) / runs.length).toFixed(1);
  console.log(`\n${label}`);
  console.log(`  loadout: ${runs[0].loadout}`);
  console.log(`  wins: ${wins}/${runs.length}  avg waves: ${avg('waves')}  avg sim: ${avg('simSeconds')}s`
    + `  avg kills: ${avg('killed')}  avg defenders lost: ${avg('defendersLost')}  avg mowers used: ${avg('mowersUsed')}`);
  const outcomes = runs.map((r) => r.result === 'win' ? `W(${r.mowersUsed}m)` : r.result === 'loss' ? 'L' : 'S').join(' ');
  console.log(`  outcomes: ${outcomes}`);
}

console.log(`Bot tournament — ${RUNS} run(s) per level, dumb-but-real bot, real rules.\n`);
for (const level of BEE_LEVELS) {
  const runs = Array.from({ length: RUNS }, () => runOnce(level));
  summarize(`Level ${level.id} — ${level.title}`, runs);
}
{
  const runs = Array.from({ length: Math.max(2, Math.round(RUNS / 2)) }, () => runOnce(BEE_SURVIVAL));
  summarize('Survival', runs);
}
