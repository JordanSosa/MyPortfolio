/**
 * STUDENT COUNCIL PRESIDENT (Shoujo Academy 7:00 mid boss, enemies.md §5.3).
 * Name card: STUDENT COUNCIL PRESIDENT - Supreme Authority of Room 2-B (and Every Other Room).
 *
 * P1 (100-50 %), cycle: Motion Denied -> Glasses Glint -> Hall Monitor Summon
 *   Motion Denied   3 aimed fans of 5 eb_stamp ("DENIED", 75 px/s, 14 dmg)
 *   Glasses Glint   the glasses flash (frame 2); 3 lines in a 40 deg fan are telegraphed
 *                   for 0.8 s, then glare beams run along them for 0.4 s (20 dmg within 6 px)
 *   Summon          a whistle; 6 Hall Monitors encircle the player at r 90
 *   School Regulation (its own clock): every 20 s a rule card drops in under the timer for
 *                   10 s - random, never the same twice in a row:
 *     RULE 7  NO RUNNING IN THE HALLS   each dash costs 8 HP ("-8 DETENTION")
 *     RULE 12 NO LOITERING              standing still > 1 s: 6 damage every 0.5 s
 *     RULE 3  UNIFORM CHECK             all enemies +20 % speed
 *     RULE 21 SILENCE IN THE LIBRARY    enemy bullets -20 % speed (her one kind rule)
 * P2 (< 50 %) "EMERGENCY ASSEMBLY" - attendance is mandatory: Motion Denied fires rings of
 *   18 stamps, rules every 14 s, she summons 4 Student Council Ninjas instead of monitors.
 * P3 (< 20 %) "COUNCIL DISSOLVED?!" - she did not see this coming: the glasses crack (frame 5);
 *   5 glare beams rotating at 0.8 rad/s, stamps in a 2-arm spiral.
 * Death line (view): "This... will go on your... permanent record..."
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { aimAt, fan, ring, shoot } from "../enemies/_bullets";
import { EFX_CAST, EFX_ROAR, EFX_SUMMON, efx, shock } from "../enemies/_fx";
import { cue } from "../enemies/_cue";
import { say } from "../enemies/_say";
import { bossVisible, glide, hoverAnchor, OFF_WARP, offClock, segDist, TAU, warpTo } from "./_s23";

export const CP_ENTER = 0;
export const CP_WALK = 1;
export const CP_DENIED = 2;
export const CP_GLINT = 3;
export const CP_GLARE = 4;
export const CP_SUMMON = 5;
export const CP_SPIRAL = 6;
export const CP_SWEEP_TELE = 7;
export const CP_SWEEP = 8;
export const CP_FLOURISH = 9;

const P_DENIED = 0;
const P_GLINT = 1;
const P_SUMMON = 2;
const P_SPIRAL = 3;
const P_SWEEP = 4;
const CYCLES: readonly (readonly number[])[] = [
  [],
  [P_DENIED, P_GLINT, P_SUMMON],
  [P_DENIED, P_GLINT, P_SUMMON],
  [P_SPIRAL, P_SWEEP, P_DENIED, P_SWEEP],
];

export const CP_P2 = 0.5;
export const CP_P3 = 0.2;
const STAMP = 14;
const GLARE_DMG = 20;
/** Beam hit half width (px from the line to the player's feet). */
export const GLARE_W = 6;
export const GLARE_LEN = 260;
export const GLINT_TELE = 0.8;
export const GLARE_T = 0.4;
const GLINT_SPREAD = (20 * Math.PI) / 180;
export const SWEEP_N = 5;
export const SWEEP_LEN = 150;
export const SWEEP_TELE = 1.0;
export const SWEEP_T = 3.2;
const SWEEP_SPEED = 0.8;
const FLOURISH = 1.8;
/** Sprite height (the head must clear the top HUD). */
const SPRITE_H = 56;
/** School Regulation: rule ids, timings. */
export const RULES: readonly number[] = [7, 12, 3, 21];
export const RULE_TITLES: Readonly<Record<number, string>> = {
  7: "RULE 7: NO RUNNING IN THE HALLS",
  12: "RULE 12: NO LOITERING",
  3: "RULE 3: UNIFORM CHECK",
  21: "RULE 21: SILENCE IN THE LIBRARY",
};
export const RULE_ON = 10;
const RULE_EVERY = 20;
const RULE_EVERY_P2 = 14;
const DETENTION = 8;
const LOITER_DMG = 6;

