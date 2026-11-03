/**
 * HUB HOME (replaces the title screen): logo + season tag, the selected hero
 * in a big "OC profile" frame (portrait, sparkly name, level, constellation,
 * bio snippet; tap = the Heroes page), PLAY, the four hub tiles (TRAINING ARC,
 * HEROES, MERCH MACHINE, WIKI) with notification badges, and the NARRATOR's
 * speech bubble (docs/content/satire.md §1, §7, §8): "Previously on Kira Kira
 * Overdrive…" + the last run's recap, then rotating loading tips and teasers,
 * typed out letter by letter; tap it for the next line. The live attract game
 * runs in the gap between the profile card and PLAY (portrait) or between the
 * columns (landscape).
 */
import { HEROES, heroDef } from "../../game/heroes";
import { affordableNodes } from "../../meta/board/board";
import { gameContent } from "../../meta/content";
import { heroLevelInfo } from "../../meta/economy";
import { bannerViews } from "../../meta/gacha/banners";
import { talentPoints } from "../../meta/heroes";
import { defaultHeroProgress } from "../../meta/profile";
import { unclaimedCount } from "../../meta/achievements/engine";
import { esc, fmtInt, fmtTime, h, letters } from "../dom";
import { art, portrait } from "../kit/art";
import { badge, bindActs, pbar, pop } from "../kit/controls";
import { save } from "../save";
import { BIOS } from "./copy-data";
import { fill, MENU_SUB, narratorLine, TAGLINE, tip } from "./copy";
import { reducedMotion } from "../kit/ticker";
import { pageLayer, type Hub, type HubPage } from "./hub";

/** "~*~☆ HOSHI ☆~*~" (the bio's sparkly header) and two short lines from it. */
export function bioBits(heroId: string, name: string): { header: string; lines: string[] } {
  const bio = BIOS[heroId];
  if (!bio) return { header: `~*~ ${name.toUpperCase()} ~*~`, lines: [] };
  const rows = bio.split("\n");
  const header = (rows[0] ?? "").split("  ")[0].trim() || `~*~ ${name} ~*~`;
  const lines = rows.filter((r) => /^(Likes|Power level):/.test(r)).slice(0, 2);
  return { header, lines };
}

