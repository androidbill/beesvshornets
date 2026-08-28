// Screens, input and the battle renderer.
//
// Fighters are drawn from the battle pack's sprite sheet when the image is
// available, and from the procedural creature spec when it is not. That second
// path is deliberate, not a leftover: it is what lets a new matchup ship and be
// played before anyone has drawn a single frame of art for it.

import {
  L, COLS, ROWS, CELL_W, CELL_H, layout,
  colX, rowY, cellCX, groundY, colAt, rowAt, onLawn,
} from './config.js';
import { World, STEP } from './world.js';
import { BEE_LEVELS, BEE_SURVIVAL } from './battle-packs/bees-hornets-levels.js';
import {
  DEFENDERS, DEFENDER_ORDER, stubDefender, BEES_VS_HORNETS,
} from './battle-packs/bees-hornets.js';
import { TAU, clamp, roundRect, circle, ellipse, lit, outline, text } from './util.js';
import {
  unlock, playMusic, stopMusic, setEnabled, isEnabled, setVolume, getVolume,
  MUSIC_TRACKS, setTrack, getTrack,
} from './audio.js';
import { SaveStore } from './save.js';
import { ACHIEVEMENTS } from './achievements.js';
import { preloadArt, artImage } from './art.js';
import { APP_VERSION } from '../version.js';

let swRegistration = null;
if ('serviceWorker' in navigator) {
  // controllerchange also fires the very first time a page gets a worker at
  // all - including right after this page's own refresh flow unregisters
  // and reloads - which is normal activation, not an update. Only a page
  // that already had a controller and then got a *different* one is a
  // genuine swap worth telling the player about.
  const hadControllerAtLoad = !!navigator.serviceWorker.controller;
  addEventListener('load', () => {
    navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`).then((reg) => { swRegistration = reg; });
  });
  if (hadControllerAtLoad) {
    navigator.serviceWorker.addEventListener('controllerchange', () => showUpdateBanner());
  }
}

// A hidden, URL- or storage-gated dev panel per the design brief (S32). Never
// present unless explicitly asked for, so it can't leak into a normal session.
const DEBUG = new URLSearchParams(location.search).has('debug') || localStorage.getItem('pyf-debug') === '1';
if (DEBUG) localStorage.setItem('pyf-debug', '1');

const $ = (sel) => document.querySelector(sel);

// ------------------------------------------------------------ version check
//
// Players must always be on the latest build. A stale service worker can
// otherwise keep serving last week's HTML/JS indefinitely - this compares
// the version this tab actually loaded against whatever version.js reads
// *right now* on the server, bypassing the service worker's own cache (which
// would just answer with its own possibly-stale copy) via a marked query
// param sw.js is written to always send to network. Genuinely new code from
// this session onward never gets silently left behind.

let updateShown = false;

function showUpdateBanner() {
  if (updateShown) return;
  updateShown = true;
  const el = document.createElement('div');
  el.id = 'update-banner';
  el.innerHTML = '<span>A new version is ready.</span><button id="update-refresh">Refresh</button>';
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  el.querySelector('#update-refresh').onclick = async () => {
    const btn = el.querySelector('#update-refresh');
    btn.disabled = true;
    btn.textContent = 'Updating…';
    // A plain reload is not safe here: whichever worker is in control right
    // now is what answers the very next navigation too, and this file's own
    // source never changes between versions - only the ?v= query string
    // does - which is exactly the kind of update some browsers' byte-compare
    // can fail to notice, silently leaving a stale worker in place. Rather
    // than trust that algorithm, unregister outright: the reload then goes
    // straight to network with no worker able to intercept it, guaranteeing
    // genuinely fresh files regardless of what any cache still believes.
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch { /* fall through to reload regardless */ }
    location.reload();
  };
}

async function checkForUpdate() {
  if (updateShown) return;
  try {
    const res = await fetch(`version.js?no-sw-cache=1&t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const found = text.match(/APP_VERSION = '([^']+)'/);
      if (found && found[1] !== APP_VERSION) showUpdateBanner();
    }
  } catch { /* offline, or a blip - the next poll tries again */ }
  swRegistration?.update().catch(() => {});
}

addEventListener('load', () => setTimeout(checkForUpdate, 4000));
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
setInterval(checkForUpdate, 3 * 60 * 1000);

// Read once from the active battle pack rather than hardcoded, so a future
// pack's own resource (Energy, Supplies, Gold...) needs no changes here.
const RESOURCE_NAME = BEES_VS_HORNETS.resource.name.toUpperCase();

const canvas = $('#game');
const ctx = canvas.getContext('2d');
const menu = $('#menu');
const mapEl = $('#level-map');
const loadoutEl = $('#loadout');
const result = $('#result');
const settingsEl = $('#settings');
const pauseMenu = $('#pause-menu');
const cardsEl = $('#cards');
const seedbar = $('#seedbar');
const powerbar = $('#powerbar');
const hud = $('#hud');
const sunEl = $('#sun b');
const waveEl = $('#wave span');
const sunLabel = $('#sun-label');
const windBadge = $('#wind-badge');
const bossBar = $('#boss-bar');
const loadingEl = $('#loading');

let world = null;
let level = null;
let selected = [];
let running = false;
let paused = false;
let last = 0;
let acc = 0;
let dpr = 1;
let drag = null;
let simSpeed = 1;
let returnScreen = showMenu;

