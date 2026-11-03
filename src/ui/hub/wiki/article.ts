/**
 * Kira Kira Wiki articles: one parody wiki page per entry, opened in the kit
 * sheet (bottom sheet on portrait phones, side panel on landscape / desktop).
 *
 *   paper page   "From Kira Kira Wiki, the free fan encyclopedia", an optional
 *                "(Redirected from …)", an infobox (art + table), the lead,
 *                sections with [edit] links (every edit is rejected, funnily),
 *                [citation needed] markers, a footer with categories, the
 *                last editor and a talk-page excerpt
 *   heroes       OC bio (heroes.md §5, verbatim), signature weapon, Overdrive,
 *                constellations C1-C6, profile stats, OPEN PROFILE
 *   weapons      level table Lv1-5 + Limit Break Lv6 / Lv7 rows (locked until
 *                mastery 5 / 10), mastery bar, evolution recipe (hidden until
 *                the evolution has been discovered), record
 *   passives     level texts, the evolutions it enables
 *   enemies      stats, trope blurb (satire.md §10), kill count, speech lines
 *   bosses       name card, arrival, defeats, taunts, the "death by" quote
 *   relics       rarity, stars ★0-★6 (the current one lit), flavour, printed rate
 *   stages       thumbnail, length, bosses, enemies, records, notable episodes
 *
 * Internal links are wiki links: a discovered target is blue, an undiscovered
 * one is a red link to its stub. Pure markup + one opener.
 */
import type { RelicDef } from "../../../game/defs";
import { HEROES } from "../../../game/heroes";
import { PASSIVES } from "../../../game/passives";
import { BOSSES, ENEMIES, RELICS, STAGES, ULTIMATES, WEAPONS } from "../../../game/registry";
import type { WeaponDef } from "../../../game/types";
import { isDiscovered, weaponCodexInfo } from "../../../meta/codex";
import type { MetaContent } from "../../../meta/content";
import { heroLevelInfo, masteryInfo } from "../../../meta/economy";
import { defaultHeroProgress, type CodexTab, type Profile } from "../../../meta/profile";
import { SPEECH_POOLS } from "../../../view/speech";
import { esc, fmtInt, fmtTime, hasArt, img } from "../../dom";
import { portrait, RARITY_CLS, rarityBadge, relicIcon, unknownIcon } from "../../kit/art";
import { pbar } from "../../kit/controls";
import { BIOS, BOSS_DEATH_LINES, EPISODE_TITLES, WIKI } from "../copy-data";
import { fill } from "../copy";
import { clock, ratingMul, stageRecords, stageThumb } from "../parts";
import { BOSS_TAUNTS, CITES, EDIT_AGO, EDITORS, pickBy, RATE, REDIRECTS, STUB, TAB_INFO, TALK, WIKI_FROM } from "./copy";
import { entryIcon, entryName, hintFor, silhouette, whereIs } from "./entries";

export interface Article {
  title: string;
  kicker: string;
  icon: string;
  html: string;
}

// ---------------------------------------------------------------- small markup helpers
const cite = (seed: string) => `<sup class="wkp-cn">${esc(pickBy(CITES, seed))}</sup>`;
const editLink = () => `<button class="wkp-edit" data-nav data-act="edit" aria-label="Edit this section">[edit]</button>`;
const h3 = (text: string) => `<h3 class="wkp-h">${esc(text)}${editLink()}</h3>`;
const row = (k: string, v: string) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;

/** A wiki link to another entry: blue when discovered, red (stub) when not. */
export function wlink(p: Profile, tab: CodexTab, id: string, ctx: MetaContent, label?: string): string {
  const found = isDiscovered(p, tab, id);
  const text = found ? (label ?? entryName(tab, id, ctx)) : "???";
  return `<button class="wkl${found ? "" : " red"}" data-nav data-act="link" data-tab="${tab}" data-id="${esc(id)}">${esc(text)}</button>`;
}

/** Satire blurb for a display name (exact, else a key that starts with it: "CANCEL-SAMA" -> "CANCEL-SAMA, the Network Executive"). */
function blurbFor(...names: string[]): { trope: string; text: string; trivia: string } | undefined {
  for (const n of names) if (n && WIKI[n]) return WIKI[n];
  const keys = Object.keys(WIKI);
  for (const n of names) {
    if (!n) continue;
    const low = n.toLowerCase();
    const k = keys.find((x) => x.toLowerCase().startsWith(low) || low.startsWith(x.toLowerCase()));
    if (k) return WIKI[k];
  }
  return undefined;
}

