/**
 * Achievement evaluation (docs/EXPANSION.md §11):
 *
 *  - `evaluateAchievements(p, run?)` after each run (applyRunToProfile calls
 *    it), after gacha pulls and at boot: records progress, completes what
 *    reached its target (unlock / title rewards apply at once), returns the
 *    newly completed defs for the celebration cards.
 *  - `claimAchievement(p, id)` / `claimAllAchievements(p)`: gems and coins
 *    are claimed explicitly ("CLAIM!" button, results screen).
 *  - `AchievementWatch`: the in-run incremental check the HUD polls (about
 *    once a second) with the live RunStats to toast completions as they
 *    happen. It never mutates the profile.
 * PURE.
 */
import type { RunStats } from "../../game/run-config";
import { baseWeaponId, gameContent, type MetaContent } from "../content";
import { runKills } from "../economy";
import type { Lifetime, Profile } from "../profile";
import { grantUnlock, type UnlockEvent } from "../unlocks";
import { addId } from "../util";
import { ACHIEVEMENT_LIST, ACHIEVEMENTS } from "./registry";
import type { AchCtx, AchievementCategory, AchievementDef, AchievementReward } from "./types";

/** Lifetime counters plus a live (unfinished) run, for in-run checks. */
export function lifetimeWithRun(L: Lifetime, run: RunStats, ctx: MetaContent = gameContent()): Lifetime {
  const out: Lifetime = { ...L, killsByEnemy: { ...L.killsByEnemy }, bossKills: { ...L.bossKills }, damageByWeapon: { ...L.damageByWeapon }, killsByWeapon: { ...L.killsByWeapon } };
  for (const k in run.killsByEnemy) out.killsByEnemy[k] = (out.killsByEnemy[k] ?? 0) + run.killsByEnemy[k];
  for (const b of run.bossKills) out.bossKills[b] = (out.bossKills[b] ?? 0) + 1;
  let dmg = 0;
  for (const w in run.damageByWeapon) {
    const base = baseWeaponId(w, ctx);
    out.damageByWeapon[base] = (out.damageByWeapon[base] ?? 0) + run.damageByWeapon[w];
    dmg += run.damageByWeapon[w];
  }
  for (const w in run.killsByWeapon) {
    const base = baseWeaponId(w, ctx);
    out.killsByWeapon[base] = (out.killsByWeapon[base] ?? 0) + run.killsByWeapon[w];
  }
  out.kills += runKills(run);
  out.eliteKills += run.eliteKills;
  out.evolutions += run.evolutions.length;
  if (run.stageCleared && !out.heroesCleared.includes(run.hero)) out.heroesCleared = [...out.heroesCleared, run.hero];
  out.damage += dmg;
  out.time += run.time;
  out.endlessTime += run.endlessTime;
  out.dashes += run.dashes;
  out.ults += run.ults;
  out.levelUps += run.levelUps;
  out.chests += run.chests;
  out.foodEaten += run.foodEaten;
  out.revivesUsed += run.revivesUsed;
  out.damageTaken += run.damageTaken;
  out.coinsPicked += run.coins;
  out.maxCombo = Math.max(out.maxCombo, run.maxCombo);
  out.maxRank = Math.max(out.maxRank, run.maxRank);
  out.bestLevel = Math.max(out.bestLevel, run.level);
  out.noHitBest = Math.max(out.noHitBest, run.noHitBest);
  out.noDashBest = Math.max(out.noDashBest, noDashTime(run));
  out.pacifistBest = Math.max(out.pacifistBest, run.pacifistBest ?? 0);
  out.maxEvolutions = Math.max(out.maxEvolutions, run.evolutions.length);
  return out;
}

/** Seconds survived before the first dash (the whole run if never dashed). */
export function noDashTime(run: RunStats): number {
  const first = run.firstDashAt;
  if (first !== undefined && first >= 0) return first;
  return run.dashes > 0 && first === undefined ? 0 : run.time;
}

function makeCtx(p: Profile, life: Lifetime, run: RunStats | null, ended: boolean, ctx: MetaContent): AchCtx {
  const live = run && !ended ? run : null;
  return {
    p,
    life,
    run,
    ended,
    ctx,
    clears: (stage) => (p.records[stage]?.clears ?? 0) + (live && live.stage === stage && live.stageCleared ? 1 : 0),
    bestHeat: () => {
      let h = -1;
      for (const k in p.records) h = Math.max(h, p.records[k].bestHeat);
      if (live && live.stageCleared) h = Math.max(h, live.heat);
      return h;
    },
    bestEndless: () => {
      let e = 0;
      for (const k in p.records) e = Math.max(e, p.records[k].bestEndless);
      if (live) e = Math.max(e, live.endlessTime);
      return e;
    },
  };
}

export interface AchievementDone {
  def: AchievementDef;
  /** Content unlocked by the reward (applied immediately). */
  unlocked: UnlockEvent | null;
}

/**
 * Evaluate every achievement against the profile (and the finished `run`, if
 * any - the profile must already include it). Marks completions, applies
 * unlock / title rewards, returns the new completions in registry order.
 */
