/**
 * The simulation. PURE: no DOM / WebGL / audio. Everything observable leaves
 * through `world.bus` (typed events, see events.ts) or is read from the
 * public fields by the view/UI each frame.
 *
 *   const w = new World({ hero: "hoshi", seed: 42, run: buildRunConfig(profile) });
 *   w.input.mx = 1;            // analog move, plus edge flags input.dash / input.ult
 *   w.step(1 / 60);            // fixed or variable dt (<= 1/30 recommended)
 *   if (w.pendingLevels) w.choose(w.offer()[0]);
 *
 * The RunConfig (run-config.ts) is the account layer's input: stage, endless,
 * Plot Twists, stat mods, content pools, limit breaks, relics, talents,
 * constellation, start bonuses, slots and flags. Without one the run is
 * defaultRunConfig(): Dream Meadow with everything unlocked.
 *
 * Coordinates: art px, y down. Actor positions are FEET; collision centres
 * are (x, y - cy). The player's body centre is (x, y - PLAYER_CY).
 */
import { Rng } from "../core/rng";
import { PooledList } from "../core/pool";
import { SpatialHash } from "../core/spatial";
import { clamp, damp, TAU } from "../core/math";
import { EventBus } from "../core/events";
import {
  CFG,
  CHANNELS,
  CH_MISC,
  CH_ULT,
  MAX_PASSIVE_SLOTS,
  MAX_WEAPON_SLOTS,
  RANKS,
  bossHpScale,
  enemyDmgScale,
  enemyHpScale,
  gemXpScale,
  rankFor,
  stageScaling,
  xpToNext,
} from "./config";
import { createBus, type GameEvents, type HitEvent, type KillEvent, type GemEvent } from "./events";
import { heroDef } from "./heroes";
import type { HitHook, KillHook, LethalHook, SimHooks, Buff, HurtHook, PickupHook, DashHook } from "./hooks";
import { applyMeta, type MetaRanks } from "./meta";
import { PASSIVE_BY_ID } from "./passives";
import { RELICS, TALENT_TREES, TWISTS, ULTIMATES, WEAPONS, baseWeaponOf, enemyDef, stageDef, twistHeat } from "./registry";
import { defaultRunConfig, type RunConfig, type RunStatCounter, type RunStats } from "./run-config";
import { RunStatsCollector } from "./run-stats";
import type { StageDef, StageScaling } from "./stage";
import { baseStats, finalizeStats, type StatMod, type Stats } from "./stats";
import { Director } from "./director/director";
import { applyCard, banishCard, canChangeOffer, makeOffer, rollChest } from "./upgrades";
import {
  MODE_AI,
  MODE_STRAIGHT,
  PK_ATTACHED,
  PK_FALL,
  PK_FREE,
  ROT_SPIN,
  ROT_VELOCITY,
  SHAPE_CIRCLE,
  SHAPE_ELLIPSE,
  SHAPE_RING,
  type Bullet,
  type ChestResult,
  type Enemy,
  type EnemyDef,
  type Gem,
  type HeroDef,
  type PassiveInstance,
  type Pickup,
  type PickupKind,
  type Projectile,
  type Telegraph,
  type UltState,
  type UpgradeCard,
  type WeaponDef,
  type WeaponInstance,
} from "./types";

export const PLAYER_CY = CFG.playerCy;

export interface WorldOptions {
  hero?: string;
  seed?: number;
  meta?: MetaRanks;
  /** Device enemy cap (quality tier). */
  maxEnemies?: number;
  god?: boolean;
  /** Visible world size in art px (spawn ring, screen-wide effects). */
  viewW?: number;
  viewH?: number;
  /** Disable the spawn director (tests, sandboxes). */
  director?: boolean;
  /**
   * The account layer's loadout (stage, endless, twists, mods, pools, relics,
   * talents, constellation, start bonuses, slots, flags). Default:
   * defaultRunConfig() = Dream Meadow with everything unlocked.
   */
  run?: RunConfig;
}

/** Difficulty multipliers (Plot Twists, curse, endless). 1 = the stage as designed. */
export interface Difficulty {
  /** Regular enemy HP. */
  enemyHp: number;
  /** Boss HP. */
  bossHp: number;
  /** Regular enemy move speed. */
  enemySpeed: number;
  /** Enemy contact / bullet damage. */
  enemyDmg: number;
  /** Director spawn rate. */
  spawn: number;
  /** Enemy bullet speed. */
  bulletSpeed: number;
  /** Elites per elite event. */
  elite: number;
  /** Boss WARNING seconds (0 = Spoilers: bosses arrive unannounced). */
  bossWarning: number;
  /** Food (onigiri / cake) and relic hearts can drop. */
  food: boolean;
  /** Every level-up heals CFG.levelHeal of max HP. */
  levelHeal: boolean;
  /** Rerolls can be used. */
  rerolls: boolean;
  /** Phase max-alive cap multiplier (the device cap still applies). */
  cap: number;
  /** Elite HP multiplier. */
  eliteHp: number;
  /** Boss entrance beat (spawning pauses BOSS_INTRO s while the name card plays). */
  bossIntro: boolean;
  /** Bosses get back up once at 40 % HP ("IT'S NOT OVER!"): 0 none, 1 the final boss, 2 every boss. */
  sequel: number;
}

/**
 * Presentation hints the sim sets for the view (Plot Twists): the view reads
 * them each frame, gameplay never does.
 */
export interface LookHints {
  /** Darken the stage grade by this fraction (gameplay sprites keep their glow). */
  darken: number;
  /** Elites show their rainbow outline only once they have been hit (Studio Change). */
  eliteOutlineOnHit: boolean;
  /** Food pickups would have dropped: their coins wear a black "CENSORED" bar. */
  censored: boolean;
}

interface Timer {
  every: number;
  t: number;
  fn: (w: World) => void;
  /** One-shot (World.after): removed after it fired. */
  once: boolean;
}

export interface SimInput {
  /** Analog move vector, |m| <= 1. */
  mx: number;
  my: number;
  /** Edge flags: set for one frame, consumed by the next step. */
  dash: boolean;
  ult: boolean;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: number;
  /** Unit aim direction (last movement direction). */
  aimX: number;
  aimY: number;
  hp: number;
  maxHp: number;
  iframes: number;
  hurtT: number;
  dashT: number;
  dashCd: number;
  dashMax: number;
  dashDX: number;
  dashDY: number;
  dashInv: number;
  /** Dash charges ready now / max (RunConfig.flags.dashCharges adds charges; each recharges in turn over dashMax). */
  dashCharges: number;
  dashChargesMax: number;
  /** Shield charges (Stats.shield) and the seconds until the next one recharges. */
  shield: number;
  shieldT: number;
  moving: boolean;
  dead: boolean;
}

export interface RunSummary {
  hero: string;
  time: number;
  level: number;
  kills: number;
  maxCombo: number;
  coins: number;
  victory: boolean;
  damageTaken: number;
  weapons: { id: string; name: string; icon: string; damage: number; kills: number; level: number }[];
  /** Stage id. */
  stage: string;
  /** Final boss killed (also true in an endless run that later ended in death). */
  stageCleared: boolean;
  /** Everything the account layer needs (achievements, mastery, rewards). */
  stats: RunStats;
}

export type Phase = "play" | "dead" | "victory";

/** Homing projectiles look for a new target within this radius (px). */
const HOMING_RANGE = 140;

/** True if projectile `p` (hitEvery 0) already hit the enemy with this uid. */
function hasHit(p: Projectile, uid: number): boolean {
  const m = Math.min(p.nHits, p.hits.length);
  for (let h = 0; h < m; h++) if (p.hits[h] === uid) return true;
  return false;
}

// ------------------------------------------------------------------ factories
const newEnemy = (): Enemy => ({
  uid: 0,
  def: null as unknown as EnemyDef,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  kx: 0,
  ky: 0,
  r: 6,
  cy: 6,
  hp: 1,
  maxHp: 1,
  speed: 0,
  dmg: 0,
  elite: false,
  scale: 1,
  face: 1,
  t: 0,
  flash: 0,
  sqX: 1,
  sqV: 0,
  state: 0,
  timer: 0,
  a: 0,
  b: 0,
  c: 0,
  d: 0,
  mode: 0,
  dead: false,
  lastHit: new Float64Array(CHANNELS),
  slow: 1,
  slowT: 0,
  alpha: 1,
  z: 0,
  inv: 0,
  skin: "",
  stun: 0,
  untargetable: false,
});

export function resetProjectile(p: Projectile): void {
  // uid 0 invalidates any stale reference held by a weapon (see weapons/_shared prune)
  p.uid = 0;
  p.owner = null;
  p.ch = CH_MISC;
  p.source = "";
  p.kind = PK_FREE;
  p.x = p.y = p.vx = p.vy = p.z = p.vz = p.ox = p.oy = p.ang = p.angV = p.speed = 0;
  p.homing = 0;
  p.target = null;
  p.targetUid = 0;
  p.shape = SHAPE_CIRCLE;
  p.r = 4;
  p.hw = p.hh = 0;
  p.dmg = 0;
  p.knock = 0;
  p.crit = 0;
  p.pierce = 1;
  p.hitEvery = 0;
  p.nHits = 0;
  p.life = 1;
  p.age = 0;
  p.delay = 0;
  p.dead = false;
  p.sprite = "";
  p.anim = 0;
  p.fps = 0;
  p.scale = 1;
  p.rot = 0;
  p.rotMode = 0;
  p.spin = 0;
  p.tint = 0xffffff;
  p.alpha = 1;
  p.glow = false;
  p.trail = "";
  p.entity = false;
  p.pop = false;
  p.shadow = 0;
  p.flipX = false;
  p.telegraph = 0;
  p.update = null;
  p.onHit = null;
  p.onEnd = null;
  p.a = p.b = 0;
}
const newProjectile = (): Projectile => {
  const p = { uid: 0, hits: new Int32Array(24) } as Projectile;
  resetProjectile(p);
  return p;
};
const newBullet = (): Bullet => ({ x: 0, y: 0, vx: 0, vy: 0, r: 3, dmg: 5, life: 4, age: 0, sprite: "eb_orb", turn: 0, accel: 0, from: "", tint: 0xffffff, dead: false });
const newTelegraph = (): Telegraph => ({ shape: 0, x: 0, y: 0, x2: 0, y2: 0, r: 10, age: 0, life: 1, color: 0xff4d6d, dead: false });
const newGem = (): Gem => ({ x: 0, y: 0, z: 0, vz: 0, vx: 0, vy: 0, value: 1, tier: 1, state: 0, speed: 0, t: 0, dead: false });
const newPickup = (): Pickup => ({ kind: "coin", x: 0, y: 0, z: 0, vz: 0, vx: 0, vy: 0, value: 1, golden: false, censored: false, sprite: "", tint: 0xffffff, state: 0, speed: 0, t: 0, dead: false });

/** RunConfig relic stars, clamped to 0..6. */
function relicStars(s: number): number {
  return Math.max(0, Math.min(6, Math.floor(s || 0)));
}
/** RunConfig talent rank, clamped to 0..maxRank. */
function talentRank(r: number | undefined, max: number): number {
  return Math.max(0, Math.min(max, Math.floor(r ?? 0)));
}
/** RunConfig constellation, clamped to 0..6. */
function constellationOf(c: number): number {
  return Math.max(0, Math.min(6, Math.floor(c || 0)));
}

const PROP_LOOT: { kind: PickupKind; w: number; luck: boolean }[] = [
  { kind: "coin", w: 34, luck: false },
  { kind: "onigiri", w: 26, luck: false },
  { kind: "cake", w: 8, luck: true },
  { kind: "magnet", w: 11, luck: true },
  { kind: "bomb", w: 9, luck: true },
  { kind: "clock", w: 9, luck: true },
];