function infobox(title: string, art: string, rows: string, cls = ""): string {
  return `<aside class="wkp-box ${cls}"><div class="ib-t">${esc(title)}</div><div class="ib-art">${art}</div><table class="ib-tab">${rows}</table></aside>`;
}

function footer(p: Profile, tab: CodexTab, id: string): string {
  const seed = `${tab}:${id}`;
  return `<footer class="wkp-foot">
      <div class="wkp-cats"><b>Categories:</b> ${esc(TAB_INFO[tab].cats)}</div>
      <div class="wkp-talk"><b>Talk:</b> ${esc(pickBy(TALK[tab], seed))}</div>
      <div class="wkp-ed">This page was last edited ${esc(pickBy(EDIT_AGO, seed + "a"))} ago by <i>${esc(pickBy(EDITORS, seed + "e"))}</i>. Content is available under the Do Not Steal License${cite(seed + "f")}.</div>
    </footer>`;
}

function page(p: Profile, tab: CodexTab, id: string, body: string): string {
  const redir = REDIRECTS[id];
  return `<article class="wkp" data-tab="${tab}">
      <div class="wkp-from">${esc(WIKI_FROM)}</div>
      ${redir ? `<div class="wkp-redir">(Redirected from <i>${esc(redir)}</i>)</div>` : ""}
      ${body}
      ${footer(p, tab, id)}
    </article>`;
}

// ---------------------------------------------------------------- per-tab articles
function heroArticle(p: Profile, id: string, ctx: MetaContent): Article {
  const d = HEROES.find((x) => x.id === id);
  const name = d?.name ?? id;
  const hp = p.heroes[id] ?? defaultHeroProgress();
  const owned = p.unlocks.heroes.includes(id);
  const li = heroLevelInfo(hp.xp);
  const ult = d ? ULTIMATES.get(d.ult) : undefined;
  const cons = d?.constellations ?? [];
  const rows = [
    row("Title", esc(d?.title ?? "")),
    row("Signature", d ? wlink(p, "weapons", d.weapon, ctx) : "—"),
    row("Overdrive", esc(ult?.name ?? "—")),
    row("Status", owned ? `<b class="ok">In the cast</b>` : `<i>Not in the cast (yet)</i>`),
    owned ? row("Level", `${li.level}${li.maxed ? " (MAX)" : ""}`) : "",
    owned ? row("Constellation", `C${hp.constellation}`) : "",
    owned ? row("Episodes", `${fmtInt(hp.runs)} aired · ${fmtInt(hp.clears)} cleared`) : "",
    owned && hp.bestTime > 0 ? row("Best time", fmtTime(hp.bestTime)) : "",
  ].join("");
  const bio = BIOS[id];
  const body = `
    ${infobox(name, `<button class="ib-por" data-act="shout" aria-label="${esc(name)} (tap)">${portrait(d?.portrait ?? "", 0, "ib-img")}</button>`, rows, "hero")}
    <p class="wkp-lead"><b>${esc(name)}</b> (${esc(d?.title ?? "")}) is a main character of <i>Kira Kira Overdrive</i>.${cite(id)} ${esc(d?.trait ?? "")}</p>
    ${h3("Fan profile")}
    ${bio ? `<pre class="wkp-bio">${esc(bio)}</pre>` : `<p>${esc(STUB)}</p>`}
    ${
      cons.length
        ? `${h3("Constellations")}<ol class="wkp-cons">${cons
            .map((c, i) => `<li class="${owned && i < hp.constellation ? "on" : ""}"><b>C${i + 1} · ${esc(c.name)}</b><small>${esc(c.desc)}</small></li>`)
            .join("")}</ol><p class="wkp-note">Each dupe from the Merch Machine adds a star. This is not a sponsored message.${cite(id + "c")}</p>`
        : ""
    }
    <div class="wkp-acts"><button class="btn small violet" data-nav data-act="profile">OPEN PROFILE ▸</button></div>`;
  return { title: name, kicker: (d?.title ?? "HERO").toUpperCase(), icon: portrait(d?.portrait ?? "", 0, "pimg"), html: page(p, "heroes", id, body) };
}