export function evaluateAchievements(p: Profile, run: RunStats | null = null, ctx: MetaContent = gameContent(), defs: readonly AchievementDef[] = ACHIEVEMENT_LIST): AchievementDone[] {
  const c = makeCtx(p, p.lifetime, run, true, ctx);
  const A = p.achievements;
  const out: AchievementDone[] = [];
  for (const def of defs) {
    if (def.id in A.done) continue;
    let v = 0;
    try {
      v = def.value(c);
    } catch {
      continue; // a broken def must never break the results screen
    }
    if (!Number.isFinite(v)) continue;
    const prog = Math.min(def.target, Math.max(0, v));
    if (prog > (A.progress[def.id] ?? 0)) A.progress[def.id] = prog;
    if (v >= def.target) {
      A.done[def.id] = p.lifetime.runs;
      delete A.progress[def.id];
      let unlocked: UnlockEvent | null = null;
      if (def.reward.unlock) unlocked = grantUnlock(p, def.reward.unlock, ctx);
      if (def.reward.title) addId(p.titles.owned, def.id);
      out.push({ def, unlocked });
    }
  }
  return out;
}

/** Gems / coins of a completed, unclaimed achievement. */
export function claimAchievement(p: Profile, id: string): { ok: boolean; reward?: AchievementReward; reason?: "unknown" | "notDone" | "claimed" } {
  const def = ACHIEVEMENTS.get(id);
  if (!def) return { ok: false, reason: "unknown" };
  if (!(id in p.achievements.done)) return { ok: false, reason: "notDone" };
  if (p.achievements.claimed.includes(id)) return { ok: false, reason: "claimed" };
  p.achievements.claimed.push(id);
  const r = def.reward;
  if (r.gems) {
    p.currencies.gems += r.gems;
    p.lifetime.gemsEarned += r.gems;
  }
  if (r.coins) {
    p.currencies.coins += r.coins;
    p.lifetime.coinsEarned += r.coins;
  }
  return { ok: true, reward: r };
}

/** Claim everything claimable. Returns the totals. */
export function claimAllAchievements(p: Profile): { count: number; gems: number; coins: number } {
  let count = 0;
  let gems = 0;
  let coins = 0;
  for (const id of Object.keys(p.achievements.done)) {
    const r = claimAchievement(p, id);
    if (!r.ok || !r.reward) continue;
    count++;
    gems += r.reward.gems ?? 0;
    coins += r.reward.coins ?? 0;
  }
  return { count, gems, coins };
}

/** Number of completed achievements whose reward is waiting (hub badge). */
export function unclaimedCount(p: Profile): number {
  let n = 0;
  for (const id in p.achievements.done) if (ACHIEVEMENTS.has(id) && !p.achievements.claimed.includes(id)) n++;
  return n;
}

export interface AchievementView {
  def: AchievementDef;
  /** Hidden and not done: show "???". */
  secret: boolean;
  name: string;
  desc: string;
  progress: number;
  target: number;
  done: boolean;
  claimed: boolean;
}

/** Achievement list for the Plot Points screen (live progress from the profile). */
export function achievementViews(p: Profile, ctx: MetaContent = gameContent(), category?: AchievementCategory): AchievementView[] {
  const c = makeCtx(p, p.lifetime, null, false, ctx);
  const out: AchievementView[] = [];
  for (const def of ACHIEVEMENT_LIST) {
    if (category && def.category !== category) continue;
    const done = def.id in p.achievements.done;
    let v = p.achievements.progress[def.id] ?? 0;
    if (!done) {
      try {
        v = Math.max(v, def.value(c));
      } catch {
        /* keep the stored progress */
      }
    }
    const secret = !!def.hidden && !done;
    out.push({
      def,
      secret,
      name: secret ? "???" : def.name,
      desc: secret ? "A secret Plot Point. Keep playing (weirdly)." : def.desc,
      progress: done ? def.target : Math.min(def.target, Math.max(0, Number.isFinite(v) ? v : 0)),
      target: def.target,
      done,
      claimed: p.achievements.claimed.includes(def.id),
    });
  }
  return out;
}

/** Display name of a title (titles are achievement ids). */
export function titleName(id: string): string {
  return ACHIEVEMENTS.get(id)?.reward.title ?? "";
}

/**
 * In-run toasts: poll with the live RunStats (about once a second, never per
 * frame); returns achievements reached since the last poll that are not done
 * on the profile yet. Does not touch the profile.
 */
export class AchievementWatch {
  private readonly reported = new Set<string>();
  private readonly pending: AchievementDef[];

  constructor(
    private readonly p: Profile,
    private readonly ctx: MetaContent = gameContent(),
    defs: readonly AchievementDef[] = ACHIEVEMENT_LIST,
  ) {
    this.pending = defs.filter((d) => !(d.id in p.achievements.done));
  }

  poll(run: RunStats): AchievementDef[] {
    const out: AchievementDef[] = [];
    if (this.pending.length === 0) return out;
    const c = makeCtx(this.p, lifetimeWithRun(this.p.lifetime, run, this.ctx), run, false, this.ctx);
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const def = this.pending[i];
      let v = 0;
      try {
        v = def.value(c);
      } catch {
        continue;
      }
      if (v >= def.target && !this.reported.has(def.id)) {
        this.reported.add(def.id);
        this.pending.splice(i, 1);
        out.push(def);
      }
    }
    return out.reverse();
  }

  /** Ids toasted so far this run. */
  get toasted(): string[] {
    return [...this.reported];
  }
}