/** Shoujo Academy cue kinds of the President (src/view/academy-fx.ts). */
export const SA_STAMP = "academy_stamp";
export const SA_GLINT = "academy_glint";
export const SA_RULE = "academy_rule";
export const SA_DETENTION = "academy_detention";
export const SA_CRACK = "academy_crack";

export interface PresidentState {
  phase: number;
  pat: number;
  n: number;
  /** Glare / sweep base angle (from her feet) and its spin. */
  aim: number;
  spin: number;
  /** Beam origin (her feet when the glint started). */
  ox: number;
  oy: number;
  /** School Regulation: the active rule (0 = none), seconds left, seconds to the next card, last rule. */
  rule: number;
  ruleT: number;
  ruleNext: number;
  lastRule: number;
  /** Rule 12: seconds standing still, damage tick clock. */
  still: number;
  tick: number;
  /** Seconds since the last glare / sweep damage check hit (re-hit pacing). */
  beamHitAt: number;
  /** Seconds off screen (warp back between patterns). */
  off: number;
}

const STATE = new WeakMap<Enemy, PresidentState>();
/** The live President per world (the rule hooks read her state) and the worlds whose rule hooks are in. */
const LIVE = new WeakMap<World, Enemy>();
const INSTALLED = new WeakSet<World>();

export function presidentState(e: Enemy): PresidentState | undefined {
  return STATE.get(e);
}

/** The rule in force in this world right now (0 = none) - view: the rule card. */
export function activeRule(w: World): { rule: number; t: number } | null {
  const e = LIVE.get(w);
  if (!e || e.dead) return null;
  const s = STATE.get(e);
  return s && s.rule ? { rule: s.rule, t: s.ruleT } : null;
}

function st(e: Enemy): PresidentState {
  let s = STATE.get(e);
  if (!s) {
    s = { phase: 1, pat: 0, n: 0, aim: 0, spin: 1, ox: 0, oy: 0, rule: 0, ruleT: 0, ruleNext: RULE_EVERY, lastRule: 0, still: 0, tick: 0, beamHitAt: -9, off: 0 };
    STATE.set(e, s);
  }
  return s;
}

function ruleOf(w: World): number {
  const e = LIVE.get(w);
  if (!e || e.dead) return 0;
  return STATE.get(e)?.rule ?? 0;
}

/** The rule effects that need the whole step (installed once per world). */
function installRules(w: World): void {
  w.hooks.on("dash", () => {
    if (ruleOf(w) !== 7 || w.phase !== "play" || w.god) return;
    // RULE 7: detention costs HP (never lethal: it is a fine, not an attack)
    const p = w.player;
    const d = Math.min(DETENTION, Math.max(0, Math.ceil(p.hp) - 1));
    if (d <= 0) return;
    p.hp -= d;
    w.damageTaken += d;
    cue(w, SA_DETENTION, p.x, p.y - 24, 0, 0, d);
  });
  w.hooks.on("step", (h) => {
    const r = ruleOf(w);
    if (r === 3) {
      // RULE 3: everybody walks 20 % faster (on top of this step's own movement)
      const items = w.enemies.items;
      const f = 0.2 * h.dt;
      for (let i = 0; i < w.enemies.count; i++) {
        const o = items[i];
        if (o.dead || o.def.boss || o.def.prop || o.stun > 0 || w.freezeT > 0) continue;
        o.x += o.vx * o.slow * f;
        o.y += o.vy * o.slow * f;
      }
    } else if (r === 21) {
      // RULE 21: every enemy bullet flies 20 % slower
      const items = w.bullets.items;
      const f = 0.2 * h.dt;
      if (w.freezeT > 0 || w.timeStop) return;
      for (let i = 0; i < w.bullets.count; i++) {
        const b = items[i];
        if (b.dead) continue;
        b.x -= b.vx * f;
        b.y -= b.vy * f;
      }
    }
  });
}

function go(e: Enemy, state: number): void {
  e.state = state;
  e.timer = 0;
}

export function presidentEyeY(e: Enemy): number {
  return e.y - 44;
}

const tmp = { x: 0, y: 0 };

function keepPost(e: Enemy, w: World, k: number): void {
  hoverAnchor(e, w, 92, 30, SPRITE_H, tmp);
  glide(e, tmp.x, tmp.y, e.speed * k);
}

