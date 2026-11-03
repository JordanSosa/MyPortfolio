/**
 * Ultimate anime cut-in (DESIGN §4): a diagonal band slides across with the
 * hero's shouting portrait (frame 1) and the ult's huge outlined title shaking
 * in. Pure DOM/CSS. The in-animation (0.92 s) ends on a held pose; the exit is
 * driven by the SIM: call `end()` when the world starts the ultimate
 * (`ultStart`, after CFG.cutinTime of sim time), so the overlay can't vanish
 * early on a slow device whose sim runs on clamped frame time. There is no
 * wall-clock fallback: App ends it whenever the sim is no longer in its cut-in
 * and whenever the run / screen ends (a paused game keeps it up, untouched).
 */
import { HERO_BY_ID } from "../game/heroes";
import { esc, h, sprite } from "./dom";

const BAND: Record<string, [string, string, string]> = {
  hoshi: ["#ffb8dc", "#ff7ab8", "#d9468f"],
  rin: ["#ffd6c4", "#ff4d6d", "#ad1d4a"],
  mochi: ["#ddc6ff", "#b47cff", "#743fd1"],
};

export interface CutinHandle {
  /** Play the exit (0.18 s) and remove the overlay. Safe to call twice. */
  end(): void;
}

/** Exit animation length (matches `.cutin.out` in styles.css). */
const OUT_MS = 200;

export function showCutin(parent: HTMLElement, heroId: string, portrait: string, title: string): CutinHandle {
  // Season 2 heroes carry their band in the HeroDef (docs/content/heroes.md §1.2) and a shouted line
  const def = HERO_BY_ID.get(heroId);
  const [c1, c2, c3] = def?.band ?? BAND[heroId] ?? BAND.hoshi;
  const line = def?.cutinLine ?? "";
  const el = h("div", "cutin");
  const words = title.split(" ");
  const half = Math.ceil(words.length / 2);
  const t1 = words.slice(0, half).join(" ");
  const t2 = words.slice(half).join(" ");
  el.innerHTML = `
    <div class="band" style="--c1:${c1};--c2:${c2};--c3:${c3}"></div>
    <img class="por px" src="${sprite(portrait, 1, 4)}" alt="">
    <div class="ttl"><small>OVERDRIVE</small>${esc(t1)}<br>${esc(t2)}</div>${line ? `<div class="line">${esc(line)}</div>` : ""}
    <div class="flash"></div>`;
  parent.appendChild(el);
  let done = false;
  const end = (): void => {
    if (done) return;
    done = true;
    el.classList.add("out");
    setTimeout(() => el.remove(), OUT_MS);
  };
  return { end };
}
