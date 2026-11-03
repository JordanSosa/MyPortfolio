/**
 * Pan / zoom viewport (the Training Arc board, any big map). One transformed
 * content layer (translate + scale, transform-origin 0 0) inside a clipping
 * host; every gesture only changes three numbers and the transform is written
 * at most once per frame (from `update`, which the owning page calls each
 * frame), so the content is never relaid out while panning.
 *
 * Input:
 *  - touch: one-finger drag (with inertia), two-finger pinch (zoom around the
 *    fingers' midpoint, pan with it);
 *  - mouse: drag, wheel = zoom around the cursor (horizontal wheel pans);
 *  - keyboard: + / - zoom, 0 = reset (arrows move the menu focus: the page
 *    calls `ensureVisible` on navfocus so the focused node is always on screen);
 *  - gamepad: right stick pans, LB / RB zoom.
 * A drag never clicks: a click right after a drag is swallowed.
 */
import { reducedMotion } from "./ticker";

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ViewportOpts {
  /** Content coordinates covered by the content element (its size = bounds size at zoom 1). */
  bounds: Bounds;
  minZoom?: number;
  maxZoom?: number;
  /** Start zoom / centre (content coordinates). */
  zoom?: number;
  cx?: number;
  cy?: number;
  /** Keyboard / gamepad act only while this returns true (page on top, no overlay). */
  active?: () => boolean;
  /** Zoom LOD thresholds: the content gets `.z-far` below `far`, `.z-near` above `near`. */
  far?: number;
  near?: number;
}

const SLOP = 7;
const FRICTION = 5.5;

interface Ptr {
  id: number;
  x: number;
  y: number;
}

export class PanZoom {
  z: number;
  cx: number;
  cy: number;
  readonly minZ: number;
  readonly maxZ: number;
  private w = 1;
  private h = 1;
  private dirty = true;
  private vx = 0;
  private vy = 0;
  private ptrs: Ptr[] = [];
  private dragging = false;
  private dragged = false;
  private sx = 0;
  private sy = 0;
  private lastT = 0;
  private pinch: { d0: number; z0: number; wx: number; wy: number } | null = null;
  private tween: { t: number; dur: number; fz: number; fx: number; fy: number; tz: number; tx: number; ty: number } | null = null;
  private lod = "";
  private gpPrev = 0;
  private readonly ro: ResizeObserver | null = null;
  private readonly offs: (() => void)[] = [];

