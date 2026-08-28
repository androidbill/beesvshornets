// The battle simulation. Everything that moves lives here; render.js only
// reads it. Fixed 60 Hz steps, so behaviour never depends on frame rate.

import { clamp, rnd, rndInt, pick, lerp } from './util.js';
import {
  COLS, ROWS, CELL_W, CELL_H, L, colX, cellCX, rowY, cellCY, groundY,
  colAt, rowAt, onLawn, MOWER_X, HOUSE_LINE, SCENES, SUN_VALUE, PLANT_FOOD_MAX,
  SKY_SUN_MIN, SKY_SUN_MAX,
} from './config.js';
import { DEFENDERS, makeDefender, INVADERS, makeInvader } from './battle-packs/bees-hornets.js';
import { buildWave, waveGap } from './battle-packs/bees-hornets-levels.js';
import { Particles } from './particles.js';
import { sfx, setIntensity } from './audio.js';

export const STEP = 1 / 60;
const front = (unit) => unit.x - (unit.def.big ? 46 : unit.def.small ? 18 : 28);
const back = (unit) => unit.x + (unit.def.big ? 40 : unit.def.small ? 16 : 26);

export class World {
  constructor(level, loadout) {
    this.level = level;
    this.scene = SCENES[level.scene] || SCENES.day;
    this.L = L;
    this.loadout = loadout.slice();

    this.time = 0;
    this.status = 'intro';        // intro | playing | won | lost
    this.statusT = 3.2;
    this.sun = 5000; // testing mode: generous starting resource
    this.plants = [];
    this.grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    this.zombies = [];
    this.peas = [];
    this.enemyShots = [];
    this.lobs = [];
    this.suns = [];
    this.foods = [];
    this.graves = [];
    this.fires = [];
    this.timers = [];
    this.particles = new Particles();

    this.mowers = Array.from({ length: ROWS }, (_, r) => ({ row: r, x: MOWER_X(), state: 'idle', spin: 0 }));

    this.packets = loadout.map((id) => ({ id, cd: 0, recharge: DEFENDERS[id].recharge }));
    this.selected = -1;
    this.shovel = false;
    this.foodArmed = false;
    this.foodCount = 0;

    this.waveNo = 0;
    this.waveTimer = 16;
    this.spawnQueue = [];
    this.hugeT = 0;
    this.bannerText = '';
    this.bannerT = 0;
    this.shakeT = 0;
    this.shakeMag = 0;
    this.flashCol = null;
    this.flashT = 0;
    this.skySunT = rnd(SKY_SUN_MAX, SKY_SUN_MIN);
    this.rows = level.rows || [0, 1, 2, 3, 4];

    this.stats = { killed: 0, sun: 0, planted: 0, food: 0, waves: 0 };
    this.lastLossRow = 2;

    if (level.graves) this.makeGraves(level.graves);
  }

  // -------------------------------------------------------------- helpers

  after(delay, fn) { this.timers.push({ t: delay, fn }); }
  shake(mag = 10, dur = 0.35) { this.shakeMag = Math.max(this.shakeMag, mag); this.shakeT = Math.max(this.shakeT, dur); }
  flash(col, dur = 0.3) { this.flashCol = col; this.flashT = dur; }
  banner(text, dur = 2.6) { this.bannerText = text; this.bannerT = dur; }

  plantAt(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return this.grid[row][col];
  }

  graveAt(col, row) {
    return this.graves.find((g) => g.col === col && g.row === row && !g.gone);
  }

  playableRow(row) { return this.rows.includes(row); }

  makeGraves(n) {
    const spots = [];
    for (const r of this.rows) for (let c = 4; c < COLS; c++) spots.push({ c, r });
    for (let i = 0; i < n && spots.length; i++) {
      const k = rndInt(0, spots.length - 1);
      const { c, r } = spots.splice(k, 1)[0];
      this.graves.push({ col: c, row: r, x: cellCX(c), y: groundY(r), seed: Math.random(), gone: false, rise: 0 });
    }
  }

  nearestZombie(row, fromX) {
    let best = null;
    for (const z of this.zombies) {
      if (z.dead || z.row !== row || !z.hittable) continue;
      if (z.x < fromX - 10) continue;
      if (!best || z.x < best.x) best = z;
    }
    return best;
  }