/** Lv1-5 + Limit Break rows of a weapon's level table. */
function levelTable(d: WeaponDef, rank: number): string {
  const head = `<tr><th>LV</th><th>DMG</th><th>CD</th><th>AMT</th></tr>`;
  const fmtCd = (s: number) => `${s >= 10 ? s.toFixed(0) : s.toFixed(2).replace(/0$/, "")}s`;
  const rows = d.levels.map((l, i) => `<tr><td>${i + 1}</td><td>${fmtInt(l.dmg)}</td><td>${fmtCd(l.cd)}</td><td>${l.amount}</td></tr><tr class="up"><td></td><td colspan="3">${esc(i === 0 ? d.desc : (d.upgrades[i - 1] ?? ""))}</td></tr>`);
  if (!d.evolved && d.levels.length) {
    const last = d.levels[d.levels.length - 1];
    let dmg = 0;
    let amt = 0;
    let cd = 1;
    for (let k = 0; k < 2; k++) {
      const lb = d.limitBreak?.[k];
      dmg += lb ? (lb.dmg ?? 0) : 0.2;
      amt += lb ? (lb.amount ?? 0) : 1;
      cd *= lb?.cd ?? 1;
      const need = k === 0 ? 5 : 10;
      const open = rank >= need;
      const text = lb?.text ?? (k === 0 ? "LIMIT BREAK: +20% damage, +1 amount" : "MASTERED: +20% damage, +1 amount");
      rows.push(
        `<tr class="lb${open ? "" : " locked"}"><td>${6 + k}</td><td>${fmtInt(last.dmg * (1 + dmg))}</td><td>${fmtCd(last.cd * cd)}</td><td>${last.amount + amt}</td></tr><tr class="up lb${open ? "" : " locked"}"><td></td><td colspan="3">${open ? "" : `<b class="lock">🔒 MASTERY ${need}</b> `}${esc(text)}</td></tr>`,
      );
    }
  }
  return `<div class="wkp-tw"><table class="wkp-lv">${head}${rows.join("")}</table></div>`;
}

function weaponArticle(p: Profile, id: string, ctx: MetaContent): Article {
  const d = WEAPONS.get(id);
  const name = d?.name ?? id;
  const m = weaponCodexInfo(p, id);
  const mi = masteryInfo(p.mastery[id] ?? 0);
  const evo = d?.evolution ? WEAPONS.get(d.evolution.into) : undefined;
  const partner = d?.evolution ? PASSIVES.find((x) => x.id === d.evolution?.with) : undefined;
  const evoKnown = !!evo && isDiscovered(p, "weapons", evo.id);
  const sigOf = HEROES.find((h) => h.weapon === id);
  const maxLv = mi.rank >= 10 ? 7 : mi.rank >= 5 ? 6 : 5;
  const l1 = d?.levels[0];
  const rows = [
    row("Type", sigOf ? `Signature of ${wlink(p, "heroes", sigOf.id, ctx)}` : "General weapon"),
    l1 ? row("Damage", `${fmtInt(l1.dmg)} → ${fmtInt(d?.levels[d.levels.length - 1]?.dmg ?? l1.dmg)}`) : "",
    row("Max level", `${maxLv}${maxLv > 5 ? ` <i class="lbk">LIMIT BREAK</i>` : ""}`),
    row("Mastery", mi.maxed ? `<b class="gold">MASTERED</b>` : `Rank ${mi.rank}`),
    row("Evolves with", partner ? (evoKnown ? wlink(p, "passives", partner.id, ctx) : `<span class="wkp-q">???</span>`) : "—"),
    row("Evolves into", evo ? (evoKnown ? `<b>${esc(evo.name)}</b>` : `<span class="wkp-q">???</span>`) : "—"),
  ].join("");
  const art = `${d && hasArt(d.icon) ? img(d.icon, "px ib-img") : unknownIcon("ib-img")}${m.mastered ? `<i class="ib-mastered">MASTERED</i>` : ""}`;
  const recipe = evo
    ? evoKnown
      ? `<div class="wkp-recipe">${img(d?.icon ?? "", "px")}<b>Lv${d?.levels.length ?? 5}</b><span>+</span>${partner && hasArt(partner.icon) ? img(partner.icon, "px") : ""}<span>→</span>${hasArt(evo.icon) ? img(evo.icon, "px evo") : ""}</div><p><b>${esc(evo.name)}</b> — ${esc(evo.desc)}</p>`
      : `<div class="wkp-recipe unk">${d && hasArt(d.icon) ? img(d.icon, "px") : ""}<b>Lv${d?.levels.length ?? 5}</b><span>+</span><i class="q">?</i><span>→</span><i class="q big">?</i></div><p class="wkp-note">This section is a stub. Evolve it in an episode to write it.${cite(id + "evo")} (Hint: chests love an evolution.)</p>`
    : "";
  const body = `
    ${infobox(name, art, rows, "weapon")}
    <p class="wkp-lead"><b>${esc(name)}</b> ${sigOf ? `is the signature weapon of ${wlink(p, "heroes", sigOf.id, ctx)}.` : "is a weapon."} ${esc(d?.desc ?? "")}</p>
    ${h3("Mastery")}
    <div class="wkp-mast">${pbar(mi.maxed ? 1 : mi.into / Math.max(1, mi.need), mi.maxed ? "MASTERED" : `RANK ${mi.rank} · ${fmtInt(mi.into)} / ${fmtInt(mi.need)}`, mi.rank >= 5 ? "rainbow" : "gold")}</div>
    <p class="wkp-note">+3% damage per rank. Rank 5: <b>Limit Break</b> (max level 6). Rank 10: max level 7, a gold frame and the MASTERED badge.${cite(id + "m")}</p>
    ${h3("Level table")}
    ${d ? levelTable(d, mi.rank) : ""}
    ${evo ? `${h3("Evolution")}${recipe}` : ""}
    ${h3("Record")}
    <p>Defeated <b>${fmtInt(m.kills)}</b> plushies · dealt <b>${fmtInt(m.damage)}</b> damage across all episodes.${cite(id + "r")}</p>`;
  return { title: name, kicker: sigOf ? `SIGNATURE · ${sigOf.name.toUpperCase()}` : "WEAPON", icon: d && hasArt(d.icon) ? img(d.icon, "px pimg") : unknownIcon("pimg"), html: page(p, "weapons", id, body) };
}

