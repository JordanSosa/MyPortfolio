/**
 * Shared simulation types: entities (pooled, mutable) and content definitions
 * (immutable data + behaviour hooks). PURE: no DOM / WebGL / audio.
 *
 * Content files (weapons/, enemies/, bosses/, ultimates/) export arrays of
 * these defs and are auto-registered (see registry.ts).
 */
import type { Stats } from "./stats";
import type { World } from "./world";

// ---------------------------------------------------------------- enemies
export interface BossInfo {
  /** Name card title, e.g. "KING PUFF". */
  title: string;
  /** Name card subtitle, e.g. "Ruler of the Squish Kingdom". */
  subtitle: string;
  /** Music track while alive (audio MusicTrack id). */
  music?: "boss" | "final";
  /** Killing it ends the run in victory. */
  final?: boolean;
  /**
   * Player level the fight is tuned for: HP x clamp(1 + (level - this) x CFG.bossHpPerLevel,
   * CFG.bossHpMin, CFG.bossHpMax) at spawn, so a snowballed build and a struggling one both get
   * a fight of about the same length (genre convention: boss HP scales with the player's level).
   */
  level?: number;
}

export interface EnemyDef {
  /** Registry id used by the director timeline ("puff"). */
  id: string;
  name: string;
  /** Atlas sprite id (manifest), e.g. "en_puff". */
  sprite: string;
  /** Animation fps override (default: the sprite's own fps). */
  fps?: number;
  hp: number;
  /** px/s */
  speed: number;
  /** Contact damage. */
  dmg: number;
  /** Collision radius (px). */
  radius: number;
  /** XP value of the dropped gem (0 = none). */
  xp: number;
  /** Death confetti colours (0xRRGGBB). */
  colors: readonly number[];
  /** Shadow width in px. */
  shadow: number;
  /** Visual centre height above the feet (hit sparks, homing aim). */
  height: number;
  /** 0..1 knockback resistance. */
  knockResist?: number;
  /** Ignore soft separation from other enemies. */
  noSeparation?: boolean;
  /** Not targeted by homing/auto-aim, no contact damage, no kill credit (destructible props). */
  prop?: boolean;
  /** Present => this is a boss (HP bar, intro, golden chest). */
  boss?: BossInfo;
  /** Excluded from elite rolls. */
  noElite?: boolean;
  /** Called once after spawn (stats already set). */
  init?(e: Enemy, w: World): void;
  /** Set the desired velocity e.vx / e.vy (px/s) for this step. Knockback and separation are applied after. */
  update(e: Enemy, w: World, dt: number): void;
  /** Called when killed (before drops). */
  onDeath?(e: Enemy, w: World): void;
  /** Optional animation override for the view: return a sprite frame index, or -1 for the normal loop. */
  frame?(e: Enemy): number;
}

/** Movement mode set by the director: 0 = def AI, 1 = fixed straight line (swarm events). */
export const MODE_AI = 0;
export const MODE_STRAIGHT = 1;

export interface Enemy {
  uid: number;
  def: EnemyDef;
  x: number;
  y: number;
  /** Desired velocity from the behaviour (px/s). */
  vx: number;
  vy: number;
  /** Knockback velocity (decays). */
  kx: number;
  ky: number;
  r: number;
  /** Body centre height above the feet (collision centre = (x, y - cy)). */
  cy: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  elite: boolean;
  scale: number;
  /** 1 = facing right, -1 = left. */
  face: number;
  /** Age (s). */
  t: number;
  /** Hit flash timer (s). */
  flash: number;
  /** Squash spring (cosmetic, x = scale y). */
  sqX: number;
  sqV: number;
  /** Behaviour scratch state. */
  state: number;
  timer: number;
  a: number;
  b: number;
  c: number;
  d: number;
  mode: number;
  dead: boolean;
  /** Per-channel time of the last hit (World.t), for re-hit cooldowns. */
  lastHit: Float64Array;
  /** Slow multiplier (1 = none) + remaining time. */
  slow: number;
  slowT: number;
  /** Draw alpha (Boo flicker). */
  alpha: number;
  /** Height above ground for drawing (hops), px. */
  z: number;
  /** Invulnerable while > 0 (seconds, counts down): hits are ignored (boss phase flourishes, entrances). */
  inv: number;
}

