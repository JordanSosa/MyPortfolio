/** Hoshi - Supernova Shower: 30 meteors rain across the view over 3 s, each exploding (r 32). */
import { C } from "../../art/palette";
import { CH_ULT } from "../config";
import { PK_FALL, type ProjHook, type UltimateDef } from "../types";

const RADIUS = 32;
const HEIGHT = 170;
const FALL_SPEED = 300;

const land: ProjHook = (p, w) => {
  w.explode(p.x, p.y, RADIUS, p.dmg, null, 130, "supernova_shower", C.yellow, true);
};

export const supernovaShower: UltimateDef = {
  id: "supernova_shower",
  name: "Supernova Shower",
  hero: "hoshi",
  desc: "30 meteors rain across the screen, each exploding on impact.",
  duration: 3.6,
  start(_w, u) {
    u.data.n = 0;
    u.data.acc = 0;
  },
  update(w, u, dt) {
    const d = u.data;
    if (u.t > 3) return;
    d.acc += 10 * dt;
    const pl = w.player;
    while (d.acc >= 1 && d.n < 30) {
      d.acc -= 1;
      d.n++;
      // aim most meteors at enemies, the rest anywhere on screen
      let tx = pl.x + (w.rng.next() - 0.5) * w.viewW * 0.9;
      let ty = pl.y + (w.rng.next() - 0.5) * w.viewH * 0.85;
      if (w.rng.next() < 0.65) {
        const e = w.randomEnemyInView(-6);
        if (e) {
          tx = e.x + w.rng.spread(6);
          ty = e.y + w.rng.spread(4);
        }
      }
      const t = HEIGHT / FALL_SPEED;
      const drift = 46;
      const p = w.spawnProjectile(null, "supernova_shower");
      p.ch = CH_ULT;
      p.kind = PK_FALL;
      p.x = tx + drift;
      p.y = ty;
      p.vx = -drift / t;
      p.vy = 0;
      p.z = HEIGHT;
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
  },
};

export const ultimates: UltimateDef[] = [supernovaShower];