function passiveArticle(p: Profile, id: string, ctx: MetaContent): Article {
  const d = PASSIVES.find((x) => x.id === id);
  const name = d?.name ?? id;
  const enables = [...WEAPONS.values()].filter((w) => w.evolution?.with === id);
  const rows = [row("Type", "Passive (accessory)"), row("Levels", String(d?.levels.length ?? 5)), row("Evolutions", enables.length ? String(enables.length) : "none")].join("");
  const body = `
    ${infobox(name, d && hasArt(d.icon) ? img(d.icon, "px ib-img") : unknownIcon("ib-img"), rows, "passive")}
    <p class="wkp-lead"><b>${esc(name)}</b> is a passive item. It does not do anything on its own, which is very relatable.${cite(id)}</p>
    ${h3("Levels")}
    <ol class="wkp-levels">${(d?.levels ?? []).map((l) => `<li>${esc(l)}</li>`).join("")}</ol>
    ${
      enables.length
        ? `${h3("Used in evolutions")}<ul class="wkp-list">${enables
            .map((w) => {
              const evo = w.evolution ? WEAPONS.get(w.evolution.into) : undefined;
              const known = !!evo && isDiscovered(p, "weapons", evo.id);
              return `<li>${wlink(p, "weapons", w.id, ctx)} + ${esc(name)} → ${known && evo ? `<b>${esc(evo.name)}</b>` : `<span class="wkp-q">???</span>`}</li>`;
            })
            .join("")}</ul>`
        : ""
    }`;
  return { title: name, kicker: "PASSIVE", icon: d && hasArt(d.icon) ? img(d.icon, "px pimg") : unknownIcon("pimg"), html: page(p, "passives", id, body) };
}

function quotes(lines: readonly string[]): string {
  return `<div class="wkp-quotes">${lines.map((l, i) => `<span class="wkp-bub" style="--i:${i}">${esc(l)}</span>`).join("")}</div>`;
}

