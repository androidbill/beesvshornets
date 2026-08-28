// Achievements are pure functions over lifetime stats — no separate tracking
// to keep in sync, no per-achievement wiring scattered through the game. A
// new one is a single entry here, checked automatically after every battle.

export const ACHIEVEMENTS = [
  {
    id: 'first-sting',
    name: 'First Sting',
    desc: 'Win your first battle.',
    check: (s) => s.wins >= 1,
  },
  {
    id: 'perfect-hive',
    name: 'Perfect Hive',
    desc: 'Finish a level with all three stars.',
    check: (s) => s.perfectVictories >= 1,
  },
  {
    id: 'swarm-breaker',
    name: 'Swarm Breaker',
    desc: 'Defeat 100 invaders.',
    check: (s) => s.enemiesDefeated >= 100,
  },
  {
    id: 'busy-bees',
    name: 'Busy Bees',
    desc: 'Deploy 50 defenders.',
    check: (s) => s.defendersDeployed >= 50,
  },
  {
    id: 'nectar-baron',
    name: 'Nectar Baron',
    desc: 'Collect 1,000 nectar over your career.',
    check: (s) => s.nectarCollected >= 1000,
  },
  {
    id: 'queen-slayer',
    name: 'Queen Slayer',
    desc: 'Defeat the Hornet Queen.',
    check: (s) => s.bossesDefeated >= 1,
  },
  {
    id: 'garden-defended',
    name: 'Garden Defended',
    desc: 'Clear every level in Bloom Garden.',
    check: (s) => s.campaignCleared,
  },
  {
    id: 'endless-hive',
    name: 'Endless Hive',
    desc: 'Reach wave 10 in Survival.',
    check: (s) => s.bestSurvivalWave >= 10,
  },
  {
    id: 'unbreakable',
    name: 'Unbreakable',
    desc: 'Win a level without a single mower firing.',
    check: (s) => s.flawlessVictories >= 1,
  },
];

/**
 * @param stats the lifetime stats object from save.js
 * @param unlocked array of already-unlocked ids
 * @returns the newly-unlocked achievement objects, in list order
 */
export function checkAchievements(stats, unlocked) {
  const have = new Set(unlocked);
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(stats));
}
