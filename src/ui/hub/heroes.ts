/**
 * HEROES ("The Cast", docs/EXPANSION.md §6, satire.md §8): the roster as a
 * gacha-style character grid. Unlocked heroes: portrait on their colour, level
 * badge, rarity badge, constellation stars, free talent points, and a
 * "★ ACTIVE" ribbon on the one starring in the next episode. Locked heroes:
 * the portrait as a silhouette with the unlock hint and progress ("Defeat King
 * Puff", "412 / 3,000"); gacha heroes read "Available in the Merch Machine
 * (allegedly)."; heroes the content wave has not shipped yet read "??? —
 * Appears in a later episode.". Tap a card for the hero page
 * (src/ui/hub/heroes/page.ts).
 */
import { HEROES } from "../../game/heroes";
import { gameContent } from "../../meta/content";
import { heroView } from "../../meta/heroes";
import { isGachaHero, ROSTER, ROSTER_BY_ID } from "../../meta/roster";
import { unlockStatus } from "../../meta/unlocks";
import { esc, fmtInt, h, hasArt, img } from "../dom";
import { portrait, rarityBadge } from "../kit/art";
import { badge, bindActs, pbar, shake } from "../kit/controls";
import { save } from "../save";
import { pageLayer, type Hub, type HubPage } from "./hub";
import "./heroes/heroes.css";

export { heroPage } from "./heroes/page";

export function heroesPage(hub: Hub): HubPage {
  const app = hub.app;
  const el = h("div", "heroes");
  const layer = pageLayer(hub);
  let rendered = false;

  const render = () => {
    const p = save.profile;
    const ctx = gameContent();
    if (rendered) el.classList.add("settled");
    rendered = true;
    const cards = [...ROSTER]
      .sort((a, b) => a.order - b.order)
      .map((r, i) => {
        const d = HEROES.find((x) => x.id === r.id);
        const gacha = isGachaHero(r.id);
        if (!d) {
          return `<button class="cast-card soon" data-nav data-act="soon" data-id="${r.id}" style="--i:${i}">
            <span class="cc-por">${portrait("", 0, "pimg", true)}</span>
            <span class="cc-rar">${rarityBadge(r.rarity, "rbadge sm")}</span>
            <span class="cc-tx"><b class="cc-name">???</b><small class="cc-hint">${gacha ? "Available in the Merch Machine (allegedly)." : "Appears in a later episode."}</small></span>
          </button>`;
        }
        const v = heroView(p, d.id, ctx);
        const st = v.unlocked ? null : unlockStatus(p, "hero", d.id, ctx);
        const active = p.loadout.hero === d.id;
        const cons = Array.from({ length: 6 }, (_, k) => `<i class="${k < v.constellation ? "on" : ""}"></i>`).join("");
        const sil = hasArt(d.portrait) ? img(d.portrait, "px pimg sil", 0) : portrait("", 0, "pimg", true);
        const free = v.unlocked && ctx.talents.has(d.id) ? v.points.free : 0;
        return `<button class="cast-card${v.unlocked ? "" : " locked"}${active ? " sel" : ""}${gacha ? " gacha" : ""}" data-nav${active ? " data-nav-default" : ""} data-act="hero" data-id="${d.id}" style="--i:${i};--hc:${app.heroColor(d.id)}" aria-label="${esc(v.unlocked ? d.name : "Locked hero")}">
          <span class="cc-por">${v.unlocked ? portrait(d.portrait, 0, "pimg") : sil}${v.unlocked ? "" : `<i class="cc-q" aria-hidden="true">?</i>`}</span>
          <span class="cc-rar">${rarityBadge(r.rarity, "rbadge sm")}</span>
          ${v.unlocked ? `<span class="cc-lv">LV<b>${v.level.level}</b></span>` : ""}
          <span class="cc-tx">
            <b class="cc-name">${v.unlocked ? esc(d.name) : "???"}</b>
            ${
              v.unlocked
                ? `<small class="cc-title">${esc(d.title)}</small><span class="cc-cons" aria-label="C${v.constellation}">${cons}</span>`
                : `<small class="cc-hint"><i class="lock-i"></i>${esc(gacha ? "Available in the Merch Machine (allegedly)." : (st?.rule.hint ?? "Appears in a later episode."))}</small>${st && st.target > 1 && !gacha ? pbar(st.value / st.target, `${fmtInt(Math.min(st.value, st.target))} / ${fmtInt(st.target)}`, "violet") : ""}`
            }
          </span>
          ${active ? `<span class="cc-act">★ ACTIVE</span>` : ""}
          ${v.unlocked && (p.flags[`lvs_${d.id}`] ?? 0) > 0 && v.level.level > (p.flags[`lvs_${d.id}`] ?? 0) ? `<span class="cc-new">LV UP!</span>` : ""}
          ${free > 0 ? badge(free) : ""}
        </button>`;
      })
      .join("");
    const owned = p.unlocks.heroes.filter((id) => HEROES.some((d) => d.id === id)).length;
    el.innerHTML = `
      <div class="cast-top">
        <span class="pg-sub">The Cast · <b>${fmtInt(owned)}</b> / ${ROSTER.length} recruited</span>
        <small class="cast-flav">Tap a hero for their profile, talents and constellation.</small>
      </div>
      <div class="cast-grid kscroll">${cards}</div>`;
    bindActs(el, {
      hero: (b) => {
        app.sfx("cardFlip");
        hub.open("hero", { hero: b.dataset.id });
      },
      soon: (b) => {
        app.sfx("uiDeny");
        shake(b);
        const r = ROSTER_BY_ID.get(b.dataset.id as string);
        hub.toast(r && isGachaHero(r.id) ? "Available in the Merch Machine (allegedly)." : "??? — Appears in a later episode.");
      },
    });
  };
  render();
  return {
    id: "heroes",
    el,
    title: "THE CAST",
    layer,
    opaque: true,
    show() {
      render();
      app.nav.refocus(layer);
    },
  };
}
