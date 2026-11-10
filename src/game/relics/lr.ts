/**
 * LR ("Legendary Rare") relics: run-defining (docs/content/relics.md).
 */
import { CFG } from "../config";
import type { RelicDef } from "../defs";
import { Buff } from "../hooks";
import { evolutionsOf } from "../registry";
import type { UltState } from "../types";
import { atStar, num, proc } from "./_util";

const DRAFT_W = [3, 3, 4, 4, 4, 4, 5];
const DRAFT_P = [1, 1, 1, 1, 2, 2, 3];

export const originalManuscript: RelicDef = {
  id: "original_manuscript",
  name: "Author's Original Manuscript",
  rarity: "LR",
  icon: "icon_relic_original_manuscript",
  flavor: "The ending was different in the draft. Better, even.",
  desc: (s) => `Start with your start weapon at Lv ${atStar(DRAFT_W, s)} and its first evolution's passive at Lv ${atStar(DRAFT_P, s)}`,
  install(w, s) {
    const lv = atStar(DRAFT_W, s);
    const plv = atStar(DRAFT_P, s);
    // (relics install before the start weapon is added: it spawns at this level; constellations only raise it)
    w.startWeaponLevel = Math.max(w.startWeaponLevel, lv);
    // the evolution passive needs the start weapon's def: hand it over on the first step
    w.after(0, () => {
      const inst = w.hasWeapon(w.startWeapon);
      const p = w.player;
      if (!inst) return;
      if (inst.level < lv) w.setWeaponLevel(inst, lv);
      // (a weapon with two evolutions: the first one's passive - the other route stays the player's to build)
      const evo = evolutionsOf(inst.def)[0];
      if (evo) {
        const have = w.passiveLevel(evo.with);
        if (have <= 0) w.addPassive(evo.with, plv);
        else if (have < plv) w.setPassiveLevel(evo.with, plv);
      }
      proc(w, "original_manuscript", p.x, p.y - 14, inst.level);
    });
  },
};

const SECOND_WIND = [6, 7, 8, 9, 10, 11, 12];

export const revivalTheme: RelicDef = {
  id: "revival_theme",
  name: "The Hero's Revival Theme",
  rarity: "LR",
  icon: "icon_relic_revival_theme",
  flavor: "Plays when you get back up. Also plays in the shower.",
  desc: (s) => `+1 revive; reviving refills Overdrive and grants SECOND WIND: +50% might for ${atStar(SECOND_WIND, s)} s`,
  mods: (st) => void (st.revives += 1),
  install(w, s) {
    const dur = atStar(SECOND_WIND, s);
    const wind = new Buff(w);
    w.statMods.push((st) => void (wind.on && (st.might += 0.5)));
    w.hooks.on("revive", (r) => {
      w.addUlt(CFG.ultMax);
      wind.start(dur);
      proc(w, "revival_theme", r.x, r.y - 12, dur);
    });
  },
};

const BUDGET = [2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6];

export const lastBudget: RelicDef = {
  id: "last_budget",
  name: "Studio's Last Remaining Budget",
  rarity: "LR",
  icon: "icon_relic_last_budget",
  flavor: "We spent it all on the ultimate. No regrets.",
  desc: (s) => `Ultimates deal ×${num(atStar(BUDGET, s))} damage and last 50% longer`,
  mods: (st, s) => void (st.ultPower *= atStar(BUDGET, s)),
  install(w, s) {
    const mul = atStar(BUDGET, s);
    // (an encore re-fires the ult hook for the same cast: lengthen each cast once)
    let last: UltState | null = null;
    w.hooks.on("ult", () => {
      const u = w.ult;
      if (!u || u === last) return;
      last = u;
      u.dur = (u.dur ?? u.def.duration) * 1.5;
      const p = w.player;
      proc(w, "last_budget", p.x, p.y - 14, mul);
    });
  },
};

const SAKUGA = [5, 5.5, 6, 6.5, 7, 7.5, 8];

export const sakugaCel: RelicDef = {
  id: "sakuga_cel",
  name: "Sakuga Animation Cel",
  rarity: "LR",
  icon: "icon_relic_sakuga_cel",
  flavor: "For five seconds, the budget is infinite.",
  desc: (s) => `Every 30 s, SAKUGA MODE for ${atStar(SAKUGA, s)} s: -40% cooldown, +20% move speed, every hit sparkles`,
  install(w, s) {
    const dur = atStar(SAKUGA, s);
    const mode = new Buff(w);
    w.statMods.push((st) => {
      if (!mode.on) return;
      st.cooldown -= 0.4;
      st.moveSpeed += 0.2;
    });
    w.every(30, () => {
      mode.start(dur);
      const p = w.player;
      proc(w, "sakuga_cel", p.x, p.y - 10, dur);
    });
  },
};

export const relics: RelicDef[] = [originalManuscript, revivalTheme, lastBudget, sakugaCel];
