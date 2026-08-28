// Sound effects are synthesised — no files, installs instantly, works offline.
// Background music is three real tracks (public/assets/audio/), routed through
// the same gain bus as everything else so one set of volume controls covers
// both.

let ctx = null;
let master, sfxBus, musicBus, comp;
const enabled = { sfx: true, music: true };
// 0..1 from the settings sliders, scaled by the headroom each bus needs.
const volume = { sfx: 0.8, music: 0.6 };
const CEILING = { sfx: 1.15, music: 0.55 };
let started = false;

const busFor = (kind) => (kind === 'sfx' ? sfxBus : musicBus);
const levelFor = (kind) => (enabled[kind] ? volume[kind] * CEILING[kind] : 0);

function applyGain(kind, ramp = 0.06) {
  const bus = busFor(kind);
  if (ctx && bus) bus.gain.setTargetAtTime(levelFor(kind), ctx.currentTime, ramp);
}

export function setEnabled(kind, on) {
  enabled[kind] = on;
  applyGain(kind, kind === 'music' ? 0.1 : 0.05);
  if (kind === 'music' && !on) stopMusic();
}

/** @param level 0..1 from the settings slider. */
export function setVolume(kind, level) {
  volume[kind] = Math.max(0, Math.min(1, level));
  applyGain(kind);
}

export const isEnabled = (kind) => enabled[kind];
export const getVolume = (kind) => volume[kind];

/** Must be called from a user gesture; safe to call repeatedly. */
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 26;
    comp.ratio.value = 8;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    master = ctx.createGain();
    master.gain.value = 0.9;
    sfxBus = ctx.createGain();
    sfxBus.gain.value = levelFor('sfx');
    musicBus = ctx.createGain();
    musicBus.gain.value = levelFor('music');
    sfxBus.connect(comp);
    musicBus.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
    started = true;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export const ready = () => started && ctx && ctx.state === 'running';

// ------------------------------------------------------------------ voices

function env(node, t, { a = 0.005, d = 0.12, s = 0, r = 0.08, peak = 1, hold = 0 }) {
  const g = node.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  const sus = Math.max(s * peak, 0.0002);
  g.exponentialRampToValueAtTime(sus, t + a + d);
  g.setValueAtTime(sus, t + a + d + hold);
  g.exponentialRampToValueAtTime(0.0001, t + a + d + hold + r);
  return t + a + d + hold + r;
}

function tone(bus, {
  freq = 440, to = null, type = 'triangle', gain = 0.3, at = 0,
  a = 0.004, d = 0.1, s = 0, r = 0.08, hold = 0, detune = 0, pan = 0, cutoff = 0, q = 1,
}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + a + d + hold + r);
  o.detune.value = detune;
  const g = ctx.createGain();
  let node = o;
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    f.Q.value = q;
    node.connect(f);
    node = f;
  }
  node.connect(g);
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(bus);
  } else g.connect(bus);
  const end = env(g, t, { a, d, s, r, peak: gain, hold });
  o.start(t);
  o.stop(end + 0.05);
}

let noiseBuf = null;
function noiseBuffer() {
  if (noiseBuf) return noiseBuf;
  const n = ctx.sampleRate * 1.2;
  noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function noise(bus, {
  gain = 0.3, at = 0, a = 0.004, d = 0.14, s = 0, r = 0.08, hold = 0,
  cutoff = 1800, to = null, q = 1, type = 'lowpass', pan = 0,
}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(cutoff, t);
  f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(Math.max(to, 30), t + a + d + hold + r);
  const g = ctx.createGain();
  src.connect(f);
  f.connect(g);
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(bus);
  } else g.connect(bus);
  const end = env(g, t, { a, d, s, r, peak: gain, hold });
  src.start(t);
  src.stop(end + 0.05);
}

// ------------------------------------------------------------------- sfx

