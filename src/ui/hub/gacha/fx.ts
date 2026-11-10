/**
 * Summon particles on ONE 2D canvas (a few hundred DOM nodes would each need
 * a compositor layer on phones): sparkles spiralling into the summoning circle,
 * the meteor's trail, impact bursts, star-up twinkles and the MYTHIC rainbow
 * confetti. A fixed pool (no allocation per frame), driven by the kit ticker
 * (App.frame -> kitTick), idle (not ticking) when nothing is alive.
 */
import { animate, stopAnimating, type Tickable } from "../../kit/ticker";

const CAP = 480;
const K_SPARK = 0;
const K_CONFETTI = 1;
const K_SPIRAL = 2;
const K_DOT = 3;

class P {
  k = 0;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  g = 0;
  drag = 0;
  life = 0;
  max = 1;
  size = 2;
  rot = 0;
  vr = 0;
  color = "#fff";
  // spiral
  cx = 0;
  cy = 0;
  ang = 0;
  rad = 0;
  r0 = 0;
  delay = 0;
}

export class Particles implements Tickable {
  readonly el: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D | null;
  private readonly pool: P[] = [];
  private n = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private disposed = false;

  constructor(cls = "sm-fx") {
    this.el = document.createElement("canvas");
    this.el.className = cls;
    this.el.setAttribute("aria-hidden", "true");
    this.g = this.el.getContext("2d");
    for (let i = 0; i < CAP; i++) this.pool.push(new P());
    this.resize();
    addEventListener("resize", this.resize);
  }

  /** Match the canvas to the viewport (DPR capped at 2: particles are soft pixels anyway). */
  readonly resize = (): void => {
    this.dpr = Math.min(2, Math.max(1, devicePixelRatio || 1));
    this.w = innerWidth;
    this.h = innerHeight;
    this.el.width = Math.round(this.w * this.dpr);
    this.el.height = Math.round(this.h * this.dpr);
  };

  get width(): number {
    return this.w;
  }
  get height(): number {
    return this.h;
  }

  private add(): P | null {
    if (this.n >= CAP || this.disposed) return null;
    const p = this.pool[this.n++];
    p.g = 0;
    p.drag = 0;
    p.rot = 0;
    p.vr = 0;
    p.delay = 0;
    p.life = 0;
    return p;
  }

  private wake(): void {
    if (!this.disposed) animate(this);
  }

  /** `n` sparkles spiralling from radius `r0` into (cx, cy) over `dur` seconds (staggered). */
  spiral(cx: number, cy: number, n: number, r0: number, colors: readonly string[], dur = 1.1): void {
    for (let i = 0; i < n; i++) {
      const p = this.add();
      if (!p) break;
      p.k = K_SPIRAL;
      p.cx = cx;
      p.cy = cy;
      p.ang = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      p.r0 = r0 * (0.75 + Math.random() * 0.5);
      p.rad = p.r0;
      p.delay = Math.random() * dur * 0.45;
      p.max = dur * (0.55 + Math.random() * 0.3);
      p.size = 2 + Math.random() * 3;
      p.color = colors[i % colors.length];
      p.x = cx;
      p.y = cy;
    }
    this.wake();
  }

  /** Radial burst of sparks / pixels from (x, y). */
  burst(x: number, y: number, n: number, speed: number, colors: readonly string[], life = 0.8, dots = false): void {
    for (let i = 0; i < n; i++) {
      const p = this.add();
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.75);
      p.k = dots ? K_DOT : K_SPARK;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.drag = 2.6;
      p.g = 60;
      p.max = life * (0.6 + Math.random() * 0.6);
      p.size = dots ? 2 + Math.random() * 3 : 3 + Math.random() * 4;
      p.color = colors[i % colors.length];
    }
    this.wake();
  }

  /** A few trail sparks at a moving point (meteor head), drifting against `dir`. */
  trail(x: number, y: number, dx: number, dy: number, colors: readonly string[], n = 2): void {
    for (let i = 0; i < n; i++) {
      const p = this.add();
      if (!p) break;
      p.k = Math.random() < 0.5 ? K_DOT : K_SPARK;
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = -dx * 0.12 + (Math.random() - 0.5) * 40;
      p.vy = -dy * 0.12 + (Math.random() - 0.5) * 40;
      p.drag = 3;
      p.max = 0.35 + Math.random() * 0.35;
      p.size = 2 + Math.random() * 3;
      p.color = colors[(Math.random() * colors.length) | 0];
    }
    this.wake();
  }

  /** Rainbow confetti exploding from (x, y) (the MYTHIC beat: 200 pieces). */
  confetti(x: number, y: number, n: number, colors: readonly string[]): void {
    for (let i = 0; i < n; i++) {
      const p = this.add();
      if (!p) break;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.9;
      const s = 260 + Math.random() * 520;
      p.k = K_CONFETTI;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.g = 520;
      p.drag = 1.4;
      p.rot = Math.random() * 6.28;
      p.vr = (Math.random() - 0.5) * 18;
      p.max = 2.4 + Math.random() * 1.6;
      p.size = 5 + Math.random() * 5;
      p.color = colors[i % colors.length];
    }
    this.wake();
  }

  clear(): void {
    this.n = 0;
    this.g?.clearRect(0, 0, this.el.width, this.el.height);
  }

  get alive(): number {
    return this.n;
  }

  tick(dt: number): boolean {
    const g = this.g;
    if (this.disposed || !g) return false;
    const d = Math.min(dt, 0.05);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = "lighter";
    let i = 0;
    while (i < this.n) {
      const p = this.pool[i];
      if (p.delay > 0) {
        p.delay -= d;
        i++;
        continue;
      }
      p.life += d;
      if (p.life >= p.max) {
        // swap-remove (keeps the pool dense)
        const last = this.pool[this.n - 1];
        this.pool[this.n - 1] = p;
        this.pool[i] = last;
        this.n--;
        continue;
      }
      const k = p.life / p.max;
      if (p.k === K_SPIRAL) {
        p.rad = p.r0 * (1 - k * k);
        p.ang += d * (2.5 + 6 * k);
        p.x = p.cx + Math.cos(p.ang) * p.rad;
        p.y = p.cy + Math.sin(p.ang) * p.rad * 0.55;
      } else {
        const f = Math.max(0, 1 - p.drag * d);
        p.vx *= f;
        p.vy = p.vy * f + p.g * d;
        p.x += p.vx * d;
        p.y += p.vy * d;
        p.rot += p.vr * d;
      }
      const a = p.k === K_CONFETTI ? Math.min(1, (1 - k) * 3) : k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      g.globalAlpha = a;
      g.fillStyle = p.color;
      const s = p.size;
      if (p.k === K_CONFETTI) {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.scale(1, Math.cos(p.rot * 1.7));
        g.fillRect(-s * 0.5, -s * 0.3, s, s * 0.6);
        g.restore();
      } else if (p.k === K_DOT) {
        g.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
      } else {
        // 4-point twinkle: two thin crossed bars + a core
        const t = s * (1.4 - k * 0.6);
        g.fillRect(p.x - t, p.y - 0.75, t * 2, 1.5);
        g.fillRect(p.x - 0.75, p.y - t, 1.5, t * 2);
        g.fillRect(p.x - s * 0.3, p.y - s * 0.3, s * 0.6, s * 0.6);
      }
      i++;
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    return this.n > 0;
  }

  dispose(): void {
    this.disposed = true;
    this.n = 0;
    stopAnimating(this);
    removeEventListener("resize", this.resize);
  }
}
