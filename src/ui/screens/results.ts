/**
 * EPISODE RESULTS - the payout show (docs/EXPANSION.md §4, docs/content/satire.md §3-4, §9):
 *
 *   1. Title card: "EPISODE N" stamps in letter by letter over the run's
 *      episode title; TO BE CONTINUED -> slides in (death), SERIES FINALE?!
 *      stamps with confetti (clear; "RENEWED FOR SEASON 2!!" on the final
 *      stage; "(the filler continued for m:ss)" after a Filler Arc), DROPPED
 *      AFTER EPISODE N + a cassette eject (quit). The run's numbers pop in with
 *      NEW BEST tags. The grade SLAMS in (shockwave, the header shakes) and its
 *      satire comment types out.
 *   2. The payout ticks up line by line (coins: picked up, time, kills, each
 *      boss, clear, filler, then the rank / heat / curse / stage multipliers
 *      stamped as "x1.35"; gems: stipend, first clears, first boss kills, heat
 *      badges, wiki finds) with a rising payoutTick per line, then each TOTAL
 *      pops (payoutTotal) and its coins / gems fly into the currency bar.
 *   3. Hero XP fills level by level with LEVEL UP! bursts; weapon mastery bars
 *      fill with RANK UP! / LIMIT BREAK! / MASTERED! pops.
 *   4. Plot Point cards deal in (CLAIM ALL flies the rewards up), records +
 *      banner chips, then a full-screen celebration per new unlock.
 *   5. "Next time on Kira Kira Overdrive..." - a preview card whose line types
 *      out with the narrator sting.
 *   6. UPGRADE (badge = affordable board nodes; straight to the Training Arc
 *      with them pulsing) / RETRY / HUB - always on screen; "You can afford: …".
 *
 * Tapping the show skips to the end (unlock cards still play once). The
 * timeline runs on real elapsed time (the App caps a frame at 1/20 s, so a
 * slow phone would otherwise drift out of sync with the CSS animations); on
 * portrait phones it auto-scrolls to each new beat until the player scrolls.
 * Counters write text only when the shown integer changes; animation is
 * transform / opacity only. Reduced motion jumps to the end state.
 */
import { heroDef } from "../../game/heroes";
import { WEAPONS } from "../../game/registry";
import type { RunSummary } from "../../game/world";
import { claimAllAchievements } from "../../meta/achievements/engine";
import { ACHIEVEMENTS } from "../../meta/achievements/registry";
import type { Profile } from "../../meta/profile";
import { affordableNodes } from "../../meta/board/board";
import { bannerViews } from "../../meta/gacha/banners";
import type { PayoutLine } from "../../meta/economy";
import { gameContent } from "../../meta/content";
import type { RunReport } from "../../meta/rewards";
import type { App, EpisodeInfo, UiScreen } from "../app";
import { esc, fmtInt, fmtNum, fmtTime, h, hasArt, img } from "../dom";
import { CurrencyBar } from "../kit/currency";
import { badge, btn, pbar, pop, setBar, tag } from "../kit/controls";
import { currencyIcon, money, portrait, trophyIcon } from "../kit/art";
import { reducedMotion } from "../kit/ticker";
import { save } from "../save";
import { gradeComment, nextTimeLine } from "../hub/copy";
import { celebrateUnlocks, confetti, flyCurrency, wordLetters } from "../hub/celebrate";
import { tbcBanner } from "../stinger";
import { layer, onTap, sparkles } from "./common";
import "./results.css";

interface Counter {
  el: HTMLElement;
  from: number;
  to: number;
  t: number;
  dur: number;
  fmt: (v: number) => string;
}

/** Typewriter text (one small element; text only changes when a character is added). */
interface Typer {
  el: HTMLElement;
  text: string;
  t: number;
  cps: number;
  shown: number;
}

const LINE_GAP = 0.32;

/**
 * A completed, unclaimed Plot Point pays gems or coins: leaving Results (or a TBC RETRY) claims them all for
 * the player, so the Pilot Episode's gems pay the first pull even without CLAIM ALL (docs/META.md §4).
 */
export function cashClaimable(p: Profile): boolean {
  for (const id in p.achievements.done) {
    if (p.achievements.claimed.includes(id)) continue;
    const rw = ACHIEVEMENTS.get(id)?.reward;
    if (rw && ((rw.gems ?? 0) > 0 || (rw.coins ?? 0) > 0)) return true;
  }
  return false;
}

