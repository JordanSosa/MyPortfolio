/**
 * Unified input: keyboard + Gamepad API + touch (floating joystick and DASH /
 * OVERDRIVE buttons). Call `input.update()` once at the start of every frame.
 *
 *   input.move.x / .y           analog move vector, length <= 1
 *   input.pressed("dash")       edge-triggered this frame (dash | ult | pause | confirm | back | up | down | left | right)
 *   input.held("dash")          currently held
 *   input.lastDevice            "keyboard" | "gamepad" | "touch" | "mouse"
 *
 * Touch controls (DOM overlay, multi-touch):
 *   input.showTouchControls(true)          show joystick zone + buttons (only on touch-capable devices unless forced)
 *   input.setUltCharge(0.6, false)         OVERDRIVE ring fill 0..1 + rainbow "ready" state
 *   input.setDashCharge(0.3)               DASH cooldown ring (1 = ready)
 *   input.deny("ult")                      little shake on the button
 *   input.markTouchesStale()               fingers currently down become "stale"...
 *   input.isFresh(e)                       ...so UI can ignore them (level-up cards!)
 */
import { TouchControls } from "./touch";

export type Action = "dash" | "ult" | "pause" | "confirm" | "back" | "up" | "down" | "left" | "right";
export type Device = "keyboard" | "gamepad" | "touch" | "mouse";

/** Haptic pulses: at least HAPTIC_MIN ms (shorter can't be felt), at most one per HAPTIC_GAP ms. */
const HAPTIC_MIN = 20;
const HAPTIC_GAP = 50;
const ACTIONS: readonly Action[] = ["dash", "ult", "pause", "confirm", "back", "up", "down", "left", "right"];
const A: Record<Action, number> = { dash: 0, ult: 1, pause: 2, confirm: 3, back: 4, up: 5, down: 6, left: 7, right: 8 };
const NA = ACTIONS.length;

const KEYMAP: Record<string, Action[]> = {
  Space: ["dash", "confirm"],
  ShiftLeft: ["dash"],
  ShiftRight: ["dash"],
  KeyE: ["ult"],
  Enter: ["ult", "confirm"],
  NumpadEnter: ["ult", "confirm"],
  Escape: ["pause", "back"],
  KeyP: ["pause"],
  Backspace: ["back"],
  ArrowUp: ["up"],
  KeyW: ["up"],
  ArrowDown: ["down"],
  KeyS: ["down"],
  ArrowLeft: ["left"],
  KeyA: ["left"],
  ArrowRight: ["right"],
  KeyD: ["right"],
};
const PREVENT = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace"]);

// Standard gamepad mapping
const GP_A = 0,
  GP_B = 1,
  GP_X = 2,
  GP_Y = 3,
  GP_LB = 4,
  GP_RB = 5,
  GP_RT = 7,
  GP_BACK = 8,
  GP_START = 9,
  GP_UP = 12,
  GP_DOWN = 13,
  GP_LEFT = 14,
  GP_RIGHT = 15;

export interface InputOptions {
  /** Element that hosts the touch overlay (default document.body). */
  parent?: HTMLElement;
  /** Joystick knob max radius in CSS px (default 48). */
  stickRadius?: number;
  /** Radial deadzone 0..1 (default 0.15). */
  deadzone?: number;
  /** Let the joystick origin follow the finger when dragged past the radius (default true). */
  stickFollow?: boolean;
  /** Also drive the joystick with a mouse drag (testing on desktop; default from ?touch=1). */
  mouseJoystick?: boolean;
  /** Show touch controls even on non-touch devices (default from ?touch=1). */
  forceTouchUI?: boolean;
}

export class Input {
  /** Analog move vector, |move| <= 1. */
  readonly move = { x: 0, y: 0 };
  /** Last non-zero move direction (unit vector, defaults to right). */
  readonly facing = { x: 1, y: 0 };
  lastDevice: Device = "keyboard";
  /** Vibrate on haptic() calls (user setting). */
  haptics = true;
  readonly touch: TouchControls;
  readonly touchCapable: boolean;

  private stickRadius: number;
  private deadzone: number;
  private stickFollow: boolean;
  private mouseJoystick: boolean;
  private forceTouchUI: boolean;

  // action state
  private pend = new Uint8Array(NA);
  private press = new Uint8Array(NA);
  private holdKb = new Uint8Array(NA);
  private holdGp = new Uint8Array(NA);
  private holdTouch = new Uint8Array(NA);
  private keys = new Set<string>();

