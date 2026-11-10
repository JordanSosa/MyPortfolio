/**
 * Second evolutions, package B (docs/content/weapons.md §8). What the generic projectile drawer cannot show:
 *
 *   SOAP OPERA (bubble-aura.ts)        the bubbles are generic sprites (`w_soap_bubble`, PK_FREE: they fade over
 *       her). Here: what is left of the aura (a faint wash on the ground, under everyone), the pop (ring +
 *       droplets) and a "?!" now and then when a bubble closes on somebody.
 *   REFRACTION OVERLOAD (prism-beam.ts) the beams: crisp lines, white -> cyan -> a rainbow tier, a glint at each
 *       tip and each split. No additive haze and no bloom along the line (a long soft streak reads as a
 *       flashlight); every beam fades over her (Flag.Focus).
 *   BROWN SUGAR RAILGUN (bubble-tea-cannon.ts) the syrup streak (`fx_syrup` tiles on the decal layer), the straw
 *       line behind each pearl, the straw-shaped muzzle flash.
 *   FAILED EXAM STORM (paper-crane-flock.ts) paper bits on hits, scraps and the grade on a kill.
 *   UNDERGROUND MOSH PIT (idol-lightstick-wave.ts) the stomp: a ring on the floor under her (Layer.FxBelow) and
 *       dust kicked out along it (`fx_stomp`, particles: they fade over her).
 *
 * Budgets reset in `frame`; emitters and state at module scope (nothing allocated per frame).
 */
import { C } from "../../art/palette";
import { rainbow } from "../../core/color";
import { TAU } from "../../core/math";
import { P, type EmitterDef } from "../../fx";
import { PK_MANAGED } from "../../game/types";
import { SOAP_POP, SOAP_TRAP } from "../../game/weapons/bubble-aura";
import { BOBA_COLOR, RAIL_FIRE } from "../../game/weapons/bubble-tea-cannon";
import { MOSH_STOMP } from "../../game/weapons/idol-lightstick-wave";
import { REFRACT_SPLIT } from "../../game/weapons/prism-beam";
import { Flag, Layer } from "../../render/layers";
import type { Evo2Module } from "../evo2-fx";

const SOAP = "soap_opera";
const REFRACT = "refraction_overload";
const RAIL = "brown_sugar_railgun";
const EXAM = "failed_exam_storm";
const MOSH = "mosh_pit";
/** Soap film pastels (the sprite's rim). */
const FILM = [C.pink, C.yellow, C.lime, C.blue, C.violet, C.cyan] as const;
const CREAM = 0xfff0c9;
const PI = Math.PI;

// ---------------------------------------------------------------- emitters
const soapRing: EmitterDef = { ...P.ringThin, life: [0.22, 0.22], size: [0.25, 0.8], additive: false, glow: false, layer: Layer.Fx };
const soapDrop: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [26, 64],
  spread: TAU,
  life: [0.2, 0.36],
  size: [1.3, 0.6],
  colors: FILM,
  gravity: 90,
  drag: 2,
  alphaCurve: "late",
  layer: Layer.Fx,
};
const glint: EmitterDef = { ...P.flare, life: [0.16, 0.16] };
const teaDrop: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [30, 80],
  spread: 1.2,
  life: [0.2, 0.34],
  size: [1.4, 0.7],
  colors: [0x6b3d2c, 0xa6683f, BOBA_COLOR, CREAM],
  drag: 3,
  alphaCurve: "late",
  layer: Layer.Fx,
};
/** The muzzle flash: one long thin bar thrown along the shot (a straw), gone in a tenth of a second. */
const strawFlash: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [70, 70],
  spread: 0,
  life: [0.11, 0.11],
  size: [2.4, 1.2],
  aspect: 9,
  colors: [C.pinkLight, C.white],
  rot: "velocity",
  alphaCurve: "late",
  layer: Layer.Fx,
};
const paperBit: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [12, 46],
  spread: TAU,
  life: [0.24, 0.42],
  size: [1.5, 0.8],
  aspect: 1.7,
  colors: [C.white, C.offWhite, C.white, C.red],
  gravity: 50,
  drag: 2.4,
  rot: "random",
  spin: [4, 9],
  alphaCurve: "late",
  layer: Layer.Fx,
};
const stompDust: EmitterDef = {
  sprite: "fx_stomp",
  frames: "life",
  speed: [16, 34],
  spread: 0.5,
  life: [0.28, 0.4],
  size: [1, 1.5],
  alpha: 0.95,
  drag: 4,
  alphaCurve: "late",
  layer: Layer.Fx,
};
const stompSpark: EmitterDef = { ...P.sparkle, speed: [30, 70], life: [0.2, 0.34], size: [0.8, 0.5], drag: 4 };

