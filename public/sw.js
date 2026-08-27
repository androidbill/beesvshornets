const CACHE = 'pick-your-fight-v6';
const CORE = [
  './', './index.html', './style.css', './premium.css', './manifest.webmanifest', './version.js',
  './js/main.js', './js/art.js', './js/config.js', './js/world.js', './js/save.js',
  './js/creature.js', './js/plants.js', './js/zombies.js',
  './js/battle-packs/bees-hornets.js', './js/battle-packs/bees-hornets-levels.js',
  './js/particles.js', './js/util.js', './js/audio.js',
  './assets/art/backgrounds/title-hero.webp',
  './assets/art/backgrounds/bloom-battlefield.webp',
  './assets/art/backgrounds/bloom-map.webp',
  './assets/art/defenders/nectar-bee.webp',
  './assets/art/defenders/worker-bee.webp',
  './assets/art/defenders/bumble-guard.webp',
  './assets/art/defenders/guard-bee.webp',
  './assets/art/defenders/stinger-bee.webp',
  './assets/art/defenders/honey-healer.webp',
  './assets/art/defenders/pollen-bomber.webp',
  './assets/art/defenders/royal-defender.webp',
  './assets/art/invaders/scout-hornet.webp',
  './assets/art/invaders/worker-hornet.webp',
  './assets/art/invaders/fast-wasp.webp',
  './assets/art/invaders/armored-hornet.webp',
  './assets/art/invaders/dive-wasp.webp',
  './assets/art/invaders/shield-hornet.webp',
  './assets/art/invaders/hornet-captain.webp',
  './assets/art/invaders/hornet-queen.webp'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match('./index.html'))));
});