const S = {
  tap: () => tone(sfxBus, { freq: 620, to: 880, type: 'square', gain: 0.1, d: 0.05, r: 0.05 }),
  back: () => tone(sfxBus, { freq: 460, to: 300, type: 'square', gain: 0.1, d: 0.06, r: 0.06 }),

  plant: () => {
    noise(sfxBus, { gain: 0.28, cutoff: 900, to: 260, d: 0.16, r: 0.1 });
    tone(sfxBus, { freq: 300, to: 170, type: 'sine', gain: 0.24, d: 0.14, r: 0.1 });
  },
  shovel: () => noise(sfxBus, { gain: 0.3, cutoff: 2600, to: 400, d: 0.2, r: 0.1 }),

  shoot: () => tone(sfxBus, { freq: 900, to: 420, type: 'square', gain: 0.11, a: 0.002, d: 0.05, r: 0.04, cutoff: 2400 }),
  shootIce: () => {
    tone(sfxBus, { freq: 1400, to: 700, type: 'triangle', gain: 0.1, d: 0.07, r: 0.05 });
    noise(sfxBus, { gain: 0.07, cutoff: 5200, to: 2400, d: 0.09, r: 0.05, type: 'highpass' });
  },
  shootFire: () => {
    tone(sfxBus, { freq: 500, to: 200, type: 'sawtooth', gain: 0.11, d: 0.09, r: 0.07, cutoff: 1400 });
    noise(sfxBus, { gain: 0.14, cutoff: 3200, to: 700, d: 0.13, r: 0.08 });
  },
  splat: () => noise(sfxBus, { gain: 0.16, cutoff: 1500, to: 300, d: 0.07, r: 0.05 }),
  lob: () => tone(sfxBus, { freq: 260, to: 520, type: 'sine', gain: 0.14, d: 0.13, r: 0.08 }),
  melon: () => {
    noise(sfxBus, { gain: 0.34, cutoff: 1200, to: 180, d: 0.22, r: 0.14 });
    tone(sfxBus, { freq: 180, to: 70, type: 'sine', gain: 0.3, d: 0.2, r: 0.14 });
  },

  sunDrop: () => tone(sfxBus, { freq: 700, to: 1050, type: 'sine', gain: 0.08, d: 0.2, r: 0.16 }),
  sun: () => [784, 988, 1319].forEach((f, i) =>
    tone(sfxBus, { freq: f, type: 'triangle', gain: 0.16, at: i * 0.06, d: 0.1, r: 0.16 })),
  food: () => [660, 880, 1100, 1480].forEach((f, i) =>
    tone(sfxBus, { freq: f, type: 'sine', gain: 0.18, at: i * 0.05, d: 0.1, r: 0.2 })),
  foodUse: () => {
    tone(sfxBus, { freq: 220, to: 1600, type: 'sawtooth', gain: 0.16, a: 0.01, d: 0.35, r: 0.2, cutoff: 3000 });
    noise(sfxBus, { gain: 0.2, cutoff: 600, to: 6000, d: 0.4, r: 0.2, type: 'bandpass', q: 2 });
  },

  explode: () => {
    noise(sfxBus, { gain: 0.6, cutoff: 2600, to: 90, a: 0.002, d: 0.5, r: 0.4 });
    tone(sfxBus, { freq: 150, to: 34, type: 'sine', gain: 0.55, d: 0.45, r: 0.3 });
  },
  pop: () => tone(sfxBus, { freq: 420, to: 900, type: 'sine', gain: 0.16, d: 0.06, r: 0.05 }),
  freeze: () => {
    noise(sfxBus, { gain: 0.24, cutoff: 7000, to: 900, d: 0.5, r: 0.35, type: 'highpass' });
    tone(sfxBus, { freq: 1500, to: 300, type: 'sine', gain: 0.16, d: 0.5, r: 0.3 });
  },
  chomp: () => {
    noise(sfxBus, { gain: 0.34, cutoff: 900, to: 200, d: 0.1, r: 0.07 });
    tone(sfxBus, { freq: 130, to: 60, type: 'square', gain: 0.16, d: 0.12, r: 0.08, cutoff: 500 });
  },
  gulp: () => tone(sfxBus, { freq: 300, to: 90, type: 'sine', gain: 0.24, d: 0.22, r: 0.12 }),
  punch: () => {
    noise(sfxBus, { gain: 0.22, cutoff: 1800, to: 400, d: 0.06, r: 0.05 });
    tone(sfxBus, { freq: 200, to: 90, type: 'square', gain: 0.14, d: 0.07, r: 0.05, cutoff: 700 });
  },
  spike: () => noise(sfxBus, { gain: 0.2, cutoff: 5000, to: 1200, d: 0.1, r: 0.07, type: 'bandpass', q: 1.6 }),
  eat: () => noise(sfxBus, { gain: 0.16, cutoff: 700, to: 260, d: 0.13, r: 0.09 }),

  groan: () => {
    const f = 90 + Math.random() * 40;
    tone(sfxBus, { freq: f, to: f * 0.7, type: 'sawtooth', gain: 0.13, a: 0.05, d: 0.35, s: 0.4, r: 0.4, hold: 0.15, cutoff: 460, q: 4 });
    noise(sfxBus, { gain: 0.07, cutoff: 700, to: 300, a: 0.06, d: 0.4, r: 0.4, q: 3, type: 'bandpass' });
  },
  groanBig: () => {
    tone(sfxBus, { freq: 62, to: 40, type: 'sawtooth', gain: 0.3, a: 0.06, d: 0.7, s: 0.5, r: 0.6, hold: 0.3, cutoff: 320, q: 5 });
    noise(sfxBus, { gain: 0.14, cutoff: 420, to: 160, a: 0.08, d: 0.8, r: 0.6, q: 3, type: 'bandpass' });
  },
  stomp: () => {
    tone(sfxBus, { freq: 90, to: 32, type: 'sine', gain: 0.5, d: 0.28, r: 0.2 });
    noise(sfxBus, { gain: 0.3, cutoff: 1400, to: 120, d: 0.24, r: 0.16 });
  },
  mower: () => {
    noise(sfxBus, { gain: 0.3, cutoff: 1100, to: 1600, a: 0.05, d: 0.3, s: 0.8, r: 0.7, hold: 1.2, q: 3, type: 'bandpass' });
    tone(sfxBus, { freq: 110, to: 150, type: 'sawtooth', gain: 0.18, a: 0.05, d: 0.3, s: 0.7, r: 0.7, hold: 1.2, cutoff: 700 });
  },

  warn: () => [0, 0.18].forEach((at) =>
    tone(sfxBus, { freq: 330, to: 220, type: 'square', gain: 0.16, at, d: 0.18, r: 0.14, cutoff: 1200 })),
  huge: () => {
    [175, 165, 147].forEach((f, i) =>
      tone(sfxBus, { freq: f, type: 'sawtooth', gain: 0.2, at: i * 0.2, d: 0.3, s: 0.4, r: 0.3, hold: 0.1, cutoff: 900 }));
    noise(sfxBus, { gain: 0.2, cutoff: 300, to: 120, a: 0.2, d: 0.8, r: 0.6 });
  },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) =>
    tone(sfxBus, { freq: f, type: 'triangle', gain: 0.2, at: i * 0.1, d: 0.14, s: 0.3, r: 0.35, hold: 0.05 })),
  lose: () => [392, 349, 294, 220].forEach((f, i) =>
    tone(sfxBus, { freq: f, type: 'sawtooth', gain: 0.18, at: i * 0.17, d: 0.25, s: 0.3, r: 0.4, hold: 0.08, cutoff: 900 })),
  unlockNew: () => [659, 784, 988, 1319, 1568].forEach((f, i) =>
    tone(sfxBus, { freq: f, type: 'sine', gain: 0.18, at: i * 0.07, d: 0.12, r: 0.4 })),
  err: () => tone(sfxBus, { freq: 180, to: 120, type: 'square', gain: 0.12, d: 0.1, r: 0.08, cutoff: 800 }),
};

