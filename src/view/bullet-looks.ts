/**
 * Per-sprite enemy-bullet looks for WorldView.drawBullets (SHARED: any
 * stage's view file registers its bullets at module load with
 * `bulletLook(sprite, look)`). Unregistered sprites keep the slice look
 * (pink glow, no spin; moons / stars special-cased in the drawer).
 */
export interface BulletLook {
  /** Glow colour under the sprite. */
  glow: number;
  /** Glow radius at scale 1 (default 8.5). */
  glowR?: number;
  /** Sprite tint (default white). */
  tint?: number;
  /** Spin (rad/s). */
  spin?: number;
  /** Rotate along the velocity. */
  velRot?: boolean;
  /** The hit radius the art is drawn for: a bullet with a bigger radius draws scaled up (r / baseR). */
  baseR?: number;
}

export const BULLET_LOOKS = new Map<string, BulletLook>();

export function bulletLook(sprite: string, look: BulletLook): void {
  BULLET_LOOKS.set(sprite, look);
}
