/**
 * First-runs onboarding (save.data.runs < 3, never in autoplay):
 *  1. the move hint stays until the stick / keys have produced movement for
 *     1 s in total, then fades (no timer);
 *  2. touch: a bubble points at DASH ("TAP DASH — invincible dodge!") until the
 *     first dash (persisted: save.data.tut.dash); the first hit taken before
 *     that pulses the DASH button;
 *  3. the first two times OVERDRIVE charges (save.data.tut.ult), a bubble on the
 *     OVERDRIVE button (touch) or on the HUD's Overdrive gauge with the key to
 *     press (keyboard / gamepad: hud-overdrive.ts);
 *  4. pressing OVERDRIVE before it is charged explains the meter once per run
 *     (pointing at the button / the gauge).
 * Bubbles / hints live in the HUD (hud.ts): they hide under modals and stay
 * inside the safe area.
 */
import type { Input } from "../core/input";
import type { World } from "../game/world";
import type { Hud } from "./hud";
import { save } from "./save";

const DASH_BTN = ".kk-dash";
/** The touch OVERDRIVE button, else (touch controls hidden: keyboard / gamepad) the HUD's Overdrive gauge. */
const ULT_ANCHOR = ".kk-ult, .kk-od-orb";

export class Tutorial {
  private moveT = 0;
  private stage: "idle" | "move" | "dash" | "done" = "idle";
  private denyShown = false;
  private offs: (() => void)[] = [];
  private pulseT = 0;
  private pulsed = false;

  constructor(
    private readonly hud: Hud,
    private readonly input: Input,
    private readonly world: World,
  ) {
    this.offs.push(
      world.bus.on("dash", () => this.dashed()),
      world.bus.on("playerHurt", () => this.hurt()),
    );
    if (save.data.tut.ult < 2) {
      const input = this.input;
      hud.ultHint = {
        // (read when the bubble shows: a touchscreen laptop may have switched device since the run began)
        get html() {
          const d = input.lastDevice;
          return d === "touch" ? "<b>OVERDRIVE READY</b> — TAP!" : `<b>OVERDRIVE READY</b> — PRESS <b>${d === "gamepad" ? "B" : "E"}</b>!`;
        },
        anchor: ULT_ANCHOR,
        shown: () => {
          save.data.tut.ult++;
          save.save();
          if (save.data.tut.ult >= 2) hud.ultHint = null;
        },
      };
    }
  }

  private get touch(): boolean {
    return this.input.lastDevice === "touch";
  }

  /** Show the move hint (run start, or the GO! of the run-start stinger). */
  start(): void {
    if (this.stage !== "idle") return;
    this.stage = "move";
    const dev = this.input.lastDevice;
    this.hud.hint(
      dev === "touch"
        ? "<b>DRAG ANYWHERE</b> TO MOVE\nATTACKS ARE AUTOMATIC!"
        : dev === "gamepad"
          ? "<b>STICK</b> MOVE · <b>A</b> DASH · <b>B</b> OVERDRIVE\nATTACKS ARE AUTOMATIC!"
          : "<b>WASD</b> MOVE · <b>SPACE</b> DASH · <b>E</b> OVERDRIVE\nATTACKS ARE AUTOMATIC!",
      true,
    );
  }

  /** Per frame while the run is live (no modal). */
  frame(dt: number): void {
    if (this.stage === "move") {
      if (this.input.move.x !== 0 || this.input.move.y !== 0) this.moveT += dt;
      if (this.moveT >= 1) {
        this.hud.hideHint();
        if (this.touch && !save.data.tut.dash) {
          this.stage = "dash";
          this.hud.bubble("dash", "TAP <b>DASH</b> — invincible dodge!", DASH_BTN);
        } else this.stage = "done";
      }
    }
    if (this.pulseT > 0) {
      this.pulseT -= dt;
      if (this.pulseT <= 0) this.hud.pulseButton(DASH_BTN, false);
    }
  }

  /** The touch controls appeared / disappeared: re-anchor the bubbles. */
  relayout(): void {
    this.hud.placeBubbles();
  }

  /** OVERDRIVE pressed before it is charged. */
  denied(): void {
    if (this.denyShown) return;
    this.denyShown = true;
    this.hud.bubble("tip", "OVERDRIVE <b>fills as you fight</b>", ULT_ANCHOR, 2.4);
  }

  private dashed(): void {
    if (!save.data.tut.dash) {
      save.data.tut.dash = true;
      save.save();
    }
    if (this.stage === "dash") this.stage = "done";
    this.hud.hideBubble("dash");
    this.pulseT = 0;
    this.hud.pulseButton(DASH_BTN, false);
  }

  private hurt(): void {
    // first hit before the player ever dashed: the DASH button pulses for a moment
    if (save.data.tut.dash || !this.touch || this.pulsed) return;
    this.pulsed = true;
    this.pulseT = 2.2;
    this.hud.pulseButton(DASH_BTN, true);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.hud.pulseButton(DASH_BTN, false);
    this.hud.ultHint = null;
  }
}