const progressLevel = () => SaveStore.unlockedLevel();

// The rotate prompt is for phones. A desktop browser can be portrait-shaped
// while still offering a full pointer, and should just be left alone.
const turnEl = $('#turn');
const touchDevice = matchMedia('(pointer: coarse)').matches
  && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
if (!touchDevice) {
  turnEl?.classList.add('hidden');
  turnEl?.style.setProperty('display', 'none', 'important');
}

// The manifest's display_override:"fullscreen" only ever applies to an
// *installed* PWA, and even then support is inconsistent - Android Chrome
// commonly falls back to "standalone", which keeps the OS status bar by
// design. A plain browser tab (not installed at all) can never hide it
// through the manifest either way. The Fullscreen API is the one thing that
// actually hides the status bar in both cases - installed or just a tab -
// but it only works from a real user gesture, so it rides on the buttons
// that already start something rather than firing on load.
function goFullscreen() {
  if (!touchDevice || document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.().catch(() => {
    // Denied, unsupported, or already showing a native picker - the game
    // still works perfectly well without it, just with the status bar up.
  });
}

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  layout(innerWidth / innerHeight);
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- sound

function syncSoundButtons() {
  const on = isEnabled('music');
  const hudBtn = $('#hud-sound');
  if (hudBtn) hudBtn.textContent = on ? '🔊' : '🔇';
}

function toggleSound() {
  const on = !isEnabled('music');
  setEnabled('music', on);
  setEnabled('sfx', on);
  SaveStore.setSetting('music', on);
  SaveStore.setSetting('sfx', on);
  syncSoundButtons();
  syncVolumeSliders();
}

// Every slider that controls the same value (menu settings + in-battle pause
// menu) is kept in lockstep so changing one never leaves the other stale.
function syncVolumeSliders() {
  for (const el of document.querySelectorAll('[id$="-music"]')) el.value = getVolume('music');
  for (const el of document.querySelectorAll('[id$="-sfx"]')) el.value = getVolume('sfx');
  const motion = $('#opt-motion');
  if (motion) motion.checked = SaveStore.settings().reducedMotion;
  const contrast = $('#opt-contrast');
  if (contrast) contrast.checked = SaveStore.settings().highContrast;
  syncTrackPicker();
}

function syncTrackPicker() {
  const picker = $('#track-picker');
  if (!picker) return;
  const current = getTrack();
  [...picker.children].forEach((btn) => btn.classList.toggle('active', btn.dataset.track === current));
}

/** Built once at boot — three fixed tracks, nothing dynamic about the list. */
function buildTrackPicker() {
  const picker = $('#track-picker');
  if (!picker) return;
  picker.innerHTML = '';
  MUSIC_TRACKS.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'track-btn';
    btn.dataset.track = t.id;
    btn.textContent = t.name;
    btn.addEventListener('click', () => {
      setTrack(t.id);
      SaveStore.setSetting('musicTrack', t.id);
      unlock();
      syncTrackPicker();
    });
    picker.append(btn);
  });
  syncTrackPicker();
}

/** Applies immediately so toggling it doesn't need a screen change to see it. */
function applyContrast(on) {
  document.documentElement.dataset.contrast = on ? 'high' : 'normal';
}

function wireVolumeControls() {
  for (const el of [$('#opt-music'), $('#pause-music')]) {
    el.addEventListener('input', () => {
      setVolume('music', +el.value);
      SaveStore.setSetting('musicVolume', +el.value);
      syncVolumeSliders();
    });
  }
  for (const el of [$('#opt-sfx'), $('#pause-sfx')]) {
    el.addEventListener('input', () => {
      setVolume('sfx', +el.value);
      SaveStore.setSetting('sfxVolume', +el.value);
      syncVolumeSliders();
      unlock();
      // A quick blip so a volume drag is heard immediately, not just believed.
    });
  }
  $('#opt-motion').addEventListener('change', (e) => {
    SaveStore.setSetting('reducedMotion', e.target.checked);
    if (world) world.reducedMotion = e.target.checked;
  });
  $('#opt-contrast').addEventListener('change', (e) => {
    SaveStore.setSetting('highContrast', e.target.checked);
    applyContrast(e.target.checked);
  });
}

function showSettings() {
  hideAll();
  settingsEl.classList.remove('hidden');
  syncVolumeSliders();
  const s = SaveStore.stats();
  $('#settings-stats').textContent =
    `${s.wins} victories · ${s.enemiesDefeated} invaders stopped · `
    + `${s.defendersDeployed} defenders deployed · ${s.nectarCollected} nectar collected · `
    + `${s.wavesCleared} waves cleared · ${s.perfectVictories} perfect victories`;

  const have = new Set(SaveStore.achievements());
  $('#achieve-count').textContent = `ACHIEVEMENTS · ${have.size} / ${ACHIEVEMENTS.length}`;
  const grid = $('#achieve-grid');
  grid.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const on = have.has(a.id);
    const card = document.createElement('div');
    card.className = `achieve-card${on ? '' : ' locked'}`;
    card.innerHTML = `<b>${on ? a.name : '???'}</b><small>${on ? a.desc : 'Not yet unlocked'}</small>`;
    grid.append(card);
  }
}

// -------------------------------------------------------------- rendering

