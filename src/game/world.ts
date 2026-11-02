/**
 * The simulation. PURE: no DOM / WebGL / audio. Everything observable leaves
 * through `world.bus` (typed events, see events.ts) or is read from the
 * public fields by the view/UI each frame.
 *
 *   const w = new World({ hero: "hoshi", seed: 42 });
 *   w.input.mx = 1;            // analog move, plus edge flags input.dash / input.ult
 *   w.step(1 / 60);            // fixed or variable dt (<= 1/30 recommended)
 *   if (w.pendingLevels) w.choose(w.offer()[0]);
 *
 * Coordinates: art px, y down. Actor positions are FEET; collision centres
 * are (x, y - cy). The player's body centre is (x, y - PLAYER_CY).
 */
import { Rng } from "../core/rng";
import { PooledList } from "../core/pool";
import { SpatialHash } from "../core/spatial";
import { clamp, damp, TAU } from "../core/math";
import { CFG, CHANNELS, CH_MISC, RANKS, bossHpScale, enemyDmgScale, enemyHpScale, gemXpScale, rankFor, xpToNext } from "./config";
import { createBus, type GameEvents, type HitEvent, type KillEvent, type GemEvent } from "./events";
import { heroDef } from "./heroes";
import { applyMeta, type MetaRanks } from "./meta";
import { PASSIVE_BY_ID } from "./passives";
import { ULTIMATES, WEAPONS, enemyDef } from "./registry";
import { baseStats, finalizeStats, type Stats } from "./stats";
import { Director } from "./director/director";
import { applyCard, makeOffer, rollChest } from "./upgrades";
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
}