// ---------------------------------------------------------------- Soap Opera
const POP_BUDGET = 8;
let pops = 0;
let gaspAt = -9;
let popSfxAt = -9;
let clock = 0;

const soap: Evo2Module = {
  ids: [SOAP],
  reset() {
    gaspAt = popSfxAt = -9;
  },
  frame(_k, _w, time) {
    pops = 0;
    clock = time;
  },
  bind(w, kit, o) {
    return [
      w.bus.on("heroFx", (e) => {
        if (e.kind !== SOAP_POP && e.kind !== SOAP_TRAP) return;
        if (pops++ >= POP_BUDGET) return;
        const ps = kit.fx.ps;
        const s = Math.max(0.7, e.r / 8);
        if (e.kind === SOAP_TRAP) {
          ps.emit(soapRing, e.x, e.y, 1, NaN, C.white, 0.7 * s);
          // the misunderstanding, now and then
          if (clock - gaspAt > 1.4) {
            gaspAt = clock;
            kit.texts.add("?!", e.x, e.y - 12 * s, { color: C.pinkLight, scale: 1, life: 0.6, rise: 8 });
          }
          return;
        }
        ps.emit(soapRing, e.x, e.y, 1, NaN, FILM[pops % FILM.length], s);
        ps.emit(soapDrop, e.x, e.y, 5, NaN, -1, 1, 0.8 + 0.3 * s);
        if (clock - popSfxAt > 0.09) {
          popSfxAt = clock;
          o.sfx("bubblePop", 0.35, 4, e.x);
        }
      }),
    ];
  },
  draw(kit, w, inst, time) {
    // what is left of the aura: a faint soapy wash on the ground under her (no rim, no ring: nothing to read as a
    // status marker around the hero)
    const R = inst.data.r ?? 0;
    if (R < 2) return;
    const p = w.player;
    const r = kit.r;
    r.circle(Layer.Decal, p.x, p.y - 4, R, C.cyan, 0.09 + 0.02 * Math.sin(time * 4));
  },
};

// ---------------------------------------------------------------- Refraction Overload
const SPLIT_BUDGET = 10;
/** The root beam starts this far from the wand (the hero stays the clearest spot on screen). */
const BEAM_CLEAR = 14;
let splits = 0;
let splitSfxAt = -9;
let hFlare = -1;

const refraction: Evo2Module = {
  ids: [REFRACT],
  reset() {
    splitSfxAt = -9;
  },
  frame() {
    splits = 0;
  },
  bind(w, kit, o) {
    return [
      w.bus.on("heroFx", (e) => {
        if (e.kind !== REFRACT_SPLIT || splits++ >= SPLIT_BUDGET) return;
        const ps = kit.fx.ps;
        const col = e.n === 1 ? C.cyan : e.n === 2 ? rainbow(e.x * 0.013 + e.y * 0.007, 0.35) : C.white;
        ps.emit(glint, e.x, e.y, 1, NaN, C.white, e.n === 1 ? 1 : 0.7);
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, col, e.n === 1 ? 0.7 : 0.45);
        if (e.n === 1 && clock - splitSfxAt > 0.12) {
          splitSfxAt = clock;
          o.sfx("beam", 0.2, 7, e.x);
        }
      }),
    ];
  },
  draw(kit, _w, inst, time) {
    const r = kit.r;
    if (hFlare < 0) hFlare = r.atlas.handle("fx_flare");
    const projs = inst.projs;
    for (let i = 0; i < projs.length; i++) {
      const p = projs[i];
      if (p.dead || p.uid !== inst.uids[i] || p.hh <= 0.25) continue;
      const tier = p.angV;
      const ca = Math.cos(p.ang);
      const sa = Math.sin(p.ang);
      const off = tier === 0 ? BEAM_CLEAR : 2;
      if (p.a <= off + 4) continue;
      const x0 = p.ox + ca * off;
      const y0 = p.oy + sa * off;
      const x1 = p.ox + ca * p.a;
      const y1 = p.oy + sa * p.a;
      const col = tier === 0 ? C.cyan : tier === 1 ? C.aqua : rainbow(time * 0.8 + p.uid * 0.17, 0.4);
      // a coloured body with a white core: opaque, thin, no haze
      r.line(Layer.Fx, x0, y0, x1, y1, p.hh * 2 + 1, col, tier === 2 ? 0.8 : 0.7, Flag.Focus);
      if (tier < 2) r.line(Layer.Fx, x0, y0, x1, y1, Math.max(1, p.hh * 0.9), C.white, 0.95, Flag.Focus);
      const s = (tier === 0 ? 0.55 : tier === 1 ? 0.42 : 0.3) * (1 + 0.2 * Math.sin(time * 40 + i));
      r.batch.drawP(Layer.FxAdd, hFlare, x1, y1, s, s, time * 7 + i, tier === 2 ? col : C.white, 0.85, 0, Flag.Add | Flag.Glow | Flag.NoSnap | Flag.Focus, 8, 8);
    }
  },
};

