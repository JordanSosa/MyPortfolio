/**
 * Lightning bolts: jagged polylines (midpoint displacement) between two
 * points, drawn as stretched/rotated pixel quads: coloured glow (additive +
 * bloom) under a white core. Flickers and re-jitters over its short life;
 * optional side branches.
 *
 *   bolts.strike(x0, y0, x1, y1);                                  // cyan default
 *   bolts.strike(x0, y0, x1, y1, { color: C.yellow, thickness: 3, branches: 3, life: 0.2 });
 *   bolts.update(time.dt); bolts.draw();
 */
import { C } from "../art/palette";
import { fxRng } from "../core/rng";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";

export interface BoltOpts {
  color?: number;
  /** Core thickness in px (default 2). */
  thickness?: number;
  /** Seconds (default 0.14). */
  life?: number;
  /** Number of side branches (default 2). */
  branches?: number;
  /** Jaggedness relative to length (default 0.2). */
  jag?: number;
  /** Subdivision generations 3..6 (default 5 -> 33 points). */
  detail?: number;
  /** Glow sprite at the impact point (default true). */
  impact?: boolean;
  layer?: number;
}

const MAX_BOLTS = 64;
const MAX_PTS = 65;

export class Lightning {
  private pts = new Float32Array(MAX_BOLTS * MAX_PTS * 2);
  private n = new Uint8Array(MAX_BOLTS);
  private age = new Float32Array(MAX_BOLTS);
  private life = new Float32Array(MAX_BOLTS);
  private color = new Uint32Array(MAX_BOLTS);
  private thick = new Float32Array(MAX_BOLTS);
  private jag = new Float32Array(MAX_BOLTS);
  private detail = new Uint8Array(MAX_BOLTS);
  private ends = new Float32Array(MAX_BOLTS * 4);
  private rejit = new Float32Array(MAX_BOLTS);
  private impact = new Uint8Array(MAX_BOLTS);
  private layer = new Uint8Array(MAX_BOLTS);
  private alive = new Uint8Array(MAX_BOLTS);
  private next = 0;
  private tmp = new Float32Array(MAX_PTS * 2);

  constructor(private readonly r: Renderer) {}