export type Phase = "play" | "dead" | "victory";

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
const newBullet = (): Bullet => ({ x: 0, y: 0, vx: 0, vy: 0, r: 3, dmg: 5, life: 4, age: 0, sprite: "eb_orb", turn: 0, accel: 0, dead: false });
const newTelegraph = (): Telegraph => ({ shape: 0, x: 0, y: 0, x2: 0, y2: 0, r: 10, age: 0, life: 1, color: 0xff4d6d, dead: false });
const newGem = (): Gem => ({ x: 0, y: 0, z: 0, vz: 0, vx: 0, vy: 0, value: 1, tier: 1, state: 0, speed: 0, t: 0, dead: false });
const newPickup = (): Pickup => ({ kind: "coin", x: 0, y: 0, z: 0, vz: 0, vx: 0, vy: 0, value: 1, golden: false, state: 0, speed: 0, t: 0, dead: false });

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
  readonly bus = createBus();
  readonly rng: Rng;
  readonly hero: HeroDef;
  readonly meta: MetaRanks;
  readonly god: boolean;
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

  constructor(opts: WorldOptions = {}) {
    this.rng = new Rng(opts.seed ?? ((Math.random() * 0xffffffff) >>> 0));
    this.hero = heroDef(opts.hero);
    this.meta = opts.meta ?? {};
    this.god = !!opts.god;
    this.viewW = opts.viewW ?? CFG.viewW;
    this.viewH = opts.viewH ?? CFG.viewH;
    this.maxEnemies = opts.maxEnemies ?? 350;
    this.directorOn = opts.director ?? true;
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
      moving: false,
      dead: false,
    };
    this.recomputeStats();
    this.player.hp = this.player.maxHp = this.stats.maxHp;
    this.rerolls = this.stats.rerolls;
    this.revivesLeft = this.stats.revives;
    this.director = new Director(this);
    const dummy = null as unknown as Enemy;
    this.hitEv = { x: 0, y: 0, dmg: 0, crit: false, color: 0xffffff, angle: 0, enemy: dummy, source: "" };
    this.killEv = { x: 0, y: 0, enemy: dummy, elite: false, boss: false, kills: 0 };
    this.gemEv = { x: 0, y: 0, value: 0, tier: 1 };
    this.addWeapon(this.hero.weapon);
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
    if (!this.ult) this.addUlt(CFG.ultPerSecond * dt);
    if (this.freezeT > 0) this.freezeT = Math.max(0, this.freezeT - dt);
    this.cleanup();
    this.rebuildGrid();
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
    if (wasCd && p.dashCd === 0) this.emit("dashReady", {});

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
    } else {
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

  /** Dash if off cooldown. Returns true when a dash started. */
  tryDash(): boolean {
    const p = this.player;
    if (p.dashCd > 0 || p.dashT > 0 || this.phase !== "play") return false;
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
    p.dashCd = p.dashMax;
    this.emit("dash", { x: p.x, y: p.y, dx, dy });
    return true;
  }

  get invulnerable(): boolean {
    const p = this.player;
    return this.god || p.iframes > 0 || p.dashInv > 0 || this.ult !== null;
  }

  /** Damage the player (contact, bullets, explosions). Returns true if it hurt. */
  hurtPlayer(dmg: number, sx: number, sy: number): boolean {
    const p = this.player;
    if (this.phase !== "play" || this.invulnerable) return false;
    const d = Math.max(1, Math.round(dmg - this.stats.armor));
    p.hp -= d;
    p.iframes = CFG.hurtIframes;
    p.hurtT = 0.3;
    this.damageTaken += d;
    // a hit costs style: the combo drops one rank
    if (this.comboRank >= 1) this.dropRank();
    // small recoil away from the source
    const ax = p.x - sx;
    const ay = p.y - sy;
    const al = Math.sqrt(ax * ax + ay * ay) || 1;
    p.vx += (ax / al) * 70;
    p.vy += (ay / al) * 70;
    this.emit("playerHurt", { dmg: d, x: p.x, y: p.y, hp: Math.max(0, p.hp), maxHp: p.maxHp });
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.phase = "dead";
      this.endCombo();
      this.emit("playerDied", { x: p.x, y: p.y });
    }
    return true;
  }

  heal(amount: number, silent = false): void {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    if (!silent && p.hp - before >= 1) this.emit("playerHeal", { amount: Math.round(p.hp - before), x: p.x, y: p.y });
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
    const def = ULTIMATES.get(this.hero.ult);
    if (!def) return false;
    this.ultMeter = 0;
    this.ultReadySent = false;
    this.ult = { def, phase: "cutin", t: 0, power: 1 + (this.level - 1) * 0.06, data: {} };
    this.emit("ultCutin", { hero: this.hero.id, ult: def.id, name: def.name });
    return true;
  }

  private updateUlt(dt: number): void {
    const u = this.ult as UltState;
    u.t += dt;
    u.def.update(this, u, dt);
    if (u.t >= u.def.duration) {
      u.def.end?.(this, u);
      this.timeStop = false;
      this.ult = null;
      this.emit("ultEnd", { ult: u.def.id });
    }
  }

  // ================================================================ combo
  /** Length of the combo timer at the current rank (HUD bar). */
  get comboWindow(): number {
    return CFG.comboWindow[this.comboRank + 1];
  }
  private addCombo(): void {
    this.combo++;
    const win = CFG.comboWindow[this.comboRank + 1];
    this.comboTimer = Math.min(win, Math.max(0, this.comboTimer) + CFG.comboRefill[this.comboRank + 1]);
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const r = rankFor(this.combo);
    if (r > this.comboRank) {
      this.comboRank = r;
      // a fresh rank starts with a full (shorter) window
      this.comboTimer = CFG.comboWindow[r + 1];
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
    this.comboTimer = CFG.comboWindow[r + 1];
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
    const hpScale = d.prop ? 1 : d.boss ? bossHpScale(d.boss.level, this.level) : enemyHpScale(this.t) * (this.director?.hpMul ?? 1);
    e.maxHp = e.hp = Math.max(1, Math.round(d.hp * hpScale * (e.elite ? CFG.elite.hp : 1)));
    e.speed = d.speed * (e.elite ? CFG.elite.speed : 1);
    e.dmg = d.dmg * (e.elite ? CFG.elite.dmg : 1) * (d.boss || d.prop ? 1 : enemyDmgScale(this.t));
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
    if (d.prop) this.propCount++;
    else this.enemyCount++;
    d.init?.(e, this);
    if (!this.muted) {
      if (e.elite) this.bus.emit("eliteSpawned", { enemy: e });
    }
    return e;
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
    const pr = CFG.playerRadius;
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
      if (frozen) {
        e.vx = e.vy = 0;
      } else if (e.mode !== MODE_STRAIGHT) {
        d.update(e, this, dt);
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
        if (e.dmg > 0 && !frozen) this.hurtPlayer(e.dmg, e.x, e.y);
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
    const s = this.stats;
    const crit = this.rng.next() < s.crit + critBonus;
    const v = CFG.damageVariance;
    let d = base * (1 + (this.rng.next() * 2 - 1) * v) * (crit ? s.critMult : 1);
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
      this.killEnemy(e, owner);
      return true;
    }
    return false;
  }

  /** Kill (credit + drops + events). */
  killEnemy(e: Enemy, owner: WeaponInstance | null): void {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    const d = e.def;
    if (d.prop) {
      this.propCount--;
      this.dropPropLoot(e.x, e.y);
      this.emit("propBroken", { x: e.x, y: e.y, sprite: d.sprite });
      return;
    }
    this.enemyCount--;
    this.kills++;
    if (owner) owner.kills++;
    this.addCombo();
    if (d.boss) this.addUlt(CFG.ultPerBoss);
    else if (e.elite) this.addUlt(CFG.ultPerElite);
    else if (!this.ult) {
      // ordinary kills charge the meter up to CFG.ultKillCap per second (hordes don't spam ults)
      const g = Math.min(this.ultKillBudget, CFG.ultPerKill);
      this.ultKillBudget -= g;
      this.addUlt(g);
    }
    d.onDeath?.(e, this);
    // drops (later enemies are worth more XP)
    const xs = gemXpScale(this.t);
    if (d.boss) {
      this.dropGem(e.x, e.y, 100 * xs);
      this.dropPickup("chest", e.x, e.y, 1, true);
      for (let i = 0; i < 16; i++) this.dropPickup("coin", e.x, e.y, 1);
    } else if (e.elite) {
      this.dropGem(e.x, e.y, Math.max(25, d.xp * 10) * xs);
      this.dropPickup("chest", e.x, e.y, 1, false);
      for (let i = 0; i < 8; i++) this.dropPickup("coin", e.x, e.y, 1);
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
    if (d.boss) {
      if (this.boss === e) this.boss = null;
      this.director.onBossDied(e);
      const final = !!d.boss.final;
      this.emit("bossKilled", { x: e.x, y: e.y, title: d.boss.title, final });
      if (final) {
        // (the player may have died earlier in this same step: the director then wins the run right after a revive)
        this.finalBossDown = true;
        this.win();
      }
    }
  }

  /** End the run in victory. */
  win(): void {
    if (this.phase !== "play") return;
    this.phase = "victory";
    this.endCombo();
    this.emit("victory", { time: this.t });
  }

  /** Damage every enemy in a circle (ground point). */
  explode(x: number, y: number, r: number, dmg: number, owner: WeaponInstance | null, knock: number, source: string, color: number, big = false): number {
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
      this.hitEnemy(e, dmg, owner, Math.atan2(dy, dx), knock, 0, source, color);
      hits++;
    }
    this.release();
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

  /** Nearest valid target (not dead, not a prop) to (x, y) within maxR, or null. */
  nearestEnemy(x: number, y: number, maxR: number): Enemy | null {
    const id = this.grid.nearest(x, y, maxR, this.acceptTarget);
    return id >= 0 ? this.enemies.items[id] : null;
  }
  private acceptTarget = (id: number): boolean => {
    const e = this.enemies.items[id];
    return !!e && !e.dead && !e.def.prop;
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
      if (!e || e.dead || e.def.prop) continue;
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
      if (e.dead || e.def.prop) continue;
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
            if (!t || t.dead) {
              t = p.target = this.nearestEnemy(p.x, p.y, 140);
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
      this.hitEnemy(e, p.dmg, p.owner, ang, p.knock, p.crit, p.source, color);
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
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.dmg = dmg;
    b.sprite = sprite;
    b.r = r;
    b.life = life;
    b.age = 0;
    b.turn = 0;
    b.accel = 0;
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
      const rr = b.r + CFG.playerRadius - 2;
      if (dx * dx + dy * dy < rr * rr) {
        if (this.hurtPlayer(b.dmg, b.x, b.y)) b.dead = true;
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
    // don't drop food at full HP - give coins instead
    if ((kind === "onigiri" || kind === "cake") && this.player.hp >= this.player.maxHp) kind = "coin";
    if (kind === "coin") {
      const n = r.int(3, 6);
      for (let i = 0; i < n; i++) this.dropPickup("coin", x, y, 1);
    } else this.dropPickup(kind, x, y);
  }

  private updateGems(dt: number): void {
    const p = this.player;
    const pr = CFG.pickupRadius * this.stats.pickup;
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
    const pr = CFG.pickupRadius * this.stats.pickup;
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
        if (k.kind === "coin") {
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
    switch (k.kind) {
      case "coin": {
        const v = k.value * this.stats.greed;
        this.coins += v;
        this.emit("coin", { x: k.x, y: k.y, value: v });
        return;
      }
      case "onigiri":
        this.heal(20);
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
        return;
    }
    this.emit("pickup", { kind: k.kind, x: k.x, y: k.y });
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
      this.heal(Math.max(3, this.player.maxHp * CFG.levelHeal));
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
    if (!def || this.hasWeapon(id) || this.weapons.length >= CFG.weaponSlots) return null;
    const used = new Set(this.weapons.map((w) => w.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    const inst: WeaponInstance = { def, level: Math.min(level, def.levels.length), slot, timer: 0.25, t: 0, projs: [], uids: [], data: {}, damage: 0, kills: 0 };
    this.weapons.push(inst);
    this.weapons.sort((a, b) => a.slot - b.slot);
    this.buildVersion++;
    def.init?.(this, inst);
    return inst;
  }

  setWeaponLevel(inst: WeaponInstance, level: number): void {
    inst.level = Math.max(1, Math.min(inst.def.levels.length, level));
    this.buildVersion++;
  }

  /** Replace a maxed base weapon with its evolution (same slot, keeps damage stats). */
  evolveWeapon(inst: WeaponInstance): WeaponInstance | null {
    const evo = inst.def.evolution ? WEAPONS.get(inst.def.evolution.into) : undefined;
    if (!evo) return null;
    inst.def.dispose?.(this, inst);
    for (let i = 0; i < inst.projs.length; i++) if (inst.projs[i].uid === inst.uids[i]) inst.projs[i].dead = true;
    inst.projs.length = 0;
    inst.uids.length = 0;
    const next: WeaponInstance = { def: evo, level: 1, slot: inst.slot, timer: 0.1, t: 0, projs: [], uids: [], data: {}, damage: inst.damage, kills: inst.kills };
    const i = this.weapons.indexOf(inst);
    this.weapons[i] = next;
    this.buildVersion++;
    evo.init?.(this, next);
    this.emit("evolution", { weapon: evo.id, name: evo.name, x: this.player.x, y: this.player.y });
    return next;
  }

  addPassive(id: string, level = 1): PassiveInstance | null {
    const def = PASSIVE_BY_ID.get(id);
    if (!def || this.passiveLevel(id) > 0 || this.passives.length >= CFG.passiveSlots) return null;
    const pi: PassiveInstance = { def, level: Math.min(level, def.levels.length) };
    this.passives.push(pi);
    this.buildVersion++;
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

  /** base -> hero trait -> meta ranks -> passives. Keeps current HP when max HP grows. */
  recomputeStats(): void {
    const s = baseStats();
    this.hero.apply(s);
    applyMeta(s, this.meta);
    for (const p of this.passives) p.def.apply(s, p.level);
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
    if (this.rerolls <= 0) return null;
    this.rerolls--;
    this.currentOffer = makeOffer(this, this.stats.cards);
    return this.currentOffer;
  }

  /** Apply a level-up card and consume one pending level. */
  choose(card: UpgradeCard): void {
    applyCard(this, card);
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
    return res;
  }

  // ================================================================ summary
  summary(): RunSummary {
    const weapons = this.weapons.map((w) => ({ id: w.def.id, name: w.def.name, icon: w.def.icon, damage: Math.round(w.damage), kills: w.kills, level: w.level }));
    const ultDef = ULTIMATES.get(this.hero.ult);
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
    };
  }
}
