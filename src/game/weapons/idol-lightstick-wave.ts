/**
 * Idol Lightstick Wave (general weapon, docs/content/weapons.md §2.11): pulses
 * on the music's beat. The sim keeps a beat clock from StageDef.bpm (the audio
 * plays each stage's battle theme at that tempo; `_arsenal2.ts beatIndex`) and
 * fires on every `every`-th beat (x the cooldown stat, rounded, at least 1). A
 * wave is a crescent `arc`° wide that spawns at the hero and expands to
 * `range` x area over 0.5 s, hitting each enemy once. With 1 arc the waves
 * sway left / right; with n >= 2, n arcs fire at once, evenly spaced, the set
 * rotating 45° each wave. Every 16 beats a Chorus: a 360° ring (range x1.2,
 * damage x1.5; Lv5 doubles it).
 * Twist - the crowd: +8% damage per combo rank (C = 1 ... SSS = 6).
 * Evolution: Sold-Out Dome Tour (+ Twin Charm) - spotlight waves on every beat
 * (4 arcs 90° apart, rotating 45° per beat) and every 8 beats an ENCORE! that
 * hits every enemy in view; +12% per combo rank.
 * Second evolution: Underground Mosh Pit (+ Plot Armor) - no waves: every beat is a 360° STOMP around the
 * hero (instant, `range` x area, a short daze and a hard shove). A beat that hits `need`+ enemies adds a
 * stack of Crowd Surf (max `stacks`, all lost after 2 beats below that): each stack is `dr` damage
 * reduction and `grow` more stomp radius. No ENCORE, no combo bonus: she is tankier the deeper she stands.
 *
 * A wave is a PK_MANAGED projectile at its origin without a world hit shape
 * (r = 0): its hook grows the front and hits every enemy whose near edge the
 * front crossed this step inside the arc (exactly once per wave, no hit list).
 * Scratch: ang = direction, a = half arc (rad, >= PI = full ring), b = reach,
 * angV = front radius, oy = variant (WAVE_*), ox = colour seed. Drawn by
 * src/view/arsenal2-fx.ts (w_lightstick_wave crescents, the Chorus ring, the
 * ENCORE! crowd).
 */
import { CFG } from "../config";
import { PK_MANAGED, type ProjHook, type WeaponDef, type WeaponInstance } from "../types";
import type { StatMod } from "../stats";
import type { World } from "../world";
import { wstats, type WStats } from "./_shared";
import { A2_ENCORE, A2_WAVE, CHORUS_BEATS, a2fx, beatEvery, beatIndex, beatLen, cdMul, crowdMul, dropStatMod, keyDmg } from "./_arsenal2";

/** Wave variants (Projectile.oy). */
export const WAVE_ARC = 0;
export const WAVE_CHORUS = 1;
export const WAVE_DOME = 2;
/** Seconds a wave takes to reach its full radius. */
export const WAVE_EXPAND = 0.5;
/** Fade-out after the front stops. */
const WAVE_FADE = 0.2;
const DEG = Math.PI / 180;
/** The crowd bonus per combo rank (base weapon). */
const CROWD = 0.08;

/** Grow the front and hit what it crossed (inside the arc) this step. */
const waveFly: ProjHook = (p, w) => {
  const k = Math.min(1, p.age / WAVE_EXPAND);
  const R = p.b * (1 - (1 - k) * (1 - k));
  const prev = p.angV;
  if (R <= prev) return;
  p.angV = R;
  const full = p.a >= Math.PI;
  const owner = p.owner;
  const color = owner ? owner.def.color : p.tint;
  const buf = w.acquire();
  const n = w.grid.query(p.x, p.y, R + 16, buf);
  const items = w.enemies.items;
  for (let q = 0; q < n; q++) {
    const e = items[buf[q]];
    if (!e || e.dead || e.def.prop) continue;
    const dx = e.x - p.x;
    const dy = e.y - e.cy - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const edge = d - e.r;
    if (edge > R || edge <= prev) continue;
    const a = Math.atan2(dy, dx);
    if (!full) {
      let da = a - p.ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const tol = p.a + (d > e.r ? Math.asin(e.r / d) : Math.PI);
      if (da > tol || da < -tol) continue;
    }
    // once per wave set: a knocked-back enemy can outrun the slowing front and be crossed again,
    // and an enemy on the seam between two arcs of the same beat is in both
    if (w.t - e.lastHit[p.ch] < p.hitEvery) continue;
    e.lastHit[p.ch] = w.t;
    w.hitEnemy(e, p.dmg, owner, a, p.knock, 0, p.source, color);
  }
  w.release();
};

