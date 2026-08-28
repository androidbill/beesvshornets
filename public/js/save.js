const SAVE_KEY = 'pick-your-fight-save-v1';
const memory = new Map();
const storage = typeof localStorage === 'undefined'
  ? { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)) }
  : localStorage;
const defaults = () => ({
  version: 1,
  packs: { 'bees-hornets': { unlockedLevel: 1, levels: {}, loadouts: {} } },
  settings: { music: true, sfx: true, musicVolume: 0.6, sfxVolume: 0.8, reducedMotion: false },
  stats: { wins: 0, enemiesDefeated: 0, defendersDeployed: 0, nectarCollected: 0, wavesCleared: 0, perfectVictories: 0 },
});

function read() {
  try {
    const parsed = JSON.parse(storage.getItem(SAVE_KEY));
    if (parsed?.version === 1) {
      // Merge in any settings added since this save was written, otherwise a
      // returning player has no key for them and setSetting silently refuses.
      parsed.settings = { ...defaults().settings, ...parsed.settings };
      return parsed;
    }
  } catch { /* A damaged save should never prevent the game from opening. */ }
  const fresh = defaults();
  const oldProgress = +storage.getItem('pyf-bees-progress') || +storage.getItem('pyf-progress') || 1;
  fresh.packs['bees-hornets'].unlockedLevel = Math.max(1, Math.min(6, oldProgress));
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
  recordWin(level, stats, stars) {
    const current = bee().levels[level.id] || { wins: 0, bestStars: 0 };
    current.wins += 1;
    current.bestStars = Math.max(current.bestStars, stars);
    current.bestKills = Math.max(current.bestKills || 0, stats.killed);
    bee().levels[level.id] = current;
    bee().unlockedLevel = Math.max(bee().unlockedLevel, Math.min(6, level.id + 1));
    data.stats.wins += 1;
    data.stats.enemiesDefeated += stats.killed;
    data.stats.defendersDeployed += stats.planted;
    data.stats.nectarCollected += stats.sun;
    data.stats.wavesCleared += stats.waves;
    if (stars === 3) data.stats.perfectVictories += 1;
    commit();
  },
  snapshot() { return structuredClone(data); },
};
