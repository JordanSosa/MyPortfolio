/**
 * Second evolutions, package D (docs/content/weapons.md §8.3) - what the generic drawers cannot express:
 *
 *   Who Are You Again?       (weapons/notice-me-sparkles.ts) the HEARTBREAK burst: fx_heartbreak cracking
 *       over the spot, a pale-pink soft ring, heart bits; "who?" at most once a second. (The aura itself is
 *       the base weapon's: heroes-b-fx draws it for this id too.)
 *   Skip Intro               (weapons/henshin-burst.ts) its own burst (SKIP_BURST): a crisp mint ring and
 *       sparks - no glow ring, shockwave or bloom at this rate - the "SKIP >>" pop over her head (once
 *       per 4 s), and the stock-footage finisher: a second, pink ring and a sparkle shower.
 *   "Holding Back" Fireball  (weapons/cheat-fireball.ts) the small pops (sparks, no explosion), the stream's
 *       rate-limited sfx, "MP: 9999/9999" once a run, the sneeze.
 *   Free Delivery            (weapons/horn-of-reincarnation.ts) the reversed HONK arcs closing in on the
 *       truck, fx_parcel boxes on the pulled enemies, tape scraps on the delivery.
 *   All-You-Can-Eat Nabe     (weapons/kotatsu-of-sloth.ts) the deployed kotatsu with w_nabe on it, the
 *       cooking floor, steam, the ladle splash on a snack.
 *
 * Everything that can land on the hero is a particle on the fx layers or passes Flag.Focus; nothing is
 * drawn on her as a marker (no rings, pips or timers). Module-scope pools, no allocation per frame.
 */
import { C } from "../../art/palette";
import { TAU, easeOutBack } from "../../core/math";
import { P, type EmitterDef } from "../../fx";
import type { Enemy } from "../../game/types";
import { HOLD_POP, HOLD_SHOT, HOLD_SNEEZE } from "../../game/weapons/cheat-fireball";
import { BURST_FINISHER, SKIP_BURST } from "../../game/weapons/henshin-burst";
import { FD_PARCEL, FD_PULL, FD_SLAM } from "../../game/weapons/horn-of-reincarnation";
import { NABE_SNACK, kotatsuOf } from "../../game/weapons/kotatsu-of-sloth";
import { WHO_BURST } from "../../game/weapons/notice-me-sparkles";
import { Flag, Layer } from "../../render/layers";
import type { Evo2Kit, Evo2Module } from "../evo2-fx";


/** A timed cue the module draws for a moment (pooled). */
interface Tick {
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  n: number;
  t: number;
  life: number;
  e: Enemy | null;
  uid: number;
}
function pool(n: number): Tick[] {
  return Array.from({ length: n }, () => ({ x: 0, y: 0, x2: 0, y2: 0, r: 0, n: 0, t: 0, life: 0, e: null, uid: 0 }));
}
function push(list: Tick[], i: number, x: number, y: number, x2: number, y2: number, r: number, n: number, life: number): Tick {
  const t = list[i % list.length];
  t.x = x;
  t.y = y;
  t.x2 = x2;
  t.y2 = y2;
  t.r = r;
  t.n = n;
  t.t = 0;
  t.life = life;
  t.e = null;
  return t;
}
function clear(list: Tick[]): void {
  for (const t of list) {
    t.life = 0;
    t.e = null;
  }
}

/** Real seconds since the module loaded (rate limits). */
let now = 0;

// ================================================================ Who Are You Again?
const WHO = "who_are_you_again";
const heartBits: EmitterDef = { ...P.hearts, speed: [26, 70], life: [0.3, 0.55], size: [0.8, 0.4], colors: [C.pink, C.pinkLight, C.hotPink] };
const breaks = pool(16);
let breakI = 0;
let breakN = 0;
let whoAt = -9;

