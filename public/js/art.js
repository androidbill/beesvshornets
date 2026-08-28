const ROOT = './assets/art/';

export const ART_URLS = {
  titleHero: `${ROOT}backgrounds/title-hero.webp`,
  battlefield: `${ROOT}backgrounds/bloom-battlefield.webp`,
  levelMap: `${ROOT}backgrounds/bloom-map.webp`,
  nectarBee: `${ROOT}defenders/nectar-bee.webp`,
  workerBee: `${ROOT}defenders/worker-bee.webp`,
  bumbleGuard: `${ROOT}defenders/bumble-guard.webp`,
  guardBee: `${ROOT}defenders/guard-bee.webp`,
  stingerBee: `${ROOT}defenders/stinger-bee.webp`,
  honeyHealer: `${ROOT}defenders/honey-healer.webp`,
  pollenBomber: `${ROOT}defenders/pollen-bomber.webp`,
  royalDefender: `${ROOT}defenders/royal-defender.webp`,
  scoutHornet: `${ROOT}invaders/scout-hornet.webp`,
  workerHornet: `${ROOT}invaders/worker-hornet.webp`,
  fastWasp: `${ROOT}invaders/fast-wasp.webp`,
  armoredHornet: `${ROOT}invaders/armored-hornet.webp`,
  diveWasp: `${ROOT}invaders/dive-wasp.webp`,
  shieldHornet: `${ROOT}invaders/shield-hornet.webp`,
  hornetCaptain: `${ROOT}invaders/hornet-captain.webp`,
  hornetQueen: `${ROOT}invaders/hornet-queen.webp`,
  honeyGuardian: `${ROOT}effects/honey-guardian.webp`,
  nectarDrop: `${ROOT}effects/nectar-drop.webp`,
  pollenBolt: `${ROOT}effects/pollen-bolt.webp`,
  venomDart: `${ROOT}effects/venom-dart.webp`,
};

const bank = new Map();

export function preloadArt() {
  if (typeof Image === 'undefined') return Promise.resolve([]);
  return Promise.all(Object.entries(ART_URLS).map(([key, src]) => new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
    bank.set(key, image);
  })));
}

export function artImage(key) {
  const image = bank.get(key);
  return image?.complete && image.naturalWidth ? image : null;
}
