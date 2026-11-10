/**
 * Debug render toggles (dev console Perf tab). Installed on first use by
 * wrapping this Renderer's endFrame once: the extra sprites are queued right
 * before the frame is submitted, so they land on top of everything the view
 * drew. Zero cost until a toggle is switched on.
 *
 *   hitboxes   enemy collision circles (elites orange, bosses pink), the hero's body, bullets, projectiles
 *   spawnRing  the director's off-screen spawn band (view + 14..28 px); the camera zooms out to 0.6x to show it
 *              (NOTE: the sim's view grows with it while on: enemies spawn farther out)
 *   noBloom    bloom / glow pass off (quality.bloom forced false for the frame)
 *   noGrade    colour grade forced neutral (after every view has written it)
 */
import { CFG } from "../../game/config";
import { PLAYER_CY } from "../../game/world";
import { Layer } from "../../render/layers";
import type { App } from "../../ui/app";

export const overlay = { hitboxes: false, spawnRing: false, noBloom: false, noGrade: false };

let installed = false;

export function installOverlay(app: App): void {
  if (installed) return;
  installed = true;
  const r = app.r;
  const orig = r.endFrame.bind(r);
  r.endFrame = () => {
    const w = app.game?.world ?? app.attract?.world;
    if (w && overlay.hitboxes) drawHitboxes(app, w);
    if (w && overlay.spawnRing) drawSpawnRing(app);
    let bloom = r.quality.bloom;
    if (overlay.noBloom) r.quality.bloom = false;
    if (overlay.noGrade) {
      const g = r.post.grade;
      g.tint[0] = g.tint[1] = g.tint[2] = 1;
      g.lift[0] = g.lift[1] = g.lift[2] = 0;
      g.saturation = g.contrast = g.brightness = 1;
      g.hue = 0;
    }
    try {
      orig();
    } finally {
      if (overlay.noBloom) r.quality.bloom = bloom;
      bloom = false;
    }
  };
}

/** The spawn-ring zoom follows the toggle (call after changing it). */
export function syncZoom(app: App): void {
  app.r.camera.zoomTo(overlay.spawnRing ? 0.6 : 1, 6);
}

function drawHitboxes(app: App, w: NonNullable<App["game"]>["world"]): void {
  const r = app.r;
  const L = Layer.Text;
  const en = w.enemies;
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i];
    if (e.dead) continue;
    const col = e.def.boss ? 0xff5ce1 : e.elite ? 0xffa040 : e.def.prop ? 0x9be7ff : 0xff4d6d;
    r.ring(L, e.x, e.y - e.cy, Math.max(1, e.r), col, 0.9);
  }
  const p = w.player;
  r.ring(L, p.x, p.y - PLAYER_CY, CFG.playerRadius, 0x7dff9a, 1, 0, true);
  r.ring(L, p.x, p.y - PLAYER_CY, CFG.pickupRadius * w.stats.pickup, 0x7dff9a, 0.25);
  const bl = w.bullets;
  for (let i = 0; i < bl.count; i++) {
    const b = bl.items[i];
    r.ring(L, b.x, b.y, Math.max(1, b.r), 0xffe14d, 0.95);
  }
  const pr = w.projectiles;
  for (let i = 0; i < pr.count; i++) {
    const q = pr.items[i];
    if (q.dead) continue;
    r.ring(L, q.x, q.y, Math.max(1, q.r), 0x4fe6df, 0.7);
  }
}

function drawSpawnRing(app: App): void {
  const r = app.r;
  const w = app.game?.world ?? app.attract?.world;
  if (!w) return;
  // the sim's view rectangle (centred on the camera target) and the spawn band beyond it
  const cx = r.camera.view.x + r.camera.view.w / 2;
  const cy = r.camera.view.y + r.camera.view.h / 2;
  const rect = (m: number, col: number, a: number) => {
    const x0 = cx - w.viewW / 2 - m;
    const x1 = cx + w.viewW / 2 + m;
    const y0 = cy - w.viewH / 2 - m;
    const y1 = cy + w.viewH / 2 + m;
    r.line(Layer.Text, x0, y0, x1, y0, 1, col, a);
    r.line(Layer.Text, x1, y0, x1, y1, 1, col, a);
    r.line(Layer.Text, x1, y1, x0, y1, 1, col, a);
    r.line(Layer.Text, x0, y1, x0, y0, 1, col, a);
  };
  rect(0, 0xffffff, 0.5);
  rect(14, 0x4fe6df, 0.9);
  rect(28, 0xff5ce1, 0.9);
}