const lastAt = {};
export function sfx(name, throttle = 0) {
  if (!ctx || !enabled.sfx || !S[name]) return;
  if (throttle) {
    const now = ctx.currentTime;
    if (lastAt[name] && now - lastAt[name] < throttle) return;
    lastAt[name] = now;
  }
  try { S[name](); } catch { /* a dropped sound must never break the game */ }
}

// ----------------------------------------------------------------- music

export const MUSIC_TRACKS = [
  { id: 'music-01', name: 'Track 01', file: 'music-01.mp3' },
  { id: 'music-02', name: 'Track 02', file: 'music-02.mp3' },
  { id: 'music-03', name: 'Track 03', file: 'music-03.mp3' },
];
const DEFAULT_TRACK = 'music-01';

let musicEl = null;
let musicSource = null;
let currentTrack = DEFAULT_TRACK;
let wantPlaying = false;

function trackUrl(id) {
  const t = MUSIC_TRACKS.find((x) => x.id === id) || MUSIC_TRACKS[0];
  return `./assets/audio/${t.file}`;
}

/** Built lazily inside unlock() — a MediaElementAudioSourceNode needs a live AudioContext. */
function ensureMusicElement() {
  if (musicEl) return;
  musicEl = new Audio();
  musicEl.loop = true;
  musicEl.preload = 'auto';
  musicEl.crossOrigin = 'anonymous';
  musicSource = ctx.createMediaElementSource(musicEl);
  musicSource.connect(musicBus);
}

/** @returns the currently selected track id. */
export function getTrack() { return currentTrack; }

/**
 * Switches the selected track. Safe to call before the AudioContext exists —
 * the choice is remembered and takes effect once playMusic() actually runs
 * from a user gesture, same as everything else in here.
 */
export function setTrack(id) {
  if (!MUSIC_TRACKS.some((t) => t.id === id)) return;
  currentTrack = id;
  if (!musicEl) return;
  const playingNow = wantPlaying && !musicEl.paused;
  musicEl.src = trackUrl(id);
  if (playingNow) musicEl.play().catch(() => {});
}

export function playMusic() {
  wantPlaying = true;
  if (!ctx || !enabled.music) return;
  ensureMusicElement();
  if (!musicEl.src) musicEl.src = trackUrl(currentTrack);
  musicEl.play().catch(() => {});
}

export function stopMusic() {
  wantPlaying = false;
  musicEl?.pause();
}

/**
 * Kept as a no-op export: the old synthesised score modulated its own
 * intensity from wave pressure. Real tracks don't have a knob for that, but
 * world.js still calls this every frame - a real function costs nothing and
 * means that call site never needed to change.
 */
export function setIntensity() {}
