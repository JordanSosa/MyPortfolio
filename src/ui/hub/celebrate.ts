/**
 * Full-screen moments shared by the hub and Episode Results:
 *
 *  - `celebrateUnlocks` - "NEW WEAPON UNLOCKED!" cards (rays, sparkles, the
 *    item's art, the unlock hint), one per unlock, tap / OK for the next.
 *  - `bootNotices` - once per session, when the hub first shows its home page:
 *    the "WELCOME TO SEASON 2!" card for a migrated v1 save (old Dream Shop
 *    refund, the 10-pull gift, Rin + Mochi), a notice when an unreadable save
 *    had to be set aside, a celebration for content the boot reconciliation
 *    unlocked, and Plot Points the profile already qualifies for (imported /
 *    migrated saves) as one "claim them in the Wiki" toast.
 *
 * Both are overlays: they push a NavLayer and count for the Back guard.
 */
import type { Rarity } from "../../game/defs";
import { HEROES } from "../../game/heroes";
import { PASSIVES } from "../../game/passives";
import { RELICS, WEAPONS } from "../../game/registry";
import { evaluateAchievements } from "../../meta/achievements/engine";
import type { UnlockEvent } from "../../meta/unlocks";
import { esc, fmtInt, h, hasArt, img, letters } from "../dom";
import { currencyIcon, money, portrait, RARITY_CLS, relicIcon, trophyIcon, twistIcon } from "../kit/art";
import { confirmDialog, trackOverlay, type KitHost } from "../kit/overlay";
import type { NavLayer } from "../nav";
import { save } from "../save";
import { markBorn, onTap, sparkles, tooSoon } from "../screens/common";
import { UNLOCK_TITLE } from "./copy";
import type { Hub } from "./hub";

/** Full-screen "NEW WEAPON UNLOCKED!" cards, one per unlock (tap / OK for the next). `done` runs after the last. */
export function celebrateUnlocks(host: KitHost, list: UnlockEvent[], done?: () => void): void {
  const queue = list.filter((u) => !u.start);
  const next = () => {
    const ev = queue.shift();
    if (!ev) {
      done?.();
      return;
    }
    const el = h("div", "kover unlock-cele");
    el.innerHTML = `
      <div class="rays"></div>
      ${sparkles(24)}
      <div class="uc-card">
        <div class="uc-t">${letters(UNLOCK_TITLE[ev.kind] ?? "NEW UNLOCK!", "ltr", 0.04)}</div>
        <div class="uc-ic">${unlockIcon(ev)}</div>
        <b class="uc-name">${esc(ev.name)}</b>
        ${ev.hint ? `<small class="uc-hint">${esc(ev.hint)}</small>` : ""}
        <small class="uc-narr">${ev.kind === "hero" ? "A new character joins the cast! Ratings are up!" : ev.kind === "stage" ? "A new episode is airing! The network is thrilled!" : "New merchandise has been approved!"}</small>
        <button class="btn gold small" data-nav data-nav-default data-act="ok">${queue.length ? "NEXT ▶" : "AMAZING!"}</button>
      </div>`;
    host.ui.appendChild(el);
    host.sfx("unlockFanfare");
    trackOverlay(1);
    markBorn();
    let closed = false;
    const L: NavLayer = { root: el, focus: null, onBack: () => close() };
    const close = () => {
      if (closed) return;
      closed = true;
      host.nav.remove(L);
      el.classList.add("out");
      el.style.pointerEvents = "none";
      setTimeout(() => el.remove(), 220);
      trackOverlay(-1);
      host.overlayClosed();
      setTimeout(next, 120);
    };
    host.nav.push(L);
    host.overlayOpened();
    onTap(el.querySelector('[data-act="ok"]'), close);
    // tap anywhere for the next card (not the ghost click of the tap that opened it)
    el.addEventListener("click", () => {
      if (!tooSoon()) close();
    });
  };
  next();
}

