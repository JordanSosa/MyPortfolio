/**
 * Kuro - FORBIDDEN TECHNIQUE: ETERNAL ABYSS (docs/content/heroes.md §2.4).
 * The grade dims; from 0.2 s a colossal shadow sweeps across the screen left
 * -> right (it is the salamander drawn x10, the view's job): every enemy in
 * view takes a tick of 24 every 0.24 s (10 ticks = 240) and is slowed 70 %
 * while it lasts. 0.2 s after the shadow: the reveal - the real salamander and
 * a tiny flashlight pointed at it ("...it's a large shadow.").
 *
 * C4 = +3 ticks (the pass lasts longer). TRUE Forbidden Technique (talent
 * capstone) = the shadow sweeps twice (second pass right -> left, +10 ticks)
 * and the reveal is a stadium floodlight. Lingering Darkness (talent) =
 * enemies in view stay slowed 40 % for 2 / 3 / 4 s after it ends.
 * Each tick hits every enemy in view once (direct hits, source "eternal_abyss");
 * heroFx cues: kuro_shadow (x2 = direction, y2 = delay before the sweep, r =
 * pass seconds), kuro_reveal. Kills during it burst into black feathers (view).
 */
import { CFG } from "../config";
import type { UltimateDef } from "../types";
import type { World } from "../world";
import { HERO_TEXTS, HFX_KURO_REVEAL, HFX_KURO_SHADOW, HFX_TEXT, hfx, slowEnemy } from "../weapons/_heroes-a";

const START = 0.2;
const TICK = 0.24;
const DMG = 24;
const REVEAL_AFTER = 0.2;
const REVEAL_FOR = 0.8;
/** Deep abyss violet for the hit sparks (it is a shadow, after all). */
const SHADOW = 0x743fd1;

/** One tick: everything in view takes the hit and is held at 30 % speed until the shadow passes. */
function tick(w: World, dmg: number, until: number): void {
  const p = w.player;
  const hw = w.viewW * 0.5 + 8;
  const hh = w.viewH * 0.5 + 8;
  const items = w.enemies.items;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = items[i];
    if (e.dead || e.def.prop) continue;
    if (Math.abs(e.x - p.x) > hw || Math.abs(e.y - e.cy - (p.y - CFG.playerCy)) > hh) continue;
    w.hitEnemy(e, dmg, null, -Math.PI / 2, 0, 0, "eternal_abyss", SHADOW);
    slowEnemy(e, 0.3, until);
  }
}

export const eternalAbyss: UltimateDef = {
  id: "eternal_abyss",
  name: "FORBIDDEN TECHNIQUE: ETERNAL ABYSS",
  hero: "kuro",
  desc: "A colossal shadow sweeps the screen, hitting everything in view 10 times. It's a large shadow.",
  duration: START + 10 * TICK + REVEAL_AFTER + REVEAL_FOR,
  start(w, u) {
    const n = 10 + (w.cons >= 4 && w.hero.id === "kuro" ? 3 : 0);
    const passes = w.talentRank("kuro_true_forbidden") > 0 ? 2 : 1;
    const d = u.data;
    d.n = n;
    d.passes = passes;
    d.ticks = 0;
    d.pass = 0;
    d.reveal = 0;
    d.revealAt = START + passes * n * TICK + REVEAL_AFTER;
    u.dur = d.revealAt + REVEAL_FOR;
    const p = w.player;
    hfx(w, HFX_KURO_SHADOW, p.x, p.y, 1, START, n * TICK, 0);
  },
  update(w, u) {
    const d = u.data;
    const total = d.n * d.passes;
    const passLen = d.n * TICK;
    const p = w.player;
    while (d.ticks < total && u.t >= START + d.ticks * TICK) {
      // the second pass (TRUE Forbidden Technique) comes back right -> left
      const pass = Math.floor(d.ticks / d.n);
      if (pass > d.pass) {
        d.pass = pass;
        hfx(w, HFX_KURO_SHADOW, p.x, p.y, -1, 0, passLen, pass);
      }
      d.ticks++;
      const until = START + total * TICK - u.t + 0.1;
      tick(w, DMG * w.stats.might * u.power, until);
    }
    if (!d.reveal && u.t >= d.revealAt) {
      d.reveal = 1;
      hfx(w, HFX_KURO_REVEAL, p.x, p.y, p.x, p.y, REVEAL_FOR, d.passes > 1 ? 1 : 0);
      hfx(w, HFX_TEXT, p.x, p.y - 30, p.x, p.y, 1, HERO_TEXTS.indexOf("...it's a large shadow."));
    }
  },
  end(w) {
    // Lingering Darkness: everything in view stays slowed 40 % for 2 / 3 / 4 s
    const r = w.talentRank("kuro_lingering_darkness");
    if (r <= 0) return;
    const t = [2, 3, 4][Math.min(2, r - 1)];
    const p = w.player;
    const hw = w.viewW * 0.5 + 8;
    const hh = w.viewH * 0.5 + 8;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i];
      if (e.dead || Math.abs(e.x - p.x) > hw || Math.abs(e.y - p.y) > hh) continue;
      // (the ult's own 70 % slow is over: start fresh at 60 % speed)
      if (e.slowT > 0 && e.slow < 0.6) e.slowT = 0;
      slowEnemy(e, 0.6, t);
    }
  },
};

export const ultimates: UltimateDef[] = [eternalAbyss];
