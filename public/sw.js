// The cache name comes from the ?v= that main.js puts on the registration URL,
// which comes from version.js. One version string, one place to bump it — the
// previous hand-maintained CACHE constant had already drifted two builds behind
// APP_VERSION, and a name that fails to change serves stale JS forever.
const VERSION = new URL(self.location).searchParams.get('v') || 'dev';
const CACHE = `pick-your-fight-${VERSION}`;

const CORE = [
  './', './index.html', './style.css', './premium.css',
  './manifest.webmanifest', './version.js',
  './js/main.js', './js/art.js', './js/config.js', './js/world.js',
  './js/save.js', './js/achievements.js', './js/util.js', './js/audio.js', './js/particles.js',
  './js/creature.js', './js/defender-roles.js', './js/invader-roles.js',
  './js/battle-packs/bees-hornets.js', './js/battle-packs/bees-hornets-levels.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-512-maskable.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
];

// Artwork the game actually draws. Kept separate from CORE only for reading
// clarity — both are precached the same way.
const ART = [
  'backgrounds/title-hero.webp',
  'backgrounds/bloom-battlefield.webp',
  'backgrounds/bloom-map.webp',
  'defenders/nectar-bee.webp',
  'defenders/worker-bee.webp',
  'defenders/bumble-guard.webp',
  'defenders/guard-bee.webp',
  'defenders/stinger-bee.webp',
  'defenders/honey-healer.webp',
  'defenders/pollen-bomber.webp',
  'defenders/royal-defender.webp',
  'invaders/scout-hornet.webp',
  'invaders/worker-hornet.webp',
  'invaders/fast-wasp.webp',
  'invaders/armored-hornet.webp',
  'invaders/dive-wasp.webp',
  'invaders/shield-hornet.webp',
  'invaders/hornet-captain.webp',
  'invaders/hornet-queen.webp',
  'effects/honey-guardian.webp',
  'effects/nectar-drop.webp',
  'effects/pollen-bolt.webp',
  'effects/venom-dart.webp',
].map((f) => `./assets/art/${f}`);

// Only the default track is precached. The other two are multi-megabyte
// files most players will never pick - they cache themselves the normal way
// (the fetch handler below caches any successful GET) the first time someone
// actually switches to one, rather than costing every install 3.7MB nobody
// asked for.
const AUDIO_DEFAULT = ['./assets/audio/music-01.mp3'];

// Precache file by file rather than with addAll(). addAll() is atomic: one 404
// or one dropped request on a phone's connection rejects the whole install and
// the game silently ends up with no offline cache at all. cache:'reload' stops
// the browser's own HTTP cache handing back the previous build's bytes.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(
      [...CORE, ...ART, ...AUDIO_DEFAULT].map((url) => fetch(url, { cache: 'reload' })
        .then((res) => (res && res.ok ? cache.put(url, res) : null))
        .catch(() => null)),
    )).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache-first is safe because the cache name changes with every version, so a
// deploy can never be served from the previous build's cache.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // The page's own update check (main.js) needs a real answer from the
  // network every time, not whatever this exact service worker instance
  // already has cached - that would just confirm its own staleness to
  // itself. Marked requests skip the cache entirely, both read and write.
  if (event.request.url.includes('no-sw-cache=1')) {
    event.respondWith(fetch(event.request));
    return;
  }
  // <audio> elements issue byte-range requests (Chrome does this even on a
  // plain, non-seeking play()). A 206 Partial Content response cached under
  // the full URL would answer every later request for that file - including
  // full-file ones - with just that one slice, breaking playback. Range
  // requests are only ever answered from network, never written to cache.
  if (event.request.headers.has('range')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)
      .then((res) => {
        if (res && res.ok && res.status !== 206 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match('./index.html'))),
  );
});
