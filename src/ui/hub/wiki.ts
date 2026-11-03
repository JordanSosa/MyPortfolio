/**
 * KIRA KIRA WIKI ("The Free Fan Encyclopedia Anyone Can't Edit", docs/EXPANSION.md
 * §11): tabs Heroes / Weapons / Passives / Enemies / Bosses / Relics / Stages
 * with found / total counters, discovered entries (art + name, mastery,
 * defeats, stars) and undiscovered silhouettes ("This article is a stub. You
 * can help by finding it." + the per-tab hint), an article sheet per entry
 * (wiki blurbs from the satire bible, stats, evolution recipes, records), and
 * the PLOT POINTS tab (achievements: categories, progress, rewards, CLAIM /
 * CLAIM ALL with the currency bar counting up).
 */
import { HEROES } from "../../game/heroes";
import { PASSIVES } from "../../game/passives";
import { BOSSES, ENEMIES, RELICS, STAGES, WEAPONS } from "../../game/registry";
import { achievementViews, claimAchievement, claimAllAchievements, unclaimedCount } from "../../meta/achievements/engine";
import { ACHIEVEMENT_CATEGORIES, CATEGORY_NAMES, type AchievementCategory } from "../../meta/achievements/types";
import { codexEntries, codexProgress, isDiscovered, weaponCodexInfo } from "../../meta/codex";
import { gameContent } from "../../meta/content";
import { masteryInfo } from "../../meta/economy";
import type { CodexTab } from "../../meta/profile";
import { unlockStatus } from "../../meta/unlocks";
import { esc, fmtInt, fmtTime, h, hasArt, img } from "../dom";
import { art, money, portrait, RARITY_CLS, rarityBadge, relicIcon, trophyIcon, unknownIcon } from "../kit/art";
import { badge, bindActs, btn, pbar, pop, sectionTitle, TabBar, tag } from "../kit/controls";
import { openSheet, type SheetHandle } from "../kit/overlay";
import { save } from "../save";
import { WIKI, BIOS } from "./copy-data";
import { pageLayer, type Hub, type HubPage, type PageOpts } from "./hub";
import { clock, stageRecords, stageThumb, starPips } from "./parts";

type Tab = CodexTab | "plot";
const TABS: Tab[] = ["plot", "heroes", "weapons", "passives", "enemies", "bosses", "relics", "stages"];
const TAB_LABEL: Record<Tab, string> = { plot: "PLOT POINTS", heroes: "HEROES", weapons: "WEAPONS", passives: "PASSIVES", enemies: "ENEMIES", bosses: "BOSSES", relics: "MERCH", stages: "STAGES" };
const STUB = "This article is a stub. You can help by finding it.";

/** Where an enemy appears / when a boss arrives (codex hints). */
function whereIs(id: string, boss: boolean): string {
  for (const s of STAGES.values()) {
    if (boss) {
      const ev = s.events.find((e) => e.kind === "boss" && e.enemy === id);
      if (ev) return `Arrives at ${clock(ev.at)} in ${s.name}.`;
      if (s.finalBoss === id) return `The finale of ${s.name}.`;
    } else if (s.phases.some((ph) => id in ph.mix) || s.events.some((e) => e.enemy === id)) return `Appears in ${s.name}.`;
  }
  return boss ? "Arrives in a later episode." : "Appears in a later episode.";
}

