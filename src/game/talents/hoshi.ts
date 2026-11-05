/**
 * HOSHI's talent tree, literally as docs/content/heroes.md §3: "Idol Arc" /
 * "Plot Armor" / "Star Power". Tiers 1-4 hold 5 / 3 / 3 / 3 ranks, tier 5 is
 * the capstone (defs.ts TALENT_TIER_POINTS). Weapon / ult parts are read by
 * the weapon and ult code through w.talentRank(id): Fan Chant's pierce and
 * Backup Dancers in weapons/star-shot.ts, Supernova Supreme in
 * ultimates/supernova-shower.ts.
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import type { TalentTree } from "../defs";
import { proc } from "../relics/_util";
import { heartEncore } from "../ultimates/supernova-shower";
import { PK_MANAGED, ROT_SPIN, type Projectile } from "../types";
import { miniStar, starInst } from "../weapons/star-shot";
import type { World } from "../world";
import { Budget, byRank, node } from "./_node";

const STAR_SOURCES = new Set(["star_shot", "galaxy_barrage"]);

/** Guardian Stars: two orbiting stars that block enemy bullets and fire back. */
function installGuardians(w: World): void {
  const orb: (Projectile | null)[] = [null, null];
  const uid = [0, 0];
  const cd = [0, 0];
  let ang = 0;
  w.hooks.on("step", (h) => {
    if (w.phase !== "play") return;
    ang += 3 * h.dt;
    const pl = w.player;
    const owner = starInst(w);
    for (let i = 0; i < 2; i++) {
      let q = orb[i];
      if (!q || q.dead || q.uid !== uid[i]) {
        q = w.spawnProjectile(owner, "hoshi_guardian_stars");
        q.kind = PK_MANAGED;
        q.r = 5;
        q.pierce = Infinity;
        q.hitEvery = 0.5;
        q.knock = 30;
        q.life = Infinity;
        q.sprite = "w_star";
        q.rotMode = ROT_SPIN;
        q.spin = 9;
        q.glow = true;
        q.pop = true;
        orb[i] = q;
        uid[i] = q.uid;
      }
      q.dmg = 10 * w.stats.might;
      const a = ang + i * Math.PI;
      q.x = pl.x + Math.cos(a) * 20;
      q.y = pl.y - CFG.playerCy + Math.sin(a) * 20 * 0.85;
      cd[i] -= h.dt;
      // block enemy bullets it touches; fire a star back the way the bullet came (once per 0.5 s per orbiter)
      const bl = w.bullets;
      for (let k = 0; k < bl.count; k++) {
        const b = bl.items[k];
        if (b.dead) continue;
        const dx = b.x - q.x;
        const dy = b.y - q.y;
        const rr = b.r + 5;
        if (dx * dx + dy * dy > rr * rr) continue;
        b.dead = true;
        if (cd[i] > 0) continue;
        cd[i] = 0.5;
        const back = Math.atan2(-b.vy, -b.vx);
        const tgt = w.nearestEnemy(q.x + Math.cos(back) * 80, q.y + Math.sin(back) * 80, 100);
        miniStar(w, owner, "hoshi_guardian_stars", q.x, q.y, back, 14 * w.stats.might, tgt, 0.9);
        proc(w, "hoshi_guardian_stars", q.x, q.y);
      }
    }
  });
}