const who: Evo2Module = {
  ids: [WHO],
  reset() {
    clear(breaks);
    whoAt = -9;
  },
  bind(w, kit) {
    return [
      w.bus.on("heroFx", (e) => {
        if (e.kind !== WHO_BURST) return;
        push(breaks, breakI++, e.x, e.y, 0, 0, e.r, 0, 0.42);
        if (breakN++ < 5) kit.fx.ps.emit(heartBits, e.x, e.y - 2, 4);
        if (now - whoAt >= 1) {
          whoAt = now;
          kit.texts.add("who?", e.x, e.y - 16, { scale: 1, color: C.pinkLight, life: 0.7, rise: 8 });
        }
      }),
    ];
  },
  frame(kit, _w, _time, _dt, realDt) {
    breakN = 0;
    const b = kit.r.batch;
    const heart = kit.anims.get("fx_heartbreak");
    const soft = kit.anims.get("fx_ring_soft").first;
    for (const t of breaks) {
      if (t.life <= 0) continue;
      t.t += realDt;
      if (t.t >= t.life) {
        t.life = 0;
        continue;
      }
      const k = t.t / t.life;
      // the ring sweeps out to the burst radius; the heart cracks over the spot and drops
      const R = Math.max(2, t.r * (0.35 + 0.65 * k));
      // (a plain pink ring, not an additive one: the school's pale floor turns additive pink into white)
      b.drawP(Layer.Fx, soft, t.x, t.y, R / 32, R / 32, 0, C.pink, 0.85 * (1 - k), 0, Flag.NoSnap | Flag.Focus, 32, 32);
      const f = Math.min(heart.count - 1, Math.floor(k * heart.count));
      kit.r.spr(Layer.Text, heart.first + f, t.x, t.y - 9 + k * 6, 1.5, 1.5, 0, 0xffffff, k > 0.7 ? (1 - k) / 0.3 : 1, 0, Flag.NoSnap | Flag.Focus);
    }
  },
};

// ================================================================ Skip Intro
const SKIP = "skip_intro";
const skipSpark: EmitterDef = { ...P.sparkle, speed: [40, 120], life: [0.25, 0.5], size: [1, 0.7], colors: [C.mint, C.white, C.lightBlue] };
const finSpark: EmitterDef = { ...P.sparkle, speed: [50, 150], life: [0.3, 0.6], size: [1.1, 0.8], colors: [C.pinkLight, C.paleYellow, C.white, C.mint] };
const skipPop = pool(1);
const finRings = pool(4);
let finI = 0;
let skipAt = -9;
let stockAt = -99;

const skip: Evo2Module = {
  ids: [SKIP],
  reset() {
    clear(skipPop);
    clear(finRings);
    skipAt = -9;
    stockAt = -99;
  },
  bind(w, kit, o) {
    return [
      w.bus.on("heroFx", (e) => {
        if (e.kind !== SKIP_BURST) return;
        const fin = (e.n & BURST_FINISHER) !== 0;
        push(finRings, finI++, e.x, e.y, 0, 0, e.r, 0, 0.36);
        kit.fx.ps.emit(skipSpark, e.x, e.y, e.n & 1 ? 5 : 9);
        o.sfx("explosion", fin ? 0.5 : 0.3, fin ? 4 : 9, e.x);
        if (!o.calm) kit.fx.juice.shake(fin ? 0.14 : 0.05);
        if (now - skipAt >= 4) {
          skipAt = now;
          push(skipPop, 0, 0, 0, 0, 0, 0, 0, 0.9);
        }
        if (!fin) return;
        // the stock-footage finisher: a second, pink ring and a shower of sparkles
        push(finRings, finI++, e.x, e.y, 0, 0, e.r * 0.8, 1, 0.5);
        kit.fx.ps.emit(finSpark, e.x, e.y, 14);
        o.sfx("transform", 0.3, 5, e.x);
        o.haptic(15);
        if (now - stockAt >= 20) {
          stockAt = now;
          kit.texts.add("(stock footage)", 0, -44, { anchor: 1, scale: 1, color: C.mint, life: 1.1, rise: 6 });
        }
      }),
    ];
  },
  frame(kit, w, _time, _dt, realDt) {
    const r = kit.r;
    const soft = kit.anims.get("fx_ring_soft").first;
    for (const t of finRings) {
      if (t.life <= 0) continue;
      t.t += realDt;
      if (t.t >= t.life) {
        t.life = 0;
        continue;
      }
      const k = t.t / t.life;
      // (plain blend, no bloom: a ring this size every 1.25 s must not light the whole screen)
      const R = t.r * (0.25 + 0.75 * Math.sqrt(k));
      r.batch.drawP(Layer.Fx, soft, t.x, t.y, R / 32, R / 32, 0, t.n ? C.pink : C.mint, 0.9 * (1 - k * k), 0, Flag.NoSnap | Flag.Focus, 32, 32);
    }
    const s = skipPop[0];
    if (s.life <= 0) return;
    s.t += realDt;
    if (s.t >= s.life) {
      s.life = 0;
      return;
    }
    // "SKIP >>" above her head (clear of her sprite), popping in and sliding off to the right
    const k = s.t / s.life;
    const sc = k < 0.2 ? easeOutBack(k / 0.2) : 1;
    const slide = k > 0.6 ? ((k - 0.6) / 0.4) ** 2 * 26 : 0;
    const p = w.player;
    r.spr(Layer.Text, kit.anims.get("fx_skip").first, p.x + slide, p.y - 38, sc, sc, 0, 0xffffff, k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1, 0, Flag.NoSnap);
  },
};