export function wikiPage(hub: Hub, o: PageOpts): HubPage {
  const app = hub.app;
  const ctx = gameContent();
  const el = h("div", "wiki");
  const layer = pageLayer(hub);
  let tab: Tab = (TABS as string[]).includes(o.tab ?? "") ? (o.tab as Tab) : unclaimedCount(save.profile) > 0 ? "plot" : "heroes";
  let cat: AchievementCategory | "all" = "all";
  let sheet: SheetHandle | null = null;

  el.innerHTML = `<div class="wk-head"><small>The Free Fan Encyclopedia Anyone Can't Edit</small></div><div class="wk-tabs"></div><div class="wk-body kscroll"></div>`;
  const body = el.querySelector(".wk-body") as HTMLElement;
  const tabBar = new TabBar(
    TABS.map((t) => ({ id: t, label: TAB_LABEL[t], badge: t === "plot" ? badge(unclaimedCount(save.profile)) : "" })),
    tab,
    (t) => {
      app.sfx("tabSwitch");
      tab = t as Tab;
      render();
      body.scrollTop = 0;
    },
  );
  (el.querySelector(".wk-tabs") as HTMLElement).appendChild(tabBar.el);

  const render = () => {
    tabBar.setBadge("plot", badge(unclaimedCount(save.profile)));
    body.innerHTML = tab === "plot" ? plotHtml() : codexHtml(tab);
    bindActs(body, {
      entry: (b) => openEntry(tab as CodexTab, b.dataset.id as string),
      cat: (b) => {
        app.sfx("uiMove");
        cat = b.dataset.id as AchievementCategory | "all";
        render();
      },
      claim: (b) => {
        const r = claimAchievement(save.profile, b.dataset.id as string);
        if (!r.ok) return;
        app.sfx("currencyGain");
        hub.changed();
        pop(b.closest(".ach"), 1.05);
        setTimeout(render, 160);
      },
      claimall: () => {
        const r = claimAllAchievements(save.profile);
        if (!r.count) return;
        app.sfx("achievement");
        hub.changed();
        hub.toast(`${r.count} Plot Point reward${r.count === 1 ? "" : "s"} claimed!`, { kind: "good", reward: `${r.gems ? money("gems", `+${fmtInt(r.gems)}`) : ""}${r.coins ? money("coins", `+${fmtInt(r.coins)}`) : ""}` });
        render();
      },
    });
  };

  // ---------------------------------------------------------------- codex grid
  const codexHtml = (t: CodexTab): string => {
    const p = save.profile;
    const ids = codexEntries(t, ctx);
    const pr = codexProgress(p, ctx).find((x) => x.tab === t);
    const tiles = ids
      .map((id, i) => {
        const found = isDiscovered(p, t, id);
        const ic = found ? entryIcon(t, id) : silhouette(t, id);
        const name = found ? esc(ctx.heroById.get(id)?.name ?? ctx.weapons.get(id)?.name ?? ctx.passives.get(id)?.name ?? ctx.enemies.get(id)?.name ?? ctx.bosses.get(id)?.name ?? RELICS.get(id)?.name ?? ctx.stageById.get(id)?.name ?? id) : "???";
        let extra = "";
        if (found && t === "weapons") {
          const m = weaponCodexInfo(p, id);
          extra = m.mastered ? tag("MASTERED", "gold") : m.mastery > 0 ? `<small class="wk-x">M${m.mastery}</small>` : "";
        } else if (found && t === "relics") {
          const st = p.relics[id];
          extra = st !== undefined ? `<small class="wk-x">★${st}</small>` : "";
        } else if (found && (t === "enemies" || t === "bosses")) {
          const k = t === "enemies" ? (p.lifetime.killsByEnemy[id] ?? 0) : (p.lifetime.bossKills[id] ?? 0);
          extra = `<small class="wk-x">×${fmtInt(k)}</small>`;
        }
        const rar = t === "relics" ? RELICS.get(id)?.rarity : undefined;
        // undiscovered: the silhouette + its hint ("Defeat 1,000 Puffs.") right on the tile (relics only say "???")
        if (!found && t !== "relics") extra = `<small class="wk-hint">${esc(hintFor(t, id))}</small>`;
        return `<button class="wk-tile${found ? "" : " stub"}${rar && found ? ` rf r-${RARITY_CLS[rar]}` : ""}" data-nav data-act="entry" data-id="${esc(id)}" style="--i:${Math.min(i, 30)}">${ic}<b>${name}</b>${extra}</button>`;
      })
      .join("");
    return `<div class="wk-prog"><span>${TAB_LABEL[t]}</span>${pbar(pr && pr.total ? pr.found / pr.total : 0, `${pr?.found ?? 0} / ${pr?.total ?? 0} discovered`, "cyan")}</div>
      ${ids.length ? `<div class="wk-grid">${tiles}</div>` : `<p class="lo-note">Nothing here yet. The fans are still writing it.</p>`}`;
  };

  const entryIcon = (t: CodexTab, id: string): string => {
    switch (t) {
      case "heroes":
        return portrait(ctx.heroById.get(id)?.portrait ?? "", 0, "wk-ic");
      case "weapons":
      case "passives": {
        const ic = ctx.weapons.get(id)?.icon ?? ctx.passives.get(id)?.icon ?? "";
        return hasArt(ic) ? img(ic, "px wk-ic") : unknownIcon("wk-ic");
      }
      case "enemies":
      case "bosses": {
        const sp = (t === "enemies" ? ENEMIES.get(id) : BOSSES.get(id))?.sprite ?? "";
        return hasArt(sp) ? img(sp, "px wk-ic spr") : unknownIcon("wk-ic");
      }
      case "relics": {
        const d = RELICS.get(id);
        return d ? relicIcon(id, d.rarity, "wk-ic") : unknownIcon("wk-ic");
      }
      case "stages":
        return `<span class="wk-ic st">${stageThumb(ctx.stageById.get(id))}</span>`;
    }
  };

  /** Undiscovered entry: its real art as a dark silhouette (heroes, weapons, passives, enemies, bosses), else "?". */
  const silhouette = (t: CodexTab, id: string): string => {
    let sp = "";
    if (t === "heroes") sp = ctx.heroById.get(id)?.portrait ?? "";
    else if (t === "weapons" || t === "passives") sp = ctx.weapons.get(id)?.icon ?? ctx.passives.get(id)?.icon ?? "";
    else if (t === "enemies") sp = ENEMIES.get(id)?.sprite ?? "";
    else if (t === "bosses") sp = BOSSES.get(id)?.sprite ?? "";
    return sp && hasArt(sp) ? img(sp, `px wk-ic sil${t === "enemies" || t === "bosses" ? " spr" : ""}`) : unknownIcon("wk-ic");
  };

  const hintFor = (t: CodexTab, id: string): string => {
    const p = save.profile;
    switch (t) {
      case "heroes":
        return unlockStatus(p, "hero", id, ctx).rule.hint || "Appears in a later episode.";
      case "weapons":
      case "passives": {
        const st = unlockStatus(p, t === "weapons" ? "weapon" : "passive", id, ctx);
        if (st.rule.hint) return `${st.rule.hint}${st.target > 1 ? ` (${fmtInt(st.value)} / ${fmtInt(st.target)})` : ""}`;
        return "Pick it up in an episode to write its article.";
      }
      case "enemies":
        return whereIs(id, false);
      case "bosses":
        return whereIs(id, true);
      case "relics":
        return "Available in the Merch Machine. Allegedly.";
      case "stages": {
        const s = ctx.stageById.get(id);
        const prev = s ? ctx.stages.find((x) => x.order === s.order - 1) : undefined;
        return prev ? `Unlocks after ${prev.name}.` : "Play an episode.";
      }
    }
  };

  const blurb = (name: string): string => {
    const w = WIKI[name];
    return w ? `<p class="wk-trope">Trope: <b>${esc(w.trope)}</b></p><p>${esc(w.text)}</p><p class="wk-triv"><b>Trivia:</b> ${esc(w.trivia)}</p>` : "";
  };

  const openEntry = (t: CodexTab, id: string) => {
    const p = save.profile;
    app.sfx("uiConfirm");
    if (!isDiscovered(p, t, id)) {
      sheet = openSheet(app, { title: "???", kicker: `${TAB_LABEL[t]} · UNDISCOVERED`, icon: unknownIcon("pimg"), html: `<p class="stub">${STUB}</p><p class="hint">${esc(hintFor(t, id))}</p>`, onClose: () => (sheet = null) });
      return;
    }
    let title = id;
    let kicker = TAB_LABEL[t];
    let icon = entryIcon(t, id);
    let html = "";
    if (t === "heroes") {
      const d = HEROES.find((x) => x.id === id);
      title = d?.name ?? id;
      kicker = d?.title.toUpperCase() ?? kicker;
      const bio = BIOS[id];
      html = `${bio ? `<pre class="wk-bio">${esc(bio)}</pre>` : ""}<p>${esc(d?.trait ?? "")}</p>${btn("OPEN PROFILE", { cls: "small violet", act: "profile" })}`;
    } else if (t === "weapons") {
      const d = WEAPONS.get(id);
      const evo = d?.evolution ? WEAPONS.get(d.evolution.into) : undefined;
      const partner = d?.evolution ? PASSIVES.find((x) => x.id === d.evolution?.with) : undefined;
      const m = weaponCodexInfo(p, id);
      const mi = masteryInfo(p.mastery[id] ?? 0);
      title = d?.name ?? id;
      html = `<p>${esc(d?.desc ?? "")}</p>
        ${sectionTitle("Mastery")}
        <div class="wk-mast">${pbar(mi.maxed ? 1 : mi.into / mi.need, mi.maxed ? "MASTERED" : `RANK ${mi.rank} · ${fmtInt(mi.into)} / ${fmtInt(mi.need)}`, "gold")}${mi.rank >= 5 ? tag("LIMIT BREAK", "rainbow") : ""}${m.mastered ? tag("MASTERED", "gold") : ""}</div>
        <p class="muted">+3% damage per rank · rank 5: max level 6 · rank 10: max level 7</p>
        ${sectionTitle("Record")}<p>Defeated <b>${fmtInt(m.kills)}</b> · Damage <b>${fmtInt(m.damage)}</b></p>
        ${evo ? `${sectionTitle("Evolution")}<div class="wk-evo">${img(d?.icon ?? "", "px")}<span>Lv5 +</span>${img(partner?.icon ?? "", "px")}<span>→</span>${img(evo.icon, "px")}<b>${esc(evo.name)}</b></div><p class="muted">${esc(evo.desc)}</p>` : ""}`;
    } else if (t === "passives") {
      const d = PASSIVES.find((x) => x.id === id);
      title = d?.name ?? id;
      html = `<ol class="wk-levels">${(d?.levels ?? []).map((l) => `<li>${esc(l)}</li>`).join("")}</ol>`;
    } else if (t === "enemies" || t === "bosses") {
      const d = t === "enemies" ? ENEMIES.get(id) : BOSSES.get(id);
      title = d?.boss ? d.boss.title : (d?.name ?? id);
      kicker = d?.boss ? d.boss.subtitle.toUpperCase() : kicker;
      const kills = t === "enemies" ? (p.lifetime.killsByEnemy[id] ?? 0) : (p.lifetime.bossKills[id] ?? 0);
      html = `${blurb(d?.name ?? "") || blurb(title)}<p class="wk-def">Defeated: <b>${fmtInt(kills)}</b></p><p class="muted">${esc(whereIs(id, t === "bosses"))}</p>`;
    } else if (t === "relics") {
      const d = RELICS.get(id);
      const st = p.relics[id] ?? 0;
      title = d?.name ?? id;
      kicker = d ? `${d.rarity} MERCH` : kicker;
      html = d ? `<div class="wk-rel">${rarityBadge(d.rarity)}${starPips(st)}</div><p>${esc(d.desc(st))}</p><p class="wk-triv">“${esc(d.flavor)}”</p>${st < 6 ? `<p class="muted">Next star: ${esc(d.desc(st + 1))}</p>` : ""}` : "";
    } else if (t === "stages") {
      const s = ctx.stageById.get(id);
      title = s?.name ?? id;
      kicker = s?.subtitle.toUpperCase() ?? kicker;
      icon = "";
      html = `<div class="wk-stage">${stageThumb(s)}</div><p>${esc(s?.blurb ?? "")}</p><div class="ep-recs">${stageRecords(p.records[id], s)}</div><p class="muted">Length ${fmtTime(s?.duration ?? 0)} · Ratings ×${(s?.rewardMul ?? 1).toFixed(1)}</p>`;
    }
    sheet = openSheet(app, { title, kicker, icon, html, onClose: () => (sheet = null) });
    const s = sheet;
    bindActs(s.el, {
      profile: () => {
        s.close();
        hub.open("hero", { hero: id });
      },
    });
  };

  // ---------------------------------------------------------------- Plot Points
  const plotHtml = (): string => {
    const p = save.profile;
    const all = achievementViews(p, ctx);
    const views = cat === "all" ? all : all.filter((v) => v.def.category === cat);
    const done = all.filter((v) => v.done).length;
    const unclaimed = unclaimedCount(p);
    const chips = [`<button class="chip${cat === "all" ? " on" : ""}" data-nav data-act="cat" data-id="all">ALL</button>`, ...ACHIEVEMENT_CATEGORIES.map((c) => `<button class="chip${cat === c ? " on" : ""}" data-nav data-act="cat" data-id="${c}">${esc(CATEGORY_NAMES[c].toUpperCase())}</button>`)].join("");
    const order = [...views].sort((a, b) => Number(b.done && !b.claimed) - Number(a.done && !a.claimed) || Number(a.done) - Number(b.done) || b.progress / b.target - a.progress / a.target);
    const rows = order
      .map((v) => {
        const r = v.def.reward;
        const rw = [r.gems ? money("gems", `+${fmtInt(r.gems)}`) : "", r.coins ? money("coins", `+${fmtInt(r.coins)}`) : "", r.title ? tag(`TITLE: ${r.title}`, "pink") : "", r.unlock ? tag("UNLOCK", "cyan") : ""].join("");
        const right = v.done ? (v.claimed || (!r.gems && !r.coins) ? tag("✓ DONE", "green") : btn("CLAIM", { cls: "gold small", act: "claim", attrs: `data-id="${v.def.id}"` })) : "";
        return `<div class="ach${v.done ? " done" : ""}${v.secret ? " secret" : ""}">
          <span class="ach-ic">${v.secret ? unknownIcon("aico") : art(v.def.icon ?? "icon_trophy", trophyIcon("aico"), "px aico")}</span>
          <span class="ach-tx"><b>${esc(v.name)}</b><small>${esc(v.desc)}</small>${v.done ? "" : pbar(v.progress / v.target, `${fmtInt(v.progress)} / ${fmtInt(v.target)}`, "violet")}<span class="ach-rw">${rw}</span></span>
          <span class="ach-r">${right}</span>
        </div>`;
      })
      .join("");
    return `<div class="wk-prog"><span>PLOT POINTS</span>${pbar(all.length ? done / all.length : 0, `${done} / ${all.length} unlocked`, "gold")}</div>
      ${unclaimed ? `<div class="claim-all">${btn(`CLAIM ALL (${unclaimed})`, { cls: "gold small", act: "claimall", def: true })}</div>` : ""}
      <div class="ach-cats kscroll-x">${chips}</div>
      <div class="ach-list">${rows}</div>`;
  };

  render();
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
      sheet?.close();
    },
  };
}
