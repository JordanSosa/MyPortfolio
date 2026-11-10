/**
 * SECOND EVOLUTIONS - the view hub (docs/content/weapons.md §8; recipe: docs/ARCHITECTURE.md "Adding a
 * second evolution"). Every file in ./evo2/ that exports `evo2: Evo2Module[]` is picked up here
 * (import.meta.glob), so a work package adds its own file and never edits a shared view file
 * (world-view.ts, feedback.ts, weapon-fx.ts, heroes-*-fx.ts, arsenal2-fx.ts stay as they are).
 *
 * A module draws what the generic projectile drawer cannot express for its evolved weapons:
 *
 *   ids      the evolved weapon ids it handles
 *   bind     once per run: subscribe to the world's bus (weaponFx / heroFx cues, explosions, hits...);
 *            return the unsubscribe functions
 *   frame    once per frame while a run is drawn (reset budgets, advance clocks)
 *   draw     once per frame per HELD instance of one of its `ids` (world-space sprites through kit.r)
 *   reset    a new world was set (drop per-run state)
 *
 * Rules (CLAUDE.md "hero focus zone", the owner's readability notes):
 *  - Particles emitted on the fx layers (Layer.Fx / Layer.FxAdd) fade over the hero automatically. A sprite
 *    you draw yourself that can land on her (sparks, blasts, rings, trails) passes `Flag.Focus`; her own
 *    deliberate look and anything that must stay readable ON her does not.
 *  - No cooldown markers, status rings or meters on the hero.
 *  - Budget what scales with the crowd (a counter reset in `frame`), and never allocate per frame:
 *    module-scope emitter defs, reused option objects.
 *  - Read the world, never mutate it.
 */
import type { SfxId } from "../audio";
import type { Fx } from "../fx";
import type { WeaponInstance } from "../game/types";
import type { World } from "../game/world";
import type { Renderer } from "../render/renderer";
import type { Anims } from "./anims";
import type { FeedbackHooks } from "./feedback";
import type { WorldTexts } from "./texts";

/** What a module draws with (shared, built once). */
export interface Evo2Kit {
  readonly r: Renderer;
  readonly fx: Fx;
  readonly anims: Anims;
  readonly texts: WorldTexts;
}

/** Feedback's bind options (the same object every content view group gets). */
export interface Evo2BindOpts {
  sfx: (id: SfxId, vol?: number, pitch?: number, x?: number) => void;
  haptic: (ms: number) => void;
  sound: boolean;
  /** Reduced flashing / shake (settings): skip juice.shake, bloom surges and screen flashes. */
  calm: boolean;
  hooks?: FeedbackHooks;
}

export interface Evo2Module {
  readonly ids: readonly string[];
  reset?(w: World): void;
  bind?(w: World, kit: Evo2Kit, o: Evo2BindOpts): (() => void)[];
  frame?(kit: Evo2Kit, w: World, time: number, dt: number, realDt: number): void;
  draw?(kit: Evo2Kit, w: World, inst: WeaponInstance, time: number, dt: number, realDt: number): void;
}

const mods = import.meta.glob<{ evo2?: Evo2Module[] }>("./evo2/*.ts", { eager: true });
const MODULES: Evo2Module[] = Object.keys(mods)
  .sort()
  .flatMap((k) => mods[k].evo2 ?? []);
/** Evolved weapon id -> the module that draws it (the first one registered wins). */
const BY_ID = new Map<string, Evo2Module>();
for (const m of MODULES) for (const id of m.ids) if (!BY_ID.has(id)) BY_ID.set(id, m);

export class Evo2Fx {
  private w: World | null = null;
  private readonly kit: Evo2Kit;

  constructor(r: Renderer, fx: Fx, anims: Anims, texts: WorldTexts) {
    this.kit = { r, fx, anims, texts };
  }

  setWorld(w: World): void {
    this.w = w;
    for (const m of MODULES) m.reset?.(w);
  }

  /** Subscribe every module to the world's events (Feedback.bind). Returns the unsubscribe functions. */
  bind(w: World, o: Evo2BindOpts): (() => void)[] {
    const out: (() => void)[] = [];
    for (const m of MODULES) if (m.bind) out.push(...m.bind(w, this.kit, o));
    return out;
  }

  /** Called from WorldView.draw. `dt` = scaled sim dt, `realDt` = real dt. */
  draw(time: number, dt: number, realDt: number): void {
    const w = this.w;
    if (!w) return;
    for (const m of MODULES) m.frame?.(this.kit, w, time, dt, realDt);
    for (let i = 0; i < w.weapons.length; i++) {
      const inst = w.weapons[i];
      if (!inst.def.evolved) continue;
      BY_ID.get(inst.def.id)?.draw?.(this.kit, w, inst, time, dt, realDt);
    }
  }
}
