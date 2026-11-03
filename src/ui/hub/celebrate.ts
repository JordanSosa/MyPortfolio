/**
 * Full-screen moments shared by the hub and Episode Results:
 *
 *  - `celebrateUnlocks` - "NEW WEAPON UNLOCKED!" cards (satire.md §8 titles):
 *    a burst flash, spinning rays, confetti, the item's art popping out of a
 *    glow with a shine sweep, the title stamped in word by word (never broken
 *    mid-word), the name, the unlock hint and the narrator's line; one card
 *    per unlock, tap / OK for the next.
 *  - `bootNotices` - once per session, when the hub first shows its home page:
 *    the "WELCOME TO SEASON 2!" card for a migrated v1 save (old Dream Shop
 *    refund, the 10-pull gift, Rin + Mochi), a notice when an unreadable save
 *    had to be set aside, a celebration for content the boot reconciliation
 *    unlocked, and Plot Points the profile already qualifies for (imported /
 *    migrated saves) as one "claim them in the Wiki" toast.
 *  - `flyCurrency` - reward icons arcing from a chip into the currency bar pill
 *    (Plot Point claims, the results payout), `wordLetters` (letter spans
 *    grouped per word) and `confetti` (CSS-only pieces).
 *
 * The overlays push a NavLayer and count for the Back guard. Animation is
 * transform / opacity only; reduced motion skips the flights and the confetti.
 */
import type { Rarity } from "../../game/defs";
import { HEROES } from "../../game/heroes";
import { PASSIVES } from "../../game/passives";
import { RELICS, WEAPONS } from "../../game/registry";
import { evaluateAchievements } from "../../meta/achievements/engine";
import type { UnlockEvent } from "../../meta/unlocks";
import { esc, fmtInt, h, hasArt, img } from "../dom";
import { currencyIcon, money, portrait, RARITY_CLS, relicIcon, trophyIcon, twistIcon, type CurrencyId } from "../kit/art";
import { confirmDialog, trackOverlay, type KitHost } from "../kit/overlay";
import { reducedMotion } from "../kit/ticker";
import type { NavLayer } from "../nav";
import { save } from "../save";
import { markBorn, onTap, sparkles, tooSoon } from "../screens/common";
import { narratorLine, UNLOCK_TITLE } from "./copy";
import type { Hub } from "./hub";
import "./celebrate.css";

/** Per-letter spans grouped per word (a title wraps between words, never inside one). */
export function wordLetters(text: string, cls = "ltr", step = 0.05, delay = 0): string {
  let i = 0;
  return text
    .split(" ")
    .map((w) => `<span class="ww">${[...w].map((ch) => `<span class="${cls}" style="--i:${i};--d:${(delay + i++ * step).toFixed(2)}s">${esc(ch)}</span>`).join("")}</span>`)
    .join(" ");
}

const CONFETTI = ["#ff7ab8", "#ffe14d", "#4fe6df", "#b47cff", "#94e85e", "#ffffff", "#ff9a3d"];

/** CSS confetti pieces (transform / opacity keyframes in celebrate.css). */
export function confetti(n: number, cls = ""): string {
  if (reducedMotion()) return "";
  let s = `<div class="kconf ${cls}" aria-hidden="true">`;
  for (let i = 0; i < n; i++) {
    const x = (Math.random() * 100).toFixed(1);
    const dx = ((Math.random() - 0.5) * 30).toFixed(1);
    const r = Math.round((Math.random() - 0.5) * 1440);
    const d = (Math.random() * 0.9).toFixed(2);
    const t = (1.6 + Math.random() * 1.4).toFixed(2);
    const c = CONFETTI[i % CONFETTI.length];
    s += `<i style="left:${x}%;--dx:${dx}vw;--r:${r}deg;--c:${c};animation-delay:${d}s;animation-duration:${t}s"${i % 3 === 0 ? ' class="o"' : ""}></i>`;
  }
  return s + "</div>";
}