function spawnWave(w: World, inst: WeaponInstance, dir: number, half: number, reach: number, dmg: number, knock: number, variant: number, seed: number, gap: number): void {
  const pl = w.player;
  const p = w.spawnProjectile(inst);
  p.kind = PK_MANAGED;
  p.x = pl.x;
  p.y = pl.y - CFG.playerCy;
  p.ang = dir;
  p.a = half;
  p.b = reach;
  // (front starts "behind" the hero: the first step hits whatever stands right on top of her)
  p.angV = -1;
  p.oy = variant;
  p.ox = seed;
  p.r = 0;
  p.dmg = dmg;
  p.knock = knock;
  p.life = WAVE_EXPAND + WAVE_FADE;
  // re-hit window on the slot channel: the whole expansion, but always shorter than the gap to the next wave
  p.hitEvery = Math.min(WAVE_EXPAND, gap * 0.85);
  p.update = waveFly;
}

/** The beat's set of arcs: one swaying arc, or n arcs evenly spaced rotating 45° per wave. */
function waveSet(w: World, inst: WeaponInstance, n: number, arcDeg: number, reach: number, dmg: number, knock: number, variant: number, gap: number): void {
  const d = inst.data;
  const k = d.wave ?? 0;
  d.wave = k + 1;
  const half = arcDeg * 0.5 * DEG;
  if (n <= 1) spawnWave(w, inst, k & 1 ? Math.PI : 0, half, reach, dmg, knock, variant, k, gap);
  else {
    const base = k * 45 * DEG;
    for (let j = 0; j < n; j++) spawnWave(w, inst, base + (j / n) * Math.PI * 2, half, reach, dmg, knock, variant, k + j, gap);
  }
}

/**
 * New beats since the last step (normally 0 or 1). The first step after the weapon is
 * acquired only syncs to the clock. Returns the first new beat index, or -1.
 */
function newBeats(w: World, inst: WeaponInstance): number {
  const d = inst.data;
  const b = beatIndex(w);
  if (d.sync !== 1) {
    d.sync = 1;
    d.beat = b;
    return -1;
  }
  const last = d.beat ?? b;
  if (b <= last) return -1;
  d.beat = b;
  // the HUD / view pulse on every beat
  d.beatAt = w.t;
  return Math.max(last + 1, b - 3);
}

function lightstick(w: World, inst: WeaponInstance, S: WStats, beat: number): void {
  const L = S.L;
  const pl = w.player;
  const crowd = crowdMul(w, CROWD);
  const reach = (L.range ?? 80) * S.area;
  const every = beatEvery(L.every ?? 4, cdMul(S));
  const gap = beatLen(w) * Math.min(every, CHORUS_BEATS - (beat % CHORUS_BEATS) || every);
  if (beat % CHORUS_BEATS === 0) {
    // the Chorus: a full ring, farther and harder (Lv5: double)
    spawnWave(w, inst, 0, Math.PI, reach * 1.2, S.dmg * crowd * (L.chorus ?? 1.5), S.knock * 1.3, WAVE_CHORUS, inst.data.wave ?? 0, gap);
    inst.data.wave = (inst.data.wave ?? 0) + 1;
    a2fx(w, A2_WAVE, pl.x, pl.y - CFG.playerCy, pl.x, pl.y, reach * 1.2, 1);
    return;
  }
  if (beat % every !== 0) return;
  waveSet(w, inst, Math.min(8, S.amount), L.arc ?? 120, reach, S.dmg * crowd, S.knock, WAVE_ARC, gap);
  a2fx(w, A2_WAVE, pl.x, pl.y - CFG.playerCy, pl.x, pl.y, reach, 0);
}

