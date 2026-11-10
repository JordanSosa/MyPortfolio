/**
 * PROFILE tab of a hero page: the OC bio (docs/content/heroes.md §5) as a
 * loving parody of a 2000s fan-art profile page - pink gradient header with
 * the ~*~ title and its tagline, glitter divider, the bio rows exactly as
 * written (typos and kaomoji included), a "DO NOT STEAL!!" rubber stamp that
 * slams onto the card, a ♡ Favourite counter that only ever goes up by one,
 * a "Profile Stats" box (real numbers in fan-site words, plus a pageview
 * counter nobody believes), blinkies, a "now playing" marquee of the theme
 * song - and then the kit: trait, signature weapon (+ its evolution) and the
 * Overdrive with a mini cut-in PREVIEW.
 */
import type { HeroDef } from "../../../game/types";
import { recipesOf } from "../../../game/evo-hints";
import { ULTIMATES, WEAPONS } from "../../../game/registry";
import type { HeroProgress } from "../../../meta/profile";
import { esc, fmtInt, fmtTime, hasArt, img } from "../../dom";
import { portrait } from "../../kit/art";
import { btn, sectionTitle, tag } from "../../kit/controls";
import { BIOS } from "../copy-data";

/** The ♡ Favourite counter's "everyone else" count (stable per hero, small and sad). */
export function favBase(id: string): number {
  return 2 + (hash(id) % 40);
}

function hash(s: string): number {
  let x = 7;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
  return x;
}

/** Cut-in band colours (HeroDef.band, else the three originals' bands from the in-run cut-in). */
const BAND: Record<string, readonly [string, string, string]> = {
  hoshi: ["#ffb8dc", "#ff7ab8", "#d9468f"],
  rin: ["#ffd6c4", "#ff4d6d", "#ad1d4a"],
  mochi: ["#ddc6ff", "#b47cff", "#743fd1"],
};
export const heroBand = (hd: HeroDef): readonly [string, string, string] => hd.band ?? BAND[hd.id] ?? BAND.hoshi;

export interface BioParts {
  title: string;
  tagline: string;
  rows: { k: string; v: string }[];
  free: string[];
  dns: string;
  theme: string;
}

/** Split an OC bio into its header, "Key: value" rows, free lines and the DO NOT STEAL line. */
export function parseBio(id: string, name: string): BioParts {
  const bio = BIOS[id];
  const out: BioParts = { title: `~*~ ${name.toUpperCase()} ~*~`, tagline: "", rows: [], free: [], dns: "", theme: "" };
  if (!bio) return out;
  const lines = bio.split("\n");
  const head = lines[0] ?? "";
  const cut = head.search(/\s{2,}/);
  out.title = (cut > 0 ? head.slice(0, cut) : head).trim() || out.title;
  out.tagline = cut > 0 ? head.slice(cut).trim() : "";
  for (const l of lines.slice(1)) {
    if (/^DO NOT STEAL/i.test(l)) {
      out.dns = l;
      continue;
    }
    const m = /^([A-Za-z ]{2,17}):\s?(.*)$/.exec(l);
    if (m) {
      out.rows.push({ k: m[1], v: m[2] });
      if (/^theme song$/i.test(m[1])) out.theme = m[2].replace(/^"|"$/g, "");
    } else if (l.trim()) out.free.push(l);
  }
  return out;
}

const BLINKIES = (name: string) => [
  { t: `I ♥ ${name.toUpperCase()}`, c: "pink" },
  { t: "100% ORIGINAL", c: "mint" },
  { t: "NO STEALING!!", c: "red blink" },
];