function nextPattern(e: Enemy, w: World, s: PresidentState): void {
  const cyc = CYCLES[s.phase];
  const p = cyc[s.pat % cyc.length];
  s.pat++;
  s.n = 0;
  const pl = w.player;
  switch (p) {
    case P_DENIED:
      go(e, CP_DENIED);
      break;
    case P_GLINT: {
      go(e, CP_GLINT);
      s.ox = e.x;
      s.oy = e.y;
      s.aim = Math.atan2(pl.y - e.y, pl.x - e.x);
      for (let i = -1; i <= 1; i++) {
        const a = s.aim + i * GLINT_SPREAD;
        w.telegraphLine(s.ox, s.oy, s.ox + Math.cos(a) * GLARE_LEN, s.oy + Math.sin(a) * GLARE_LEN, GLARE_W, GLINT_TELE, 0xbafff6);
      }
      cue(w, SA_GLINT, e.x + 4 * e.face, presidentEyeY(e), 0, 0, GLINT_TELE, 0, e);
      break;
    }
    case P_SUMMON:
      go(e, CP_SUMMON);
      cue(w, "academy_whistle", e.x, presidentEyeY(e) + 6, 0, 0, 1.3, 1, e);
      break;
    case P_SPIRAL:
      go(e, CP_SPIRAL);
      s.aim = w.rng.angle();
      s.spin = w.rng.next() < 0.5 ? 1 : -1;
      efx(w, EFX_CAST, e.x, e.y - 30, 0, 0, 1.4, e);
      break;
    default: {
      go(e, CP_SWEEP_TELE);
      s.ox = e.x;
      s.oy = e.y;
      s.aim = Math.atan2(pl.y - e.y, pl.x - e.x) + Math.PI / SWEEP_N;
      s.spin = w.rng.next() < 0.5 ? 1 : -1;
      for (let i = 0; i < SWEEP_N; i++) {
        const a = s.aim + (i / SWEEP_N) * TAU;
        w.telegraphLine(s.ox, s.oy, s.ox + Math.cos(a) * SWEEP_LEN, s.oy + Math.sin(a) * SWEEP_LEN, GLARE_W, SWEEP_TELE, 0xbafff6);
      }
      cue(w, SA_GLINT, e.x + 4 * e.face, presidentEyeY(e), 0, 0, SWEEP_TELE, 1, e);
    }
  }
}

/** Beams from (ox, oy): player feet within GLARE_W of any -> GLARE_DMG (i-frames pace re-hits). */
function beamHit(e: Enemy, w: World, s: PresidentState, n: number, a0: number, step: number, len: number): void {
  const p = w.player;
  const reach = GLARE_W + CFG.playerRadius * w.stats.hitbox - 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + i * step;
    if (segDist(p.x, p.y, s.ox, s.oy, s.ox + Math.cos(a) * len, s.oy + Math.sin(a) * len) < reach) {
      w.hurtPlayer(GLARE_DMG, s.ox, s.oy, e.def.id);
      return;
    }
  }
}

function startFlourish(e: Enemy, w: World, s: PresidentState, phase: number): void {
  s.phase = phase;
  s.pat = 0;
  go(e, CP_FLOURISH);
  e.inv = FLOURISH + 0.2;
  w.clearBullets();
  const title = phase === 2 ? "EMERGENCY ASSEMBLY" : "COUNCIL DISSOLVED?!";
  const sub = phase === 2 ? "attendance is mandatory" : "she did not see this coming";
  w.emit("bossPhase", { id: e.def.id, phase, x: e.x, y: e.y, title, subtitle: sub });
  say(w, e, phase === 2 ? "Assembly!" : "My GLASSES?!");
  if (phase === 3) cue(w, SA_CRACK, e.x + 4 * e.face, presidentEyeY(e), 0, 0, 1, 0, e);
}

/** School Regulation clock: a new random rule (never the same twice in a row) every 20 s / 14 s. */
function regulate(e: Enemy, w: World, s: PresidentState, dt: number): void {
  if (s.rule) {
    s.ruleT -= dt;
    if (s.ruleT <= 0) {
      s.rule = 0;
      s.still = 0;
    }
  }
  s.ruleNext -= dt;
  if (s.ruleNext > 0) return;
  s.ruleNext = s.phase >= 2 ? RULE_EVERY_P2 : RULE_EVERY;
  let r = RULES[w.rng.int(0, RULES.length - 1)];
  if (r === s.lastRule) r = RULES[(RULES.indexOf(r) + 1 + w.rng.int(0, RULES.length - 2)) % RULES.length];
  s.lastRule = r;
  s.rule = r;
  s.ruleT = RULE_ON;
  s.still = 0;
  s.tick = 0;
  cue(w, SA_RULE, e.x, e.y, 0, 0, RULE_ON, r, e);
}

