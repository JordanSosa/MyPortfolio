/**
 * Second evolutions, the pilot: MEOWTEOR HAMMER (Yarn Orbit + Power Bow; src/game/weapons/yarn-orbit.ts).
 *
 *   w_meowteor            16x16 x2   the spiked yarn wrecking ball (spun by code; f1 = the spikes a half step on)
 *   icon_meowteor_hammer  16x16      its card / HUD / wiki icon
 *
 * The file every evo2-<package>.ts copies: `sprites` + `manifest` side by side (./evo2-util.ts).
 */
import type { SpriteDef } from "../format";
import type { ManifestEntry } from "../manifest";
import { Cv, I16, iconRow, row, spr, twinkle } from "./evo2-util";

/** A hot yarn ball: wound strands (dark orange) over an orange body lit from the top-left, a pale core. */
function hotYarn(c: Cv, cx: number, cy: number, r: number): void {
  c.ball(cx, cy, r, r, "OOoooyz", { bias: 0.05 });
  c.each((x, y, k) => {
    if (!"oy".includes(k)) return null;
    const dx = x - cx;
    const dy = y - cy;
    // ")"-shaped winds, crossed by a band over the upper-left (the yarn icon's construction)
    const band = dx + dy < -r * 0.2 && dx + dy > -r * 1.1;
    const u = band ? dy + 0.1 * dx * dx : dx - 0.1 * dy * dy;
    const period = r > 3.5 ? 2.6 : 2;
    return Math.abs(((((u + 40) % period) + period) % period) - period / 2) < 0.5 ? "O" : null;
  });
}

/** `n` spikes around (cx, cy): a pale base pixel at radius r, a white tip one pixel further out. */
function spikes(c: Cv, cx: number, cy: number, r: number, n: number, rot: number): void {
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    c.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), "y");
    c.set(Math.round(cx + Math.cos(a) * (r + 1.2)), Math.round(cy + Math.sin(a) * (r + 1.2)), "w");
  }
}

function wMeowteor(f: number): Cv {
  const c = new Cv(16, 16);
  spikes(c, 7.5, 7.5, 5.6, 8, f ? Math.PI / 8 : 0);
  hotYarn(c, 7.5, 7.5, 4.6);
  c.set(6, 5, "w");
  // (a coloured rim, never plum: the ball sits on the bloom layer)
  c.outline("R");
  return c;
}

function iconMeowteorHammer(): Cv {
  const c = I16();
  hotYarn(c, 7, 8.5, 4.4);
  c.set(5, 6, "w").set(6, 6, "z");
  c.outline("1");
  // the spikes sit on the outline: a yellow base, a white tip (no second outline: they stay crisp at 16 px)
  spikes(c, 7, 8.5, 5.4, 8, Math.PI / 8);
  return twinkle(c, "tr");
}

export const sprites: SpriteDef[] = [
  spr("w_meowteor", 16, 16, [wMeowteor(0), wMeowteor(1)], "center", { fps: 6 }),
  spr("icon_meowteor_hammer", 16, 16, [iconMeowteorHammer()], "center"),
];

export const manifest: ManifestEntry[] = [
  row("w_meowteor", 16, 16, 2, "Meowteor Hammer: a spiked orange yarn wrecking ball (white-tipped spikes, pale core, dark-red rim); f1 = the spikes turned half a step"),
  iconRow("icon_meowteor_hammer", "Evolution: Meowteor Hammer (Yarn Orbit + Power Bow) - a spiked orange yarn ball, white-tipped spikes, gold twinkle"),
];