const defenderScale = {
  nectarBee: 0.92, workerBee: 0.92, bumbleGuard: 1.06, guardBee: 0.96,
  stingerBee: 0.92, honeyHealer: 0.98, pollenBomber: 0.96, royalDefender: 1.08,
};
const invaderScale = {
  scoutHornet: 0.9, workerHornet: 0.94, fastWasp: 0.76, armoredHornet: 1.08,
  diveWasp: 0.72, shieldHornet: 1.02, hornetCaptain: 1.04, hornetQueen: 1.42,
};

function spriteShadow(x, y, size, alpha = 0.24) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.filter = 'blur(5px)';
  ellipse(ctx, x, y, size * 0.27, size * 0.075);
  ctx.fillStyle = '#102512';
  ctx.fill();
  ctx.restore();
}

function drawMuzzleFlash(x, y, size, enemy = false, power = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(world.time * 37) * 0.15);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.55 + 0.4 * power;
  ctx.shadowColor = enemy ? '#aaff46' : '#ffd853';
  ctx.shadowBlur = 20 * power;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(TAU / 6);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.18);
    ctx.lineTo(size * (0.9 + 0.25 * Math.sin(world.time * 29 + i)), -size * 0.06);
    ctx.lineTo(0, size * 0.18);
    ctx.closePath();
    ctx.fillStyle = enemy ? '#afff4c' : '#fff0a0';
    ctx.fill();
  }
  circle(ctx, 0, 0, size * 0.28);
  ctx.fillStyle = '#fffbdc';
  ctx.fill();
  ctx.restore();
}

/** Returns false when there is no sprite, so the caller can fall back. */
function drawDefenderSprite(unit, x, y, k = 1, t = 0) {
  const id = typeof unit === 'string' ? unit : unit.id;
  const img = artImage(id);
  if (!img) return false;

  const u = typeof unit === 'string' ? { id, seed: id.length * 0.13 } : unit;
  const size = 154 * (defenderScale[id] || 1) * k;
  const phase = t * 2.1 + (u.seed || 0) * TAU;
  const fire = clamp(u.fireAnim || u.punch || 0, 0, 1);
  const hurt = u.hurt > 0 ? 1 : 0;

  ctx.save();
  ctx.translate(x - fire * 8, y + Math.sin(phase) * 3);
  ctx.rotate(Math.sin(phase * 0.72) * 0.025 - fire * 0.045 + (u.wob || 0) * 0.035);
  ctx.scale(1 + Math.sin(phase) * 0.012 + fire * 0.035, 1 - Math.sin(phase) * 0.01 - fire * 0.045);
  if (hurt && Math.floor(u.hurt * 24) % 2) ctx.filter = 'brightness(1.8) saturate(.45)';
  ctx.drawImage(img, -size / 2, -size * 0.78, size, size);
  if (fire > 0.08) {
    drawMuzzleFlash(
      size * ((u.def?.muzzleX ?? 47) / 154),
      size * ((u.def?.muzzleY ?? -50) / 154),
      18, false, fire,
    );
  }
  if (u.glow > 0) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = u.glow * 0.28;
    ctx.drawImage(img, -size / 2, -size * 0.78, size, size);
  }
  ctx.restore();
  return true;
}

function drawBackdrop() {
  const sc = world.scene;
  const vw = L.vw;
  const painted = artImage('battlefield');

  if (painted) {
    ctx.drawImage(painted, 0, 0, vw, 900);
    const shade = ctx.createLinearGradient(0, 0, vw, 0);
    shade.addColorStop(0, 'rgba(12,38,25,.22)');
    shade.addColorStop(0.16, 'rgba(12,38,25,0)');
    shade.addColorStop(0.86, 'rgba(28,15,42,0)');
    shade.addColorStop(1, 'rgba(28,15,42,.25)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, vw, 900);
    for (let r = 0; r < ROWS; r++) {
      ctx.fillStyle = r % 2 ? 'rgba(22,74,25,.045)' : 'rgba(255,244,155,.035)';
      ctx.fillRect(L.gx, rowY(r), L.gw, CELL_H);
    }
    return;
  }

  const sky = ctx.createLinearGradient(0, 0, 0, 680);
  sc.sky.forEach((c, i) => sky.addColorStop(i / (sc.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, vw, 900);
  ctx.fillStyle = sc.dirt;
  ctx.fillRect(L.gx - 16, L.gy - 10, L.gw + 32, L.gh + 20);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r + c) % 2 ? sc.grass[0] : sc.grass[1];
      ctx.fillRect(colX(c), rowY(r), CELL_W, CELL_H);
    }
  }
}

function drawPlacementPreview() {
  if (!drag || !drag.active) return;

  for (let r = 0; r < ROWS; r++) {
    if (!world.playableRow(r)) continue;
    for (let c = 0; c < COLS; c++) {
      const valid = !world.plantAt(c, r) && !world.graveAt(c, r);
      ctx.fillStyle = valid ? 'rgba(255,232,112,.2)' : 'rgba(211,68,64,.1)';
      roundRect(ctx, colX(c) + 6, rowY(r) + 6, CELL_W - 12, CELL_H - 12, 22);
      ctx.fill();
    }
  }

  if (!onLawn(drag.x, drag.y)) return;
  const c = colAt(drag.x);
  const r = rowAt(drag.y);
  const valid = world.playableRow(r) && !world.plantAt(c, r) && !world.graveAt(c, r);
  ctx.strokeStyle = valid ? '#fff09a' : '#ff695f';
  ctx.lineWidth = 7;
  roundRect(ctx, colX(c) + 7, rowY(r) + 7, CELL_W - 14, CELL_H - 14, 22);
  ctx.stroke();

  const pk = world.packets[drag.index];
  if (valid && pk) {
    ctx.save();
    ctx.globalAlpha = 0.62;
    drawDefenderSprite(pk.id, cellCX(c), groundY(r), 1, 0);
    ctx.restore();
  }
}