/** RULE 12: standing still for over 1 s hurts (6 every 0.5 s). */
function loiter(e: Enemy, w: World, s: PresidentState, dt: number): void {
  if (s.rule !== 12) return;
  const p = w.player;
  const moving = p.moving || Math.abs(p.vx) + Math.abs(p.vy) > 12 || p.dashT > 0;
  if (moving) {
    s.still = 0;
    s.tick = 0;
    return;
  }
  s.still += dt;
  if (s.still < 1) return;
  s.tick -= dt;
  if (s.tick > 0) return;
  s.tick = 0.5;
  w.hurtPlayer(LOITER_DMG, p.x, p.y + 4, e.def.id);
}

export const councilPresident: EnemyDef = {
  id: "council_president",
  name: "Student Council President",
  sprite: "boss_president",
  fps: 4,
  hp: 125000,
  speed: 40,
  dmg: 17,
  radius: 13,
  height: 40,
  xp: 0,
  shadow: 28,
  knockResist: 0.95,
  colors: [C.navy, C.red, C.white, C.lightBlue],
  boss: {
    title: "STUDENT COUNCIL PRESIDENT",
    subtitle: "Supreme Authority of Room 2-B (and Every Other Room)",
    music: "boss",
    level: 40,
  },
  // art: f0-1 idle (clipboard tap, glint), f2 accusing point, f3 stamp slam, f4 blazer swish, f5 rage (cracked glasses)
  frame(e) {
    const s = STATE.get(e);
    const p3 = (s?.phase ?? 1) >= 3;
    switch (e.state) {
      case CP_GLINT:
      case CP_SWEEP_TELE:
        return p3 ? 5 : 2;
      case CP_GLARE:
      case CP_SWEEP:
        return p3 ? 5 : 2;
      case CP_DENIED:
      case CP_SPIRAL:
        return (s?.n ?? 0) > 0 && e.timer % 0.45 < 0.2 ? 3 : 2;
      case CP_SUMMON:
      case CP_FLOURISH:
      case CP_ENTER:
        return 4;
      default:
        return p3 ? 5 : Math.floor(e.t * 2) & 1;
    }
  },
  init(e, w) {
    const s = st(e);
    s.phase = 1;
    s.pat = 0;
    s.n = 0;
    s.rule = 0;
    s.ruleT = 0;
    s.ruleNext = RULE_EVERY * 0.5;
    s.lastRule = 0;
    go(e, CP_ENTER);
    if (!INSTALLED.has(w)) {
      INSTALLED.add(w);
      installRules(w);
    }
    LIVE.set(w, e);
  },
  update(e, w, dt) {
    const s = st(e);
    e.timer += dt;
    const k = w.director.enraged ? 0.85 : 1;
    if (e.state !== CP_ENTER) {
      regulate(e, w, s, dt);
      loiter(e, w, s, dt);
    }
    if (e.state !== CP_ENTER && e.state !== CP_FLOURISH) {
      const want = e.hp < e.maxHp * CP_P3 ? 3 : e.hp < e.maxHp * CP_P2 ? 2 : 1;
      if (want > s.phase) {
        startFlourish(e, w, s, s.phase + 1);
        return;
      }
    }
    const p = w.player;
    switch (e.state) {
      case CP_ENTER:
        keepPost(e, w, 1.3);
        if (e.timer >= 1.1 && e.timer - dt < 1.1) {
          say(w, e, "Motion: denied.");
          e.sqV -= 6;
        }
        if (e.timer >= 1.9) go(e, CP_WALK);
        break;
      case CP_WALK:
        keepPost(e, w, 1);
        s.off = offClock(e, w, s.off, dt);
        if (s.off > OFF_WARP) {
          // "No running in the halls" - she simply appears where she is needed
          s.off = 0;
          hoverAnchor(e, w, 92, 0, SPRITE_H, tmp);
          warpTo(e, w, tmp.x, tmp.y);
        }
        if (e.timer >= 0.7 * k && bossVisible(e, w)) nextPattern(e, w, s);
        break;
      case CP_DENIED: {
        keepPost(e, w, 0.3);
        const every = 0.5 * k;
        if (s.n < 3 && e.timer >= 0.35 + s.n * every) {
          const x = e.x + 6 * e.face;
          const y = e.y - 26;
          if (s.phase >= 2) ring(w, x, y, 18, w.rng.angle() + (s.n & 1) * (Math.PI / 18), 70, STAMP, "eb_stamp", 10);
          else fan(w, x, y, 5, aimAt(w, x, y), 0.25, 75, STAMP, "eb_stamp", 8);
          cue(w, SA_STAMP, x, y, 0, 0, 1, s.n, e);
          s.n++;
          e.sqV -= 6;
        }
        if (s.n >= 3 && e.timer >= 0.35 + 3 * every + 0.35) go(e, CP_WALK);
        break;
      }
      case CP_GLINT:
        e.vx = e.vy = 0;
        if (e.timer >= GLINT_TELE) {
          go(e, CP_GLARE);
          for (let i = -1; i <= 1; i++) {
            const a = s.aim + i * GLINT_SPREAD;
            w.telegraphLine(s.ox, s.oy, s.ox + Math.cos(a) * GLARE_LEN, s.oy + Math.sin(a) * GLARE_LEN, GLARE_W, GLARE_T, 0xffffff);
          }
          shock(w, e.x, e.y - 40, 26, 0.3);
        }
        break;
      case CP_GLARE:
        e.vx = e.vy = 0;
        beamHit(e, w, s, 3, s.aim - GLINT_SPREAD, GLINT_SPREAD, GLARE_LEN);
        if (e.timer >= GLARE_T) go(e, CP_WALK);
        break;
      case CP_SUMMON:
        e.vx = e.vy = 0;
        if (s.n === 0 && e.timer >= 0.45) {
          s.n = 1;
          const ninjas = s.phase >= 2;
          const n = ninjas ? 4 : 6;
          const a0 = w.rng.angle();
          const hw = w.viewW * 0.5 - 12;
          const hh = w.viewH * 0.5 - 16;
          for (let i = 0; i < n; i++) {
            const a = a0 + (i / n) * TAU;
            const x = Math.max(p.x - hw, Math.min(p.x + hw, p.x + Math.cos(a) * 90));
            const y = Math.max(p.y - hh, Math.min(p.y + hh, p.y + Math.sin(a) * 90));
            const m = w.spawnEnemy(ninjas ? "council_ninja" : "hall_monitor", x, y);
            if (m) efx(w, EFX_SUMMON, x, y, 0, 0, 0.9, m);
          }
          efx(w, EFX_ROAR, e.x, e.y - 34, 0, 0, 0.5, e);
          e.sqV += 8;
        }
        if (e.timer >= 1.2 * k) go(e, CP_WALK);
        break;
      case CP_SPIRAL: {
        // P3: a 2-arm stamp spiral
        keepPost(e, w, 0.25);
        const every = 0.16 * k;
        s.aim += 1.9 * s.spin * dt;
        if (e.timer >= 0.3 && e.timer < 3.3 && e.timer >= 0.3 + s.n * every) {
          s.n++;
          for (let i = 0; i < 2; i++) {
            const a = s.aim + i * Math.PI;
            shoot(w, e.x + Math.cos(a) * 10, e.y - 26 + Math.sin(a) * 10, a, 66, STAMP, "eb_stamp");
          }
        }
        if (e.timer >= 3.7) go(e, CP_WALK);
        break;
      }
      case CP_SWEEP_TELE:
        e.vx = e.vy = 0;
        if (e.timer >= SWEEP_TELE) {
          go(e, CP_SWEEP);
          shock(w, e.x, e.y - 40, 30, 0.4);
        }
        break;
      case CP_SWEEP:
        // 5 rotating glare beams (the hit pacing is the player's i-frames)
        e.vx = e.vy = 0;
        s.aim += SWEEP_SPEED * s.spin * dt;
        beamHit(e, w, s, SWEEP_N, s.aim, TAU / SWEEP_N, SWEEP_LEN);
        if (e.timer >= SWEEP_T) go(e, CP_WALK);
        break;
      case CP_FLOURISH:
        e.vx = e.vy = 0;
        if (e.timer >= 0.9 && e.timer - dt < 0.9) {
          shock(w, e.x, e.y, 90, 1);
          e.sqV += 12;
        }
        if (e.timer >= FLOURISH) go(e, CP_WALK);
        break;
      default:
        go(e, CP_WALK);
    }
    if (Math.abs(e.vx) < 1.5) e.face = p.x >= e.x ? 1 : -1;
  },
  onDeath(e, w) {
    const s = STATE.get(e);
    if (s) s.rule = 0;
    if (LIVE.get(w) === e) LIVE.delete(w);
  },
};

export const bosses: EnemyDef[] = [councilPresident];
