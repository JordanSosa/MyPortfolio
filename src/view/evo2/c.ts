/**
 * Second evolutions, package C (docs/content/weapons.md §8): Kuro, Pudding, Aoi and Akane's second routes.
 *
 *   Unbandaged Right Arm (weapons/dark-flame-dragon.ts)   the claw: `w_abyss_claw` swept from the cue
 *       HFX_KURO_CLAW (Flag.Focus: it crosses Kuro), flame puffs thrown off it, embers at his right hand;
 *       the named attack: bandage scraps, the line he has been waiting to say, the `fireball` roar.
 *   Table-Flip Tea Service (weapons/teapot-tempest.ts)    cups / puddles / Warm Tea are drawn by
 *       heroes-a-fx.ts (same projectile fields), a flung cup by the generic drawer (`w_saucer`); here: its wake
 *       (TRAILS "saucer").
 *   Final Episode Budget Missile (weapons/micro-missile-swarm.ts)   the missile is a generic projectile
 *       (`w_budget_missile`, smoke: TRAILS "budget"); here: where it will land (a small blinking mark on the ground),
 *       its crater decal (`fx_budget_crater`, embers) and a bigger blast on top of the generic one.
 *   Tsun Tsun Drill Harisen (weapons/baka-harisen.ts)     the drill: `w_drill_fan` thrust out from the cue
 *       HFX_AKANE_DRILL, spiral speed lines down the lane, a burst at the tip on the launch.
 *
 * No markers, rings or timers on the heroes; everything that can land on them is a particle on the fx layers
 * or a sprite drawn with Flag.Focus.
 */
import { C } from "../../art/palette";
import { P, type EmitterDef } from "../../fx";
import { HFX_AKANE_DRILL } from "../../game/weapons/baka-harisen";
import { HFX_KURO_CLAW } from "../../game/weapons/dark-flame-dragon";
import { CRATER } from "../../game/weapons/micro-missile-swarm";
import { Flag, Layer } from "../../render/layers";
import type { Evo2Module } from "../evo2-fx";
import { TRAILS } from "../trails";

const ARM = "unbandaged_right_arm";
const BUDGET = "budget_missile";

// ---------------------------------------------------------------- emitters / trails
const clawFlame: EmitterDef = {
  sprite: "w_dragon_fire",
  frames: "life",
  speed: [40, 120],
  spread: 2.3,
  life: [0.22, 0.36],
  size: [0.8, 1.5],
  sizeJitter: 0.25,
  colors: 0xffffff,
  drag: 3,
  radius: 10,
  alphaCurve: "late",
  layer: Layer.Fx,
};
const scrap: EmitterDef = {
  sprite: "fx_bandage",
  frames: "random",
  speed: [40, 110],
  spread: 2.6,
  life: [0.6, 0.95],
  size: [1, 0.8],
  gravity: 60,
  drag: 2.2,
  sway: 14,
  rot: "random",
  spin: [3, 9],
  alphaCurve: "late",
  layer: Layer.Fx,
};
/** A flung saucer's wake: a dotted white streak, gone in a blink. */
const wake: EmitterDef = { sprite: "fx_px", frames: "fixed", speed: [0, 4], life: [0.1, 0.18], size: [1.6, 0.5], colors: [C.white, C.paleYellow, C.pinkLight], alphaCurve: "linear", layer: Layer.Fx };
const budgetSmoke: EmitterDef = { ...P.smoke, speed: [3, 12], life: [0.4, 0.7], size: [0.5, 1.1], alpha: 0.6 };
/** Spiral speed lines down the drill's lane. */
const whirl: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [120, 220],
  spread: 0.12,
  life: [0.1, 0.18],
  size: [1.2, 0.6],
  aspect: 4,
  colors: [C.white, C.pinkLight, C.orange],
  rot: "velocity",
  alphaCurve: "late",
  layer: Layer.Fx,
};

Object.assign(TRAILS, {
  saucer: { def: wake, every: 1, n: 1, color: C.white, halo: 0, haloAlpha: 0 },
  budget: { def: budgetSmoke, every: 2, n: 1, color: C.orange, halo: 0, haloAlpha: 0 },
});

