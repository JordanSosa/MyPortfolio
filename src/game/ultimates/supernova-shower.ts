/**
 * Hoshi - Supernova Shower: 30 meteors rain across the view over 3 s in volleys
 * of three (so 6-9 are in the air at once), each exploding (r 32).
 *
 * Season 2 (docs/content/heroes.md): C4 +10 meteors; Supernova Supreme
 * (talent capstone) makes every meteor a guaranteed crit and the last 5 huge
 * (r 56, x1.5 damage); ENCORE! (talent capstone) calls heartEncore() 1.5 s
 * after the shower: 15 more meteors fall in a heart outline around Hoshi.
 */
import { C } from "../../art/palette";
import { CH_ULT } from "../config";
import { PK_FALL, type ProjHook, type UltimateDef } from "../types";
import type { World } from "../world";

const RADIUS = 32;
const HUGE = 56;
const HEIGHT = 210;
const FALL_SPEED = 300;
const COUNT = 30;
/** Meteors per volley; a shower always lands within SHOWER_S seconds. */
const VOLLEY = 3;
const SHOWER_S = 3;
const ENCORE_N = 15;
const ENCORE_R = 70;

/** Meteor landing: p.b = blast radius override (0 = RADIUS), p.a = crit bonus (Supernova Supreme). */
const land: ProjHook = (p, w) => {
  w.explode(p.x, p.y, p.b || RADIUS, p.dmg, null, 130, "supernova_shower", C.yellow, true, p.a);
};

/** One meteor falling onto (tx, ty) from height h. */
function meteor(w: World, tx: number, ty: number, h: number, dmg: number, huge: boolean, crit: number): void {
  const t = h / FALL_SPEED;
  const drift = 46;
  const p = w.spawnProjectile(null, "supernova_shower");
  p.ch = CH_ULT;
  p.kind = PK_FALL;
  p.x = tx + drift;
  p.y = ty;
  p.vx = -drift / t;
  p.vy = 0;
  p.z = h;
  p.vz = -FALL_SPEED;
  p.r = 0;
  p.life = 3;
  p.dmg = huge ? dmg * 1.5 : dmg;
  p.sprite = "ult_meteor";
  p.rot = Math.atan2(FALL_SPEED, -drift / t) - Math.PI / 2;
  p.glow = true;
  p.trail = "meteor";
  p.shadow = huge ? 22 : 14;
  p.telegraph = huge ? HUGE : RADIUS;
  if (huge) {
    p.scale = 1.6;
    p.b = HUGE;
  }
  p.a = crit;
  p.onEnd = land;
}

/** Meteor damage at the current Overdrive power. */
function meteorDmg(w: World, power: number): number {
  return 55 * w.stats.might * power;
}

/**
 * ENCORE!: 15 meteors fall in a heart outline (r 70) around Hoshi, in order
 * around the outline (Hoshi's ENCORE! talent; emits `ultEncore` for the banner).
 */
export function heartEncore(w: World): void {
  const pl = w.player;
  const power = (1 + (w.level - 1) * 0.06) * w.stats.ultPower;
  const crit = w.talentRank("hoshi_supernova_supreme") > 0 ? 1 : 0;
  for (let i = 0; i < ENCORE_N; i++) {
    const t = (i / ENCORE_N) * Math.PI * 2;
    const s = Math.sin(t);
    // the classic heart curve, normalised to ~[-1, 1] and scaled to r 70
    const hx = (16 * s * s * s) / 16;
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
    meteor(w, pl.x + hx * ENCORE_R, pl.y - 8 + hy * ENCORE_R, HEIGHT + i * 14, meteorDmg(w, power), false, crit);
  }
  w.emit("ultEncore", { ult: "supernova_shower", x: pl.x, y: pl.y });
}

export const supernovaShower: UltimateDef = {
  id: "supernova_shower",
  name: "Supernova Shower",
  hero: "hoshi",
  desc: "30 meteors rain across the screen in volleys, each exploding on impact.",
  duration: 3.7,
  start(w, u) {
    u.data.n = 0;
    u.data.acc = 1;
    u.data.count = COUNT + (w.cons >= 4 && w.hero.id === "hoshi" ? 10 : 0);
    u.data.supreme = w.talentRank("hoshi_supernova_supreme") > 0 ? 1 : 0;
  },
  update(w, u, dt) {
    const d = u.data;
    if (u.t > SHOWER_S) return;
    const count = d.count;
    d.acc += (count / (VOLLEY * SHOWER_S)) * dt;
    const pl = w.player;
    while (d.acc >= 1 && d.n < count) {
      d.acc -= 1;
      for (let k = 0; k < VOLLEY && d.n < count; k++) {
        d.n++;
        // aim most meteors at enemies, the rest anywhere on screen (a volley spreads over the view)
        let tx = pl.x + (w.rng.next() - 0.5) * w.viewW * 0.9;
        let ty = pl.y + (w.rng.next() - 0.5) * w.viewH * 0.85;
        if (w.rng.next() < 0.65) {
          const e = w.randomEnemyInView(-6);
          if (e) {
            tx = e.x + w.rng.spread(6);
            ty = e.y + w.rng.spread(4);
          }
        }
        // (staggered heights inside a volley: they land in a quick ba-da-boom, not all at once)
        const huge = d.supreme > 0 && d.n > count - 5;
        meteor(w, tx, ty, HEIGHT + k * 26, meteorDmg(w, u.power), huge, d.supreme);
      }
    }
  },
};

export const ultimates: UltimateDef[] = [supernovaShower];
