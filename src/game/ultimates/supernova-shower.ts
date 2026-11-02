/**
 * Hoshi - Supernova Shower: 30 meteors rain across the view over 3 s in volleys
 * of three (so 6-9 are in the air at once), each exploding (r 32).
 */
import { C } from "../../art/palette";
import { CH_ULT } from "../config";
import { PK_FALL, type ProjHook, type UltimateDef } from "../types";

const RADIUS = 32;
const HEIGHT = 210;
const FALL_SPEED = 300;
const COUNT = 30;
/** Meteors per volley and volleys per second (COUNT over ~3 s). */
const VOLLEY = 3;
const VOLLEYS_PER_S = 10 / VOLLEY;

const land: ProjHook = (p, w) => {
  w.explode(p.x, p.y, RADIUS, p.dmg, null, 130, "supernova_shower", C.yellow, true);
};

export const supernovaShower: UltimateDef = {
  id: "supernova_shower",
  name: "Supernova Shower",
  hero: "hoshi",
  desc: "30 meteors rain across the screen in volleys, each exploding on impact.",
  duration: 3.7,
  start(_w, u) {
    u.data.n = 0;
    u.data.acc = 1;
  },
  update(w, u, dt) {
    const d = u.data;
    if (u.t > 3) return;
    d.acc += VOLLEYS_PER_S * dt;
    const pl = w.player;
    while (d.acc >= 1 && d.n < COUNT) {
      d.acc -= 1;
      for (let k = 0; k < VOLLEY && d.n < COUNT; k++) {
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
        const h = HEIGHT + k * 26;
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
        p.dmg = 55 * w.stats.might * u.power;
        p.sprite = "ult_meteor";
        p.rot = Math.atan2(FALL_SPEED, -drift / t) - Math.PI / 2;
        p.glow = true;
        p.trail = "meteor";
        p.shadow = 14;
        p.telegraph = RADIUS;
        p.onEnd = land;
      }
    }
  },
};

export const ultimates: UltimateDef[] = [supernovaShower];