/** ENCORE!: every enemy in view takes `dmg` (the evolution's crowd bonus included). */
function encore(w: World, inst: WeaponInstance, dmg: number): void {
  const pl = w.player;
  const hw = w.viewW * 0.5 + 8;
  const hh = w.viewH * 0.5 + 8;
  const items = w.enemies.items;
  const color = inst.def.color;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = items[i];
    if (e.dead || e.def.prop) continue;
    if (Math.abs(e.x - pl.x) > hw || Math.abs(e.y - e.cy - (pl.y - CFG.playerCy)) > hh) continue;
    w.hitEnemy(e, dmg, inst, -Math.PI / 2, 0, 0, inst.def.id, color);
  }
  a2fx(w, A2_ENCORE, pl.x, pl.y - CFG.playerCy, pl.x, pl.y, 0, 0);
}

function domeTour(w: World, inst: WeaponInstance, S: WStats, beat: number): void {
  const L = S.L;
  const pl = w.player;
  const crowd = crowdMul(w, L.rank ?? 0.12);
  const reach = (L.range ?? 110) * S.area;
  waveSet(w, inst, Math.min(8, S.amount), L.arc ?? 90, reach, S.dmg * crowd, S.knock, WAVE_DOME, beatLen(w));
  a2fx(w, A2_WAVE, pl.x, pl.y - CFG.playerCy, pl.x, pl.y, reach, 2);
  const enc = Math.max(1, Math.round(L.encore ?? 8));
  if (beat % enc === 0) encore(w, inst, keyDmg(S, L.encoreDmg ?? 40) * crowd);
}

export const idolLightstickWave: WeaponDef = {
  id: "idol_lightstick_wave",
  name: "Idol Lightstick Wave",
  icon: "icon_idol_lightstick_wave",
  color: 0x5ff3ff,
  sfx: "lightstick",
  desc: "Lightstick waves pulse out on the beat. The crowd gets louder with your combo rank.",
  // (cd = every x 60 / 140 for tooling; the sim fires on the stage's beat)
  levels: [
    { dmg: 10, cd: 1.714, amount: 1, every: 4, arc: 120, range: 80, knock: 40, chorus: 1.5 },
    { dmg: 10, cd: 1.714, amount: 2, every: 4, arc: 120, range: 80, knock: 40, chorus: 1.5 },
    { dmg: 14, cd: 1.714, amount: 2, every: 4, arc: 120, range: 96, knock: 42, chorus: 1.5 },
    { dmg: 14, cd: 0.857, amount: 2, every: 2, arc: 120, range: 96, knock: 42, chorus: 1.5 },
    { dmg: 18, cd: 0.857, amount: 2, every: 2, arc: 150, range: 96, knock: 46, chorus: 3 },
  ],
  upgrades: ["Both sides wave", "Damage +4, waves reach farther", "Waves on every 2nd beat", "Damage +4, wider waves, the Chorus deals double"],
  evolutions: [
    { into: "sold_out_dome_tour", with: "twin_charm" },
    { into: "mosh_pit", with: "plot_armor" },
  ],
  // mastery Limit Breaks (docs/content/weapons.md §4): a Limit Break amount = +1 arc
  limitBreak: [
    { dmg: 0.2, area: 0.15, text: "LIMIT BREAK — Front Row: +20% damage, +15% reach" },
    { dmg: 0.3, amount: 1, text: "MASTERED — Stadium Show: +30% damage, +1 wave" },
  ],
  update(w, inst) {
    const first = newBeats(w, inst);
    if (first < 0) return;
    const last = inst.data.beat;
    // (wstats per beat: a hit hook may resolve another weapon's stats into the shared scratch)
    for (let b = first; b <= last; b++) lightstick(w, inst, wstats(w, inst), b);
  },
};

export const soldOutDomeTour: WeaponDef = {
  id: "sold_out_dome_tour",
  name: "Sold-Out Dome Tour",
  icon: "icon_sold_out_dome_tour",
  color: 0xffd34d,
  sfx: "lightstick",
  evolved: true,
  desc: "EVOLUTION! Spotlight waves on every beat, and every 8 beats the whole screen gets an ENCORE.",
  levels: [{ dmg: 22, cd: 0.429, every: 1, amount: 4, arc: 90, range: 110, knock: 50, encore: 8, encoreDmg: 40, rank: 0.12 }],
  upgrades: [],
  update(w, inst) {
    const first = newBeats(w, inst);
    if (first < 0) return;
    const last = inst.data.beat;
    for (let b = first; b <= last; b++) domeTour(w, inst, wstats(w, inst), b);
  },
};

