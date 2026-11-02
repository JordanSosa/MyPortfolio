/**
 * Typed simulation events. The sim emits these through `world.bus`; the
 * view/feedback bridge (src/view/feedback.ts), the HUD and audio subscribe.
 *
 * Hot events (enemyHit, enemyKilled, gem) reuse one payload object per type:
 * listeners must copy what they need and never keep the payload.
 */
import { EventBus } from "../core/events";
import type { Enemy, UpgradeCard, ChestResult, PickupKind } from "./types";

export interface HitEvent {
  x: number;
  y: number;
  dmg: number;
  crit: boolean;
  /** Weapon tint for the hit spark. */
  color: number;
  /** Direction of the hit (radians). */
  angle: number;
  enemy: Enemy;
  source: string;
}

export interface KillEvent {
  x: number;
  y: number;
  enemy: Enemy;
  elite: boolean;
  boss: boolean;
  /** Kill counter after this kill. */
  kills: number;
}

export interface GemEvent {
  x: number;
  y: number;
  value: number;
  tier: number;
}

/**
 * One-shot weapon visual (lightning, bursts, heals...) the projectile list can't
 * express. `kind` is a WFX_* constant from game/weapons/_fx.ts; the payload is
 * reused (copy what you need). Drawn by src/view/weapon-fx.ts.
 */
export interface WeaponFxEvent {
  kind: number;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  /** Kind-specific variant (chain index, level...). */
  n: number;
}

/**
 * Enemy / boss cosmetic cue. `kind` is an EFX_* constant from
 * game/enemies/_fx.ts; the payload is reused (copy what you need, keep no
 * reference to `enemy` beyond the handler).
 */
export interface EnemyFxEvent {
  kind: number;
  x: number;
  y: number;
  /** Direction (unit vector) or a second point, kind-specific. */
  dx: number;
  dy: number;
  /** Strength / radius / count, kind-specific. */
  power: number;
  enemy: Enemy | null;
}

export interface GameEvents {
  // combat
  enemyHit: HitEvent;
  enemyKilled: KillEvent;
  propBroken: { x: number; y: number; sprite: string };
  enemySpawned: { enemy: Enemy };
  eliteSpawned: { enemy: Enemy };
  explosion: { x: number; y: number; r: number; source: string; big: boolean };
  weaponFire: { id: string; sfx: string; x: number; y: number };
  weaponFx: WeaponFxEvent;
  enemyShoot: { x: number; y: number };
  /** A danger zone appeared (see World.telegraphs). */
  telegraph: { x: number; y: number; r: number };
  /** Ground slam / stomp shockwave (bosses). */
  shockwave: { x: number; y: number; r: number; power: number };
  // player
  playerHurt: { dmg: number; x: number; y: number; hp: number; maxHp: number };
  playerHeal: { amount: number; x: number; y: number };
  playerDied: { x: number; y: number };
  playerRevived: { x: number; y: number };
  dash: { x: number; y: number; dx: number; dy: number };
  dashReady: Record<string, never>;
  // progression
  levelUp: { level: number; x: number; y: number };
  upgradeApplied: { card: UpgradeCard };
  evolution: { weapon: string; name: string; x: number; y: number };
  // pickups
  gem: GemEvent;
  coin: { x: number; y: number; value: number };
  pickup: { kind: PickupKind; x: number; y: number };
  chestDropped: { x: number; y: number; golden: boolean };
  chestCollected: { x: number; y: number; golden: boolean };
  chestOpened: ChestResult;
  magnet: { x: number; y: number };
  bomb: { x: number; y: number };
  freeze: { seconds: number };
  // combo / overdrive
  comboRank: { rank: number; id: string; count: number };
  comboBreak: { count: number };
  /** The combo fell one rank (timer ran out at B+, or the player got hurt); `count` is the new (threshold) count. */
  comboDrop: { rank: number; id: string; count: number };
  ultReady: Record<string, never>;
  ultCutin: { hero: string; ult: string; name: string };
  ultStart: { ult: string; x: number; y: number };
  ultEnd: { ult: string };
  /** Rin's ult: one carving slash line (world coords). */
  ultSlash: { x0: number; y0: number; x1: number; y1: number; i: number };
  /** Rin's ult: the final petal explosion. */
  ultBurst: { x: number; y: number; w: number; h: number };
  ultMeow: { x: number; y: number };
  // director
  waveIncoming: { kind: string; x: number; y: number };
  bossWarning: { id: string; title: string; subtitle: string };
  bossSpawn: { enemy: Enemy; title: string; subtitle: string };
  bossKilled: { x: number; y: number; title: string; final: boolean };
  bossEnrage: Record<string, never>;
  /** A boss changed phase (invulnerable flourish: shockwave, banner, music duck). */
  bossPhase: { id: string; phase: number; x: number; y: number; title: string; subtitle: string };
  // bestiary
  /** Enemy / boss cosmetic cue (stomps, skids, roars, teleports...). Drawn by src/view/bestiary-fx.ts. */
  enemyFx: EnemyFxEvent;
  /** Enemy bullets are about to be cleared (bomb, ult, revive, boss phase): `world.bullets` still holds them. */
  bulletsCleared: { n: number };
  // run
  victory: { time: number };
}

export type GameBus = EventBus<GameEvents>;

export function createBus(): GameBus {
  return new EventBus<GameEvents>();
}