  // gamepad
  private gpConnected = false;
  private gpPrev = new Uint8Array(17);
  private gpStickNav = { x: 0, y: 0 };
  private gpNavTimer = 0;
  private gpMove = { x: 0, y: 0 };

  // touch joystick
  private stickId = -1;
  private stickOx = 0;
  private stickOy = 0;
  private stickVec = { x: 0, y: 0 };
  private btnPointers = new Map<number, "dash" | "ult">();
  private wantTouchUI = false;
  private joystickOn = true;

  // fresh-touch tracking
  private seq = 0;
  private staleSeq = 0;
  private downSeq = new Map<number, number>();
  private lastDownSeq = 0;
  private activePointers = new Set<number>();

  private lastNow = 0;
  private disposers: (() => void)[] = [];

  constructor(opts: InputOptions = {}) {
    const qs = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
    const forced = qs.get("touch") === "1";
    this.stickRadius = opts.stickRadius ?? 48;
    this.deadzone = opts.deadzone ?? 0.15;
    this.stickFollow = opts.stickFollow ?? true;
    this.mouseJoystick = opts.mouseJoystick ?? forced;
    this.forceTouchUI = opts.forceTouchUI ?? forced;
    this.touchCapable =
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
      (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches);
    // Phones/tablets (primary pointer is coarse, or touch without any fine pointer) start in
    // touch mode; touchscreen laptops start in keyboard mode and switch on their first touch.
    const mq = (q: string) => typeof matchMedia !== "undefined" && matchMedia(q).matches;
    const touchFirst = mq("(pointer: coarse)") || (this.touchCapable && !mq("(any-pointer: fine)"));
    if (touchFirst && !qs.has("kb")) this.lastDevice = "touch";
    this.touch = new TouchControls(opts.parent ?? document.body);
    this.bind();
  }

  // ------------------------------------------------------------ public API
  pressed(a: Action): boolean {
    return this.press[A[a]] === 1;
  }
  held(a: Action): boolean {
    const i = A[a];
    return this.holdKb[i] === 1 || this.holdGp[i] === 1 || this.holdTouch[i] === 1;
  }
  /** Clear an edge for the rest of this frame (so two systems don't both react). */
  consume(a: Action): void {
    this.press[A[a]] = 0;
  }
  /** Inject a press (bots, UI buttons). Shows up as pressed() next update(). */
  trigger(a: Action): void {
    this.pend[A[a]] = 1;
  }
  /** Whether any directional input is active. */
  get moving(): boolean {
    return this.move.x !== 0 || this.move.y !== 0;
  }
  /** True while a finger is on the joystick. */
  get stickActive(): boolean {
    return this.stickId >= 0;
  }
  /** Number of pointers currently down (any type). */
  get pointersDown(): number {
    return this.activePointers.size;
  }

  /** Request touch controls (they only appear on touch devices unless forced). */
  showTouchControls(on: boolean): void {
    this.wantTouchUI = on;
    this.refreshTouchUI();
    if (!on) this.releaseTouch();
  }
  /** Touch controls are requested by the game (they may still be hidden for keyboard/gamepad players). */
  get touchControlsWanted(): boolean {
    return this.wantTouchUI;
  }
  get touchControlsVisible(): boolean {
    return this.touch.visible;
  }
  /** Enable/disable the floating joystick without hiding the buttons. */
  setJoystickEnabled(on: boolean): void {
    this.joystickOn = on;
    if (!on) this.releaseStick();
  }
  /** OVERDRIVE ring fill 0..1 + ready (rainbow pulse) state. */
  setUltCharge(fill: number, ready: boolean): void {
    this.touch.setUlt(fill, ready);
  }
  /** DASH ring: 0..1 where 1 = ready. */
  setDashCharge(fill: number): void {
    this.touch.setDash(fill);
  }
  /** Shake a touch button (e.g. ult pressed while not ready). */
  deny(btn: "dash" | "ult"): void {
    this.touch.deny(btn);
  }
  /** Every pointer currently down becomes stale; isFresh() is false for it until it lifts. */
  markTouchesStale(): void {
    this.staleSeq = this.seq;
  }
  /**
   * Whether a pointer/click event comes from a finger that went down AFTER the
   * last markTouchesStale(). Accepts a PointerEvent/MouseEvent or a pointerId.
   */
  isFresh(e: Event | number): boolean {
    let id: number | undefined;
    if (typeof e === "number") id = e;
    else if ("pointerId" in e && typeof (e as PointerEvent).pointerId === "number") id = (e as PointerEvent).pointerId;
    if (id !== undefined && this.downSeq.has(id)) return (this.downSeq.get(id) as number) > this.staleSeq;
    // unknown pointer (e.g. Safari click MouseEvent): fresh if any pointer went down since stale
    return this.lastDownSeq > this.staleSeq;
  }
  /**
   * Short vibration (ms) if supported and enabled. Single pulses are at least
   * HAPTIC_MIN ms (shorter ones can't be felt on most phones) and at most one per
   * HAPTIC_GAP ms (a burst of hits would otherwise buzz continuously); patterns
   * pass through unchanged.
   */
  haptic(ms: number | number[]): void {
    if (!this.haptics) return;
    // Chrome logs an intervention error if vibrate() runs before any user gesture
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return;
    let pulse: number | number[] = ms;
    if (typeof ms === "number") {
      const now = performance.now();
      if (now - this.hapticAt < HAPTIC_GAP) return;
      this.hapticAt = now;
      pulse = Math.max(HAPTIC_MIN, ms);
    }
    try {
      navigator.vibrate?.(pulse);
    } catch {
      /* ignore */
    }
  }
  private hapticAt = -1e9;

