/**
 * KIRA KIRA WIKI - "The Free Fan Encyclopedia Anyone Can't Edit"
 * (docs/EXPANSION.md §11, docs/content/satire.md §8 + §10).
 *
 *   masthead   the puzzle-star logo, the tagline and a search box: typing
 *              searches every discovered article (+ Plot Point names) across
 *              all tabs; no hit -> "The page "x" does not exist. You can ask
 *              for it to be created, but nobody will."
 *   tabs       PLOT POINTS · HEROES · WEAPONS · PASSIVES · ENEMIES · BOSSES ·
 *              MERCH · STAGES, each with its art and found / total
 *   list page  the wiki list article: title, "From Kira Kira Wiki…", an amber
 *              maintenance notice, discovered progress (+ the gem bounty per
 *              find), filter chips (FOUND / MISSING, MASTERED, rarities,
 *              stages), the entry grid (undiscovered = silhouette + hint) and
 *              a talk / categories footer
 *   articles   ./wiki/article.ts (sheet), wiki links hop between articles
 *   plot       ./wiki/plot.ts (categories, filters, hidden "???", CLAIM / CLAIM
 *              ALL with the rewards flying into the currency bar)
 *
 * Animation: tiles pop in staggered (transform / opacity, capped), the tab
 * art hops, claims stamp; reduced motion turns it all off. Layout: one-handed
 * portrait first; landscape / desktop get a wider grid and a side-panel sheet.
 */
import type { Rarity } from "../../game/defs";
import { achievementViews, claimAchievement, claimAllAchievements, evaluateAchievements, unclaimedCount } from "../../meta/achievements/engine";
import type { AchievementCategory } from "../../meta/achievements/types";
import { codexBounty, codexProgress } from "../../meta/codex";
import { gameContent } from "../../meta/content";
import { CODEX_TABS, type CodexTab } from "../../meta/profile";
import { esc, fmtInt, h } from "../dom";
import { art, currencyIcon, money, portrait, RARITY_CLS, trophyIcon } from "../kit/art";
import { badge, bindActs, pbar, pop, shake, TabBar } from "../kit/controls";
import { openSheet, type SheetHandle } from "../kit/overlay";
import { reducedMotion } from "../kit/ticker";
import { save } from "../save";
import { celebrateUnlocks, flyCurrency } from "./celebrate";
import { pageLayer, type Hub, type HubPage, type PageOpts } from "./hub";
import { articleFor, stubFor } from "./wiki/article";
import { EDIT_DENIED, NOTICES, noResults, pickBy, TAB_INFO, TALK, WIKI_FROM, WIKI_TAGLINE, type WikiTab } from "./wiki/copy";
import { tabEntries, type WikiEntry } from "./wiki/entries";
import { claimAllHtml, claimAllLabel, claimChipHtml, claimPreHtml, emptyPlotHtml, plotParts, plotRow, plotSummary, type PlotFilter, type PlotState } from "./wiki/plot";
import "./wiki/wiki.css";

type Tab = WikiTab;
const TABS: Tab[] = ["plot", ...CODEX_TABS];
const RARITIES: Rarity[] = ["N", "R", "SR", "SSR", "UR", "LR", "MYTHIC"];

/** Tab art (atlas sprites with CSS stand-ins). */
function tabIcon(t: Tab): string {
  switch (t) {
    case "plot":
      return art("icon_trophy", trophyIcon("ti-img"), "px ti-img");
    case "heroes":
      return portrait("portrait_hoshi", 0, "ti-img ti-por");
    case "weapons":
      return art("icon_star_shot", "", "px ti-img");
    case "passives":
      return art("icon_plot_armor", "", "px ti-img");
    case "enemies":
      return art("en_puff", "", "px ti-img");
    case "bosses":
      return art("boss_kingpuff", "", "px ti-img");
    case "relics":
      return art("ui_gacha_capsule", currencyIcon("gems", true, "ti-img"), "px ti-img");
    case "stages":
      return art("deco_tree", "", "px ti-img");
  }
}

