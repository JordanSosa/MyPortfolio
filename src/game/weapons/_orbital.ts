/**
 * ORBITAL GUARD (helper, no `weapons` export): every weapon whose bodies orbit the hero - Yarn Orbit
 * balls / Cosmic Yarn planets, Teapot Tempest / Eternal Tea Party teacups - also shields her.
 *
 *   - A body that is UP destroys every enemy bullet it touches (`world.bullets` only: boss beams,
 *     slams, dash lanes and telegraphed blasts are not bullets, so they are never blocked).
 *   - Each block chips it; at `block` chips it BREAKS: no hits, hidden, for its mend time, then it
 *     REFORMS in place. Mend time (mendTime; knobs in CFG.guard, lab what-if `cfg.guard.*`) = `mend` s
 *       x (1 - cd + cd x cooldown)     Wish Charm / cooldown builds recover faster, at half the stat's
 *                                      rate (cd 0.5: the 0.35 floor mends in 0.68x, not 0.35x)
 *       x max(1, n / ref) ^ amount     bodies past the weapon's own count (`ref`: its level / Limit
 *                                      Break / talent count; the extra come from the Amount stat)
 *                                      widen the ring but mostly share its guard (amount 0.5)
 *       x (1 + share x (m - 1))        m = guarding weapons held: Pudding's teacups + a Yarn Orbit are
 *                                      two rings that share one recovery (share 0.5)
 *     so a late-game build (amount +5, area x2, cooldown 0.7) covers more of the ring without eating
 *     2-3x the bullets per second: the ring's block rate stays near its base weapon's (reviewer pass:
 *     the uncapped rule made Cosmic Yarn eat ~90 % of a 15 bullet/s storm at P7 stats, Cosmic Yarn +
 *     Eternal Tea Party all of it).
 *   - A chipped body that is still up (evolutions absorb 2-3 bullets) is good as new again after its
 *     mend time without a hit: `block` bullets inside that window break it.
 *   - Every block counts in RunStats.orbitalBlocks (World.bumpStat; never muted).
 *   - Only the hero's own weapons guard: a copy outside her slots (A Real Friend's instance, which
 *     orbits the Friend 24-40 px behind her) never blocks, so the relic cannot double her guard
 *     (docs/content/relics.md: the Friend "never blocks anything").
 *
 * State lives in one `OrbitalGuard` per weapon instance (typed arrays, slot k = the k-th orbiting
 * body: ring index / cup ordinal), so a body broken at the end of Yarn Orbit's on-phase is still
 * down when the balls come back. A weapon calls, every step:
 *
 *     const g = guardOf(inst);
 *     guardTick(w, g, mend, color, dt);          // timers, reforms (once per step, bodies or not)
 *     ... place the bodies ...
 *     guardBody(g, k, p, r, scale);              // per body: its slot position; hides it while down
 *     g.n = n; g.ref = own;                      // bodies placed / the weapon's own count (mendTime)
 *     guardBlock(w, g, block, mend, color, cx, cy, R);  // bullets in the ring band -> blocks / breaks
 *
 * A broken body keeps its projectile (the ring spacing stays put) with r = 0 (no hits) and scale 0
 * (the generic drawer draws nothing, the teacup drawer skips it); the view draws the ghost ring at
 * the slot's position from the guard (`guardIf`, src/view/weapon-fx.ts) and the weaponFx cues
 * WFX_ORB_BLOCK / BREAK / REFORM (one reused payload, muted-safe). No allocations per step.
 */
import type { Projectile, WeaponInstance } from "../types";
import type { World } from "../world";
import { CFG } from "../config";
import { WFX_ORB_BLOCK, WFX_ORB_BREAK, WFX_ORB_REFORM, wfx } from "./_fx";

