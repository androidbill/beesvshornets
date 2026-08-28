import { checkAchievements } from './achievements.js';

const SAVE_KEY = 'beesvshornets-save-v1';
const LAST_LEVEL = 6; // BEE_LEVELS.length — kept as a constant rather than an
                       // import so this module has no dependency on a pack.

const memory = new Map();
const storage = typeof localStorage === 'undefined'
  ? { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)) }
  : localStorage;

const defaults = () => ({
  version: 1,
  packs: { 'bees-hornets': { unlockedLevel: 1, levels: {}, loadouts: {} } },
  settings: {
    music: true, sfx: true, musicVolume: 0.6, sfxVolume: 0.8,
    musicTrack: 'music-01', reducedMotion: false, highContrast: false,
  },
  stats: {
    wins: 0, enemiesDefeated: 0, defendersDeployed: 0, nectarCollected: 0,
    wavesCleared: 0, perfectVictories: 0, defendersLost: 0, bossesDefeated: 0,
    flawlessVictories: 0, bestSurvivalWave: 0, campaignCleared: false,
  },
  achievements: [],
});

function read() {
  try {
    const parsed = JSON.parse(storage.getItem(SAVE_KEY));
    if (parsed?.version === 1) {
      // Merge in any settings/stats added since this save was written, so a
      // returning player has every key rather than one that silently no-ops.
      const fresh = defaults();
      parsed.settings = { ...fresh.settings, ...parsed.settings };
      parsed.stats = { ...fresh.stats, ...parsed.stats };
      parsed.achievements ||= [];
      return parsed;
    }
  } catch { /* A damaged save should never prevent the game from opening. */ }
  const fresh = defaults();
  const oldProgress = +storage.getItem('pyf-bees-progress') || +storage.getItem('pyf-progress') || 1;
  fresh.packs['bees-hornets'].unlockedLevel = Math.max(1, Math.min(LAST_LEVEL, oldProgress));
  return fresh;
}

let data = read();
const commit = () => storage.setItem(SAVE_KEY, JSON.stringify(data));
const bee = () => data.packs['bees-hornets'];

export const SaveStore = {
  unlockedLevel() { return bee().unlockedLevel || 1; },
  levelResult(id) { return bee().levels[id] || null; },
  loadout(id) { return (bee().loadouts[id] || []).slice(); },
  saveLoadout(id, ids) { bee().loadouts[id] = ids.slice(); commit(); },
  settings() { return { ...data.settings }; },
  setSetting(key, value) { if (key in data.settings) { data.settings[key] = value; commit(); } },
  stats() { return { ...data.stats }; },
  achievements() { return data.achievements.slice(); },

  /**
   * Called once at the end of every battle, win or lose, campaign or
   * Survival. Lifetime stats always accumulate — what you fought through on
   * a loss is just as real as what you held on a win. Level unlocks and star
   * ratings only apply to a numbered campaign level that was actually won.
   *
   * @returns the newly-unlocked achievement objects, if any, so the caller
   * can show them off.
   */
  recordRun(level, runStats, { won, stars = 0 } = {}) {
    const isCampaign = !!level.id && !level.survival;

    data.stats.enemiesDefeated += runStats.killed;
    data.stats.defendersDeployed += runStats.planted;
    data.stats.nectarCollected += runStats.sun;
    data.stats.wavesCleared += runStats.waves;
    data.stats.defendersLost += runStats.defendersLost || 0;
    data.stats.bossesDefeated += runStats.bossesDefeated || 0;

    if (level.survival) {
      data.stats.bestSurvivalWave = Math.max(data.stats.bestSurvivalWave, runStats.waves);
    }

    if (won) {
      data.stats.wins += 1;
      if ((runStats.defendersLost || 0) === 0) data.stats.flawlessVictories += 1;
      if (isCampaign) {
        const current = bee().levels[level.id] || { wins: 0, bestStars: 0 };
        current.wins += 1;
        current.bestStars = Math.max(current.bestStars, stars);
        current.bestKills = Math.max(current.bestKills || 0, runStats.killed);
        bee().levels[level.id] = current;
        bee().unlockedLevel = Math.max(bee().unlockedLevel, Math.min(LAST_LEVEL, level.id + 1));
        if (stars === 3) data.stats.perfectVictories += 1;
        if (level.id === LAST_LEVEL) data.stats.campaignCleared = true;
      }
    }

    const unlocked = checkAchievements(data.stats, data.achievements);
    for (const a of unlocked) data.achievements.push(a.id);
    commit();
    return unlocked;
  },

  snapshot() { return structuredClone(data); },
};