// ---------------------------------------------------------------- projectiles
export const PK_FREE = 0; // moves by velocity (optional homing)
export const PK_ATTACHED = 1; // follows the player at (ox, oy)
export const PK_MANAGED = 2; // position set by its owner every step (orbits)
export const PK_FALL = 3; // falls from height z, calls onLand at z <= 0

export const SHAPE_CIRCLE = 0;
/** Oriented ellipse with half extents (hw, hh) rotated by `ang`. */
export const SHAPE_ELLIPSE = 1;
/** Ring band between r - hw and r (expanding whirlwinds). */
export const SHAPE_RING = 2;

export const ROT_FIXED = 0;
export const ROT_VELOCITY = 1;
export const ROT_SPIN = 2;

export type ProjHook = (p: Projectile, w: World, dt: number) => void;
export type ProjHitHook = (p: Projectile, w: World, e: Enemy) => void;

export interface Projectile {
  uid: number;
  /** Owning weapon instance (damage attribution), or null (ults, misc). */
  owner: WeaponInstance | null;
  /** Damage channel (Enemy.lastHit index). */
  ch: number;
  /** Attribution id for the results screen (weapon id or ult id). */
  source: string;
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Height (PK_FALL) and its velocity. */
  z: number;
  vz: number;
  /** Offset from the player (PK_ATTACHED). */
  ox: number;
  oy: number;
  /** Generic angle / angular velocity (orbits, shape orientation). */
  ang: number;
  angV: number;
  speed: number;
  /** Homing turn rate rad/s (0 = none) and current target. */
  homing: number;
  target: Enemy | null;
  /**
   * uid of `target` when it was assigned. Enemies are pooled: a dead target's object
   * is reused by the next spawn, so homing drops a target whose uid no longer matches.
   */
  targetUid: number;
  /** Hit shape. r = 0 disables hits. */
  shape: number;
  r: number;
  hw: number;
  hh: number;
  dmg: number;
  knock: number;
  /** Extra crit chance. */
  crit: number;
  /** Remaining enemy hits (Infinity = unlimited). */
  pierce: number;
  /** > 0: per-enemy re-hit cooldown via Enemy.lastHit[ch]; 0: each enemy is hit at most once. */
  hitEvery: number;
  /** uids already hit (when hitEvery = 0). */
  hits: Int32Array;
  nHits: number;
  life: number;
  age: number;
  /** Seconds before it starts hitting / homing. */
  delay: number;
  dead: boolean;
  // ---- visuals (read by the view; the sim never interprets them)
  sprite: string;
  /** 0 = loop at the sprite fps, 1 = play once over the lifetime. */
  anim: number;
  fps: number;
  scale: number;
  rot: number;
  rotMode: number;
  spin: number;
  tint: number;
  alpha: number;
  glow: boolean;
  /** Trail preset key understood by the view ("" = none). */
  trail: string;
  /** Draw on the y-sorted entity layer (cats) instead of the fx layer. */
  entity: boolean;
  /** Scale in/out at birth/death (orbiting balls). */
  pop: boolean;
  /** Shadow width (0 = none). */
  shadow: number;
  flipX: boolean;
  /** Ground telegraph ring radius (meteors), 0 = none. */
  telegraph: number;
  // ---- behaviour
  update: ProjHook | null;
  onHit: ProjHitHook | null;
  /** Called on expiry / when it lands (PK_FALL) / when pierce runs out. */
  onEnd: ProjHook | null;
  /** Free numeric scratch for hooks. */
  a: number;
  b: number;
}

/** Enemy bullet (always drawn on top, glowing). */
export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  age: number;
  sprite: string;
  /** Angular velocity applied to the velocity vector (spirals). */
  turn: number;
  /** Acceleration along velocity (px/s^2). */
  accel: number;
  dead: boolean;
}

/** Danger-zone warning drawn on the ground (boss slams, dash lanes). */
export interface Telegraph {
  /** 0 = circle (x, y, r), 1 = line from (x, y) to (x2, y2) with half width r. */
  shape: number;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  age: number;
  life: number;
  color: number;
  dead: boolean;
}

// ---------------------------------------------------------------- pickups
export interface Gem {
  x: number;
  y: number;
  z: number;
  vz: number;
  vx: number;
  vy: number;
  value: number;
  /** 1..4 -> gem_1..gem_4 */
  tier: number;
  /** 0 = resting, 1 = flying to the player. */
  state: number;
  speed: number;
  t: number;
  dead: boolean;
}

