/**
 * FX / audio bridge: subscribes to the simulation's events and turns them
 * into juice (DESIGN §4): particles, damage numbers, hitstop, shake, flashes,
 * shockwaves, world texts, haptics and audio.sfx() calls, plus HUD pulses
 * through the optional `hooks`. Per-frame budgets keep huge fights readable
 * and cheap. One instance per World; call dispose() when the run ends.
 */
import { C } from "../art/palette";
import { audio, type SfxId } from "../audio";
import { rainbow } from "../core/color";
import { clamp, smoothstep } from "../core/math";
import type { Input } from "../core/input";
import { time } from "../core/time";
import { CONFETTI_COLORS, fxDash, fxEliteDeath, fxEnemyDeath, fxExplosion, fxFirework, fxHit, fxLevelUp, fxPickup, P, type Fx } from "../fx";
import { Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import { RANKS, rankFor } from "../game/config";
import { WEAPONS } from "../game/registry";
import type { Enemy } from "../game/types";
import type { World } from "../game/world";
import type { WorldView } from "./world-view";

/** UI hooks the HUD implements (all optional). */
export interface FeedbackHooks {
  xpPulse?(): void;
  coinPulse?(): void;
  comboRank?(id: string, rank: number): void;
  comboBreak?(count: number): void;
  banner?(kind: "warning" | "incoming" | "evolution" | "boss" | "elite" | "info", title: string, sub?: string): void;
  bossBar?(e: Enemy | null, title?: string): void;
  ultReady?(): void;
  cutin?(heroId: string, ultName: string): void;
  /** The sim started the ultimate (end of the cut-in): drop the overlay now. */
  cutinEnd?(): void;
  levelUp?(level: number): void;
  chest?(golden: boolean): void;
  died?(): void;
  victory?(): void;
}

export interface FeedbackOptions {
  /** Play audio (off for the attract mode). */
  sound: boolean;
  /** Haptics through input.haptic (gameplay only). */
  input: Input | null;
  hooks?: FeedbackHooks;
  /** Damage numbers on/off (settings). */
  numbers?: boolean;
  /** Attract mode: lighter juice (no hitstop / big flashes). */
  calm?: boolean;
}

const HIT_FX_BUDGET = 16;
const DEATH_FX_BUDGET = 22;
const NUM_BUDGET = 36;
const BOOM_BUDGET = 5;
/**
 * Enemy damage numbers alive above which only crits / boss hits pop, and above
 * which nothing pops (player + heal numbers always do). Both shrink with the
 * peak-chaos load (r.post.load) so numbers never paper over the hero / bullets.
 */
const NUM_SOFT = 70;
const NUM_HARD = 110;
/**
 * A plain (non-crit, non-boss) number for the same enemy at most every NUM_REPEAT
 * real seconds: rapid-tick weapons (prism / rainbow beams tick every 0.07-0.1 s)
 * would otherwise stack a column of numbers on every enemy they touch.
 * Tracked in a small uid-hashed table (no per-hit allocation).
 */
const NUM_REPEAT = 0.22;
/** Crits get their own (longer) per-enemy repeat window, and at most CRIT_CAP alive (halved at peak load). */
const CRIT_REPEAT = 0.3;
const CRIT_CAP = 16;
/** One crit micro-shake per CRIT_SHAKE_EVERY s (a crit storm used to shake the camera every frame). */
const CRIT_SHAKE_EVERY = 0.15;
const NUM_SLOTS = 1024;
/** Boss hits: one summed damage number every BOSS_NUM_EVERY s, one hit spark every BOSS_SPARK_EVERY s. */
const BOSS_NUM_EVERY = 0.14;
const BOSS_SPARK_EVERY = 0.05;
/** Meteor impacts (Supernova Shower): at most one impact shake per METEOR_SHAKE_EVERY s. */
const METEOR_SHAKE_EVERY = 0.125;
/** Evolutions celebrated while a modal is open (level-up / chest pick) wait for it to close: queue size, stagger. */
const EVO_QUEUE = 6;
const EVO_STAGGER = 0.6;
/** Death beat: the grade eases to GRADES.dim over DEATH_FADE s (WorldView.deathK), the camera zooms in. */
const DEATH_FADE = 0.8;
const DEATH_ZOOM = 1.35;

export class Feedback {
  private offs: (() => void)[] = [];
  private hitFx = 0;
  private deathFx = 0;
  private nums = 0;
  private booms = 0;
  private bossNumUid = -1;
  private bossAcc = 0;
  private bossCrit = false;
  private bossNumAt = -1;
  private bossSparkAt = 0;
  /** Last plain damage number per enemy (uid-hashed, see NUM_REPEAT). */
  private readonly numUid = new Int32Array(NUM_SLOTS).fill(-1);
  private readonly numAt = new Float64Array(NUM_SLOTS);
  private hitSfx = 0;
  private gemChain = 0;
  private gemT = 0;
  private now = 0;
  /**
   * Clock for after(): advances only while no modal pauses the game (time.paused), so
   * delayed world effects (boss WARNING sirens, fireworks, chained booms) never play
   * behind a level-up / chest / pause modal.
   */
  private playNow = 0;
  private later: { t: number; fn: () => void }[] = [];
  private critCap = CRIT_CAP;
  private critShakeAt = -1;
  private meteorShakeAt = -1;
  /** Evolutions waiting for the modal to close (ring of EVO_QUEUE, no per-event allocation). */
  private readonly evoX = new Float64Array(EVO_QUEUE);
  private readonly evoY = new Float64Array(EVO_QUEUE);
  private readonly evoName: string[] = new Array<string>(EVO_QUEUE).fill("");
  private evoHead = 0;
  private evoN = 0;
  private evoNextAt = 0;
  /** Real seconds since the hero went down (-1 = alive). */
  private deathT = -1;
  private beat = 0;
  /**
   * Sim time (world.t) at which the battle theme returns after a non-final boss
   * died (-1 = none). Sim time, not this.now: the frame clock is clamped on slow
   * devices (and the death plays in slow-mo), so a frame-time delay drifted.
   */
  private musicBackAt = -1;
  /** this.now of the last level-up (its small heal shows the number only, the fanfare covers the rest). */
  private levelAt = -1;
  /** Per-frame budgets after the peak-chaos scaling (see frame()). */
  private hitBudget = HIT_FX_BUDGET;
  private deathBudget = DEATH_FX_BUDGET;
  private numBudget = NUM_BUDGET;
  private numSoft = NUM_SOFT;
  private numHard = NUM_HARD;
  numbers = true;

  constructor(
    private readonly w: World,
    private readonly r: Renderer,
    private readonly fx: Fx,
    private readonly view: WorldView,
    private readonly opts: FeedbackOptions,
  ) {
    this.numbers = opts.numbers ?? true;
    this.bind();
  }

  dispose(): void {
    for (const o of this.offs) o();
    this.offs = [];
    this.opts.hooks?.cutinEnd?.();
    this.later.length = 0;
    this.evoN = 0;
    this.r.post.damageFloor = 0;
    this.view.deathK = 0;
    this.view.stage.resetFx();
    this.fx.dmg.focusOn = false;
  }

  private sfx(id: SfxId, vol = 1, pitch = 0, x = NaN): void {
    if (!this.opts.sound) return;
    let pan = 0;
    if (!Number.isNaN(x)) {
      const v = this.r.camera.view;
      pan = clamp(((x - (v.x + v.w / 2)) / (v.w / 2)) * 0.6, -0.8, 0.8);
    }
    audio.sfx(id, { vol, pitch, pan });
  }

  private haptic(ms: number): void {
    this.opts.input?.haptic(ms);
  }

  /** Run `fn` after `sec` seconds of unpaused real time (see playNow). */
  private after(sec: number, fn: () => void): void {
    this.later.push({ t: this.playNow + sec, fn });
  }

  /** Per-frame: reset budgets, run scheduled effects, low-HP heartbeat, grade + ambient. */
  frame(realDt: number): void {
    this.now += realDt;
    const paused = time.paused;
    if (!paused) this.playNow += realDt;
    this.hitFx = this.deathFx = this.nums = this.booms = this.hitSfx = 0;
    // peak chaos (adaptive bloom limiter load): fewer sparks / puffs / numbers, fainter numbers.
    // A screen full of enemy bullets counts as busy too: the bullets must read, not our numbers.
    const load = Math.max(this.r.post.load, 0.8 * Math.min(1, this.w.bullets.count / 50));
    this.hitBudget = Math.round(HIT_FX_BUDGET * (1 - 0.5 * load));
    this.deathBudget = Math.round(DEATH_FX_BUDGET * (1 - 0.45 * load));
    this.numBudget = Math.round(NUM_BUDGET * (1 - 0.6 * load));
    this.numSoft = Math.round(NUM_SOFT * (1 - 0.55 * load));
    this.numHard = Math.round(NUM_HARD * (1 - 0.5 * load));
    this.critCap = Math.round(CRIT_CAP * (1 - 0.5 * load));
    this.fx.dmg.busy = load;
    // hero exclusion zone for enemy numbers
    const dmg = this.fx.dmg;
    dmg.focusX = this.w.player.x;
    dmg.focusY = this.w.player.y - 9;
    dmg.focusOn = true;
    if (this.later.length && !paused) {
      for (let i = this.later.length - 1; i >= 0; i--) {
        const l = this.later[i];
        if (this.playNow >= l.t) {
          this.later.splice(i, 1);
          l.fn();
        }
      }
    }
    // evolutions picked inside a modal: celebrate once it has closed, staggered
    if (this.evoN > 0 && !paused && this.now >= this.evoNextAt) {
      const i = this.evoHead;
      this.evoHead = (this.evoHead + 1) % EVO_QUEUE;
      this.evoN--;
      this.evoNextAt = this.now + EVO_STAGGER;
      this.celebrateEvolution(this.evoX[i], this.evoY[i], this.evoName[i]);
    }
    this.gemT -= realDt;
    if (this.gemT <= 0) this.gemChain = 0;
    const w = this.w;
    const p = w.player;
    if (this.musicBackAt >= 0 && w.t >= this.musicBackAt) {
      this.musicBackAt = -1;
      // (a death / victory in between owns the music; a boss alive or warning keeps its theme)
      if (this.opts.sound && w.phase === "play" && !w.boss && !w.director.warning) audio.music(this.view.stage.music("battle"), 2);
    }
    // low-HP heartbeat vignette (lub-dub every ~0.8 s)
    const k = p.hp / p.maxHp;
    if (k < 0.3 && w.phase === "play") {
      this.beat += realDt * (1.1 + (0.3 - k) * 3);
      const ph = this.beat % 1;
      const pulse = Math.max(Math.exp(-ph * 14), ph > 0.18 ? Math.exp(-(ph - 0.18) * 14) * 0.7 : 0);
      this.r.post.damageFloor = 0.18 + 0.32 * pulse * (1 - k / 0.3 + 0.4);
    } else this.r.post.damageFloor = Math.max(0, this.r.post.damageFloor - realDt);
    // death beat: the frame drains toward GRADES.dim (applied by WorldView on top of any grade);
    // a revive drains it back within half a second
    if (this.deathT >= 0 && w.phase === "dead") {
      this.deathT += realDt;
      this.view.deathK = smoothstep(0, DEATH_FADE, this.deathT);
    } else if (this.view.deathK > 0) this.view.deathK = Math.max(0, this.view.deathK - realDt * 2.2);
    // the stage's colour-grade keyframes + ambient densities over the run (Dream Meadow: day -> dusk -> night
    // over the 9 minutes to the final boss, petals giving way to fireflies), plus sim stageFx directives
    this.view.stage.frame(realDt);
    if (this.opts.sound) audio.setIntensity(clamp(w.enemyCount / 110 + Math.max(0, w.comboRank) * 0.08 + (w.boss ? 0.4 : 0), 0, 1));
  }

  /** The evolution celebration (flash, hue cycle, fireworks, cast pose, banner, sfx). */
  private celebrateEvolution(x: number, y: number, name: string): void {
    const fx = this.fx;
    const juice = fx.juice;
    const w = this.w;
    juice.flash(C.white, 0.6, 0.5);
    juice.hueCycle(0.7);
    juice.bloomSurge(1, 1);
    juice.shockwave(x, y - 8, 1.5, 120, 0.8);
    for (let i = 0; i < 6; i++) this.after(i * 0.08, () => fxFirework(fx, w.player.x + (Math.random() - 0.5) * 90, w.player.y - 20 - Math.random() * 50));
    // (no in-world "EVOLUTION!" text: the HUD banner already shows EVOLUTION! + the weapon name)
    this.view.pose(0.9);
    this.opts.hooks?.banner?.("evolution", "EVOLUTION!", name);
    this.sfx("evolve");
    this.haptic(40);
  }

  private bind(): void {
    const w = this.w;
    const bus = w.bus;
    const fx = this.fx;
    const juice = fx.juice;
    const calm = !!this.opts.calm;
    const sub = this.offs;
    // ONE bind-options object for every content view group (each takes the fields it needs: sfx, haptic,
    // sound, calm, hooks), built once per run
    const o = {
      sfx: (id: SfxId, vol?: number, pitch?: number, x?: number) => this.sfx(id, vol, pitch, x),
      haptic: (ms: number) => this.haptic(ms),
      sound: this.opts.sound,
      calm,
      hooks: this.opts.hooks,
    };
    // arsenal weapon visuals (lightning, bursts, candy confetti, bubble pops): src/view/weapon-fx.ts
    sub.push(...this.view.weaponFx.bind(w, o.sfx, calm));
    // Season 2 heroes Kuro / Pudding / Aoi / Akane (heroFx cues, BAKA! pops): src/view/heroes-a-fx.ts
    sub.push(...this.view.heroesA.bind(w, o));
    // Season 2 heroes Senpai / Magical Girl #47 / Isekai-kun / Truck-kun (heroFx cues, HONK pops): src/view/heroes-b-fx.ts
    sub.push(...this.view.heroesB.bind(w, o));
    // Season 2 general weapons (Bubble Tea / Paper Cranes / Lightsticks / Kotatsu "a2_*" cues): src/view/arsenal2-fx.ts
    sub.push(...this.view.arsenal2.bind(w, o));
    // bestiary cues, boss phases / enrage, death throes and the VICTORY dawn sequence: src/view/bestiary-fx.ts
    sub.push(...this.view.bestiary.bind(w, o));
    // Season 2: relic / talent / twist procs, shields, Plot Armor, encores, the Filler Arc: src/view/relic-fx.ts
    sub.push(
      ...this.view.relics.bind(w, {
        ...o,
        battleMusicIn: (delay) => {
          this.musicBackAt = w.t + delay;
        },
      }),
      bus.on("stageFx", (e) => this.view.stage.directive(e)),
    );
    // enemy speech bubbles (scripted `enemySay` lines, free-standing boss lines; ambient chatter runs in the view): src/view/speech.ts
    sub.push(...this.view.speech.bind(w));
    // Candy Kingdom / Shoujo Academy content looks (stageCue candy_* / academy_*, boss deaths, props): candy-fx.ts, academy-fx.ts
    sub.push(...this.view.candy.bind(w, o), ...this.view.academy.bind(w, o));
    // Beach Episode / The Final Arc looks (enemyFx 400-499, boss death scenes, props, the cancel theme's degrade): s45-fx.ts
    sub.push(...this.view.s45.bind(w, o));

    sub.push(
      bus.on("enemyHit", (e) => {
        const boss = !!e.enemy.def.boss;
        // (a boss soaks every weapon at once: its sparks are rate-limited so they don't bury it in white)
        if (this.hitFx < this.hitBudget && (!boss || this.now >= this.bossSparkAt)) {
          this.hitFx++;
          if (boss) this.bossSparkAt = this.now + BOSS_SPARK_EVERY;
          fxHit(fx, e.x, e.y, e.crit ? C.yellow : e.color, e.angle);
        }
        if (boss) {
          // boss damage is summed into one number every BOSS_NUM_EVERY s (not a pile of numbers on its face)
          const uid = e.enemy.uid;
          if (uid !== this.bossNumUid) {
            this.bossNumUid = uid;
            this.bossAcc = 0;
            this.bossCrit = false;
            this.bossNumAt = -1;
          }
          this.bossAcc += e.dmg;
          if (e.crit) this.bossCrit = true;
          if (this.numbers && this.now - this.bossNumAt >= BOSS_NUM_EVERY && this.nums < this.numBudget && fx.dmg.alive < this.numHard) {
            this.nums++;
            fx.dmg.spawn(e.x + (Math.random() - 0.5) * 10, e.y - 8, Math.round(this.bossAcc), this.bossCrit ? "crit" : "normal");
            this.bossAcc = 0;
            this.bossCrit = false;
            this.bossNumAt = this.now;
          }
        } else if (this.numbers && this.nums < this.numBudget) {
          const alive = fx.dmg.alive;
          const special = e.crit;
          const uid = e.enemy.uid;
          const slot = uid & (NUM_SLOTS - 1);
          // (crits too: a crit storm on one enemy used to stack a column of "40!" over the hero)
          const win = special ? CRIT_REPEAT : NUM_REPEAT;
          const repeat = this.numUid[slot] === uid && this.now - this.numAt[slot] < win;
          const room = alive < this.numSoft || (alive < this.numHard && special);
          const critOk = !special || fx.dmg.aliveCrit < this.critCap;
          if (!repeat && room && critOk && !this.view.texts.covers(e.x, e.y - 8, w.player.x, w.player.y)) {
            this.numUid[slot] = uid;
            this.numAt[slot] = this.now;
            this.nums++;
            // (STATUS SCREEN!! prints its fake "9999999" instead of the real number)
            const fake = this.view.heroesB.numberText(e);
            if (fake) fx.dmg.text(e.x + (Math.random() - 0.5) * 4, e.y - 8, fake, C.yellow, e.crit ? 1.4 : 1.1);
            else fx.dmg.spawn(e.x + (Math.random() - 0.5) * 4, e.y - 8, e.dmg, e.crit ? "crit" : "normal");
          }
        }
        if (this.hitSfx < 2) {
          this.hitSfx++;
          const def = WEAPONS.get(e.source);
          const id = (boss ? "bossHit" : e.crit ? "hitCrit" : (def?.hitSfx as SfxId | undefined) ?? "hit") as SfxId;
          this.sfx(id, 0.7, (Math.random() * 4 - 2) | 0, e.x);
        }
        if (e.crit && !calm && this.now - this.critShakeAt >= CRIT_SHAKE_EVERY) {
          this.critShakeAt = this.now;
          juice.shake(0.04);
        }
      }),
      bus.on("enemyKilled", (e) => {
        const en = e.enemy;
        // combo milestones between the rank thresholds: a bright two-note blip every 25
        const cb = w.combo;
        if (cb >= 25 && cb % 25 === 0 && rankFor(cb) === rankFor(cb - 1)) this.sfx("comboUp", 0.8, Math.min(12, cb / 25));
        if (e.boss) return;
        // (a hero effect can own the death look: ETERNAL ABYSS feathers)
        if (this.view.heroesA.killFx(e)) {
          this.sfx("enemyDie", 0.45, ((Math.random() * 3) | 0) - 3, e.x);
          return;
        }
        // (isekai'd by Truck-kun: a light pillar instead of confetti)
        if (this.view.heroesB.death(e)) return;
        if (e.elite) {
          fxEliteDeath(fx, e.x, e.y, en.def.colors);
          if (!calm) juice.flash(C.white, 0.15, 0.12);
          this.sfx("eliteDie", 1, 0, e.x);
          this.haptic(25);
          return;
        }
        if (this.deathFx < this.deathBudget) {
          this.deathFx++;
          // pop: a white silhouette at 1.3x that fades in a blink, then the confetti burst
          const a = this.view.anims.fps(en.def.sprite, en.def.fps ?? 0);
          fx.ghosts.spawn(a.first, e.x, e.y - en.z, en.face * 1.3 * en.scale, 1.3 * en.scale, 0, C.white, 0.11, 0.95, Layer.Fx);
          fxEnemyDeath(fx, e.x, e.y - en.z, en.def.colors, en.scale);
        } else fx.ps.emit(P.sparkle, e.x, e.y - 5, 2);
        this.sfx("enemyDie", 0.55, (Math.random() * 3) | 0, e.x);
      }),
      bus.on("propBroken", (e) => {
        fx.ps.emit(P.debris, e.x, e.y - 6, 10);
        fx.ps.emit(P.confetti, e.x, e.y - 8, 14);
        fx.ps.emit(P.smoke, e.x, e.y - 6, 2);
        fx.ps.emit(P.ring, e.x, e.y - 6, 1, NaN, e.sprite === "prop_lantern" ? C.orange : C.mint, 1.2);
        this.sfx("propBreak", 1, 0, e.x);
      }),
      bus.on("explosion", (e) => {
        if (e.source === "supernova_shower") {
          // meteor impact: a big white-gold flash + its own shockwave, a rate-limited thump
          fx.ps.emit(P.flare, e.x, e.y, 1, NaN, C.white, e.r / 11);
          fx.ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.paleYellow, e.r / 12);
          if (!calm) {
            juice.shockwave(e.x, e.y, 0.9, e.r * 2.4, 0.5);
            if (this.now - this.meteorShakeAt >= METEOR_SHAKE_EVERY) {
              this.meteorShakeAt = this.now;
              juice.shake(0.12);
            }
          }
        }
        if (this.booms >= BOOM_BUDGET) {
          fx.ps.emit(P.flare, e.x, e.y, 1, NaN, C.paleYellow, e.r / 16);
          return;
        }
        this.booms++;
        fxExplosion(fx, e.x, e.y, e.r, !calm);
        // a blast on top of the hero hides it for a moment: force the hero beacon on (WorldView)
        const dx = e.x - w.player.x;
        const dy = e.y - (w.player.y - 8);
        const rr = e.r + 10;
        if (dx * dx + dy * dy < rr * rr) this.view.coverHero(0.55);
        this.sfx(e.big ? "explosionBig" : "explosion", e.big ? 0.8 : 1, (Math.random() * 3 - 1.5) | 0, e.x);
      }),
      bus.on("shockwave", (e) => {
        juice.shockwave(e.x, e.y, 0.5 + e.power, e.r * 2, 0.5 + e.power * 0.3);
        juice.shake(0.12 + e.power * 0.45);
        fx.ps.emit(P.dust, e.x, e.y, 6 + Math.round(e.power * 10), NaN, -1, 1 + e.power, 1 + e.power * 2);
        fx.ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.white, e.r / 16);
        if (e.power > 0.5) {
          fx.ps.emit(P.debris, e.x, e.y, 12);
          this.sfx("explosion", 0.9, -4, e.x);
          this.haptic(30);
        }
      }),
      bus.on("enemyShoot", (e) => {
        this.sfx("enemyShoot", 0.7, 0, e.x);
      }),
      bus.on("telegraph", (e) => {
        this.sfx("telegraph", 0.8, 0, e.x);
      }),
      bus.on("weaponFire", (e) => {
        this.sfx(e.sfx as SfxId, 0.55, 0, e.x);
      }),
      bus.on("playerHurt", (e) => {
        this.view.heroHurt();
        if (calm) return;
        juice.damageVignette(0.9);
        juice.shake(0.35);
        juice.aberration(2.5);
        juice.hitstop(50);
        fx.dmg.spawn(e.x, e.y - 22, e.dmg, "player");
        this.haptic(30);
        this.sfx("playerHurt");
      }),
      bus.on("playerHeal", (e) => {
        fx.dmg.spawn(e.x, e.y - 24, e.amount, "heal");
        // the level-up heal (CFG.levelHeal) rides on the level-up fanfare: number + a few hearts only
        if (this.now - this.levelAt < 0.05) {
          fx.ps.emit(P.hearts, e.x, e.y - 12, 3);
          return;
        }
        fx.ps.emit(P.hearts, e.x, e.y - 12, 6);
        fx.ps.emit(P.ring, e.x, e.y - 10, 1, NaN, C.lime, 1.2);
        this.sfx("heal");
      }),
      bus.on("playerDied", (e) => {
        // hero-focused beat (the sim has stopped: everything here runs on real time): zoom in on her,
        // drain the colour (Feedback.frame -> WorldView.deathK), knock-down pose drawn above the killer
        this.deathT = 0;
        this.r.camera.zoomTo(DEATH_ZOOM, 5); // (lambda: ~95 % in 0.6 s)
        juice.slowmo(0.2, 1.4);
        juice.flash(C.red, 0.5, 0.5);
        juice.shake(0.7);
        juice.shockwave(e.x, e.y - 8, 1.4, 100);
        fx.ps.emit(P.confetti, e.x, e.y - 10, 30);
        fx.ps.emit(P.hearts, e.x, e.y - 12, 10);
        this.haptic(120);
        if (this.opts.sound) audio.duck(0.7, 1.4);
        this.sfx("playerDie");
        this.opts.hooks?.died?.();
      }),
      bus.on("playerRevived", (e) => {
        this.deathT = -1;
        this.r.camera.zoomTo(w.boss ? 0.86 : 1, 5);
        juice.flash(C.white, 0.8, 0.6);
        juice.shake(0.6);
        juice.shockwave(e.x, e.y - 8, 2, 160, 0.9);
        juice.bloomSurge(1.2, 1);
        fxLevelUp(fx, e.x, e.y);
        this.view.texts.add("REVIVE!", 0, -40, { anchor: 1, scale: 3, rainbow: true, life: 1.6 });
        this.sfx("revive");
      }),
      bus.on("dash", (e) => {
        fxDash(fx, e.x, e.y, e.dx, e.dy);
        fx.speed.directional(Math.atan2(e.dy, e.dx), 0.28, { color: C.white, intensity: 0.6 });
        this.view.heroDash();
        this.haptic(12);
        this.sfx("dash");
      }),
      bus.on("levelUp", (e) => {
        this.levelAt = this.now;
        if (!calm) {
          fxLevelUp(fx, e.x, e.y);
          // short: the level-up modal (with its own big title) opens ~0.4 s later
          this.view.texts.add("LEVEL UP!", 0, -34, { anchor: 1, scale: 2, rainbow: true, life: 0.6, rise: 8 });
          this.haptic(20);
        } else fx.ps.emit(P.ring, e.x, e.y - 10, 1, NaN, C.yellow, 2);
        this.sfx("levelUp");
        this.opts.hooks?.levelUp?.(e.level);
      }),
      bus.on("evolution", (e) => {
        // picked inside the level-up / chest modal: the celebration waits until it closes (frame())
        if (time.paused || this.evoN > 0) {
          if (this.evoN < EVO_QUEUE) {
            const i = (this.evoHead + this.evoN) % EVO_QUEUE;
            this.evoX[i] = e.x;
            this.evoY[i] = e.y;
            this.evoName[i] = e.name;
            this.evoN++;
          }
          return;
        }
        this.evoNextAt = this.now + EVO_STAGGER;
        this.celebrateEvolution(e.x, e.y, e.name);
      }),
      bus.on("gem", (e) => {
        this.gemChain = this.gemT > 0 ? this.gemChain + 1 : 0;
        this.gemT = 0.6;
        fxPickup(fx, e.x, e.y, e.tier === 2 ? C.pink : e.tier === 3 ? C.yellow : e.tier === 4 ? rainbow(Math.random()) : C.aqua);
        this.sfx("gem", 0.5, Math.min(14, this.gemChain * 0.6));
        this.opts.hooks?.xpPulse?.();
      }),
      bus.on("coin", (e) => {
        fx.ps.emit(P.sparkle, e.x, e.y, 2, NaN, C.yellow);
        this.sfx("coin", 0.6);
        this.opts.hooks?.coinPulse?.();
      }),
      bus.on("pickup", (e) => {
        if (e.kind === "onigiri" || e.kind === "cake" || e.kind === "snack") this.sfx("food");
        else if (e.kind === "heart") {
          this.sfx("heal", 0.5, 5);
          fx.ps.emit(P.hearts, e.x, e.y - 6, 3, NaN, -1, 0.8, 1);
          return;
        } else this.sfx("powerup");
        fx.ps.emit(P.sparkle, e.x, e.y - 6, 8, NaN, -1, 1.2, 1.6);
      }),
      bus.on("magnet", () => {
        const p = w.player;
        fx.ps.emit(P.ring, p.x, p.y - 8, 1, NaN, C.red, 4);
        fx.ps.emit(P.ringThin, p.x, p.y - 8, 1, NaN, C.white, 6);
        this.view.texts.add("MAGNET!", 0, -30, { anchor: 1, color: C.red, scale: 2, life: 1 });
        this.sfx("magnet");
      }),
      bus.on("bomb", (e) => {
        juice.flash(C.white, 0.75, 0.35);
        juice.shake(0.75);
        juice.hitstop(90);
        juice.shockwave(e.x, e.y - 8, 2, 220, 0.9);
        juice.aberration(4);
        const v = this.r.camera.view;
        for (let i = 0; i < 7; i++)
          this.after(i * 0.06, () => {
            this.booms = 0;
            fxExplosion(fx, v.x + 20 + Math.random() * (v.w - 40), v.y + 30 + Math.random() * (v.h - 60), 26 + Math.random() * 16, false);
          });
        this.view.texts.add("BOOM!", 0, -34, { anchor: 1, color: C.yellow, scale: 3, life: 1.1 });
        this.sfx("explosionBig");
        this.haptic(60);
      }),
      bus.on("freeze", () => {
        juice.flash(C.cyan, 0.35, 0.35);
        this.view.texts.add("FREEZE!", 0, -30, { anchor: 1, color: C.cyan, scale: 2, life: 1.1 });
        this.sfx("freeze");
      }),
      bus.on("chestDropped", (e) => {
        fx.ps.emit(P.pillar, e.x, e.y - 30, 1, NaN, e.golden ? C.yellow : C.pinkLight, 2.4);
        fx.ps.emit(P.sparkle, e.x, e.y - 8, 10, NaN, -1, 1.2, 2);
        this.sfx("chestDrop", 1, 0, e.x);
      }),
      bus.on("chestCollected", (e) => {
        this.sfx("powerup");
        this.opts.hooks?.chest?.(e.golden);
      }),
      bus.on("comboRank", (e) => {
        this.sfx("rankUp", 1, e.rank);
        this.opts.hooks?.comboRank?.(e.id, e.rank);
        if (e.rank >= RANKS.length - 1 && !calm) juice.bloomSurge(0.6, 0.8);
      }),
      bus.on("comboBreak", (e) => {
        if (e.count >= 10) this.sfx("comboBreak");
        this.opts.hooks?.comboBreak?.(e.count);
      }),
      bus.on("comboDrop", () => {
        // a softer, higher crack than the full break (the HUD drops the rank letter)
        this.sfx("comboBreak", 0.45, 5);
      }),
      bus.on("ultReady", () => {
        this.sfx("ultReady");
        this.opts.hooks?.ultReady?.();
        this.haptic(20);
      }),
      bus.on("ultCutin", (e) => {
        fx.speed.radial(1.15, { color: C.white, intensity: 1 });
        juice.zoomPunch(0.08);
        if (this.opts.sound) audio.duck(0.65, 1.3);
        this.sfx("ultCutin");
        for (let i = 0; i < 4; i++) this.after(0.18 + i * 0.12, () => this.sfx("voiceBlip", 0.9, i * 2));
        this.opts.hooks?.cutin?.(e.hero, e.name);
        this.haptic(30);
      }),
      bus.on("ultStart", (e) => {
        this.opts.hooks?.cutinEnd?.();
        juice.flash(C.white, 0.7, 0.45);
        juice.shake(0.85);
        juice.bloomSurge(1.3, 1.4);
        juice.shockwave(e.x, e.y - 8, 1.8, 170, 0.9);
        juice.aberration(4);
        juice.zoomPunch(0.12);
        fx.ps.emit(P.rays, e.x, e.y - 10, 24, NaN, C.white, 1.3, 1.5);
        this.sfx("ultBlast");
        this.haptic(80);
      }),
      bus.on("ultSlash", (e) => {
        this.view.addSlashLine(e.x0, e.y0, e.x1, e.y1);
        juice.shake(0.18);
        juice.aberration(1.5);
        this.sfx("slash", 0.9, e.i % 6);
        const mx = (e.x0 + e.x1) / 2;
        const my = (e.y0 + e.y1) / 2;
        fx.ps.emit(P.petals, mx, my, 6, NaN, -1, 1.3, 2);
      }),
      bus.on("ultBurst", (e) => {
        juice.flash(C.pinkLight, 0.8, 0.5);
        juice.hitstop(90);
        juice.shake(0.9);
        juice.shockwave(e.x, e.y, 2.2, 200, 1);
        juice.bloomSurge(1.4, 1.2);
        const v = this.r.camera.view;
        for (let i = 0; i < 26; i++) fx.ps.emit(P.petals, v.x + Math.random() * v.w, v.y + Math.random() * v.h, 3, NaN, -1, 1.6, 2.5);
        for (let i = 0; i < 8; i++) fxFirework(fx, v.x + Math.random() * v.w, v.y + Math.random() * v.h, [C.pink, C.pinkLight, C.white, C.red]);
        this.sfx("explosionBig");
        this.haptic(70);
      }),
      bus.on("ultMeow", (e) => {
        // a wall of cats bursts in: dust row along the leading edge, speed lines along the run, NYA!
        const v = this.r.camera.view;
        const edge = e.dir > 0 ? v.x + 6 : v.x + v.w - 6;
        const ahead = e.dir > 0 ? 0 : Math.PI;
        for (let i = 0; i < 8; i++) fx.ps.emit(P.dust, edge, v.y + ((i + 0.5) / 8) * v.h, 3, ahead, -1, 1.4, 1.6);
        fx.speed.directional(e.dir > 0 ? 0 : Math.PI, 0.55, { color: C.paleYellow, intensity: 0.75 });
        // (at 60 % height: clear of the combo counter on the right edge and of the touch buttons below it)
        this.view.texts.add("NYA!", edge + e.dir * 46, v.y + v.h * 0.6, { color: C.paleYellow, scale: 3, life: 0.6, rise: 10, wobble: 2 });
        if (!calm) {
          juice.shake(0.45);
          if (e.wave === 0) juice.hitstop(40);
        }
        this.haptic(25);
        this.sfx("meow");
        this.after(0.15, () => this.sfx("meow", 0.8, 3));
      }),
      bus.on("ultEnd", () => {
        this.opts.hooks?.cutinEnd?.();
        this.r.camera.zoomTo(w.boss ? 0.86 : 1, 3);
      }),
      bus.on("waveIncoming", (e) => {
        this.sfx("waveIncoming");
        const t = e.label || (e.kind === "swarm" ? "SWARM!" : e.kind === "encircle" ? "SURROUNDED!" : e.kind === "storm" ? "BAT STORM!" : e.kind === "wisps" ? "WISP RUSH!" : "STAMPEDE!");
        this.opts.hooks?.banner?.("incoming", t);
      }),
      bus.on("eliteSpawned", () => {
        this.opts.hooks?.banner?.("elite", "ELITE!", "a sparkly big one appeared");
        this.sfx("telegraph");
      }),
      bus.on("bossWarning", (e) => {
        this.opts.hooks?.banner?.("warning", "WARNING", e.title);
        this.sfx("warning");
        this.after(1.1, () => this.sfx("warning"));
        this.after(2.2, () => this.sfx("warning"));
        this.haptic(40);
      }),
      bus.on("bossSpawn", (e) => {
        this.r.camera.zoomTo(0.86, 2);
        // the entrance beat: a freeze-frame, then a short slow-mo while the name card lands
        if (!calm) {
          juice.hitstop(120);
          juice.slowmo(0.4, 0.9);
        }
        juice.shake(0.5);
        juice.shockwave(e.enemy.x, e.enemy.y, 1.4, 140);
        this.opts.hooks?.banner?.("boss", e.title, e.subtitle);
        this.opts.hooks?.bossBar?.(e.enemy, e.title);
        this.musicBackAt = -1;
        if (this.opts.sound) audio.music(this.view.stage.bossMusic(e.enemy), 1.2);
        this.sfx("bossRoar");
      }),
      bus.on("bossKilled", (e) => {
        juice.slowmo(0.25, 1.2);
        juice.flash(C.white, 0.9, 0.7);
        juice.shake(1);
        juice.hitstop(160);
        for (let i = 0; i < 8; i++)
          this.after(i * 0.12, () => {
            this.booms = 0;
            fxExplosion(fx, e.x + (Math.random() - 0.5) * 50, e.y - 10 - Math.random() * 40, 20 + Math.random() * 20, true);
          });
        this.after(0.9, () => fxEliteDeath(fx, e.x, e.y, CONFETTI_COLORS));
        this.r.camera.zoomTo(1, 2);
        this.opts.hooks?.bossBar?.(null);
        this.sfx("bossDie");
        this.haptic(150);
        // back to the battle theme 2 s of game time after the death (see musicBackAt)
        if (!e.final) this.musicBackAt = w.t + 2;
      }),
      // "victory": the extended dawn celebration (slow-mo explosions, white flash, DAWN BREAKS!,
      // sunrise grade sweep, fireworks, victory music) lives in src/view/bestiary-fx.ts
    );
  }
}
