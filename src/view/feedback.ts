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
import { clamp } from "../core/math";
import type { Input } from "../core/input";
import { CONFETTI_COLORS, fxDash, fxEliteDeath, fxEnemyDeath, fxExplosion, fxFirework, fxHit, fxLevelUp, fxPickup, P, type Fx } from "../fx";
import { GRADES } from "../render/post";
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

export class Feedback {
  private offs: (() => void)[] = [];
  private hitFx = 0;
  private deathFx = 0;
  private nums = 0;
  private booms = 0;
  private hitSfx = 0;
  private gemChain = 0;
  private gemT = 0;
  private now = 0;
  private later: { t: number; fn: () => void }[] = [];
  private beat = 0;
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
    this.later.length = 0;
    this.r.post.damageFloor = 0;
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

  private after(sec: number, fn: () => void): void {
    this.later.push({ t: this.now + sec, fn });
  }

  /** Per-frame: reset budgets, run scheduled effects, low-HP heartbeat, grade + ambient. */
  frame(realDt: number): void {
    this.now += realDt;
    this.hitFx = this.deathFx = this.nums = this.booms = this.hitSfx = 0;
    if (this.later.length) {
      for (let i = this.later.length - 1; i >= 0; i--) {
        const l = this.later[i];
        if (this.now >= l.t) {
          this.later.splice(i, 1);
          l.fn();
        }
      }
    }
    this.gemT -= realDt;
    if (this.gemT <= 0) this.gemChain = 0;
    const w = this.w;
    const p = w.player;
    // low-HP heartbeat vignette (lub-dub every ~0.8 s)
    const k = p.hp / p.maxHp;
    if (k < 0.3 && w.phase === "play") {
      this.beat += realDt * (1.1 + (0.3 - k) * 3);
      const ph = this.beat % 1;
      const pulse = Math.max(Math.exp(-ph * 14), ph > 0.18 ? Math.exp(-(ph - 0.18) * 14) * 0.7 : 0);
      this.r.post.damageFloor = 0.18 + 0.32 * pulse * (1 - k / 0.3 + 0.4);
    } else this.r.post.damageFloor = Math.max(0, this.r.post.damageFloor - realDt);
    // day -> dusk -> night over the 9 minutes to the final boss
    const prog = clamp(w.t / 540, 0, 1);
    if (prog < 0.5) this.r.post.blendGrade(GRADES.day, GRADES.dusk, prog * 2);
    else this.r.post.blendGrade(GRADES.dusk, GRADES.night, (prog - 0.5) * 2);
    const night = clamp((prog - 0.55) * 2.5, 0, 1);
    this.fx.ambient.set({ petals: Math.round(12 * (1 - night)), motes: 10 + Math.round(6 * night), fireflies: Math.round(22 * night) });
    if (this.opts.sound) audio.setIntensity(clamp(w.enemyCount / 110 + Math.max(0, w.comboRank) * 0.08 + (w.boss ? 0.4 : 0), 0, 1));
  }

