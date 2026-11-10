/**
 * FX bundle: everything in src/fx wired to one renderer.
 *
 *   const fx = createFx(renderer, { particles: QUALITY.mid.particles });
 *   // per frame (after sim update, before renderer.endFrame()):
 *   fx.update(time.dt, time.realDt);
 *   fx.draw();
 */
import { time as globalTime, type Time } from "../core/time";
import type { Renderer } from "../render/renderer";
import { Ambient } from "./ambient";
import { DamageNumbers } from "./damage";
import { Juice } from "./juice";
import { Lightning } from "./lightning";
import { Particles } from "./particles";
import type { FxKit } from "./presets";
import { SpeedLines } from "./speedlines";
import { Afterimages } from "./trails";

export * from "./particles";
export * from "./presets";
export * from "./damage";
export * from "./juice";
export * from "./lightning";
export * from "./trails";
export * from "./ambient";
export * from "./speedlines";

export interface Fx extends FxKit {
  ps: Particles;
  juice: Juice;
  dmg: DamageNumbers;
  bolts: Lightning;
  ghosts: Afterimages;
  ambient: Ambient;
  speed: SpeedLines;
  /** dt = scaled sim dt (particles, numbers, bolts, ghosts freeze in hitstop); realDt for ambient + speed lines. */
  update(dt: number, realDt: number): void;
  draw(): void;
  clear(): void;
}

export function createFx(r: Renderer, opts: { particles?: number; time?: Time } = {}): Fx {
  const ps = new Particles(r, opts.particles ?? 3000);
  const juice = new Juice(r, opts.time ?? globalTime);
  const dmg = new DamageNumbers(r, ps);
  const bolts = new Lightning(r);
  const ghosts = new Afterimages(r);
  const ambient = new Ambient(r);
  const speed = new SpeedLines(r);
  return {
    ps,
    juice,
    dmg,
    bolts,
    ghosts,
    ambient,
    speed,
    update(dt: number, realDt: number) {
      ps.update(dt);
      dmg.update(dt);
      bolts.update(dt);
      ghosts.update(dt);
      ambient.update(realDt);
      speed.update(realDt);
    },
    draw() {
      ghosts.draw();
      ps.draw();
      bolts.draw();
      dmg.draw();
      ambient.draw();
      speed.draw();
    },
    clear() {
      ps.clear();
      dmg.clear();
      bolts.clear();
      ghosts.clear();
      speed.stop();
    },
  };
}
