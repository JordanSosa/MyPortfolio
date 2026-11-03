/**
 * Magical Girl #47 - EPISODE-LONG TRANSFORMATION SEQUENCE (docs/content/heroes.md
 * §2.9, 6.0 s, the longest ult): 16 ribbons spin around her the whole time
 * while she turns slowly in her cast pose (view), and the transformation goes
 * through five stages at 1 / 2 / 3 / 4 / 5 s: radial bursts of r 40 / 60 / 80 /
 * 110 / the whole view for 90 / 90 / 90 / 90 / 180 damage, knockback 100, a
 * henshin flash and a caption (RIBBONS! / SPARKLES! / SHOES! / MORE RIBBONS! /
 * TRANSFORMED!). The narrator (view): "This transformation has been running for
 * four minutes."
 *
 * C4: stages +30 % damage. Finally Has a Name! (talent capstone): the whole
 * thing takes 4 s instead of 6 (stages at 0.6 s steps) with +50 % damage (the
 * cut-in subtitle changes in the UI). Episode 47 (Special) (talent capstone):
 * afterwards 6 s of +40 % might and +20 % move speed.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { CFG, CH_ULT } from "../config";
import { Buff } from "../hooks";
import { PK_MANAGED, ROT_SPIN, type ProjHook, type UltimateDef } from "../types";
import type { World } from "../world";
import { HB, hfx } from "../weapons/_hb";

const ID = "episode_long_transformation";
const RADII = [40, 60, 80, 110, 0];
const DMG = [90, 90, 90, 90, 180];
const RIBBONS = 16;
const DURATION = 6;
const NAMED_DURATION = 4;

/** Ribbon orbit: p.a = slot (0..15), two rings turning opposite ways, breathing in and out. */
const orbit: ProjHook = (p, w) => {
  const pl = w.player;
  const inner = p.a < RIBBONS / 2;
  const k = inner ? p.a : p.a - RIBBONS / 2;
  const n = RIBBONS / 2;
  const dir = inner ? 1 : -1;
  const a = dir * p.age * (inner ? 3.2 : 2.1) + (k / n) * TAU;
  const R = (inner ? 20 : 32) + 4 * Math.sin(p.age * 4 + k);
  p.x = pl.x + Math.cos(a) * R;
  p.y = pl.y - CFG.playerCy + Math.sin(a) * R * 0.6;
};

/** The "Episode 47 (Special)" buff (one per world). */
const specials = new WeakMap<World, Buff>();
function special(w: World): Buff {
  let b = specials.get(w);
  if (!b) {
    const buff = new Buff(w);
    b = buff;
    specials.set(w, buff);
    w.statMods.push((s) => {
      if (buff.on) {
        s.might += 0.4;
        s.moveSpeed += 0.2;
      }
    });
  }
  return b;
}

export const episodeLongTransformation: UltimateDef = {
  id: ID,
  name: "EPISODE-LONG TRANSFORMATION SEQUENCE",
  hero: "magical_girl_47",
  desc: "A transformation sequence that takes the whole episode: five escalating henshin bursts, the last one hits everything in view.",
  duration: DURATION,
  start(w, u) {
    const named = w.talentRank("mg47_has_a_name") > 0;
    u.data.stage = 0;
    u.data.step = named ? 0.6 : 1;
    u.data.len = named ? NAMED_DURATION : DURATION;
    u.dur = u.data.len;
    u.data.mul = (named ? 1.5 : 1) * (w.cons >= 4 && w.hero.id === "magical_girl_47" ? 1.3 : 1);
    if (w.talentRank("mg47_special_episode") > 0) special(w);
    for (let i = 0; i < RIBBONS; i++) {
      const p = w.spawnProjectile(null, ID);
      p.ch = CH_ULT;
      p.kind = PK_MANAGED;
      p.r = 0;
      p.a = i;
      p.life = u.data.len;
      p.sprite = i % 3 === 0 ? "w_ribbon_evo" : "w_ribbon";
      p.fps = 8;
      p.rotMode = ROT_SPIN;
      p.spin = i % 2 ? 7 : -7;
      p.scale = 1.2;
      p.glow = true;
      p.pop = true;
      p.update = orbit;
      orbit(p, w, 0);
    }
    const pl = w.player;
    hfx(w, HB.TRANSFORM, pl.x, pl.y, pl.x, pl.y, u.data.len, named ? 1 : 0);
  },
  update(w, u) {
    const d = u.data;
    const pl = w.player;
    while (d.stage < RADII.length && u.t >= (d.stage + 1) * d.step) {
      const k = d.stage;
      const dmg = DMG[k] * w.stats.might * u.power * d.mul;
      const cx = pl.x;
      const cy = pl.y - CFG.playerCy;
      if (RADII[k] > 0) {
        const R = RADII[k];
        const buf = w.acquire();
        const n = w.grid.query(cx, cy, R + 12, buf);
        const items = w.enemies.items;
        for (let j = 0; j < n; j++) {
          const e = items[buf[j]];
          if (!e || e.dead) continue;
          const dx = e.x - cx;
          const dy = e.y - e.cy - cy;
          const rr = R + e.r;
          if (dx * dx + dy * dy > rr * rr) continue;
          e.lastHit[CH_ULT] = w.t;
          w.hitEnemy(e, dmg, null, Math.atan2(dy, dx), 100, 0, ID, C.mint);
        }
        w.release();
        hfx(w, HB.STAGE, cx, cy, pl.x, pl.y, R, k);
      } else {
        w.hitAllInView(dmg, dmg, 100, ID, C.mint, CH_ULT);
        hfx(w, HB.STAGE, cx, cy, pl.x, pl.y, 0, k);
      }
      d.stage++;
    }
  },
  end(w) {
    if (w.talentRank("mg47_special_episode") > 0) special(w).start(6);
  },
};

export const ultimates: UltimateDef[] = [episodeLongTransformation];