export function showResults(app: App, s: RunSummary, r: RunReport, ep: EpisodeInfo): UiScreen {
  const hd = heroDef(s.hero);
  const ctx = gameContent();
  const clear = r.outcome === "clear";
  const quit = r.outcome === "quit";
  const finalStage = ctx.stages.length > 0 && r.stage === ctx.stages[ctx.stages.length - 1].id && ctx.stages.length >= 5;
  const rm = reducedMotion();
  const el = h("div", `scr results ep-res ${clear ? "won" : quit ? "quit" : "lost"}${rm ? " rmo" : ""}`);
  const cbar = new CurrencyBar();
  const c0 = { coins: r.balances.coins - r.coins.total, gems: r.balances.gems - r.gems.total, copium: r.balances.copium };
  cbar.set(c0);

  const finaleText = finalStage ? "RENEWED FOR SEASON 2!!" : "SERIES FINALE?!";
  const stinger = clear
    ? `<div class="er-finale"><span class="erf-t">${wordLetters(finaleText, "ltr", 0.045, 0.35)}</span>${r.endless && s.stats?.endlessTime ? `<small>(the filler continued for ${fmtTime(s.stats.endlessTime)})</small>` : ""}</div>`
    : quit
      ? `<div class="er-dropped"><i class="cass" aria-hidden="true"></i>DROPPED AFTER EPISODE ${fmtInt(r.episode)}</div>`
      : tbcBanner();
  const nb = (on: boolean) => (on ? tag("NEW BEST!", "red") : "");
  const stat = (k: string, v: string, best: boolean, i: number) => `<div class="er-stat${best ? " best" : ""}" style="--i:${i}"><small>${k}</small><b>${v}</b>${nb(best)}</div>`;
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
  const affordOf = (nodes: number, ten: boolean, one: boolean) => [nodes > 0 ? `${nodes} board node${nodes === 1 ? "" : "s"}` : "", ten ? "a 10-pull" : one ? "a pull" : ""].filter(Boolean).join(" · ");
  const affordText = affordOf(afford.boardNodes, afford.tenPull, afford.singlePull);
  const maxD = Math.max(1, ...s.weapons.map((x) => x.damage));
  const gc = gradeComment(r.grade);
  const nextLine = nextTimeLine(clear, { hero: r.heroName, stage: r.stageName, n: r.episode });
  const bigGrade = r.grade === "S" || r.grade === "SS" || r.grade === "A";

  el.innerHTML = `
    ${sparkles(clear ? 22 : 8)}
    ${clear ? confetti(46, "er-conf") : ""}
    <div class="er-top"></div>
    ${!app.practice && !save.writeOk ? `<div class="er-savefail" role="alert">⚠ Saving failed: this episode only lives in this window. Export your save in Settings → SAVE DATA.</div>` : ""}
    <div class="er-scroll kscroll">
      <div class="er-main">
        <header class="er-head">
          <div class="er-ep"><small>${esc(r.stageName.toUpperCase())}${r.heat ? ` · HEAT ${r.heat}` : ""}</small><b class="er-no">${wordLetters(`EPISODE ${fmtInt(r.episode)}`, "eltr", 0.045, 0.05)}</b><span class="er-title">“${esc(ep.title)}”</span>${app.practice ? `<span class="er-practice">${tag("PRACTICE RUN · NOT SAVED", "cyan")}</span>` : ""}</div>
          <div class="er-sting">${stinger}</div>
          <div class="er-hero">
            <div class="por${clear ? " won" : " lost"}" style="--hc:${app.heroColor(hd.id)}">${portrait(hd.portrait, clear ? 1 : 0, "pimg")}${clear ? "" : '<i class="sweat"></i>'}</div>
            <div class="er-grade g-${r.grade}"><small class="eg-k">GRADE</small><div class="eg-w"><i class="eg-ring" aria-hidden="true"></i><div class="grade ${r.grade}">${r.grade}${bigGrade ? '<i class="burst"></i>' : ""}</div></div><small class="er-gc" aria-label="${esc(gc)}"></small></div>
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
            ? `<section class="er-ach"><div class="er-sec">${trophyIcon("es-ic")}PLOT POINTS UNLOCKED <small>${r.achievements.length}</small></div>${r.achievements
                .map((a, i) => {
                  const rw = a.def.reward;
                  return `<div class="ach-card" style="--i:${i}"><span class="ac-ic">${trophyIcon("aico")}<i class="ac-shine" aria-hidden="true"></i></span><span class="ac-tx"><small class="ac-k">PLOT POINT!</small><b>${esc(a.def.name)}</b><small>${esc(a.def.desc)}</small></span><span class="ac-rw">${rw.gems ? money("gems", `+${fmtInt(rw.gems)}`) : ""}${rw.coins ? money("coins", `+${fmtInt(rw.coins)}`) : ""}${rw.title ? tag("TITLE", "pink") : ""}${rw.unlock ? tag("UNLOCK", "cyan") : ""}</span></div>`;
                })
                .join("")}${!app.practice && r.achievements.some((a) => a.def.reward.gems || a.def.reward.coins) ? `<div class="ac-claim">${btn("CLAIM ALL", { cls: "gold small", act: "claim" })}</div>` : ""}</section>`
            : ""
        }
        ${recChips.length ? `<section class="er-recs">${recChips.map((c, i) => `<span class="rc" style="--i:${i}">${c}</span>`).join("")}</section>` : ""}
        <section class="er-next" aria-label="Next time on Kira Kira Overdrive: ${esc(nextLine)}">
          <div class="nt-head"><span class="nt-k">NEXT TIME ON</span><span class="nt-logo">KIRA<i>☆</i>KIRA OVERDRIVE</span></div>
          <p class="nt-line" aria-hidden="true"><span class="nt-tx"></span><i class="nt-caret"></i></p>
        </section>
        <section class="er-afford"${affordText ? "" : " hidden"}>You can afford: <b>${esc(affordText)}</b></section>
        <details class="er-dmg"><summary>DAMAGE BREAKDOWN</summary><div class="dmg-list">${s.weapons
          .slice(0, 7)
          .map((x) => `<div class="dmg">${x.icon ? img(x.icon) : '<span class="noi">★</span>'}<div class="bar"><i style="transform:scaleX(${(x.damage / maxD).toFixed(3)})"></i><span>${esc(x.name)}</span></div><b>${fmtNum(x.damage)}</b></div>`)
          .join("")}</div></details>
      </div>
    </div>
    <div class="er-btns">
      ${btn("UPGRADE", { cls: `gold${afford.boardNodes > 0 ? " pulse" : ""}`, act: "upgrade", sub: afford.boardNodes > 0 ? `Training Arc! ${afford.boardNodes} to buy` : "Training Arc!", badge: badge(afford.boardNodes > 0 && afford.boardNodes), def: afford.boardNodes > 0 })}
      ${btn("↻ RETRY", { act: "retry", sub: "Same episode, new outcome!", def: afford.boardNodes <= 0 })}
      ${btn("⌂ HUB", { cls: "violet", act: "hub", sub: "Back to the studio" })}
    </div>`;
  (el.querySelector(".er-top") as HTMLElement).appendChild(cbar.el);
  app.ui.appendChild(el);
  const scroller = el.querySelector(".er-scroll") as HTMLElement;
  const head = el.querySelector(".er-head") as HTMLElement;

  // ---------------------------------------------------------------- beats
  const counters: Counter[] = [];
  const typers: Typer[] = [];
  const beats: { at: number; fn: () => void; done?: boolean }[] = [];
  let t = 0;
  let last = performance.now();
  let skipped = false;
  let tickT = 0;
  let userScrolled = false;
  const totals = { coins: 0, gems: 0 };
  const intFmt = (v: number) => `+${fmtInt(v)}`;
  const count = (node: HTMLElement | null, to: number, dur: number, fmt = intFmt, from = 0) => {
    if (!node) return;
    if (skipped || rm) {
      node.textContent = fmt(to);
      return;
    }
    counters.push({ el: node, from, to, t: 0, dur, fmt });
  };
  const type = (node: HTMLElement | null, text: string, cps = 38) => {
    if (!node) return;
    if (skipped || rm) {
      node.textContent = text;
      return;
    }
    typers.push({ el: node, text, t: 0, cps, shown: 0 });
  };
  const at = (time: number, fn: () => void) => beats.push({ at: time, fn });
  /** Portrait phones: keep the newest beat in view (smoothly) until the player scrolls by hand. */
  const follow = (node: Element | null) => {
    if (!node || skipped || userScrolled) return;
    const sr = scroller.getBoundingClientRect();
    const nr = node.getBoundingClientRect();
    const pad = 24;
    if (nr.bottom > sr.bottom - pad) scroller.scrollTo({ top: scroller.scrollTop + (nr.bottom - sr.bottom) + pad, behavior: rm ? "auto" : "smooth" });
  };
  for (const ev of ["wheel", "touchstart", "pointerdown"] as const) scroller.addEventListener(ev, () => (userScrolled = true), { passive: true });

  // 1. header: the grade slams in, its comment types out
  at(rm ? 0 : 1.05, () => {
    const g = el.querySelector(".er-grade") as HTMLElement;
    g.classList.add("in");
    if (!skipped) {
      app.sfx("rankUp", 0.9, bigGrade ? 3 : 0);
      if (typeof head.animate === "function" && !rm)
        head.animate([{ transform: "none" }, { transform: "translate(3px, 2px)" }, { transform: "translate(-3px, -1px)" }, { transform: "translate(2px, -2px)" }, { transform: "none" }], { duration: 260, easing: "linear" });
    }
    type(g.querySelector(".er-gc"), gc, 42);
  });
  if (quit) at(0.35, () => !skipped && app.sfx("cassetteEject", 0.8));
  let cursor = rm ? 0 : 1.55;
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
        if (!skipped) {
          app.sfx("payoutTick", 0.55, Math.min(12, i * 1.5));
          if (l.mul) pop(row.querySelector(".pl-m"), 1.5);
        }
        follow(row);
      });
      cursor += LINE_GAP;
    });
    at(cursor, () => {
      const tot = col.querySelector(".pay-tot") as HTMLElement;
      tot.classList.add("in");
      const target = cur === "coins" ? { ...c0, coins: c0.coins + r.coins.total } : r.balances;
      if (!skipped && part.total > 0) {
        app.sfx("payoutTotal");
        pop(tot, 1.15);
        flyCurrency(el, tot.querySelector("b"), cbar.pill(cur), cur, Math.min(9, 3 + Math.round(Math.log10(1 + part.total) * 2)), () => cbar.sync(target, true));
      } else cbar.sync(target, !skipped);
      follow(tot);
    });
    cursor += 0.5;
  }
  // 3. hero XP (level by level) + mastery
  const xpRow = el.querySelector(".xp-row") as HTMLElement;
  const xpBar = xpRow.querySelector(".pbar") as HTMLElement;
  const levels = [xp.before.level, ...xp.levelUps];
  levels.forEach((L, i) => {
    const lastLv = i === levels.length - 1;
    at(cursor, () => {
      const lvEl = xpRow.querySelector(".xp-lv") as HTMLElement;
      lvEl.textContent = `LV ${L}`;
      if (i === 0) follow(xpRow);
      if (i > 0) {
        if (!skipped) {
          app.sfx("heroLevelUp", 0.9, Math.min(8, i));
          pop(lvEl, 1.4);
          pop(xpRow.querySelector(".xp-por"), 1.18);
        }
        const p = xpRow.querySelector(".xp-pop") as HTMLElement;
        p.innerHTML = `<span class="lvup">${tag(`LEVEL UP! LV ${L}`, "gold")}<i class="lvup-burst" aria-hidden="true"></i></span>`;
        if (!skipped) pop(p, 1.3);
        setBar(xpBar, 0);
      }
      requestAnimationFrame(() => setBar(xpBar, lastLv ? (xp.after.maxed ? 1 : xp.after.into / xp.after.need) : 1));
    });
    cursor += lastLv ? 0.55 : 0.6;
  });
  mastery.forEach((m, i) => {
    at(cursor, () => {
      const row = el.querySelector(`.ms-row[data-i="${i}"]`) as HTMLElement;
      row.classList.add("in");
      setBar(row.querySelector(".pbar"), m.fill);
      if (!skipped && (m.limitBreak || m.mastered || m.rankAfter > m.rankBefore)) {
        app.sfx("masteryUp", 0.9, m.mastered ? 5 : m.limitBreak ? 3 : 0);
        pop(row.querySelector(".ms-tag"), 1.35);
      }
      follow(row);
    });
    cursor += 0.24;
  });
  // 4. Plot Points, records
  if (r.achievements.length)
    at(cursor, () => {
      const box = el.querySelector(".er-ach");
      box?.classList.add("in");
      if (!skipped) app.sfx("achievement");
      follow(box);
    });
  cursor += r.achievements.length ? 0.35 + Math.min(6, r.achievements.length) * 0.12 : 0;
  at(cursor, () => {
    const rc = el.querySelector(".er-recs");
    rc?.classList.add("in");
    follow(rc);
  });
  cursor += 0.3;
  // celebrations for new unlocks: always shown once (a skip / reduced motion shows them at once; a button
  // pressed before their beat shows them first, then acts)
  // (unlocks a TBC RETRY skipped, then this run's)
  const unlocks = [...(app.practice ? [] : save.takePendingUnlocks()), ...r.unlocks].filter((u) => !u.start);
  let celebrating = false;
  /** A button pressed while the cards are up (keyboard / gamepad focus behind them): it acts once they are done. */
  let after: (() => void) | undefined;
  const celebrate = (then?: () => void) => {
    if (celebrating) {
      if (then) after = then;
      return;
    }
    if (!unlocks.length) {
      then?.();
      return;
    }
    celebrating = true;
    celebrateUnlocks(app, unlocks.splice(0), () => {
      celebrating = false;
      const go = after ?? then;
      after = undefined;
      go?.();
    });
  };
  if (unlocks.length) {
    at(cursor, () => celebrate());
    cursor += 0.3;
  }
  // 5. narrator: the "next time" preview card types its line, then the "you can afford" line
  at(cursor, () => {
    const nx = el.querySelector(".er-next") as HTMLElement;
    nx.classList.add("in");
    if (!skipped) app.sfx("narratorSting", 0.7);
    type(nx.querySelector(".nt-tx"), nextLine, 34);
    follow(nx);
  });
  cursor += 0.6;
  at(cursor, () => {
    const af = el.querySelector(".er-afford");
    af?.classList.add("in");
    follow(af);
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
    for (const ty of typers) ty.el.textContent = ty.text;
    typers.length = 0;
    cbar.sync(r.balances, false);
    el.classList.add("done", "skipped");
  };

  // ---------------------------------------------------------------- buttons
  /** After a claim the balances moved: "You can afford" says what the gems / coins buy now (a pull, a 10-pull). */
  const refreshAfford = () => {
    if (app.practice) return;
    const ctx2 = gameContent();
    const views = bannerViews(save.profile, ctx2);
    const text = affordOf(affordableNodes(save.profile, ctx2).length, views.some((v) => v.canPull10), views.some((v) => v.canPull1));
    const af = el.querySelector(".er-afford") as HTMLElement | null;
    if (!af) return;
    af.hidden = !text;
    const b = af.querySelector("b");
    if (b && b.textContent !== text) {
      b.textContent = text;
      pop(af, 1.06);
    }
  };
  /** Claim every Plot Point reward (CLAIM ALL, or on the way out: the Pilot Episode gems pay the first pull). */
  const claim = (): { count: number; gems: number; coins: number } => {
    if (app.practice) return { count: 0, gems: 0, coins: 0 };
    const res = claimAllAchievements(save.profile);
    if (!res.count) return res;
    save.save();
    app.sfx("currencyGain");
    const box = el.querySelector(".ac-claim") as HTMLElement | null;
    const land = () => cbar.sync(save.profile.currencies);
    if (res.gems) flyCurrency(el, box, cbar.pill("gems"), "gems", 6, land);
    if (res.coins) flyCurrency(el, box, cbar.pill("coins"), "coins", 6, land);
    if (!res.gems && !res.coins) land();
    if (box) box.innerHTML = tag(`CLAIMED ${[res.gems ? `+${fmtInt(res.gems)} ♦` : "", res.coins ? `+${fmtInt(res.coins)} ★` : ""].filter(Boolean).join(" ")}`, "green");
    for (const c of el.querySelectorAll(".ach-card")) c.classList.add("claimed");
    refreshAfford();
    return res;
  };
  /** Leaving Results (UPGRADE / RETRY / HUB / Back): unclaimed gem / coin Plot Points are claimed for the player. */
  const leave = (go: () => void) => {
    if (!app.practice && cashClaimable(save.profile)) claim();
    celebrate(go);
  };
  onTap(el.querySelector('[data-act="upgrade"]'), () => {
    app.sfx("uiConfirm");
    leave(() => app.goHub(["home", "board"], { focus: "affordable" }));
  });
  onTap(el.querySelector('[data-act="retry"]'), () => leave(() => app.retry()));
  onTap(el.querySelector('[data-act="hub"]'), () => {
    app.sfx("uiBack");
    leave(() => app.goHub());
  });
  onTap(el.querySelector('[data-act="claim"]'), (e) => {
    const b = e.currentTarget as HTMLElement | null;
    skip();
    if (!claim().count && b) b.remove();
  });
  // tapping the show (not a button) skips to the end
  scroller.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("button, summary")) return;
    skip();
  });
  const L = layer(el, () => leave(() => app.goHub()));
  if (rm) skip();

  return {
    el,
    layer: L,
    close: () => {
      cbar.dispose();
      el.classList.add("out");
      el.style.pointerEvents = "none";
      setTimeout(() => el.remove(), 220);
    },
    update() {
      // real elapsed time (clamped: a backgrounded tab resumes where it was, not at the end)
      const now = performance.now();
      const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
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
      for (let i = typers.length - 1; i >= 0; i--) {
        const ty = typers[i];
        ty.t += dt;
        const n = Math.min(ty.text.length, Math.floor(ty.t * ty.cps));
        if (n !== ty.shown) {
          ty.shown = n;
          ty.el.textContent = ty.text.slice(0, n);
        }
        if (n >= ty.text.length) typers.splice(i, 1);
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
