/**
 * Full-screen moments shared by the hub and Episode Results:
 *
 *  - `celebrateUnlocks` - "NEW WEAPON UNLOCKED!" cards (satire.md §8 titles):
 *    a burst flash, spinning rays, confetti, the item's art popping out of a
 *    glow with a shine sweep, the title stamped in word by word (never broken
 *    mid-word), the name, the unlock hint and the narrator's line for that
 *    kind (a twist card shows its effect). A kind unlocked 3+ times at once is
 *    ONE card ("6 NEW PLOT TWISTS!": icon grid + a line per item) and a
 *    sequence is at most 4 cards (the last sums up the rest); tap / OK / Back
 *    for the next.
 *  - `homeNotices` / `bootNotices` - when the hub's home page shows: once per
 *    session (again after START OVER / IMPORT, `resetBootNotices`) a notice
 *    when an unreadable save had to be set aside (the damaged copy stays), the
 *    "WELCOME TO SEASON 2!" card for a first v1 migration (old Dream Shop
 *    refund, the 10-pull gift, Rin + Mochi), "Episode N was interrupted" for a
 *    run banked at boot, one celebration for content the boot reconciliation
 *    unlocked plus unlocks still queued (`save.pendingUnlocks`: a TBC RETRY
 *    skipped their Results), and Plot Points the profile already qualifies
 *    for as one "claim them in the Wiki" toast. Later home visits celebrate
 *    whatever got queued since.
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
import { RELICS, TWISTS, WEAPONS } from "../../game/registry";
import { evaluateAchievements } from "../../meta/achievements/engine";
import type { UnlockEvent } from "../../meta/unlocks";
import { esc, fmtInt, h, hasArt, img } from "../dom";
import { currencyIcon, money, portrait, RARITY_CLS, relicIcon, trophyIcon, twistIcon, type CurrencyId } from "../kit/art";
import { confirmDialog, trackOverlay, type KitHost } from "../kit/overlay";
import { reducedMotion } from "../kit/ticker";
import type { NavLayer } from "../nav";
import { save } from "../save";
import { markBorn, onTap, sparkles, tooSoon } from "../screens/common";
import { unlockGroupTitle, unlockNarration, UNLOCK_TITLE } from "./copy";
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

/** At most this many celebration cards in a row: the last one sums up the rest. */
const MAX_CARDS = 4;
/** One kind 3+ times in a list: one card for all of them ("6 NEW PLOT TWISTS!"). */
const GROUP_AT = 3;
/** Rows listed on a group / summary card (the Wiki has the rest). */
const MAX_ROWS = 8;

/** One celebration card: a single unlock, every unlock of one kind, or the summary of the rest ("mixed"). */
export interface UnlockCard {
  kind: UnlockEvent["kind"] | "mixed";
  items: UnlockEvent[];
}

/**
 * The cards for an unlock list (start content dropped): a kind that appears GROUP_AT+ times becomes one
 * card at its first appearance; at most MAX_CARDS cards, the last one listing whatever is left.
 */
export function unlockCards(list: readonly UnlockEvent[]): UnlockCard[] {
  const queue = list.filter((u) => !u.start);
  const count = new Map<string, number>();
  for (const u of queue) count.set(u.kind, (count.get(u.kind) ?? 0) + 1);
  const cards: UnlockCard[] = [];
  const grouped = new Map<string, UnlockCard>();
  for (const u of queue) {
    if ((count.get(u.kind) ?? 0) >= GROUP_AT) {
      const g = grouped.get(u.kind);
      if (g) g.items.push(u);
      else {
        const c: UnlockCard = { kind: u.kind, items: [u] };
        grouped.set(u.kind, c);
        cards.push(c);
      }
    } else cards.push({ kind: u.kind, items: [u] });
  }
  if (cards.length <= MAX_CARDS) return cards;
  const rest = cards.splice(MAX_CARDS - 1);
  cards.push({ kind: "mixed", items: rest.flatMap((c) => c.items) });
  return cards;
}