  // ---------------------------------------------------------------- input

  /** A tap anywhere on the lawn. Returns true if it did something. */
  tapLawn(wx, wy) {
    if (this.status !== 'playing' && this.status !== 'intro') return false;

    // collectibles first — they sit on top and are the most time-critical
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      if (Math.hypot(f.x - wx, f.y - wy) < 56) {
        this.foods.splice(i, 1);
        this.foodCount = Math.min(PLANT_FOOD_MAX, this.foodCount + 1);
        this.stats.food++;
        sfx('food');
        this.particles.sparkle(f.x, f.y, '#8bff9a', 10);
        return true;
      }
    }
    for (let i = this.suns.length - 1; i >= 0; i--) {
      const s = this.suns[i];
      if (s.state !== 'collect' && Math.hypot(s.x - wx, s.y - wy) < 62) {
        this.collectSun(s);
        return true;
      }
    }

    const col = colAt(wx);
    const row = rowAt(wy);
    if (!onLawn(wx, wy) || !this.playableRow(row)) return false;
    const existing = this.plantAt(col, row);

    if (this.foodArmed) {
      if (existing && DEFENDERS[existing.id].food) {
        this.foodArmed = false;
        this.foodCount--;
        existing.foodT = 1.1;
        sfx('foodUse');
        this.particles.ring(existing.x, existing.y - 50, '#8bff9a', 30, 4, 0.6);
        this.particles.sparkle(existing.x, existing.y - 50, '#c8ffd0', 14);
        DEFENDERS[existing.id].food(existing, this);
        return true;
      }
      sfx('err');
      return false;
    }

    if (this.shovel) {
      if (existing) {
        this.removePlant(existing);
        this.shovel = false;
        return true;
      }
      this.shovel = false;
      return false;
    }

