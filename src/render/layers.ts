/**
 * Draw layers (buckets), rendered in this order. `Entity` is y-sorted.
 *
 *   Ground   tiles                        Decal   scorch marks, telegraph circles, auras on the floor
 *   Shadow   blob shadows                 Entity  actors, props, deco (y-sorted, stable)
 *   FxBelow  fx under the main fx         Fx      normal-blend fx (puffs, petals, slashes)
 *   FxAdd    additive fx (forced ADD)     Bullets enemy bullets - always above fx
 *   Text     in-world text / numbers      Overlay world-space overlays (speed lines, ambient, dimmers)
 */
export const Layer = {
  Ground: 0,
  Decal: 1,
  Shadow: 2,
  Entity: 3,
  FxBelow: 4,
  Fx: 5,
  FxAdd: 6,
  Bullets: 7,
  Text: 8,
  Overlay: 9,
} as const;
export type Layer = (typeof Layer)[keyof typeof Layer];
export const LAYER_COUNT = 10;
export const LAYER_NAMES = ["ground", "decal", "shadow", "entity", "fxBelow", "fx", "fxAdd", "bullets", "text", "overlay"] as const;

/** Draw flags (bit mask) for SpriteBatch.draw(). */
export const Flag = {
  None: 0,
  /** Additive blend (premultiplied: alpha is zeroed so colour adds). */
  Add: 1,
  /** Also draw into the glow/bloom buffer. */
  Glow: 2,
  /** Draw ONLY into the glow/bloom buffer (soft halos that should only bloom). */
  GlowOnly: 4,
  /** Disable pixel-grid snapping for this sprite (smooth sub-pixel motion when scaled/rotated). */
  NoSnap: 8,
} as const;