// ---------------------------------------------------------------- Unbandaged Right Arm
/** The lines (the trope: a named attack nobody asked for). */
const NAMES = ["DARK FLAME CLAW!", "ABYSSAL REND!", "MR. TOASTY, NOW!", "SEAL RELEASE!"];
const SWIPE_T = 0.22;
const SWIPES = 4;
const swT = new Float32Array(SWIPES).fill(9);
const swA = new Float32Array(SWIPES);
const swL = new Float32Array(SWIPES);
const swS = new Float32Array(SWIPES);
let swN = 0;
let named = 0;
let frameN = 0;

const arm: Evo2Module = {
  ids: [ARM],
  reset() {
    swT.fill(9);
    swN = named = 0;
  },
  frame() {
    frameN++;
  },
  bind(w, kit, o) {
    return [
      w.bus.on("heroFx", (e) => {
        if (e.kind !== HFX_KURO_CLAW) return;
        const i = swN++ % SWIPES;
        swT[i] = 0;
        swA[i] = e.x2;
        swL[i] = e.r;
        // (alternating hands: down-stroke, up-stroke)
        swS[i] = swN & 1 ? 1 : -1;
        const ps = kit.fx.ps;
        const big = e.n === 1;
        const mx = e.x + Math.cos(e.x2) * e.r * 0.55;
        const my = e.y + Math.sin(e.x2) * e.r * 0.55;
        ps.emit(clawFlame, mx, my, big ? 14 : 7, e.x2, -1, big ? 1.3 : 1, e.r / 58);
        ps.emit(P.ember, mx, my, big ? 6 : 2, e.x2);
        if (!big) return;
        ps.emit(scrap, e.x, e.y - 4, 7, e.x2 + Math.PI);
        kit.texts.add(NAMES[named++ % NAMES.length], 0, -34, { anchor: 1, color: C.orange, scale: 1, life: 0.9, glow: true });
        o.sfx("fireball", 0.9, -3, e.x);
        if (!o.calm) kit.fx.juice.shake(0.18);
      }),
    ];
  },
  draw(kit, w, _inst, _time, dt) {
    const r = kit.r;
    const pl = w.player;
    const a = kit.anims.get("w_abyss_claw");
    for (let i = 0; i < SWIPES; i++) {
      if (swT[i] >= SWIPE_T) continue;
      const k = swT[i] / SWIPE_T;
      swT[i] += dt;
      // the sprite's arcs reach 35 px from where Kuro stands in it (16 px left of its centre)
      // (and the swipe grows out of his arm: 55 % of its reach at first, all of it by the middle of the stroke)
      const s = (swL[i] / 35) * (0.55 + 0.45 * Math.min(1, k * 2.2));
      const ca = Math.cos(swA[i]);
      const sa = Math.sin(swA[i]);
      const x = pl.x + ca * 16 * s;
      const y = pl.y - 8 + sa * 16 * s;
      r.spr(Layer.Fx, a.first + Math.min(a.count - 1, Math.floor(k * a.count)), x, y, s, s * swS[i], swA[i], 0xffffff, 1, 0, Flag.NoSnap | Flag.Focus);
      r.glow(pl.x + ca * swL[i] * 0.6, pl.y - 8 + sa * swL[i] * 0.6, swL[i] * 0.45, C.orange, 0.2 * (1 - k), Layer.FxAdd, Flag.Add | Flag.Glow | Flag.Focus);
    }
    // Mr. Toasty, wrapped around the right arm: an ember off his hand now and then
    if (dt > 0 && frameN % 7 === 0 && !pl.dead) kit.fx.ps.emit(P.ember, pl.x + pl.face * 5, pl.y - 9, 1, -Math.PI / 2, -1, 0.8, 0.4);
  },
};

// ---------------------------------------------------------------- Final Episode Budget Missile
let booms = 0;