/** Filter chips per codex tab: id -> label. */
function filtersFor(t: CodexTab, list: WikiEntry[]): { id: string; label: string }[] {
  const out = [
    { id: "all", label: "ALL" },
    { id: "found", label: "FOUND" },
    { id: "missing", label: "MISSING" },
  ];
  if (t === "weapons") out.push({ id: "mastered", label: "M5+" });
  if (t === "relics") {
    out.push({ id: "owned", label: "OWNED" });
    for (const r of RARITIES) if (list.some((e) => e.rarity === r)) out.push({ id: `r:${r}`, label: r });
  }
  if (t === "enemies" || t === "bosses") {
    const ctx = gameContent();
    for (const s of ctx.stages) if (list.some((e) => e.stage === s.id)) out.push({ id: `s:${s.id}`, label: s.name.toUpperCase() });
  }
  return out;
}

function passes(e: WikiEntry, f: string): boolean {
  if (f === "all") return true;
  if (f === "found") return e.found;
  if (f === "missing") return !e.found;
  if (f === "mastered") return e.found && (e.rank ?? 0) >= 5;
  if (f === "owned") return (e.rank ?? -1) >= 0;
  if (f.startsWith("r:")) return e.rarity === f.slice(2);
  if (f.startsWith("s:")) return e.stage === f.slice(2);
  return true;
}