function drawGraves() {
  for (const g of world.graves) {
    if (g.gone) continue;
    ctx.save();
    ctx.translate(g.x, g.y);
    roundRect(ctx, -28, -70, 56, 70, 10);
    lit(ctx, -70, 0, '#8d8b8a', '#575558');
    outline(ctx, 5, '#38373a');
    text(ctx, 'RIP', 0, -34, { size: 16, fill: '#d3d0c6', align: 'center' });
    ctx.restore();
  }
}

function drawMowers() {
  const jar = artImage('honeyGuardian');
  for (const m of world.mowers) {
    if (m.state === 'gone') continue;
    const active = m.state === 'run';
    const bob = active ? Math.sin(m.spin * 0.75) * 6 : Math.sin(world.time * 2.2 + m.row) * 3;
    ctx.save();
    ctx.translate(m.x, groundY(m.row) - 11 + bob);
    ctx.rotate(active ? Math.sin(m.spin) * 0.12 : Math.sin(world.time * 1.8 + m.row) * 0.025);
    spriteShadow(0, 12, 96, 0.2);
    if (jar) {
      const pulse = 1 + Math.sin(world.time * 3 + m.row) * 0.018;
      ctx.scale(pulse, pulse);
      ctx.drawImage(jar, -55, -80, 110, 105);
      if (active) {
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.34;
        ctx.drawImage(jar, -59, -84, 118, 113);
      }
    } else {
      roundRect(ctx, -34, -62, 68, 70, 18);
      lit(ctx, -62, 8, '#ffe27a', '#c87c1e');
      outline(ctx, 5, '#593513');
    }
    ctx.restore();
  }
}

