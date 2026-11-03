/**
 * EPISODE RESULTS (docs/EXPANSION.md §4, docs/content/satire.md §3-4, §9):
 *
 *   1. "EPISODE N" title card + the episode title; TO BE CONTINUED -> (death),
 *      SERIES FINALE?! (clear; "RENEWED FOR SEASON 2!!" on the final stage),
 *      DROPPED AFTER EPISODE N (quit); the hero portrait and the grade stamp +
 *      a grade comment; the run's numbers with NEW BEST tags.
 *   2. The payout ticks up line by line (coins: picked up, time, kills, each
 *      boss, clear, filler, then the rank / heat / curse / stage multipliers;
 *      gems: stipend, first clears, first boss kills, heat badges, wiki finds),
 *      the currency bar counts to the new balances.
 *   3. Hero XP fills with LEVEL UP! pops, weapon mastery bars (LIMIT BREAK! /
 *      MASTERED).
 *   4. Plot Point cards (CLAIM ALL), records, then a full-screen celebration per
 *      new unlock ("NEW WEAPON UNLOCKED!").
 *   5. The narrator: "Next time on Kira Kira Overdrive: ...".
 *   6. UPGRADE (straight to the Training Arc, affordable nodes pulsing) /
 *      RETRY / HUB - always on screen; tapping anywhere else skips the show.
 *
 * Beats run on frame time from update() (headless screenshots crawl but stay
 * in order); counters write text only when the shown integer changes.
 */
import { HEROES, heroDef } from "../../game/heroes";
import { PASSIVES } from "../../game/passives";
import type { Rarity } from "../../game/defs";
import { RELICS, WEAPONS } from "../../game/registry";
import type { RunSummary } from "../../game/world";
import { claimAllAchievements } from "../../meta/achievements/engine";
import type { PayoutLine } from "../../meta/economy";
import { gameContent } from "../../meta/content";
import type { RunReport } from "../../meta/rewards";
import type { UnlockEvent } from "../../meta/unlocks";
import type { App, EpisodeInfo, UiScreen } from "../app";
import { esc, fmtInt, fmtNum, fmtTime, h, hasArt, img, letters } from "../dom";
import { CurrencyBar } from "../kit/currency";
import { badge, btn, pbar, pop, setBar, tag } from "../kit/controls";
import { currencyIcon, money, portrait, RARITY_CLS, relicIcon, trophyIcon, twistIcon } from "../kit/art";
import { trackOverlay } from "../kit/overlay";
import { reducedMotion } from "../kit/ticker";
import type { NavLayer } from "../nav";
import { save } from "../save";
import { gradeComment, nextTimeLine, UNLOCK_TITLE } from "../hub/copy";
import { tbcBanner } from "../stinger";
import { layer, markBorn, onTap, sparkles } from "./common";

interface Counter {
  el: HTMLElement;
  from: number;
  to: number;
  t: number;
  dur: number;
  fmt: (v: number) => string;
}

const LINE_GAP = 0.3;