const budget: Evo2Module = {
  ids: [BUDGET],
  reset() {
    booms = 0;
  },
  frame() {
    booms = 0;
  },
  bind(w, kit, o) {
    return [
      w.bus.on("explosion", (e) => {
        if (e.source !== BUDGET || !e.big || booms++ >= 2) return;
        const ps = kit.fx.ps;
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.lightBlue, e.r / 13);
        // (the generic big blast already shakes, flashes and throws debris: only the smoke and a blue ring on top)
        ps.emit(budgetSmoke, e.x, e.y - 4, 5, NaN, -1, 1.6, 3);
        o.haptic(25);
      }),
    ];
  },
  draw(kit, _w, inst, time) {
    const r = kit.r;
    const cr = kit.anims.get("fx_budget_crater");
    for (let i = 0; i < inst.projs.length; i++) {
      const p = inst.projs[i];
      if (p.dead || p.uid !== inst.uids[i]) continue;
      if (p.a === CRATER) {
        const left = p.life - p.age;
        const al = Math.min(1, left / 0.5) * Math.min(1, p.age / 0.1);
        const s = p.r / 18;
        r.spr(Layer.Decal, cr.first + (Math.floor(time * 6 + p.uid) % cr.count), p.x, p.y + 6, s, s, 0, 0xffffff, 0.8 * al, 0, 0);
        if ((frameN + p.uid) % 6 === 0 && left > 0.4) kit.fx.ps.emit(P.ember, p.x + (Math.random() - 0.5) * p.r * 1.3, p.y + 6 + (Math.random() - 0.5) * p.r * 0.7, 1, -Math.PI / 2, -1, 0.9, 0.5);
        continue;
      }
      // where it will land: a small blinking mark on the ground under its target (never a ring the size of the blast:
      // with the pack around Aoi that would be a ring around her)
      const q = 0.5 + 0.5 * Math.sin(time * 14);
      r.ring(Layer.Decal, p.ox, p.oy + 6, 6 + 2 * q, C.blue, 0.75, 0, true);
      r.circle(Layer.Decal, p.ox, p.oy + 6, 2, C.white, 0.9);
    }
  },
};

// ---------------------------------------------------------------- Tsun Tsun Drill Harisen
let drT = 9;
let drDur = 0.3;
let drA = 0;
let drL = 0;
let drBurst = true;

const drill: Evo2Module = {
  ids: ["tsun_tsun_drill"],
  reset() {
    drT = 9;
    drBurst = true;
  },
  bind(w) {
    return [
      w.bus.on("heroFx", (e) => {
        if (e.kind !== HFX_AKANE_DRILL) return;
        drT = 0;
        drA = e.x2;
        drDur = e.y2;
        drL = e.r;
        drBurst = false;
      }),
    ];
  },
  draw(kit, w, _inst, _time, dt) {
    const end = drDur + 0.08;
    if (drT >= end) return;
    const r = kit.r;
    const ps = kit.fx.ps;
    const pl = w.player;
    const ca = Math.cos(drA);
    const sa = Math.sin(drA);
    const cy = pl.y - 8;
    // out in a blink, held while it grinds, gone right after the launch
    const out = Math.min(1, drT / 0.07);
    const al = drT > drDur ? Math.max(0, 1 - (drT - drDur) / 0.08) : 1;
    const s = (1.75 * drL) / 76;
    // (the sprite is 32 px long: its tip sits at the end of the lane)
    const d = (drL - 16 * s) * (0.45 + 0.55 * out);
    const a = kit.anims.get("w_drill_fan");
    const left = ca < 0;
    r.spr(Layer.Fx, a.first + (Math.floor(drT * 30) % a.count), pl.x + ca * d, cy + sa * d, left ? -s : s, s, left ? drA - Math.PI : drA, 0xffffff, al, 0, Flag.NoSnap | Flag.Focus);
    if (dt > 0 && drT < drDur) {
      // the spiral: two streaks a frame, on either side of the lane, running to the tip
      const u = Math.random() * drL * 0.7;
      const v = Math.sin(drT * 60) * 5 * s;
      ps.emit(whirl, pl.x + ca * u - sa * v, cy + sa * u + ca * v, 1, drA);
      ps.emit(whirl, pl.x + ca * u * 0.6 + sa * v, cy + sa * u * 0.6 - ca * v, 1, drA);
    }
    drT += dt;
    if (!drBurst && drT >= drDur) {
      drBurst = true;
      const tx = pl.x + ca * drL;
      const ty = cy + sa * drL;
      ps.emit(P.rays, tx, ty, 6, drA, C.white, 0.9);
      ps.emit(P.ringThin, tx, ty, 1, NaN, C.orange, 1.1);
      ps.emit(P.sparkle, tx, ty, 3, drA, C.paleYellow);
    }
  },
};

export const evo2: Evo2Module[] = [arm, budget, drill];