function drawDefenders() {
  for (const p of world.plants) {
    ctx.save();
    const born = p.born > 0 ? clamp(1 - p.born / 0.35, 0.05, 1) : 1;
    spriteShadow(p.x, p.y + 7, 145 * born);
    if (!drawDefenderSprite(p, p.x, p.y, born, world.time)) {
      p.def.draw(ctx, p, world.time);
    }
    if (p.foodT > 0) {
      ctx.globalAlpha = 0.2 + Math.sin(world.time * 30) * 0.1;
      circle(ctx, p.x, p.y - 58, 74);
      ctx.fillStyle = '#a9ff92';
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawInvaders() {
  for (const z of world.zombies) {
    const size = 166 * (invaderScale[z.id] || 1);
    const img = artImage(z.id);
    const walk = z.state === 'walk' ? 1 : 0.18;
    const phase = z.walkT * 4 + (z.seed || 0) * TAU;
    const attack = clamp(z.attackAnim || 0, 0, 1);
    const bite = z.state === 'eat' ? (Math.sin((z.eatT || 0) * 12) + 1) * 0.5 : 0;

    ctx.save();
    ctx.translate(z.x + attack * 7 - bite * 5, z.y + (z.bob || 0) + Math.sin(phase) * 2.5);
    if (z.chill > 0) {
      ctx.shadowColor = '#a6eaff';
      ctx.shadowBlur = 22;
    }
    if (z.hurtT > 0) ctx.filter = 'brightness(1.8) saturate(.4)';

    if (z.dead) {
      ctx.globalAlpha = clamp(1 - z.dying / 1.1, 0, 1);
      ctx.rotate(Math.min(1, z.dying) * 1.15);
      ctx.scale(1 + z.dying * 0.22, 1 - z.dying * 0.3);
    } else {
      ctx.rotate(Math.sin(phase * 0.7) * 0.025 * walk + attack * 0.055 - bite * 0.035);
      ctx.scale(1 + attack * 0.04, 1 - attack * 0.04);
    }

    spriteShadow(0, 7, size);
    if (img) {
      ctx.drawImage(img, -size / 2, -size * 0.79, size, size);
      if (attack > 0.08) {
        drawMuzzleFlash(
          size * ((z.def?.projectileMuzzleX ?? -52) / 154),
          size * ((z.def?.projectileMuzzleY ?? -52) / 154),
          17, true, attack,
        );
      }
    } else {
      z.def.draw(ctx, z, world.time);
    }
    ctx.restore();
  }
}

function drawShots() {
  const pollen = artImage('pollenBolt');
  const venom = artImage('venomDart');

  for (const p of world.peas) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const pulse = 1 + Math.sin(p.t * 22) * 0.06;
    ctx.scale(pulse, pulse);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.4;
    const trail = ctx.createLinearGradient(-70, 0, 14, 0);
    trail.addColorStop(0, 'rgba(255,174,28,0)');
    trail.addColorStop(1, 'rgba(255,233,111,.95)');
    ctx.fillStyle = trail;
    ctx.fillRect(-74, -9, 88, 18);
    ctx.globalCompositeOperation = 'source-over';
    if (pollen && p.kind === 'pea') {
      ctx.shadowColor = '#ffcb45';
      ctx.shadowBlur = 18;
      ctx.drawImage(pollen, -62, -30, 124, 60);
      ctx.globalCompositeOperation = 'screen';
      circle(ctx, 34, 0, 7);
      ctx.fillStyle = '#fff7b1';
      ctx.fill();
    } else {
      ctx.shadowColor = p.kind === 'fire' ? '#ff732c' : '#b3f0ff';
      ctx.shadowBlur = 18;
      circle(ctx, 0, 0, p.r);
      lit(ctx, -p.r, p.r,
        p.kind === 'fire' ? '#ffe16e' : '#ecfbff',
        p.kind === 'fire' ? '#ed6529' : '#5eb7df');
      outline(ctx, 3, '#32512b');
    }
    ctx.restore();
  }

  for (const b of world.enemyShots) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.38;
    const g = ctx.createLinearGradient(0, 0, 72, 0);
    g.addColorStop(0, '#baff6bdd');
    g.addColorStop(1, '#7630b800');
    ctx.fillStyle = g;
    ctx.fillRect(0, -9, 76, 18);
    ctx.globalCompositeOperation = 'source-over';
    if (venom) {
      ctx.shadowColor = '#b1ff47';
      ctx.shadowBlur = 18;
      ctx.drawImage(venom, -62, -27, 124, 54);
      ctx.globalCompositeOperation = 'screen';
      circle(ctx, -38, 0, 6);
      ctx.fillStyle = '#eaff9b';
      ctx.fill();
    } else {
      ellipse(ctx, 0, 0, 25, 8);
      ctx.fillStyle = '#9be83f';
      ctx.fill();
    }
    ctx.restore();
  }

  for (const m of world.lobs) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot);
    ctx.shadowColor = '#ffc84f';
    ctx.shadowBlur = 16;
    for (let i = 0; i < 6; i++) {
      ctx.rotate(TAU / 6);
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(19, -11);
      ctx.lineTo(19, 11);
      ctx.lineTo(0, 22);
      ctx.closePath();
      ctx.strokeStyle = '#7b4a17';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    circle(ctx, 0, 0, 18);
    lit(ctx, -18, 18, '#ffe77e', '#db8b22');
    outline(ctx, 3, '#6a3d13');
    ctx.restore();
  }

  for (const f of world.fires) {
    const y = groundY(f.row) - 54;
    const g = ctx.createRadialGradient(f.x, y, 4, f.x, y, 82);
    g.addColorStop(0, 'rgba(255,244,142,.95)');
    g.addColorStop(0.35, 'rgba(255,141,45,.78)');
    g.addColorStop(1, 'rgba(255,65,28,0)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(f.x - 90, y - 70, 180, 140);
    ctx.restore();
  }
}

function drawCollectibles() {
  const nectar = artImage('nectarDrop');

  for (const s of world.suns) {
    ctx.save();
    ctx.translate(s.x, s.y);
    const collect = s.state === 'collect' ? clamp(1 - s.collectT / 0.7, 0.45, 1) : 1;
    const pulse = 1 + Math.sin(s.t * 3.5) * 0.055;
    ctx.rotate(Math.sin(s.t * 2.2) * 0.055);
    ctx.scale(pulse * collect, pulse * collect);
    ctx.shadowColor = '#ffd74e';
    ctx.shadowBlur = 22;
    if (nectar) {
      ctx.drawImage(nectar, -34, -47, 68, 94);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.bezierCurveTo(25, -8, 26, 15, 0, 27);
      ctx.bezierCurveTo(-26, 15, -25, -8, 0, -30);
      lit(ctx, -30, 27, '#fff18b', '#eca52d');
      outline(ctx, 4, '#724916');
    }
    ctx.restore();
  }

  for (const f of world.foods) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.t * 0.7);
    ctx.shadowColor = '#99ff9b';
    ctx.shadowBlur = 18;
    for (let i = 0; i < 6; i++) {
      ctx.rotate(TAU / 6);
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(10, -13);
      ctx.lineTo(0, -5);
      ctx.lineTo(-10, -13);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#b9ff96' : '#67cf75';
      ctx.fill();
      outline(ctx, 2, '#28552e');
    }
    text(ctx, '✦', 0, 8, { size: 22, fill: '#fff', align: 'center' });
    ctx.restore();
  }
}

function drawFog() {
  const n = world.level.fog || 0;
  if (!n) return;
  const x = L.gx + L.gw - n * CELL_W;
  const g = ctx.createLinearGradient(x, 0, L.gx + L.gw, 0);
  g.addColorStop(0, '#d8e3db00');
  g.addColorStop(1, world.scene.name === 'Midnight Yard' ? '#102b36cc' : '#fff0ddd0');
  ctx.fillStyle = g;
  ctx.fillRect(x, L.gy, n * CELL_W, L.gh);
}

