/**
 * Helpers shared by the four general Season 2 weapons (docs/content/weapons.md
 * §2.9-2.12: Bubble Tea Cannon, Paper Crane Flock, Idol Lightstick Wave, Kotatsu
 * of Sloth, and their evolutions). No `weapons` export, so the registry ignores
 * this file.
 *
 *   - `a2fx()`     `heroFx` cue for the view (src/view/arsenal2-fx.ts) with namespaced
 *                  "a2_*" kinds; one reused payload, a no-op while muted
 *   - beat clock   `beatLen()` / `beatIndex()`: the stage tempo (StageDef.bpm, default 140)
 *                  from the run clock, so every beat-synced weapon shares one grid
 *   - `crowdMul()` the Idol Lightstick "crowd": + `per` damage per combo rank (C = 1 ... SSS = 6)
 *
 * Content-module import rule: types only from world.ts.
 */
import { heroFx } from "./_fx";
import type { StatMod } from "../stats";
import type { World } from "../world";
import type { WStats } from "./_shared";

// ---------------------------------------------------------------- heroFx cues (namespaced kinds)
/** A pearl popped at (x, y): r = draw scale, n = 0 pearl / 1 mini / 2 giant. */
export const A2_BOBA_POP = "a2_boba_pop";
/** Lv5 Bubble Tea pearl split into two minis at (x, y). */
export const A2_BOBA_SPLIT = "a2_boba_split";
/** Tapioca Tsunami shed `n` pearls at (x, y). */
export const A2_BOBA_SHED = "a2_boba_shed";
/** A crane darts from (x, y) toward (x2, y2) (rate-limited sfx in the view). */
export const A2_CRANE_DART = "a2_crane_dart";
/** A crane folded tighter (a kill) at (x, y): n = folds now (1..10). */
export const A2_CRANE_FOLD = "a2_crane_fold";
/** The hero got hurt: every fold resets, the cranes crumple (x, y = hero). */
export const A2_CRANE_CRUMPLE = "a2_crane_crumple";
/** Thousand Crane Wish: WISH GRANTED! at the hero (full heal + the golden storm, r = storm seconds). */
export const A2_WISH = "a2_wish";
/** A lightstick wave set fired at (x, y): r = reach, n = 0 waves / 1 Chorus / 2 Dome Tour beat. */
export const A2_WAVE = "a2_wave";
/** Sold-Out Dome Tour ENCORE! (every enemy in view hit) at the hero. */
export const A2_ENCORE = "a2_encore";
/** Kotatsu deployed at (x, y) (the yawn). n = 1 for the evolution. */
export const A2_KOTATSU_DEPLOY = "a2_kotatsu_deploy";
/** The kotatsu folded up (the hero moved) at (x, y). */
export const A2_KOTATSU_FOLD = "a2_kotatsu_fold";
/** Too Comfy: the hero dozes off at (x, y). n = 1 for the evolution. */
export const A2_KOTATSU_COMFY = "a2_kotatsu_comfy";
/** Woke up from Too Comfy at (x, y) (r = seconds dozed). */
export const A2_KOTATSU_WAKE = "a2_kotatsu_wake";
/** A snore while Too Comfy (sfx + a Z) at (x, y). */
export const A2_KOTATSU_SNORE = "a2_kotatsu_snore";
/** An enemy fell asleep in the kotatsu (Lv5) at (x, y). */
export const A2_SLEEP = "a2_sleep";
/** A mikan landed at (x, y), splash radius r. */
export const A2_MIKAN = "a2_mikan";

/** Emit an arsenal-2 cue (no-op while muted): the shared heroFx emitter of weapons/_fx.ts (one reused payload). */
export function a2fx(w: World, kind: string, x: number, y: number, x2 = x, y2 = y, r = 0, n = 0): void {
  heroFx(w, kind, x, y, x2, y2, r, n, null);
}

// ---------------------------------------------------------------- beat clock
/** Default stage tempo (Dream Meadow in the bible, StageDef.bpm's documented default). */
export const DEFAULT_BPM = 140;
/** Beats in a Chorus cycle (Idol Lightstick Wave). */
export const CHORUS_BEATS = 16;

/** Seconds per beat of this run's stage. */
export function beatLen(w: World): number {
  const bpm = w.stage.bpm ?? DEFAULT_BPM;
  return 60 / (bpm > 0 ? bpm : DEFAULT_BPM);
}

/** Beats elapsed since the run started (beat 0 at t = 0). */
export function beatIndex(w: World): number {
  return Math.floor(w.t / beatLen(w) + 1e-6);
}

/**
 * Effective beat interval: `every` x the cooldown stat (and Limit Break cooldown multipliers),
 * rounded, at least every beat. `cdK` = the resolved cooldown over the level's base cooldown.
 */
export function beatEvery(every: number, cdK: number): number {
  return Math.max(1, Math.round(every * cdK));
}

/** The crowd: damage multiplier from the combo rank (+`per` per rank, C = 1 ... SSS = 6). */
export function crowdMul(w: World, per: number): number {
  return 1 + per * Math.max(0, w.comboRank + 1);
}

// ---------------------------------------------------------------- misc
/**
 * A weapon-specific damage key (shedDmg, stormDmg, mikanDmg...) scaled exactly like `dmg`:
 * might x mastery x Limit Breaks (the ratio of the resolved damage to the level's base damage).
 */
export function keyDmg(S: WStats, base: number): number {
  return S.L.dmg > 0 ? (base * S.dmg) / S.L.dmg : base;
}

/** Cooldown multiplier over the level's base cooldown (cooldown stat x Limit Break cd). */
export function cdMul(S: WStats): number {
  return S.L.cd > 0 ? S.cd / S.L.cd : 1;
}

/** Remove one entry from World.statMods (a weapon's run modifier on dispose). */
export function dropStatMod(w: World, mod: StatMod | undefined): void {
  if (!mod) return;
  const i = w.statMods.indexOf(mod);
  if (i >= 0) {
    w.statMods.splice(i, 1);
    w.statsDirty = true;
  }
}
