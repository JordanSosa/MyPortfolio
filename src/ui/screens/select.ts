/** Character select: portrait tabs + detail card (trait, start weapon, ultimate, idle animation) + GO! */
import { HEROES, heroDef } from "../../game/heroes";
import { ULTIMATES, WEAPONS } from "../../game/registry";
import type { App, UiScreen } from "../app";
import { esc, h, img, sprite } from "../dom";
import { closeEl, layer, onTap } from "./common";

export function showSelect(app: App): UiScreen {
  const el = h("div", "scr select");
  el.innerHTML = `
    <div class="h1">CHOOSE YOUR DREAMER</div>
    <div class="sel-wrap">
      <div class="tabs">${HEROES.map(
        (hd) => `<button class="tab" data-nav data-hero="${hd.id}" style="--hc:${app.heroColor(hd.id)}">${img(hd.portrait, "px", 0, 2)}<span class="nm">${esc(hd.name)}</span></button>`,
      ).join("")}</div>
      <div class="panel hero-card"></div>
      <div class="sel-go">
        <button class="btn ghost small" data-nav data-act="back">◀ BACK</button>
        <button class="btn gold" data-nav data-nav-default data-act="go">GO! ★</button>
      </div>
    </div>`;
  app.ui.appendChild(el);
  const card = el.querySelector(".hero-card") as HTMLElement;
  let idleTimer = 0;
  let idleF = 0;
  let idleImgs: HTMLImageElement[] = [];
  let idleFrames: string[] = [];

  const render = (id: string) => {
    const hd = heroDef(id);
    app.hero = hd.id;
    for (const t of el.querySelectorAll<HTMLElement>(".tab")) t.classList.toggle("on", t.dataset.hero === hd.id);
    const wd = WEAPONS.get(hd.weapon);
    const ud = ULTIMATES.get(hd.ult);
    card.style.setProperty("--hc", app.heroColor(hd.id));
    card.innerHTML = `
      <div class="por">${img(hd.portrait, "px", 0, 3)}<img class="idle mini px" alt="" src="${sprite(`${hd.sprite}_idle`, 0, 4)}"></div>
      <div class="stage"><img class="idle px" alt="" src="${sprite(`${hd.sprite}_idle`, 0, 4)}"></div>
      <div class="nm">${esc(hd.name)}</div>
      <div class="tt">${esc(hd.title.toUpperCase())}</div>
      <div class="facts">
        <div class="fact"><span class="ico">✦</span><div><span class="k">TRAIT</span><b>${esc(hd.trait)}</b></div></div>
        <div class="fact">${img(wd?.icon ?? "", "px", 0, 2)}<div><span class="k">START WEAPON</span><b>${esc(wd?.name ?? hd.weapon)}</b><small>${esc(wd?.desc ?? "")}</small></div></div>
        <div class="fact">${img(hd.portrait, "px", 1, 1)}<div><span class="k">OVERDRIVE</span><b>${esc(ud?.name ?? hd.ult)}</b><small>${esc(ud?.desc ?? "")}</small></div></div>
      </div>`;
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = "";
    idleImgs = [...card.querySelectorAll<HTMLImageElement>(".idle")];
    idleFrames = [0, 1, 2, 3].map((f) => sprite(`${hd.sprite}_idle`, f, 4));
    idleF = 0;
  };
  render(app.hero);

  for (const t of el.querySelectorAll<HTMLElement>(".tab"))
    onTap(t, () => {
      if (t.dataset.hero === app.hero) {
        app.sfx("uiConfirm");
        app.startRun(app.hero);
        return;
      }
      app.sfx("cardFlip");
      render(t.dataset.hero as string);
    });
  onTap(el.querySelector('[data-act="go"]'), () => {
    app.sfx("uiConfirm");
    app.startRun(app.hero);
  });
  const back = () => {
    app.sfx("uiBack");
    app.goTitle();
  };
  onTap(el.querySelector('[data-act="back"]'), back);
  const L = layer(el, back);
  // focusing a tab with keys/gamepad previews the hero
  el.addEventListener("navfocus", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>(".tab");
    if (t && t.dataset.hero && t.dataset.hero !== app.hero) render(t.dataset.hero);
  });
  return {
    el,
    layer: L,
    close: () => closeEl(el),
    update(dt) {
      idleTimer += dt;
      if (idleTimer > 1 / 6 && idleImgs.length && idleFrames.length) {
        idleTimer = 0;
        idleF = (idleF + 1) % idleFrames.length;
        for (const im of idleImgs) im.src = idleFrames[idleF];
      }
    },
  };
}
