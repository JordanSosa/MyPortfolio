/**
 * RIN's talent tree, literally as docs/content/heroes.md §3: "Way of the
 * Blade" / "Shrine Maiden" / "Oni Hunter". Weapon / ult parts are read by
 * weapons/petal-slash.ts (Wide Stance, Petal Storm, Crescent Moon Draw) and
 * ultimates/thousand-blossom-cut.ts (Ten Thousand Blossoms) through
 * w.talentRank(id); the rest is installed here.
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import type { TalentTree } from "../defs";
import { proc } from "../relics/_util";
import { PK_FREE, ROT_SPIN, SHAPE_CIRCLE } from "../types";
import { byRank, node } from "./_node";

const SLASH_SOURCES = new Set(["petal_slash", "sakura_tempest"]);

/** Sacred Ground: shrine circle radius / duration / regen / damage per tick. */
const SHRINE_R = 70;
const SHRINE_T = 6;
const SHRINE_REGEN = 3;
const SHRINE_DMG = 20;

export const rinTree: TalentTree = {
  hero: "rin",
  branches: ["Way of the Blade", "Shrine Maiden", "Oni Hunter"],
  nodes: [
    // ---- Way of the Blade
    node("rin_honed_edge", "Honed Edge", 0, 1, 5, (r) => `+${3 * r}% might`, { mods: (s, r) => void (s.might += 0.03 * r) }),
    node("rin_wide_stance", "Wide Stance", 0, 2, 3, (r) => `Petal Slash area +${6 * r}%`),
    node("rin_quickdraw", "Quickdraw", 0, 3, 3, (r) => `-${3 * r}% cooldown`, { mods: (s, r) => void (s.cooldown -= 0.03 * r) }),
    node("rin_petal_storm", "Petal Storm", 0, 4, 3, (r) => `Each slash launches ${r} petal blade${r > 1 ? "s" : ""} at the nearest enemies (8 damage, homing)`),
    node("rin_crescent_draw", "Crescent Moon Draw", 0, 5, 1, () => "Every 3rd Petal Slash is a 360° moon slash (r 56, x1.5 damage)"),
    // ---- Shrine Maiden
    node("rin_purified_body", "Purified Body", 1, 1, 5, (r) => `+${5 * r} max HP`, { mods: (s, r) => void (s.maxHp += 5 * r) }),
    node("rin_ward_talisman", "Ward Talisman", 1, 2, 3, (r) => `-${2 * r}% damage taken`, { mods: (s, r) => void (s.dmgReduction += 0.02 * r) }),
    node("rin_shrine_blessing", "Shrine Blessing", 1, 3, 3, (r) => `+${(0.1 * r).toFixed(1)} HP/s regen`, { mods: (s, r) => void (s.regen += 0.1 * r) }),
    node("rin_exorcism", "Exorcism", 1, 4, 3, (r) => `Kills have a ${r}% chance to release an ofuda burst (r 32, 40 damage)`, {
      install: (w, r) => {
        const chance = 0.01 * r;
        w.hooks.on("kill", (k) => {
          if (k.boss || w.rng.next() >= chance) return;
          const y = k.y - k.enemy.cy;
          w.explode(k.x, y, 32 * w.stats.area, 40 * w.stats.might, null, 90, "rin_exorcism", C.red);
          proc(w, "rin_exorcism", k.x, y);
        });
      },
    }),
    node("rin_sacred_ground", "Sacred Ground", 1, 5, 1, () => "Thousand Blossom Cut leaves a shrine circle (r 70, 6 s): regenerate 3 HP/s inside; enemies inside take 20 damage every 0.5 s", {
      install: (w) => {
        let sx = 0;
        let sy = 0;
        let left = 0;
        w.hooks.on("ultEnd", (e) => {
          if (e.id !== "thousand_blossom_cut") return;
          const pl = w.player;
          sx = pl.x;
          sy = pl.y - CFG.playerCy;
          left = SHRINE_T;
          // the circle itself: a still, slowly spinning ward that ticks every enemy inside
          const p = w.spawnProjectile(null, "rin_sacred_ground");
          p.kind = PK_FREE;
          p.x = sx;
          p.y = sy;
          p.shape = SHAPE_CIRCLE;
          p.r = SHRINE_R;
          p.dmg = SHRINE_DMG * w.stats.might;
          p.knock = 0;
          p.pierce = Infinity;
          p.hitEvery = 0.5;
          p.life = SHRINE_T;
          p.sprite = "fx_ring_thick";
          p.scale = (SHRINE_R * 2) / 32;
          p.tint = C.red;
          p.alpha = 0.55;
          p.glow = true;
          p.rotMode = ROT_SPIN;
          p.spin = 0.4;
          p.pop = true;
          proc(w, "rin_sacred_ground", sx, sy);
        });
        w.hooks.on("step", (h) => {
          if (left <= 0) return;
          left -= h.dt;
          const pl = w.player;
          const dx = pl.x - sx;
          const dy = pl.y - CFG.playerCy - sy;
          if (dx * dx + dy * dy <= SHRINE_R * SHRINE_R && pl.hp < pl.maxHp && w.phase === "play") pl.hp = Math.min(pl.maxHp, pl.hp + SHRINE_REGEN * h.dt);
        });
      },
    }),
    // ---- Oni Hunter
    node("rin_red_eyes", "Red Eyes", 2, 1, 5, (r) => `+${r}% crit chance`, { mods: (s, r) => void (s.crit += 0.01 * r) }),
    node("rin_killing_intent", "Killing Intent", 2, 2, 3, (r) => `+${5 * r}% damage vs elites and bosses`, { mods: (s, r) => void (s.bossDmg += 0.05 * r) }),
    node("rin_battle_focus", "Battle Focus", 2, 3, 3, (r) => `+${5 * r}% crit damage`, { mods: (s, r) => void (s.critMult += 0.05 * r) }),
    node("rin_execution", "Execution", 2, 4, 3, (r) => `Petal Slash instantly kills non-boss enemies under ${byRank([10, 15, 20], r)}% HP`, {
      install: (w, r) => {
        const th = byRank([0.1, 0.15, 0.2], r);
        w.hooks.on("hit", (h) => {
          const e = h.enemy;
          if (e.dead || e.hp <= 0 || e.def.boss || e.def.prop || !SLASH_SOURCES.has(h.source) || e.hp > e.maxHp * th) return;
          w.killEnemy(e, h.owner, h.source);
        });
      },
    }),
    node("rin_ten_thousand", "Ten Thousand Blossoms", 2, 5, 1, () => "Thousand Blossom Cut carves 24 slash lines instead of 12, and the final burst hits twice (the second at 50%)"),
  ],
};

export const talentTrees: TalentTree[] = [rinTree];
