/**
 * R ("Rare") relics: stats with a twist - first event hooks (docs/content/relics.md).
 */
import type { RelicDef } from "../defs";
import { onDashThrough } from "../hooks";
import { atStar, proc } from "./_util";

const STAND = [2, 2.5, 3, 3.5, 4, 4.5, 5];
/** A tiny heart heals this many HP. */
const HEART_HP = 3;

export const acrylicStand: RelicDef = {
  id: "acrylic_stand",
  name: "Limited Edition Acrylic Stand",
  rarity: "R",
  icon: "icon_relic_acrylic_stand",
  flavor: "Limited to 1,000,000 copies.",
  desc: (s) => `${atStar(STAND, s)}% chance a kill drops a tiny heart (heals ${HEART_HP})`,
  install(w, s) {
    const chance = atStar(STAND, s) / 100;
    w.hooks.on("kill", (k) => {
      // (Censored twist: no healing pickups)
      if (k.boss || !w.difficulty.food || w.rng.next() >= chance) return;
      w.dropPickup("heart", k.x, k.y, HEART_HP);
      proc(w, "acrylic_stand", k.x, k.y);
    });
  },
};

const DUCK = [10, 13, 16, 19, 22, 25, 28];

export const rubberDuck: RelicDef = {
  id: "rubber_duck",
  name: "Rubber Duck (Squeaky)",
  rarity: "R",
  icon: "icon_relic_rubber_duck",
  flavor: "Squeak. (Translation: move.)",
  desc: (s) => `Dashing through enemies squeaks: ${atStar(DUCK, s)} damage and a knockback to each`,
  install(w, s) {
    const dmg = atStar(DUCK, s);
    onDashThrough(w, (e) => {
      const p = w.player;
      w.hitEnemy(e, dmg * w.stats.might, null, Math.atan2(p.dashDY, p.dashDX), 160, 0, "rubber_duck", 0xffe14d);
      proc(w, "rubber_duck", e.x, e.y - e.cy);
    });
  },
};

const CHOPSTICKS = [20, 25, 30, 35, 40, 45, 50];

export const mismatchedChopsticks: RelicDef = {
  id: "mismatched_chopsticks",
  name: "Mismatched Chopsticks",
  rarity: "R",
  icon: "icon_relic_mismatched_chopsticks",
  flavor: "One from home, one from the café. A love story.",
  desc: (s) => `Food heals +${atStar(CHOPSTICKS, s)}%`,
  install(w, s) {
    const k = atStar(CHOPSTICKS, s) / 100;
    w.hooks.on("pickup", (p) => {
      if (p.kind === "onigiri") w.heal(20 * k);
      else if (p.kind === "cake") w.heal(50 * k);
    });
  },
};

const RAMEN = [20, 23, 26, 29, 32, 35, 38];

export const instantRamen: RelicDef = {
  id: "instant_ramen",
  name: "Instant Ramen (Three Minutes Exactly)",
  rarity: "R",
  icon: "icon_relic_instant_ramen",
  flavor: "Ready in three minutes. So is this heal.",
  desc: (s) => `Every 3:00, heal ${atStar(RAMEN, s)}% max HP`,
  install(w, s) {
    const k = atStar(RAMEN, s) / 100;
    w.every(180, () => {
      const p = w.player;
      w.heal(p.maxHp * k);
      proc(w, "instant_ramen", p.x, p.y - 10);
    });
  },
};

export const relics: RelicDef[] = [acrylicStand, rubberDuck, mismatchedChopsticks, instantRamen];
