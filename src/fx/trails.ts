/**
 * Afterimages: fading ghost copies of a sprite frame (dash, fast enemies,
 * boss teleports). Pooled, zero allocations.
 *
 *   ghosts.spawn(handle, x, y, sx, sy, rot, C.cyan, 0.25, 0.6);   // translucent cyan silhouette
 *   // or let a TrailEmitter drop them at an interval while dashing:
 *   const trail = new TrailEmitter(ghosts, 0.03);
 *   trail.tick(dt, handle, x, y, facing, 1, i % 2 ? C.cyan : C.pink);
 *   ghosts.update(time.dt); ghosts.draw();
 */
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";

const MAX = 96;

export class Afterimages {
  private h = new Int32Array(MAX);
  private x = new Float32Array(MAX);
  private y = new Float32Array(MAX);
  private sx = new Float32Array(MAX);
  private sy = new Float32Array(MAX);
  private rot = new Float32Array(MAX);
  private col = new Uint32Array(MAX);
  private age = new Float32Array(MAX);
  private life = new Float32Array(MAX);
  private a0 = new Float32Array(MAX);
  private layer = new Uint8Array(MAX);
  private flags = new Uint8Array(MAX);
  private alive = new Uint8Array(MAX);
  private next = 0;
  /** How much ghosts become flat tinted silhouettes (0 = tinted sprite, 1 = solid colour). */
  flash = 0.7;

  constructor(private readonly r: Renderer) {}

  /**
   * Spawn a ghost of frame `handle`: a translucent silhouette tinted `color`
   * (see `flash`). additive=true makes it glow (use sparingly: overlapping
   * additive ghosts saturate to white).
   */
  spawn(handle: number, x: number, y: number, sx = 1, sy = 1, rot = 0, color = 0x4fe6df, life = 0.25, alpha = 0.6, layer: number = Layer.FxBelow, additive = false, glow = false): void {
    const i = this.next;
    this.next = (i + 1) % MAX;
    this.alive[i] = 1;
    this.h[i] = handle;
    this.x[i] = x;
    this.y[i] = y;
    this.sx[i] = sx;
    this.sy[i] = sy;
    this.rot[i] = rot;
    this.col[i] = color;
    this.age[i] = 0;
    this.life[i] = life;
    this.a0[i] = alpha;
    this.layer[i] = layer;
    this.flags[i] = (additive ? Flag.Add : 0) | (glow ? Flag.Glow : 0);
  }

  update(dt: number): void {
    if (dt <= 0) return;
    for (let i = 0; i < MAX; i++) {
      if (!this.alive[i]) continue;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) this.alive[i] = 0;
    }
  }

  clear(): void {
    this.alive.fill(0);
  }

  draw(): void {
    const b = this.r.batch;
    // oldest first
    for (let k = 0; k < MAX; k++) {
      const i = (this.next + k) % MAX;
      if (!this.alive[i]) continue;
      const t = this.age[i] / this.life[i];
      const a = this.a0[i] * (1 - t) * (1 - t * 0.5);
      // flash makes the ghost a colour-tinted silhouette (flash lerps toward the tint)
      b.draw(this.layer[i], this.h[i], this.x[i], this.y[i], this.sx[i], this.sy[i], this.rot[i], this.col[i], a, this.flash, this.flags[i]);
    }
  }
}

/** Drops afterimages every `interval` seconds while ticked. */
export class TrailEmitter {
  private acc = 0;
  /** Spawn additive (glowing) ghosts instead of translucent silhouettes. */
  additive = false;
  constructor(
    private readonly ghosts: Afterimages,
    public interval = 0.03,
    public life = 0.26,
    public alpha = 0.55,
  ) {}

  reset(): void {
    this.acc = 0;
  }

  /** Call every frame while the trail should emit. Returns true if a ghost was spawned. */
  tick(dt: number, handle: number, x: number, y: number, sx = 1, sy = 1, color = 0x4fe6df, layer: number = Layer.FxBelow): boolean {
    this.acc -= dt;
    if (this.acc > 0) return false;
    this.acc += this.interval;
    if (this.acc < 0) this.acc = this.interval;
    this.ghosts.spawn(handle, x, y, sx, sy, 0, color, this.life, this.alpha, layer, this.additive, false);
    return true;
  }
}