export function showResults(app: App, s: RunSummary, r: RunReport, ep: EpisodeInfo): UiScreen {
  const hd = heroDef(s.hero);
  const ctx = gameContent();
  const clear = r.outcome === "clear";
  const quit = r.outcome === "quit";
  const finalStage = ctx.stages.length > 0 && r.stage === ctx.stages[ctx.stages.length - 1].id && ctx.stages.length >= 5;
  const el = h("div", `scr results ep-res ${clear ? "won" : quit ? "quit" : "lost"}`);
  const cbar = new CurrencyBar();
  const c0 = { coins: r.balances.coins - r.coins.total, gems: r.balances.gems - r.gems.total, copium: r.balances.copium };
  cbar.set(c0);

  const stinger = clear
    ? `<div class="er-finale">${letters(finalStage ? "RENEWED FOR SEASON 2!!" : "SERIES FINALE?!", "ltr", 0.05)}${r.endless && s.stats?.endlessTime ? `<small>(the filler continued for ${fmtTime(s.stats.endlessTime)})</small>` : ""}</div>`
    : quit
      ? `<div class="er-dropped">DROPPED AFTER EPISODE ${fmtInt(r.episode)}</div>`
      : tbcBanner();
  const nb = (on: boolean) => (on ? tag("NEW BEST!", "red") : "");
  const stat = (k: string, v: string, best: boolean, i: number) => `<div class="er-stat" style="--i:${i}"><small>${k}</small><b>${v}</b>${nb(best)}</div>`;
  const line = (l: PayoutLine, cur: "coins" | "gems", i: number) =>
    `<div class="pl${l.mul ? " mul" : ""}" data-i="${i}" data-c="${cur}"><span class="pl-l"><b>${esc(l.label)}</b>${l.detail ? `<small>${esc(l.detail)}</small>` : ""}</span>${l.mul ? `<span class="pl-m">×${l.mul.toFixed(2)}</span>` : ""}<span class="pl-v" data-to="${l.amount}">+0</span></div>`;
  const xp = r.heroXp;
  const mastery = r.mastery.slice(0, 4);
  const wd = (id: string) => WEAPONS.get(id);
  const recChips: string[] = [];
  if (r.records.firstClear) recChips.push(tag("FIRST CLEAR!", "rainbow"));
  for (const b of r.records.heatBadges) recChips.push(tag(`HEAT ${b} BADGE`, "pink"));
  for (const b of r.firstBossKills) recChips.push(tag(`FIRST KILL: ${ctx.bosses.get(b)?.name ?? b}`, "gold"));
  if (r.records.newBestHeat) recChips.push(tag(`BEST HEAT ${r.heat}`, "pink"));
  if (r.records.newBestEndless) recChips.push(tag("FILLER ARC RECORD", "cyan"));
  if (r.codex.length) recChips.push(tag(`${r.codex.length} WIKI FIND${r.codex.length === 1 ? "" : "S"}`, "cyan"));
  const rot = r.banner.rotated ? tag("NEW BANNERS IN THE MERCH MACHINE!", "rainbow") : r.banner.featuredHero || r.banner.featuredRelic ? tag(`BANNER ENDS IN ${r.banner.runsLeft} RUN${r.banner.runsLeft === 1 ? "" : "S"}!!`, "pink") : "";
  if (rot) recChips.push(rot);
  const afford = r.affordable;
  const affordText = [afford.boardNodes > 0 ? `${afford.boardNodes} board node${afford.boardNodes === 1 ? "" : "s"}` : "", afford.tenPull ? "a 10-pull" : afford.singlePull ? "a pull" : ""].filter(Boolean).join(" · ");
  const maxD = Math.max(1, ...s.weapons.map((x) => x.damage));

  el.innerHTML = `
    ${sparkles(clear ? 22 : 8)}
    <div class="er-top"></div>
    <div class="er-scroll kscroll">
      <div class="er-main">
        <header class="er-head">
          <div class="er-ep"><small>${esc(r.stageName.toUpperCase())}${r.heat ? ` · HEAT ${r.heat}` : ""}</small><b>EPISODE ${fmtInt(r.episode)}</b><span class="er-title">“${esc(ep.title)}”</span></div>
          <div class="er-sting">${stinger}</div>
          <div class="er-hero">
            <div class="por${clear ? " won" : " lost"}" style="--hc:${app.heroColor(hd.id)}">${portrait(hd.portrait, clear ? 1 : 0, "pimg")}${clear ? "" : '<i class="sweat"></i>'}</div>
            <div class="er-grade"><div class="grade ${r.grade}">${r.grade}${r.grade === "S" || r.grade === "SS" || r.grade === "A" ? '<i class="burst"></i>' : ""}</div><small class="er-gc">${esc(gradeComment(r.grade))}</small></div>
          </div>
          <div class="er-stats">
            ${stat("TIME", fmtTime(r.time), r.records.newBestTime, 0)}
            ${stat("KILLS", fmtNum(r.kills), r.records.newBestKills, 1)}
            ${stat("LEVEL", String(s.level), r.records.newBestLevel, 2)}
            ${stat("COMBO", fmtNum(s.maxCombo), r.records.newBestCombo, 3)}
          </div>
        </header>
        <section class="er-pay">
          <div class="pay-col c-coins"><div class="pay-h">${currencyIcon("coins", true, "pico")}<b>STAR COINS</b></div>${r.coins.lines.map((l, i) => line(l, "coins", i)).join("")}<div class="pay-tot" data-to="${r.coins.total}"><span>TOTAL</span><b>+0</b></div></div>
          <div class="pay-col c-gems"><div class="pay-h">${currencyIcon("gems", true, "pico")}<b>DREAM GEMS</b></div>${r.gems.lines.map((l, i) => line(l, "gems", i)).join("")}<div class="pay-tot" data-to="${r.gems.total}"><span>TOTAL</span><b>+0</b></div></div>
        </section>
      </div>
      <div class="er-side">
        <section class="er-xp">
          <div class="xp-row" style="--hc:${app.heroColor(hd.id)}">${portrait(hd.portrait, 0, "xp-por")}<span class="xp-tx"><b>${esc(r.heroName)} <span class="xp-lv">LV ${xp.before.level}</span></b>${pbar(xp.before.maxed ? 1 : xp.before.into / xp.before.need, `+${fmtInt(xp.gained)} XP`, "gold")}</span><span class="xp-pop"></span></div>
          ${mastery
            .map(
              (m, i) => `<div class="ms-row" data-i="${i}">${hasArt(wd(m.weapon)?.icon ?? "") ? img(wd(m.weapon)?.icon ?? "", "px ms-ic") : `<i class="ms-ic"></i>`}<span class="xp-tx"><b>${esc(m.name)} <span class="ms-rk">M${m.rankBefore}${m.rankAfter > m.rankBefore ? ` → M${m.rankAfter}` : ""}</span></b>${pbar(0, `+${fmtInt(m.gained)}`, m.rankAfter >= 10 ? "rainbow" : "cyan")}</span><span class="ms-tag">${m.mastered ? tag("MASTERED!", "gold") : m.limitBreak ? tag("LIMIT BREAK!", "rainbow") : m.rankAfter > m.rankBefore ? tag("RANK UP!", "pink") : ""}</span></div>`,
            )
            .join("")}
        </section>
        ${
          r.achievements.length
            ? `<section class="er-ach"><div class="er-sec">PLOT POINTS UNLOCKED</div>${r.achievements
                .map((a, i) => {
                  const rw = a.def.reward;
                  return `<div class="ach-card" style="--i:${i}">${trophyIcon("aico")}<span class="ac-tx"><b>${esc(a.def.name)}</b><small>${esc(a.def.desc)}</small></span><span class="ac-rw">${rw.gems ? money("gems", `+${fmtInt(rw.gems)}`) : ""}${rw.coins ? money("coins", `+${fmtInt(rw.coins)}`) : ""}${rw.title ? tag("TITLE", "pink") : ""}</span></div>`;
                })
                .join("")}${r.achievements.some((a) => a.def.reward.gems || a.def.reward.coins) ? `<div class="ac-claim">${btn("CLAIM ALL", { cls: "gold small", act: "claim" })}</div>` : ""}</section>`
            : ""
        }
        ${recChips.length ? `<section class="er-recs">${recChips.join("")}</section>` : ""}
        <section class="er-next"><small>Next time on Kira Kira Overdrive…</small><p>${esc(nextTimeLine(clear, { hero: r.heroName, stage: r.stageName }))}</p></section>
        ${affordText ? `<section class="er-afford">You can afford: <b>${esc(affordText)}</b></section>` : ""}
        <details class="er-dmg"><summary>DAMAGE BREAKDOWN</summary><div class="dmg-list">${s.weapons
          .slice(0, 7)
          .map((x) => `<div class="dmg">${x.icon ? img(x.icon) : '<span class="noi">★</span>'}<div class="bar"><i style="transform:scaleX(${(x.damage / maxD).toFixed(3)})"></i><span>${esc(x.name)}</span></div><b>${fmtNum(x.damage)}</b></div>`)
          .join("")}</div></details>
      </div>
    </div>
    <div class="er-btns">
      ${btn("UPGRADE", { cls: `gold${afford.boardNodes > 0 ? " pulse" : ""}`, act: "upgrade", sub: "Training Arc!", badge: badge(afford.boardNodes > 0 && afford.boardNodes) , def: afford.boardNodes > 0 })}
      ${btn("↻ RETRY", { act: "retry", sub: "Same episode, new outcome!", def: afford.boardNodes <= 0 })}
      ${btn("⌂ HUB", { cls: "violet", act: "hub", sub: "Back to the studio" })}
    </div>`;
  (el.querySelector(".er-top") as HTMLElement).appendChild(cbar.el);
  app.ui.appendChild(el);

  // ---------------------------------------------------------------- beats
  const counters: Counter[] = [];
  const beats: { at: number; fn: () => void; done?: boolean }[] = [];
  let t = 0;
  let skipped = false;
  let tickT = 0;
  const totals = { coins: 0, gems: 0 };
  const intFmt = (v: number) => `+${fmtInt(v)}`;
  const count = (node: HTMLElement | null, to: number, dur: number, fmt = intFmt, from = 0) => {
    if (!node) return;
    if (skipped || reducedMotion()) {
      node.textContent = fmt(to);
      return;
    }
    counters.push({ el: node, from, to, t: 0, dur, fmt });
  };
  const at = (time: number, fn: () => void) => beats.push({ at: time, fn });
  let cursor = 0.9;
  // 2. payout lines, coins then gems (one total each)
  for (const cur of ["coins", "gems"] as const) {
    const part = cur === "coins" ? r.coins : r.gems;
    const col = el.querySelector(`.pay-col.c-${cur}`) as HTMLElement;
    part.lines.forEach((l, i) => {
      at(cursor, () => {
        const row = col.querySelector(`.pl[data-i="${i}"]`) as HTMLElement;
        row.classList.add("in");
        count(row.querySelector(".pl-v"), l.amount, 0.35);
        const tot = col.querySelector(".pay-tot b") as HTMLElement;
        const before = totals[cur];
        totals[cur] += l.amount;
        count(tot, totals[cur], 0.35, intFmt, before);
        if (!skipped) app.sfx("payoutTick", 0.55, Math.min(12, i * 1.5));
      });
      cursor += LINE_GAP;
    });
    at(cursor, () => {
      col.querySelector(".pay-tot")?.classList.add("in");
      if (!skipped) {
        app.sfx("payoutTotal");
        pop(col.querySelector(".pay-tot"), 1.15);
      }
      cbar.sync(cur === "coins" ? { ...c0, coins: c0.coins + r.coins.total } : r.balances, !skipped);
    });
    cursor += 0.45;
  }
  // 3. hero XP (level by level) + mastery
  const xpRow = el.querySelector(".xp-row") as HTMLElement;
  const xpBar = xpRow.querySelector(".pbar") as HTMLElement;
  const levels = [xp.before.level, ...xp.levelUps];
  levels.forEach((L, i) => {
    const last = i === levels.length - 1;
    at(cursor, () => {
      const lvEl = xpRow.querySelector(".xp-lv") as HTMLElement;
      lvEl.textContent = `LV ${L}`;
      if (i > 0) {
        if (!skipped) {
          app.sfx("heroLevelUp");
          pop(lvEl, 1.4);
        }
        const p = xpRow.querySelector(".xp-pop") as HTMLElement;
        p.innerHTML = tag(`LEVEL UP! LV ${L}`, "gold");
        if (!skipped) pop(p, 1.3);
      }
      if (i > 0) setBar(xpBar, 0);
      requestAnimationFrame(() => setBar(xpBar, last ? (xp.after.maxed ? 1 : xp.after.into / xp.after.need) : 1));
    });
    cursor += last ? 0.5 : 0.55;
  });
  mastery.forEach((m, i) => {
    at(cursor, () => {
      const row = el.querySelector(`.ms-row[data-i="${i}"]`) as HTMLElement;
      row.classList.add("in");
      setBar(row.querySelector(".pbar"), m.fill);
      if (!skipped && (m.limitBreak || m.mastered || m.rankAfter > m.rankBefore)) {
        app.sfx("masteryUp");
        pop(row.querySelector(".ms-tag"), 1.3);
      }
    });
    cursor += 0.22;
  });
  // 4. Plot Points, records
  if (r.achievements.length)
    at(cursor, () => {
      el.querySelector(".er-ach")?.classList.add("in");
      if (!skipped) app.sfx("achievement");
    });
  cursor += r.achievements.length ? 0.5 : 0;
  at(cursor, () => el.querySelector(".er-recs")?.classList.add("in"));
  cursor += 0.3;
  // celebrations for new unlocks
  const unlocks = r.unlocks.slice();
  if (unlocks.length) {
    at(cursor, () => {
      if (!skipped) celebrate(app, unlocks);
    });
    cursor += 0.3;
  }
  // 5. narrator, then the "you can afford" line
  at(cursor, () => {
    el.querySelector(".er-next")?.classList.add("in");
    if (!skipped) app.sfx("narratorSting", 0.7);
  });
  cursor += 0.5;
  at(cursor, () => {
    el.querySelector(".er-afford")?.classList.add("in");
    el.classList.add("done");
  });

  const skip = () => {
    if (skipped) return;
    skipped = true;
    for (const b of beats)
      if (!b.done) {
        b.done = true;
        b.fn();
      }
    for (const c of counters) c.el.textContent = c.fmt(c.to);
    counters.length = 0;
    cbar.sync(r.balances, false);
    el.classList.add("done");
  };

  // ---------------------------------------------------------------- buttons
  onTap(el.querySelector('[data-act="upgrade"]'), () => {
    app.sfx("uiConfirm");
    app.goHub(["home", "board"], { focus: "affordable" });
  });
  onTap(el.querySelector('[data-act="retry"]'), () => app.retry());
  onTap(el.querySelector('[data-act="hub"]'), () => {
    app.sfx("uiBack");
    app.goHub();
  });
  onTap(el.querySelector('[data-act="claim"]'), (e) => {
    const res = claimAllAchievements(save.profile);
    save.save();
    const b = e.currentTarget as HTMLElement | null;
    if (res.count) {
      app.sfx("currencyGain");
      skip();
      cbar.sync(save.profile.currencies);
      const box = el.querySelector(".ac-claim");
      if (box) box.innerHTML = tag(`CLAIMED ${[res.gems ? `+${fmtInt(res.gems)} ♦` : "", res.coins ? `+${fmtInt(res.coins)} ★` : ""].filter(Boolean).join(" ")}`, "green");
    } else if (b) b.remove();
  });
  // tapping the show (not a button) skips to the end
  el.querySelector(".er-scroll")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("button, summary")) return;
    skip();
  });
  const L = layer(el, () => app.goHub());
  if (reducedMotion()) skip();

  return {
    el,
    layer: L,
    close: () => {
      cbar.dispose();
      el.classList.add("out");
      el.style.pointerEvents = "none";
      setTimeout(() => el.remove(), 220);
    },
    update(dt) {
      t += dt;
      for (const b of beats) {
        if (b.done || t < b.at) continue;
        b.done = true;
        b.fn();
      }
      for (let i = counters.length - 1; i >= 0; i--) {
        const c = counters[i];
        c.t += dt;
        const k = Math.min(1, c.t / c.dur);
        const v = Math.round(c.from + (c.to - c.from) * (1 - Math.pow(1 - k, 3)));
        const txt = c.fmt(v);
        if (c.el.textContent !== txt) c.el.textContent = txt;
        if (k >= 1) counters.splice(i, 1);
      }
      if (counters.length) {
        tickT -= dt;
        if (tickT <= 0) {
          tickT = 0.07;
          app.sfx("countTick", 0.25, 6);
        }
      }
    },
  };
}