    if (this.selected >= 0) {
      const pk = this.packets[this.selected];
      if (!pk) return false;
      if (existing || this.graveAt(col, row)) { sfx('err'); return false; }
      if (pk.cd > 0 || this.sun < DEFENDERS[pk.id].cost) { sfx('err'); return false; }
      this.place(pk.id, col, row);
      this.sun -= DEFENDERS[pk.id].cost;
      pk.cd = 0;
      this.selected = -1;
      return true;
    }
    return false;
  }

  movePlant(plant, col, row) {
    if (!plant || plant.dead || plant.row !== row || !this.playableRow(row) || this.plantAt(col, row) || this.graveAt(col, row)) return false;
    this.grid[plant.row][plant.col] = null;
    plant.col = col; plant.row = row; plant.x = cellCX(col); plant.y = groundY(row);
    this.grid[row][col] = plant;
    this.particles.ring(plant.x, plant.y - 42, '#ffe27a', 18, 3, .35);
    sfx('click');
    return true;
  }

  collectSun(s) {
    if (s.state === 'collect') return;
    s.state = 'collect';
    this.sun += s.value;
    this.suns.splice(this.suns.indexOf(s), 1);
    s.collectT = 0;
    s.collectX = s.x;
    s.collectY = s.y;
    sfx('sun');
    this.particles.sparkle(s.x, s.y, '#fff2a8', 13);
    this.particles.float(s.x, s.y - 28, `+${s.value}`, '#ffe98a');
  }

  place(id, col, row) {
    const p = makeDefender(id, col, row);
    p.born = 0.35;
    this.grid[row][col] = p;
    this.plants.push(p);
    this.stats.planted++;
    sfx('plant');
    this.particles.dirt(p.x, p.y + 4, 9);
    return p;
  }

  removePlant(p, quiet = false) {
    if (this.grid[p.row][p.col] === p) this.grid[p.row][p.col] = null;
    p.dead = true;
    const i = this.plants.indexOf(p);
    if (i >= 0) this.plants.splice(i, 1);
    if (!quiet) {
      sfx('shovel');
      this.particles.crumbs(p.x, p.y - 30, '#6fce4e', 9);
    }
  }

  kill(p) {
    if (this.grid[p.row][p.col] === p) this.grid[p.row][p.col] = null;
    p.dead = true;
    const i = this.plants.indexOf(p);
    if (i >= 0) this.plants.splice(i, 1);
  }

  hurtPlant(p, dmg) {
    p.hp -= dmg;
    p.hurt = 0.25;
    if (p.hp <= 0) {
      this.kill(p);
      this.particles.crumbs(p.x, p.y - 34, '#6fce4e', 12);
      this.particles.puff(p.x, p.y - 34, '#cfe7bd', 6);
    }
  }

  // ------------------------------------------------------------ spawning

  spawnPea(o) {
    this.peas.push({
      x: o.x, y: o.y, row: o.row, vx: (o.speed || 540) * .84,
      dmg: o.dmg, kind: o.kind || 'pea', r: o.kind === 'ice' ? 12 : 11,
      ty: o.arriveY ? groundY(o.row) - 70 : null, t: 0, lit: new Set(),
    });
    this.particles.sparkle(o.x + 8, o.y, o.kind === 'ice' ? '#b8ecff' : '#ffd75d', 4);
  }

  spawnEnemyShot(o) {
    this.enemyShots.push({
      x: o.x, y: o.y, row: o.row, vx: o.speed || 420,
      dmg: o.dmg || 30, kind: o.kind || 'venom', target: o.target, t: 0,
    });
  }

  spawnLob(o) {
    const y1 = groundY(o.row) - 26;
    this.lobs.push({
      x0: o.x, y0: o.y, x1: Math.max(o.tx, o.x + 60), y1,
      x: o.x, y: o.y, t: 0, dur: 1.05, row: o.row,
      dmg: o.dmg, splash: o.splash, rot: 0,
    });
  }

  spawnSun(o) {
    this.suns.push({
      x: o.x, y: o.y, value: o.value || SUN_VALUE,
      vx: o.hop ? rnd(70, -70) : 0,
      vy: o.hop ? rnd(-260, -360) : 0,
      restY: o.restY ?? (o.hop ? o.y + rnd(40, 10) : o.restY),
      sky: !!o.sky, state: o.hop ? 'hop' : 'fall', life: 11, t: rnd(6),
    });
    if (o.sky) sfx('sunDrop', 0.4);
  }

  spawnZombie(id, row, x, opts) {
    const z = makeInvader(id, row, x, opts);
    this.zombies.push(z);
    return z;
  }

  // ------------------------------------------------------------- combat

  hurt(z, dmg, kind = 'pea') {
    if (z.dead || dmg <= 0) return;
    z.hurtT = 0.12;
    if (kind === 'fire') { z.chill = 0; z.frozen = 0; z.burn = 0.4; }

    if (z.shieldHp > 0 && (kind === 'pea' || kind === 'ice')) {
      z.shieldHp -= dmg;
      if (z.shieldHp <= 0) {
        z.shieldHp = 0;
        z.def.onShieldBreak?.(z, this);
        this.particles.crumbs(z.x - 40, z.y - 90, z.def.shieldKind === 'paper' ? '#f2ead4' : '#b7bfc4', 10);
      }
      return;
    }
    if (kind === 'chomp') { z.hp = 0; this.die(z, 'eaten'); return; }
    if (z.armorHp > 0) {
      z.armorHp -= dmg;
      if (z.armorHp < 0) { z.hp += z.armorHp; z.armorHp = 0; this.particles.crumbs(z.x - 8, z.y - 128, '#c9d4dc', 9); }
    } else {
      z.hp -= dmg;
    }
    if (z.hp <= 0) this.die(z, kind);
  }

  die(z, kind = 'pea') {
    if (z.dead) return;
    z.dead = true;
    z.dying = 0;
    z.hittable = false;
    this.stats.killed++;
    sfx(z.def.big ? 'groanBig' : 'splat', 0.03);
    this.particles.splat(z.x - 10, z.y - 70, '#8fbf6a');
    if (z.def.big) { this.shake(14, 0.4); this.particles.dirt(z.x, z.y, 20); }
    if (kind === 'eaten') z.eaten = true;
    if (z.carriesFood) {
      z.carriesFood = false;
      this.dropFood(z.x, z.y - 90);
    }
  }

  dropFood(x, y) {
    this.foods.push({ x, y: y - 20, t: rnd(6), vy: -120, landed: false, baseY: y - 20, life: 22 });
    sfx('pop');
  }

  chill(z, dur, hard = false) {
    if (z.def.big) dur *= 0.6;
    z.chill = Math.max(z.chill, dur);
    if (hard) z.frozen = Math.max(z.frozen, dur * 0.55);
  }

  explode({ x, y, row, radius, dmg, kind = 'fire', rows = 0 }) {
    this.particles.boom(x, y);
    this.shake(kind === 'dirt' ? 10 : 16, 0.4);
    sfx('explode');
    if (kind === 'dirt') this.particles.dirt(x, y + 40, 18);
    for (const z of this.zombies) {
      if (z.dead || !z.hittable) continue;
      if (Math.abs(z.row - row) > rows) continue;
      if (Math.abs(z.x - x) > radius) continue;
      this.hurt(z, dmg, 'fire');
    }
  }

  fireWave(row, fromX) {
    this.fires.push({ row, x: fromX, t: 0, hit: new Set() });
  }

  // ------------------------------------------------------------- stepping

  update(dt) {
    this.time += dt;

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }

    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeMag = 0; }
    if (this.flashT > 0) this.flashT -= dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    this.particles.update(dt);

    if (this.status === 'intro') {
      this.statusT -= dt;
      if (this.statusT <= 0) { this.status = 'playing'; this.banner('Defend the hive!', 1.3); }
    }

    const live = this.status === 'playing';

    for (const pk of this.packets) if (pk.cd > 0) pk.cd = Math.max(0, pk.cd - dt);

    this.updatePlants(dt, live);
    this.updateZombies(dt, live);
    this.updatePeas(dt);
    this.updateEnemyShots(dt);
    this.updateLobs(dt);
    this.updateFires(dt);
    this.updateSuns(dt);
    this.updateFoods(dt);
    this.updateMowers(dt);

    if (live) {
      this.updateWaves(dt);
      if (this.scene.skySun) {
        this.skySunT -= dt;
        if (this.skySunT <= 0) {
          this.skySunT = rnd(SKY_SUN_MAX, SKY_SUN_MIN);
          const x = L.gx + rnd(L.gw * 0.9, L.gw * 0.06);
          this.suns.push({
            x, y: L.gy - 120, value: SUN_VALUE, vx: 0, vy: 88,
            restY: L.gy + rnd(L.gh * 0.85, L.gh * 0.1), sky: true, state: 'fall', life: 13, t: rnd(6),
          });
        }
      }
    }

    // music heat tracks how much is on the lawn
    const pressure = clamp(this.zombies.filter((z) => !z.dead).length / 14, 0, 1);
    setIntensity(pressure * 0.7 + (this.hugeT > 0 ? 0.3 : 0));
    if (this.hugeT > 0) this.hugeT -= dt;
  }

  // ------------------------------------------------------------- plants

  updatePlants(dt, live) {
    for (let i = this.plants.length - 1; i >= 0; i--) {
      const p = this.plants[i];
      p.t += dt;
      if (p.born > 0) p.born -= dt;
      if (p.hurt > 0) p.hurt -= dt;
      if (p.wob > 0) p.wob = Math.max(0, p.wob - dt * 5);
      if (p.foodT > 0) p.foodT -= dt;
      p.blinkT -= dt;
      if (p.blinkT <= 0) { p.blinkT = rnd(6, 2.5); p.blinkAnim = 0.16; }
      if (p.blinkAnim > 0) { p.blinkAnim -= dt; p.blink = clamp(Math.abs(p.blinkAnim - 0.08) / 0.08, 0.05, 1); }
      else p.blink = 1;
      if (live && p.born <= 0) p.def.update?.(p, dt, this);
    }
  }

  // ------------------------------------------------------------- zombies

  updateZombies(dt, live) {
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];

      if (z.dead) {
        z.dying += dt;
        if (z.dying > 1.1) this.zombies.splice(i, 1);
        continue;
      }
      if (z.hurtT > 0) z.hurtT -= dt;
      if (z.attackAnim > 0) z.attackAnim = Math.max(0, z.attackAnim - dt * 3.8);
      if (z.burn > 0) z.burn -= dt;
      z.blinkT -= dt;
      if (z.blinkT <= 0) { z.blinkT = rnd(7, 3); z.blinkAnim = 0.14; }
      if (z.blinkAnim > 0) { z.blinkAnim -= dt; z.blink = clamp(Math.abs(z.blinkAnim - 0.07) / 0.07, 0.05, 1); }
      else z.blink = 1;
      if (!live) continue;

      // flying (imp thrown by a gargantuar)
      if (z.fly) {
        z.fly.t += dt;
        const k = clamp(z.fly.t / z.fly.dur, 0, 1);
        z.x = lerp(z.fly.x0, z.fly.x1, k);
        z.bob = -Math.sin(k * Math.PI) * z.fly.h;
        z.walkT += dt * 3;
        if (k >= 1) {
          z.fly = null; z.bob = 0; z.hittable = true;
          this.particles.dirt(z.x, z.y, 8);
          this.shake(5, 0.2);
        }
        continue;
      }

      if (z.frozen > 0) { z.frozen -= dt; z.chill = Math.max(z.chill, z.frozen); continue; }
      if (z.chill > 0) z.chill -= dt;
      if (z.knock > 0) { z.knock -= dt; z.x += 42 * dt; }

      // grave rise
      if (z.rising > 0) { z.rising -= dt; z.bob = -z.rising * 40; continue; }

      const slow = z.chill > 0 ? 0.5 : 1;

      // vault animation
      if (z.state === 'vault') {
        z.vaultT += dt;
        const k = clamp(z.vaultT / 0.75, 0, 1);
        z.x = lerp(z.vaultX0, z.vaultX1, k);
        z.bob = -Math.sin(k * Math.PI) * 90;
        if (k >= 1) { z.state = 'walk'; z.bob = 0; z.vaulted = true; z.speed = z.def.speed * 0.72; }
        continue;
      }

      // the plant directly in front
      const fx = front(z);
      const col = colAt(fx);
      const target = this.plantAt(col, z.row);
      const blocking = target && !target.def.walkover && !target.dead;

      // Ranged invaders hold their ground once a defender enters their firing
      // envelope. The projectile and recoil share one timer so the animation
      // lands exactly when the shot is created.
      if (z.def.ranged && !blocking) {
        z.shotCd = Math.max(0, (z.shotCd || 0) - dt);
        let rangedTarget = null;
        for (const p of this.plants) {
          if (p.dead || p.row !== z.row || p.x >= z.x) continue;
          const distance = z.x - p.x;
          if (distance > z.def.range) continue;
          if (!rangedTarget || p.x > rangedTarget.x) rangedTarget = p;
        }
        if (rangedTarget) {
          z.state = 'shoot';
          z.walkT += dt * .12;
          if (z.shotCd <= 0) {
            z.shotCd = z.def.attackRate;
            z.attackAnim = 1;
            this.spawnEnemyShot({
              x: z.x + (z.def.projectileMuzzleX ?? -45), y: z.y + (z.def.projectileMuzzleY ?? -52), row: z.row, target: rangedTarget,
              dmg: z.def.projectileDamage, speed: z.def.projectileSpeed, kind: 'venom',
            });
            this.particles.sparkle(z.x + (z.def.projectileMuzzleX ?? -45), z.y + (z.def.projectileMuzzleY ?? -52), '#bbff45', 6);
            sfx('shootIce', .12);
          }
          continue;
        }
      }

      if (z.def.crusher) {
        if (blocking) {
          if (z.smash <= 0) { z.smash = 0.5; sfx('stomp', 0.2); }
          z.smash -= dt;
          if (z.smash <= 0.02) {
            this.shake(18, 0.4);
            this.particles.dirt(target.x, target.y, 20);
            this.particles.crumbs(target.x, target.y - 40, '#6fce4e', 14);
            this.kill(target);
            z.smash = 0;
          }
          continue;
        }
        z.smash = 0;
      } else if (blocking) {
        z.state = 'eat';
        z.eatT = (z.eatT || 0) + dt;
        this.hurtPlant(target, z.def.dps * dt);
        if (z.eatT > 0.5) { z.eatT = 0; sfx('eat', 0.16); }
        continue;
      } else if (z.def.vault && !z.vaulted) {
        // look one tile ahead for something to jump
        const ahead = this.plantAt(colAt(fx - 26), z.row);
        if (ahead && !ahead.def.walkover && !ahead.dead) {
          z.state = 'vault';
          z.vaultT = 0;
          z.vaultX0 = z.x;
          z.vaultX1 = z.x - CELL_W * 1.15;
          continue;
        }
      }

      z.state = 'walk';
      z.walkT += dt * slow * (z.speed / 26);
      z.x -= z.speed * slow * dt;

      // gargantuar throws an imp over your defences
      if (z.def.throwsImp && !z.thrown && z.hp < z.maxHp * 0.5) {
        z.thrown = true;
        const imp = this.spawnZombie('diveWasp', z.row, z.x, {});
        imp.hittable = false;
        imp.fly = { t: 0, dur: 1.05, x0: z.x, x1: Math.max(L.gx + CELL_W * 0.7, z.x - CELL_W * 4.2), h: 210 };
        sfx('groanBig');
      }

      // reached the mower line?
      if (front(z) < MOWER_X()) {
        const m = this.mowers[z.row];
        if (m && m.state === 'idle') { m.state = 'run'; sfx('mower'); this.banner('Bloom guardian!', 1.2); }
      }
      if (front(z) < HOUSE_LINE() && this.status === 'playing') {
        this.lastLossRow = z.row;
        this.lose();
      }
    }
  }

  // ------------------------------------------------------------ projectiles

  updatePeas(dt) {
    for (let i = this.peas.length - 1; i >= 0; i--) {
      const b = this.peas[i];
      b.t += dt;
      b.x += b.vx * dt;
      if (b.ty != null) b.y = lerp(b.y, b.ty, Math.min(1, dt * 7));

      // Emberwood sets peas alight as they pass through
      if (b.kind === 'pea') {
        const c = colAt(b.x);
        const p = this.plantAt(c, b.row);
        if (p && p.id === 'emberwood' && !b.lit.has(p)) {
          b.lit.add(p);
          b.kind = 'fire';
          b.dmg *= 2;
          b.r = 14;
          sfx('shootFire', 0.06);
          this.particles.fire(b.x, b.y, 5);
        }
      }
      if (b.kind === 'fire' && Math.random() < 0.5) this.particles.fire(b.x - 6, b.y, 1);

      let hit = null;
      for (const z of this.zombies) {
        if (z.dead || !z.hittable || z.row !== b.row) continue;
        if (b.x < front(z) - 6 || b.x > back(z)) continue;
        if (!hit || z.x < hit.x) hit = z;
      }
      if (hit) {
        const blocked = hit.shieldHp > 0 && (b.kind === 'pea' || b.kind === 'ice');
        this.hurt(hit, b.dmg, b.kind);
        if (b.kind === 'ice' && !blocked) this.chill(hit, 4);
        if (b.kind === 'fire') {
          this.particles.fire(b.x, b.y, 8);
          for (const z of this.zombies) {
            if (z === hit || z.dead || z.row !== b.row) continue;
            if (Math.abs(z.x - hit.x) < 68) this.hurt(z, b.dmg * 0.5, 'fire');
          }
        } else if (b.kind === 'ice') this.particles.frostHit(b.x, b.y);
        else {
          this.particles.splat(b.x, b.y, blocked ? '#d9d5c6' : '#ffc84a');
          this.particles.ring(b.x, b.y, blocked ? 'rgba(230,235,235,.7)' : 'rgba(255,220,80,.72)', 8, 2.4, .22);
        }
        sfx('splat', 0.05);
        this.peas.splice(i, 1);
        continue;
      }
      if (b.x > L.vw + 60) this.peas.splice(i, 1);
    }
  }

  updateEnemyShots(dt) {
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const b = this.enemyShots[i];
      b.t += dt;
      b.x -= b.vx * dt;
      const targetY = b.target && !b.target.dead ? b.target.y - 55 : groundY(b.row) - 55;
      b.y = lerp(b.y, targetY, Math.min(1, dt * 6));
      let hit = null;
      for (const p of this.plants) {
        if (p.dead || p.row !== b.row) continue;
        if (b.x <= p.x + 32 && b.x >= p.x - 42) {
          if (!hit || p.x > hit.x) hit = p;
        }
      }
      if (hit) {
        this.hurtPlant(hit, b.dmg);
        hit.wob = 1;
        this.particles.burst(b.x, b.y, '#9be83f', 9, 210, 5);
        this.particles.ring(b.x, b.y, 'rgba(170,255,80,.8)', 12, 2.8, .3);
        sfx('splat', .1);
        this.enemyShots.splice(i, 1);
        continue;
      }
      if (b.x < L.houseX - 80) this.enemyShots.splice(i, 1);
    }
  }

  updateLobs(dt) {
    for (let i = this.lobs.length - 1; i >= 0; i--) {
      const m = this.lobs[i];
      m.t += dt;
      const k = clamp(m.t / m.dur, 0, 1);
      m.x = lerp(m.x0, m.x1, k);
      m.y = lerp(m.y0, m.y1, k) - Math.sin(k * Math.PI) * 190;
      m.rot += dt * 6;
      if (k >= 1) {
        this.lobs.splice(i, 1);
        sfx('melon');
        this.shake(7, 0.2);
        this.particles.burst(m.x, m.y, '#ffc84a', 18, 360, 9);
        this.particles.ring(m.x, m.y, 'rgba(255,225,120,.86)', 26, 3.4, 0.4);
        for (const z of this.zombies) {
          if (z.dead || !z.hittable) continue;
          const dx = Math.abs(z.x - m.x);
          const dr = Math.abs(z.row - m.row);
          if (dr === 0 && dx < 52) this.hurt(z, m.dmg, 'lob');
          else if (dr <= 1 && dx < CELL_W * 1.05) this.hurt(z, m.splash, 'lob');
        }
      }
    }
  }

  updateFires(dt) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t += dt;
      f.x += 760 * dt;
      this.particles.fire(f.x, groundY(f.row) - 50, 4);
      for (const z of this.zombies) {
        if (z.dead || z.row !== f.row || f.hit.has(z)) continue;
        if (Math.abs(z.x - f.x) < 70) { f.hit.add(z); this.hurt(z, 420, 'fire'); }
      }
      if (f.x > L.vw + 80) this.fires.splice(i, 1);
    }
  }

  updateSuns(dt) {
    for (let i = this.suns.length - 1; i >= 0; i--) {
      const s = this.suns[i];
      s.t += dt;
      if (s.state === 'collect') {
        s.collectT += dt;
        const k = clamp(s.collectT / .52, 0, 1);
        const ease = 1 - Math.pow(1 - k, 3);
        s.x = lerp(s.collectX, L.vw - 238, ease);
        s.y = lerp(s.collectY, 60, ease) - Math.sin(k * Math.PI) * 90;
        if (k >= 1) {
          this.sun += s.value;
          this.stats.sun += s.value;
          this.particles.sparkle(s.x, s.y, '#fff2a8', 10);
          this.suns.splice(i, 1);
        }
      } else if (s.state === 'hop') {
        s.vy += 900 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.vy > 0 && s.y >= s.restY) { s.y = s.restY; s.state = 'rest'; }
      } else if (s.state === 'fall') {
        s.y += s.vy * dt;
        if (s.y >= s.restY) { s.y = s.restY; s.state = 'rest'; }
      } else {
        s.life -= dt;
        if (s.life <= 0) { this.suns.splice(i, 1); continue; }
      }
    }
  }

  updateFoods(dt) {
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      f.t += dt;
      f.life -= dt;
      if (!f.landed) {
        f.vy += 700 * dt;
        f.y += f.vy * dt;
        if (f.y >= f.baseY) { f.y = f.baseY; f.landed = true; }
      } else {
        f.y = f.baseY + Math.sin(f.t * 2.4) * 10;
      }
      if (f.life <= 0) this.foods.splice(i, 1);
    }
  }

  updateMowers(dt) {
    for (const m of this.mowers) {
      if (m.state === 'idle') continue;
      if (m.state === 'gone') continue;
      m.x += 720 * dt;
      m.spin += dt * 26;
      this.particles.add({
        x: m.x - 20, y: groundY(m.row) + 4, vx: rnd(-160, -320), vy: rnd(-40, -220),
        g: 900, r: rnd(6, 2), color: Math.random() < .5 ? '#ffcf4f' : '#f3a52c', life: rnd(0.5, 0.2), shrink: true,
      });
      for (const z of this.zombies) {
        if (z.dead || z.row !== m.row) continue;
        if (Math.abs(z.x - m.x) < 60) { this.hurt(z, 99999, 'mower'); }
      }
      if (m.x > L.vw + 60) m.state = 'gone';
    }
  }

  // ---------------------------------------------------------------- waves

  updateWaves(dt) {
    // trickle out the queued spawns
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const q = this.spawnQueue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this.spawnQueue.splice(i, 1);
        const z = this.spawnZombie(q.id, q.row, q.x, q.opts);
        if (q.grave) { z.rising = 0.9; this.particles.dirt(z.x, z.y, 12); }
        sfx('groan', 1.2);
      }
    }

    const remaining = this.zombies.filter((z) => !z.dead).length;
    const done = Number.isFinite(this.level.waves) && this.waveNo >= this.level.waves;

    if (done) {
      if (remaining === 0 && this.spawnQueue.length === 0 && this.status === 'playing') this.win();
      return;
    }

    this.waveTimer -= dt;
    // if the lawn is clear, hurry the next wave along
    if (remaining === 0 && this.spawnQueue.length === 0 && this.waveTimer > 3.5 && this.waveNo > 0) {
      this.waveTimer = 3.5;
    }
    if (this.waveTimer <= 0) this.startWave();
  }

  startWave() {
    this.waveNo++;
    this.stats.waves = this.waveNo;
    const lvl = this.level;
    const list = buildWave(lvl, this.waveNo, Math.random);
    const flag = lvl.flagEvery && this.waveNo % lvl.flagEvery === 0;
    const last = Number.isFinite(lvl.waves) && this.waveNo === lvl.waves;

    if (last) { this.banner('FINAL WAVE', 3); sfx('huge'); this.hugeT = 6; this.flash('#ff6a4a', 0.4); }
    else if (flag) { this.banner('A huge wave is approaching', 2.8); sfx('warn'); this.hugeT = 5; }

    // one carrier per wave from wave 2 on, so plant food keeps arriving
    const carrier = this.waveNo >= 2 ? rndInt(0, list.length - 1) : -1;

    let delay = flag || last ? 1.6 : 0;
    list.forEach((id, i) => {
      const row = pick(this.rows);
      const fromGrave = this.graves.length && Math.random() < 0.22
        ? this.graves.filter((g) => !g.gone && this.playableRow(g.row))[0] : null;
      const g = fromGrave && Math.random() < 0.5 ? fromGrave : null;
      this.spawnQueue.push({
        t: delay,
        id,
        row: g ? g.row : row,
        x: g ? g.x : L.vw + 50 + rnd(180),
        grave: !!g,
        opts: { carriesFood: i === carrier },
      });
      delay += rnd(1.5, 0.35) / (1 + this.waveNo * 0.03);
    });

    this.waveTimer = Math.max(waveGap(lvl, this.waveNo), delay + 4);
  }

  progress() {
    if (!Number.isFinite(this.level.waves)) return clamp(this.waveNo / 25, 0, 1);
    const spawned = this.waveNo / this.level.waves;
    return clamp(spawned, 0, 1);
  }

  // ----------------------------------------------------------- end states

  win() {
    if (this.status !== 'playing') return;
    this.status = 'won';
    this.statusT = 0;
    sfx('win');
    this.banner('Garden held!', 3);
    for (let i = 0; i < 26; i++) {
      this.after(i * 0.06, () => this.particles.burst(
        rnd(L.gx + L.gw, L.gx), rnd(L.gy + L.gh, L.gy), pick(['#ffe27a', '#8bff9a', '#8fd9ff', '#ff9ad2']), 12, 380, 8));
    }
  }

  lose() {
    if (this.status !== 'playing') return;
    this.status = 'lost';
    sfx('lose');
    this.shake(20, 0.6);
    this.flash('#3a0a0a', 0.6);
  }
}
