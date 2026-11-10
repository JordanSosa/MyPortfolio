/**
 * Akane - IT'S NOT LIKE I LIKE YOU!! BARRAGE (docs/content/heroes.md §2.7).
 * 36 harisen smacks, one every 0.08 s from 0.1 s: each picks a random enemy
 * in view (a boss at most every 4th smack) and smacks it with a big fan swing
 * (scale 1.5, random rotation): 70 damage, knockback 260, dazed 0.3 s, and a
 * BAKA! pop (at most one per 0.25 s, never over the hero). 3.0 s: the final
 * smack, a 360° ring r 90 around Akane - 150 damage, knockback 400, a 2x
 * BAKA!. 3.2 s: her shouting portrait slides back in: "...h-hmph." (view).
 *
 * C4 = +12 smacks (squeezed into the same 2.8 s); Dere Mode (talent capstone)
 * = the barrage ends with a heart explosion (r 120, 300 damage) and heals 25 %
 * max HP.
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import { PK_MANAGED, type Enemy, type UltimateDef } from "../types";
import type { World } from "../world";
import { HFX_AKANE_BARRAGE, HFX_AKANE_HEART, HFX_AKANE_HMPH, HFX_AKANE_RING, daze, heroesA, hfx } from "../weapons/_heroes-a";

const ID = "not_like_i_like_you";
const FIRST = 0.1;
const SPAN = 2.8;
const SMACK_DMG = 70;
const FINAL_AT = 3.0;
const FINAL_R = 90;
const FINAL_DMG = 150;
const HEART_AT = 3.12;
const HEART_R = 120;
const HEART_DMG = 300;
const HMPH_AT = 3.2;

/** Everything within R of the hero: damage + knockback (+ daze). */
function burst(w: World, R: number, dmg: number, knock: number, color: number): void {
  const p = w.player;
  const cy = p.y - CFG.playerCy;
  const buf = w.acquire();
  const n = w.grid.query(p.x, cy, R + 16, buf);
  for (let k = 0; k < n; k++) {
    const e = w.enemies.items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - e.cy - cy;
    const rr = R + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    w.hitEnemy(e, dmg, null, Math.atan2(dy, dx), knock, 0, ID, color);
    if (!e.dead) daze(e, 0.3);
  }
  w.release();
}

/** A random enemy in view; a boss only when `bossOk` (a few retries, then whoever it is). */
function pick(w: World, bossOk: boolean): Enemy | null {
  let e = w.randomEnemyInView(-6);
  for (let i = 0; i < 4 && e && e.def.boss && !bossOk; i++) e = w.randomEnemyInView(-6);
  if (e && e.def.boss && !bossOk) return null;
  return e;
}

/** The fan swing sprite on a target point (visual only). */
function swing(w: World, x: number, y: number, rot: number): void {
  const p = w.spawnProjectile(null, ID);
  p.kind = PK_MANAGED;
  p.r = 0;
  p.x = x;
  p.y = y;
  p.rot = rot;
  p.sprite = "w_harisen";
  p.anim = 1;
  p.life = 0.2;
  p.scale = 1.5;
  p.pierce = Infinity;
}

export const notLikeILikeYou: UltimateDef = {
  id: ID,
  name: "IT'S NOT LIKE I LIKE YOU!! BARRAGE",
  hero: "akane",
  desc: "36 harisen smacks on random enemies (BAKA! BAKA! BAKA!), then a final 360° smack.",
  duration: 3.4,
  start(w, u) {
    const n = 36 + (w.cons >= 4 && w.hero.id === "akane" ? 12 : 0);
    const d = u.data;
    d.n = n;
    d.every = SPAN / (n - 1);
    d.i = 0;
    d.lastBoss = -10;
    d.fin = 0;
    d.heart = w.talentRank("akane_dere_mode") > 0 ? 1 : 0;
    d.hmph = 0;
  },
  update(w, u) {
    const d = u.data;
    const st = heroesA(w);
    const pl = w.player;
    while (d.i < d.n && u.t >= FIRST + d.i * d.every) {
      const i = d.i++;
      const e = pick(w, i - d.lastBoss >= 4);
      const rot = w.rng.spread(Math.PI);
      if (!e) {
        // nobody (allowed) to smack: she smacks the air near her anyway
        const a = w.rng.angle();
        swing(w, pl.x + Math.cos(a) * 30, pl.y - CFG.playerCy + Math.sin(a) * 24, rot);
        continue;
      }
      if (e.def.boss) d.lastBoss = i;
      const x = e.x;
      const y = e.y - e.cy;
      swing(w, x, y, rot);
      hfx(w, HFX_AKANE_BARRAGE, x, y, rot, 0, 1.5, i);
      const a = Math.atan2(y - (pl.y - CFG.playerCy), x - pl.x);
      w.hitEnemy(e, SMACK_DMG * w.stats.might * u.power, null, a, 260, 0, ID, C.red);
      if (!e.dead) daze(e, 0.3);
      st.bakaUltPop(x, y - 12);
    }
    if (!d.fin && u.t >= FINAL_AT) {
      d.fin = 1;
      burst(w, FINAL_R, FINAL_DMG * w.stats.might * u.power, 400, C.red);
      hfx(w, HFX_AKANE_RING, pl.x, pl.y - CFG.playerCy, pl.x, pl.y, FINAL_R, 2);
      // the big one always pops (2x)
      st.bakaUltAt = -1e9;
      st.bakaUltPop(pl.x + pl.face * 40, pl.y - 34, 2);
    }
    if (d.heart === 1 && u.t >= HEART_AT) {
      d.heart = 2;
      burst(w, HEART_R, HEART_DMG * w.stats.might * u.power, 300, C.hotPink);
      w.heal(pl.maxHp * 0.25);
      hfx(w, HFX_AKANE_HEART, pl.x, pl.y - CFG.playerCy, pl.x, pl.y, HEART_R);
    }
    if (!d.hmph && u.t >= HMPH_AT) {
      d.hmph = 1;
      hfx(w, HFX_AKANE_HMPH, pl.x, pl.y);
    }
  },
};

export const ultimates: UltimateDef[] = [notLikeILikeYou];
