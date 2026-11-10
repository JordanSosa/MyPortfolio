/**
 * Evolution hints (owner request: "see at a glance, once players have discovered how to evolve
 * weapons, whether choosing an upgrade would be synergistic"). PURE: no DOM, no profile access.
 * Read by the level-up cards, the chest reveal and the pause menu's build list
 * (src/ui/screens/evo-hints.ts draws them).
 *
 * KNOWN rule: a recipe is hinted only once the player knows it, `known(evolvedId)`. The UI passes
 * the Wiki's rule (the profile's codex.weapons holds the evolved id, ui/hub/wiki/article.ts) plus
 * this run's own evolutions (World.weaponsUsed, which banks into the codex the same way);
 * practice runs know everything (ALL_KNOWN). Unknown recipes produce no hint at all.
 *
 * READY mirrors the sim's rule without changing it (upgrades.ts evolutionCards): the base weapon
 * at its last regular level (levels.length; Limit Break levels past it still count), the passive
 * held at any level, the evolution not banished. A weapon with several evolutions (WeaponDef.evolutions,
 * read through registry.ts evolutionsOf) gets one hint per known recipe.
 *
 * Per card:
 *  - WEAPON card (NEW or level-up): one hint per known recipe of that weapon. State after the pick:
 *    ready (passive held, the pick reaches the evolve level), have (passive held, levels to go),
 *    missing (passive not held but obtainable), blocked (passive locked / banished, no passive slot
 *    left, or the evolution banished).
 *  - NEW PASSIVE card: one hint per known recipe whose base weapon the hero HOLDS (ready when that
 *    weapon is already at its evolve level, else have). A passive level-up adds nothing (any level counts).
 *  - No hint for a recipe whose evolution the hero already holds, nor for an upgrade card of a weapon that
 *    evolved since (a chest's reveal is read against the build after the chest).
 *  - `completes`: the pick completes the pair (a NEW weapon whose passive is held, a NEW passive for a held
 *    weapon); `readies`: the pick makes the evolution ready when it was not. Either one = the card glows.
 */
import { PASSIVE_BY_ID } from "./passives";
import { WEAPONS, evolutionsOf } from "./registry";
import type { PassiveDef, UpgradeCard, WeaponDef } from "./types";

/** One evolution recipe: base weapon + passive -> evolved weapon (resolved defs). */
export interface EvoRecipe {
  base: WeaponDef;
  passive: PassiveDef;
  into: WeaponDef;
}

export type EvoState = "ready" | "have" | "missing" | "blocked";
/** Why a recipe cannot complete this run: no passive slot left, passive not in the pool (locked), banished. */
export type EvoBlock = "slots" | "locked" | "banished";

export interface EvoHint extends EvoRecipe {
  /** Which side of the recipe the hint sits on: the base weapon's card / slot, or the passive's card. */
  on: "weapon" | "passive";
  state: EvoState;
  blocked?: EvoBlock;
  /** The passive is held after the pick (a NEW passive card: always). */
  passiveHeld: boolean;
  /** Base weapon level before the pick, after it (pause: both = its level now), and its evolve level. */
  from: number;
  level: number;
  need: number;
  /** The pick completes the pair (base weapon + passive both held afterwards; it was not before). */
  completes: boolean;
  /** The pick makes the evolution ready (it was not before). */
  readies: boolean;
}

/** The slice of a World these hints read (World satisfies it; tests pass plain objects). */
export interface EvoBuild {
  readonly weapons: readonly { readonly def: WeaponDef; readonly level: number }[];
  readonly passives: readonly { readonly def: { readonly id: string }; readonly level: number }[];
  readonly passiveSlots: number;
  readonly banished: ReadonlySet<string>;
  /** May the passive still be offered (unlocked, not banished)? Absent = always. */
  inPool?(kind: "weapon" | "passive", id: string): boolean;
}

/** Is the evolution with this (evolved weapon) id known to the player? */
export type Known = (evolvedId: string) => boolean;
/** Practice / debug runs: every recipe is known. */
export const ALL_KNOWN: Known = () => true;
/** Nothing known (a fresh account). */
export const NONE_KNOWN: Known = () => false;

