/**
 * Autoplay bot (PURE - no DOM). Used by tests, the e2e script, ?autoplay=1 and
 * the title-screen attract mode.
 *
 *   const bot = new Bot();
 *   bot.think(world, world.input, dt);          // writes move + dash/ult edges
 *   world.choose(bot.pick(world, world.offer()));
 *
 * Steering = flee enemy pressure (inverse-square, bullets weigh more) + keep a
 * hero-specific preferred distance to the nearest enemy + seek gems/pickups
 * when it is safe + a slow wander. Dashes when crowded, casts the ultimate
 * when the screen is busy.
 */
import { Rng } from "../core/rng";
import { CFG } from "../game/config";
import type { UpgradeCard } from "../game/types";
import type { SimInput, World } from "../game/world";
import { LUNA_RING_N, lunaRing } from "../game/bosses/_luna";

const ringPt = { x: 0, y: 0 };

const PREF: Record<string, number> = { hoshi: 70, rin: 26, mochi: 24 };
/** Distance a player keeps from a boss while healthy: melee heroes walk up to it, Hoshi stays in range. */
const BOSS_ENGAGE: Record<string, number> = { hoshi: 80, rin: 24, mochi: 26 };
/** How much an average player values each passive (damage first; utility last unless it evolves something). */
const PASSIVE_VALUE: Record<string, number> = {
  power_bow: 8,
  wish_charm: 7,
  big_ribbon: 6,
  twin_charm: 6,
  heart_locket: 5,
  swift_shoes: 3,
  magnet_star: 1,
  lucky_clover: 0,
};

export class Bot {
  private rng: Rng;
  private dx = 1;
  private dy = 0;
  private wander = 0;
  private think_t = 0;
  private stuck = 0;
  /** Seconds the Overdrive meter has been full (a player doesn't sit on a charged ult forever). */
  private ultHeld = 0;
  /** 0..1: how sloppy the bot is (attract mode looks more natural with a bit). */
  sloppiness = 0.15;
  /** Weak-player proxy (balance probe): never dashes. */
  noDash = false;
  /** Weak-player proxy (balance probe): picks level-up cards at random. */
  randomPicks = false;
  /** Human reaction time: bullets younger than this (s) are not dodged yet. */
  reaction = 0.18;

  constructor(seed = 1234) {
    this.rng = new Rng(seed);
    this.wander = this.rng.angle();
  }