export function homePage(hub: Hub): HubPage {
  const app = hub.app;
  const el = h("div", "home");
  const layer = pageLayer(hub, () => {});
  let tipT = 0;
  let narrN = 0;
  let typed = { text: "", shown: 0, t: 0 };
  let anchor: { x: number; y: number } | null = null;
  let anchorDirty = true;

  let rendered = false;
  const render = () => {
    // re-renders (back from a page, profile changes) must not replay the entry pops
    if (rendered) el.classList.add("settled");
    rendered = true;
    const p = save.profile;
    const heroId = HEROES.some((d) => d.id === p.loadout.hero) ? p.loadout.hero : HEROES[0].id;
    const hd = heroDef(heroId);
    const hp = p.heroes[heroId] ?? defaultHeroProgress();
    const li = heroLevelInfo(hp.xp);
    const bits = bioBits(heroId, hd.name);
    const ep = p.lifetime.runs + 1;
    const stage = gameContent().stageById.get(p.loadout.stage);
    const cons = Array.from({ length: 6 }, (_, i) => `<i class="${i < hp.constellation ? "on" : ""}"></i>`).join("");
    const recapText = recap();
    const minis = HEROES.slice(0, 3)
      .map((d, i) => `<span class="mini" style="--i:${i};--hc:${app.heroColor(d.id)}">${portrait(d.portrait, 0, "pimg", !p.unlocks.heroes.includes(d.id))}</span>`)
      .join("");
    el.innerHTML = `
      <div class="home-logo">
        <div class="logo mini-logo">
          <span class="l1">${letters("KIRA")}<span class="star">☆</span>${letters("KIRA")}</span>
          <span class="l2">${letters("OVERDRIVE", "ltr", 0.07)}</span>
          <div class="shine"></div>
        </div>
        <div class="season"><span class="s2">SEASON 2</span><span class="tagline">${esc(TAGLINE)}</span></div>
      </div>
      <button class="oc-card" data-nav data-act="hero" style="--hc:${app.heroColor(heroId)}" aria-label="${esc(hd.name)}: open the cast">
        <span class="oc-head"><b>${esc(bits.header)}</b><span class="oc-ep">EP. ${fmtInt(ep)}</span></span>
        <span class="oc-por">${portrait(hd.portrait, 0, "pimg")}<i class="oc-glow"></i></span>
        <span class="oc-info">
          <span class="oc-tt">${esc(hd.title.toUpperCase())}</span>
          <span class="oc-lv"><b>LV ${li.level}</b>${pbar(li.maxed ? 1 : li.into / li.need, "", "gold")}</span>
          <span class="oc-cons" aria-label="Constellation C${hp.constellation}"><small>C${hp.constellation}</small>${cons}</span>
          ${bits.lines.map((l, i) => `<span class="oc-bio b${i + 1}">${esc(l)}</span>`).join("")}
        </span>
        <span class="oc-sticker">DO NOT STEAL!!</span>
        <span class="oc-more">CAST ▸</span>
      </button>
      <div class="home-gap" aria-hidden="true"></div>
      <div class="home-menu">
        <button class="btn gold play two" data-nav data-nav-default data-act="play">
          <span class="play-ic">▶</span><span class="btxt"><span class="blab">PLAY</span><small class="bsub">${esc(MENU_SUB.play)} · EP. ${fmtInt(ep)}${stage ? ` · ${esc(stage.name)}` : ""}</small></span>
        </button>
        <div class="home-tiles">
          ${tile("board", "TRAINING ARC", MENU_SUB.board, art("board_center", `<i class="emb emb-board"></i>`, "px emb-img"), "t-board")}
          ${tile("heroes", "HEROES", MENU_SUB.heroes, `<span class="emb emb-cast">${minis}</span>`, "t-heroes")}
          ${tile("gacha", "MERCH MACHINE", MENU_SUB.gacha, art("ui_merch_machine", `<i class="emb emb-gacha"><i></i></i>`, "px emb-img"), "t-gacha")}
          ${tile("wiki", "KIRA KIRA WIKI", MENU_SUB.wiki, art("icon_codex_unknown", `<i class="emb emb-wiki"></i>`, "px emb-img"), "t-wiki")}
        </div>
      </div>
      <button class="home-foot home-narr" type="button" data-act="narr" aria-label="Narrator: next line">
        <span class="hn-av" aria-hidden="true"><i class="hn-mic"></i></span>
        <span class="hn-b"><small class="hn-k">${recapText ? "PREVIOUSLY ON…" : "NARRATOR"}</small><span class="hn-t" aria-live="polite"></span><i class="hn-caret" aria-hidden="true"></i></span>
      </button>`;
    bindActs(el, {
      play: () => {
        app.sfx("uiConfirm");
        hub.open("stages");
      },
      hero: (b) => {
        app.sfx("cardFlip");
        // the portrait shouts for a moment, then the cast opens
        const im = b.querySelector<HTMLImageElement>(".oc-por img");
        if (im) im.outerHTML = portrait(hd.portrait, 1, "pimg");
        pop(b.querySelector(".oc-por"), 1.08);
        setTimeout(() => hub.open("hero", { hero: heroId }), 140);
      },
      board: () => hub.open("board"),
      heroes: () => hub.open("heroes"),
      gacha: () => hub.open("gacha"),
      wiki: () => hub.open("wiki"),
      narr: () => {
        app.sfx("uiMove");
        nextLine();
      },
    });
    narrN = 0;
    nextLine();
    refreshBadges();
    anchorDirty = true;
  };

  const tile = (act: string, label: string, sub: string, emblem: string, cls: string) =>
    `<button class="htile ${cls}" data-nav data-act="${act}"><span class="ht-emb">${emblem}</span><span class="ht-tx"><b>${label}</b><small>${esc(sub)}</small></span><span class="ht-bdg"></span></button>`;

  /** The narrator's next line: the recap first (when there is one), then tips, with a teaser now and then. */
  const narrLine = (): { k: string; t: string } => {
    const n = narrN++;
    const r = recap();
    if (n === 0 && r) return { k: "PREVIOUSLY ON…", t: r };
    const p = save.profile;
    const f = { hero: heroDef(p.loadout.hero).name, stage: gameContent().stageById.get(p.loadout.stage)?.name ?? "", n: p.lifetime.runs + 1 };
    if (n === 0) return { k: "NARRATOR", t: narratorLine(p.lifetime.runs + 1 === 100 ? "run100" : "runStart", f) };
    if (n % 5 === 3) return { k: "NARRATOR", t: fill(n % 10 === 3 ? "No dailies. We respect your time. We respect nothing else." : "Episode {n}! Will {hero} finally make it to the end? (Statistically, no.)", f) };
    return { k: "TIP", t: tip() };
  };
  const nextLine = () => {
    const l = narrLine();
    const k = el.querySelector(".hn-k");
    const tEl = el.querySelector(".hn-t");
    if (!k || !tEl) return;
    k.textContent = l.k;
    tipT = 0;
    typed = { text: l.t, shown: 0, t: 0 };
    if (reducedMotion()) {
      typed.shown = l.t.length;
      tEl.textContent = l.t;
    } else tEl.textContent = "";
    el.querySelector(".home-narr")?.classList.toggle("typing", typed.shown < typed.text.length);
    pop(el.querySelector(".hn-av"), 1.12);
  };

  const recap = (): string => {
    const r = app.lastReport;
    if (!r) return "";
    return `${r.heroName} survived ${fmtTime(r.time)} in ${r.stageName} and defeated ${fmtInt(r.kills)} plushies.`;
  };

  const refreshBadges = () => {
    const p = save.profile;
    const ctx = gameContent();
    const set = (act: string, html: string) => {
      const slot = el.querySelector(`[data-act="${act}"] .ht-bdg`);
      if (slot) slot.innerHTML = html;
    };
    set("board", badge(affordableNodes(p, ctx).length > 0));
    const freePts = HEROES.some((d) => p.unlocks.heroes.includes(d.id) && ctx.talents.has(d.id) && talentPoints(p.heroes[d.id] ?? defaultHeroProgress()).free > 0);
    set("heroes", badge(freePts));
    const views = bannerViews(p, ctx);
    set("gacha", badge(views.some((v) => v.canPull1 || v.sparkReady)));
    set("wiki", badge(unclaimedCount(p)));
  };

  render();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => (anchorDirty = true)) : null;
  ro?.observe(el);

  return {
    id: "home",
    el,
    title: "",
    layer,
    music: "hub",
    camAnchor() {
      if (anchorDirty) {
        anchorDirty = false;
        const g = el.querySelector(".home-gap") as HTMLElement | null;
        const r = g?.getBoundingClientRect();
        anchor = r && r.height > 48 && r.width > 48 ? { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height * 0.62) / innerHeight } : null;
      }
      return anchor;
    },
    show() {
      render();
      app.nav.refocus(layer);
    },
    update(dt) {
      // typewriter (one small element; text changes only when a letter is added), then the next line after a read
      if (typed.shown < typed.text.length) {
        typed.t += dt;
        const n = Math.min(typed.text.length, Math.floor(typed.t * 40));
        if (n !== typed.shown) {
          typed.shown = n;
          const tEl = el.querySelector(".hn-t");
          if (tEl) tEl.textContent = typed.text.slice(0, n);
          if (n >= typed.text.length) el.querySelector(".home-narr")?.classList.remove("typing");
        }
        return;
      }
      tipT += dt;
      if (tipT > 7 + typed.text.length * 0.03) nextLine();
    },
    dispose() {
      ro?.disconnect();
    },
  };
}