// ------------------------------------------------------------------ world
export class World {
  /** Presentation events (view / HUD / audio). Silent while `muted`. */
  readonly bus = createBus();
  /** Gameplay hooks (relics, talents, twists, run stats): never muted. See hooks.ts. */
  readonly hooks = new EventBus<SimHooks>();
  readonly rng: Rng;
  readonly hero: HeroDef;
  readonly meta: MetaRanks;
  readonly god: boolean;
  /** The loadout this run was built from (defaultRunConfig() when none was given). */
  readonly run: RunConfig;
  readonly stage: StageDef;
  /** The stage's enemy toughness (StageDef.scaling over the CFG defaults). */
  readonly scaling: StageScaling;
  /** Plot Twist ids active this run (registered ones only) and their ranks. */
  readonly twistIds: string[] = [];
  readonly twistRanks: Record<string, number> = {};
  /** Total Plot Twist heat. */
  readonly heat: number;
  /** Difficulty multipliers (twists install into it before the first step). */
  readonly difficulty: Difficulty = {
    enemyHp: 1,
    bossHp: 1,
    enemySpeed: 1,
    enemyDmg: 1,
    spawn: 1,
    bulletSpeed: 1,
    elite: 1,
    bossWarning: CFG.bossWarningTime,
    food: true,
    levelHeal: true,
    rerolls: true,
    cap: 1,
    eliteHp: 1,
    bossIntro: true,
    sequel: 0,
  };
  readonly look: LookHints = { darken: 0, eliteOutlineOnHit: false, censored: false };
  /** Card names get a long light-novel subtitle (Light Novel Title twist). */
  novelTitles = false;
  /**
   * Forced-crit rules (talents / constellations: "always crits enemies above 80% HP"):
   * any rule returning true makes the hit a crit. The crit roll is drawn either way.
   */
  readonly critRules: ((e: Enemy, source: string) => boolean)[] = [];
  /**
   * Damage-taken multipliers applied in hitEnemy (after crit / bossDmg): each returns a factor for
   * this hit (1 = none), e.g. burning enemies take +15% (Kuro), swooned ones +50% (Senpai).
   * Cheap, allocation-free functions only: they run on every hit.
   */
  readonly dmgTaken: ((e: Enemy, source: string, crit: boolean) => number)[] = [];
  /**
   * Hurt guards (Season 2 heroes: Magical Girl #47's Panic Henshin): run when a hit would land on the
   * hero (after invulnerability, before shields); a guard returning true negates the hit. Cheap only.
   */
  readonly hurtGuards: ((dmg: number, sx: number, sy: number) => boolean)[] = [];
  /** Contact damage taken multiplier (Senpai's "Too Cool To Get Hit"); bullets / blasts are unaffected. */
  contactDmg = 1;
  /** The hero dozes off in the Kotatsu of Sloth ("Too Comfy"): weapon hits deal no damage while true. */
  dozing = false;
  /** The hero ignores hit recoil (Truck-kun: "can't be knocked back"). */
  heavy = false;
  /**
   * Hit context for `dmgTaken` / `hit` listeners: the projectile whose hit is being applied
   * (projectileHits, else null) and how many `explode()` calls are on the stack (Candy Kingdom:
   * the Candy Corn's front-half Shield Wall, the Marshmallow Brute's Toasty).
   */
  hitProj: Projectile | null = null;
  blastDepth = 0;
  /**
   * Hero movement override (Truck-kun drives like a vehicle): when set it replaces the default
   * input -> velocity damping (dashes still use the dash velocity); it sets player.vx / vy.
   */
  mover: ((w: World, mx: number, my: number, dt: number) => void) | null = null;
  /** Hero constellation this run (0..6). */
  readonly cons: number;
  /** Seconds of invulnerability after a Plot Armor save. */
  plotArmorIframes: number = CFG.plotArmorIframes;
  /** Per-weapon extra damage added by talents / relics (addWeaponDamage), on top of RunConfig.weaponDamage. */
  private readonly weaponBonus: Record<string, number> = {};
  /** Boss uids that already got back up (Sequel Hook). */
  private readonly sequelUsed = new Set<number>();
  /** What dealt the hit that killed the hero (enemy id, bullet sprite, "explosion"...). */
  killedBy = "";
  /**
   * Run modifiers applied after the passives on every stat recompute (relic /
   * talent / twist effects that read run state, timed Buffs). Set statsDirty
   * when their inputs change.
   */
  readonly statMods: StatMod[] = [];
  /** Timed buffs (hooks.ts Buff registers itself here). */
  readonly buffs: Buff[] = [];
  /** Recompute the stats at the end of the current step. */
  statsDirty = false;
  /** Build slot limits for this run (RunConfig, clamped to the channel budget). */
  readonly weaponSlots: number;
  readonly passiveSlots: number;
  /** Weapon / passive ids removed from the card pool for this run (banish). */
  readonly banished = new Set<string>();
  banishes = 0;
  skips = 0;
  /** Rerolls never run out (Infinite Gacha Credit Card / flag). */
  freeRerolls = false;
  /**
   * Hurt modifiers (relics: Mascot Costume Head, Pocket Tissues): run on every hit that lands, after
   * shields / armor / damage reduction and before the lethal check; each returns the new damage (min 1).
   */
  readonly hurtMods: ((dmg: number, sx: number, sy: number) => number)[] = [];
  /** Extra chest JACKPOT chance, absolute (0.02 = +2 %): Waving Lucky Cat, Pity Counter Keychain. */
  jackpotBonus = 0;
  /** Chests offer a weapon's evolution this many levels before its max level (Golden Gacha Ticket: 1 = Lv4). */
  chestEvoEarly = 0;
  /** Levels whose level-up lets the player pick a second card from the same offer (Season Finale Manga). */
  readonly doublePicks = new Set<number>();
  /** Lethal hits that will still be survived (Plot Armor) and how many were. */
  plotArmor = 0;
  plotArmorSaves = 0;
  /** Ultimate cast by this run's hero (talent capstones may swap it before the first step). */
  ultId: string;
  /** Endless ("Filler Arc") is running: the final boss is down and the run goes on. */
  endlessOn = false;
  /** Run time the Filler Arc started. */
  endlessFrom = 0;
  /** The stage's final boss died this run (victory or Filler Arc). */
  stageCleared = false;
  /** Every weapon / passive id held during the run (RunStats). */
  readonly weaponsUsed: string[] = [];
  readonly passivesUsed: string[] = [];
  /** Run clock (scaled seconds of play). */
  t = 0;
  steps = 0;
  phase: Phase = "play";
  readonly input: SimInput = { mx: 0, my: 0, dash: false, ult: false };
  readonly player: Player;
  stats: Stats = baseStats();

  readonly enemies = new PooledList<Enemy>(newEnemy, undefined, 128);
  readonly projectiles = new PooledList<Projectile>(newProjectile, resetProjectile, 64);
  readonly bullets = new PooledList<Bullet>(newBullet, undefined, 32);
  readonly gems = new PooledList<Gem>(newGem, undefined, 128);
  readonly pickups = new PooledList<Pickup>(newPickup, undefined, 16);
  readonly telegraphs = new PooledList<Telegraph>(newTelegraph, undefined, 8);
  readonly grid = new SpatialHash(32, 1024);

  readonly weapons: WeaponInstance[] = [];
  readonly passives: PassiveInstance[] = [];
  /** Bumped whenever a weapon / passive is added, levelled or evolved (UI diffing). */
  buildVersion = 0;
  level = 1;
  xp = 0;
  xpNext = xpToNext(1);
  /** Level-ups waiting for a card pick. */
  pendingLevels = 0;
  /** Chests waiting to be opened (UI shows the reel, then calls openChest()). */
  readonly pendingChests: { golden: boolean }[] = [];
  rerolls = 0;
  revivesLeft = 0;

  // combo
  combo = 0;
  comboTimer = 0;
  comboRank = -1;
  maxCombo = 0;
  // overdrive
  ultMeter: number = CFG.ultStart;
  ult: UltState | null = null;
  private ultReadySent = false;
  /** Meter that ordinary kills may still add (refills at CFG.ultKillCap per second). */
  private ultKillBudget = 0;

  readonly director: Director;
  directorOn: boolean;
  boss: Enemy | null = null;
  /** The final boss has been defeated (the run is won as soon as the player is alive). */
  finalBossDown = false;
  /** Clock pickup: enemies frozen while > 0. */
  freezeT = 0;
  /** Ultimates can stop time for enemies. */
  timeStop = false;

  viewW: number;
  viewH: number;
  maxEnemies: number;
  /** Non-prop enemies alive. */
  enemyCount = 0;
  propCount = 0;

  kills = 0;
  coins = 0;
  damageTaken = 0;
  readonly damageBy = new Map<string, number>();
  /** When true no events are emitted (fast-forward). */
  muted = false;

  private uidSeq = 1;
  private qBufs: number[][] = [];
  private qDepth = 0;
  private mergeT = 0;
  private sortIdx: number[] = [];
  private sortKey = new Float64Array(512);
  /** Sort comparator over `sortKey` (descending, i.e. farthest first); created once, not per merge. */
  private readonly byFarthest = (a: number, b: number): number => this.sortKey[b] - this.sortKey[a];
  private coinMergeT = 0;
  private hitEv: HitEvent;
  private killEv: KillEvent;
  private gemEv: GemEvent;
  private shootEv = { x: 0, y: 0 };
  // reused hook payloads (hooks.ts: never allocate per event)
  /**
   * kill / hit hook payloads, one per nesting depth: a listener may land hits or kills itself (an
   * ofuda burst on kill, a blast on dash...), and the outer listeners must still read their own
   * event. Grown once per depth, then reused.
   */
  private readonly hKills: KillHook[] = [];
  private readonly hHits: HitHook[] = [];
  private killDepth = 0;
  private hitDepth = 0;
  private readonly hHurt: HurtHook = { dmg: 0, sx: 0, sy: 0, hp: 0 };
  private readonly hLethal: LethalHook = { dmg: 0, saved: false, by: "" };
  private readonly hDash: DashHook = { x: 0, y: 0, dx: 0, dy: 0 };
  private readonly hPickup: PickupHook = { kind: "coin", x: 0, y: 0, value: 0 };
  private readonly hBlock = { x: 0, y: 0, left: 0 };
  private readonly hValue = { value: 0 };
  private readonly hLevel = { level: 0 };
  private readonly hAmount = { amount: 0 };
  private readonly hStep = { dt: 0 };
  private readonly hBlast = { x: 0, y: 0, r: 0 };
  private readonly hEnemy = { enemy: null as unknown as Enemy };
  private readonly hBossKill = { enemy: null as unknown as Enemy, final: false };
  private readonly hPos = { x: 0, y: 0 };
  private readonly timers: Timer[] = [];
  private readonly collector: RunStatsCollector;
  /** Enemy id whose behaviour is running (bullet attribution). */
  private acting = "";