/** Known = any id in these lists (the profile's codex.weapons, the run's weaponsUsed). */
export function knownFrom(...lists: readonly (readonly string[])[]): Known {
  const s = new Set<string>();
  for (const l of lists) for (const id of l) s.add(id);
  return (id) => s.has(id);
}

export { evolutionsOf };

/** A weapon's recipes with resolved defs (entries naming a missing weapon / passive are skipped). */
export function recipesOf(def: WeaponDef): EvoRecipe[] {
  const out: EvoRecipe[] = [];
  for (const e of evolutionsOf(def)) {
    const into = WEAPONS.get(e.into);
    const passive = PASSIVE_BY_ID.get(e.with);
    if (into && passive) out.push({ base: def, passive, into });
  }
  return out;
}

function holds(b: EvoBuild, id: string): boolean {
  for (const x of b.weapons) if (x.def.id === id) return true;
  return false;
}

function hasPassive(b: EvoBuild, id: string): boolean {
  for (const p of b.passives) if (p.def.id === id && p.level > 0) return true;
  return false;
}

function stateOf(b: EvoBuild, r: EvoRecipe, level: number, passive: boolean): { state: EvoState; blocked?: EvoBlock } {
  if (b.banished.has(r.into.id)) return { state: "blocked", blocked: "banished" };
  if (passive) return { state: level >= r.base.levels.length ? "ready" : "have" };
  if (b.banished.has(r.passive.id)) return { state: "blocked", blocked: "banished" };
  if (b.inPool && !b.inPool("passive", r.passive.id)) return { state: "blocked", blocked: "locked" };
  if (b.passives.length >= b.passiveSlots) return { state: "blocked", blocked: "slots" };
  return { state: "missing" };
}

function weaponSide(b: EvoBuild, def: WeaponDef, from: number, to: number, known: Known, fresh: boolean): EvoHint[] {
  const out: EvoHint[] = [];
  for (const r of recipesOf(def)) {
    // (unknown recipes stay secret; an evolution already held needs no hint)
    if (!known(r.into.id) || holds(b, r.into.id)) continue;
    const held = hasPassive(b, r.passive.id);
    const s = stateOf(b, r, to, held);
    const need = def.levels.length;
    out.push({ ...r, on: "weapon", ...s, passiveHeld: held, from, level: to, need, completes: fresh && held && s.state !== "blocked", readies: s.state === "ready" && from < need });
  }
  return out;
}

/** Hints for one level-up / chest card (weapon or NEW passive; other kinds get none). */
export function cardEvoHints(b: EvoBuild, card: UpgradeCard, known: Known): EvoHint[] {
  if (card.kind === "weapon") {
    const inst = b.weapons.find((x) => x.def.id === card.id);
    // (an upgrade card of a weapon no longer held: it evolved since - a chest reveal reads the build after the chest)
    if (!inst && card.from > 0) return [];
    const def = inst?.def ?? WEAPONS.get(card.id);
    if (!def) return [];
    return weaponSide(b, def, card.from, card.to, known, card.from === 0);
  }
  if (card.kind === "passive" && card.from === 0) {
    const out: EvoHint[] = [];
    for (const inst of b.weapons) {
      for (const r of recipesOf(inst.def)) {
        if (r.passive.id !== card.id || !known(r.into.id)) continue;
        const s = stateOf(b, r, inst.level, true);
        const ok = s.state !== "blocked";
        out.push({ ...r, on: "passive", ...s, passiveHeld: true, from: inst.level, level: inst.level, need: inst.def.levels.length, completes: ok, readies: s.state === "ready" });
      }
    }
    return out;
  }
  return [];
}

/** Hints for the build as it stands (pause menu): every known recipe of every held base weapon. */
export function buildEvoHints(b: EvoBuild, known: Known): EvoHint[] {
  const out: EvoHint[] = [];
  for (const inst of b.weapons) out.push(...weaponSide(b, inst.def, inst.level, inst.level, known, false));
  return out;
}

/** How a card should stand out: "ready" (the pick readies an evolution), "pair" (completes a pair), or none. */
export function evoSynergy(hints: readonly EvoHint[]): "ready" | "pair" | null {
  let pair = false;
  for (const h of hints) {
    if (h.readies) return "ready";
    if (h.completes) pair = true;
  }
  return pair ? "pair" : null;
}