// ---------------------------------------------------------------- Brown Sugar Railgun
/** Syrup tiles per streak (16 px each). */
const SYRUP_TILES = 30;
let hSyrup = -1;
let railHits = 0;

const railgun: Evo2Module = {
  ids: [RAIL],
  frame() {
    railHits = 0;
  },
  bind(w, kit, o) {
    return [
      w.bus.on("heroFx", (e) => {
        if (e.kind !== RAIL_FIRE) return;
        const ps = kit.fx.ps;
        const n = Math.max(1, e.n);
        for (let i = 0; i < n; i++) ps.emit(strawFlash, e.x, e.y, 1, e.r + (i - (n - 1) / 2) * 0.105);
        ps.emit(teaDrop, e.x, e.y, 5, e.r + PI);
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, CREAM, 0.6);
        if (!o.calm) kit.fx.juice.shake(0.07);
        o.sfx("beam", 0.3, -5, e.x);
      }),
      w.bus.on("enemyHit", (e) => {
        if (e.source !== RAIL || railHits++ >= 6) return;
        kit.fx.ps.emit(teaDrop, e.x, e.y, 3, e.angle);
      }),
    ];
  },
  draw(kit, w, inst) {
    const r = kit.r;
    const b = r.batch;
    if (hSyrup < 0) hSyrup = r.atlas.handle("fx_syrup");
    // the syrup: tiles along each streak, as far as its pearl has flown, fading over its last half second
    const projs = inst.projs;
    for (let i = 0; i < projs.length; i++) {
      const p = projs[i];
      if (p.dead || p.uid !== inst.uids[i] || p.kind !== PK_MANAGED || p.b < 4) continue;
      const ca = Math.cos(p.ang);
      const sa = Math.sin(p.ang);
      const al = 0.9 * Math.min(1, (p.life - p.age) / 0.5);
      const sy = (p.hh * 2) / 5;
      const n = Math.min(SYRUP_TILES, Math.ceil(p.b / 16));
      for (let k = 0; k < n; k++) {
        const d = Math.min(p.b - 8, k * 16 + 8);
        b.drawP(Layer.Decal, hSyrup + ((k + p.uid) & 1), p.ox + ca * d, p.oy + sa * d, 1.02, sy, p.ang, 0xffffff, al, 0, Flag.NoSnap, 8, 4);
      }
    }
    // the straw: a short crisp line behind every pearl in flight
    const items = w.projectiles.items;
    for (let i = 0; i < w.projectiles.count; i++) {
      const p = items[i];
      if (p.dead || p.owner !== inst || p.kind === PK_MANAGED) continue;
      const len = Math.min(38, p.age * p.speed);
      if (len < 6) continue;
      const ca = p.vx / p.speed;
      const sa = p.vy / p.speed;
      r.line(Layer.Fx, p.x - ca * len, p.y - sa * len, p.x - ca * 5, p.y - sa * 5, 3, BOBA_COLOR, 0.4, Flag.Focus);
      r.line(Layer.Fx, p.x - ca * len * 0.8, p.y - sa * len * 0.8, p.x - ca * 5, p.y - sa * 5, 1, CREAM, 0.85, Flag.Focus);
    }
  },
};

// ---------------------------------------------------------------- Failed Exam Storm
let examHits = 0;
let gradeAt = -9;
const GRADES = ["23/100", "F", "SEE ME", "11/100"] as const;
let grade = 0;
/** Speed lines drawn per frame (planes past it fly without one). */
const PLANE_LINES = 48;
/** Exam ink (navy, the dart's outline). */
const INK = 0x1f2a73;