// ================================================================ "Holding Back" Fireball
const HOLD = "holding_back";
const POP_BUDGET = 10;
const popSpark: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [30, 90],
  spread: TAU,
  life: [0.12, 0.26],
  size: [1.4, 0.6],
  colors: [C.orange, C.yellow, C.paleYellow, C.red],
  drag: 5,
  alphaCurve: "late",
  layer: Layer.Fx,
};
const sneezePuff: EmitterDef = { ...P.smoke, speed: [10, 30], life: [0.3, 0.5], size: [0.5, 0.9], colors: [C.offWhite, C.paleYellow] };
let pops = 0;
let shotAt = -9;
let mpShown = false;

const holding: Evo2Module = {
  ids: [HOLD],
  reset() {
    mpShown = false;
    shotAt = -9;
  },
  frame() {
    pops = 0;
  },
  bind(w, kit, o) {
    return [
      w.bus.on("heroFx", (e) => {
        if (e.kind === HOLD_POP) {
          if (pops++ >= POP_BUDGET) return;
          const ps = kit.fx.ps;
          ps.emit(popSpark, e.x, e.y, 4);
          ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.orange, e.r / 14);
        } else if (e.kind === HOLD_SHOT) {
          if (now - shotAt >= 0.125) {
            shotAt = now;
            o.sfx("fireball", 0.35, 4 + (e.n % 3), e.x);
          }
          // the status window, once a run: all those casts and the bar has not moved
          if (!mpShown && e.n >= 40) {
            mpShown = true;
            kit.texts.add("MP: 9999/9999", 0, -40, { anchor: 1, scale: 1, color: C.lightBlue, life: 1.6, rise: 6 });
          }
        } else if (e.kind === HOLD_SNEEZE) {
          kit.fx.ps.emit(sneezePuff, e.x, e.y, 4);
          kit.texts.add("achoo!", 0, -40, { anchor: 1, scale: 1, color: C.paleYellow, life: 0.9, rise: 8, wobble: 2 });
        }
      }),
    ];
  },
};

// ================================================================ Free Delivery
const FREE = "free_delivery";
const tape: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [40, 120],
  spread: 1.9,
  life: [0.3, 0.6],
  size: [1.5, 1],
  aspect: 2.4,
  colors: [C.offWhite, C.paleYellow, 0xdda574, C.white],
  gravity: 160,
  drag: 2,
  rot: "random",
  spin: [4, 12],
  alphaCurve: "late",
  layer: Layer.Fx,
};
const pulls = pool(4);
const parcels = pool(16);
const pillars = pool(3);
let pillarI = 0;
let pullI = 0;
let parcelI = 0;
let slamAt = -9;
let deliveredAt = -99;

/** Draw the pulled enemies' parcels (before the pulls: the boxes sort with their enemies). */
function drawParcels(kit: Evo2Kit, realDt: number): void {
  const r = kit.r;
  const b = r.batch;
  const box = kit.anims.get("fx_parcel").first;
  for (const t of parcels) {
    if (t.life <= 0) continue;
    t.t += realDt;
    const e = t.e;
    if (t.t >= t.life || !e || e.dead || e.uid !== t.uid) {
      t.life = 0;
      t.e = null;
      continue;
    }
    const k = t.t / t.life;
    // the box drops over the enemy, rides along, and pops off at the bumper
    const s = (k < 0.15 ? easeOutBack(k / 0.15) : 1) * Math.min(2, Math.max(1.25, e.r / 5));
    b.sortKey = e.y + 0.02;
    r.spr(Layer.Entity, box + (Math.floor(t.t * 12) & 1), e.x, e.y - e.z - e.cy, s, s, Math.sin(t.t * 22) * 0.12, 0xffffff, k > 0.8 ? (1 - k) / 0.2 : 1, 0, Flag.NoSnap);
    b.sortKey = NaN;
  }
}