  constructor(
    readonly host: HTMLElement,
    readonly content: HTMLElement,
    private readonly o: ViewportOpts,
  ) {
    const b = o.bounds;
    this.minZ = o.minZoom ?? 0.25;
    this.maxZ = o.maxZoom ?? 2.5;
    this.z = o.zoom ?? 1;
    this.cx = o.cx ?? (b.x0 + b.x1) / 2;
    this.cy = o.cy ?? (b.y0 + b.y1) / 2;
    host.classList.add("kvp");
    content.classList.add("kvp-c");
    content.style.width = `${b.x1 - b.x0}px`;
    content.style.height = `${b.y1 - b.y0}px`;
    this.measure();
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => {
        this.measure();
        this.dirty = true;
      });
      this.ro.observe(host);
    }
    const on = <K extends keyof HTMLElementEventMap>(t: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      host.addEventListener(t, fn as EventListener, opts);
      this.offs.push(() => host.removeEventListener(t, fn as EventListener, opts));
    };
    on("pointerdown", (e) => this.down(e));
    on("pointermove", (e) => this.move(e));
    on("pointerup", (e) => this.up(e));
    on("pointercancel", (e) => this.up(e));
    on("lostpointercapture", (e) => this.up(e));
    on("wheel", (e) => this.wheel(e), { passive: false });
    // a click that ends a drag must not press the node under the finger
    on(
      "click",
      (e) => {
        if (!this.dragged) return;
        this.dragged = false;
        e.stopPropagation();
        e.preventDefault();
      },
      { capture: true },
    );
    const key = (e: KeyboardEvent) => this.key(e);
    window.addEventListener("keydown", key);
    this.offs.push(() => window.removeEventListener("keydown", key));
    this.apply();
  }

  /** Re-read the host size (after it was attached / laid out). */
  measure(): void {
    this.w = Math.max(1, this.host.clientWidth);
    this.h = Math.max(1, this.host.clientHeight);
    this.dirty = true;
  }

  get viewW(): number {
    return this.w;
  }
  get viewH(): number {
    return this.h;
  }

  // ---------------------------------------------------------------- pointer
  private local(e: MouseEvent): [number, number] {
    const r = this.host.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private down(e: PointerEvent): void {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const [x, y] = this.local(e);
    this.ptrs.push({ id: e.pointerId, x, y });
    this.tween = null;
    this.vx = this.vy = 0;
    this.dragged = false;
    if (this.ptrs.length === 1) {
      this.sx = x;
      this.sy = y;
      this.dragging = false;
      this.lastT = performance.now();
    } else if (this.ptrs.length === 2) this.startPinch();
  }

  private startPinch(): void {
    const [a, b] = this.ptrs;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const [wx, wy] = this.toWorld(mx, my);
    this.pinch = { d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: this.z, wx, wy };
    this.dragging = true;
    this.capture(a.id);
    this.capture(b.id);
  }

  private capture(id: number): void {
    try {
      this.host.setPointerCapture(id);
    } catch {
      /* pointer already gone */
    }
  }

  private move(e: PointerEvent): void {
    const p = this.ptrs.find((q) => q.id === e.pointerId);
    if (!p) return;
    const [x, y] = this.local(e);
    const dx = x - p.x;
    const dy = y - p.y;
    p.x = x;
    p.y = y;
    if (this.pinch && this.ptrs.length >= 2) {
      const [a, b] = this.ptrs;
      const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      this.z = this.clampZ(this.pinch.z0 * (d / this.pinch.d0));
      // keep the world point that started under the midpoint under the (moving) midpoint
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      this.cx = this.pinch.wx - (mx - this.w / 2) / this.z;
      this.cy = this.pinch.wy - (my - this.h / 2) / this.z;
      this.dragged = true;
      this.clampC();
      this.dirty = true;
      return;
    }
    if (!this.dragging) {
      if (Math.hypot(x - this.sx, y - this.sy) < SLOP) return;
      this.dragging = true;
      this.dragged = true;
      this.capture(e.pointerId);
    }
    const now = performance.now();
    const dt = Math.max(1, now - this.lastT) / 1000;
    this.lastT = now;
    this.cx -= dx / this.z;
    this.cy -= dy / this.z;
    // smoothed release velocity (content units / s)
    this.vx = this.vx * 0.6 + (-dx / this.z / dt) * 0.4;
    this.vy = this.vy * 0.6 + (-dy / this.z / dt) * 0.4;
    this.clampC();
    this.dirty = true;
  }

  private up(e: PointerEvent): void {
    const i = this.ptrs.findIndex((q) => q.id === e.pointerId);
    if (i < 0) return;
    this.ptrs.splice(i, 1);
    if (this.pinch) {
      this.pinch = null;
      // the remaining finger continues as a drag from where it is
      if (this.ptrs.length === 1) {
        this.sx = this.ptrs[0].x;
        this.sy = this.ptrs[0].y;
      }
      this.vx = this.vy = 0;
      return;
    }
    if (this.ptrs.length === 0) {
      // a pause before lifting the finger means no fling
      if (performance.now() - this.lastT > 90 || reducedMotion()) this.vx = this.vy = 0;
      this.dragging = false;
    }
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    this.tween = null;
    const [x, y] = this.local(e);
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dX = e.deltaX * scale;
    const dY = e.deltaY * scale;
    if (!e.ctrlKey && Math.abs(dX) > Math.abs(dY)) {
      this.cx += dX / this.z;
      this.clampC();
      this.dirty = true;
      return;
    }
    const k = Math.exp(-dY * (e.ctrlKey ? 0.01 : 0.0018));
    this.zoomAt(this.z * k, x, y);
  }

  private key(e: KeyboardEvent): void {
    if (this.o.active && !this.o.active()) return;
    if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") this.zoomBy(1.25);
    else if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") this.zoomBy(0.8);
    else return;
    e.preventDefault();
  }

  // ---------------------------------------------------------------- API
  /** Content point (x, y) at screen position (sx, sy) inside the host. */
  toWorld(sx: number, sy: number): [number, number] {
    return [this.cx + (sx - this.w / 2) / this.z, this.cy + (sy - this.h / 2) / this.z];
  }

  /** Zoom to `z` keeping the content point under host position (sx, sy) fixed. */
  zoomAt(z: number, sx: number, sy: number): void {
    const [wx, wy] = this.toWorld(sx, sy);
    this.z = this.clampZ(z);
    this.cx = wx - (sx - this.w / 2) / this.z;
    this.cy = wy - (sy - this.h / 2) / this.z;
    this.clampC();
    this.dirty = true;
  }

  /** Zoom by a factor around the view centre (buttons, keys, gamepad). Animated. */
  zoomBy(k: number): void {
    this.go(this.cx, this.cy, this.z * k);
  }

  /** Animate to a centre / zoom (instant with reduced motion). */
  go(cx: number, cy: number, z = this.z, dur = 0.38): void {
    const tz = this.clampZ(z);
    const b = this.o.bounds;
    const tx = Math.max(b.x0, Math.min(b.x1, cx));
    const ty = Math.max(b.y0, Math.min(b.y1, cy));
    this.vx = this.vy = 0;
    if (reducedMotion() || dur <= 0) {
      this.tween = null;
      this.z = tz;
      this.cx = tx;
      this.cy = ty;
      this.dirty = true;
      return;
    }
    this.tween = { t: 0, dur, fz: this.z, fx: this.cx, fy: this.cy, tz, tx, ty };
  }

  /** Pan (animated) so the content point is inside the view with `margin` px to spare. */
  ensureVisible(x: number, y: number, margin = 64): void {
    const sx = (x - this.cx) * this.z + this.w / 2;
    const sy = (y - this.cy) * this.z + this.h / 2;
    const m = Math.min(margin, this.w / 3, this.h / 3);
    if (sx >= m && sx <= this.w - m && sy >= m && sy <= this.h - m) return;
    let ncx = this.cx;
    let ncy = this.cy;
    if (sx < m) ncx = x - (m - this.w / 2) / this.z;
    else if (sx > this.w - m) ncx = x - (this.w - m - this.w / 2) / this.z;
    if (sy < m) ncy = y - (m - this.h / 2) / this.z;
    else if (sy > this.h - m) ncy = y - (this.h - m - this.h / 2) / this.z;
    this.go(ncx, ncy, this.z, 0.28);
  }

  /** Zoom that fits a content rectangle in the view with `pad` px around it. */
  fitZoom(r: Bounds, pad = 24): number {
    const zw = (this.w - pad * 2) / Math.max(1, r.x1 - r.x0);
    const zh = (this.h - pad * 2) / Math.max(1, r.y1 - r.y0);
    return this.clampZ(Math.min(zw, zh));
  }

  private clampZ(z: number): number {
    return Math.max(this.minZ, Math.min(this.maxZ, z));
  }

  private clampC(): void {
    const b = this.o.bounds;
    if (this.cx < b.x0) this.cx = b.x0;
    else if (this.cx > b.x1) this.cx = b.x1;
    if (this.cy < b.y0) this.cy = b.y0;
    else if (this.cy > b.y1) this.cy = b.y1;
  }

  /** Per frame (the owning page's update): inertia, tweens, gamepad, then one transform write. */
  update(dt: number): void {
    if (this.tween) {
      const t = this.tween;
      t.t += dt;
      const k = Math.min(1, t.t / t.dur);
      const e = 1 - Math.pow(1 - k, 3);
      // zoom eases in log space (constant-feeling zoom speed)
      this.z = Math.exp(Math.log(t.fz) + (Math.log(t.tz) - Math.log(t.fz)) * e);
      this.cx = t.fx + (t.tx - t.fx) * e;
      this.cy = t.fy + (t.ty - t.fy) * e;
      this.dirty = true;
      if (k >= 1) this.tween = null;
    } else if (!this.dragging && (this.vx !== 0 || this.vy !== 0)) {
      this.cx += this.vx * dt;
      this.cy += this.vy * dt;
      const f = Math.exp(-FRICTION * dt);
      this.vx *= f;
      this.vy *= f;
      if (Math.abs(this.vx) + Math.abs(this.vy) < 4) this.vx = this.vy = 0;
      this.clampC();
      this.dirty = true;
    }
    if (!this.o.active || this.o.active()) this.pollPad(dt);
    if (this.dirty) this.apply();
  }

  private pollPad(dt: number): void {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    let pad: Gamepad | null = null;
    try {
      for (const p of navigator.getGamepads()) if (p && p.connected) pad = p;
    } catch {
      return;
    }
    if (!pad) return;
    const ax = pad.axes[2] ?? 0;
    const ay = pad.axes[3] ?? 0;
    const dz = 0.2;
    if (Math.abs(ax) > dz || Math.abs(ay) > dz) {
      const sp = 620 / this.z;
      this.tween = null;
      this.cx += (Math.abs(ax) > dz ? ax : 0) * sp * dt;
      this.cy += (Math.abs(ay) > dz ? ay : 0) * sp * dt;
      this.clampC();
      this.dirty = true;
    }
    const lb = pad.buttons[4]?.pressed ? 1 : 0;
    const rb = pad.buttons[5]?.pressed ? 2 : 0;
    const now = lb | rb;
    if (now & ~this.gpPrev & 1) this.zoomBy(0.75);
    if (now & ~this.gpPrev & 2) this.zoomBy(1.33);
    this.gpPrev = now;
  }

  private apply(): void {
    this.dirty = false;
    const b = this.o.bounds;
    const tx = this.w / 2 - (this.cx - b.x0) * this.z;
    const ty = this.h / 2 - (this.cy - b.y0) * this.z;
    this.content.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${this.z.toFixed(4)})`;
    const lod = this.z < (this.o.far ?? 0) ? "z-far" : this.z > (this.o.near ?? Infinity) ? "z-near" : "";
    if (lod !== this.lod) {
      if (this.lod) this.content.classList.remove(this.lod);
      if (lod) this.content.classList.add(lod);
      this.lod = lod;
    }
  }

  dispose(): void {
    for (const f of this.offs) f();
    this.offs.length = 0;
    this.ro?.disconnect();
  }
}
