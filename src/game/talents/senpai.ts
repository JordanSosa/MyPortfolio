/**
 * SENPAI's talent tree, literally as docs/content/heroes.md §3: "Charisma" /
 * "Aloof" / "Popularity". Weapon / ult parts are read by
 * weapons/notice-me-sparkles.ts (Magnetic Personality, Fan Club, Love
 * Triangle, Meaningful Glance) and ultimates/senpai-noticed-you.ts (Senpai
 * Noticed Everyone) through w.talentRank(id); the rest is installed here.
 */
import { CFG } from "../config";
import type { TalentTree } from "../defs";
import type { Pickup } from "../types";
import type { World } from "../world";
import { charmRules } from "../weapons/_charm";
import { HB, hfx } from "../weapons/_hb";
import { glance } from "../weapons/notice-me-sparkles";
import { byRank, node } from "./_node";

/** Valentine's chocolates: a brown heart snack (heals 3, +1 Overdrive each). */
const CHOC_SPRITE = "fx_heart";
const CHOC_TINT = 0x8a4b2e;

/** Too Cool To Get Hit: enemies within 20 px are gently pushed away (and contact damage is cut). */
function installTooCool(w: World, r: number): void {
  w.contactDmg *= 1 - 0.08 * r;
  const buf: number[] = [];
  w.hooks.on("step", (h) => {
    if (w.phase !== "play") return;
    const p = w.player;
    const cy = p.y - CFG.playerCy;
    const n = w.grid.query(p.x, cy, 20, buf);
    const items = w.enemies.items;
    for (let k = 0; k < n; k++) {
      const e = items[buf[k]];
      if (!e || e.dead || e.def.prop || e.def.boss) continue;
      const dx = e.x - p.x;
      const dy = e.y - e.cy - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > 400 || d2 < 1e-4) continue;
      const d = Math.sqrt(d2);
      const push = 26 * h.dt;
      e.x += (dx / d) * push;
      e.y += (dy / d) * push;
    }
  });
}

/** Valentine's Day: every 60 / 50 / 40 s, 12 chocolates fall around the hero. */
function installValentines(w: World, r: number): void {
  const live: Pickup[] = [];
  w.every(byRank([60, 50, 40], r), () => {
    const p = w.player;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + w.rng.spread(0.2);
      const d = 22 + w.rng.next() * 30;
      const k = w.dropPickup("snack", p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.7, 3);
      k.sprite = CHOC_SPRITE;
      k.tint = CHOC_TINT;
      // they fall from the sky (staggered) instead of hopping out of the hero
      k.z = 70 + i * 9;
      k.vz = 0;
      k.vx = k.vy = 0;
      live.push(k);
    }
    hfx(w, HB.VALENTINE, p.x, p.y - CFG.playerCy);
  });
  // each chocolate eaten: +1 Overdrive (the collected pickup is flagged dead right before the hook)
  w.hooks.on("pickup", (h) => {
    if (h.kind !== "snack") return;
    for (let i = live.length - 1; i >= 0; i--) {
      const k = live[i];
      if (!k.dead) continue;
      live[i] = live[live.length - 1];
      live.pop();
      if (k.sprite === CHOC_SPRITE) w.addUlt(1);
    }
  });
}

export const senpaiTree: TalentTree = {
  hero: "senpai",
  branches: ["Charisma", "Aloof", "Popularity"],
  nodes: [
    // ---- Charisma
    node("senpai_sparkle", "Sparkle", 0, 1, 5, (r) => `+${3 * r}% area`, { mods: (s, r) => void (s.area += 0.03 * r) }),
    node("senpai_magnetic", "Magnetic Personality", 0, 2, 3, (r) => `Notice-Me Sparkles charm chance +${(1.5 * r).toFixed(1)} points`),
    node("senpai_hair_flip", "Hair Flip", 0, 3, 3, (r) => `+${4 * r}% duration`, { mods: (s, r) => void (s.duration += 0.04 * r) }),
    node("senpai_fan_club", "Fan Club", 0, 4, 3, (r) => `+${2 * r} max charmed enemies`),
    node(
      "senpai_love_triangle",
      "Love Triangle",
      0,
      5,
      1,
      () => "When a charmed enemy kills another enemy, the nearest non-charmed enemy within 48 px becomes charmed too (free; a chain stops 3 links after the original charm)",
      { install: (w) => charmRules(w, { triangle: true }) },
    ),
    // ---- Aloof
    node("senpai_composure", "Cool Composure", 1, 1, 5, (r) => `+${5 * r} max HP`, { mods: (s, r) => void (s.maxHp += 5 * r) }),
    node("senpai_unbothered", "Unbothered", 1, 2, 3, (r) => `-${2 * r}% damage taken`, { mods: (s, r) => void (s.dmgReduction += 0.02 * r) }),
    node("senpai_personal_space", "Personal Space", 1, 3, 3, (r) => `+${8 * r}% pickup range`, { mods: (s, r) => void (s.pickup += 0.08 * r) }),
    node("senpai_too_cool", "Too Cool To Get Hit", 1, 4, 3, (r) => `Contact damage taken -${8 * r}%; enemies within 20 px are gently pushed away`, {
      install: installTooCool,
    }),
    node("senpai_noticed_everyone", "Senpai Noticed Everyone", 1, 5, 1, () => "SENPAI NOTICED YOU: the swoon lasts 7 s and swooned enemies burst into rose petals when it ends (r 24, 100 damage)"),
    // ---- Popularity
    node("senpai_admirers", "Admirers", 2, 1, 5, (r) => `+${4 * r}% XP`, { mods: (s, r) => void (s.growth += 0.04 * r) }),
    node("senpai_letters", "Love Letters in the Locker", 2, 2, 3, (r) => `+${4 * r}% luck`, { mods: (s, r) => void (s.luck += 0.04 * r) }),
    node("senpai_gifts", "Gifts", 2, 3, 3, (r) => `+${5 * r}% coins`, { mods: (s, r) => void (s.greed += 0.05 * r) }),
    node("senpai_valentines", "Valentine's Day", 2, 4, 3, (r) => `Every ${byRank([60, 50, 40], r)} s, 12 chocolates fall around you (heal 3 each, +1 Overdrive each)`, {
      install: installValentines,
    }),
    node("senpai_glance", "Meaningful Glance", 2, 5, 1, () => "Every 4 s Senpai glances at a random enemy in view: it is charmed instantly (bosses: stunned 0.5 s)", {
      install: (w) => w.every(4, glance),
    }),
  ],
};

export const talentTrees: TalentTree[] = [senpaiTree];