/** Most bodies one weapon orbits (the weapons cap their own counts at 10-12). */
export const GUARD_MAX = 12;
/** Extra block reach (px) on top of body radius + bullet radius: a near miss still counts on a phone. */
export const GUARD_PAD = 1.5;
/** Reform pop: the body scales back in over this many seconds (back-out ease). */
export const REFORM_POP = 0.2;
/** "Never broke" marker for upT (no reform pop on the first spawn). */
const SETTLED = 1e3;

export class OrbitalGuard {
  constructor(
    /** The weapon instance this guard belongs to (guardBlock: only an instance in world.weapons blocks). */
    readonly inst: WeaponInstance,
  ) {}
  /** Seconds left broken per slot (0 = up). */
  readonly down = new Float32Array(GUARD_MAX);
  /** Length of the current break (s): the ghost ring's progress = 1 - down / downFor. */
  readonly downFor = new Float32Array(GUARD_MAX);
  /** Bullets absorbed since the body was last whole (breaks at `block`). */
  readonly chips = new Uint8Array(GUARD_MAX);
  /** Seconds since the last chip (a chipped body mends fully after its mend time without one). */
  readonly calm = new Float32Array(GUARD_MAX);
  /** Seconds since the slot reformed (SETTLED = it never broke / long ago). */
  readonly upT = new Float32Array(GUARD_MAX).fill(SETTLED);
  /** The slot's body centre and radius this step (the ghost ring follows the orbit). */
  readonly x = new Float32Array(GUARD_MAX);
  readonly y = new Float32Array(GUARD_MAX);
  readonly r = new Float32Array(GUARD_MAX);
  /** Bodies placed this step (slots 0..n-1); 0 while Yarn Orbit is in its off phase. */
  n = 0;
  /** The weapon's own body count (level + Limit Break + talents, without the Amount stat): mendTime's dilution. 0 = n. */
  ref = 0;
  /** Chips that break a body (the weapon's current `block`): the view's crack read. */
  block = 1;
  /** Bullets blocked by this instance (the run total is RunStats.orbitalBlocks). */
  blocks = 0;
  /** Breaks so far (tests / snapshot). */
  breaks = 0;
}

const GUARDS = new WeakMap<WeaponInstance, OrbitalGuard>();

/** The instance's guard (created on first use). */
export function guardOf(inst: WeaponInstance): OrbitalGuard {
  let g = GUARDS.get(inst);
  if (!g) {
    g = new OrbitalGuard(inst);
    GUARDS.set(inst, g);
  }
  return g;
}

/** The instance's guard if it has one (the view: read-only). */
export function guardIf(inst: WeaponInstance): OrbitalGuard | undefined {
  return GUARDS.get(inst);
}

/**
 * Recovery seconds of a break (and the calm window that mends a chipped body): `mend` x the cooldown
 * stat at CFG.guard.cd of its rate x the extra-body dilution max(1, n / ref) (see the header).
 */
export function mendTime(w: World, g: OrbitalGuard, mend: number): number {
  const k = CFG.guard.cd;
  const dil = g.ref > 0 && g.n > g.ref ? (g.n / g.ref) ** CFG.guard.amount : 1;
  // (guarding weapons held: the hero's slots only, a handful - no allocation)
  let m = 0;
  for (let i = 0; i < w.weapons.length; i++) if (GUARDS.has(w.weapons[i])) m++;
  const share = m > 1 ? 1 + CFG.guard.share * (m - 1) : 1;
  return mend * (1 - k + k * w.stats.cooldown) * dil * share;
}

/** Back-out pop 0 -> 1 over REFORM_POP s (overshoots a little, then settles). */
export function reformScale(t: number): number {
  if (t >= REFORM_POP) return 1;
  const k = t / REFORM_POP - 1;
  const c = 2.2;
  return Math.max(0, 1 + (c + 1) * k * k * k + c * k * k);
}

/**
 * Once per weapon step: count down breaks (a slot that comes back reforms with a pop cue), mend chipped
 * bodies that stayed calm for their mend time. `n` (bodies last placed) decides whether a reform is shown.
 */
