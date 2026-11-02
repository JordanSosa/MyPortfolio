/** Dream Shop: permanent meta upgrades bought with star coins (persisted). */
import { META, metaCost } from "../../game/meta";
import type { App, UiScreen } from "../app";
import { esc, h, img, replay } from "../dom";
import { save } from "../save";
import { closeEl, layer, onTap } from "./common";

export function showShop(app: App): UiScreen {
  const el = h("div", "scr shop");
  el.innerHTML = `
    <div class="shop-head">
      <button class="btn ghost small" data-nav data-act="back">◀ BACK</button>
      <div class="h1">DREAM SHOP</div>
      <span class="coins">${img("icon_coin")}<span class="cn">0</span></span>
    </div>
    <div class="shop-grid"></div>
    <div class="h2">coins carry over between runs · costs grow ×1.6 per rank</div>`;
  app.ui.appendChild(el);
  const grid = el.querySelector(".shop-grid") as HTMLElement;
  const cn = el.querySelector(".cn") as HTMLElement;
  const render = () => {
    cn.textContent = String(save.data.coins);
    grid.innerHTML = META.map((m, i) => {
      const rank = save.data.meta[m.id] ?? 0;
      const maxed = rank >= m.maxRank;
      const cost = metaCost(m, rank);
      let pips = "";
      for (let r = 0; r < m.maxRank; r++) pips += `<i class="${r < rank ? "on" : ""}"></i>`;
      return `<button class="meta${maxed ? " maxed" : save.data.coins < cost ? " poor" : ""}" data-nav data-id="${m.id}" style="--i:${i}">
        ${img(m.icon, "px", 0, 2)}<b>${esc(m.name)}</b><small>${esc(m.desc)}</small><span class="pp">${pips}</span>
        <span class="cost">${maxed ? "MAX" : `${img("icon_coin")}${cost}`}</span></button>`;
    }).join("");
    for (const b of grid.querySelectorAll<HTMLElement>(".meta")) onTap(b, () => buy(b.dataset.id as string));
  };
  const buy = (id: string) => {
    const m = META.find((x) => x.id === id);
    if (!m) return;
    const rank = save.data.meta[id] ?? 0;
    const cost = metaCost(m, rank);
    const btn = grid.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (rank >= m.maxRank || save.data.coins < cost) {
      app.sfx("uiDeny");
      if (btn) replay(btn, "denied");
      return;
    }
    save.data.coins -= cost;
    save.data.meta[id] = rank + 1;
    save.save();
    app.sfx("powerup");
    const focusId = id;
    render();
    const nb = grid.querySelector<HTMLElement>(`[data-id="${focusId}"]`);
    if (nb) {
      replay(nb, "bought");
      const L = app.nav.top;
      if (L && L.root === el) app.nav.setFocus(L, nb);
    }
  };
  render();
  const back = () => {
    app.sfx("uiBack");
    app.goTitle();
  };
  onTap(el.querySelector('[data-act="back"]'), back);
  return { el, layer: layer(el, back), close: () => closeEl(el) };
}
