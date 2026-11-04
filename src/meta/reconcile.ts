/**
 * Content-aware profile repair, run after `sanitizeProfile` at boot and after
 * an import (src/ui/save.ts): hero levels from XP, talents checked against the
 * registered trees and point budgets, board nodes that no longer exist (or
 * ranks above a node's max) refunded, keystones within their slots, pity
 * counters within their caps, the loadout pointed at unlocked content, and
 * start content / newly-met unlock conditions applied (returned so the hub can
 * celebrate content that a new build added). PURE.
 */
import { BOARD } from "./board/graph";
import { gameContent, type MetaContent } from "./content";
import { discover } from "./codex";
import { heroLevel, heroXpForLevel } from "./economy";
import { repairTalents, talentPoints } from "./heroes";
import { storedLoadout } from "./loadout";
import type { Profile } from "./profile";
import { TUNING } from "./tuning";
import { evaluateUnlocks, type UnlockEvent } from "./unlocks";

export interface ReconcileReport {
  /** Coins refunded for board ranks that no longer exist. */
  boardRefund: number;
  /** Heroes whose talents had to be repaired. */
  talentRepairs: string[];
  /** Loadout fields that were reset. */
  loadoutFixes: number;
  /** New unlocks worth celebrating (conditions met before this build had the content); start content is applied silently. */
  unlocks: UnlockEvent[];
}

export function reconcileProfile(p: Profile, ctx: MetaContent = gameContent()): ReconcileReport {
  const report: ReconcileReport = { boardRefund: 0, talentRepairs: [], loadoutFixes: 0, unlocks: [] };

  // heroes: level follows XP; talents fit the tree and the points
  const xpCap = heroXpForLevel(TUNING.hero.maxLevel);
  for (const [id, hp] of Object.entries(p.heroes)) {
    hp.xp = Math.min(hp.xp, xpCap);
    hp.level = heroLevel(hp.xp);
    hp.constellation = Math.max(0, Math.min(TUNING.constellation.max, hp.constellation));
    const tree = ctx.talents.get(id);
    if (!tree) continue; // keep talents of trees this build doesn't have (newer save)
    const fixed = repairTalents(tree, hp.talents, talentPoints(hp).total);
    if (JSON.stringify(fixed) !== JSON.stringify(hp.talents)) {
      hp.talents = fixed;
      report.talentRepairs.push(id);
    }
  }

  // board: unknown nodes / excess ranks are refunded (exactly what was paid)
  const b = p.board;
  for (const id of Object.keys(b.ranks)) {
    const node = BOARD.byId.get(id);
    const paid = b.paid[id] ?? 0;
    if (!node || node.kind === "center") {
      report.boardRefund += paid;
      delete b.ranks[id];
      delete b.paid[id];
      continue;
    }
    if (b.ranks[id] > node.maxRank) {
      b.ranks[id] = node.maxRank;
      let fair = 0;
      for (let r = 0; r < node.maxRank; r++) fair += node.costs[r];
      if (paid > fair) {
        report.boardRefund += paid - fair;
        b.paid[id] = fair;
      }
    }
  }
  for (const id of Object.keys(b.paid)) if (!(id in b.ranks)) delete b.paid[id];
  p.currencies.coins += report.boardRefund;
  const seen = new Set<string>();
  b.active = b.active.filter((id) => {
    const ok = !seen.has(id) && BOARD.byId.get(id)?.kind === "keystone" && (b.ranks[id] ?? 0) > 0;
    seen.add(id);
    return ok;
  });
  if (b.active.length > TUNING.board.keystoneSlots) b.active.length = TUNING.board.keystoneSlots;

  // gacha: pity counters inside their caps ("pity never exceeded")
  const G = TUNING.gacha;
  for (const st of Object.values(p.gacha.banners)) {
    st.pity = Math.min(st.pity, G.hardPity - 1);
    st.pityUR = Math.min(st.pityUR, G.urPity - 1);
  }
  p.rotation.runsLeft = Math.max(1, Math.min(TUNING.rotation.runsPerBanner, p.rotation.runsLeft));
  for (const id of Object.keys(p.relics)) p.relics[id] = Math.max(0, Math.min(TUNING.relics.maxStars, p.relics[id]));

  // start content + conditions met earlier
  report.unlocks = evaluateUnlocks(p, ctx).filter((e) => !e.start);
  // owned heroes are known to the wiki (no bounty: nothing on screen would explain the gems)
  for (const h of p.unlocks.heroes) if (ctx.heroById.has(h)) discover(p, "heroes", h, false);

  // loadout -> something playable (twists / Filler Arc kept for a stage that is not cleared yet:
  // they apply again once it is, and resolveLoadout drops them from any run before that)
  const { loadout, issues } = storedLoadout(p, {}, ctx);
  report.loadoutFixes = issues.filter((i) => i.reason !== "notCleared").length;
  p.loadout = loadout;
  return report;
}