  /** Poll devices and latch edges. Call once per frame before reading. */
  update(): void {
    const now = performance.now();
    const dt = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 1 / 60;
    this.lastNow = now;

    this.pollGamepad(dt);

    for (let i = 0; i < NA; i++) {
      this.press[i] = this.pend[i];
      this.pend[i] = 0;
    }

    // keyboard vector
    let kx = 0,
      ky = 0;
    if (this.holdKb[A.left]) kx -= 1;
    if (this.holdKb[A.right]) kx += 1;
    if (this.holdKb[A.up]) ky -= 1;
    if (this.holdKb[A.down]) ky += 1;
    if (kx && ky) {
      kx *= Math.SQRT1_2;
      ky *= Math.SQRT1_2;
    }
    // pick the strongest source
    let mx = kx,
      my = ky,
      best = kx * kx + ky * ky;
    const g = this.gpMove.x * this.gpMove.x + this.gpMove.y * this.gpMove.y;
    if (g > best) {
      mx = this.gpMove.x;
      my = this.gpMove.y;
      best = g;
    }
    const t = this.stickVec.x * this.stickVec.x + this.stickVec.y * this.stickVec.y;
    if (t > best) {
      mx = this.stickVec.x;
      my = this.stickVec.y;
      best = t;
    }
    if (best > 1) {
      const k = 1 / Math.sqrt(best);
      mx *= k;
      my *= k;
    }
    this.move.x = mx;
    this.move.y = my;
    if (best > 1e-4) {
      const l = Math.sqrt(mx * mx + my * my);
      this.facing.x = mx / l;
      this.facing.y = my / l;
    }
  }

  destroy(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
    this.touch.destroy();
  }

  // ------------------------------------------------------------ internals
  private down(i: number, src: Uint8Array): void {
    if (!src[i]) this.pend[i] = 1;
    src[i] = 1;
  }
  private up(i: number, src: Uint8Array): void {
    src[i] = 0;
  }

  /** Touch controls show while requested AND the player is using touch (or ?touch=1). */
  private refreshTouchUI(): void {
    const on = this.wantTouchUI && (this.forceTouchUI || this.lastDevice === "touch");
    if (on !== this.touch.visible) {
      this.touch.visible = on;
      if (!on) this.releaseTouch();
    }
  }

  private releaseStick(): void {
    if (this.stickId >= 0) {
      this.stickId = -1;
      this.stickVec.x = this.stickVec.y = 0;
      this.touch.hideStick();
    }
  }

  private releaseTouch(): void {
    this.releaseStick();
    for (const [, b] of this.btnPointers) {
      this.holdTouch[A[b]] = 0;
      this.touch.setPressed(b, false);
    }
    this.btnPointers.clear();
  }

