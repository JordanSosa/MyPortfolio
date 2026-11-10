/**
 * The HUD's Overdrive gauge for keyboard / mouse / gamepad play. On touch the OVERDRIVE button's ring
 * (core/touch.ts) shows the charge; the touch controls only show for touch players, so before this gauge
 * nothing on a desktop showed the meter (Season 3 owner report: "on PC there's no overdrive gauge?").
 *
 * Bottom-right corner, where the phone's button lives (lifted above the narrator caption band on windows
 * narrower than 1000 px, where that band reaches the corner): an orb echoing the button, a gold ring that
 * fills with the meter, the key to press in the middle (an "E" key cap; a round "B" face button when the
 * last input came from a gamepad), and OVERDRIVE under it. READY = the button's rainbow look: a vivid orb,
 * three pre-coloured glows cross-fading, a pulse, a ping ring, and a rainbow READY! sticker.
 * App shows it whenever the touch controls are not showing (never both), until the run ends; hud.ts drives it.
 *
 * No dash pips here: the hero already wears her dash recharge bar and one pip per charge under her feet
 * (view/world-view.ts, on every device), right where the player is looking; a corner copy would only add
 * clutter.
 *
 * Performance (it runs every frame): the ring is quantised to RING_STEPS and written at most every RING_DT
 * seconds of real time (full / empty land at once) from pre-built strings; state, key and visibility are
 * diffed; every looping animation is opacity / transform / scale (no animated box-shadow or filter); the
 * one-shot pop / shake are WAAPI; nothing here reads layout.
 */
import { Bump, h } from "./dom";