const exam: Evo2Module = {
  ids: [EXAM],
  reset() {
    gradeAt = -9;
  },
  frame() {
    examHits = 0;
  },
  bind(w, kit) {
    return [
      w.bus.on("enemyHit", (e) => {
        if (e.source !== EXAM || examHits++ >= 8) return;
        const dead = e.enemy.hp <= 0;
        kit.fx.ps.emit(paperBit, e.x, e.y, dead ? 5 : 2);
        // the grade comes back on a kill (never more than one every two seconds)
        if (dead && clock - gradeAt > 2) {
          gradeAt = clock;
          kit.texts.add(GRADES[grade++ % GRADES.length], e.x, e.y - 10, { color: C.red, scale: 1, life: 0.7, rise: 9 });
        }
      }),
    ];
  },
  draw(kit, w, inst) {
    // a short ink line behind every plane: crisp, normal blend (white darts alone vanished on the pale academy
    // floor, and nothing here may bloom into a streak); it fades over her like the planes
    const r = kit.r;
    const items = w.projectiles.items;
    let n = 0;
    for (let i = 0; i < w.projectiles.count && n < PLANE_LINES; i++) {
      const p = items[i];
      if (p.dead || p.owner !== inst || p.speed <= 0) continue;
      const len = Math.min(13, p.age * p.speed);
      if (len < 7) continue;
      n++;
      const ca = p.vx / p.speed;
      const sa = p.vy / p.speed;
      r.line(Layer.Fx, p.x - ca * len, p.y - sa * len, p.x - ca * 6, p.y - sa * 6, 1, INK, 0.55, Flag.Focus);
    }
  },
};

// ---------------------------------------------------------------- Underground Mosh Pit
const STOMPS = 4;
const STOMP_T = 0.34;
const STOMP_TINTS = [0xff5fa8, C.violet, C.pink, C.cyan] as const;
/** Live stomp rings: x, y, radius, age (< 0 = free). */
const stX = new Float32Array(STOMPS);
const stY = new Float32Array(STOMPS);
const stR = new Float32Array(STOMPS);
const stT = new Float32Array(STOMPS).fill(-1);
let stN = 0;
let surfWas = 0;

const mosh: Evo2Module = {
  ids: [MOSH],
  reset() {
    stT.fill(-1);
    surfWas = 0;
  },
  bind(w, kit, o) {
    return [
      w.bus.on("heroFx", (e) => {
        if (e.kind !== MOSH_STOMP) return;
        const k = stN++ % STOMPS;
        stX[k] = e.x;
        stY[k] = e.y + 8;
        stR[k] = e.r;
        stT[k] = 0;
        const ps = kit.fx.ps;
        const col = STOMP_TINTS[stN % STOMP_TINTS.length];
        // dust kicked out along the ring, and a spark per Crowd Surf stack
        const a0 = ps.rng.angle();
        for (let j = 0; j < 7; j++) {
          const a = a0 + (j / 7) * TAU;
          ps.emit(stompDust, e.x + Math.cos(a) * e.r * 0.8, e.y + 8 + Math.sin(a) * e.r * 0.68, 1, a);
        }
        for (let j = 0; j < e.n; j++) {
          const a = a0 + 0.4 + (j / Math.max(1, e.n)) * TAU;
          ps.emit(stompSpark, e.x + Math.cos(a) * e.r * 0.5, e.y + 8 + Math.sin(a) * e.r * 0.42, 1, a, col);
        }
        if (e.n > surfWas && e.n >= 6) kit.texts.add("CROWD SURF!", 0, -30, { anchor: 1, color: 0xff5fa8, scale: 1, life: 0.8, rise: 10 });
        surfWas = e.n;
        if (!o.calm) kit.fx.juice.shake(0.045);
        o.sfx("lightstick", 0.5, -7, e.x);
      }),
    ];
  },
  frame(kit, _w, _time, dt) {
    // the rings: on the floor, under everyone (a stomp is under her boots), snapping out and fading
    const r = kit.r;
    for (let k = 0; k < STOMPS; k++) {
      if (stT[k] < 0) continue;
      const t = (stT[k] += dt);
      if (t > STOMP_T) {
        stT[k] = -1;
        continue;
      }
      const u = t / STOMP_T;
      const R = stR[k] * (0.3 + 0.7 * (1 - (1 - u) * (1 - u) * (1 - u)));
      const al = 1 - u * u;
      const col = STOMP_TINTS[k % STOMP_TINTS.length];
      const n = 28;
      const th = 4.6 * (1 - 0.55 * u);
      let x0 = stX[k] + R;
      let y0 = stY[k];
      for (let j = 1; j <= n; j++) {
        const a = (TAU * j) / n;
        const x1 = stX[k] + Math.cos(a) * R;
        const y1 = stY[k] + Math.sin(a) * R * 0.85;
        r.line(Layer.FxBelow, x0, y0, x1, y1, th, col, al * 0.85);
        if (j & 1) r.line(Layer.FxBelow, x0, y0, x1, y1, 1.2, C.white, al * 0.8);
        x0 = x1;
        y0 = y1;
      }
      r.circle(Layer.Decal, stX[k], stY[k], R, col, 0.11 * al);
    }
  },
};

export const evo2: Evo2Module[] = [soap, refraction, railgun, exam, mosh];
