/**
 * Ultimate anime cut-in (DESIGN §4): a diagonal band slides across with the
 * hero's shouting portrait (frame 1) and the ult's huge outlined title shaking
 * in. Pure DOM/CSS; lasts CFG.cutinTime (1.1 s), matching the sim pause.
 */
import { esc, h, sprite } from "./dom";

const BAND: Record<string, [string, string, string]> = {
  hoshi: ["#ffb8dc", "#ff7ab8", "#d9468f"],
  rin: ["#ffd6c4", "#ff4d6d", "#ad1d4a"],
  mochi: ["#ddc6ff", "#b47cff", "#743fd1"],
};

export function showCutin(parent: HTMLElement, heroId: string, portrait: string, title: string): void {
  const [c1, c2, c3] = BAND[heroId] ?? BAND.hoshi;
  const el = h("div", "cutin");
  const words = title.split(" ");
  const half = Math.ceil(words.length / 2);
  const t1 = words.slice(0, half).join(" ");
  const t2 = words.slice(half).join(" ");
  el.innerHTML = `
    <div class="band" style="--c1:${c1};--c2:${c2};--c3:${c3}"></div>
    <img class="por px" src="${sprite(portrait, 1, 4)}" alt="">
    <div class="ttl"><small>OVERDRIVE</small>${esc(t1)}<br>${esc(t2)}</div>
    <div class="flash"></div>`;
  parent.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