export function profileHtml(hd: HeroDef, hp: HeroProgress, unlocked: boolean, fav: boolean, level: number): string {
  const bio = parseBio(hd.id, hd.name);
  const wd = WEAPONS.get(hd.weapon);
  const ud = ULTIMATES.get(hd.ult);
  // (one line per evolution: the signature weapon may have several routes)
  const evos = wd ? recipesOf(wd) : [];
  if (!unlocked) {
    return `
      <div class="fan locked">
        <article class="oc-bio-card locked">
          <header class="obc-head"><b class="obc-t">~*~ ??? ~*~</b><small class="obc-tag">this profile is private</small></header>
          <div class="obc-glitter" aria-hidden="true"></div>
          <div class="obc-body"><p>This deviant has not joined the cast yet. Unlock the hero to read the profile.</p><p class="obc-sad">(the bio is very good. you'll see.)</p></div>
        </article>
      </div>`;
  }
  const rows = bio.rows.map((r) => `<p><span class="obk">${esc(r.k)}:</span> ${esc(r.v)}</p>`).join("");
  const free = bio.free.map((l) => `<p>${esc(l)}</p>`).join("");
  const views = 1000 + (hash(hd.id + "views") % 48000) + hp.runs * 13 + Math.floor(hp.kills / 50);
  const stats: [string, string][] = [
    ["Episodes starred", fmtInt(hp.runs)],
    ["Series finales", fmtInt(hp.clears)],
    ["Plushies defeated", fmtInt(hp.kills)],
    ["Screen time", hp.time >= 3600 ? `${Math.floor(hp.time / 3600)}h ${String(Math.floor((hp.time % 3600) / 60)).padStart(2, "0")}m` : fmtTime(hp.time)],
    ["Longest episode", fmtTime(hp.bestTime)],
    ["Hero level", `LV ${level}`],
  ];
  return `
    <div class="fan">
      <article class="oc-bio-card">
        <header class="obc-head">
          <b class="obc-t">${esc(bio.title)}</b>
          ${bio.tagline ? `<small class="obc-tag">${esc(bio.tagline)}</small>` : ""}
          <i class="obc-sp s1" aria-hidden="true">✦</i><i class="obc-sp s2" aria-hidden="true">✧</i><i class="obc-sp s3" aria-hidden="true">✦</i>
        </header>
        <div class="obc-glitter" aria-hidden="true"></div>
        <div class="obc-body">${rows}${free}</div>
        ${bio.dns ? `<p class="obc-dns">${esc(bio.dns)}</p>` : ""}
        <footer class="obc-foot">
          <button class="obc-fav${fav ? " on" : ""}" data-nav data-act="fav" aria-label="Favourite">${fav ? "♥" : "♡"} Favourite <b>${favBase(hd.id) + (fav ? 1 : 0)}</b></button>
          <span class="obc-views" aria-label="${fmtInt(views)} pageviews">${String(views).padStart(6, "0").split("").map((d) => `<i>${d}</i>`).join("")}<small>pageviews</small></span>
        </footer>
        <span class="fan-stamp" aria-hidden="true">DO NOT<br>STEAL!!</span>
      </article>
      <div class="fan-np" aria-label="Theme song: ${esc(bio.theme)}"><b>♪ NOW PLAYING</b><span class="np-mq"><span>${esc(bio.theme || `${hd.name}'s theme`)} ✦ ${esc(bio.theme || `${hd.name}'s theme`)} ✦&nbsp;</span></span></div>
      <section class="fan-box">
        <h3>Profile Stats</h3>
        <dl class="fan-stats">${stats.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      </section>
      <div class="fan-blinkies" aria-hidden="true">${BLINKIES(hd.name)
        .map((b) => `<span class="blinkie ${b.c}"><span>${esc(b.t)}</span></span>`)
        .join("")}</div>
      ${sectionTitle("Kit")}
      <div class="hk-cards">
        <div class="hk-card trait">
          <span class="hk-ic"><i class="hk-trait" aria-hidden="true">✦</i></span>
          <span class="hk-body"><small class="hk-k">TRAIT</small><b>${esc(hd.trait)}</b></span>
        </div>
        <div class="hk-card weapon">
          <span class="hk-ic">${wd && hasArt(wd.icon) ? img(wd.icon, "px") : ""}</span>
          <span class="hk-body">
            <small class="hk-k">SIGNATURE WEAPON</small>
            <b>${esc(wd?.name ?? hd.weapon)}</b>
            <small>${esc(wd?.desc ?? "")}</small>
            ${evos.map(({ passive: partner, into: evo }) => `<span class="hk-evo">${hasArt(partner.icon) ? img(partner.icon, "px") : ""}<span>+ ${esc(partner.name)} ▶</span>${hasArt(evo.icon) ? img(evo.icon, "px") : ""}<b>${esc(evo.name)}</b></span>`).join("")}
          </span>
          ${tag("START", "gold")}
        </div>
        <div class="hk-card ult" data-ult>
          <span class="hk-ic por">${portrait(hd.portrait, 1, "pimg")}</span>
          <span class="hk-body">
            <small class="hk-k">OVERDRIVE</small>
            <b>${esc(ud?.name ?? hd.ult)}</b>
            <small>${esc(ud?.desc ?? "")}</small>
          </span>
          ${btn("▶ PREVIEW", { cls: "violet small", act: "preview", aria: "Preview the Overdrive cut-in" })}
        </div>
      </div>
    </div>`;
}