// ---------------------------------------------------------------- Underground Mosh Pit (second evolution)

/** heroFx cue (src/view/evo2/b.ts): a stomp at (x, y): r = its radius, n = Crowd Surf stacks after it. */
export const MOSH_STOMP = "e2_stomp";
/** Beats below `need` hits before Crowd Surf is lost. */
const MOSH_SILENT = 2;

/** Crowd Surf's damage reduction (one live stat modifier per instance; data.surf = stacks). */
const SURF = new WeakMap<WeaponInstance, StatMod>();

/** One stomp: everything within R of the hero's body, at once. Returns the enemies hit. */
function stomp(w: World, inst: WeaponInstance, S: WStats, R: number): number {
  const pl = w.player;
  const cx = pl.x;
  const cy = pl.y - CFG.playerCy;
  const daze = S.L.daze ?? 0.2;
  const dmg = S.dmg;
  const knock = S.knock;
  const color = inst.def.color;
  const buf = w.acquire();
  const n = w.grid.query(cx, cy, R + 16, buf);
  const items = w.enemies.items;
  let hits = 0;
  for (let q = 0; q < n; q++) {
    const e = items[buf[q]];
    if (!e || e.dead) continue;
    const dx = e.x - cx;
    const dy = e.y - e.cy - cy;
    const rr = R + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (!e.def.prop) {
      hits++;
      if (!e.def.boss) e.stun = Math.max(e.stun, daze);
    }
    w.hitEnemy(e, dmg, inst, Math.atan2(dy, dx), knock, 0, inst.def.id, color);
  }
  w.release();
  return hits;
}

export const moshPit: WeaponDef = {
  id: "mosh_pit",
  name: "Underground Mosh Pit",
  icon: "icon_mosh_pit",
  color: 0xff5fa8,
  sfx: "lightstick",
  evolved: true,
  desc: "EVOLUTION! The venue holds forty people. Every beat is a stomp, and every stomp is a shove.",
  // (cd = 60 / 140 for tooling; the sim stomps on the stage's beat)
  levels: [{ dmg: 40, cd: 0.429, every: 1, amount: 1, range: 70, knock: 110, daze: 0.2, need: 6, stacks: 6, dr: 0.04, grow: 0.06 }],
  upgrades: [],
  update(w, inst) {
    const d = inst.data;
    if (!SURF.has(inst)) {
      const per = inst.def.levels[0].dr ?? 0.04;
      const mod: StatMod = (s) => {
        s.dmgReduction += per * (d.surf ?? 0);
      };
      SURF.set(inst, mod);
      w.statMods.push(mod);
    }
    const first = newBeats(w, inst);
    if (first < 0) return;
    const last = d.beat;
    const pl = w.player;
    for (let b = first; b <= last; b++) {
      const S = wstats(w, inst);
      const L = S.L;
      const surf = d.surf ?? 0;
      const R = (L.range ?? 62) * S.area * (1 + (L.grow ?? 0.06) * surf);
      const need = L.need ?? 6;
      const cap = L.stacks ?? 6;
      const hits = stomp(w, inst, S, R);
      let now = surf;
      if (hits >= need) {
        d.quiet = 0;
        now = Math.min(cap, surf + 1);
      } else {
        d.quiet = (d.quiet ?? 0) + 1;
        if (d.quiet >= MOSH_SILENT) now = 0;
      }
      if (now !== surf) {
        d.surf = now;
        w.statsDirty = true;
      }
      a2fx(w, MOSH_STOMP, pl.x, pl.y - CFG.playerCy, pl.x, pl.y, R, now);
    }
  },
  dispose(w, inst) {
    dropStatMod(w, SURF.get(inst));
    SURF.delete(inst);
  },
};

export const weapons: WeaponDef[] = [idolLightstickWave, soldOutDomeTour, moshPit];