  constructor(opts: WorldOptions = {}) {
    this.rng = new Rng(opts.seed ?? ((Math.random() * 0xffffffff) >>> 0));
    this.hero = heroDef(opts.hero);
    this.meta = opts.meta ?? {};
    this.god = !!opts.god;
    this.viewW = opts.viewW ?? CFG.viewW;
    this.viewH = opts.viewH ?? CFG.viewH;
    this.maxEnemies = opts.maxEnemies ?? 350;
    this.directorOn = opts.director ?? true;
    const run = (this.run = opts.run ?? defaultRunConfig());
    this.stage = stageDef(run.stage);
    this.scaling = stageScaling(this.stage.scaling);
    this.ultId = this.hero.ult;
    this.weaponSlots = Math.max(1, Math.min(MAX_WEAPON_SLOTS, Math.floor(run.weaponSlots || CFG.weaponSlots)));
    this.passiveSlots = Math.max(0, Math.min(MAX_PASSIVE_SLOTS, Math.floor(run.passiveSlots ?? CFG.passiveSlots)));
    for (const id of run.twists) {
      const d = TWISTS.get(id);
      if (!d || this.twistIds.includes(id)) continue;
      this.twistIds.push(id);
      this.twistRanks[id] = Math.max(1, Math.min(d.maxRank, Math.floor(run.twistRanks?.[id] ?? 1)));
    }
    this.heat = twistHeat(this.twistIds, this.twistRanks);
    this.cons = constellationOf(run.constellation);
    const fl = run.flags;
    this.banishes = Math.max(0, Math.floor(fl.banish ?? 0));
    this.skips = Math.max(0, Math.floor(fl.skip ?? 0));
    this.freeRerolls = (fl.freeRerolls ?? 0) > 0;
    this.plotArmor = Math.max(0, Math.floor(fl.plotArmor ?? 0));
    const charges = Math.max(1, Math.min(5, 1 + Math.floor(fl.dashCharges ?? 0)));
    this.player = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      face: 1,
      aimX: 1,
      aimY: 0,
      hp: 1,
      maxHp: 1,
      iframes: 0,
      hurtT: 0,
      dashT: 0,
      dashCd: 0,
      dashMax: CFG.dashCd,
      dashDX: 1,
      dashDY: 0,
      dashInv: 0,
      dashCharges: charges,
      dashChargesMax: charges,
      shield: 0,
      shieldT: 0,
      moving: false,
      dead: false,
    };
    // weapon mastery damage (per weapon instance, see weaponDamageMul)
    this.startWeapon = this.hero.weapon;
    // power of friendship keystone: +x damage per different weapon held
    const friend = fl.friendship ?? 0;
    if (friend > 0) this.statMods.push((s) => void (s.might += friend * this.weapons.length));
    this.recomputeStats();
    this.director = new Director(this);
    const dummy = null as unknown as Enemy;
    this.hitEv = { x: 0, y: 0, dmg: 0, crit: false, color: 0xffffff, angle: 0, enemy: dummy, source: "" };
    this.killEv = { x: 0, y: 0, enemy: dummy, elite: false, boss: false, kills: 0 };
    this.gemEv = { x: 0, y: 0, value: 0, tier: 1 };
    // behaviour: twists, relics, talents, constellation, then the stage (each may add hooks, statMods,
    // difficulty, or swap the start weapon / ultimate before the run starts)
    for (const id of this.twistIds) TWISTS.get(id)?.install(this, this.twistRanks[id]);
    for (const r of run.relics) {
      const d = RELICS.get(r.id);
      if (d?.install) d.install(this, relicStars(r.stars));
    }
    // (the hero's own behaviour: a trait that is more than stats - Truck-kun's driving, Senpai's stare...)
    this.startLevel = Math.max(1, Math.floor(run.start.level || 1));
    this.hero.install?.(this);
    const tree = TALENT_TREES.get(this.hero.id);
    if (tree) for (const n of tree.nodes) {
      const rank = talentRank(run.talents[n.id], n.maxRank);
      if (rank > 0) n.install?.(this, rank);
    }
    const cons = this.hero.constellations;
    if (cons) for (let i = 0; i < Math.min(cons.length, this.cons); i++) cons[i].install?.(this);
    this.stage.onStart?.(this);
    this.collector = new RunStatsCollector(this);
    this.statsDirty = false;
    this.recomputeStats();
    this.player.hp = this.player.maxHp = this.stats.maxHp;
    this.player.shield = this.stats.shield;
    this.rerolls = this.stats.rerolls;
    this.revivesLeft = this.stats.revives + Math.max(0, Math.floor(fl.revives ?? 0));
    if (!this.difficulty.rerolls) this.rerolls = 0;
    this.ultMeter = Math.max(this.ultMeter, Math.min(CFG.ultMax, CFG.ultStart + Math.max(0, fl.ultStart ?? 0) * CFG.ultMax));
    this.addWeapon(this.startWeapon, this.startWeaponLevel);
    for (const sw of run.start.weapons) {
      // a start weapon the hero already holds (the board's "Prepared Protagonist" on the signature weapon) levels it up
      const lvl = Math.max(1, Math.floor(sw.level));
      const held = this.weapons.find((x) => x.def.id === sw.id);
      if (held) {
        if (lvl > held.level) this.setWeaponLevel(held, lvl);
      } else this.addWeapon(sw.id, lvl);
    }
    // (run modifiers that count weapons - Power of Friendship - see the start build right away)
    if (this.statsDirty) {
      this.statsDirty = false;
      this.recomputeStats();
    }
    // start at level N: those level-ups are picked on the first frames (the level-up modal / the bot)
    const lv = Math.max(1, Math.floor(this.startLevel));
    if (lv > 1) {
      this.level = lv;
      this.xpNext = xpToNext(lv);
      this.pendingLevels = lv - 1;
    }
  }

  /** Weapon the hero starts with and its level (talent capstones may change them in install()). */
  startWeapon: string;
  startWeaponLevel = 1;
  /**
   * Level the run starts at (RunConfig.start.level; hero traits / talents / constellations may raise
   * it in install(): Isekai-kun starts at Lv 3). Read once at the end of the constructor.
   */
  startLevel = 1;

  /** Is `e` this stage's final boss (and not an endless rematch)? */
  isFinalBoss(e: Enemy): boolean {
    return !this.endlessOn && e.def.id === this.stage.finalBoss;
  }

  /** Call `fn` every `seconds` of run time (relics / talents / twists). First call after `first` seconds (default: one period). */
  every(seconds: number, fn: (w: World) => void, first = seconds): void {
    this.timers.push({ every: Math.max(0.05, seconds), t: first, fn, once: false });
  }

  /** Call `fn` once after `seconds` of run time (only while the run plays). */
  after(seconds: number, fn: (w: World) => void): void {
    this.timers.push({ every: 0, t: Math.max(0, seconds), fn, once: true });
  }

  /** Rank of a talent node in this run (0 = not taken); weapon / ult code reads it. */
  talentRank(id: string): number {
    const n = this.run.talents[id];
    return n && n > 0 ? Math.floor(n) : 0;
  }

  /**
   * Extra damage for one weapon (and its evolution) as an additive fraction:
   * the same channel as mastery (RunConfig.weaponDamage). Talents call it from
   * install(); owned instances update right away.
   */
  addWeaponDamage(id: string, frac: number): void {
    this.weaponBonus[id] = (this.weaponBonus[id] ?? 0) + frac;
    for (const inst of this.weapons) inst.dmgMul = this.weaponDamageMul(inst.def) + (inst.lbInherit ?? 0);
  }

  /** Count a RunStats extra (content-specific counters: "nanis", "bakas", "charmed"...). */
  bumpStat(key: RunStatCounter, n = 1): void {
    this.collector.bump(key, n);
  }

  // ================================================================ events
  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    if (!this.muted) this.bus.emit(type, payload);
  }

  // ================================================================ step
  step(dt: number): void {
    if (dt <= 0) return;
    if (this.phase !== "play") {
      this.input.dash = this.input.ult = false;
      this.updateGemsIdle(dt);
      // (projectiles ended by win() outside a step - e.g. the Overdrive's - leave the list)
      const pr = this.projectiles;
      for (let i = pr.count - 1; i >= 0; i--) if (pr.items[i].dead) pr.removeAt(i);
      return;
    }
    const u = this.ult;
    if (u && u.phase === "cutin") {
      // anime cut-in: the simulation is paused (fx keep animating)
      u.t += dt;
      this.input.dash = this.input.ult = false;
      if (u.t >= CFG.cutinTime) {
        u.phase = "active";
        u.t = 0;
        this.clearBullets();
        u.def.start(this, u);
        this.emit("ultStart", { ult: u.def.id, x: this.player.x, y: this.player.y });
        this.hookUlt(u);
      }
      return;
    }
    this.t += dt;
    this.steps++;
    this.updatePlayer(dt);
    if (this.directorOn) this.director.update(dt);
    this.updateEnemies(dt);
    if (this.ult) this.updateUlt(dt);
    for (let i = 0; i < this.weapons.length; i++) {
      const wi = this.weapons[i];
      wi.t += dt;
      wi.def.update(this, wi, dt);
    }
    this.updateProjectiles(dt);
    this.updateBullets(dt);
    this.updateGems(dt);
    this.updatePickups(dt);
    for (let i = 0; i < this.telegraphs.count; i++) {
      const tg = this.telegraphs.items[i];
      tg.age += dt;
      if (tg.age >= tg.life) tg.dead = true;
    }
    this.updateCombo(dt);
    this.ultKillBudget = Math.min(CFG.ultKillCap * 2, this.ultKillBudget + CFG.ultKillCap * dt);
    if (!this.ult) this.addUlt(CFG.ultPerSecond * dt * this.stats.ultGain);
    if (this.freezeT > 0) this.freezeT = Math.max(0, this.freezeT - dt);
    this.updateEffects(dt);
    this.cleanup();
    this.rebuildGrid();
  }

  /** Relic / talent / twist timers, timed buffs, shield recharge, the step hook, pending stat recomputes. */
  private updateEffects(dt: number): void {
    const tm = this.timers;
    for (let i = 0; i < tm.length; i++) {
      const t = tm[i];
      t.t -= dt;
      if (t.t <= 0 && this.phase === "play") {
        if (t.once) {
          tm.splice(i--, 1);
          t.fn(this);
          continue;
        }
        t.t += t.every;
        if (t.t <= 0) t.t = t.every;
        t.fn(this);
      }
    }
    const bf = this.buffs;
    for (let i = 0; i < bf.length; i++) {
      const b = bf[i];
      if (b.t > 0) {
        b.t -= dt;
        if (b.t <= 0) {
          b.t = 0;
          this.statsDirty = true;
        }
      }
    }
    // shield recharge (charges above the max are bonus wards from effects: they stay until used)
    const p = this.player;
    const smax = this.stats.shield;
    if (p.shield < smax) {
      p.shieldT -= dt;
      if (p.shieldT <= 0) {
        p.shield++;
        p.shieldT = p.shield < smax ? this.stats.shieldCd : 0;
      }
    }
    if (this.hooks.has("step")) {
      this.hStep.dt = dt;
      this.hooks.emit("step", this.hStep);
    }
    if (this.statsDirty) {
      this.statsDirty = false;
      this.recomputeStats();
    }
  }

  /** After death / victory the world idles: enemies keep animating in place. */
  private updateGemsIdle(dt: number): void {
    for (let i = 0; i < this.enemies.count; i++) {
      const e = this.enemies.items[i];
      if (e.flash > 0) e.flash -= dt;
      e.t += dt;
    }
  }

  // ================================================================ player
  private updatePlayer(dt: number): void {
    const p = this.player;
    const inp = this.input;
    const s = this.stats;
    p.iframes = Math.max(0, p.iframes - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.dashInv = Math.max(0, p.dashInv - dt);
    const wasCd = p.dashCd > 0;
    p.dashCd = Math.max(0, p.dashCd - dt);
    if (wasCd && p.dashCd === 0) {
      // one charge back; with more missing, the next one starts recharging
      if (p.dashCharges < p.dashChargesMax) p.dashCharges++;
      if (p.dashCharges < p.dashChargesMax) p.dashCd = p.dashMax;
      this.emit("dashReady", {});
    }

    let mx = inp.mx;
    let my = inp.my;
    const ml = Math.sqrt(mx * mx + my * my);
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }
    p.moving = ml > 0.05;
    if (p.moving) {
      const l = Math.max(ml, 1e-6);
      p.aimX = mx / l;
      p.aimY = my / l;
    }

    if (inp.dash) this.tryDash();
    if (inp.ult) this.tryUlt();
    inp.dash = inp.ult = false;

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDX * CFG.dashSpeed;
      p.vy = p.dashDY * CFG.dashSpeed;
    } else if (this.mover) this.mover(this, mx, my, dt);
    else {
      const sp = CFG.playerSpeed * s.moveSpeed;
      p.vx = damp(p.vx, mx * sp, 22, dt);
      p.vy = damp(p.vy, my * sp, 22, dt);
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.vx > 3) p.face = 1;
    else if (p.vx < -3) p.face = -1;

    if (s.regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + s.regen * dt);
  }

  /** Dash if a charge is ready. Returns true when a dash started. */
  tryDash(): boolean {
    const p = this.player;
    if (p.dashCharges <= 0 || p.dashT > 0 || this.phase !== "play") return false;
    let dx = this.input.mx;
    let dy = this.input.my;
    const l = Math.sqrt(dx * dx + dy * dy);
    if (l < 0.1) {
      dx = p.aimX;
      dy = p.aimY;
    } else {
      dx /= l;
      dy /= l;
    }
    p.dashDX = dx;
    p.dashDY = dy;
    p.dashT = CFG.dashTime;
    p.dashInv = CFG.dashTime + CFG.dashInvulnExtra;
    p.dashMax = CFG.dashCd * this.stats.dashCd;
    p.dashCharges--;
    // (a charge already recharging keeps its progress)
    if (p.dashCd <= 0) p.dashCd = p.dashMax;
    this.emit("dash", { x: p.x, y: p.y, dx, dy });
    const h = this.hDash;
    h.x = p.x;
    h.y = p.y;
    h.dx = dx;
    h.dy = dy;
    this.hooks.emit("dash", h);
    return true;
  }

  /** Dash meter for the HUD / touch button: 1 while a charge is ready, else the recharge progress. */
  get dashMeter(): number {
    const p = this.player;
    if (p.dashCharges > 0) return 1;
    return p.dashMax > 0 ? 1 - p.dashCd / p.dashMax : 1;
  }

  get invulnerable(): boolean {
    const p = this.player;
    return this.god || p.iframes > 0 || p.dashInv > 0 || this.ult !== null;
  }

  /**
   * Damage the player (contact, bullets, explosions). Returns true if it hurt.
   * `by` names the source for RunStats.killedBy (enemy id / bullet sprite / effect id).
   */
  hurtPlayer(dmg: number, sx: number, sy: number, by = "hit"): boolean {
    const p = this.player;
    if (this.phase !== "play" || this.invulnerable) return false;
    const guards = this.hurtGuards;
    for (let i = 0; i < guards.length; i++) if (guards[i](dmg, sx, sy)) return true;
    if (p.shield > 0) {
      // a shield charge eats the whole hit (no damage, no combo loss), then i-frames
      if (p.shieldT <= 0) p.shieldT = this.stats.shieldCd;
      p.shield--;
      p.iframes = CFG.hurtIframes;
      const hb = this.hBlock;
      hb.x = p.x;
      hb.y = p.y;
      hb.left = p.shield;
      this.emit("shieldBlock", hb);
      this.hooks.emit("block", hb);
      return true;
    }
    const s = this.stats;
    let d = Math.max(1, Math.round(s.dmgReduction > 0 ? (dmg - s.armor) * (1 - s.dmgReduction) : dmg - s.armor));
    const hm = this.hurtMods;
    for (let i = 0; i < hm.length; i++) d = Math.max(1, Math.round(hm[i](d, sx, sy)));
    if (p.hp - d <= 0 && this.saveFromLethal(d)) return true;
    p.hp -= d;
    p.iframes = CFG.hurtIframes;
    p.hurtT = 0.3;
    this.damageTaken += d;
    const hh = this.hHurt;
    hh.dmg = d;
    hh.sx = sx;
    hh.sy = sy;
    hh.hp = p.hp;
    this.hooks.emit("hurt", hh);
    // a hit costs style: the combo drops one rank
    if (this.comboRank >= 1) this.dropRank();
    // small recoil away from the source (a heavy hero - Truck-kun - can't be knocked back)
    if (!this.heavy) {
      const ax = p.x - sx;
      const ay = p.y - sy;
      const al = Math.sqrt(ax * ax + ay * ay) || 1;
      p.vx += (ax / al) * 70;
      p.vy += (ay / al) * 70;
    }
    this.emit("playerHurt", { dmg: d, x: p.x, y: p.y, hp: Math.max(0, p.hp), maxHp: p.maxHp });
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.killedBy = by;
      this.phase = "dead";
      this.endCombo();
      this.emit("playerDied", { x: p.x, y: p.y });
    }
    return true;
  }

  /**
   * Plot Armor: a hit that would kill is survived at 1 HP when the keystone
   * (flags.plotArmor) has charges left or a `lethal` hook listener saves it.
   */
  private saveFromLethal(d: number): boolean {
    const p = this.player;
    const h = this.hLethal;
    h.dmg = d;
    h.saved = false;
    h.by = "";
    if (this.plotArmor > 0) {
      this.plotArmor--;
      h.saved = true;
      h.by = "plot_armor";
    }
    // listeners see a Plot Armor save (saved = true) and may save the hero themselves
    this.hooks.emit("lethal", h);
    if (!h.saved) return false;
    this.plotArmorSaves++;
    this.damageTaken += Math.max(0, p.hp - 1);
    p.hp = 1;
    p.iframes = this.plotArmorIframes;
    p.hurtT = 0.3;
    this.clearBullets();
    this.emit("plotArmor", { x: p.x, y: p.y, by: h.by });
    return true;
  }

  heal(amount: number, silent = false): void {
    const p = this.player;
    const before = p.hp;
    const mul = this.stats.healMul;
    p.hp = Math.min(p.maxHp, p.hp + (mul === 1 ? amount : amount * mul));
    const got = p.hp - before;
    if (!silent && got >= 1) this.emit("playerHeal", { amount: Math.round(got), x: p.x, y: p.y });
    if (got > 0 && this.hooks.has("heal")) {
      this.hAmount.amount = got;
      this.hooks.emit("heal", this.hAmount);
    }
  }

  /** Revive after death (Dream Shop). Returns false if none left. */
  revive(): boolean {
    if (this.phase !== "dead" || this.revivesLeft <= 0) return false;
    this.revivesLeft--;
    const p = this.player;
    p.dead = false;
    p.hp = Math.round(p.maxHp * 0.5);
    p.iframes = 2.5;
    this.phase = "play";
    this.clearBullets();
    // screen-clearing burst
    const hw = this.viewW * 0.6;
    const hh = this.viewH * 0.6;
    for (let i = 0; i < this.enemies.count; i++) {
      const e = this.enemies.items[i];
      if (e.dead || e.def.prop) continue;
      if (Math.abs(e.x - p.x) > hw || Math.abs(e.y - p.y) > hh) continue;
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      if (e.def.boss) this.hitEnemy(e, e.maxHp * 0.1, null, a, 0, 0, "revive", 0xffffff);
      else this.hitEnemy(e, e.hp + 1, null, a, 200, 0, "revive", 0xffffff);
    }
    this.emit("playerRevived", { x: p.x, y: p.y });
    this.hPos.x = p.x;
    this.hPos.y = p.y;
    this.hooks.emit("revive", this.hPos);
    // the final boss fell on the step the hero died: a Filler Arc run carries on, a normal run is won (Director)
    return true;
  }

  // ================================================================ overdrive
  addUlt(v: number): void {
    if (this.ult) return;
    this.ultMeter = Math.min(CFG.ultMax, this.ultMeter + v);
    if (this.ultMeter >= CFG.ultMax && !this.ultReadySent) {
      this.ultReadySent = true;
      this.emit("ultReady", {});
    }
  }
  get ultReady(): boolean {
    return this.ultMeter >= CFG.ultMax && !this.ult && this.phase === "play";
  }

  /** Cast the hero's ultimate if the meter is full. */
  tryUlt(): boolean {
    if (!this.ultReady) return false;
    const def = ULTIMATES.get(this.ultId);
    if (!def) return false;
    this.ultMeter = 0;
    this.ultReadySent = false;
    this.ult = { def, phase: "cutin", t: 0, power: (1 + (this.level - 1) * 0.06) * this.stats.ultPower, data: {} };
    this.emit("ultCutin", { hero: this.hero.id, ult: def.id, name: def.name });
    return true;
  }

  private readonly hUlt = { id: "", power: 1 };
  private hookUlt(u: UltState): void {
    this.hUlt.id = u.def.id;
    this.hUlt.power = u.power;
    this.hooks.emit("ult", this.hUlt);
  }

  private updateUlt(dt: number): void {
    const u = this.ult as UltState;
    u.t += dt;
    u.def.update(this, u, dt);
    if (u.t >= (u.dur ?? u.def.duration)) {
      u.def.end?.(this, u);
      this.timeStop = false;
      this.ult = null;
      this.emit("ultEnd", { ult: u.def.id });
      this.hUlt.id = u.def.id;
      this.hooks.emit("ultEnd", this.hUlt);
    }
  }

  // ================================================================ combo
  /** Length of the combo timer at the current rank (HUD bar). */
  get comboWindow(): number {
    return CFG.comboWindow[this.comboRank + 1] + this.stats.comboTime;
  }
  private addCombo(): void {
    this.combo++;
    const ct = this.stats.comboTime;
    const win = CFG.comboWindow[this.comboRank + 1] + ct;
    this.comboTimer = Math.min(win, Math.max(0, this.comboTimer) + CFG.comboRefill[this.comboRank + 1]);
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const r = rankFor(this.combo);
    if (r > this.comboRank) {
      this.comboRank = r;
      // a fresh rank starts with a full (shorter) window
      this.comboTimer = CFG.comboWindow[r + 1] + ct;
      this.emit("comboRank", { rank: r, id: RANKS[r].id, count: this.combo });
    }
  }
  private updateCombo(dt: number): void {
    if (this.combo <= 0) return;
    // (the ult cut-in pauses the whole step, so it never drains the combo)
    this.comboTimer -= dt;
    if (this.comboTimer > 0) return;
    if (this.comboRank >= 1) this.dropRank();
    else this.endCombo();
  }
  /** Fall one rank: the count drops to that rank's threshold and its window refills. */
  private dropRank(): void {
    const r = this.comboRank - 1;
    this.comboRank = r;
    this.combo = RANKS[r].at;
    this.comboTimer = CFG.comboWindow[r + 1] + this.stats.comboTime;
    this.emit("comboDrop", { rank: r, id: RANKS[r].id, count: this.combo });
  }
  private endCombo(): void {
    if (this.combo <= 0) return;
    const c = this.combo;
    this.combo = 0;
    this.comboRank = -1;
    this.comboTimer = 0;
    this.emit("comboBreak", { count: c });
  }
  get comboMult(): number {
    return this.comboRank >= 0 ? RANKS[this.comboRank].mult : 1;
  }

  // ================================================================ enemies
  /** Spawn an enemy by def at feet position (x, y). */
  spawnEnemy(def: EnemyDef | string, x: number, y: number, elite = false): Enemy | null {
    const d = typeof def === "string" ? enemyDef(def) : def;
    if (!d) return null;
    const e = this.enemies.spawn();
    e.uid = this.uidSeq++;
    e.def = d;
    e.x = x;
    e.y = y;
    e.vx = e.vy = e.kx = e.ky = 0;
    e.elite = elite && !d.boss && !d.prop;
    const sc = e.elite ? CFG.elite.scale : 1;
    e.scale = sc;
    e.r = d.radius * sc;
    e.cy = d.height * 0.5 * sc;
    // (the director is built after the constructor's first lines; nothing spawns before that)
    const df = this.difficulty;
    const hpScale = d.prop
      ? 1
      : d.boss
        ? bossHpScale(d.boss.level, this.level) * this.scaling.bossHp * df.bossHp
        : enemyHpScale(this.t, this.scaling) * (this.director?.hpMul ?? 1) * df.enemyHp * this.extraHpMul();
    e.maxHp = e.hp = Math.max(1, Math.round(d.hp * hpScale * (e.elite ? CFG.elite.hp * df.eliteHp : 1)));
    e.speed = d.speed * (e.elite ? CFG.elite.speed : 1) * (d.boss || d.prop ? 1 : df.enemySpeed * this.scaling.speed);
    e.dmg = d.dmg * (e.elite ? CFG.elite.dmg : 1) * (d.boss || d.prop ? 1 : enemyDmgScale(this.t, this.scaling)) * df.enemyDmg;
    e.face = x < this.player.x ? 1 : -1;
    e.t = 0;
    e.flash = 0;
    e.sqX = 1;
    e.sqV = 0;
    e.state = e.timer = e.a = e.b = e.c = e.d = 0;
    e.mode = MODE_AI;
    e.dead = false;
    e.lastHit.fill(-1e9);
    e.slow = 1;
    e.slowT = 0;
    e.alpha = 1;
    e.z = 0;
    e.inv = 0;
    e.skin = "";
    e.stun = 0;
    e.untargetable = false;
    if (d.prop) this.propCount++;
    else this.enemyCount++;
    d.init?.(e, this);
    if (!this.muted) {
      if (e.elite) this.bus.emit("eliteSpawned", { enemy: e });
    }
    if (e.elite && this.hooks.has("eliteSpawn")) {
      this.hEnemy.enemy = e;
      this.hooks.emit("eliteSpawn", this.hEnemy);
    }
    return e;
  }

  /** Enemy contact / shot damage multiplier now (the stage's toughness; enemy bullets that don't use `e.dmg` read it). */
  enemyDmgMul(): number {
    return enemyDmgScale(this.t, this.scaling);
  }

  /** Regular-enemy HP multiplier from the curse stat and the Filler Arc (1 in a plain run). */
  private extraHpMul(): number {
    let m = 1;
    const c = this.stats.curse;
    if (c > 0) m *= 1 + c * 0.25;
    if (this.endlessOn) m *= 1 + this.stage.endless.hpPerMinute * ((this.t - this.endlessFrom) / 60);
    return m;
  }

  /** Remove without drops/credit (despawn). */
  despawn(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    if (e.def.prop) this.propCount--;
    else this.enemyCount--;
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    const pcx = p.x;
    const pcy = p.y - PLAYER_CY;
    const frozen = this.freezeT > 0 || this.timeStop;
    const kd = Math.exp(-9 * dt);
    const hd = Math.sqrt(this.viewW * this.viewW + this.viewH * this.viewH) * 0.5;
    const far = hd * CFG.recycleFactor + 40;
    const far2 = far * far;
    const items = this.enemies.items;
    const buf = this.acquire();
    const pr = CFG.playerRadius * this.stats.hitbox;
    const cdm = this.contactDmg;
    for (let i = 0; i < this.enemies.count; i++) {
      const e = items[i];
      if (e.dead) continue;
      const d = e.def;
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.inv > 0) e.inv = Math.max(0, e.inv - dt);
      // cosmetic squash spring (inline springStep)
      const a = -340 * (e.sqX - 1) - 14 * e.sqV;
      e.sqV += a * dt;
      e.sqX += e.sqV * dt;
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) e.slow = 1;
      }
      if (d.prop) continue;
      // stunned / dazed (Enemy.stun): no behaviour, no own movement - knockback still carries it
      const stunned = e.stun > 0;
      if (stunned) e.stun = Math.max(0, e.stun - dt);
      if (frozen || stunned) {
        e.vx = e.vy = 0;
      } else if (e.mode !== MODE_STRAIGHT) {
        // (bullets fired during an enemy's update remember who shot them: RunStats.killedBy)
        this.acting = d.id;
        d.update(e, this, dt);
        this.acting = "";
      }
      // soft separation
      let sx = 0;
      let sy = 0;
      if (!d.noSeparation && !frozen) {
        const ecy = e.y - e.cy;
        const n = this.grid.query(e.x, ecy, e.r + 4, buf);
        for (let k = 0; k < n; k++) {
          const o = items[buf[k]];
          if (o === e || o.dead || o.def.prop) continue;
          const dx = e.x - o.x;
          const dy = ecy - (o.y - o.cy);
          const min = (e.r + o.r) * 0.85;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          if (d2 < 1e-4) {
            sx += (this.rng.next() - 0.5) * 0.6;
            sy += (this.rng.next() - 0.5) * 0.6;
            continue;
          }
          const dd = Math.sqrt(d2);
          // heavier (bigger) enemies get pushed less
          const k2 = ((min - dd) / dd) * (o.r / (e.r + o.r));
          sx += dx * k2;
          sy += dy * k2;
        }
        const sl = sx * sx + sy * sy;
        if (sl > 2.25) {
          const f = 1.5 / Math.sqrt(sl);
          sx *= f;
          sy *= f;
        }
      }
      const mv = frozen ? 0 : e.slow;
      e.x += (e.vx * mv + e.kx) * dt + sx * 0.5;
      e.y += (e.vy * mv + e.ky) * dt + sy * 0.5;
      e.kx *= kd;
      e.ky *= kd;
      if (!frozen) {
        if (e.vx > 1.5) e.face = 1;
        else if (e.vx < -1.5) e.face = -1;
      }
      // contact with the player
      const dx = e.x - pcx;
      const dy = e.y - e.cy - pcy;
      const rr = e.r + pr;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        if (e.dmg > 0 && !frozen) this.hurtPlayer(cdm === 1 ? e.dmg : e.dmg * cdm, e.x, e.y, d.id);
        // keep a little personal space so the hero stays readable
        if (d2 > 1e-4 && !d.boss) {
          const dd = Math.sqrt(d2);
          const push = ((rr - dd) / dd) * 0.25;
          e.x += dx * push;
          e.y += dy * push;
        }
      }
      // recycle stragglers to the spawn ring (keeps pressure on the player)
      if (d2 > far2 && !d.boss) {
        if (e.mode === MODE_STRAIGHT) this.despawn(e);
        else {
          this.edgePoint(18, this.tmp, true);
          e.x = this.tmp.x;
          e.y = this.tmp.y;
          e.kx = e.ky = 0;
        }
      }
    }
    // props far away get removed
    for (let i = 0; i < this.enemies.count; i++) {
      const e = items[i];
      if (!e.dead && e.def.prop) {
        const dx = e.x - pcx;
        const dy = e.y - pcy;
        if (dx * dx + dy * dy > far2 * 2.2) this.despawn(e);
      }
    }
    this.release();
  }

  /** Damage an enemy. Rolls crit + variance. Returns true if it died. */
  hitEnemy(e: Enemy, base: number, owner: WeaponInstance | null, angle: number, knock: number, critBonus: number, source: string, color: number): boolean {
    if (e.dead || e.inv > 0) return false;
    // Too Comfy (Kotatsu of Sloth): the hero dozes and no weapon deals damage (no hit, no hook, no number)
    if (this.dozing && (owner || WEAPONS.has(source))) return false;
    const s = this.stats;
    let crit = this.rng.next() < s.crit + critBonus;
    if (!crit && this.critRules.length) for (let i = 0; i < this.critRules.length && !crit; i++) crit = this.critRules[i](e, source);
    const v = CFG.damageVariance;
    let d = base * (1 + (this.rng.next() * 2 - 1) * v) * (crit ? s.critMult : 1);
    if (s.bossDmg !== 1 && (e.elite || e.def.boss)) d *= s.bossDmg;
    const taken = this.dmgTaken;
    for (let i = 0; i < taken.length; i++) d *= taken[i](e, source, crit);
    d = Math.max(1, Math.round(d));
    e.hp -= d;
    e.flash = 0.08;
    e.sqV -= crit ? 12 : 8;
    const resist = e.def.knockResist ?? 0;
    if (knock > 0 && resist < 1) {
      const k = knock * s.knock * (1 - resist) * (e.elite ? 0.4 : 1);
      e.kx += Math.cos(angle) * k;
      e.ky += Math.sin(angle) * k;
    }
    if (owner) owner.damage += d;
    const key = source || "misc";
    this.damageBy.set(key, (this.damageBy.get(key) ?? 0) + d);
    const hh = this.hHits[this.hitDepth] ?? (this.hHits[this.hitDepth] = { enemy: e, dmg: 0, crit: false, source: "", owner: null });
    hh.enemy = e;
    hh.dmg = d;
    hh.crit = crit;
    hh.source = key;
    hh.owner = owner;
    this.hitDepth++;
    this.hooks.emit("hit", hh);
    this.hitDepth--;
    if (!this.muted) {
      const ev = this.hitEv;
      ev.x = e.x;
      ev.y = e.y - e.cy;
      ev.dmg = d;
      ev.crit = crit;
      ev.color = color;
      ev.angle = angle;
      ev.enemy = e;
      ev.source = key;
      this.bus.emit("enemyHit", ev);
    }
    if (e.hp <= 0) {
      if (e.def.boss && this.difficulty.sequel > 0 && this.sequelHook(e)) return false;
      this.killEnemy(e, owner, key);
      return true;
    }
    return false;
  }

  /** Sequel Hook twist: a boss that would die gets back up once at 40 % HP with a 3 s flourish. */
  private sequelHook(e: Enemy): boolean {
    if (this.sequelUsed.has(e.uid)) return false;
    if (this.difficulty.sequel < 2 && !this.isFinalBoss(e)) return false;
    this.sequelUsed.add(e.uid);
    e.hp = Math.max(1, Math.round(e.maxHp * 0.4));
    e.inv = 3;
    this.clearBullets();
    this.emit("bossPhase", { id: e.def.id, phase: 9, x: e.x, y: e.y, title: "IT'S NOT OVER!", subtitle: "nobody really dies if there's a sequel" });
    return true;
  }

  /** Kill (credit + drops + events). `source` = damage source id of the killing blow (RunStats, hooks). */
  killEnemy(e: Enemy, owner: WeaponInstance | null, source = owner ? owner.def.id : ""): void {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    const d = e.def;
    if (d.prop) {
      this.propCount--;
      this.dropPropLoot(e.x, e.y);
      this.emit("propBroken", { x: e.x, y: e.y, sprite: d.sprite });
      this.hPos.x = e.x;
      this.hPos.y = e.y;
      this.hooks.emit("prop", this.hPos);
      return;
    }
    this.enemyCount--;
    this.kills++;
    if (owner) owner.kills++;
    this.addCombo();
    const gain = this.stats.ultGain;
    if (d.boss) this.addUlt(CFG.ultPerBoss * gain);
    else if (e.elite) this.addUlt(CFG.ultPerElite * gain);
    else if (!this.ult) {
      // ordinary kills charge the meter up to CFG.ultKillCap per second (hordes don't spam ults)
      const g = Math.min(this.ultKillBudget, CFG.ultPerKill);
      this.ultKillBudget -= g;
      this.addUlt(g * gain);
    }
    d.onDeath?.(e, this);
    // drops (later enemies are worth more XP)
    const xs = gemXpScale(this.t);
    if (d.boss) {
      this.dropGem(e.x, e.y, 100 * xs);
      this.dropPickup("chest", e.x, e.y, 1, true);
      for (let i = 0; i < CFG.bossCoinDrops; i++) this.dropPickup("coin", e.x, e.y, 1);
    } else if (e.elite) {
      this.dropGem(e.x, e.y, Math.max(25, d.xp * 10) * xs);
      this.dropPickup("chest", e.x, e.y, 1, false);
      for (let i = 0; i < CFG.eliteCoinDrops; i++) this.dropPickup("coin", e.x, e.y, 1);
    } else {
      if (d.xp > 0) this.dropGem(e.x, e.y, d.xp * xs);
      if (this.rng.next() < CFG.coinDropChance * this.stats.luck) this.dropPickup("coin", e.x, e.y, 1);
    }
    if (!this.muted) {
      const ev = this.killEv;
      ev.x = e.x;
      ev.y = e.y;
      ev.enemy = e;
      ev.elite = e.elite;
      ev.boss = !!d.boss;
      ev.kills = this.kills;
      this.bus.emit("enemyKilled", ev);
    }
    const hk = this.hKills[this.killDepth] ?? (this.hKills[this.killDepth] = { enemy: e, x: 0, y: 0, elite: false, boss: false, source: "", owner: null });
    hk.enemy = e;
    hk.x = e.x;
    hk.y = e.y;
    hk.elite = e.elite;
    hk.boss = !!d.boss;
    hk.source = source;
    hk.owner = owner;
    this.killDepth++;
    this.hooks.emit("kill", hk);
    this.killDepth--;
    if (d.boss) {
      if (this.boss === e) this.boss = null;
      this.director.onBossDied(e);
      const final = this.isFinalBoss(e);
      this.emit("bossKilled", { x: e.x, y: e.y, title: d.boss.title, final });
      const bk = this.hBossKill;
      bk.enemy = e;
      bk.final = final;
      this.hooks.emit("bossKill", bk);
      if (final) {
        this.stageCleared = true;
        this.finalBossDown = true;
        if (this.stage.onFinalBossKilled?.(this, e)) return;
        // (the player may have died earlier in this same step: the director then wins the run right after a revive;
        // an endless run starts its Filler Arc either way and carries on after the revive)
        if (this.run.endless) this.startEndless();
        else this.win();
      }
    }
  }

  /**
   * The Filler Arc: the final boss is down but the run goes on ("TO BE
   * CONTINUED... JUST KIDDING - FILLER ARC!"), with rising HP / spawn scaling,
   * elite waves and boss rematches (Director, StageDef.endless).
   */
  startEndless(): void {
    if (this.endlessOn) return;
    this.endlessOn = true;
    this.endlessFrom = this.t;
    this.director.startEndless();
    this.emit("fillerArc", { t: this.t, stage: this.stage.id });
    this.hooks.emit("endless", { t: this.t });
  }

  /** End the run in victory. */
  win(): void {
    if (this.phase !== "play") return;
    this.phase = "victory";
    this.endCombo();
    // the final blow can land mid-Overdrive: step() stops updating the ult once the run is
    // over, so close it here (no stuck time-stop tint / cast pose / frozen cats or meteors)
    const u = this.ult;
    if (u) {
      if (u.phase === "active") u.def.end?.(this, u);
      this.ult = null;
      this.timeStop = false;
      const ultId = this.ultId;
      const pr = this.projectiles;
      for (let i = 0; i < pr.count; i++) {
        const p = pr.items[i];
        if (!p.dead && (p.ch === CH_ULT || p.source === ultId)) p.dead = true;
      }
      this.emit("ultEnd", { ult: u.def.id });
    }
    this.emit("victory", { time: this.t });
  }

  /** Damage every enemy in a circle (ground point). */
  explode(x: number, y: number, r: number, dmg: number, owner: WeaponInstance | null, knock: number, source: string, color: number, big = false, critBonus = 0): number {
    const buf = this.acquire();
    const n = this.grid.query(x, y, r + 24, buf);
    let hits = 0;
    for (let k = 0; k < n; k++) {
      const e = this.enemies.items[buf[k]];
      if (!e || e.dead) continue;
      const dx = e.x - x;
      const dy = e.y - e.cy - y;
      const rr = r + e.r;
      if (dx * dx + dy * dy > rr * rr) continue;
      this.blastDepth++;
      this.hitEnemy(e, dmg, owner, Math.atan2(dy, dx), knock, critBonus, source, color);
      this.blastDepth--;
      hits++;
    }
    this.release();
    if (this.hooks.has("blast")) {
      const hb = this.hBlast;
      hb.x = x;
      hb.y = y;
      hb.r = r;
      this.hooks.emit("blast", hb);
    }
    this.emit("explosion", { x, y, r, source, big });
    return hits;
  }

  /** Damage every enemy inside the current view rect (bomb pickup, ult finishers). */
  hitAllInView(dmg: number, bossDmg: number, knock: number, source: string, color: number, ch = CH_MISC): number {
    const p = this.player;
    const hw = this.viewW * 0.5 + 8;
    const hh = this.viewH * 0.5 + 8;
    let n = 0;
    const cnt = this.enemies.count;
    for (let i = 0; i < cnt; i++) {
      const e = this.enemies.items[i];
      if (e.dead) continue;
      if (Math.abs(e.x - p.x) > hw || Math.abs(e.y - p.y) > hh) continue;
      e.lastHit[ch] = this.t;
      this.hitEnemy(e, e.def.boss ? bossDmg : dmg, null, Math.atan2(e.y - p.y, e.x - p.x), knock, 0, source, color);
      n++;
    }
    return n;
  }

  /**
   * New target for a homing projectile: the nearest live enemy within maxR that a
   * pierce-once projectile (hitEvery 0) has not hit yet (it could never hit it again).
   */
  homingTarget(p: Projectile, maxR: number): Enemy | null {
    this.homingP = p;
    const id = this.grid.nearest(p.x, p.y, maxR, this.acceptHoming);
    this.homingP = null;
    return id >= 0 ? this.enemies.items[id] : null;
  }
  private homingP: Projectile | null = null;
  private acceptHoming = (id: number): boolean => {
    const e = this.enemies.items[id];
    if (!e || e.dead || e.def.prop || e.untargetable) return false;
    const p = this.homingP;
    return !p || p.hitEvery > 0 || !hasHit(p, e.uid);
  };

  /** Nearest valid target (not dead, not a prop) to (x, y) within maxR, or null. */
  nearestEnemy(x: number, y: number, maxR: number): Enemy | null {
    const id = this.grid.nearest(x, y, maxR, this.acceptTarget);
    return id >= 0 ? this.enemies.items[id] : null;
  }
  private acceptTarget = (id: number): boolean => {
    const e = this.enemies.items[id];
    return !!e && !e.dead && !e.def.prop && !e.untargetable;
  };

  /**
   * Up to `max` distinct targets sorted by distance from (x, y) within maxR.
   * Fills `out` and returns the count.
   */
  nearestEnemies(x: number, y: number, maxR: number, max: number, out: Enemy[]): number {
    const buf = this.acquire();
    const n = this.grid.query(x, y, maxR, buf);
    const idx = this.sortIdx;
    idx.length = 0;
    if (this.sortKey.length < n) this.sortKey = new Float64Array(n * 2);
    for (let k = 0; k < n; k++) {
      const e = this.enemies.items[buf[k]];
      if (!e || e.dead || e.def.prop || e.untargetable) continue;
      const dx = e.x - x;
      const dy = e.y - e.cy - y;
      this.sortKey[buf[k]] = dx * dx + dy * dy;
      idx.push(buf[k]);
    }
    this.release();
    const key = this.sortKey;
    idx.sort((a, b) => key[a] - key[b]);
    const m = Math.min(max, idx.length);
    for (let i = 0; i < m; i++) out[i] = this.enemies.items[idx[i]];
    return m;
  }

  /** A random on-screen valid target (or null). */
  randomEnemyInView(margin = -8): Enemy | null {
    const p = this.player;
    const hw = this.viewW * 0.5 + margin;
    const hh = this.viewH * 0.5 + margin;
    const cnt = this.enemies.count;
    if (cnt === 0) return null;
    const start = this.rng.int(0, cnt - 1);
    for (let k = 0; k < cnt; k++) {
      const e = this.enemies.items[(start + k) % cnt];
      if (e.dead || e.def.prop || e.untargetable) continue;
      if (Math.abs(e.x - p.x) <= hw && Math.abs(e.y - p.y) <= hh) return e;
    }
    return null;
  }

  /** Query enemy grid ids around a centre point. Use acquire()/release() around the buffer. */
  acquire(): number[] {
    let b = this.qBufs[this.qDepth];
    if (!b) b = this.qBufs[this.qDepth] = [];
    this.qDepth++;
    return b;
  }
  release(): void {
    this.qDepth--;
  }

  private rebuildGrid(): void {
    const g = this.grid;
    g.clear();
    const items = this.enemies.items;
    for (let i = 0; i < this.enemies.count; i++) {
      const e = items[i];
      g.insert(i, e.x, e.y - e.cy, e.r);
    }
  }

  private cleanup(): void {
    const en = this.enemies;
    for (let i = en.count - 1; i >= 0; i--) if (en.items[i].dead) en.removeAt(i);
    const pr = this.projectiles;
    for (let i = pr.count - 1; i >= 0; i--) if (pr.items[i].dead) pr.removeAt(i);
    const bl = this.bullets;
    for (let i = bl.count - 1; i >= 0; i--) if (bl.items[i].dead) bl.removeAt(i);
    const gm = this.gems;
    for (let i = gm.count - 1; i >= 0; i--) if (gm.items[i].dead) gm.removeAt(i);
    const pk = this.pickups;
    for (let i = pk.count - 1; i >= 0; i--) if (pk.items[i].dead) pk.removeAt(i);
    const tg = this.telegraphs;
    for (let i = tg.count - 1; i >= 0; i--) if (tg.items[i].dead) tg.removeAt(i);
  }

  // ================================================================ spawn geometry
  readonly tmp = { x: 0, y: 0 };

  /**
   * A point on the rectangle just outside the view (centred on the player),
   * `margin` px beyond the edge. With `ahead`, biased toward the side the
   * player is moving to (keeps them running into enemies, VS-style).
   */
  edgePoint(margin: number, out: { x: number; y: number }, ahead = false): { x: number; y: number } {
    const p = this.player;
    const hw = this.viewW * 0.5 + margin;
    const hh = this.viewH * 0.5 + margin;
    const r = this.rng;
    let side: number;
    const sp = Math.abs(p.vx) + Math.abs(p.vy);
    if (ahead && sp > 10 && r.next() < 0.5) {
      side = Math.abs(p.vx) * hh > Math.abs(p.vy) * hw ? (p.vx > 0 ? 1 : 3) : p.vy > 0 ? 2 : 0;
    } else {
      const t = r.next() * (hw + hh) * 2;
      side = t < hw ? 0 : t < hw + hh ? 1 : t < hw * 2 + hh ? 2 : 3;
    }
    const u = r.next() * 2 - 1;
    switch (side) {
      case 0: // top
        out.x = p.x + u * hw;
        out.y = p.y - hh;
        break;
      case 1: // right
        out.x = p.x + hw;
        out.y = p.y + u * hh;
        break;
      case 2: // bottom
        out.x = p.x + u * hw;
        out.y = p.y + hh + 10;
        break;
      default:
        out.x = p.x - hw;
        out.y = p.y + u * hh;
    }
    return out;
  }

  // ================================================================ projectiles
  /** Take a projectile from the pool (all fields reset). Configure it, it's live immediately. */
  spawnProjectile(owner: WeaponInstance | null, source?: string): Projectile {
    const p = this.projectiles.spawn();
    resetProjectile(p);
    p.uid = this.uidSeq++;
    p.owner = owner;
    p.ch = owner ? owner.slot : CH_MISC;
    p.source = source ?? owner?.def.id ?? "";
    return p;
  }

  /** End a projectile (calls onEnd once). */
  endProjectile(p: Projectile): void {
    if (p.dead) return;
    p.dead = true;
    p.onEnd?.(p, this, 0);
  }

  private updateProjectiles(dt: number): void {
    const pl = this.player;
    const items = this.projectiles.items;
    for (let i = 0; i < this.projectiles.count; i++) {
      const p = items[i];
      if (p.dead) continue;
      p.age += dt;
      if (p.update) p.update(p, this, dt);
      if (p.dead) continue;
      switch (p.kind) {
        case PK_FREE: {
          if (p.homing > 0 && p.age >= p.delay) {
            let t = p.target;
            // (pooled enemies: a dead target's object may already be a NEW enemy elsewhere - compare uids;
            // a pierce-once shot that already hit its surviving target moves on too)
            if (t && (t.dead || t.uid !== p.targetUid || (p.hitEvery <= 0 && hasHit(p, t.uid)))) t = p.target = null;
            if (!t) {
              t = p.target = this.homingTarget(p, HOMING_RANGE);
              p.targetUid = t ? t.uid : 0;
            }
            if (t) {
              const want = Math.atan2(t.y - t.cy - p.y, t.x - p.x);
              const cur = Math.atan2(p.vy, p.vx);
              let da = want - cur;
              while (da > Math.PI) da -= TAU;
              while (da < -Math.PI) da += TAU;
              const step = p.homing * dt;
              const na = cur + clamp(da, -step, step);
              const sp = p.speed || Math.sqrt(p.vx * p.vx + p.vy * p.vy);
              p.vx = Math.cos(na) * sp;
              p.vy = Math.sin(na) * sp;
            }
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        }
        case PK_ATTACHED:
          p.x = pl.x + p.ox;
          p.y = pl.y + p.oy;
          break;
        case PK_FALL:
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (p.z <= 0) {
            p.z = 0;
            this.endProjectile(p);
            continue;
          }
          break;
        default:
          break;
      }
      if (p.rotMode === ROT_VELOCITY) p.rot = Math.atan2(p.vy, p.vx);
      else if (p.rotMode === ROT_SPIN) p.rot += p.spin * dt;
      if (p.age >= p.life) {
        this.endProjectile(p);
        continue;
      }
      if (p.r > 0 && p.age >= p.delay && p.kind !== PK_FALL) this.projectileHits(p);
    }
  }

  private projectileHits(p: Projectile): void {
    const reach = p.shape === SHAPE_CIRCLE ? p.r : Math.max(p.r, p.hw, p.hh);
    const buf = this.acquire();
    const n = this.grid.query(p.x, p.y, reach + 26, buf);
    const items = this.enemies.items;
    const cosA = Math.cos(-p.ang);
    const sinA = Math.sin(-p.ang);
    for (let k = 0; k < n; k++) {
      const e = items[buf[k]];
      if (!e || e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - e.cy - p.y;
      if (p.shape === SHAPE_CIRCLE) {
        const rr = p.r + e.r;
        if (dx * dx + dy * dy > rr * rr) continue;
      } else if (p.shape === SHAPE_ELLIPSE) {
        const lx = dx * cosA - dy * sinA;
        const ly = dx * sinA + dy * cosA;
        const ax = p.hw + e.r * 0.8;
        const ay = p.hh + e.r * 0.8;
        if ((lx * lx) / (ax * ax) + (ly * ly) / (ay * ay) > 1) continue;
      } else if (p.shape === SHAPE_RING) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > p.r + e.r || d < p.r - p.hw - e.r) continue;
      }
      if (p.hitEvery > 0) {
        if (this.t - e.lastHit[p.ch] < p.hitEvery) continue;
        e.lastHit[p.ch] = this.t;
      } else {
        let seen = false;
        const m = Math.min(p.nHits, p.hits.length);
        for (let h = 0; h < m; h++)
          if (p.hits[h] === e.uid) {
            seen = true;
            break;
          }
        if (seen) continue;
        p.hits[p.nHits % p.hits.length] = e.uid;
        p.nHits++;
      }
      const ang = p.kind === PK_FREE && (p.vx !== 0 || p.vy !== 0) ? Math.atan2(p.vy, p.vx) : Math.atan2(dy, dx);
      const color = p.owner ? p.owner.def.color : p.tint;
      this.hitProj = p;
      this.hitEnemy(e, p.dmg, p.owner, ang, p.knock, p.crit, p.source, color);
      this.hitProj = null;
      p.onHit?.(p, this, e);
      if (p.dead) break;
      p.pierce--;
      if (p.pierce <= 0) {
        this.endProjectile(p);
        break;
      }
    }
    this.release();
  }

  // ================================================================ telegraphs
  /** Warn about a circular danger zone for `life` seconds (drawn by the view, filling up). */
  telegraphCircle(x: number, y: number, r: number, life: number, color = 0xff4d6d): Telegraph {
    const t = this.telegraphs.spawn();
    t.shape = 0;
    t.x = x;
    t.y = y;
    t.r = r;
    t.age = 0;
    t.life = life;
    t.color = color;
    t.dead = false;
    this.emit("telegraph", { x, y, r });
    return t;
  }

  /** Warn about a straight lane (dashes) of half width `r`. */
  telegraphLine(x: number, y: number, x2: number, y2: number, r: number, life: number, color = 0xff4d6d): Telegraph {
    const t = this.telegraphCircle(x, y, r, life, color);
    t.shape = 1;
    t.x2 = x2;
    t.y2 = y2;
    return t;
  }

  // ================================================================ enemy bullets
  spawnBullet(x: number, y: number, vx: number, vy: number, dmg: number, sprite = "eb_orb", r = 3, life = 5): Bullet {
    // hygiene: past the cap the shot is dropped (callers may still configure the returned scratch bullet)
    if (this.bullets.count >= CFG.maxBullets) return this.droppedBullet;
    const b = this.bullets.spawn();
    const df = this.difficulty;
    b.x = x;
    b.y = y;
    b.vx = df.bulletSpeed === 1 ? vx : vx * df.bulletSpeed;
    b.vy = df.bulletSpeed === 1 ? vy : vy * df.bulletSpeed;
    b.dmg = df.enemyDmg === 1 ? dmg : dmg * df.enemyDmg;
    b.sprite = sprite;
    b.r = r;
    b.life = life;
    b.age = 0;
    b.turn = 0;
    b.accel = 0;
    b.from = this.acting;
    b.tint = 0xffffff;
    b.dead = false;
    if (!this.muted) {
      // one reused payload (bursts of 16+ bullets are common); audio rate-limits the sfx
      const ev = this.shootEv;
      ev.x = x;
      ev.y = y;
      this.bus.emit("enemyShoot", ev);
    }
    return b;
  }

  /** Scratch returned by spawnBullet past the cap (never simulated). */
  private readonly droppedBullet: Bullet = newBullet();

  /** Remove every enemy bullet (bomb, ultimate, revive, boss phase changes). Emits `bulletsCleared` first. */
  clearBullets(): void {
    if (this.bullets.count > 0 && !this.muted) this.bus.emit("bulletsCleared", { n: this.bullets.count });
    this.bullets.clear();
  }

  private updateBullets(dt: number): void {
    const p = this.player;
    const pcy = p.y - PLAYER_CY;
    const frozen = this.freezeT > 0 || this.timeStop;
    // off-screen culling bounds (bullets far beyond the view edge can never matter again)
    const cullX = this.viewW * 0.5 + CFG.bulletCullMargin;
    const cullY = this.viewH * 0.5 + CFG.bulletCullMargin;
    for (let i = 0; i < this.bullets.count; i++) {
      const b = this.bullets.items[i];
      if (b.dead) continue;
      if (frozen) continue;
      b.age += dt;
      if (b.turn !== 0) {
        const c = Math.cos(b.turn * dt);
        const s = Math.sin(b.turn * dt);
        const vx = b.vx * c - b.vy * s;
        b.vy = b.vx * s + b.vy * c;
        b.vx = vx;
      }
      if (b.accel !== 0) {
        const l = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
        const nl = Math.max(0, l + b.accel * dt);
        b.vx *= nl / l;
        b.vy *= nl / l;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.age >= b.life) {
        b.dead = true;
        continue;
      }
      const dx = b.x - p.x;
      const dy = b.y - pcy;
      if (dx > cullX || dx < -cullX || dy > cullY || dy < -cullY) {
        b.dead = true;
        continue;
      }
      const rr = b.r + CFG.playerRadius * this.stats.hitbox - 2;
      if (dx * dx + dy * dy < rr * rr) {
        if (this.hurtPlayer(b.dmg, b.x, b.y, b.from || b.sprite)) b.dead = true;
      }
    }
  }

  // ================================================================ gems & pickups
  dropGem(x: number, y: number, value: number, tier = 0): Gem {
    const g = this.gems.spawn();
    g.x = x + (this.rng.next() - 0.5) * 4;
    g.y = y;
    g.z = 2;
    g.vz = 70 + this.rng.next() * 40;
    const a = this.rng.angle();
    const s = 14 + this.rng.next() * 18;
    g.vx = Math.cos(a) * s;
    g.vy = Math.sin(a) * s * 0.6;
    g.value = value;
    g.tier = tier || (value >= 25 ? 3 : value >= 5 ? 2 : 1);
    g.state = 0;
    g.speed = 0;
    g.t = 0;
    g.dead = false;
    return g;
  }

  dropPickup(kind: PickupKind, x: number, y: number, value = 1, golden = false): Pickup {
    const k = this.pickups.spawn();
    k.kind = kind;
    k.x = x;
    k.y = y;
    k.z = 2;
    const burst = kind === "coin" ? 1 : 0.45;
    k.vz = (80 + this.rng.next() * 60) * (kind === "chest" ? 1.4 : 1);
    const a = this.rng.angle();
    const s = (20 + this.rng.next() * 40) * burst;
    k.vx = Math.cos(a) * s;
    k.vy = Math.sin(a) * s * 0.6;
    k.value = value;
    k.golden = golden;
    k.censored = false;
    k.sprite = "";
    k.tint = 0xffffff;
    k.state = 0;
    k.speed = 0;
    k.t = 0;
    k.dead = false;
    if (kind === "chest") this.emit("chestDropped", { x, y, golden });
    return k;
  }

  private dropPropLoot(x: number, y: number): void {
    const r = this.rng;
    let total = 0;
    for (const l of PROP_LOOT) total += l.w * (l.luck ? this.stats.luck : 1);
    let roll = r.next() * total;
    let kind: PickupKind = "coin";
    for (const l of PROP_LOOT) {
      roll -= l.w * (l.luck ? this.stats.luck : 1);
      if (roll <= 0) {
        kind = l.kind;
        break;
      }
    }
    // don't drop food at full HP (or when food is censored) - give coins instead
    let censored = false;
    if (kind === "onigiri" || kind === "cake") {
      censored = !this.difficulty.food;
      if (censored || this.player.hp >= this.player.maxHp) kind = "coin";
    }
    if (kind === "coin") {
      const n = r.int(3, 6);
      for (let i = 0; i < n; i++) this.dropPickup("coin", x, y, 1).censored = censored;
    } else this.dropPickup(kind, x, y);
  }

  private updateGems(dt: number): void {
    const p = this.player;
    let pr = CFG.pickupRadius * this.stats.pickup;
    // starter vacuum: the first level-ups come in seconds, whatever the hero does
    if (this.level < 3 && this.t < CFG.starterVacuumTime) pr = Math.max(pr, CFG.starterVacuum);
    const pr2 = pr * pr;
    const tx = p.x;
    const ty = p.y - 6;
    const cr = CFG.collectRadius;
    const items = this.gems.items;
    const decay = Math.exp(-5 * dt);
    for (let i = 0; i < this.gems.count; i++) {
      const g = items[i];
      if (g.dead) continue;
      g.t += dt;
      if (g.z > 0 || g.vz > 0) {
        g.vz -= 380 * dt;
        g.z += g.vz * dt;
        if (g.z <= 0) {
          g.z = 0;
          g.vz = g.vz < -40 ? -g.vz * 0.3 : 0;
        }
      }
      const dx = tx - g.x;
      const dy = ty - g.y;
      const d2 = dx * dx + dy * dy;
      if (g.state === 0) {
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.vx *= decay;
        g.vy *= decay;
        // merged rainbow gems (the XP left behind) float home on their own
        if (g.tier === 4 && g.t > 0.6 && d2 > 1) {
          const d = Math.sqrt(d2);
          g.x += (dx / d) * CFG.mergedGemDrift * dt;
          g.y += (dy / d) * CFG.mergedGemDrift * dt;
        }
        if (d2 < pr2 && g.t > 0.12) {
          g.state = 1;
          g.speed = CFG.gemStartSpeed;
        }
      } else {
        g.speed += CFG.gemAccel * dt;
        const d = Math.sqrt(d2);
        if (d <= cr + g.speed * dt) {
          this.collectGem(g);
          continue;
        }
        g.x += (dx / d) * g.speed * dt;
        g.y += (dy / d) * g.speed * dt;
        g.z *= decay;
      }
    }
    this.mergeT -= dt;
    if (this.mergeT <= 0) {
      this.mergeT = 0.5;
      if (this.gems.count > CFG.maxGems) this.mergeGems();
    }
  }

  private collectGem(g: Gem): void {
    g.dead = true;
    const gain = g.value * this.comboMult * this.stats.growth;
    if (!this.muted) {
      const ev = this.gemEv;
      ev.x = g.x;
      ev.y = g.y;
      ev.value = g.value;
      ev.tier = g.tier;
      this.bus.emit("gem", ev);
    }
    if (this.hooks.has("gem")) {
      this.hValue.value = gain;
      this.hooks.emit("gem", this.hValue);
    }
    this.addXp(gain);
  }

  /** Merge the farthest gems into one rainbow gem_4 (DESIGN §2: > 250 gems). */
  private mergeGems(): void {
    const items = this.gems.items;
    const n = this.gems.count;
    const p = this.player;
    const idx = this.sortIdx;
    idx.length = 0;
    if (this.sortKey.length < n) this.sortKey = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      const g = items[i];
      if (g.dead || g.state !== 0) continue;
      const dx = g.x - p.x;
      const dy = g.y - p.y;
      this.sortKey[i] = dx * dx + dy * dy;
      idx.push(i);
    }
    const excess = n - CFG.mergeKeep;
    if (excess <= 1 || idx.length < 2) return;
    idx.sort(this.byFarthest);
    const m = Math.min(excess, idx.length);
    let sum = 0;
    const far = items[idx[0]];
    for (let k = 0; k < m; k++) {
      const g = items[idx[k]];
      sum += g.value;
      g.dead = true;
    }
    const mg = this.dropGem(far.x, far.y, sum, 4);
    mg.vz = 60;
  }

  private updatePickups(dt: number): void {
    this.coinMergeT -= dt;
    if (this.coinMergeT <= 0) {
      this.coinMergeT = 0.5;
      if (this.pickups.count > CFG.maxCoins) this.mergeCoins();
    }
    const p = this.player;
    let pr = CFG.pickupRadius * this.stats.pickup;
    // starter vacuum: the first level-ups come in seconds, whatever the hero does
    if (this.level < 3 && this.t < CFG.starterVacuumTime) pr = Math.max(pr, CFG.starterVacuum);
    const pr2 = pr * pr;
    const tx = p.x;
    const ty = p.y - 6;
    const decay = Math.exp(-4 * dt);
    for (let i = 0; i < this.pickups.count; i++) {
      const k = this.pickups.items[i];
      if (k.dead) continue;
      k.t += dt;
      if (k.z > 0 || k.vz > 0) {
        k.vz -= 400 * dt;
        k.z += k.vz * dt;
        if (k.z <= 0) {
          k.z = 0;
          k.vz = k.vz < -50 ? -k.vz * 0.35 : 0;
        }
      }
      const dx = tx - k.x;
      const dy = ty - k.y;
      const d2 = dx * dx + dy * dy;
      if (k.state === 0) {
        k.x += k.vx * dt;
        k.y += k.vy * dt;
        k.vx *= decay;
        k.vy *= decay;
        if (k.t < 0.35) continue;
        if (k.kind === "coin" || k.kind === "heart") {
          if (d2 < pr2) {
            k.state = 1;
            k.speed = CFG.gemStartSpeed;
          }
        } else {
          const rr = k.kind === "chest" ? 14 : 11;
          if (d2 < rr * rr) this.collectPickup(k);
        }
      } else {
        k.speed += CFG.gemAccel * dt;
        const d = Math.sqrt(d2);
        if (d <= CFG.collectRadius + k.speed * dt) {
          this.collectPickup(k);
          continue;
        }
        k.x += (dx / d) * k.speed * dt;
        k.y += (dy / d) * k.speed * dt;
      }
    }
  }

  /**
   * Coins left behind would pile up for the whole run (2 % of kills drop one): above
   * CFG.maxCoins the farthest resting coins fold into the nearest of them (its value
   * becomes the sum, drawn as a bigger coin). Nothing is lost or gained: same coins,
   * same total value, a bounded pickup list.
   */
  private mergeCoins(): void {
    const items = this.pickups.items;
    const n = this.pickups.count;
    const p = this.player;
    const idx = this.sortIdx;
    idx.length = 0;
    if (this.sortKey.length < n) this.sortKey = new Float64Array(n * 2);
    let coins = 0;
    for (let i = 0; i < n; i++) {
      const k = items[i];
      if (k.dead || k.kind !== "coin") continue;
      coins++;
      if (k.state !== 0 || k.z > 0) continue;
      const dx = k.x - p.x;
      const dy = k.y - p.y;
      this.sortKey[i] = dx * dx + dy * dy;
      idx.push(i);
    }
    const excess = coins - CFG.coinMergeKeep;
    if (excess < 1 || idx.length < 2) return;
    idx.sort(this.byFarthest);
    const m = Math.min(excess + 1, idx.length);
    // fold the m farthest into the nearest of them (index m - 1)
    const keep = items[idx[m - 1]];
    for (let j = 0; j < m - 1; j++) {
      const k = items[idx[j]];
      keep.value += k.value;
      k.dead = true;
    }
  }

  private collectPickup(k: Pickup): void {
    k.dead = true;
    const p = this.player;
    const hp = this.hPickup;
    hp.kind = k.kind;
    hp.x = k.x;
    hp.y = k.y;
    hp.value = 1;
    switch (k.kind) {
      case "coin": {
        const v = k.value * this.stats.greed;
        this.coins += v;
        this.emit("coin", { x: k.x, y: k.y, value: v });
        hp.value = v;
        this.hooks.emit("pickup", hp);
        return;
      }
      case "onigiri":
        this.heal(20);
        break;
      case "heart":
      case "snack":
        this.heal(k.value);
        hp.value = k.value;
        break;
      case "cake":
        this.heal(50);
        break;
      case "magnet":
        this.magnetAll();
        this.emit("magnet", { x: k.x, y: k.y });
        break;
      case "bomb":
        this.emit("bomb", { x: p.x, y: p.y });
        this.clearBullets();
        this.hitAllInView(80 * this.stats.might + this.t * 0.4, 120, 160, "bomb", 0xffe14d);
        break;
      case "clock":
        this.freezeT = 5;
        this.emit("freeze", { seconds: 5 });
        break;
      case "chest":
        this.pendingChests.push({ golden: k.golden });
        this.emit("chestCollected", { x: k.x, y: k.y, golden: k.golden });
        this.hooks.emit("pickup", hp);
        return;
    }
    this.emit("pickup", { kind: k.kind, x: k.x, y: k.y });
    this.hooks.emit("pickup", hp);
  }

  /** Pull every gem (and coin) toward the player. */
  magnetAll(): void {
    for (let i = 0; i < this.gems.count; i++) {
      const g = this.gems.items[i];
      if (g.state === 0) {
        g.state = 1;
        g.speed = 90;
      }
    }
    for (let i = 0; i < this.pickups.count; i++) {
      const k = this.pickups.items[i];
      if (k.kind === "coin" && k.state === 0) {
        k.state = 1;
        k.speed = 90;
      }
    }
  }

  // ================================================================ xp / level
  addXp(v: number): void {
    if (this.phase !== "play") return;
    this.xp += v;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpToNext(this.level);
      this.pendingLevels++;
      this.emit("levelUp", { level: this.level, x: this.player.x, y: this.player.y });
      if (this.difficulty.levelHeal) this.heal(Math.max(3, this.player.maxHp * CFG.levelHeal));
      this.hLevel.level = this.level;
      this.hooks.emit("levelUp", this.hLevel);
    }
  }

  // ================================================================ build
  hasWeapon(id: string): WeaponInstance | undefined {
    return this.weapons.find((w) => w.def.id === id);
  }
  passiveLevel(id: string): number {
    return this.passives.find((p) => p.def.id === id)?.level ?? 0;
  }

  addWeapon(id: string, level = 1): WeaponInstance | null {
    const def = WEAPONS.get(id);
    if (!def || this.hasWeapon(id) || this.weapons.length >= this.weaponSlots) return null;
    const used = new Set(this.weapons.map((w) => w.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    const inst: WeaponInstance = {
      def,
      level: Math.min(level, this.weaponMaxLevel(def)),
      slot,
      timer: 0.25,
      t: 0,
      projs: [],
      uids: [],
      data: {},
      damage: 0,
      kills: 0,
      dmgMul: this.weaponDamageMul(def),
    };
    this.weapons.push(inst);
    this.weapons.sort((a, b) => a.slot - b.slot);
    this.buildVersion++;
    if (!this.weaponsUsed.includes(id)) this.weaponsUsed.push(id);
    if (this.statMods.length) this.statsDirty = true;
    def.init?.(this, inst);
    return inst;
  }

  setWeaponLevel(inst: WeaponInstance, level: number): void {
    inst.level = Math.max(1, Math.min(this.weaponMaxLevel(inst.def), level));
    this.buildVersion++;
  }

  /**
   * Highest level of a weapon in this run: its levels plus the mastery Limit
   * Break bonus (RunConfig.weaponLevelBonus, base weapons only). An evolution
   * instead inherits +CFG.limitBreakInherit damage per Limit Break level its
   * base had when it evolved (docs/content/weapons.md §4).
   */
  weaponMaxLevel(def: WeaponDef): number {
    const lb = this.run.weaponLevelBonus;
    if (!lb || def.evolved) return def.levels.length;
    return def.levels.length + Math.max(0, Math.min(4, Math.floor(lb[def.id] ?? 0)));
  }

  /** Mastery damage multiplier of a weapon (RunConfig.weaponDamage; an evolution adds its base weapon's entry). */
  weaponDamageMul(def: WeaponDef): number {
    const wd = this.run.weaponDamage;
    const wb = this.weaponBonus;
    let k = (wd?.[def.id] ?? 0) + (wb[def.id] ?? 0);
    if (def.evolved) {
      const b = baseWeaponOf(def);
      if (b !== def) k += (wd?.[b.id] ?? 0) + (wb[b.id] ?? 0);
    }
    return k === 0 ? 1 : 1 + Math.max(-0.9, k);
  }

  /** May the level-up cards offer this weapon / passive as NEW (pool + banish)? */
  inPool(kind: "weapon" | "passive", id: string): boolean {
    if (this.banished.has(id)) return false;
    const pool = kind === "weapon" ? this.run.weaponPool : this.run.passivePool;
    return !pool || pool.includes(id);
  }

  /** Replace a maxed base weapon with its evolution (same slot, keeps damage stats). */
  evolveWeapon(inst: WeaponInstance): WeaponInstance | null {
    const evo = inst.def.evolution ? WEAPONS.get(inst.def.evolution.into) : undefined;
    if (!evo) return null;
    inst.def.dispose?.(this, inst);
    for (let i = 0; i < inst.projs.length; i++) if (inst.projs[i].uid === inst.uids[i]) inst.projs[i].dead = true;
    inst.projs.length = 0;
    inst.uids.length = 0;
    // Limit Break inheritance: +15% per Limit Break level the base reached before evolving
    const lbInherit = CFG.limitBreakInherit * Math.max(0, inst.level - inst.def.levels.length);
    const next: WeaponInstance = {
      def: evo,
      level: 1,
      slot: inst.slot,
      timer: 0.1,
      t: 0,
      projs: [],
      uids: [],
      data: {},
      damage: inst.damage,
      kills: inst.kills,
      dmgMul: this.weaponDamageMul(evo) + lbInherit,
      lbInherit,
    };
    const i = this.weapons.indexOf(inst);
    this.weapons[i] = next;
    this.buildVersion++;
    if (!this.weaponsUsed.includes(evo.id)) this.weaponsUsed.push(evo.id);
    if (this.statMods.length) this.statsDirty = true;
    evo.init?.(this, next);
    this.emit("evolution", { weapon: evo.id, name: evo.name, x: this.player.x, y: this.player.y });
    return next;
  }

  addPassive(id: string, level = 1): PassiveInstance | null {
    const def = PASSIVE_BY_ID.get(id);
    if (!def || this.passiveLevel(id) > 0 || this.passives.length >= this.passiveSlots) return null;
    const pi: PassiveInstance = { def, level: Math.min(level, def.levels.length) };
    this.passives.push(pi);
    if (!this.passivesUsed.includes(id)) this.passivesUsed.push(id);
    this.buildVersion++;
    def.install?.(this, pi);
    this.recomputeStats();
    return pi;
  }

  setPassiveLevel(id: string, level: number): void {
    const pi = this.passives.find((p) => p.def.id === id);
    if (!pi) return;
    pi.level = Math.max(1, Math.min(pi.def.levels.length, level));
    this.buildVersion++;
    this.recomputeStats();
  }

  /**
   * base -> hero trait -> legacy Dream Shop ranks -> RunConfig.mods -> relic mods
   * -> talent mods -> constellation -> passives -> run modifiers (statMods).
   * Keeps current HP when max HP grows.
   */
  recomputeStats(): void {
    const s = baseStats();
    this.hero.apply(s);
    applyMeta(s, this.meta);
    const run = this.run;
    for (let i = 0; i < run.mods.length; i++) run.mods[i](s);
    for (const r of run.relics) RELICS.get(r.id)?.mods?.(s, relicStars(r.stars));
    const tree = TALENT_TREES.get(this.hero.id);
    if (tree)
      for (const n of tree.nodes) {
        if (!n.mods) continue;
        const rank = talentRank(run.talents[n.id], n.maxRank);
        if (rank > 0) n.mods(s, rank);
      }
    const cons = this.hero.constellations;
    if (cons) for (let i = 0; i < Math.min(cons.length, this.cons); i++) cons[i].mods?.(s);
    for (const p of this.passives) p.def.apply(s, p.level);
    for (let i = 0; i < this.statMods.length; i++) this.statMods[i](s);
    finalizeStats(s);
    const p = this.player;
    const grow = s.maxHp - p.maxHp;
    this.stats = s;
    if (p.maxHp > 1 && grow > 0) p.hp += grow;
    p.maxHp = s.maxHp;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
  }

  // ================================================================ upgrades & chests
  private currentOffer: UpgradeCard[] | null = null;

  /** Cards for the pending level-up (stable until chosen or rerolled). */
  offer(): UpgradeCard[] {
    if (!this.currentOffer) this.currentOffer = makeOffer(this, this.stats.cards);
    return this.currentOffer;
  }

  /** Spend a reroll; returns the new offer, or null when none are left. */
  reroll(): UpgradeCard[] | null {
    if (!this.difficulty.rerolls) return null;
    if (this.rerolls <= 0 && !this.freeRerolls) return null;
    // a maxed build only gets the Heal / Star Pouch fallbacks: rerolling can't change anything, keep the reroll
    if (!this.canReroll) return this.offer();
    if (!this.freeRerolls) this.rerolls--;
    this.currentOffer = makeOffer(this, this.stats.cards);
    this.hooks.emit("reroll", { left: this.rerolls });
    return this.currentOffer;
  }

  /** Rerolls the level-up modal may still use (Infinity with free rerolls). */
  get rerollsLeft(): number {
    if (!this.difficulty.rerolls) return 0;
    return this.freeRerolls ? Infinity : this.rerolls;
  }

  /**
   * Banish a weapon / passive card of the current offer: its item never shows
   * up again this run (NEW or upgrade) and the card is replaced. Returns the
   * new offer, or null when no banish is left / the card can't be banished.
   */
  banish(card: UpgradeCard): UpgradeCard[] | null {
    if (this.banishes <= 0 || !this.canBanish(card)) return null;
    const offer = this.offer();
    const i = offer.indexOf(card);
    if (i < 0) return null;
    this.banishes--;
    this.banished.add(card.id);
    offer[i] = banishCard(this, offer, i);
    this.hooks.emit("banish", { id: card.id });
    return offer;
  }

  /** Weapon / passive cards can be banished (evolutions and the Heal / Star Pouch fallbacks can't). */
  canBanish(card: UpgradeCard): boolean {
    return card.kind === "weapon" || card.kind === "passive";
  }

  /**
   * Skip the pending level-up (RunConfig.flags.skip): no card, a refund of
   * CFG.skipXp of the current level's XP cost and CFG.skipCoins coins.
   * Returns false when no skip is left.
   */
  skipLevelUp(): boolean {
    if (this.skips <= 0 || this.pendingLevels <= 0) return false;
    this.skips--;
    const lv = this.level - this.pendingLevels + 1;
    this.currentOffer = null;
    this.pendingLevels--;
    this.coins += Math.round(CFG.skipCoins * this.stats.greed);
    this.hooks.emit("skip", { level: lv });
    // (the refund may chain into the next level: it is queued like any other)
    this.addXp(this.xpNext * CFG.skipXp);
    return true;
  }

  /** A reroll could produce a different offer (false once only the heal / coins fallbacks remain). */
  get canReroll(): boolean {
    return canChangeOffer(this);
  }

  /** Apply a level-up card and consume one pending level. */
  choose(card: UpgradeCard): void {
    applyCard(this, card);
    // a SEASON FINALE level-up (Season Finale Manga): pick a second card from the same offer
    const offer = this.currentOffer;
    if (offer && this.doublePicks.size > 0 && this.doublePicks.delete(this.level - this.pendingLevels + 1)) {
      const rest = offer.filter(
        (c) =>
          c !== card &&
          !(c.kind === "weapon" && !this.hasWeapon(c.id) && this.weapons.length >= this.weaponSlots) &&
          !(c.kind === "passive" && this.passiveLevel(c.id) <= 0 && this.passives.length >= this.passiveSlots),
      );
      if (rest.length > 0) {
        this.currentOffer = rest;
        return;
      }
    }
    this.currentOffer = null;
    if (this.pendingLevels > 0) this.pendingLevels--;
  }

  /** Skip the pending level (no card) - used by tests. */
  skipLevel(): void {
    this.currentOffer = null;
    if (this.pendingLevels > 0) this.pendingLevels--;
  }

  /** Open the next pending chest (rewards are applied immediately). */
  openChest(): ChestResult | null {
    const c = this.pendingChests.shift();
    if (!c) return null;
    const res = rollChest(this, c.golden);
    this.emit("chestOpened", res);
    this.hooks.emit("chest", res);
    return res;
  }

  // ================================================================ summary
  /** The live RunStats snapshot (the same object every call, refreshed; in-run Plot Point checks poll it ~1x/s). */
  runStats(): RunStats {
    return this.collector.finish();
  }

  summary(): RunSummary {
    const weapons = this.weapons.map((w) => ({ id: w.def.id, name: w.def.name, icon: w.def.icon, damage: Math.round(w.damage), kills: w.kills, level: w.level }));
    const ultDef = ULTIMATES.get(this.ultId);
    if (ultDef) {
      const d = this.damageBy.get(ultDef.id) ?? 0;
      if (d > 0) weapons.push({ id: ultDef.id, name: ultDef.name, icon: "", damage: Math.round(d), kills: 0, level: 0 });
    }
    weapons.sort((a, b) => b.damage - a.damage);
    return {
      hero: this.hero.id,
      time: this.t,
      level: this.level,
      kills: this.kills,
      maxCombo: this.maxCombo,
      coins: Math.floor(this.coins),
      victory: this.phase === "victory",
      damageTaken: this.damageTaken,
      weapons,
      stage: this.stage.id,
      stageCleared: this.stageCleared,
      stats: this.collector.finish(),
    };
  }
}