const delivery: Evo2Module = {
  ids: [FREE],
  reset() {
    clear(pulls);
    clear(parcels);
    clear(pillars);
    slamAt = -9;
    deliveredAt = -99;
  },
  bind(w, kit, o) {
    return [
      w.bus.on("heroFx", (e) => {
        if (e.kind === FD_PULL) {
          push(pulls, pullI++, e.x, e.y, e.x2, e.y2, e.r, e.n, 0.34);
          o.sfx("honk", 0.6, -5, e.x);
        } else if (e.kind === FD_PARCEL && e.enemy) {
          const t = push(parcels, parcelI++, 0, 0, 0, 0, 0, 0, 0.6);
          t.e = e.enemy;
          t.uid = e.enemy.uid;
        } else if (e.kind === FD_SLAM) {
          const ps = kit.fx.ps;
          const kills = Math.floor(e.n / 100);
          const n = e.n % 100;
          // isekai'd: ONE light pillar for the whole delivery, at the drop spot off the bumper
          if (kills > 0) push(pillars, pillarI++, e.x + e.x2 * 6, e.y + e.y2 * 6 + 8, 0, 0, Math.min(1.8, 1 + kills * 0.12), 0, 0.5);
          ps.emit(tape, e.x, e.y, Math.min(10, 4 + n), Math.atan2(e.y2, e.x2));
          ps.emit(P.debris, e.x, e.y, Math.min(6, 2 + n));
          ps.emit(P.dust, e.x, e.y + 6, 3);
          if (now - slamAt >= 0.2) {
            slamAt = now;
            if (!o.calm) kit.fx.juice.shake(0.12);
            o.sfx("hitCrit", 0.5, -7, e.x);
            o.haptic(15);
          }
          if (n >= 3 && now - deliveredAt >= 8) {
            deliveredAt = now;
            kit.texts.add("DELIVERED!", 0, -40, { anchor: 1, scale: 1, color: C.yellow, life: 0.9, rise: 8 });
          }
        }
      }),
    ];
  },
  frame(kit, _w, _time, _dt, realDt) {
    drawParcels(kit, realDt);
    const b = kit.r.batch;
    const pil = kit.anims.get("fx_light_pillar");
    for (const t of pillars) {
      if (t.life <= 0) continue;
      t.t += realDt;
      if (t.t >= t.life) {
        t.life = 0;
        continue;
      }
      const k = t.t / t.life;
      kit.r.spr(Layer.FxAdd, pil.first + Math.min(pil.count - 1, Math.floor(k * pil.count)), t.x, t.y, t.r, t.r * (0.8 + 0.4 * k), 0, 0xffffff, 1 - k * k, 0, Flag.Add | Flag.Glow | Flag.Focus);
    }
    const wave = kit.anims.get("w_honk_wave");
    for (const t of pulls) {
      if (t.life <= 0) continue;
      t.t += realDt;
      if (t.t >= t.life) {
        t.life = 0;
        continue;
      }
      // the reversed HONK: three arcs that start out at the cone's end and close in on the bumper
      const k = t.t / t.life;
      const a = Math.atan2(t.y2, t.x2);
      for (let j = 0; j < 3; j++) {
        const q = k * 1.25 - j * 0.16;
        if (q <= 0 || q >= 1) continue;
        const d = t.r * (1 - q) * 0.82;
        const s = (t.r / 32) * (0.35 + 0.75 * (1 - q));
        const f = Math.min(wave.count - 1, Math.floor((1 - q) * wave.count));
        // (plain blend, no bloom: three additive arcs this size read as a white beam across the screen)
        b.drawP(Layer.Fx, wave.first + f, t.x + t.x2 * d, t.y + t.y2 * d, s * 0.45, s, a, j === 1 ? C.white : C.yellow, 0.7 * Math.sin(q * Math.PI), 0, Flag.NoSnap | Flag.Focus, 4, 16);
      }
    }
  },
};