  think(w: World, out: SimInput, dt: number): void {
    const p = w.player;
    if (w.phase !== "play") {
      out.mx = out.my = 0;
      return;
    }
    this.think_t += dt;
    this.wander += dt * (0.25 + 0.2 * Math.sin(this.think_t * 0.13));
    const px = p.x;
    const py = p.y - 8;
    let fx = 0;
    let fy = 0;
    let crowd = 0;
    let near = 0;
    let nearest = 1e9;
    let nx = 0;
    let ny = 0;
    const items = w.enemies.items;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = items[i];
      if (e.dead || e.def.prop) continue;
      const dx = px - e.x;
      const dy = py - (e.y - e.cy);
      const d2 = dx * dx + dy * dy;
      if (d2 > 110 * 110) continue;
      const d = Math.sqrt(d2) || 1;
      // big hitters (teddies, pumpkins, elites, bosses) are given a wider berth than puffs
      const hit = Math.min(2.5, Math.max(0.6, e.dmg / 7)) * (e.r > 8 ? 1.3 : 1);
      const k = ((e.def.boss ? 4 : e.elite ? 2 : 1) * hit) / Math.max(36, d2 - e.r * e.r);
      fx += (dx / d) * k * 400;
      fy += (dy / d) * k * 400;
      if (d < 26) crowd++;
      if (d < 60) near++;
      if (d < nearest) {
        nearest = d;
        nx = -dx / d;
        ny = -dy / d;
      }
    }
    for (let i = 0; i < w.bullets.count; i++) {
      const b = w.bullets.items[i];
      if (b.age < this.reaction) continue;
      const dx = px - b.x;
      const dy = py - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 70 * 70) continue;
      const d = Math.sqrt(d2) || 1;
      fx += (dx / d) * (1600 / Math.max(25, d2));
      fy += (dy / d) * (1600 / Math.max(25, d2));
    }
    // telegraphs (jump circles, dash lanes, claw sweeps): step out like a human reading the warning
    for (let i = 0; i < w.telegraphs.count; i++) {
      const t = w.telegraphs.items[i];
      if (t.dead) continue;
      const fx0 = p.x;
      const fy0 = p.y;
      let ox: number;
      let oy: number;
      let dist: number;
      if (t.shape === 0) {
        ox = fx0 - t.x;
        oy = fy0 - t.y;
        dist = Math.sqrt(ox * ox + oy * oy);
      } else {
        // closest point on the lane segment
        const sx = t.x2 - t.x;
        const sy = t.y2 - t.y;
        const L2 = sx * sx + sy * sy || 1;
        const u = Math.min(1, Math.max(0, ((fx0 - t.x) * sx + (fy0 - t.y) * sy) / L2));
        ox = fx0 - (t.x + sx * u);
        oy = fy0 - (t.y + sy * u);
        dist = Math.sqrt(ox * ox + oy * oy);
        if (dist < 0.5) {
          // dead centre: sidestep perpendicular to the lane
          const l = Math.sqrt(L2);
          ox = -sy / l;
          oy = sx / l;
          dist = 0.5;
        }
      }
      const edge = t.r + 10;
      if (dist < edge) {
        const k = 3 * (1 - dist / edge) + 1;
        const l = dist || 1;
        fx += (ox / l) * k;
        fy += (oy / l) * k;
      }
    }
    // Lady Lunatic's orbiting moon ring is a hazard too (not in the bullet list)
    const boss = w.boss;
    if (boss && boss.def.id === "lady_lunatic") {
      for (let i = 0; i < LUNA_RING_N; i++) {
        if (!lunaRing(boss, i, ringPt)) break;
        const dx = px - ringPt.x;
        const dy = py - ringPt.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 50 * 50) continue;
        const d = Math.sqrt(d2) || 1;
        fx += (dx / d) * (1600 / Math.max(25, d2));
        fy += (dy / d) * (1600 / Math.max(25, d2));
      }
    }
    // keep the preferred distance to the nearest enemy (melee heroes close in)
    const pref = PREF[w.hero.id] ?? 50;
    const hpK = p.hp / p.maxHp;
    // chase the boss into weapon range while healthy (it floats away / hovers out of melee reach otherwise)
    if (boss && !boss.dead && hpK > 0.45) {
      const bx = boss.x - px;
      const by = boss.y - boss.cy - py;
      const bd = Math.sqrt(bx * bx + by * by) || 1;
      const want = (BOSS_ENGAGE[w.hero.id] ?? 60) + boss.r;
      if (bd > want) {
        const k = Math.min(1.2, (bd - want) / 40);
        fx += (bx / bd) * k;
        fy += (by / bd) * k;
      }
    }
    if (nearest < 1e8) {
      const want = hpK < 0.35 ? pref * 1.8 : pref;
      if (nearest > want + 18 && crowd === 0) {
        fx += nx * 0.9;
        fy += ny * 0.9;
      } else if (nearest < want) {
        fx -= nx * 0.6;
        fy -= ny * 0.6;
      }
    }
    // seek gems / pickups when not under pressure
    const pressure = Math.sqrt(fx * fx + fy * fy);
    if (pressure < 1.4) {
      let best = 1e9;
      let gx = 0;
      let gy = 0;
      const pr = CFG.pickupRadius * w.stats.pickup;
      for (let i = 0; i < w.pickups.count; i++) {
        const k = w.pickups.items[i];
        if (k.dead || k.state !== 0) continue;
        const dx = k.x - px;
        const dy = k.y - py;
        let d2 = dx * dx + dy * dy;
        if (k.kind === "chest") d2 *= 0.15;
        else if ((k.kind === "onigiri" || k.kind === "cake") && hpK > 0.85) continue;
        else d2 *= 0.4;
        if (d2 < best && d2 < 260 * 260) {
          best = d2;
          gx = dx;
          gy = dy;
        }
      }
      // lanterns / gift boxes: a human walks over to break them (food, magnets, bombs)
      for (let i = 0; i < w.enemies.count; i++) {
        const e = w.enemies.items[i];
        if (e.dead || !e.def.prop) continue;
        const dx = e.x - px;
        const dy = e.y - e.cy - py;
        const d2 = (dx * dx + dy * dy) * (hpK < 0.7 ? 0.2 : 0.5);
        if (d2 < best && d2 < 200 * 200) {
          best = d2;
          gx = dx;
          gy = dy;
        }
      }
      for (let i = 0; i < w.gems.count; i++) {
        const g = w.gems.items[i];
        if (g.dead || g.state !== 0) continue;
        const dx = g.x - px;
        const dy = g.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < pr * pr) continue;
        if (d2 < best && d2 < 150 * 150) {
          best = d2;
          gx = dx;
          gy = dy;
        }
      }
      if (best < 1e8) {
        const d = Math.sqrt(gx * gx + gy * gy) || 1;
        // greedier while the build is still tiny (gets the first level-ups rolling)
        const g = w.level < 4 ? 2.2 : 1.1;
        fx += (gx / d) * g;
        fy += (gy / d) * g;
      }
    }
    // wander
    fx += Math.cos(this.wander) * 0.35;
    fy += Math.sin(this.wander) * 0.35;
    // a touch of human sloppiness
    fx += (this.rng.next() - 0.5) * this.sloppiness;
    fy += (this.rng.next() - 0.5) * this.sloppiness;
    const l = Math.sqrt(fx * fx + fy * fy);
    if (l > 1e-4) {
      fx /= l;
      fy /= l;
    }
    // smooth the steering so it reads like a human on a stick
    const k = 1 - Math.exp(-10 * dt);
    this.dx += (fx - this.dx) * k;
    this.dy += (fy - this.dy) * k;
    const ol = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
    out.mx = ol > 0.05 ? this.dx / Math.max(1, ol) : 0;
    out.my = ol > 0.05 ? this.dy / Math.max(1, ol) : 0;

    // dash out of crowds
    if (!this.noDash) {
      if (p.dashCd <= 0 && (crowd >= 4 || (crowd >= 1 && hpK < 0.35))) out.dash = true;
      // stuck detection: if barely moving while pressured, dash
      const sp = Math.abs(p.vx) + Math.abs(p.vy);
      this.stuck = sp < 10 && near > 6 ? this.stuck + dt : 0;
      if (this.stuck > 0.6 && p.dashCd <= 0) {
        out.dash = true;
        this.stuck = 0;
      }
    }
    // overdrive when it matters
    // (a dominant build clears the screen before it ever looks busy: cast it on the next pack after ~20 s)
    this.ultHeld = w.ultReady ? this.ultHeld + dt : 0;
    if (w.ultReady && (near >= 10 || w.enemyCount >= 40 || w.boss || hpK < 0.4 || (this.ultHeld > 20 && (near >= 4 || w.enemyCount >= 15)))) out.ult = true;
  }

  /** Pick a level-up card. */
  pick(w: World, cards: UpgradeCard[]): UpgradeCard {
    if (this.randomPicks) return cards[this.rng.int(0, cards.length - 1)];
    let best = cards[0];
    let bs = -1e9;
    const hpK = w.player.hp / w.player.maxHp;
    for (const c of cards) {
      let s = 0;
      switch (c.kind) {
        case "evolution":
          s = 1000;
          break;
        case "weapon":
          s = c.from > 0 ? 40 + c.to * 2 : w.weapons.length < 4 ? 34 : 8;
          break;
        case "passive": {
          s = (c.from > 0 ? 22 : 16) + (PASSIVE_VALUE[c.id] ?? 3);
          for (const inst of w.weapons) if (inst.def.evolution?.with === c.id) s += 26;
          if (c.id === "heart_locket" && hpK < 0.5) s += 10;
          break;
        }
        case "heal":
          s = hpK < 0.5 ? 60 : 2;
          break;
        case "coins":
          s = 3;
          break;
      }
      if (c.rarity === "epic") s += 6;
      s += this.rng.next() * 6;
      if (s > bs) {
        bs = s;
        best = c;
      }
    }
    return best;
  }
}

/**
 * Run a world headless with the bot for `seconds` (fixed dt). Level-ups and
 * chests are resolved by the bot; revives are used when available.
 * Returns the number of steps taken. `onStep` can stop early by returning false.
 */
export function simulate(w: World, seconds: number, dt = 1 / 30, bot = new Bot(w.rng.seed ^ 0x5eed), onStep?: (w: World) => boolean | void): number {
  const end = w.t + seconds;
  let steps = 0;
  let guard = 0;
  while (w.t < end && guard++ < seconds / dt + 4000) {
    if (w.phase === "dead") {
      if (!w.revive()) break;
    }
    if (w.phase === "victory") break;
    bot.think(w, w.input, dt);
    w.step(dt);
    steps++;
    while (w.pendingLevels > 0) w.choose(bot.pick(w, w.offer()));
    while (w.pendingChests.length > 0) w.openChest();
    if (onStep && onStep(w) === false) break;
  }
  return steps;
}