  private listen<K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions): void {
    window.addEventListener(type, fn as EventListener, opts);
    this.disposers.push(() => window.removeEventListener(type, fn as EventListener, opts));
  }

  private bind(): void {
    // ---- keyboard
    this.listen("keydown", (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const acts = KEYMAP[e.code];
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!acts) return;
      this.setDevice("keyboard");
      if (e.repeat) {
        // repeat only re-triggers navigation edges
        for (const a of acts) if (a === "up" || a === "down" || a === "left" || a === "right") this.pend[A[a]] = 1;
        return;
      }
      this.keys.add(e.code);
      for (const a of acts) this.down(A[a], this.holdKb);
    });
    this.listen("keyup", (e) => {
      const acts = KEYMAP[e.code];
      this.keys.delete(e.code);
      if (!acts) return;
      for (const a of acts) {
        // still held by another key mapped to the same action?
        let other = false;
        for (const k of this.keys) if (KEYMAP[k]?.includes(a)) other = true;
        if (!other) this.up(A[a], this.holdKb);
      }
    });
    this.listen("blur", () => {
      this.keys.clear();
      this.holdKb.fill(0);
      this.holdGp.fill(0);
      this.releaseTouch();
    });

    // ---- gamepad presence
    this.listen("gamepadconnected", () => {
      this.gpConnected = true;
    });
    this.listen("gamepaddisconnected", () => {
      this.gpConnected = Array.from(navigator.getGamepads?.() ?? []).some((p) => !!p);
      // a pad yanked mid-hold must not leave DASH / OVERDRIVE (or a direction) latched
      this.releaseGamepad();
    });

    // ---- pointers (capture phase bookkeeping for fresh-touch tracking)
    this.listen(
      "pointerdown",
      (e) => {
        this.seq++;
        this.lastDownSeq = this.seq;
        this.downSeq.set(e.pointerId, this.seq);
        this.activePointers.add(e.pointerId);
        if (e.pointerType === "touch" || e.pointerType === "pen") this.setDevice("touch");
      },
      { capture: true },
    );
    const lift = (e: PointerEvent) => {
      this.activePointers.delete(e.pointerId);
      // keep downSeq a moment so click handlers that fire after pointerup can still check freshness
      const id = e.pointerId;
      setTimeout(() => {
        if (!this.activePointers.has(id)) this.downSeq.delete(id);
      }, 600);
    };
    this.listen("pointerup", lift, { capture: true });
    this.listen("pointercancel", lift, { capture: true });

    // ---- buttons
    const bindBtn = (el: HTMLButtonElement, which: "dash" | "ult") => {
      const onDown = (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.setDevice(e.pointerType === "mouse" ? "mouse" : "touch");
        this.btnPointers.set(e.pointerId, which);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        this.down(A[which], this.holdTouch);
        this.touch.setPressed(which, true);
      };
      el.addEventListener("pointerdown", onDown);
      this.disposers.push(() => el.removeEventListener("pointerdown", onDown));
    };
    bindBtn(this.touch.dashBtn, "dash");
    bindBtn(this.touch.ultBtn, "ult");

    // ---- joystick + button release
    this.listen("pointerdown", (e) => this.onPointerDown(e));
    this.listen("pointermove", (e) => this.onPointerMove(e), { passive: true });
    const end = (e: PointerEvent) => this.onPointerUp(e);
    this.listen("pointerup", end);
    this.listen("pointercancel", end);
    // never show the long-press menu over the game
    this.listen("contextmenu", (e) => {
      if (this.touch.visible) e.preventDefault();
    });
  }

  private setDevice(d: Device): void {
    if (this.lastDevice === d) return;
    this.lastDevice = d;
    this.refreshTouchUI();
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.btnPointers.has(e.pointerId)) return;
    const isTouch = e.pointerType === "touch" || e.pointerType === "pen";
    if (!isTouch && !(this.mouseJoystick && e.pointerType === "mouse")) return;
    if (!this.touch.visible || !this.joystickOn || this.stickId >= 0) return;
    const t = e.target as Element | null;
    if (t && t.closest?.("button,a,input,select,textarea,label,[data-ui],[data-no-joystick]")) return;
    this.stickId = e.pointerId;
    this.stickOx = e.clientX;
    this.stickOy = e.clientY;
    this.stickVec.x = this.stickVec.y = 0;
    this.touch.showStick(e.clientX, e.clientY);
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerId !== this.stickId) return;
    let dx = e.clientX - this.stickOx;
    let dy = e.clientY - this.stickOy;
    const R = this.stickRadius;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (d > R) {
      if (this.stickFollow) {
        // drag the origin along so direction changes stay responsive
        const k = (d - R) / d;
        this.stickOx += dx * k;
        this.stickOy += dy * k;
        dx = e.clientX - this.stickOx;
        dy = e.clientY - this.stickOy;
        d = R;
      } else {
        dx *= R / d;
        dy *= R / d;
        d = R;
      }
    }
    this.touch.moveStick(this.stickOx, this.stickOy, dx, dy);
    const m = d / R;
    if (m < this.deadzone) {
      this.stickVec.x = this.stickVec.y = 0;
    } else {
      const k = (m - this.deadzone) / (1 - this.deadzone) / Math.max(1e-6, d);
      this.stickVec.x = dx * k;
      this.stickVec.y = dy * k;
    }
  }

  private onPointerUp(e: PointerEvent): void {
    const b = this.btnPointers.get(e.pointerId);
    if (b) {
      this.btnPointers.delete(e.pointerId);
      let still = false;
      for (const [, o] of this.btnPointers) if (o === b) still = true;
      if (!still) {
        this.holdTouch[A[b]] = 0;
        this.touch.setPressed(b, false);
      }
      return;
    }
    if (e.pointerId === this.stickId) this.releaseStick();
  }

  /** Forget every gamepad hold (disconnect / no pad left): no latched buttons, no stale edges. */
  private releaseGamepad(): void {
    this.gpMove.x = this.gpMove.y = 0;
    this.gpStickNav.x = this.gpStickNav.y = 0;
    for (let i = 0; i < NA; i++) {
      // drop a pending edge that only the pad produced (not also held on keyboard / touch)
      if (this.holdGp[i] && !this.holdKb[i] && !this.holdTouch[i]) this.pend[i] = 0;
    }
    this.holdGp.fill(0);
    this.gpPrev.fill(0);
  }

  private pollGamepad(dt: number): void {
    if (!this.gpConnected || typeof navigator === "undefined" || !navigator.getGamepads) {
      this.releaseGamepad();
      return;
    }
    const pads = navigator.getGamepads();
    let pad: Gamepad | null = null;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (p && p.connected) {
        pad = p;
        break;
      }
    }
    if (!pad) {
      this.releaseGamepad();
      return;
    }
    const btn = (i: number) => {
      const b = pad!.buttons[i];
      return b ? b.pressed || b.value > 0.5 : false;
    };
    // left stick with radial deadzone
    let ax = pad.axes[0] ?? 0;
    let ay = pad.axes[1] ?? 0;
    const m = Math.sqrt(ax * ax + ay * ay);
    const dz = this.deadzone;
    if (m < dz) ax = ay = 0;
    else {
      const k = Math.min(1, (m - dz) / (1 - dz)) / m;
      ax *= k;
      ay *= k;
    }
    // dpad adds digital movement
    let dx = (btn(GP_RIGHT) ? 1 : 0) - (btn(GP_LEFT) ? 1 : 0);
    let dy = (btn(GP_DOWN) ? 1 : 0) - (btn(GP_UP) ? 1 : 0);
    if (dx && dy) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    if (dx || dy) {
      ax = dx;
      ay = dy;
    }
    this.gpMove.x = ax;
    this.gpMove.y = ay;

    const map: [number, Action][] = GP_MAP;
    let any = ax !== 0 || ay !== 0;
    const seen = this.holdGpScratch;
    seen.fill(0);
    for (const [bi, a] of map) {
      const p = btn(bi);
      if (p) {
        seen[A[a]] = 1;
        any = true;
      }
      this.gpPrev[bi] = p ? 1 : 0;
    }
    for (let i = 0; i < NA; i++) {
      if (seen[i] && !this.holdGp[i]) this.pend[i] = 1;
      this.holdGp[i] = seen[i];
    }
    // stick flicks -> nav edges with auto-repeat
    const nx = Math.abs(ax) > 0.5 ? Math.sign(ax) : 0;
    const ny = Math.abs(ay) > 0.5 ? Math.sign(ay) : 0;
    if (nx !== this.gpStickNav.x || ny !== this.gpStickNav.y) {
      this.gpStickNav.x = nx;
      this.gpStickNav.y = ny;
      this.gpNavTimer = 0.38;
      this.navEdge(nx, ny);
    } else if (nx || ny) {
      this.gpNavTimer -= dt;
      if (this.gpNavTimer <= 0) {
        this.gpNavTimer = 0.11;
        this.navEdge(nx, ny);
      }
    }
    if (any) this.setDevice("gamepad");
  }
  private holdGpScratch = new Uint8Array(NA);

  private navEdge(nx: number, ny: number): void {
    if (nx < 0) this.pend[A.left] = 1;
    if (nx > 0) this.pend[A.right] = 1;
    if (ny < 0) this.pend[A.up] = 1;
    if (ny > 0) this.pend[A.down] = 1;
  }
}

const GP_MAP: [number, Action][] = [
  [GP_A, "dash"],
  [GP_A, "confirm"],
  [GP_X, "dash"],
  [GP_B, "ult"],
  [GP_Y, "ult"],
  [GP_RT, "ult"],
  [GP_RB, "dash"],
  [GP_LB, "dash"],
  [GP_B, "back"],
  [GP_START, "pause"],
  [GP_BACK, "pause"],
  [GP_UP, "up"],
  [GP_DOWN, "down"],
  [GP_LEFT, "left"],
  [GP_RIGHT, "right"],
];