export function wikiPage(hub: Hub, o: PageOpts): HubPage {
  const app = hub.app;
  const ctx = gameContent();
  // (a deep link / a profile that changed elsewhere: Plot Points it already qualifies for become claimable here)
  const fresh = evaluateAchievements(save.profile, null);
  if (fresh.length) {
    save.save();
    const unl = fresh.map((d) => d.unlocked).filter((u): u is NonNullable<typeof u> => !!u);
    if (unl.length) setTimeout(() => celebrateUnlocks(app, unl), 450);
  }
  const el = h("div", "wiki");
  const layer = pageLayer(hub);
  // (`tab` may name an entry too, "weapons/yarn_orbit": the page opens on that article - scenarios, deep links)
  const [tab0, entry0] = (o.tab ?? "").split("/");
  let tab: Tab = (TABS as string[]).includes(tab0) ? (tab0 as Tab) : unclaimedCount(save.profile) > 0 ? "plot" : "heroes";
  const deepEntry = entry0 ?? "";
  const plot: PlotState = { cat: "all", filter: "all" };
  const filter: Record<string, string> = {};
  let query = "";
  let sheet: SheetHandle | null = null;
  let qTimer = 0;
  /** Tiles animate in only on a tab switch / first show, not on in-place refreshes (claims, filters). */
  let animate = true;

  el.innerHTML = `
    <div class="wk-mast">
      <span class="wk-logo" aria-hidden="true"><i class="wl-g"></i><i class="wl-s">☆</i></span>
      <span class="wk-tag"><b>Kira Kira Wiki</b><small>${esc(WIKI_TAGLINE)}</small></span>
    </div>
    <label class="wk-search" data-nav data-act="search">
      <span class="ws-ic" aria-hidden="true"></span>
      <input type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" maxlength="40" placeholder="Search the wiki…" aria-label="Search Kira Kira Wiki" />
      <button class="ws-x" type="button" data-act="clear" aria-label="Clear search" hidden>×</button>
    </label>
    <div class="wk-tabs"></div>
    <div class="wk-body kscroll"></div>`;
  const body = el.querySelector(".wk-body") as HTMLElement;
  const input = el.querySelector(".wk-search input") as HTMLInputElement;
  const clearBtn = el.querySelector(".ws-x") as HTMLButtonElement;

  const tabDefs = () => {
    const prog = codexProgress(save.profile, ctx);
    return TABS.map((t) => {
      const pr = prog.find((x) => x.tab === t);
      const count = t === "plot" ? "" : `<small class="ti-n">${pr?.found ?? 0}/${pr?.total ?? 0}</small>`;
      return { id: t, label: TAB_INFO[t].label, icon: `<span class="ti">${tabIcon(t)}</span>${count}`, badge: t === "plot" ? badge(unclaimedCount(save.profile)) : "" };
    });
  };
  const tabBar = new TabBar(
    tabDefs(),
    tab,
    (t) => {
      app.sfx("tabSwitch");
      tab = t as Tab;
      if (query) setQuery("");
      animate = true;
      render();
      body.scrollTop = 0;
    },
    "wk-tabbar",
  );
  (el.querySelector(".wk-tabs") as HTMLElement).appendChild(tabBar.el);

  // ---------------------------------------------------------------- search
  const setQuery = (q: string) => {
    query = q;
    if (input.value !== q) input.value = q;
    clearBtn.hidden = !q;
    el.classList.toggle("searching", !!q);
  };
  input.addEventListener("input", () => {
    clearTimeout(qTimer);
    qTimer = window.setTimeout(() => {
      setQuery(input.value.trim().slice(0, 40));
      animate = true;
      render();
      body.scrollTop = 0;
    }, 140);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (input.value) {
        setQuery("");
        render();
      }
      input.blur();
    } else if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      input.blur();
    }
  });

  // ---------------------------------------------------------------- render
  /** Plot rows put in the DOM with the page; the rest stream in, PLOT_CHUNK a frame (plotParts). */
  const PLOT_FIRST = 16;
  const PLOT_CHUNK = 24;
  /** Bumped by every render: a pending row stream of an older render stops. */
  let gen = 0;
  let streamRaf = 0;

  const render = () => {
    // (the tab strip is built once: re-rendering it would drop the keyboard focus; only the badge changes)
    tabBar.select(tab);
    tabBar.setBadge("plot", badge(unclaimedCount(save.profile)));
    el.dataset.tab = tab;
    const f = layer.focus && body.contains(layer.focus) ? { act: layer.focus.dataset.act, id: layer.focus.dataset.id } : null;
    body.classList.toggle("anim", animate && !reducedMotion());
    gen++;
    cancelAnimationFrame(streamRaf);
    pending = [];
    let rest: string[] = [];
    if (query) body.innerHTML = searchHtml(query);
    else if (tab === "plot") {
      const { head, rows } = plotParts(save.profile, ctx, plot);
      rest = rows.slice(PLOT_FIRST);
      body.innerHTML = `${listHead("plot")}${head}<div class="pp-list">${rows.length ? rows.slice(0, PLOT_FIRST).join("") : emptyPlotHtml(plot.filter)}</div>${listFoot("plot")}`;
    } else body.innerHTML = codexHtml(tab);
    animate = false;
    bindActs(body, acts);
    if (rest.length) streamRows(rest, gen);
    // keyboard / gamepad: keep the focus on the same control after an in-place refresh (filter chips, claims)
    if (f?.act) app.nav.refocus(layer, body.querySelector<HTMLElement>(`[data-act="${CSS.escape(f.act)}"]${f.id ? `[data-id="${CSS.escape(f.id)}"]` : ""}`));
  };

  /** Rows of the current render not in the DOM yet. */
  let pending: string[] = [];
  /** Append the remaining Plot rows a chunk per frame (bound as they land). */
  const streamRows = (rows: string[], g: number) => {
    pending = rows;
    const step = () => {
      streamRaf = 0;
      if (g !== gen) return;
      appendRows(PLOT_CHUNK);
      if (pending.length) streamRaf = requestAnimationFrame(step);
    };
    streamRaf = requestAnimationFrame(step);
  };
  const appendRows = (n: number) => {
    const list = body.querySelector(".pp-list");
    const chunk = pending.slice(0, n);
    pending = pending.slice(n);
    if (!list || !chunk.length) return;
    const box = document.createElement("div");
    box.innerHTML = chunk.join("");
    bindActs(box, acts);
    list.append(...box.children);
  };
  /** Put every pending row in now (CLAIM ALL must stamp all of them). */
  const flushRows = () => {
    cancelAnimationFrame(streamRaf);
    streamRaf = 0;
    if (pending.length) appendRows(pending.length);
  };

  const acts: Record<string, (b: HTMLElement) => void> = {
      entry: (b) => openEntry(b.dataset.tab as CodexTab, b.dataset.id as string),
      filter: (b) => {
        app.sfx("uiMove");
        filter[tab] = b.dataset.id as string;
        animate = true;
        render();
      },
      cat: (b) => {
        app.sfx("uiMove");
        plot.cat = b.dataset.id as AchievementCategory | "all";
        animate = true;
        render();
      },
      pfilter: (b) => {
        app.sfx("uiMove");
        plot.filter = b.dataset.id as PlotFilter;
        animate = true;
        render();
      },
      claim: (b) => claimOne(b),
      claimall: (b) => claimAll(b),
      edit: (b) => denyEdit(b),
      gotab: (b) => {
        setQuery("");
        tab = b.dataset.id as Tab;
        animate = true;
        render();
      },
  };

  const notice = (t: Tab) => `<div class="wk-notice"><i class="wn-ic" aria-hidden="true">!</i><p>${esc(pickBy(NOTICES[t], `${t}:${save.profile.lifetime.runs}`))}</p></div>`;
  const listHead = (t: Tab) => `<header class="wk-art-h"><h2>${esc(TAB_INFO[t].title)}</h2><small>${esc(WIKI_FROM)}</small></header>${notice(t)}`;
  const listFoot = (t: Tab) =>
    `<footer class="wk-foot"><div><b>Talk:</b> ${esc(pickBy(TALK[t], `${t}:${save.profile.lifetime.runs}`))}</div><div><b>Categories:</b> ${esc(TAB_INFO[t].cats)}</div><div class="wk-ed">${editBtn()} this list? Bold of you.</div></footer>`;
  const editBtn = () => `<button class="wkp-edit" data-nav data-act="edit">[edit]</button>`;

  const tile = (e: WikiEntry, i: number) => {
    const rar = e.rarity && e.found ? ` rf r-${RARITY_CLS[e.rarity]}` : "";
    return `<button class="wk-tile t-${e.tab}${e.found ? "" : " stub"}${e.mastered ? " mastered" : ""}${rar}" data-nav data-act="entry" data-tab="${e.tab}" data-id="${esc(e.id)}" style="--i:${Math.min(i, 24)}" aria-label="${esc(e.found ? e.real : "Undiscovered entry")}">
        <span class="wt-art">${e.icon}</span><b>${esc(e.name)}</b>${e.found ? e.badge : `<small class="wk-hint">${esc(e.hint)}</small>`}
      </button>`;
  };

  // ---------------------------------------------------------------- codex list page
  const codexHtml = (t: CodexTab): string => {
    const p = save.profile;
    const list = tabEntries(p, t, ctx);
    const found = list.filter((e) => e.found).length;
    const f = filter[t] ?? "all";
    const chips = filtersFor(t, list);
    const shown = list.filter((e) => passes(e, f)).sort((a, b) => Number(b.found) - Number(a.found));
    const bounty = codexBounty(t);
    return `${listHead(t)}
      <div class="wk-prog">${pbar(list.length ? found / list.length : 0, `${found} / ${list.length} discovered`, "cyan")}${bounty > 0 ? `<small class="wk-bounty">+${bounty} ${currencyIcon("gems", false)} per find</small>` : ""}</div>
      <div class="wk-chips kscroll-x">${chips.map((c) => `<button class="wk-chip${f === c.id ? " on" : ""}" data-nav data-act="filter" data-id="${esc(c.id)}">${esc(c.label)}</button>`).join("")}</div>
      ${shown.length ? `<div class="wk-grid g-${t}">${shown.map(tile).join("")}</div>` : `<p class="wk-empty">Nothing matches. This list is a stub. You can help by playing more episodes.</p>`}
      ${listFoot(t)}`;
  };

  // ---------------------------------------------------------------- search page
  const searchHtml = (q: string): string => {
    const p = save.profile;
    const low = q.toLowerCase();
    const groups: string[] = [];
    let hits = 0;
    for (const t of CODEX_TABS) {
      const found = tabEntries(p, t, ctx).filter((e) => e.found && e.real.toLowerCase().includes(low));
      if (!found.length) continue;
      hits += found.length;
      groups.push(`<section class="ws-group"><h3><button class="wkl" data-nav data-act="gotab" data-id="${t}">${esc(TAB_INFO[t].label)}</button> <small>(${found.length})</small></h3><div class="wk-grid g-${t}">${found.slice(0, 24).map(tile).join("")}</div></section>`);
    }
    const plots = achievementViews(p, ctx).filter((v) => !v.secret && (v.name.toLowerCase().includes(low) || v.desc.toLowerCase().includes(low)));
    if (plots.length) {
      hits += plots.length;
      groups.push(`<section class="ws-group"><h3><button class="wkl" data-nav data-act="gotab" data-id="plot">PLOT POINTS</button> <small>(${plots.length})</small></h3><div class="pp-list">${plots.slice(0, 12).map(plotRow).join("")}</div></section>`);
    }
    const head = `<header class="wk-art-h"><h2>Search results for “${esc(q)}”</h2><small>${hits ? `${hits} article${hits === 1 ? "" : "s"} found. Undiscovered pages stay secret (no spoilers).` : esc(WIKI_FROM)}</small></header>`;
    if (!hits) return `${head}<div class="ws-none"><span class="ws-404">404</span><p>${esc(noResults(q))}</p><p class="wk-note">Tip: undiscovered entries don't show up. Go discover them.</p></div>`;
    return head + groups.join("");
  };

  // ---------------------------------------------------------------- articles
  const openEntry = (t: CodexTab, id: string) => {
    const p = save.profile;
    const known = p.codex[t].includes(id);
    app.sfx(known ? "cardFlip" : "uiDeny");
    const a = known ? articleFor(p, t, id, ctx) : stubFor(p, t, id, ctx);
    const cls = `wk-sheet t-${t}${known ? "" : " is-stub"}`;
    let s = sheet;
    if (s && !s.closed) {
      // a wiki link inside an open article: turn the page in place
      s.update({ title: a.title, kicker: a.kicker, icon: a.icon, html: a.html });
      const sec = s.el.querySelector(".ksheet");
      if (sec) sec.className = `ksheet ${cls}`;
      s.body.scrollTop = 0;
      const art = s.body.querySelector(".wkp");
      if (art && !reducedMotion() && typeof (art as HTMLElement).animate === "function")
        (art as HTMLElement).animate([{ transform: "translateX(18px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 220, easing: "cubic-bezier(0.2, 1, 0.4, 1)" });
    } else {
      s = openSheet(app, { title: a.title, kicker: a.kicker, icon: a.icon, html: a.html, cls, onClose: () => (sheet === s ? (sheet = null) : null) });
      sheet = s;
    }
    const sh = s;
    bindActs(sh.body, {
      profile: () => {
        sh.close();
        hub.open("hero", { hero: id });
      },
      link: (b) => {
        const tt = b.dataset.tab as CodexTab;
        const ii = b.dataset.id as string;
        if (tt === t && ii === id) return;
        openEntry(tt, ii);
      },
      edit: (b) => denyEdit(b),
      shout: (b) => {
        // the portrait shouts (frame 1) for a moment
        const d = ctx.heroById.get(id);
        if (!d) return;
        app.sfx("voiceBlip");
        b.innerHTML = portrait(d.portrait, 1, "ib-img");
        pop(b, 1.1);
        setTimeout(() => {
          if (b.isConnected) b.innerHTML = portrait(d.portrait, 0, "ib-img");
        }, 900);
      },
    });
    app.nav.refocus(sh.layer);
  };

  let editN = 0;
  const denyEdit = (b: HTMLElement) => {
    app.sfx("uiDeny");
    shake(b);
    hub.toast(EDIT_DENIED[editN++ % EDIT_DENIED.length], { kind: "bad", kicker: "EDIT REJECTED", ms: 2200 });
  };

  // ---------------------------------------------------------------- claims
  const flyRewards = (from: Element | null, gems: number, coins: number) => {
    const ui = app.ui;
    let landed = 0;
    const need = (gems ? 1 : 0) + (coins ? 1 : 0);
    const land = () => {
      if (++landed >= need) hub.changed();
    };
    if (!need) {
      hub.changed();
      return;
    }
    const chipG = from?.querySelector(".m-gems") ?? from;
    const chipC = from?.querySelector(".m-coins") ?? from;
    if (gems) flyCurrency(ui, chipG, hub.cbar.pill("gems"), "gems", Math.min(8, 3 + Math.round(gems / 60)), land);
    if (coins) flyCurrency(ui, chipC, hub.cbar.pill("coins"), "coins", Math.min(8, 3 + Math.round(coins / 300)), land);
  };

  /** Stamp a claimed row (it stops being claimable: no list re-render). */
  const stamp = (row: HTMLElement) => {
    row.classList.remove("can");
    row.classList.add("claimed");
    const st = row.querySelector(".pp-r");
    if (st) st.innerHTML = `<span class="pp-stamp hit">✓ CLAIMED</span>`;
  };

  /**
   * After a claim, in place: the CLAIM ALL block, the per-category claimable badges, the CLAIMABLE
   * chip and the tab badge. Under the CLAIMABLE filter the claimed rows fold away once stamped.
   */
  const afterClaim = (rows: HTMLElement[]) => {
    const sum = plotSummary(save.profile, ctx);
    tabBar.setBadge("plot", badge(unclaimedCount(save.profile)));
    const ready = body.querySelector(".pp-ready");
    const lab = ready?.querySelector(".pp-claimall .blab");
    const pre = ready?.querySelector(".pp-pre");
    if (sum.ready && lab && pre) {
      // (numbers only: the pulsing button stays, no new animation / style pass for it)
      lab.textContent = claimAllLabel(sum);
      pre.innerHTML = claimPreHtml(sum);
    } else if (ready) {
      ready.innerHTML = claimAllHtml(sum);
      bindActs(ready, acts);
    }
    for (const c of body.querySelectorAll<HTMLElement>(".pp-cat[data-id]")) {
      const n = c.dataset.id === "all" ? 0 : (sum.claimByCat[c.dataset.id as string] ?? 0);
      const bd = c.querySelector(".bdg");
      if (!n) bd?.remove();
      else if (bd) bd.textContent = String(n);
    }
    const chip = body.querySelector('.wk-chip[data-act="pfilter"][data-id="claim"]');
    if (chip) chip.innerHTML = claimChipHtml(sum.ready);
    if (plot.filter === "claim" && !query && tab === "plot") fold(rows);
  };

  /** Fold claimed rows out of the CLAIMABLE list (after the stamp lands); the empty note when none is left. */
  const fold = (rows: HTMLElement[]) => {
    const g = gen;
    const done = () => {
      if (g !== gen) return;
      for (const r of rows) r.remove();
      const list = body.querySelector(".pp-list");
      if (list && !list.querySelector(".pp")) list.innerHTML = emptyPlotHtml("claim");
    };
    if (reducedMotion() || !rows.length) return done();
    setTimeout(() => {
      if (g !== gen) return;
      let left = rows.length;
      for (const r of rows) {
        if (!r.isConnected || typeof r.animate !== "function") {
          if (--left === 0) done();
          continue;
        }
        r.style.overflow = "hidden";
        const a = r.animate([{ height: `${r.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px", marginTop: "-0.45em", borderWidth: "0px" }], { duration: 260, easing: "cubic-bezier(0.4, 0, 0.6, 1)", fill: "forwards" });
        a.onfinish = a.oncancel = () => {
          if (--left === 0) done();
        };
      }
    }, 700);
  };

  const claimOne = (b: HTMLElement) => {
    const id = b.dataset.id as string;
    const rowEl = b.closest(".pp") as HTMLElement | null;
    const r = claimAchievement(save.profile, id);
    if (!r.ok) return;
    save.save();
    app.sfx("currencyGain");
    if (rowEl) {
      stamp(rowEl);
      pop(rowEl, 1.04);
    }
    flyRewards(rowEl?.querySelector(".pp-rw") ?? rowEl, r.reward?.gems ?? 0, r.reward?.coins ?? 0);
    afterClaim(rowEl ? [rowEl] : []);
  };

  const claimAll = (b: HTMLElement) => {
    const r = claimAllAchievements(save.profile);
    if (!r.count) return;
    save.save();
    app.sfx("achievement");
    flushRows();
    const rows = [...body.querySelectorAll<HTMLElement>(".pp.can")];
    for (const row of rows) stamp(row);
    flyRewards(b.closest(".pp-claimall") ?? b, r.gems, r.coins);
    hub.toast(`${r.count} Plot Point reward${r.count === 1 ? "" : "s"} claimed!`, { kind: "good", reward: `${r.gems ? money("gems", `+${fmtInt(r.gems)}`) : ""}${r.coins ? money("coins", `+${fmtInt(r.coins)}`) : ""}` });
    afterClaim(rows);
  };

  // the search box is the nav item (Enter / A focuses the input); the clear button
  bindActs(el.querySelector(".wk-search") as HTMLElement, {
    search: () => input.focus(),
    clear: () => {
      setQuery("");
      animate = true;
      render();
      input.focus();
    },
  });
  // (a tap on the label focuses the input natively; the nav "click" from a key focuses it too)
  el.querySelector(".wk-search")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".ws-x")) return;
    input.focus();
  });

  render();
  if (deepEntry && tab !== "plot") {
    // (once the page is on the hub's stack: the article sheet opens over it)
    const t = tab;
    queueMicrotask(() => openEntry(t, deepEntry));
  }
  return {
    id: "wiki",
    el,
    title: "KIRA KIRA WIKI",
    layer,
    opaque: true,
    show() {
      render();
    },
    dispose() {
      clearTimeout(qTimer);
      gen++;
      cancelAnimationFrame(streamRaf);
      sheet?.close();
    },
  };
}