/** The short line under an unlock: a twist's rank-1 effect, else its unlock hint. */
function unlockLine(ev: UnlockEvent): string {
  if (ev.kind === "twist") {
    const d = TWISTS.get(ev.id);
    if (d) {
      try {
        // ("Budget Cuts I: enemy HP +25%" -> "enemy HP +25%": the card already names it)
        const text = d.desc(1);
        const i = text.indexOf(": ");
        return i > 0 && text.slice(0, i).toLowerCase().startsWith(ev.name.toLowerCase()) ? text.slice(i + 2) : text;
      } catch {
        /* fall back to the hint */
      }
    }
  }
  return ev.hint;
}

/**
 * Full-screen "NEW WEAPON UNLOCKED!" cards (see unlockCards: at most four taps, one kind 3+ times = one
 * group card). Tap / OK / Back for the next; `done` runs after the last.
 */
export function celebrateUnlocks(host: KitHost, list: UnlockEvent[], done?: () => void): void {
  const cards = unlockCards(list);
  const total = cards.length;
  let idx = 0;
  const next = () => {
    const card = cards[idx++];
    if (!card) {
      done?.();
      return;
    }
    const last = idx >= total;
    const single = card.kind !== "mixed" && card.items.length === 1;
    const ev = card.items[0];
    let title: string;
    let body: string;
    if (single) {
      title = ev.kind === "passive" ? `NEW PASSIVE: ${ev.name}!` : (UNLOCK_TITLE[ev.kind] ?? "NEW UNLOCK!");
      const line = unlockLine(ev);
      body = `
        <div class="uc-ic"><i class="uc-glow" aria-hidden="true"></i>${unlockIcon(ev)}<i class="uc-shine" aria-hidden="true"></i></div>
        ${ev.kind === "passive" ? "" : `<b class="uc-name">${esc(ev.name)}</b>`}
        ${ev.kind === "twist" && line ? `<small class="uc-fx">${esc(line)}</small>` : ""}
        ${ev.hint ? `<small class="uc-hint">✓ ${esc(ev.hint)}</small>` : ""}`;
    } else {
      title = unlockGroupTitle(card.kind, card.items.length);
      const rows = card.items.slice(0, MAX_ROWS);
      const more = card.items.length - rows.length;
      body = `
        <div class="uc-grid" aria-hidden="true">${card.items
          .slice(0, 12)
          .map((u, i) => `<span class="uc-gi" style="--i:${i}">${unlockIcon(u)}</span>`)
          .join("")}</div>
        <ul class="uc-list kscroll">${rows
          .map((u, i) => {
            const l = unlockLine(u);
            return `<li style="--i:${i}"><b>${esc(card.kind === "mixed" ? `${KIND_LABEL[u.kind] ?? "NEW"}: ${u.name}` : u.name)}</b>${l ? `<small>${esc(l)}</small>` : ""}</li>`;
          })
          .join("")}${more > 0 ? `<li class="uc-more"><small>+${more} more in the Wiki</small></li>` : ""}</ul>`;
    }
    const narr = unlockNarration(card.kind, ev.kind);
    const el = h("div", `kover unlock-cele k-${card.kind}${single ? "" : " uc-group"}`);
    el.innerHTML = `
      <i class="uc-flash" aria-hidden="true"></i>
      <div class="rays"></div>
      ${sparkles(18)}
      ${confetti(36)}
      <div class="uc-card" role="alertdialog" aria-label="${esc(title)} ${esc(card.items.map((u) => u.name).join(", "))}">
        ${total > 1 ? `<small class="uc-count">${idx} / ${total}</small>` : ""}
        <div class="uc-t">${wordLetters(title, "ltr", 0.035, 0.15)}</div>
        ${body}
        <small class="uc-narr">${esc(narr)}</small>
        <button class="btn gold small" data-nav data-nav-default data-act="ok">${last ? "AMAZING!" : "NEXT ▶"}</button>
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
    // tap anywhere for the next card (not the ghost click of the tap that opened it; a scroll of the list is no tap)
    el.addEventListener("click", () => {
      if (!tooSoon()) close();
    });
  };
  next();
}

/** "TWIST" / "WEAPON" ... (summary card rows). */
const KIND_LABEL: Readonly<Record<string, string>> = { hero: "HERO", weapon: "WEAPON", passive: "PASSIVE", stage: "EPISODE", twist: "TWIST", relic: "MERCH" };

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

// ---------------------------------------------------------------- boot notices + queued celebrations
let noticesShown = false;
/** A boot-notice sequence or a queued celebration is on screen (one at a time). */
let busy = false;

/** The profile was replaced (Settings START OVER / IMPORT): the next home visit runs the boot notices again. */
export function resetBootNotices(): void {
  noticesShown = false;
}

/**
 * The hub's home page is showing: the boot notices once per session (or profile), afterwards the unlocks
 * still waiting to be celebrated (a TBC RETRY skipped their Episode Results).
 */
export function homeNotices(hub: Hub): void {
  if (!noticesShown) {
    bootNotices(hub);
    return;
  }
  if (busy || !save.pendingUnlocks.some((u) => !u.start)) return;
  busy = true;
  // after the page's slide-in
  setTimeout(() => {
    const app = hub.app;
    if (app.screen !== "hub" || app.hub !== hub || hub.top?.id !== "home") {
      busy = false;
      return;
    }
    celebrateUnlocks(app, save.takePendingUnlocks(), () => {
      busy = false;
      hub.top?.show?.();
    });
  }, 380);
}

/**
 * "Episode N was interrupted": a run the last session never finished was banked at boot (src/ui/save.ts).
 * Shown once, on whatever hub page comes first (a deep link may open the hub away from home).
 */
export function interruptedNotice(hub: Hub): void {
  const r = save.interrupted;
  if (!r) return;
  save.interrupted = null;
  hub.app.sfx("cassetteEject", 0.7);
  hub.toast(`Episode ${fmtInt(r.episode)} was interrupted.`, {
    kind: "info",
    kicker: r.outcome === "death" ? "BANKED AS TO BE CONTINUED" : "BANKED AS DROPPED",
    sub: "The network aired what was filmed. (The rest is on the cutting room floor.)",
    reward: `${money("coins", `+${fmtInt(r.coins.total)}`)}${r.gems.total ? money("gems", `+${fmtInt(r.gems.total)}`) : ""}`,
    ms: 5200,
  });
  hub.cbar.sync(save.profile.currencies, true);
  hub.top?.show?.();
}

/** Once per session (and after a profile change), at the hub's home page: welcome / recovery / interrupted run / unlocks / Plot Points ready. */
export function bootNotices(hub: Hub): void {
  if (noticesShown || busy) return;
  noticesShown = true;
  busy = true;
  const app = hub.app;
  const p = save.profile;
  const steps: ((next: () => void) => void)[] = [];

  if (save.origin === "recovered") {
    steps.push((next) => {
      // the damaged copy stays on this device (Settings -> SAVE DATA can copy or discard it)
      hub.toast("Your save couldn't be read", {
        kind: "bad",
        sub: save.recoveredFromV1 ? "The damaged copy is kept on this device. Your Season 1 save was loaded instead." : "The damaged copy is kept on this device. This is a fresh profile.",
        ms: 5200,
      });
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
  // a run the last session never finished (reload, the OS closed the tab): banked as DROPPED at boot
  steps.push((next) => {
    interruptedNotice(hub);
    next();
  });
  steps.push((next) => {
    // boot reconciliation + runs whose Episode Results never showed (TBC RETRY, the interrupted run)
    const unlocks = [...save.bootUnlocks.filter((u) => !u.start), ...save.takePendingUnlocks().filter((u) => !u.start)];
    save.bootUnlocks = [];
    if (!unlocks.length) {
      next();
      return;
    }
    celebrateUnlocks(app, unlocks, () => {
      hub.top?.show?.();
      next();
    });
  });
  steps.push((next) => {
    // a migrated / imported profile can already qualify for Plot Points: mark them, point at the Wiki
    const done = evaluateAchievements(save.profile, null);
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
    if (app.screen !== "hub" || app.hub !== hub) {
      noticesShown = false;
      busy = false;
      return;
    }
    const s = steps.shift();
    if (s) s(run);
    else busy = false;
  };
  // after the hub's slide-in (and the splash fade)
  setTimeout(run, 450);
}
