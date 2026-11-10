/**
 * Authoring kit for the SECOND EVOLUTIONS' art (docs/content/weapons.md §8, recipe: docs/ARCHITECTURE.md
 * "Adding a second evolution"). Exports NO sprites (the registry only picks up `sprites` / `fonts`).
 *
 * One art file per work package: src/art/sprites/evo2-<package>.ts. Each file exports
 *
 *   export const sprites: SpriteDef[]         its sprites (picked up by ./index.ts, as every art file)
 *   export const manifest: ManifestEntry[]    their required-sprite rows (picked up by ../manifest.ts)
 *
 * so a package never edits a shared art file: no row in manifest.ts, no entry in icons.ts.
 * Conventions are the world kit's (world-util.ts): everything faces RIGHT, pale core -> saturated body ->
 * coloured dark rim on anything drawn on the bloom layer, a 1-px margin on icons, the gold twinkle on an
 * evolution icon's corner.
 */
import type { ManifestEntry, Pivot } from "../manifest";
import { Cv, GLOW, I16, icon, rgba, sparkle, spr, twinkle } from "./s2-items-util";

export { Cv, GLOW, I16, icon, rgba, sparkle, spr, twinkle };

/** Manifest row of a second-evolution world sprite (projectile / fx; pivot "center" unless it stands on the ground). */
export function row(id: string, w: number, h: number, frames: number, desc: string, pivot: Pivot = "center"): ManifestEntry {
  return { id, w, h, frames, pivot, owner: "evo2", desc };
}

/** Manifest row of a second evolution's 16x16 card icon (`icon_<weapon id>`). */
export function iconRow(id: string, desc: string): ManifestEntry {
  return row(id, 16, 16, 1, desc);
}
