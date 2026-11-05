/**
 * Pudding - OMURICE OF LOVE: MOE MOE KYUN! (docs/content/heroes.md §2.5).
 * 0.0 s a giant omurice plops onto the ground under Pudding (squash, dust
 * ring); 0.4 s the ketchup heart is drawn on it; 0.9 / 1.8 / 2.7 s three heart
 * pulses from the plate (MOE / MOE / KYUN♡): 110 damage to every enemy within
 * 96 px, knockback 120 (the KYUN♡ pulse 300), and Pudding heals 8 % max HP
 * (x healMul). Enemies the ult kills drop a tiny heart (food, heals 2) 30 % of
 * the time.
 *
 * C4 = +1 pulse; Moe Moe Kyun MAX (talent capstone) = a 4th pulse
 * ("KYUN KYUN♡") and every pulse grants +1 shield charge (max 3, they last
 * until hit). Extra pulses keep the 0.9 s rhythm (the cast lasts longer).
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import type { UltimateDef } from "../types";
import type { World } from "../world";
import { HERO_TEXTS, HFX_PUD_KETCHUP, HFX_PUD_OMURICE, HFX_PUD_PULSE, HFX_TEXT, dropSnack, hfx } from "../weapons/_heroes-a";

const PULSE_AT = 0.9;
const PULSE_EVERY = 0.9;
const KETCHUP_AT = 0.4;
const R = 96;
const DMG = 110;
const HEAL = 0.08;
const WORDS = ["MOE", "MOE", "KYUN♡", "KYUN KYUN♡", "KYUN KYUN♡"] as const;

function pulse(w: World, x: number, y: number, dmg: number, knock: number): void {
  const cy = y - CFG.playerCy;
  const buf = w.acquire();
  const n = w.grid.query(x, cy, R + 16, buf);
  for (let k = 0; k < n; k++) {
    const e = w.enemies.items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - x;
    const dy = e.y - e.cy - cy;
    const rr = R + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    const ex = e.x;
    const ey = e.y;
    const prop = !!e.def.prop;
    // a tiny heart from what the love defeated (food: collected on touch, heals 2)
    if (w.hitEnemy(e, dmg, null, Math.atan2(dy, dx), knock, 0, "omurice_of_love", C.pink) && !prop && w.rng.next() < 0.3) dropSnack(w, "fx_heart", ex, ey, 2, C.pink);
  }
  w.release();
}

export const omuriceOfLove: UltimateDef = {
  id: "omurice_of_love",
  name: "OMURICE OF LOVE: MOE MOE KYUN!",
  hero: "pudding",
  desc: "A giant omurice: three heart pulses (MOE, MOE, KYUN♡) blast everything nearby and heal Pudding.",
  duration: PULSE_AT + 2 * PULSE_EVERY + 0.8,
  start(w, u) {
    const max = w.talentRank("pudding_moe_max") > 0;
    const n = 3 + (w.cons >= 4 && w.hero.id === "pudding" ? 1 : 0) + (max ? 1 : 0);
    const d = u.data;
    d.n = n;
    d.i = 0;
    d.ketchup = 0;
    d.max = max ? 1 : 0;
    // the omurice stays where it plopped: the pulses come from the plate
    const p = w.player;
    d.x = p.x;
    d.y = p.y;
    u.dur = Math.max(omuriceOfLove.duration, PULSE_AT + (n - 1) * PULSE_EVERY + 0.8);
    hfx(w, HFX_PUD_OMURICE, p.x, p.y, p.x, p.y, u.dur, n);
  },
  update(w, u) {
    const d = u.data;
    if (!d.ketchup && u.t >= KETCHUP_AT) {
      d.ketchup = 1;
      hfx(w, HFX_PUD_KETCHUP, d.x, d.y);
    }
    while (d.i < d.n && u.t >= PULSE_AT + d.i * PULSE_EVERY) {
      const i = d.i++;
      const last = d.i === d.n;
      // the KYUN♡ pulse (and a last KYUN KYUN♡) blasts them away
      const knock = i >= 2 ? 300 : 120;
      pulse(w, d.x, d.y, DMG * w.stats.might * u.power, knock);
      const p = w.player;
      w.heal(p.maxHp * HEAL);
      // Moe Moe Kyun MAX: +1 shield charge per pulse (max 3; bonus wards last until hit)
      if (d.max) p.shield = Math.min(Math.max(3, w.stats.shield), p.shield + 1);
      hfx(w, HFX_PUD_PULSE, d.x, d.y - CFG.playerCy, d.x, last ? 1 : 0, R, i);
      const word = WORDS[Math.min(WORDS.length - 1, i)];
      hfx(w, HFX_TEXT, d.x, d.y - 40 - i * 4, d.x, d.y, i >= 2 ? 3 : 2.4, HERO_TEXTS.indexOf(word));
    }
  },
};

export const ultimates: UltimateDef[] = [omuriceOfLove];