// ================================================================ All-You-Can-Eat Nabe
const NABE = "all_you_can_eat_nabe";
const nabeSteam: EmitterDef = { ...P.smoke, speed: [6, 14], angle: -Math.PI / 2, spread: 0.7, life: [0.5, 0.9], size: [0.35, 0.8], colors: [C.white, C.offWhite], alpha: 0.7, layer: Layer.Fx };
const simmer: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [4, 12],
  angle: -Math.PI / 2,
  spread: 0.6,
  life: [0.3, 0.6],
  size: [1.2, 0.5],
  colors: [C.paleYellow, C.orange, C.white],
  alphaCurve: "late",
  layer: Layer.FxBelow,
};
const ladle: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [40, 100],
  angle: -Math.PI / 2,
  spread: 1.6,
  life: [0.3, 0.55],
  size: [1.6, 0.8],
  colors: [C.yellow, C.paleYellow, C.orange, C.white],
  gravity: 260,
  alphaCurve: "late",
  layer: Layer.Fx,
};
/**
 * Where the pot stands, from the kotatsu's feet: on the quilt's front corner, drawn in FRONT of whoever sits
 * there (on the table top it hid behind her hair; the pot is the weapon, it has to read).
 */
const POT_DX = 14;
const POT_DY = 3;
const so = { id: "", frame: 0, x: 0, y: 0, layer: Layer.Entity as number, scale: 1, color: 0xffffff, alpha: 1, noSnap: true, sortY: 0 };
let frameN = 0;
let potX = 0;
let potY = 0;
let potOn = false;

const nabe: Evo2Module = {
  ids: [NABE],
  reset() {
    potOn = false;
  },
  frame() {
    frameN++;
    potOn = false;
  },
  bind(w, kit, o) {
    return [
      w.bus.on("heroFx", (e) => {
        if (e.kind !== NABE_SNACK) return;
        const ps = kit.fx.ps;
        // the ladle splash: broth out of the pot, a sparkle where dinner landed
        if (potOn) ps.emit(ladle, potX, potY - 8, 8);
        ps.emit(P.sparkle, e.x, e.y - 4, 4, NaN, C.paleYellow, 0.9);
        o.sfx("bubblePop", 0.6, 3, e.x);
      }),
    ];
  },
  draw(kit, _w, inst, time, dt) {
    const K = kotatsuOf(inst);
    if (!K || !K.deployed || K.r <= 1) return;
    const r = kit.r;
    const ps = kit.fx.ps;
    const hot = Math.min(1, K.heat / 1.8);
    const ax = K.x;
    const ay = K.y - 6;
    // the cooking floor: a warm disc that deepens as the pot heats up, a soft rim at the aura's edge
    const pulse = 0.5 + 0.5 * Math.sin(time * (2.4 + 3 * hot));
    r.circle(Layer.Decal, ax, ay, K.r, hot > 0.5 ? C.red : C.orange, 0.07 + 0.05 * hot + 0.02 * pulse);
    r.batch.drawP(Layer.Decal, kit.anims.get("fx_ring_soft").first, ax, ay, K.r / 31, K.r / 31, 0, C.paleYellow, 0.4 + 0.15 * pulse, 0, Flag.NoSnap, 32, 32);
    // the kotatsu (sorted just behind the hero) and the pot beside her
    so.id = "w_kotatsu";
    so.frame = 1 + (Math.floor(time * 2) & 1);
    so.x = K.x;
    so.y = K.y + 3;
    so.sortY = K.y - 0.5;
    r.sprite(so);
    potX = K.x + POT_DX;
    potY = K.y + POT_DY;
    potOn = true;
    so.id = "w_nabe";
    so.frame = Math.floor(time * (4 + 6 * hot)) % 3;
    so.x = potX;
    so.y = potY;
    so.sortY = K.y + 0.5;
    r.sprite(so);
    if (dt <= 0) return;
    // steam off the pot, and the floor simmers where things cook (more of both as it heats up)
    if (frameN % (hot > 0.5 ? 7 : 14) === 0) ps.emit(nabeSteam, potX + (ps.rng.next() - 0.5) * 10, potY - 12, 1);
    if (frameN % 5 === 0 && ps.count < ps.capacity * 0.7) {
      const a = ps.rng.next() * TAU;
      const d = Math.sqrt(ps.rng.next()) * K.r * 0.92;
      ps.emit(simmer, ax + Math.cos(a) * d, ay + Math.sin(a) * d, 1 + (hot > 0.5 ? 1 : 0));
    }
  },
};

/** The shared clock (the first module's `frame` runs once per drawn frame). */
const clock: Evo2Module = {
  ids: [],
  frame(_kit, _w, _time, _dt, realDt) {
    now += realDt;
  },
};

export const evo2: Evo2Module[] = [clock, who, skip, holding, delivery, nabe];