// ================================================================== NEW UNLOCK celebration

/** Full-screen "NEW WEAPON UNLOCKED!" cards, one per unlock (tap / OK for the next). */
function celebrate(app: App, list: UnlockEvent[]): void {
  if (!list.length) return;
  const ev = list.shift() as UnlockEvent;
  const el = h("div", "kover unlock-cele");
  const icon = unlockIcon(ev);
  el.innerHTML = `
    <div class="rays"></div>
    ${sparkles(24)}
    <div class="uc-card">
      <div class="uc-t">${letters(UNLOCK_TITLE[ev.kind] ?? "NEW UNLOCK!", "ltr", 0.04)}</div>
      <div class="uc-ic">${icon}</div>
      <b class="uc-name">${esc(ev.name)}</b>
      ${ev.hint ? `<small class="uc-hint">${esc(ev.hint)}</small>` : ""}
      <small class="uc-narr">${ev.kind === "hero" ? "A new character joins the cast! Ratings are up!" : "New merchandise has been approved!"}</small>
      <button class="btn gold small" data-nav data-nav-default data-act="ok">${list.length ? "NEXT ▶" : "AMAZING!"}</button>
    </div>`;
  app.ui.appendChild(el);
  app.sfx("unlockFanfare");
  trackOverlay(1);
  markBorn();
  let done = false;
  const L: NavLayer = { root: el, focus: null, onBack: () => close() };
  const close = () => {
    if (done) return;
    done = true;
    app.nav.remove(L);
    el.classList.add("out");
    setTimeout(() => el.remove(), 220);
    trackOverlay(-1);
    app.overlayClosed();
    if (list.length) setTimeout(() => celebrate(app, list), 120);
  };
  app.nav.push(L);
  app.overlayOpened();
  onTap(el.querySelector('[data-act="ok"]'), close);
  el.addEventListener("click", () => close());
}

function unlockIcon(ev: UnlockEvent): string {
  switch (ev.kind) {
    case "hero": {
      const d = HEROES.find((x) => x.id === ev.id);
      return portrait(d?.portrait ?? "", 1, "uc-img");
    }
    case "weapon":
      return hasArt(WEAPONS.get(ev.id)?.icon ?? "") ? img(WEAPONS.get(ev.id)?.icon ?? "", "px uc-img") : currencyIcon("coins", true, "uc-img");
    case "passive": {
      const ic = PASSIVES.find((x) => x.id === ev.id)?.icon ?? "";
      return hasArt(ic) ? img(ic, "px uc-img") : trophyIcon("uc-img");
    }
    case "relic": {
      const d = RELICS.get(ev.id);
      return `<span class="relic-t rf r-${RARITY_CLS[(d?.rarity ?? "N") as Rarity]}">${relicIcon(ev.id, (d?.rarity ?? "N") as Rarity, "uc-img")}</span>`;
    }
    case "twist":
      return twistIcon(ev.id, "uc-img");
    default:
      return trophyIcon("uc-img");
  }
}
