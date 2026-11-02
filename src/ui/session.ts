/**
 * A running World + its view + feedback bridge. Used for the real run and for
 * the title-screen attract mode (bot-driven, silent, auto-picks, restarts).
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

  /** Fast-forward headlessly (bot-driven, muted). */
  skip(seconds: number): void {
    if (seconds <= 0) return;
    const w = this.world;
    w.muted = true;
    simulate(w, seconds, 1 / 30, this.bot ?? new Bot(7));
    w.muted = false;
    this.app.r.camera.snapTo(w.player.x, w.player.y - 8);
    // events were muted: sync the boss UI if one is alive now
    const b = w.boss;
    if (b && b.def.boss) {
      this.opts.hooks?.bossBar?.(b, b.def.boss.title);
      this.app.r.camera.zoomTo(0.86, 4);
    }
  }

  /** Advance the sim by the scaled dt (fixed sub-steps) and follow with the camera. */
  tick(simDt: number, realDt: number): void {
    const w = this.world;
    const cam = this.app.r.camera;
    w.viewW = cam.view.w || w.viewW;
    w.viewH = cam.view.h || w.viewH;
    if (this.bot && w.phase === "play") this.bot.think(w, w.input, Math.max(simDt, 1e-3));
    if (this.attract) {
      while (w.pendingLevels > 0) w.choose(this.bot!.pick(w, w.offer()));
      while (w.pendingChests.length > 0) w.openChest();
      if (w.phase !== "play" || w.t > 240) this.restartAttract();
    }
    substep(simDt, 1 / 60, (h) => this.world.step(h));
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
    this.skip(40);
  }

  dispose(): void {
    this.feedback.dispose();
    this.world.bus.clear();
  }
}