function unlockIcon(ev: UnlockEvent): string {
  switch (ev.kind) {
    case "hero": {
      const d = HEROES.find((x) => x.id === ev.id);
      return portrait(d?.portrait ?? "", 1, "uc-img");
    }
    case "weapon": {
      const ic = WEAPONS.get(ev.id)?.icon ?? "";
      return hasArt(ic) ? img(ic, "px uc-img") : currencyIcon("coins", true, "uc-img");
    }
    case "passive": {
      const ic = PASSIVES.find((x) => x.id === ev.id)?.icon ?? "";
      return hasArt(ic) ? img(ic, "px uc-img") : trophyIcon("uc-img");
    }
    case "relic": {
      const d = RELICS.get(ev.id);
      const r = (d?.rarity ?? "N") as Rarity;
      return `<span class="relic-t rf r-${RARITY_CLS[r]}">${relicIcon(ev.id, r, "uc-img")}</span>`;
    }
    case "twist":
      return twistIcon(ev.id, "uc-img");
    default:
      return trophyIcon("uc-img");
  }
}

let noticesShown = false;

/** Once per session, at the hub's home page: welcome / recovery / boot unlocks / Plot Points ready. */
export function bootNotices(hub: Hub): void {
  if (noticesShown) return;
  noticesShown = true;
  const app = hub.app;
  const p = save.profile;
  const steps: ((next: () => void) => void)[] = [];

  if (save.origin === "recovered") {
    steps.push((next) => {
      hub.toast("Your save couldn't be read", { kind: "bad", sub: "A copy was kept on this device. This is a fresh profile.", ms: 4200 });
      save.clearCorruptCopy();
      next();
    });
  }
  const mig = save.migration;
  if (mig && !p.flags.s2Welcome) {
    steps.push((next) => {
      const names = mig.heroes.map((id) => HEROES.find((d) => d.id === id)?.name ?? id);
      const body = `<div class="welcome">
          <p>The show got renewed! Your old Dream Shop upgrades became the new <b>Training Arc</b>, and we refunded every coin you spent on them.</p>
          <div class="wl-rows">
            ${mig.refund > 0 ? `<span class="wl-row">${money("coins", `+${fmtInt(mig.refund)}`)}<small>Dream Shop refund</small></span>` : ""}
            ${mig.gift > 0 ? `<span class="wl-row">${money("gems", `+${fmtInt(mig.gift)}`)}<small>a free 10-pull (it's not premium currency)</small></span>` : ""}
            ${names.length ? `<span class="wl-row"><b class="wl-cast">${names.map(esc).join(" + ")}</b><small>join${names.length === 1 ? "s" : ""} the cast</small></span>` : ""}
          </div>
        </div>`;
      p.flags.s2Welcome = 1;
      save.save();
      app.sfx("unlockFanfare");
      void confirmDialog(app, { title: "WELCOME TO SEASON 2!", body, ok: "MERCH MACHINE!", okCls: "gold", cancel: "Later" }).then((go) => {
        if (go) hub.open("gacha", { tab: "permanent" });
        next();
      });
    });
  }
  const unlocks = save.bootUnlocks.filter((u) => !u.start);
  if (unlocks.length) {
    steps.push((next) => {
      save.bootUnlocks = [];
      celebrateUnlocks(app, unlocks, next);
    });
  }
  steps.push((next) => {
    // a migrated / imported profile can already qualify for Plot Points: mark them, point at the Wiki
    const done = evaluateAchievements(p, null);
    if (done.length) {
      save.save();
      app.sfx("achievement", 0.8);
      hub.toast(done.length === 1 ? done[0].def.name : `${done.length} Plot Points unlocked!`, { kind: "ach", kicker: "PLOT POINT!", icon: trophyIcon("kt-img"), sub: "Claim the rewards in the Wiki.", ms: 3800 });
      hub.top?.show?.();
    }
    next();
  });
  const run = () => {
    const s = steps.shift();
    if (s) s(run);
  };
  // after the hub's slide-in (and the splash fade)
  setTimeout(run, 450);
}