/**
 * Reward icons arcing from `from` into `to` (a currency pill). `onLand` runs when the first one arrives
 * (bump the pill / count up). Fixed-position clones in `parent`, WAAPI transform + opacity, removed at the end.
 */
export function flyCurrency(parent: HTMLElement, from: Element | null, to: Element | null, cur: CurrencyId, n = 6, onLand?: () => void): void {
  if (!from || !to || reducedMotion() || typeof (from as HTMLElement).animate !== "function") {
    onLand?.();
    return;
  }
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (!a.width || !b.width) {
    onLand?.();
    return;
  }
  const x0 = a.left + a.width / 2;
  const y0 = a.top + a.height / 2;
  const x1 = b.left + Math.min(b.width, b.height) / 2 + 4;
  const y1 = b.top + b.height / 2;
  let landed = false;
  for (let i = 0; i < n; i++) {
    const el = h("span", "kfly", currencyIcon(cur, true, "kfly-ic"));
    el.style.left = `${x0}px`;
    el.style.top = `${y0}px`;
    parent.appendChild(el);
    const sx = (Math.random() - 0.5) * 70;
    const sy = -30 - Math.random() * 50;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const anim = el.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.4)", opacity: 0 },
        { transform: `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px)) scale(1.15)`, opacity: 1, offset: 0.3 },
        { transform: `translate(calc(-50% + ${dx * 0.6 + sx * 0.3}px), calc(-50% + ${dy * 0.5 + sy}px)) scale(0.95)`, opacity: 1, offset: 0.62 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.55)`, opacity: 0.2 },
      ],
      { duration: 620 + i * 25, delay: i * 55, easing: "cubic-bezier(0.45, 0, 0.6, 1)", fill: "both" },
    );
    anim.onfinish = () => {
      el.remove();
      if (!landed) {
        landed = true;
        onLand?.();
      }
    };
  }
}

/** Full-screen "NEW WEAPON UNLOCKED!" cards, one per unlock (tap / OK for the next). `done` runs after the last. */
export function celebrateUnlocks(host: KitHost, list: UnlockEvent[], done?: () => void): void {
  const queue = list.filter((u) => !u.start);
  const total = queue.length;
  const next = () => {
    const ev = queue.shift();
    if (!ev) {
      done?.();
      return;
    }
    const idx = total - queue.length;
    const title = ev.kind === "passive" ? `NEW PASSIVE: ${ev.name}!` : (UNLOCK_TITLE[ev.kind] ?? "NEW UNLOCK!");
    const narr = ev.kind === "passive" ? "(It's an accessory.)" : ev.kind === "hero" ? "A new character joins the cast! Ratings are up!" : ev.kind === "stage" ? "A new episode is airing! The network is thrilled!" : narratorLine("unlock", {}) || "New merchandise has been approved!";
    const el = h("div", `kover unlock-cele k-${ev.kind}`);
    el.innerHTML = `
      <i class="uc-flash" aria-hidden="true"></i>
      <div class="rays"></div>
      ${sparkles(18)}
      ${confetti(36)}
      <div class="uc-card" role="alertdialog" aria-label="${esc(title)} ${esc(ev.name)}">
        ${total > 1 ? `<small class="uc-count">${idx} / ${total}</small>` : ""}
        <div class="uc-t">${wordLetters(title, "ltr", 0.035, 0.15)}</div>
        <div class="uc-ic"><i class="uc-glow" aria-hidden="true"></i>${unlockIcon(ev)}<i class="uc-shine" aria-hidden="true"></i></div>
        ${ev.kind === "passive" ? "" : `<b class="uc-name">${esc(ev.name)}</b>`}
        ${ev.hint ? `<small class="uc-hint">✓ ${esc(ev.hint)}</small>` : ""}
        <small class="uc-narr">${esc(narr)}</small>
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
    // (a run started from the hub before the notices finished: the rest waits for the next hub visit)
    if (app.screen !== "hub") {
      noticesShown = false;
      return;
    }
    const s = steps.shift();
    if (s) s(run);
  };
  // after the hub's slide-in (and the splash fade)
  setTimeout(run, 450);
}