export const hoshiTree: TalentTree = {
  hero: "hoshi",
  branches: ["Idol Arc", "Plot Armor", "Star Power"],
  nodes: [
    // ---- Idol Arc
    node("hoshi_choreography", "Choreography", 0, 1, 5, (r) => `+${4 * r}% projectile speed`, { mods: (s, r) => void (s.projSpeed += 0.04 * r) }),
    node("hoshi_fan_chant", "Fan Chant", 0, 2, 3, (r) => `Star Shot +${6 * r}% damage${r >= 3 ? ", stars pierce +1" : " (rank 3: stars pierce +1)"}`, {
      install: (w, r) => w.addWeaponDamage("star_shot", 0.06 * r),
    }),
    node("hoshi_spotlight", "Spotlight", 0, 3, 3, (r) => `-${3 * r}% cooldown`, { mods: (s, r) => void (s.cooldown -= 0.03 * r) }),
    node("hoshi_backup_dancers", "Backup Dancers", 0, 4, 3, (r) => `Star Shot fires +${r} star${r > 1 ? "s" : ""}`),
    node("hoshi_encore", "ENCORE!", 0, 5, 1, () => "1.5 s after Supernova Shower ends, an Encore: 15 more meteors fall in a heart around Hoshi", {
      install: (w) =>
        void w.hooks.on("ultEnd", (e) => {
          if (e.id === "supernova_shower") w.after(1.5, heartEncore);
        }),
    }),
    // ---- Plot Armor
    node("hoshi_main_character_hp", "Main Character Durability", 1, 1, 5, (r) => `+${5 * r} max HP`, { mods: (s, r) => void (s.maxHp += 5 * r) }),
    node("hoshi_convenient_shield", "Convenient Shield", 1, 2, 3, (r) => `+1 shield charge, recharging every ${byRank([30, 25, 20], r)} s`, {
      mods: (s, r) => {
        s.shield += 1;
        s.shieldCd = byRank([30, 25, 20], r);
      },
    }),
    node("hoshi_determination", "Sheer Determination", 1, 3, 3, (r) => `-${3 * r}% damage taken`, { mods: (s, r) => void (s.dmgReduction += 0.03 * r) }),
    node(
      "hoshi_dramatic_recovery",
      "Dramatic Recovery",
      1,
      4,
      3,
      (r) => `When a shield breaks: heal ${byRank([3, 5, 7], r)}% max HP and release a star ring (${byRank([30, 45, 60], r)} damage)`,
      {
        install: (w, r) =>
          void w.hooks.on("block", (b) => {
            w.heal(w.player.maxHp * byRank([0.03, 0.05, 0.07], r));
            w.explode(b.x, b.y - CFG.playerCy, 40 * w.stats.area, byRank([30, 45, 60], r) * w.stats.might, null, 120, "hoshi_dramatic_recovery", C.yellow);
            proc(w, "hoshi_dramatic_recovery", b.x, b.y - CFG.playerCy);
          }),
      },
    ),
    node("hoshi_guardian_stars", "Guardian Stars", 1, 5, 1, () => "2 stars orbit Hoshi: each blocks enemy bullets it touches and fires a star back at the shooter", {
      install: installGuardians,
    }),
    // ---- Star Power
    node("hoshi_twinkle", "Twinkle", 2, 1, 5, (r) => `+${r}% crit chance`, { mods: (s, r) => void (s.crit += 0.01 * r) }),
    node("hoshi_shooting_star", "Shooting Star", 2, 2, 3, (r) => `+${10 * r}% crit damage`, { mods: (s, r) => void (s.critMult += 0.1 * r) }),
    node("hoshi_wish_upon", "Wish Upon a Star", 2, 3, 3, (r) => `+${3 * r}% might`, { mods: (s, r) => void (s.might += 0.03 * r) }),
    node("hoshi_falling_star", "Falling Star", 2, 4, 3, (r) => `Star Shot crits split into 2 homing mini-stars (${byRank([30, 40, 50], r)}% damage)`, {
      install: (w, r) => {
        const frac = byRank([0.3, 0.4, 0.5], r);
        const budget = new Budget(16);
        w.hooks.on("hit", (h) => {
          if (!h.crit || !STAR_SOURCES.has(h.source) || !budget.take(w)) return;
          const e = h.enemy;
          const dmg = (h.dmg / Math.max(1, w.stats.critMult)) * frac;
          const a0 = w.rng.angle();
          for (let k = 0; k < 2; k++) miniStar(w, h.owner, "hoshi_falling_star", e.x, e.y - e.cy, a0 + k * Math.PI, dmg, null, 0.55);
        });
      },
    }),
    node("hoshi_supernova_supreme", "Supernova Supreme", 2, 5, 1, () => "Every Supernova meteor is a guaranteed crit and the last 5 are huge (r 56, x1.5 damage)"),
  ],
};

export const talentTrees: TalentTree[] = [hoshiTree];