  /** Strike from (x0,y0) to (x1,y1). Returns the bolt slot. */
  strike(x0: number, y0: number, x1: number, y1: number, o: BoltOpts = {}): number {
    const main = this.add(x0, y0, x1, y1, o.color ?? C.cyan, o.thickness ?? 2, o.life ?? 0.14, o.jag ?? 0.2, o.detail ?? 5, o.impact ?? true, o.layer ?? Layer.FxAdd);
    const br = o.branches ?? 2;
    const base = main * MAX_PTS * 2;
    const np = this.n[main];
    for (let b = 0; b < br; b++) {
      const k = 2 + Math.floor(fxRng.next() * (np - 4));
      const bx = this.pts[base + k * 2];
      const by = this.pts[base + k * 2 + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.sqrt(dx * dx + dy * dy) * (0.25 + fxRng.next() * 0.25);
      const ang = Math.atan2(dy, dx) + fxRng.spread(1.1);
      this.add(bx, by, bx + Math.cos(ang) * len, by + Math.sin(ang) * len, o.color ?? C.cyan, Math.max(1, (o.thickness ?? 2) - 1), (o.life ?? 0.14) * 0.7, (o.jag ?? 0.2) * 1.2, Math.max(3, (o.detail ?? 5) - 1), false, o.layer ?? Layer.FxAdd);
    }
    return main;
  }

  /** Strike from the sky down onto (x, y) (e.g. Thunder Bell). */
  fromSky(x: number, y: number, height = 140, o: BoltOpts = {}): number {
    return this.strike(x + fxRng.spread(18), y - height, x, y, { branches: 3, thickness: 2, ...o });
  }

  private add(x0: number, y0: number, x1: number, y1: number, color: number, thick: number, life: number, jag: number, detail: number, impact: boolean, layer: number): number {
    // find a free slot (or recycle round-robin)
    let s = -1;
    for (let k = 0; k < MAX_BOLTS; k++) {
      const i = (this.next + k) % MAX_BOLTS;
      if (!this.alive[i]) {
        s = i;
        break;
      }
    }
    if (s < 0) s = this.next;
    this.next = (s + 1) % MAX_BOLTS;
    this.alive[s] = 1;
    this.age[s] = 0;
    this.life[s] = life;
    this.color[s] = color;
    this.thick[s] = thick;
    this.jag[s] = jag;
    this.detail[s] = Math.min(6, Math.max(2, detail));
    this.impact[s] = impact ? 1 : 0;
    this.layer[s] = layer;
    this.ends[s * 4] = x0;
    this.ends[s * 4 + 1] = y0;
    this.ends[s * 4 + 2] = x1;
    this.ends[s * 4 + 3] = y1;
    this.rejit[s] = 0.035;
    this.build(s);
    return s;
  }

  private build(s: number): void {
    const x0 = this.ends[s * 4];
    const y0 = this.ends[s * 4 + 1];
    const x1 = this.ends[s * 4 + 2];
    const y1 = this.ends[s * 4 + 3];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    // iterative midpoint displacement into tmp, then copy
    const a = this.tmp;
    a[0] = x0;
    a[1] = y0;
    a[2] = x1;
    a[3] = y1;
    let count = 2;
    let disp = len * this.jag[s];
    for (let g = 0; g < this.detail[s]; g++) {
      // expand from the end backwards so we can do it in place
      const nc = count * 2 - 1;
      for (let i = count - 1; i >= 0; i--) {
        a[i * 4] = a[i * 2];
        a[i * 4 + 1] = a[i * 2 + 1];
      }
      for (let i = 1; i < nc; i += 2) {
        const mx = (a[(i - 1) * 2] + a[(i + 1) * 2]) / 2;
        const my = (a[(i - 1) * 2 + 1] + a[(i + 1) * 2 + 1]) / 2;
        const o = (fxRng.next() * 2 - 1) * disp;
        a[i * 2] = mx + nx * o;
        a[i * 2 + 1] = my + ny * o;
      }
      count = nc;
      disp *= 0.52;
    }
    const base = s * MAX_PTS * 2;
    this.pts.set(a.subarray(0, count * 2), base);
    this.n[s] = count;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    for (let s = 0; s < MAX_BOLTS; s++) {
      if (!this.alive[s]) continue;
      this.age[s] += dt;
      if (this.age[s] >= this.life[s]) {
        this.alive[s] = 0;
        continue;
      }
      this.rejit[s] -= dt;
      if (this.rejit[s] <= 0) {
        this.rejit[s] = 0.035;
        this.build(s);
      }
    }
  }

  clear(): void {
    this.alive.fill(0);
  }

  draw(): void {
    const r = this.r;
    for (let s = 0; s < MAX_BOLTS; s++) {
      if (!this.alive[s]) continue;
      const t = this.age[s] / this.life[s];
      const flick = t < 0.15 ? 1 : (1 - t) * (0.55 + 0.45 * fxRng.next());
      const col = this.color[s];
      const th = this.thick[s];
      const L = this.layer[s];
      const base = s * MAX_PTS * 2;
      const n = this.n[s];
      for (let i = 0; i < n - 1; i++) {
        const ax = this.pts[base + i * 2];
        const ay = this.pts[base + i * 2 + 1];
        const bx = this.pts[base + i * 2 + 2];
        const by = this.pts[base + i * 2 + 3];
        // extend each segment by 0.5px at both ends so joints never gap
        const dx = bx - ax;
        const dy = by - ay;
        const l = Math.sqrt(dx * dx + dy * dy) || 1;
        const ex = (dx / l) * 0.5;
        const ey = (dy / l) * 0.5;
        r.line(L, ax - ex, ay - ey, bx + ex, by + ey, th + 2, col, 0.55 * flick, Flag.Add | Flag.Glow);
        r.line(L, ax - ex, ay - ey, bx + ex, by + ey, th * 3 + 2, col, 0.5 * flick, Flag.GlowOnly);
        r.line(L, ax - ex, ay - ey, bx + ex, by + ey, Math.max(1, th - 0.5), 0xffffff, flick, Flag.Add | Flag.Glow);
      }
      if (this.impact[s] && n > 1) {
        const ix = this.pts[base + (n - 1) * 2];
        const iy = this.pts[base + (n - 1) * 2 + 1];
        r.glow(ix, iy, 14 * (1 - t * 0.5), col, 0.9 * flick);
        r.glow(ix, iy, 6, 0xffffff, flick);
      }
    }
  }
}
