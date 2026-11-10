/**
 * Stage 4 / 5 visuals entry point (one field on WorldView, one bind in
 * Feedback): the Beach Episode's (beach-fx.ts) and The Final Arc's
 * (finale-fx.ts) per-enemy looks, persistent overlays and cue handlers.
 *
 *   view.s45.decorate(...)   WorldView.drawEnemies, before the bestiary's
 *   view.s45.draw(...)       WorldView.draw, after the bullets
 *   view.s45.bind(w, opts)   Feedback.bind (enemyFx 400-499, boss deaths, prop pops)
 */
import type { Fx } from "../fx";
import type { Renderer } from "../render/renderer";
import type { Enemy } from "../game/types";
import type { World } from "../game/world";
import type { Anims } from "./anims";
import { BeachFx } from "./beach-fx";
import { FinaleFx } from "./finale-fx";
import type { S45BindOpts } from "./s45-common";
import type { Speech } from "./speech";
import type { WorldTexts } from "./texts";

export type { S45BindOpts };

export class S45Fx {
  readonly beach: BeachFx;
  readonly finale: FinaleFx;

  constructor(r: Renderer, fx: Fx, anims: Anims, texts: WorldTexts, speech: Speech) {
    this.beach = new BeachFx(r, fx, anims, texts, speech);
    this.finale = new FinaleFx(r, fx, anims, texts, speech);
  }

  setWorld(w: World): void {
    this.beach.setWorld(w);
    this.finale.setWorld(w);
  }

  /**
   * Per enemy (WorldView.drawEnemies): true when it drew the sprite itself.
   * `tint` / `flash` / `alpha` = what the default draw would use.
   */
  decorate(e: Enemy, h: number, sx: number, sy: number, y: number, time: number, tint: number, flash: number, alpha: number): boolean {
    if (this.finale.flashback(e, h, sx, sy, y, flash, alpha)) return true;
    return this.beach.decorate(e, h, sx, sy, y, time, tint, flash, alpha) || this.finale.decorate(e, h, sx, sy, y, time, tint, flash, alpha);
  }

  draw(time: number, dt: number, realDt: number): void {
    this.beach.draw(time, dt, realDt);
    this.finale.draw(time, dt, realDt);
  }

  bind(w: World, o: S45BindOpts): (() => void)[] {
    return [
      () => {
        this.beach.dispose();
        this.finale.dispose();
      },
      ...this.beach.bind(w, o),
      ...this.finale.bind(w, o),
    ];
  }
}