function enemyArticle(p: Profile, id: string, ctx: MetaContent, boss: boolean): Article {
  const d = boss ? BOSSES.get(id) : ENEMIES.get(id);
  const name = d?.name ?? id;
  const title = d?.boss ? d.boss.title : name;
  const kills = boss ? (p.lifetime.bossKills[id] ?? 0) : (p.lifetime.killsByEnemy[id] ?? 0);
  const where = whereIs(id, boss);
  const stage = where.stage ? STAGES.get(where.stage) : undefined;
  const b = blurbFor(name, title, d?.boss?.title ?? "");
  const rows = [
    d?.boss ? row("Name card", `<b>${esc(d.boss.title)}</b><br><small>${esc(d.boss.subtitle)}</small>`) : "",
    row(boss ? "Arrives" : "Appears in", stage ? `${wlink(p, "stages", stage.id, ctx)}${where.at !== undefined ? ` at ${clock(where.at)}` : ""}` : "a later episode"),
    !boss && d ? row("HP", fmtInt(d.hp)) : "",
    !boss && d ? row("Speed", String(Math.round(d.speed))) : "",
    d ? row("Contact damage", String(d.dmg)) : "",
    row("Defeated", `<b class="gold">${fmtInt(kills)}</b>`),
  ].join("");
  const sp = d?.sprite ?? "";
  const art = hasArt(sp) ? `<span class="ib-anim">${img(sp, "px ib-img spr f0")}${img(sp, "px ib-img spr f1", 1)}</span>` : unknownIcon("ib-img");
  const lines = boss ? (BOSS_TAUNTS[id] ?? []) : (SPEECH_POOLS[id] ?? []);
  const death = boss ? (BOSS_DEATH_LINES[name] ?? BOSS_DEATH_LINES[title] ?? Object.entries(BOSS_DEATH_LINES).find(([k]) => name.toLowerCase().includes(k.toLowerCase()))?.[1]) : undefined;
  const body = `
    ${infobox(boss ? title : name, art, rows, boss ? "boss" : "enemy")}
    ${b ? `<p class="wkp-trope">Trope: <b>${esc(b.trope)}</b></p>` : ""}
    <p class="wkp-lead"><b>${esc(name)}</b> ${b ? `— ${esc(b.text)}` : `is ${boss ? "a boss" : "an enemy"} of <i>Kira Kira Overdrive</i>.`}${cite(id)}</p>
    ${lines.length ? `${h3(boss ? "Taunts" : "Known lines")}${quotes(lines)}` : ""}
    ${death ? `${h3("Notable quote")}<blockquote class="wkp-q2">“${esc(death)}”<small>— the TO BE CONTINUED screen, after you lost to it</small></blockquote>` : ""}
    ${b ? `${h3("Trivia")}<ul class="wkp-list"><li>${esc(b.trivia.charAt(0).toUpperCase() + b.trivia.slice(1))}${cite(id + "t")}</li><li>Defeated ${fmtInt(kills)} time${kills === 1 ? "" : "s"} by you. It keeps count.${cite(id + "k")}</li></ul>` : ""}`;
  return { title: boss ? title : name, kicker: boss ? (d?.boss?.subtitle ?? "BOSS").toUpperCase() : `ENEMY${stage ? ` · ${stage.name.toUpperCase()}` : ""}`, icon: hasArt(sp) ? img(sp, "px pimg spr") : unknownIcon("pimg"), html: page(p, boss ? "bosses" : "enemies", id, body) };
}

function relicArticle(p: Profile, id: string): Article {
  const d = RELICS.get(id) as RelicDef | undefined;
  const name = d?.name ?? id;
  const st = p.relics[id];
  const owned = st !== undefined;
  const cur = owned ? st : 0;
  const rows = d
    ? [row("Rarity", rarityBadge(d.rarity)), row("Owned", owned ? `★${cur} / 6` : "<i>Not yet (allegedly available)</i>"), row("Printed rate", esc(RATE[d.rarity] ?? "?")), row("Price", "“definitely not premium currency”")].join("")
    : "";
  const stars = d
    ? `<ol class="wkp-stars" start="0">${Array.from({ length: 7 }, (_, s) => `<li class="${owned && s === cur ? "on" : owned && s < cur ? "past" : ""}"><b>★${s}</b><span>${esc(d.desc(s))}</span></li>`).join("")}</ol>`
    : "";
  const body = `
    ${infobox(name, d ? `<span class="relic-t rf r-${RARITY_CLS[d.rarity]}">${relicIcon(id, d.rarity, "ib-img")}</span>` : unknownIcon("ib-img"), rows, `relic r-${d ? RARITY_CLS[d.rarity] : "n"}`)}
    <p class="wkp-lead"><b>${esc(name)}</b> is official ${d ? esc(d.rarity) : ""} merchandise.${cite(id)} ${d ? esc(d.desc(cur)) : ""}</p>
    ${d ? `<blockquote class="wkp-q2">“${esc(d.flavor)}”<small>— the box it came in</small></blockquote>` : ""}
    ${h3("Star levels")}
    ${stars}
    <p class="wkp-note">Dupes add a star. Past ★6 they turn into Copium. Please consume responsibly.${cite(id + "s")}</p>`;
  return { title: name, kicker: d ? `${d.rarity} MERCH` : "MERCH", icon: d ? relicIcon(id, d.rarity, "pimg") : unknownIcon("pimg"), html: page(p, "relics", id, body) };
}