const STYLE_ID = "kk-od-style";
const CSS = `
.kk-od{position:absolute;right:calc(12px + var(--sar));bottom:calc(10px + var(--sab));display:flex;flex-direction:column;
  align-items:center;gap:.6em;pointer-events:none;contain:layout style;font-family:var(--font)}
.kk-od[hidden]{display:none}
.kk-od-orb{position:relative;width:3.3em;height:3.3em;display:grid;place-items:center}
.kk-od-body{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(255,255,255,.8);
  background:radial-gradient(circle at 35% 28%,#e6dcf5 0 8%,#9a86b8 34%,#57407e 72%,#2d1b45 100%);
  box-shadow:0 0 0 2px var(--outline),inset 0 -.28em 0 rgba(20,12,34,.4),0 3px 0 2px var(--outline)}
.kk-od-ring{position:absolute;left:-.45em;top:-.45em;width:calc(100% + .9em);height:calc(100% + .9em);transform:rotate(-90deg);overflow:visible}
.kk-od-ring circle{fill:none;stroke-linecap:round}
.kk-od-trk{stroke:rgba(20,12,34,.78);stroke-width:13}
.kk-od-fil{stroke:#ffe14d;stroke-width:7}
.kk-od-key{position:relative;min-width:1.4em;height:1.35em;padding:0 .18em;border-radius:.28em;display:grid;place-items:center;
  font-family:var(--mono);font-size:1em;font-weight:400;line-height:1;color:var(--outline);background:linear-gradient(180deg,#fff 0 55%,#ddc6ff);
  box-shadow:0 0 0 2px var(--outline),0 .16em 0 2px var(--outline)}
.kk-od-pad .kk-od-key{border-radius:50%;min-width:1.35em;height:1.35em;padding:0;color:#fff;text-shadow:var(--ol1);
  background:radial-gradient(circle at 35% 30%,#ffc2cd,#ff4d6d 58%,#c52348)}
.kk-od-lbl{position:relative;padding:.14em .5em .2em;border-radius:999px;background:rgba(20,12,34,.85);border:2px solid var(--lav);
  box-shadow:0 0 0 1px var(--outline);font-size:max(9px,.66em);font-weight:700;letter-spacing:.08em;line-height:1;
  color:var(--lav);text-shadow:var(--ol1);white-space:nowrap;display:grid;justify-items:center}
.kk-od-t0,.kk-od-t1{grid-area:1/1;font-style:normal}
.kk-od-t1,.kk-od-ready .kk-od-t0{visibility:hidden}
.kk-od-ready .kk-od-t1{visibility:visible}
.kk-od-gl{position:absolute;inset:-.1em;border-radius:50%;opacity:0;pointer-events:none}
.kk-od-g1{box-shadow:0 0 18px 5px #ff7ab8,0 0 36px 4px rgba(255,122,184,.6)}
.kk-od-g2{box-shadow:0 0 18px 5px #ffe14d,0 0 36px 4px rgba(255,225,77,.6)}
.kk-od-g3{box-shadow:0 0 18px 5px #4fe6df,0 0 36px 4px rgba(79,230,223,.6)}
.kk-od-ready .kk-od-body{border-color:#fff;background:radial-gradient(circle at 35% 28%,#fff 0 9%,#ffb8dc 30%,#b47cff 72%,#743fd1 100%)}
.kk-od-ready .kk-od-fil{stroke:#fff}
.kk-od-ready .kk-od-key{background:linear-gradient(180deg,#fff7b0 0 50%,#ffe14d)}
.kk-od-ready.kk-od-pad .kk-od-key{background:radial-gradient(circle at 35% 30%,#fff7b0,#ff7ab8 55%,#d9468f)}
.kk-od-ready .kk-od-lbl{color:#fff;border-color:#fff;transform:rotate(-6deg) scale(1.15);
  background:linear-gradient(90deg,#e8408e,#f08a1c 30%,#17a9a3 65%,#7e48e0)}
.kk-od-ready .kk-od-orb{animation:kk-od-pulse .9s ease-in-out infinite}
.kk-od-ready .kk-od-gl{animation:kk-od-xfade 1.2s linear infinite}
.kk-od-ready .kk-od-g2{animation-delay:-.8s}
.kk-od-ready .kk-od-g3{animation-delay:-.4s}
.kk-od-ready .kk-od-orb::after{content:"";position:absolute;inset:-.7em;border-radius:50%;border:3px solid rgba(255,255,255,.85);
  pointer-events:none;animation:kk-od-ping 1.1s ease-out infinite}
.hud.modal-open .kk-od-orb,.hud.modal-open .kk-od-orb::after,.hud.modal-open .kk-od-gl{animation-play-state:paused}
.hud.intro .kk-od{animation:kk-od-in .45s cubic-bezier(.2,1.4,.4,1) .3s both}
@media (max-width:1000px){.kk-od{bottom:calc(14px + 4.6em + var(--sab))}}
@keyframes kk-od-xfade{0%{opacity:0}17%{opacity:1}33%{opacity:1}50%{opacity:0}100%{opacity:0}}
@keyframes kk-od-pulse{0%,100%{scale:1}50%{scale:1.08}}
@keyframes kk-od-ping{0%{transform:scale(.75);opacity:.9}100%{transform:scale(1.25);opacity:0}}
@keyframes kk-od-in{from{transform:translateX(160%)}}
`;

/** Ring fills are quantised to RING_STEPS and written at most every RING_DT s (a full / empty ring always lands). */
const RING_STEPS = 40;
const RING_DT = 0.066;
const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;
/** Pre-built stroke-dashoffset strings per step (steady play allocates nothing). */
const OFFSET: string[] = Array.from({ length: RING_STEPS + 1 }, (_, i) => (RING_C * (1 - i / RING_STEPS)).toFixed(1));

const K_POP: Keyframe[] = [{ transform: "scale(1)" }, { transform: "scale(1.35) rotate(-6deg)", offset: 0.4 }, { transform: "scale(1)" }];
const O_POP: KeyframeAnimationOptions = { duration: 360, easing: "cubic-bezier(.3,1.8,.5,1)" };
const K_SHAKE: Keyframe[] = [
  { translate: "0" },
  { translate: "-5px", offset: 0.2 },
  { translate: "5px", offset: 0.4 },
  { translate: "-3px", offset: 0.6 },
  { translate: "3px", offset: 0.8 },
  { translate: "0" },
];
const O_SHAKE: KeyframeAnimationOptions = { duration: 300, easing: "ease-in-out" };

