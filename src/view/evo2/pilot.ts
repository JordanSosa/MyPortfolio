/**
 * Second evolutions, the pilot: MEOWTEOR HAMMER (src/game/weapons/yarn-orbit.ts). The balls themselves are
 * managed projectiles (`w_meowteor`, drawn by the generic drawer); this module dresses the SLAM.
 *
 *   explosion (source meowteor_hammer)   on top of the generic blast (Feedback): a hot ring in the weapon's
 *       orange and yarn bits flung out. All particles on the fx layers, so they fade over the hero
 *       (Flag.Focus) when the in-swing lands a slam next to her. Budgeted per frame.
 *
 * The file every src/view/evo2/<package>.ts copies: module-scope emitters and state, `evo2` exported.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { P, type EmitterDef } from "../../fx";
import { Layer } from "../../render/layers";
import type { Evo2Module } from "../evo2-fx";

const HAMMER = "meowteor_hammer";
/** Slams dressed per frame (the rest keep the generic blast only). */
const SLAM_BUDGET = 6;

/** Yarn bits: short orange / yellow threads flung out of the slam, gone in a third of a second. */
const yarnBit: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [40, 110],
  spread: TAU,
  life: [0.18, 0.34],
  size: [1.6, 0.8],
  aspect: 2.2,
  colors: [C.orange, C.yellow, C.paleYellow],
  drag: 4,
  rot: "random",
  alphaCurve: "late",
  layer: Layer.Fx,
};

let slams = 0;

const meowteor: Evo2Module = {
  ids: [HAMMER],
  reset() {
    slams = 0;
  },
  frame() {
    slams = 0;
  },
  bind(w, kit) {
    return [
      w.bus.on("explosion", (e) => {
        if (e.source !== HAMMER || slams++ >= SLAM_BUDGET) return;
        const ps = kit.fx.ps;
        const s = e.r / 28;
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.orange, 1.5 * s);
        ps.emit(yarnBit, e.x, e.y - 2, 6);
        ps.emit(P.sparkle, e.x, e.y - 2, 2, NaN, C.paleYellow, 0.8 * s);
      }),
    ];
  },
};

export const evo2: Evo2Module[] = [meowteor];
