/**
 * Seeded account profiles for scenarios and the dev console (lazy chunk).
 *
 * Profiles are built through the REAL meta layer: tools/checkpoints.ts
 * (board purchases with the simulator's policy, hero levels + talents,
 * mastery, relics, constellations, unlocks), then reconciled like a boot.
 *
 *   fresh   a new save (P0, nothing bought, tutorial pending)
 *   mid     P3 (~8 h): Dream Meadow cleared, ring 2 mostly, 2 relic slots, a 10-pull in gems
 *   rich    P7 (~150 h) + every unlock and a mountain of currency
 *   P0..P7  the combat-curve checkpoints as they are (docs/ARCHITECTURE.md §6)
 *
 * SANDBOX: a scenario never writes the player's save. `sandbox()` turns every
 * storage write of `save` off for this page (save / stash / persist / other-window
 * reloads); reloading the page without `?scenario=` brings the real save back.
 */
import { evaluateAchievements } from "../meta/achievements/engine";
import { gameContent } from "../meta/content";
import { defaultProfile, type Profile } from "../meta/profile";
import { reconcileProfile } from "../meta/reconcile";
import { encodeSaveString } from "../meta/transfer";
import { grantUnlock } from "../meta/unlocks";
import type { App } from "../ui/app";
import { save } from "../ui/save";
import { CHECKPOINTS, checkpointProfile } from "../../tools/checkpoints";

export const PROFILE_KINDS = ["fresh", "mid", "rich", ...CHECKPOINTS.map((c) => c.id)] as const;

let sandboxed = false;

/** Storage writes of the save are off for this page (scenarios). */
export function isSandboxed(): boolean {
  return sandboxed;
}

/** Turn every save write off for the rest of this page's life (idempotent). */
export function sandbox(): void {
  if (sandboxed) return;
  sandboxed = true;
  const s = save as unknown as Record<string, unknown>;
  s.save = () => true;
  s.stashRun = () => true;
  s.clearStash = () => {};
  s.requestPersist = () => {};
  s.onStorage = () => {};
  console.info("[dev] sandbox: save writes are off for this page (reload without ?scenario= for the real save)");
}

/** Lifetime counters that make a checkpoint account look lived-in (episode numbers, wiki stats). */
function liven(p: Profile, hours: number): void {
  const L = p.lifetime;
  L.runs = Math.max(L.runs, Math.round(hours * 4.5));
  L.clears = Math.max(L.clears, Object.values(p.records).reduce((a, r) => a + (r.clears ?? 0), 0));
  L.deaths = Math.max(L.deaths, L.runs - L.clears);
  L.time = Math.max(L.time, Math.round(hours * 3600 * 0.9));
  L.kills = Math.max(L.kills, Math.round(hours * 2600));
  // onboarding done: no tutorial bubbles / hub coach marks in shots of an experienced account
  if (hours > 0) {
    p.tutorial.dash = true;
    p.tutorial.ult = Math.max(p.tutorial.ult, 3);
  }
}

/** Build a profile of `kind` for `hero` (the played hero is always unlocked). */
export function buildProfile(kind: string, hero = "hoshi"): Profile {
  const ctx = gameContent();
  let p: Profile;
  if (kind === "fresh" || kind === "P0") {
    p = defaultProfile(Date.now());
    reconcileProfile(p, ctx);
    if (hero !== "hoshi") grantUnlock(p, hero, ctx);
    p.loadout.hero = hero;
    return p;
  }
  const id = kind === "mid" ? "P3" : kind === "rich" ? "P7" : kind;
  const cp = CHECKPOINTS.find((c) => c.id === id);
  if (!cp) throw new Error(`unknown profile '${kind}' (one of ${PROFILE_KINDS.join(", ")})`);
  p = checkpointProfile(id, hero, ctx);
  liven(p, cp.hours);
  if (kind === "mid") {
    p.currencies.coins = 2400;
    p.currencies.gems = 1800;
    p.currencies.copium = 40;
  }
  if (kind === "rich") {
    unlockAll(p);
    p.currencies.coins = 500_000;
    p.currencies.gems = 99_999;
    p.currencies.copium = 5_000;
  }
  reconcileProfile(p, ctx);
  p.loadout.hero = hero;
  return p;
}

/** Every hero, weapon, passive, stage and twist unlocked (the console's UNLOCK ALL). */
export function unlockAll(p: Profile): number {
  const ctx = gameContent();
  let n = 0;
  const ids = [...ctx.heroes.map((h) => h.id), ...[...ctx.weapons.values()].filter((w) => !w.evolved).map((w) => w.id), ...ctx.passives.keys(), ...ctx.stages.map((s) => s.id), ...ctx.twists.keys()];
  for (const id of ids) if (grantUnlock(p, id, ctx)) n++;
  reconcileProfile(p, ctx);
  return n;
}

/**
 * Make `p` the live profile (in memory). The current settings are kept; boot notices, pending
 * unlock celebrations and Plot Point toasts of the new profile are cleared so screens are clean.
 * `persist` writes it like Settings IMPORT does (the old profile goes to the backup key).
 */
export function applyProfile(app: App, p: Profile, persist = false): void {
  p.settings = { ...save.profile.settings };
  evaluateAchievements(p, null);
  if (persist && !sandboxed) {
    const r = save.importString(encodeSaveString(p));
    if (!r.ok) throw new Error(r.message);
  } else save.profile = p;
  save.bootUnlocks = [];
  save.pendingUnlocks = [];
  save.migration = null;
  save.interrupted = null;
  save.lastReport = null;
  save.recoveredFromV1 = false;
  save.origin = "v2";
  app.onProfileReplaced();
  app.applySettings();
}
