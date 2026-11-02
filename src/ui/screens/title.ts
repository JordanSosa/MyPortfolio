/** Title: animated logo (bouncing letters + shine sweep) over the live attract-mode game. */
import type { App, UiScreen } from "../app";
import { fmtTime, h, img, letters } from "../dom";
import { save } from "../save";
import { closeEl, layer, onTap, sparkles } from "./common";

export function showTitle(app: App): UiScreen {
  const el = h("div", "scr title");
  const b = save.data.best;
  el.innerHTML = `
    ${sparkles(14)}
    <div class="logo">
      <span class="l1">${letters("KIRA")}<span class="star">☆</span>${letters("KIRA")}</span>
      <span class="l2">${letters("OVERDRIVE", "ltr", 0.07)}</span>
      <div class="shine"></div>
      <span class="tag">SURVIVE THE NIGHTMARE STAMPEDE UNTIL DAWN</span>
    </div>
    <div class="menu">
      <button class="btn" data-nav data-nav-default data-act="play">▶ PLAY</button>
      <button class="btn gold" data-nav data-act="shop">${img("icon_coin")} DREAM SHOP</button>
      <button class="btn violet" data-nav data-act="settings">⚙ SETTINGS</button>
    </div>
    <div class="title-foot">
      <span class="coins">${img("icon_coin")}<span>${save.data.coins}</span></span>
      ${b.time > 0 ? `<span>BEST ${fmtTime(b.time)} · LV ${b.level} · ${b.kills} KO</span>` : "<span>a dreamy survivors-like</span>"}
    </div>`;
  app.ui.appendChild(el);
  onTap(el.querySelector('[data-act="play"]'), () => {
    app.sfx("uiConfirm");
    app.goSelect();
  });
  onTap(el.querySelector('[data-act="shop"]'), () => {
    app.sfx("uiConfirm");
    app.goShop();
  });
  onTap(el.querySelector('[data-act="settings"]'), () => {
    app.sfx("uiConfirm");
    app.openSettingsModal();
  });
  return { el, layer: layer(el), close: () => closeEl(el) };
}
