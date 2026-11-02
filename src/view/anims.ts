/**
 * Sprite handle cache: resolve atlas ids once, draw by number afterwards.
 * Missing manifest ids resolve to the atlas placeholder (pink checker).
 */
import type { Anim } from "../render/atlas";
import type { Renderer } from "../render/renderer";

export class Anims {
  private map = new Map<string, Anim>();
  /** id -> fps -> anim (two-level so hot loops never build "id@fps" key strings). */
  private fpsMap = new Map<string, Map<number, Anim>>();
  constructor(private readonly r: Renderer) {}

  get(id: string): Anim {
    let a = this.map.get(id);
    if (!a) {
      a = this.r.atlas.anim(id);
      this.map.set(id, a);
    }
    return a;
  }

  /** Anim with an fps override (cached per id+fps). */
  fps(id: string, fps: number): Anim {
    if (!fps) return this.get(id);
    let m = this.fpsMap.get(id);
    if (!m) {
      m = new Map();
      this.fpsMap.set(id, m);
    }
    let a = m.get(fps);
    if (!a) {
      const b = this.get(id);
      a = { first: b.first, count: b.count, fps };
      m.set(fps, a);
    }
    return a;
  }

  /** Frame handle at time t (looping). */
  at(id: string, t: number): number {
    const a = this.get(id);
    let f = Math.floor(t * a.fps) % a.count;
    if (f < 0) f += a.count;
    return a.first + f;
  }

  /** Frame `f` (wrapped). */
  frame(id: string, f: number): number {
    const a = this.get(id);
    const k = ((f % a.count) + a.count) % a.count;
    return a.first + (k | 0);
  }
}