export function guardTick(w: World, g: OrbitalGuard, mend: number, color: number, dt: number): void {
  const t = mendTime(w, g, mend);
  for (let k = 0; k < GUARD_MAX; k++) {
    if (g.down[k] > 0) {
      g.down[k] -= dt;
      if (g.down[k] > 0) continue;
      g.down[k] = 0;
      g.chips[k] = 0;
      g.upT[k] = 0;
      if (k < g.n) wfx(w, WFX_ORB_REFORM, g.x[k], g.y[k], g.x[k], g.y[k], g.r[k], color);
      continue;
    }
    if (g.upT[k] < SETTLED) g.upT[k] = Math.min(SETTLED, g.upT[k] + dt);
    if (g.chips[k] > 0) {
      g.calm[k] += dt;
      if (g.calm[k] >= t) g.chips[k] = 0;
    }
  }
}

/**
 * Per body, after it is placed: remember slot k's position / radius; while down the projectile has
 * no hits and no size (r = 0, scale 0), else its radius and scale (with the reform pop). Returns
 * whether the body is up. Call with k = 0..n-1, then set `g.n = n` (guardBlock reads it).
 */
export function guardBody(g: OrbitalGuard, k: number, p: Projectile, r: number, scale: number): boolean {
  g.x[k] = p.x;
  g.y[k] = p.y;
  g.r[k] = r;
  if (g.down[k] > 0) {
    p.r = 0;
    p.scale = 0;
    return false;
  }
  p.r = r;
  p.scale = scale * reformScale(g.upT[k]);
  return true;
}

/**
 * Bullets touching an up body die (pop cue at the contact point); `block` chips break the body for
 * mendTime(mend). (cx, cy) / ringR: the orbit's centre and outer radius - bullets outside the ring
 * band are skipped before the per-body test. Returns the bullets blocked this step.
 */
export function guardBlock(w: World, g: OrbitalGuard, block: number, mend: number, color: number, cx: number, cy: number, ringR: number): number {
  const n = Math.min(g.n, GUARD_MAX);
  if (n <= 0) return 0;
  g.block = block;
  // (a copy outside the hero's slots - A Real Friend's - never blocks)
  if (!w.weapons.includes(g.inst)) return 0;
  let reach = 0;
  for (let k = 0; k < n; k++) if (g.r[k] > reach) reach = g.r[k];
  // (the widest bullet is a few px: 8 covers every pattern in the game)
  const outer = ringR + reach + GUARD_PAD + 8;
  const o2 = outer * outer;
  const bl = w.bullets;
  let got = 0;
  for (let i = 0; i < bl.count; i++) {
    const b = bl.items[i];
    if (b.dead) continue;
    const ox = b.x - cx;
    const oy = b.y - cy;
    if (ox * ox + oy * oy > o2) continue;
    for (let k = 0; k < n; k++) {
      if (g.down[k] > 0) continue;
      const dx = b.x - g.x[k];
      const dy = b.y - g.y[k];
      const rr = g.r[k] + b.r + GUARD_PAD;
      if (dx * dx + dy * dy > rr * rr) continue;
      b.dead = true;
      got++;
      g.blocks++;
      w.bumpStat("orbitalBlocks", 1);
      // (the pop sits on the body's rim, toward the bullet)
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const rim = Math.min(d, g.r[k]);
      wfx(w, WFX_ORB_BLOCK, g.x[k] + (dx / d) * rim, g.y[k] + (dy / d) * rim, g.x[k], g.y[k], g.r[k], color);
      g.chips[k]++;
      g.calm[k] = 0;
      if (g.chips[k] >= block) {
        const t = mendTime(w, g, mend);
        g.down[k] = g.downFor[k] = t;
        g.breaks++;
        wfx(w, WFX_ORB_BREAK, g.x[k], g.y[k], g.x[k], g.y[k], g.r[k], color);
      }
      break;
    }
  }
  return got;
}