  private bind(): void {
    const w = this.w;
    const bus = w.bus;
    const fx = this.fx;
    const juice = fx.juice;
    const calm = !!this.opts.calm;
    const sub = this.offs;

    sub.push(
      bus.on("enemyHit", (e) => {
        const boss = !!e.enemy.def.boss;
        if (this.hitFx < HIT_FX_BUDGET) {
          this.hitFx++;
          fxHit(fx, e.x, e.y, e.crit ? C.yellow : e.color, e.angle);
        }
        if (this.numbers && this.nums < NUM_BUDGET) {
          this.nums++;
          fx.dmg.spawn(e.x + (Math.random() - 0.5) * 4, e.y - 8, e.dmg, e.crit ? "crit" : "normal");
        }
        if (this.hitSfx < 2) {
          this.hitSfx++;
          const def = WEAPONS.get(e.source);
          const id = (boss ? "bossHit" : e.crit ? "hitCrit" : (def?.hitSfx as SfxId | undefined) ?? "hit") as SfxId;
          this.sfx(id, 0.7, (Math.random() * 4 - 2) | 0, e.x);
        }
        if (e.crit && !calm) juice.shake(0.04);
      }),
      bus.on("enemyKilled", (e) => {
        const en = e.enemy;
        // combo milestones between the rank thresholds: a bright two-note blip every 25
        const cb = w.combo;
        if (cb >= 25 && cb % 25 === 0 && rankFor(cb) === rankFor(cb - 1)) this.sfx("comboUp", 0.8, Math.min(12, cb / 25));
        if (e.boss) return;
        if (e.elite) {
          fxEliteDeath(fx, e.x, e.y, en.def.colors);
          if (!calm) juice.flash(C.white, 0.15, 0.12);
          this.sfx("eliteDie", 1, 0, e.x);
          this.haptic(25);
          return;
        }
        if (this.deathFx < DEATH_FX_BUDGET) {
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
        if (this.booms >= BOOM_BUDGET) {
          fx.ps.emit(P.flare, e.x, e.y, 1, NaN, C.paleYellow, e.r / 16);
          return;
        }
        this.booms++;
        fxExplosion(fx, e.x, e.y, e.r, !calm);
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
        fx.ps.emit(P.hearts, e.x, e.y - 12, 6);
        fx.ps.emit(P.ring, e.x, e.y - 10, 1, NaN, C.lime, 1.2);
        this.sfx("heal");
      }),
      bus.on("playerDied", (e) => {
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
        juice.flash(C.white, 0.6, 0.5);
        juice.hueCycle(0.7);
        juice.bloomSurge(1, 1);
        juice.shockwave(e.x, e.y - 8, 1.5, 120, 0.8);
        for (let i = 0; i < 6; i++) this.after(i * 0.08, () => fxFirework(fx, w.player.x + (Math.random() - 0.5) * 90, w.player.y - 20 - Math.random() * 50));
        this.view.texts.add("EVOLUTION!", 0, -40, { anchor: 1, scale: 3, rainbow: true, life: 1.8, wobble: 2 });
        this.view.pose(0.9);
        this.opts.hooks?.banner?.("evolution", "EVOLUTION!", e.name);
        this.sfx("evolve");
        this.haptic(40);
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
        if (e.kind === "onigiri" || e.kind === "cake") this.sfx("food");
        else this.sfx("powerup");
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
      bus.on("ultMeow", () => {
        juice.shake(0.25);
        this.sfx("meow");
        this.after(0.15, () => this.sfx("meow", 0.8, 3));
      }),
      bus.on("ultEnd", () => {
        this.r.camera.zoomTo(w.boss ? 0.86 : 1, 3);
      }),
      bus.on("waveIncoming", (e) => {
        this.sfx("waveIncoming");
        const t = e.kind === "swarm" ? "SWARM!" : e.kind === "encircle" ? "SURROUNDED!" : "STAMPEDE!";
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
        juice.shake(0.5);
        juice.shockwave(e.enemy.x, e.enemy.y, 1.4, 140);
        this.opts.hooks?.banner?.("boss", e.title, e.subtitle);
        this.opts.hooks?.bossBar?.(e.enemy, e.title);
        if (this.opts.sound) audio.music(e.enemy.def.boss?.music ?? "boss", 1.2);
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
        if (this.opts.sound && !e.final) this.after(2, () => audio.music("battle", 2));
      }),
      bus.on("victory", () => {
        const p = w.player;
        for (let i = 0; i < 14; i++) this.after(i * 0.22, () => fxFirework(fx, p.x + (Math.random() - 0.5) * 160, p.y - 30 - Math.random() * 90));
        this.view.texts.add("DAWN BREAKS!", 0, -50, { anchor: 1, scale: 3, rainbow: true, life: 3 });
        juice.flash(C.paleYellow, 0.6, 1);
        this.r.setGrade(GRADES.day, 2);
        this.sfx("victory");
        // the victory track (fanfare intro) starts with the sunrise, not on the results screen
        if (this.opts.sound) audio.music("victory", 1.2);
        this.opts.hooks?.victory?.();
      }),
    );
  }
}
