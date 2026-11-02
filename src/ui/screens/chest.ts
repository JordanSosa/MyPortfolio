/**
 * Chest opening (DESIGN §2.4): the chest shakes, light beams leak out, the
 * lid bursts, then a slot reel per reward spins and lands (1 / golden 3 /
 * JACKPOT 5). Rewards are applied by world.openChest() when the lid bursts.
 * Tap / confirm skips the spin; continue needs a fresh touch.
 */
import { PASSIVES } from "../../game/passives";
import { WEAPONS } from "../../game/registry";
import type { ChestResult } from "../../game/types";
import type { World } from "../../game/world";
import type { App, UiScreen } from "../app";
import { esc, h, sprite } from "../dom";
import { layer } from "./common";

const CELL_EM = 6.4;

export function openChestModal(app: App, w: World): UiScreen {
  const golden = w.pendingChests[0]?.golden ?? false;
  const el = h("div", "modal chest-modal");
  el.innerHTML = `
    <div class="rays"></div>
    <div class="lu-title" style="color:${golden ? "var(--yellow)" : "var(--pinkl)"}">${golden ? "GOLDEN CHEST!" : "TREASURE!"}</div>
    <div class="chest-stage shake${golden ? " golden" : ""}">
      <div class="beams"></div>
      <div class="ch"><img class="px" alt="" src="${sprite("chest", 0, 6)}"></div>
      <div class="boom"></div>
    </div>
    <div class="jp"></div>
    <div class="reels"></div>
    <div class="cont">TAP TO CONTINUE</div>`;
  app.ui.appendChild(el);
  const stage = el.querySelector(".chest-stage") as HTMLElement;
  const chImg = el.querySelector(".ch img") as HTMLImageElement;
  const reels = el.querySelector(".reels") as HTMLElement;
  const cont = el.querySelector(".cont") as HTMLElement;
  const jp = el.querySelector(".jp") as HTMLElement;
  let t = 0;
  let phase = 0; // 0 shaking, 1 spinning, 2 done
  let res: ChestResult | null = null;
  let landAt: number[] = [];
  let landed = 0;
  let tickT = 0;
  let closed = false;
  app.sfx("chestOpen");

  const pool: string[] = [];
  for (const wd of WEAPONS.values()) pool.push(wd.icon);
  for (const p of PASSIVES) pool.push(p.icon);

  const burst = () => {
    phase = 1;
    stage.classList.remove("shake", "leak");
    stage.classList.add("open");
    chImg.src = sprite("chest", 2, 6);
    app.fx.juice.flash(0xffffff, 0.35, 0.3);
    app.sfx(golden ? "chestJackpot" : "explosion", 0.8);
    res = w.openChest();
    const rewards = res?.rewards ?? [];
    if (res?.jackpot) {
      jp.innerHTML = `<div class="jackpot">JACKPOT!</div>`;
      app.sfx("chestJackpot");
    }
    reels.innerHTML = rewards
      .map((r, i) => {
        const n = 14 + i * 5;
        let strip = "";
        for (let k = 0; k < n; k++) strip += `<img class="px" alt="" src="${sprite(pool[(Math.random() * pool.length) | 0] ?? r.icon, 0, 3)}">`;
        strip += `<img class="px" alt="" src="${sprite(r.icon, 0, 3)}">`;
        const lvl = r.kind === "evolution" ? "EVOLUTION!" : r.from === 0 ? "NEW!" : r.kind === "weapon" || r.kind === "passive" ? `Lv ${r.from} → ${r.to}` : "";
        return `<div class="reel" style="--i:${i}"><div class="win"><div class="strip" data-n="${n}">${strip}</div></div><div class="rn">${esc(r.name)}<small>${lvl}</small></div></div>`;
      })
      .join("");
    landAt = rewards.map((_, i) => 1.1 + i * 0.35);
    // start the spins on the next frame so the transition runs
    requestAnimationFrame(() => {
      reels.querySelectorAll<HTMLElement>(".reel").forEach((rl, i) => {
        const strip = rl.querySelector(".strip") as HTMLElement;
        const n = Number(strip.dataset.n);
        strip.style.transition = `transform ${landAt[i]}s cubic-bezier(0.15, 0.6, 0.25, 1)`;
        strip.style.transform = `translateY(-${n * CELL_EM}em)`;
      });
    });
    t = 0;
  };

  const finishSpin = () => {
    reels.querySelectorAll<HTMLElement>(".reel").forEach((rl) => {
      const strip = rl.querySelector(".strip") as HTMLElement;
      strip.style.transition = "none";
      strip.style.transform = `translateY(-${Number(strip.dataset.n) * CELL_EM}em)`;
      rl.classList.add("landed");
    });
    landed = landAt.length;
    phase = 2;
    cont.classList.add("on");
    if (res && res.coins > 0) app.toast(`+${res.coins} coins`);
  };

  const proceed = () => {
    if (closed) return;
    if (phase === 0) return;
    if (phase === 1) {
      finishSpin();
      app.sfx("cardPick");
      return;
    }
    closed = true;
    app.sfx("uiConfirm");
    app.closeModal();
  };

  el.addEventListener("click", (e) => {
    e.stopPropagation();
    const pointer = (e as MouseEvent).detail > 0;
    if (pointer && !app.input.isFresh(e)) return;
    if (t < 0.3) return;
    proceed();
  });

  return {
    el,
    layer: layer(el),
    close() {
      el.classList.add("out");
      setTimeout(() => el.remove(), 220);
    },
    update(dt) {
      t += dt;
      if (phase >= 1 && t > 0.3 && (app.input.pressed("confirm") || app.input.pressed("dash"))) {
        proceed();
        return;
      }
      if (phase === 0) {
        if (t > 0.5 && !stage.classList.contains("leak")) {
          stage.classList.add("leak");
          chImg.src = sprite("chest", 1, 6);
          app.sfx("chestReel", 0.6);
        }
        if (t > 1.15) burst();
        return;
      }
      if (phase === 1) {
        tickT -= dt;
        if (tickT <= 0) {
          tickT = 0.07 + t * 0.06;
          app.sfx("chestReel", 0.45, Math.min(8, t * 4));
        }
        const rl = reels.querySelectorAll<HTMLElement>(".reel");
        while (landed < landAt.length && t >= landAt[landed]) {
          rl[landed]?.classList.add("landed");
          app.sfx(res?.rewards[landed]?.kind === "evolution" ? "evolve" : "cardPick");
          landed++;
        }
        if (landed >= landAt.length && t > (landAt[landAt.length - 1] ?? 0) + 0.25) finishSpin();
        return;
      }
      if (app.params.autoplay && t > (landAt[landAt.length - 1] ?? 0) + 1.2) proceed();
    },
  };
}