function drawWorld() {
  drawBackdrop();
  drawPlacementPreview();
  drawGraves();
  drawMowers();
  drawDefenders();
  drawInvaders();
  drawShots();
  drawCollectibles();
  world.particles.draw(ctx);
  drawFog();

  if (world.bannerT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, world.bannerT * 2);
    text(ctx, world.bannerText, L.vw / 2, 212, {
      size: 52, fill: '#fff4be', align: 'center', stroke: '#263222', sw: 10,
    });
    ctx.restore();
  }
  if (world.flashT > 0) {
    ctx.save();
    ctx.fillStyle = world.flashCol;
    ctx.globalAlpha = world.flashT * 1.3;
    ctx.fillRect(0, 0, L.vw, 900);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ loop

let fps = 60;

function frame(now) {
  requestAnimationFrame(frame);
  if (DEBUG && last) fps += ((1000 / Math.max(1, now - last)) - fps) * 0.1;
  if (!running || paused) { last = now; return; }

  const dt = Math.min(0.05, (now - last) / 1000 || 0) * simSpeed;
  last = now;
  acc += dt;
  while (acc >= STEP) {
    world.update(STEP);
    acc -= STEP;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  const scale = Math.min(innerWidth / L.vw, innerHeight / 900);
  ctx.translate((innerWidth - L.vw * scale) / 2, (innerHeight - 900 * scale) / 2);
  ctx.scale(scale, scale);
  if (world.shakeT > 0) {
    ctx.translate((Math.random() - 0.5) * world.shakeMag, (Math.random() - 0.5) * world.shakeMag);
  }
  drawWorld();
  ctx.restore();

  refreshHud();
  if (world.status === 'won' || world.status === 'lost') showResult();
}
requestAnimationFrame(frame);

function refreshHud() {
  const nectar = Math.floor(world.sun);
  if (sunEl.textContent !== String(nectar)) {
    sunEl.textContent = nectar;
    const box = $('#sun');
    box.classList.remove('counter-pop');
    void box.offsetWidth;
    box.classList.add('counter-pop');
  }
  waveEl.style.width = `${world.progress() * 100}%`;
  $('#food b').textContent = world.foodCount;
  [...seedbar.children].forEach((el, i) => {
    const pk = world.packets[i];
    el.classList.toggle('sel', world.selected === i);
    el.classList.toggle('broke', world.sun < DEFENDERS[pk.id].cost);
    el.querySelector('.cool').style.height = `${(pk.cd / pk.recharge) * 100}%`;
  });

  [...powerbar.children].forEach((btn) => {
    const id = btn.dataset.power;
    const left = world.powers[id] || 0;
    btn.querySelector('b').textContent = left;
    btn.classList.toggle('spent', left <= 0);
    btn.classList.toggle('armed', world.powerArmed === id);
  });

  if (world.hasWind && world.wind.strength > 0.12) {
    windBadge.classList.remove('hidden');
    windBadge.classList.toggle('gusting-back', world.wind.dir < 0);
    windBadge.querySelector('span').textContent = world.wind.dir > 0 ? 'Tailwind' : 'Headwind';
  } else {
    windBadge.classList.add('hidden');
  }

  if (world.boss && !world.boss.dead) {
    bossBar.classList.remove('hidden');
    $('#boss-name').textContent = world.boss.def.name;
    bossBar.querySelector('.boss-hp span').style.width = `${clamp(world.boss.hp / world.boss.maxHp, 0, 1) * 100}%`;
  } else {
    bossBar.classList.add('hidden');
  }
}

// ---------------------------------------------------------------- screens

function renderPacket(id, target) {
  const c = document.createElement('canvas');
  c.width = 180;
  c.height = 138;
  const x = c.getContext('2d');
  const img = artImage(id);
  const paint = () => {
    x.clearRect(0, 0, c.width, c.height);
    if (img?.complete && img.naturalWidth) {
      x.drawImage(img, 19, -6, 142, 142);
    } else {
      const stub = stubDefender(id);
      stub.x = 86;
      stub.y = 120;
      stub.def.draw(x, stub, 0);
    }
  };
  paint();
  if (img && !img.complete) img.addEventListener('load', paint, { once: true });
  target.append(c);
}

function hideAll() {
  for (const el of [menu, mapEl, loadoutEl, result, settingsEl, pauseMenu]) el.classList.add('hidden');
  hud.classList.add('hidden');
}

function showMenu() {
  running = false;
  hideAll();
  menu.classList.remove('hidden');
  stopMusic();
}

function showMap() {
  running = false;
  hideAll();
  mapEl.classList.remove('hidden');
  const path = $('#level-path');
  path.innerHTML = '';
  const reached = progressLevel();
  BEE_LEVELS.forEach((l) => {
    const saved = SaveStore.levelResult(l.id);
    const stars = saved ? '★'.repeat(saved.bestStars) + '☆'.repeat(3 - saved.bestStars) : l.title;
    const b = document.createElement('button');
    b.className = `level-node${l.boss ? ' boss' : ''}${l.id > reached ? ' locked' : ''}`;
    b.disabled = l.id > reached;
    b.innerHTML = `<b>${l.boss ? 'BOSS' : l.id}</b><small>${stars}</small>`;
    b.title = l.title;
    b.onclick = () => { returnScreen = showMap; openLoadout(l); };
    path.append(b);
  });
}

/**
 * Which defenders you may bring. Driven by how far you have got, not by which
 * level you happen to be replaying — going back to level 1 with a full roster
 * should not hand you the two starter cards again.
 */
function availableDefenders(l) {
  const reach = Math.max(progressLevel(), l.id || 1);
  return DEFENDER_ORDER.filter((id) => DEFENDERS[id].unlockRequirement <= reach);
}

function openLoadout(l) {
  level = l;
  const available = availableDefenders(l);
  const saved = SaveStore.loadout(l.id);
  selected = saved.length === l.slots && saved.every((id) => available.includes(id))
    ? saved
    : available.slice(0, l.slots);

  hideAll();
  loadoutEl.classList.remove('hidden');
  $('#loadout-world').textContent = BEES_VS_HORNETS.displayName.toUpperCase();
  $('#loadout-title').textContent = l.id ? `${l.id}. ${l.title}` : l.title;
  $('#loadout-copy').textContent = l.intro;

  cardsEl.innerHTML = '';
  available.forEach((id) => {
    const d = DEFENDERS[id];
    const b = document.createElement('button');
    b.className = 'card';
    b.dataset.id = id;
    b.innerHTML = `<span class="tick"></span><b>${d.name}</b><small>${RESOURCE_NAME} ${d.cost} · ${d.role}</small>`;
    renderPacket(id, b);
    b.onclick = () => {
      if (selected.includes(id)) selected = selected.filter((x) => x !== id);
      else if (selected.length < l.slots) selected.push(id);
      drawCards();
    };
    cardsEl.append(b);
  });
  drawCards();
}

function drawCards() {
  [...cardsEl.children].forEach((b) => {
    const on = selected.includes(b.dataset.id);
    b.classList.toggle('selected', on);
    b.querySelector('.tick').textContent = on ? '✓' : '';
  });
  $('#picked').textContent = `${selected.length} / ${level.slots} selected`;
  $('#battle').disabled = selected.length !== level.slots;
}

function start() {
  unlock();
  if (level.id) SaveStore.saveLoadout(level.id, selected);
  const settings = SaveStore.settings();
  world = new World(level, selected, { reducedMotion: settings.reducedMotion });
  if (DEBUG) window.__world = world;
  running = true;
  paused = false;
  simSpeed = 1;
  last = performance.now();

  hideAll();
  hud.classList.remove('hidden');
  sunLabel.textContent = RESOURCE_NAME;
  bossBar.classList.add('hidden');
  windBadge.classList.add('hidden');
  $('#pause').textContent = 'Ⅱ';

  seedbar.innerHTML = '';
  world.packets.forEach((pk, i) => {
    const b = document.createElement('button');
    b.className = 'seed';
    b.innerHTML = '<span class="cool"></span>';
    renderPacket(pk.id, b);
    b.insertAdjacentHTML('beforeend', `<small>${DEFENDERS[pk.id].cost}</small>`);
    b.addEventListener('pointerdown', (e) => {
      world.selected = i;
      world.shovel = false;
      world.foodArmed = false;
      world.powerArmed = null;
      drag = { active: true, index: i, x: -1, y: -1, moved: false, startX: e.clientX, startY: e.clientY };
      // Some input paths (a synthetic event, certain pen/touch edge cases) can
      // hand back a pointerId the browser no longer considers active; capture
      // is a nicety for keeping the drag on this element, not a requirement,
      // so a failure here should never interrupt placing the card.
      try { b.setPointerCapture?.(e.pointerId); } catch { /* not fatal */ }
    });
    seedbar.append(b);
  });

  playMusic();
}

function showResult() {
  if (!result.classList.contains('hidden')) return;
  running = false;
  hud.classList.add('hidden');
  result.classList.remove('hidden');

  const won = world.status === 'won';
  let stars = 0;
  if (won) {
    const used = world.mowers.filter((m) => m.state !== 'idle').length;
    stars = used === 0 ? 3 : used === 1 ? 2 : 1;
  }
  // Lifetime stats and achievements come from every attempt, not just wins —
  // what you fought through on a loss is real progress too.
  const unlocked = SaveStore.recordRun(level, world.stats, { won, stars });

  $('#result-kicker').textContent = won ? 'THE HIVE IS SAFE' : 'THE SWARM BROKE THROUGH';
  $('#result-title').textContent = won ? 'Garden defended!' : 'Regroup and return';
  $('#result-stars').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('#result-copy').textContent = won
    ? `${world.stats.killed} invaders stopped across ${world.stats.waves} waves.`
    : `You held ${world.stats.waves} wave${world.stats.waves === 1 ? '' : 's'}. Change your squad and go again.`;

  unlocked.forEach((a, i) => showAchievementToast(a, i));
}

// ------------------------------------------------------------ achievements

function showAchievementToast(achievement, stackIndex = 0) {
  const el = document.createElement('div');
  el.className = 'achieve-toast';
  el.style.setProperty('--stack', stackIndex);
  el.innerHTML = `<b>Achievement unlocked</b><span>${achievement.name}</span><small>${achievement.desc}</small>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 3600 + stackIndex * 250);
}

// ------------------------------------------------------------------ input

function eventWorld(e) {
  const r = canvas.getBoundingClientRect();
  const scale = Math.min(r.width / L.vw, r.height / 900);
  return {
    x: (e.clientX - r.left - (r.width - L.vw * scale) / 2) / scale,
    y: (e.clientY - r.top - (r.height - 900 * scale) / 2) / scale,
  };
}

canvas.addEventListener('pointerdown', (e) => {
  if (!world || !running) return;
  unlock();
  const p = eventWorld(e);

  if (world.powerArmed) {
    world.usePower(world.powerArmed, p.x, p.y);
    return;
  }

  const collectible = world.suns.some((s) => s.state !== 'collect' && Math.hypot(s.x - p.x, s.y - p.y) < 62)
    || world.foods.some((f) => Math.hypot(f.x - p.x, f.y - p.y) < 56);
  if (collectible) {
    world.tapLawn(p.x, p.y);
    return;
  }

  const existing = world.plantAt(colAt(p.x), rowAt(p.y));
  if (existing && world.selected < 0 && !world.shovel && !world.foodArmed) {
    drag = { active: true, index: -1, plant: existing, x: p.x, y: p.y, moved: false, startX: e.clientX, startY: e.clientY };
    return;
  }
  world.tapLawn(p.x, p.y);
});

addEventListener('pointermove', (e) => {
  if (!drag?.active) return;
  const p = eventWorld(e);
  drag.x = p.x;
  drag.y = p.y;
  if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 10) drag.moved = true;
});

addEventListener('pointerup', (e) => {
  if (!drag?.active) return;
  const current = drag;
  const p = eventWorld(e);
  drag = null;
  if (current.plant) {
    if (current.moved && onLawn(p.x, p.y)) world.movePlant(current.plant, colAt(p.x), rowAt(p.y));
    return;
  }
  if (current.moved && onLawn(p.x, p.y)) {
    world.selected = current.index;
    world.tapLawn(p.x, p.y);
  }
});

$('#play').onclick = () => { goFullscreen(); returnScreen = showMap; showMap(); };
$('#battle').onclick = () => { goFullscreen(); start(); };
$('#again').onclick = () => openLoadout(level);
$('#continue').onclick = () => returnScreen();
$('#survival').onclick = () => { goFullscreen(); returnScreen = showMap; openLoadout(BEE_SURVIVAL); };
$('#map-survival').onclick = () => { goFullscreen(); openLoadout(BEE_SURVIVAL); };
$('#map-back').onclick = showMenu;
$('#hud-sound').onclick = toggleSound;

$('#settings-open').onclick = showSettings;
$('#settings-close').onclick = showMenu;

$('#shovel').onclick = () => {
  world.shovel = !world.shovel;
  world.selected = -1;
  world.foodArmed = false;
  world.powerArmed = null;
};
$('#food').onclick = () => {
  if (!world.foodCount) return;
  world.foodArmed = !world.foodArmed;
  world.selected = -1;
  world.shovel = false;
  world.powerArmed = null;
};

for (const btn of powerbar.children) {
  btn.addEventListener('click', () => {
    if (!world) return;
    const id = btn.dataset.power;
    if (btn.classList.contains('spent')) return;
    unlock();
    // Freeze and Rally act on the whole lawn the instant you tap them; Blast
    // needs a lane, so it arms and waits for the next tap on the battlefield.
    if (id === 'blast') {
      world.powerArmed = world.powerArmed === id ? null : id;
      world.selected = -1;
      world.shovel = false;
      world.foodArmed = false;
    } else {
      world.usePower(id, 0, 0);
    }
  });
}

// ------------------------------------------------------------------ pause

function openPause() {
  if (!running) return;
  paused = true;
  $('#pause').textContent = '▶';
  syncVolumeSliders();
  pauseMenu.classList.remove('hidden');
}
function closePause() {
  paused = false;
  $('#pause').textContent = 'Ⅱ';
  pauseMenu.classList.add('hidden');
}
$('#pause').onclick = () => (paused ? closePause() : openPause());
$('#pause-resume').onclick = closePause;
$('#pause-quit').onclick = () => { pauseMenu.classList.add('hidden'); returnScreen(); };

// A tab you can't see should not keep fighting the battle for you — and a
// browser that throttles a hidden rAF loop can otherwise deliver one huge
// simulation catch-up step the moment you switch back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running && !paused) openPause();
});

// ------------------------------------------------------------------ debug

if (DEBUG) {
  const panel = $('#debug');
  panel.classList.remove('hidden');
  const speeds = [0.5, 1, 2, 4];
  panel.querySelector('[data-dbg="sun"]').onclick = () => world && (world.sun += 500);
  panel.querySelector('[data-dbg="wave"]').onclick = () => world && (world.waveTimer = 0);
  panel.querySelector('[data-dbg="clear"]').onclick = () => world && world.zombies.forEach((z) => world.die(z));
  panel.querySelector('[data-dbg="win"]').onclick = () => world && world.win();
  panel.querySelector('[data-dbg="lose"]').onclick = () => world && world.lose();
  panel.querySelector('[data-dbg="speed"]').onclick = () => {
    simSpeed = speeds[(speeds.indexOf(simSpeed) + 1) % speeds.length];
    $('#dbg-speed').textContent = simSpeed;
  };
  setInterval(() => { $('#dbg-fps').textContent = fps.toFixed(0); }, 500);
}

// ------------------------------------------------------------------ boot

const savedSettings = SaveStore.settings();
setEnabled('music', savedSettings.music);
setEnabled('sfx', savedSettings.sfx);
setVolume('music', savedSettings.musicVolume);
setVolume('sfx', savedSettings.sfxVolume);
setTrack(savedSettings.musicTrack);
applyContrast(savedSettings.highContrast);
syncSoundButtons();
wireVolumeControls();
buildTrackPicker();

preloadArt((loaded, total) => { $('#loading-fill').style.width = `${(loaded / total) * 100}%`; })
  .finally(() => { loadingEl.classList.add('hidden'); });

$('#app-version').textContent = APP_VERSION;
showMenu();