export class HudOverdrive {
  readonly root: HTMLElement;
  private readonly fil: SVGCircleElement;
  private readonly key: HTMLElement;
  private readonly bPop: Bump;
  private readonly bShake: Bump;
  private shown = false;
  private pad = false;
  private ready = false;
  private q = -1;
  /** Real seconds since the last ring write. */
  private ringT = 0;

  constructor(parent: HTMLElement) {
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement("style");
      st.id = STYLE_ID;
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    const c = RING_C.toFixed(2);
    const r = h(
      "div",
      "kk-od",
      `<div class="kk-od-orb"><i class="kk-od-gl kk-od-g1"></i><i class="kk-od-gl kk-od-g2"></i><i class="kk-od-gl kk-od-g3"></i>` +
        `<i class="kk-od-body"></i><svg class="kk-od-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="kk-od-trk" cx="50" cy="50" r="${RING_R}"/>` +
        `<circle class="kk-od-fil" cx="50" cy="50" r="${RING_R}" stroke-dasharray="${c}" stroke-dashoffset="${c}"/></svg><b class="kk-od-key">E</b></div>` +
        // (both words share one grid cell: the label keeps OVERDRIVE's width when READY! shows, so the
        // right-anchored orb never jumps sideways, and a bubble placed on the ultReady event stays on it)
        `<span class="kk-od-lbl"><i class="kk-od-t0">OVERDRIVE</i><i class="kk-od-t1">READY!</i></span>`,
    );
    r.hidden = true;
    r.setAttribute("aria-hidden", "true");
    parent.appendChild(r);
    this.root = r;
    this.fil = r.querySelector(".kk-od-fil") as SVGCircleElement;
    this.key = r.querySelector(".kk-od-key") as HTMLElement;
    const orb = r.querySelector(".kk-od-orb") as HTMLElement;
    this.bPop = new Bump(orb, K_POP, O_POP, 0);
    this.bShake = new Bump(r, K_SHAKE, O_SHAKE, 0);
  }

  /** Show / hide (returns true when that changed) + the key label (gamepad "B", else "E"). Per frame, diffed. */
  mode(show: boolean, pad: boolean): boolean {
    if (pad !== this.pad) {
      this.pad = pad;
      this.key.textContent = pad ? "B" : "E";
      this.root.classList.toggle("kk-od-pad", pad);
    }
    if (show === this.shown) return false;
    this.shown = show;
    this.root.hidden = !show;
    // (hidden, the ring was not written: the first visible frame catches it up at once)
    if (show) this.ringT = RING_DT;
    return true;
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Meter 0..1 + ready. Per frame; writes only what changed (nothing at all while hidden). */
  update(fill: number, ready: boolean, realDt: number): void {
    if (!this.shown) return;
    this.ringT += realDt;
    const q = ready ? RING_STEPS : Math.round(Math.max(0, Math.min(1, fill)) * RING_STEPS);
    if (q !== this.q && (q === RING_STEPS || q === 0 || this.q < 0 || this.ringT >= RING_DT)) {
      this.q = q;
      this.ringT = 0;
      this.fil.style.strokeDashoffset = OFFSET[q];
    }
    if (ready !== this.ready) {
      this.ready = ready;
      this.root.classList.toggle("kk-od-ready", ready);
      if (ready) this.bPop.play(true);
    }
  }

  /** Overdrive pressed before it is charged: a little shake (the touch button's deny). */
  deny(): void {
    if (this.shown) this.bShake.play(true);
  }

  /** New run: forget the diff cache (the next update writes everything it shows). */
  reset(): void {
    this.q = -1;
    this.ringT = 0;
    if (this.ready) {
      this.ready = false;
      this.root.classList.remove("kk-od-ready");
    }
  }
}
