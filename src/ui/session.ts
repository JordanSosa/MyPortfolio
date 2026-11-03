/**
 * A running World + its view + feedback bridge. Used for the real run and for
 * the title-screen attract mode (bot-driven, silent, auto-picks, restarts).
 *
 * Main-thread budget: the attract mode's fast-forward (skip at boot and on every
 * restart) runs incrementally, a slice of at most ATTRACT_SLICE_MS per frame, so
 * it never blocks the boot or a title-screen frame; a real run's skip() stays
 * synchronous (?skip=, __kk.skipTo, the results deep link and tests rely on it).
 * Slow frames (> 25 ms of sim time) sub-step at 1/30 instead of 1/60 - the same
 * step the bot and the balance probe use - so a struggling phone isn't asked to
 * simulate twice as many steps.
 *
 * The run's RunConfig (stage, relics, talents, twists...) rides in the options
 * (`WorldOptions.run`, see src/game/run-config.ts); the attract mode keeps it
 * across its restarts.
 */
import { substep } from "../core/loop";
import { Bot, simulate } from "../debug/bot";
import { World, type WorldOptions } from "../game/world";
import { Feedback, type FeedbackHooks } from "../view/feedback";
import { WorldView } from "../view/world-view";
import type { App } from "./app";

export interface SessionOptions extends WorldOptions {
  attract?: boolean;
  /** Bot drives the player (autoplay / attract). */
  bot?: boolean;
  hooks?: FeedbackHooks;
}

/** Main-thread budget per frame for the attract mode's incremental fast-forward. */
const ATTRACT_SLICE_MS = 8;

export class Session {
  world: World;
  readonly view: WorldView;
  feedback: Feedback;
  bot: Bot | null;
  readonly attract: boolean;
  /** Camera target offset in art px (title screen frames the attract hero below the menu). */
  camOffX = 0;
  camOffY = 0;
  private opts: SessionOptions;
  /** Attract mode: seconds of fast-forward still to simulate (incrementally, see tick()). */
  private pendingSkip = 0;

  constructor(
    private readonly app: App,
    opts: SessionOptions,
  ) {
    this.opts = opts;
    this.attract = !!opts.attract;
    this.world = new World(opts);
    this.bot = opts.bot || opts.attract ? new Bot((opts.seed ?? 1) ^ 0xb07) : null;
    if (this.bot && this.attract) this.bot.sloppiness = 0.35;
    this.view = new WorldView(app.r, app.fx, this.world);
    this.view.heroHud = !this.attract;
    this.feedback = this.makeFeedback();
    app.r.camera.snapTo(this.world.player.x, this.world.player.y - 8);
  }

  private makeFeedback(): Feedback {
    return new Feedback(this.world, this.app.r, this.app.fx, this.view, {
      sound: !this.attract,
      input: this.attract ? null : this.app.input,
      hooks: this.opts.hooks,
      // the title screen stays clean: no damage numbers behind the logo
      numbers: this.attract ? false : this.app.settings.damageNumbers,
      calm: this.attract,
    });
  }

  /**
   * Fast-forward headlessly (bot-driven, muted). A real run's skip is synchronous;
   * the attract mode's is queued and simulated a slice per frame by tick().
   */
  skip(seconds: number): void {
    if (seconds <= 0) return;
    const w = this.world;
    w.muted = true;
    if (this.attract) {
      this.pendingSkip += seconds;
      return;
    }
    simulate(w, seconds, 1 / 30, this.bot ?? new Bot(7));
    this.endSkip();
  }

  /** The fast-forward is over: unmute, snap the camera, sync the boss UI (events were muted). */
  private endSkip(): void {
    const w = this.world;
    w.muted = false;
    this.app.r.camera.snapTo(w.player.x, w.player.y - 8);
    const b = w.boss;
    if (b && b.def.boss) {
      this.opts.hooks?.bossBar?.(b, b.def.boss.title);
      this.app.r.camera.zoomTo(0.86, 4);
    }
  }

  /** One frame's slice of the attract fast-forward: at most 1 s of sim and ATTRACT_SLICE_MS of main thread. */
  private skipSlice(): void {
    const w = this.world;
    const t0 = w.t;
    const start = performance.now();
    simulate(w, Math.min(this.pendingSkip, 1), 1 / 30, this.bot ?? new Bot(7), () => (performance.now() - start < ATTRACT_SLICE_MS ? undefined : false));
    const ran = w.t - t0;
    this.pendingSkip -= Math.max(ran, 1e-3);
    // (a bot death mid fast-forward: stop, the attract restarts on the next tick)
    if (this.pendingSkip <= 0 || w.phase !== "play") {
      this.pendingSkip = 0;
      this.endSkip();
    }
  }

  /** Advance the sim by the scaled dt (fixed sub-steps) and follow with the camera. */
  tick(simDt: number, realDt: number): void {
    const w = this.world;
    const cam = this.app.r.camera;
    w.viewW = cam.view.w || w.viewW;
    w.viewH = cam.view.h || w.viewH;
    if (this.pendingSkip > 0) {
      // attract warm-up / restart: fast-forward a slice this frame instead of playing
      this.skipSlice();
      const p = this.world.player;
      cam.follow(p.x + this.camOffX, p.y - 8 + this.camOffY, p.vx, p.vy, realDt);
      this.feedback.frame(realDt);
      return;
    }
    if (this.bot && w.phase === "play") this.bot.think(w, w.input, Math.max(simDt, 1e-3));
    if (this.attract) {
      while (w.pendingLevels > 0) w.choose(this.bot!.pick(w, w.offer()));
      while (w.pendingChests.length > 0) w.openChest();
      if (w.phase !== "play" || w.t > 240) {
        this.restartAttract();
        return;
      }
    }
    // slow frames sub-step at 1/30 (the bot / balance step) rather than doubling the sim cost at 1/60
    substep(simDt, simDt > 0.025 ? 1 / 30 : 1 / 60, (h) => this.world.step(h));
    const p = this.world.player;
    cam.follow(p.x + this.camOffX, p.y - 8 + this.camOffY, p.vx, p.vy, realDt);
    this.feedback.frame(realDt);
  }

  draw(time: number, simDt: number, realDt: number): void {
    this.view.draw(time, simDt, realDt);
  }

  private restartAttract(): void {
    this.feedback.dispose();
    this.world.bus.clear();
    const heroes = ["hoshi", "rin", "mochi"];
    const hero = heroes[(heroes.indexOf(this.world.hero.id) + 1) % heroes.length];
    this.opts = { ...this.opts, hero, seed: ((this.opts.seed ?? 1) * 16807) >>> 0 };
    this.world = new World(this.opts);
    this.view.setWorld(this.world);
    this.feedback = this.makeFeedback();
    this.app.r.camera.snapTo(this.world.player.x, this.world.player.y - 8);
    this.skip(40);
  }

  dispose(): void {
    this.feedback.dispose();
    this.world.bus.clear();
  }
}