export type PickupKind = "coin" | "onigiri" | "cake" | "magnet" | "bomb" | "clock" | "chest";

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  z: number;
  vz: number;
  vx: number;
  vy: number;
  value: number;
  golden: boolean;
  state: number;
  speed: number;
  t: number;
  dead: boolean;
}

// ---------------------------------------------------------------- weapons
/** Per-level base numbers. Free-form extra keys are allowed for weapon-specific values. */
export interface WeaponLevel {
  dmg: number;
  cd: number;
  amount: number;
  speed?: number;
  pierce?: number;
  area?: number;
  duration?: number;
  knock?: number;
  [k: string]: number | undefined;
}

export interface WeaponDef {
  id: string;
  name: string;
  /** Atlas icon id (16x16). */
  icon: string;
  /** Hit spark tint. */
  color: number;
  /** Shown on the NEW card. */
  desc: string;
  /** Base numbers for levels 1..5 (index 0 = level 1). Evolutions have one entry. */
  levels: WeaponLevel[];
  /** Upgrade text for levels 2..5 (index 0 = level 2). */
  upgrades: string[];
  /** Base weapon: evolves into `into` at max level while passive `with` is owned. */
  evolution?: { into: string; with: string };
  /** True for evolved weapons (never offered as NEW; appear as EVOLUTION cards). */
  evolved?: boolean;
  /** Fire sfx id (audio SfxId), emitted through the weaponFire event. */
  sfx?: string;
  /** Hit sfx id override (default "hit"). */
  hitSfx?: string;
  /** Create persistent state. */
  init?(w: World, inst: WeaponInstance): void;
  /** Called every sim step. */
  update(w: World, inst: WeaponInstance, dt: number): void;
  /** Called when replaced (evolution) or the run ends: kill owned projectiles. */
  dispose?(w: World, inst: WeaponInstance): void;
}

export interface WeaponInstance {
  def: WeaponDef;
  level: number;
  slot: number;
  /** Generic cooldown timer. */
  timer: number;
  /** Time since acquired. */
  t: number;
  /** Persistent projectiles owned by the weapon (orbits) + their uids (pooled objects get reused: check both). */
  projs: Projectile[];
  uids: number[];
  /** Free numeric state. */
  data: Record<string, number>;
  /** Stats for the results screen. */
  damage: number;
  kills: number;
}

// ---------------------------------------------------------------- passives
export interface PassiveDef {
  id: string;
  name: string;
  icon: string;
  /** Per-level effect text (index 0 = level 1). */
  levels: string[];
  apply(s: Stats, level: number): void;
}

export interface PassiveInstance {
  def: PassiveDef;
  level: number;
}

// ---------------------------------------------------------------- heroes / ultimates
export type HeroId = "hoshi" | "rin" | "mochi";

export interface HeroDef {
  id: HeroId;
  name: string;
  /** Short epithet ("Star Magician"). */
  title: string;
  /** Sprite prefix: `${sprite}_idle` etc. */
  sprite: string;
  portrait: string;
  weapon: string;
  ult: string;
  /** Trait description. */
  trait: string;
  /** UI accent colour. */
  color: number;
  /** Signature colours (afterimages, confetti). */
  colors: readonly number[];
  apply(s: Stats): void;
}

export interface UltState {
  def: UltimateDef;
  /** "cutin" while the anime cut-in plays (sim paused), then "active". */
  phase: "cutin" | "active";
  t: number;
  /** Strength scale (grows with player level). */
  power: number;
  data: Record<string, number>;
}

export interface UltimateDef {
  id: string;
  name: string;
  hero: HeroId;
  desc: string;
  /** Active duration after the cut-in (s). */
  duration: number;
  start(w: World, u: UltState): void;
  update(w: World, u: UltState, dt: number): void;
  end?(w: World, u: UltState): void;
}

// ---------------------------------------------------------------- upgrades
export type CardKind = "weapon" | "passive" | "evolution" | "heal" | "coins";
export type Rarity = "common" | "rare" | "epic" | "evolution";

export interface UpgradeCard {
  kind: CardKind;
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** 0 = NEW */
  from: number;
  to: number;
  rarity: Rarity;
  /** For evolutions: the base weapon / passive ids involved. */
  base?: string;
  with?: string;
}

export interface ChestResult {
  golden: boolean;
  jackpot: boolean;
  rewards: UpgradeCard[];
  coins: number;
}
