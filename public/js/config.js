// The battle is drawn in a fixed-height "world" so every device gets the same
// game at a different zoom. Height is always 900; width stretches with the
// screen so a tall phone in landscape fills edge to edge instead of sitting in
// black bars, and the extra width just becomes more lawn either side.

export const COLS = 9;
export const ROWS = 5;
export const CELL_W = 132;
export const CELL_H = 138;

export const VH = 900;
export const VW_MIN = 1440;
export const VW_MAX = 2240;

export const HUD_H = 128;

const GRID_W = COLS * CELL_W; // 1188
const GRID_H = ROWS * CELL_H; // 690
const HOUSE_W = 218;          // porch + mower strip on the left
const VERGE_W = 182;          // path the zombies walk in over on the right
const BLOCK_W = HOUSE_W + GRID_W + VERGE_W;

/** Recomputed on every resize. Everything else reads these. */
export const L = {
  vw: 1600, vh: VH,
  gx: 0, gy: 156, gw: GRID_W, gh: GRID_H,
  houseX: 0, vergeX: 0,
  cw: CELL_W, ch: CELL_H,
};

export function layout(aspect) {
  const vw = Math.round(Math.min(VW_MAX, Math.max(VW_MIN, VH * aspect)));
  L.vw = vw;
  L.vh = VH;
  const blockX = Math.round((vw - BLOCK_W) / 2);
  L.houseX = blockX;
  L.gx = blockX + HOUSE_W;
  L.gy = 156;
  L.gw = GRID_W;
  L.gh = GRID_H;
  L.vergeX = L.gx + GRID_W;
  return L;
}

// Grid <-> world helpers -----------------------------------------------------

export const colX = (c) => L.gx + c * CELL_W;              // left edge of a column
export const cellCX = (c) => L.gx + (c + 0.5) * CELL_W;    // centre of a column
export const rowY = (r) => L.gy + r * CELL_H;              // top edge of a row
export const cellCY = (r) => L.gy + (r + 0.5) * CELL_H;    // centre of a row
/** Where things standing in a row touch the ground (a bit below centre). */
export const groundY = (r) => L.gy + (r + 0.5) * CELL_H + 30;

export const colAt = (x) => Math.floor((x - L.gx) / CELL_W);
export const rowAt = (y) => Math.floor((y - L.gy) / CELL_H);
export const onLawn = (x, y) =>
  x >= L.gx && x < L.gx + L.gw && y >= L.gy && y < L.gy + L.gh;

/** The line a zombie has to cross for the lane's mower — and then the game. */
export const MOWER_X = () => L.gx - 26;
export const HOUSE_LINE = () => L.gx - 96;

// Scenes ---------------------------------------------------------------------

export const SCENES = {
  day: {
    name: 'Front Lawn',
    sky: ['#8fd9ff', '#cdf0ff', '#eafbe6'],
    grass: ['#5fbf3f', '#54ad36'],
    grassDark: ['#4fa634', '#46972d'],
    dirt: '#8a6a3f',
    ambient: 'rgba(255,246,200,.10)',
    vignette: 'rgba(20,40,10,.30)',
    music: 'day',
    skySun: true,
  },
  night: {
    name: 'Midnight Yard',
    sky: ['#101a3c', '#1c2b57', '#26406b'],
    grass: ['#2b6b46', '#245c3d'],
    grassDark: ['#245b3c', '#1e4d33'],
    dirt: '#4a3c2a',
    ambient: 'rgba(120,160,255,.10)',
    vignette: 'rgba(4,8,26,.60)',
    music: 'night',
    skySun: false,
  },
  dusk: {
    name: 'Sunset Terrace',
    sky: ['#3a2a6d', '#a5498a', '#ffb46b'],
    grass: ['#4d7f45', '#41703a'],
    grassDark: ['#436f3c', '#3a6234'],
    dirt: '#6f5233',
    ambient: 'rgba(255,170,120,.13)',
    vignette: 'rgba(40,12,40,.44)',
    music: 'dusk',
    skySun: true,
  },
};

// Shared tuning knobs --------------------------------------------------------

export const SUN_VALUE = 25;
export const PLANT_FOOD_MAX = 3;
export const SKY_SUN_MIN = 8.5;
export const SKY_SUN_MAX = 12.5;