function stageArticle(p: Profile, id: string, ctx: MetaContent): Article {
  const s = ctx.stageById.get(id);
  const def = STAGES.get(id);
  const name = s?.name ?? id;
  const rec = p.records[id];
  const bosses = s?.bosses ?? [];
  const enemies = s?.enemies ?? [];
  const rows = [
    row("Episode", `#${s?.order ?? "?"}`),
    row("Length", fmtTime(s?.duration ?? 0)),
    row("Ratings", `×${ratingMul(s?.rewardMul ?? 1)} rewards`),
    row("Filler Arc", s?.endless === false ? "no" : "yes (after a clear)"),
    rec && rec.runs > 0 ? row("Aired", `${fmtInt(rec.runs)} time${rec.runs === 1 ? "" : "s"}`) : "",
  ].join("");
  const titles = (EPISODE_TITLES[id] ?? []).slice(0, 4);
  const body = `
    ${infobox(name, `<span class="ib-stage">${stageThumb(s)}</span>`, rows, "stage")}
    <p class="wkp-lead"><b>${esc(name)}</b> (<i>${esc(s?.subtitle ?? "")}</i>) is episode ${s?.order ?? "?"} of the season.${cite(id)} ${esc(s?.blurb ?? def?.blurb ?? "")}</p>
    ${h3("Records")}
    <div class="ep-recs wkp-recs">${stageRecords(rec, s)}</div>
    ${bosses.length ? `${h3("Bosses")}<ul class="wkp-list wkp-ents">${bosses.map((b) => `<li>${isDiscovered(p, "bosses", b) ? entryIcon("bosses", b, ctx, "li-ic") : silhouette("bosses", b, ctx, "li-ic")}${wlink(p, "bosses", b, ctx, BOSSES.get(b)?.boss?.title ?? undefined)}<small>${esc(whereIs(b, true).text)}</small></li>`).join("")}</ul>` : ""}
    ${enemies.length ? `${h3("Cast of plushies")}<div class="wkp-chips">${enemies.map((e) => wlink(p, "enemies", e, ctx)).join("")}</div>` : ""}
    ${titles.length ? `${h3("Notable episodes")}<ul class="wkp-list">${titles.map((t) => `<li>“${esc(fill(t, { hero: HEROES.find((x) => x.id === p.loadout.hero)?.name ?? "Hoshi", stage: name }))}”</li>`).join("")}</ul>` : ""}`;
  return { title: name, kicker: (s?.subtitle ?? "EPISODE").toUpperCase(), icon: "", html: page(p, "stages", id, body) };
}

/** The article for a discovered entry. */
export function articleFor(p: Profile, t: CodexTab, id: string, ctx: MetaContent): Article {
  switch (t) {
    case "heroes":
      return heroArticle(p, id, ctx);
    case "weapons":
      return weaponArticle(p, id, ctx);
    case "passives":
      return passiveArticle(p, id, ctx);
    case "enemies":
      return enemyArticle(p, id, ctx, false);
    case "bosses":
      return enemyArticle(p, id, ctx, true);
    case "relics":
      return relicArticle(p, id);
    case "stages":
      return stageArticle(p, id, ctx);
  }
}

/** The stub page of an undiscovered entry. */
export function stubFor(p: Profile, t: CodexTab, id: string, ctx: MetaContent): Article {
  const body = `
    <div class="wkp-stub">
      <span class="stub-art">${silhouette(t, id, ctx, "ib-img")}</span>
      <p class="stub-t">${esc(STUB)}</p>
      <p class="stub-h"><b>How to find it:</b> ${esc(hintFor(p, t, id, ctx))}</p>
    </div>`;
  return { title: "???", kicker: `${TAB_INFO[t].label} · UNDISCOVERED`, icon: unknownIcon("pimg"), html: page(p, t, id, body) };
}
