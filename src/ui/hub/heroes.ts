/**
 * HEROES ("The Cast", docs/EXPANSION.md §6): the roster grid (11 heroes:
 * unlocked ones with level / constellation, locked ones as silhouettes with
 * their unlock hint and progress, gacha heroes "Available in the Merch Machine
 * (allegedly)", heroes the content wave has not shipped "Appears in a later
 * episode"), and the hero page:
 *  - header: portrait (tap: the shouting frame), sparkly OC name, level bar,
 *    constellation, SELECT FOR THE NEXT EPISODE, the coin level accelerator;
 *  - PROFILE: the OC "DeviantArt" bio card (with its ♡ Favourite counter),
 *    trait, start weapon, Overdrive;
 *  - TALENTS: 3 branches x 5 tiers, rank pips, tier gating, a detail sheet with
 *    +1 / -1 rank, RESET (coins);
 *  - CONSTELLATION: C1..C6, lit up to the hero's level.
 */
import type { TalentNode, TalentTree } from "../../game/defs";
import { HEROES, heroDef } from "../../game/heroes";
import { ULTIMATES, WEAPONS } from "../../game/registry";
import { gameContent } from "../../meta/content";
import { heroLevelUpCost } from "../../meta/economy";
import { allocateTalent, branchPointsBelow, buyHeroLevel, canAllocate, heroView, refundTalent, resetTalents, talentResetCost, tierRequirement, type TalentBlock } from "../../meta/heroes";
import { setLoadout } from "../../meta/loadout";
import { ROSTER, ROSTER_BY_ID } from "../../meta/roster";
import { unlockStatus } from "../../meta/unlocks";
import { esc, fmtInt, h, img } from "../dom";
import { money, portrait } from "../kit/art";
import { badge, bindActs, btn, pbar, pop, sectionTitle, shake, TabBar, tag } from "../kit/controls";
import { confirmDialog, openSheet, type SheetHandle } from "../kit/overlay";
import { save } from "../save";
import { BIOS } from "./copy-data";
import { bioBits } from "./home";
import { pageLayer, type Hub, type HubPage, type PageOpts } from "./hub";

// ================================================================== roster grid

export function heroesPage(hub: Hub): HubPage {
  const app = hub.app;
  const el = h("div", "heroes");
  const layer = pageLayer(hub);

  const render = () => {
    const p = save.profile;
    const ctx = gameContent();
    const cards = [...ROSTER]
      .sort((a, b) => a.order - b.order)
      .map((r, i) => {
        const d = HEROES.find((x) => x.id === r.id);
        if (!d) {
          const gacha = r.source === "gacha" || r.source === "mythic";
          return `<button class="cast-card soon" data-nav data-act="soon" data-id="${r.id}" style="--i:${i}">
            <span class="cc-por">${portrait("", 0, "pimg", true)}</span>
            <span class="cc-tx"><b>???</b><small>${gacha ? "Available in the Merch Machine (allegedly)." : "Appears in a later episode."}</small></span></button>`;
        }
        const v = heroView(p, d.id, ctx);
        const st = v.unlocked ? null : unlockStatus(p, "hero", d.id, ctx);
        const cons = Array.from({ length: 6 }, (_, k) => `<i class="${k < v.constellation ? "on" : ""}"></i>`).join("");
        const sel = p.loadout.hero === d.id;
        return `<button class="cast-card${v.unlocked ? "" : " locked"}${sel ? " sel" : ""}" data-nav data-act="hero" data-id="${d.id}" style="--i:${i};--hc:${app.heroColor(d.id)}">
          <span class="cc-por">${portrait(d.portrait, 0, "pimg", !v.unlocked)}${v.unlocked ? "" : `<i class="lock-i"></i>`}</span>
          <span class="cc-tx">
            <b>${v.unlocked ? esc(d.name) : "???"}</b>
            <small>${v.unlocked ? esc(d.title) : esc(st?.rule.hint ?? "")}</small>
            ${
              v.unlocked
                ? `<span class="cc-lv">LV ${v.level.level}<span class="cons6">${cons}</span></span>`
                : st && st.target > 1
                  ? pbar(st.value / st.target, `${fmtInt(st.value)} / ${fmtInt(st.target)}`, "violet")
                  : ""
            }
          </span>
          ${sel ? `<span class="cc-sel">${tag("NEXT EPISODE", "gold")}</span>` : ""}
          ${v.unlocked && v.points.free > 0 && ctx.talents.has(d.id) ? badge(v.points.free) : ""}
        </button>`;
      })
      .join("");
    el.innerHTML = `<div class="pg-sub">The Cast · ${fmtInt(p.unlocks.heroes.filter((id) => HEROES.some((d) => d.id === id)).length)} / ${ROSTER.length} recruited</div><div class="cast-grid kscroll">${cards}</div>`;
    bindActs(el, {
      hero: (b) => {
        app.sfx("cardFlip");
        hub.open("hero", { hero: b.dataset.id });
      },
      soon: (b) => {
        app.sfx("uiDeny");
        shake(b);
        const r = ROSTER_BY_ID.get(b.dataset.id as string);
        hub.toast(r && (r.source === "gacha" || r.source === "mythic") ? "Available in the Merch Machine (allegedly)." : "??? — Appears in a later episode.");
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

// ================================================================== hero page

const TALENT_BLOCK: Record<TalentBlock, string> = {
  unknown: "This talent doesn't exist (yet).",
  locked: "Unlock the hero first.",
  maxed: "Maxed out!",
  points: "No free talent points. Hero levels give one each.",
  tier: "",
  requires: "Needs the talent before it first.",
};

export function heroPage(hub: Hub, o: PageOpts): HubPage {
  const app = hub.app;
  const ctx = gameContent();
  const hd = heroDef(o.hero ?? save.profile.loadout.hero);
  const id = hd.id;
  const el = h("div", "hero-pg");
  el.style.setProperty("--hc", app.heroColor(id));
  const layer = pageLayer(hub);
  let tab = o.tab === "talents" || o.tab === "cons" ? o.tab : "profile";
  let sheet: SheetHandle | null = null;
  let sheetNode = "";
  const tree = ctx.talents.get(id);

  el.innerHTML = `<div class="hp-head"></div><div class="hp-tabs"></div><div class="hp-body kscroll"></div>`;
  const head = el.querySelector(".hp-head") as HTMLElement;
  const body = el.querySelector(".hp-body") as HTMLElement;
  const tabs = new TabBar(
    [
      { id: "profile", label: "PROFILE" },
      { id: "talents", label: "TALENTS" },
      { id: "cons", label: "CONSTELLATION" },
    ],
    tab,
    (t) => {
      app.sfx("tabSwitch");
      tab = t;
      renderBody();
      body.scrollTop = 0;
    },
  );
  (el.querySelector(".hp-tabs") as HTMLElement).appendChild(tabs.el);

  const renderHead = () => {
    const p = save.profile;
    const v = heroView(p, id, ctx);
    const bits = bioBits(id, hd.name);
    const li = v.level;
    const sel = p.loadout.hero === id;
    const cost = v.unlocked && !li.maxed ? heroLevelUpCost(v.hp.xp) : 0;
    const st = v.unlocked ? null : unlockStatus(p, "hero", id, ctx);
    const cons = Array.from({ length: 6 }, (_, k) => `<i class="${k < v.constellation ? "on" : ""}"></i>`).join("");
    head.innerHTML = `
      <button class="hp-por" data-nav data-act="shout" aria-label="${esc(hd.name)}">${portrait(hd.portrait, 0, "pimg", !v.unlocked)}<i class="oc-glow"></i></button>
      <div class="hp-id">
        <b class="hp-name">${v.unlocked ? esc(bits.header) : "~*~ ??? ~*~"}</b>
        <small class="hp-tt">${esc(hd.title.toUpperCase())}</small>
        ${
          v.unlocked
            ? `<div class="hp-lv"><b>LV ${li.level}</b>${pbar(li.maxed ? 1 : li.into / li.need, li.maxed ? "MAX" : `${fmtInt(li.into)} / ${fmtInt(li.need)} XP`, "gold")}</div>
               <div class="hp-cons"><small>C${v.constellation}</small><span class="cons6">${cons}</span>${ctx.talents.has(id) ? `<small class="hp-pts">${v.points.free} talent pt${v.points.free === 1 ? "" : "s"} free</small>` : ""}</div>`
            : `<div class="hp-lockhint"><i class="lock-i"></i>${esc(st?.rule.hint ?? "Locked.")}</div>${st && st.target > 1 ? pbar(st.value / st.target, `${fmtInt(st.value)} / ${fmtInt(st.target)}`, "violet") : ""}`
        }
        <div class="hp-btns">
          ${v.unlocked ? (sel ? `<span class="chip on static">✓ NEXT EPISODE</span>` : btn("SELECT", { cls: "small", act: "select", sub: "for the next episode", def: true })) : ""}
          ${v.unlocked && !li.maxed ? btn(`LV UP ${money("coins", fmtInt(cost), p.currencies.coins < cost ? "poor" : "")}`, { cls: "ghost small", act: "buylv", aria: "Buy the rest of this level with Star Coins" }) : ""}
        </div>
      </div>`;
    bindActs(head, {
      shout: (b) => {
        if (!v.unlocked) return;
        app.sfx("voiceBlip");
        const im = b.querySelector<HTMLElement>(".pimg");
        if (im) im.outerHTML = portrait(hd.portrait, 1, "pimg");
        pop(b, 1.08);
        setTimeout(() => {
          const im2 = b.querySelector<HTMLElement>(".pimg");
          if (im2) im2.outerHTML = portrait(hd.portrait, 0, "pimg");
        }, 1200);
      },
      select: () => {
        app.sfx("equip");
        setLoadout(save.profile, { hero: id });
        hub.changed(false);
        hub.toast(`${hd.name} stars in the next episode!`, { kind: "good" });
        renderHead();
      },
      buylv: async (b) => {
        const c = heroLevelUpCost(save.profile.heroes[id]?.xp ?? 0);
        if (save.profile.currencies.coins < c) {
          app.sfx("uiDeny");
          shake(b);
          hub.toast("Not enough Star Coins!", { kind: "bad", sub: "Episodes give hero XP for free, by the way." });
          return;
        }
        const ok = await confirmDialog(app, { title: "Skip the montage?", body: `Buy the rest of this level for ${money("coins", fmtInt(c))}?<br><small>(Playing episodes levels heroes for free.)</small>`, ok: "LEVEL UP", okCls: "gold" });
        if (!ok) return;
        const r = buyHeroLevel(save.profile, id);
        if (r.ok) {
          app.sfx("heroLevelUp");
          hub.changed();
          hub.toast(`${hd.name} reached LV ${r.level}!`, { kind: "good", sub: "+1 talent point" });
          renderHead();
          renderBody();
        }
      },
    });
  };

  // ---------------------------------------------------------------- tabs
  const renderBody = () => {
    if (tab === "talents") body.innerHTML = talentsHtml();
    else if (tab === "cons") body.innerHTML = consHtml();
    else body.innerHTML = profileHtml();
    bindActs(body, {
      fav: (b) => {
        const k = `fav_${id}`;
        const flags = save.profile.flags;
        flags[k] = flags[k] ? 0 : 1;
        save.save();
        app.sfx(flags[k] ? "uiConfirm" : "uiBack");
        b.classList.toggle("on", !!flags[k]);
        (b.querySelector("b") as HTMLElement).textContent = String(favBase(id) + (flags[k] ? 1 : 0));
        pop(b, 1.2);
      },
      tal: (b) => openTalent(b.dataset.id as string),
      reset: resetAll,
      gacha: () => hub.open("gacha"),
    });
  };

  const profileHtml = (): string => {
    const p = save.profile;
    const unlocked = p.unlocks.heroes.includes(id);
    const wd = WEAPONS.get(hd.weapon);
    const ud = ULTIMATES.get(hd.ult);
    const bio = BIOS[id];
    const fav = !!p.flags[`fav_${id}`];
    const lines = bio ? bio.split("\n") : [];
    const bioCard = unlocked
      ? `<div class="oc-bio-card">
          <div class="obc-head"><b>${esc(lines[0] ?? hd.name)}</b></div>
          <div class="obc-glitter" aria-hidden="true"></div>
          <div class="obc-body">${lines
            .slice(1)
            .map((l) => {
              const m = /^([A-Za-z ]+):\s?(.*)$/.exec(l);
              return m && m[1].length < 18 ? `<p><span class="obk">${esc(m[1])}:</span> ${esc(m[2])}</p>` : `<p class="${/DO NOT/.test(l) ? "dns" : ""}">${esc(l)}</p>`;
            })
            .join("")}</div>
          <button class="obc-fav${fav ? " on" : ""}" data-nav data-act="fav" aria-label="Favourite">♡ Favourite <b>${favBase(id) + (fav ? 1 : 0)}</b></button>
        </div>`
      : `<div class="oc-bio-card locked"><div class="obc-head"><b>~*~ ??? ~*~</b></div><div class="obc-body"><p>This profile is private. (Unlock the hero to read it.)</p></div></div>`;
    return `
      ${sectionTitle("OC Profile")}
      ${bioCard}
      ${sectionTitle("Kit")}
      <div class="kit-rows">
        <div class="krow"><span class="rw-ic lh-ic">✦</span><span class="rw-tx"><b>Trait</b><small>${esc(hd.trait)}</small></span></div>
        <div class="krow"><span class="rw-ic">${img(wd?.icon ?? "", "px")}</span><span class="rw-tx"><b>${esc(wd?.name ?? hd.weapon)}</b><small>${esc(wd?.desc ?? "")}</small></span>${tag("START WEAPON")}</div>
        <div class="krow"><span class="rw-ic">${portrait(hd.portrait, 1, "pimg", !unlocked)}</span><span class="rw-tx"><b>${esc(ud?.name ?? hd.ult)}</b><small>${esc(ud?.desc ?? "")}</small></span>${tag("OVERDRIVE", "pink")}</div>
      </div>`;
  };

  const consHtml = (): string => {
    const p = save.profile;
    const c = p.heroes[id]?.constellation ?? 0;
    const list = ctx.heroById.get(id)?.constellations ?? [];
    if (!list.length) return `<p class="lo-note">No constellation chart for this hero yet.</p>`;
    return `
      <p class="pg-note">Every dupe from the Merch Machine adds one star. Each star is a real bonus.</p>
      <div class="cons-list">${list
        .map(
          (s, i) => `<div class="cons-row${i < c ? " on" : ""}" style="--i:${i}">
            <span class="cs-star">★<small>C${i + 1}</small></span>
            <span class="cs-tx"><b>${esc(s.name)}</b><small>${esc(s.desc)}</small></span>
            ${i < c ? tag("ACTIVE", "gold") : ""}
          </div>`,
        )
        .join("")}</div>
      <div class="cons-cta">${btn("MERCH MACHINE", { cls: "violet small", act: "gacha", sub: "dupes = stars" })}</div>`;
  };

  const talentsHtml = (): string => {
    const p = save.profile;
    if (!tree) return `<p class="lo-note">${esc(hd.name)}'s talent tree is still being written. (Season 2.5, probably.)</p>`;
    const v = heroView(p, id, ctx);
    const ranks = v.hp.talents;
    const cols = [0, 1, 2]
      .map((br) => {
        const spent = tree.nodes.filter((n) => n.branch === br).reduce((a, n) => a + (ranks[n.id] ?? 0), 0);
        const tiers = [1, 2, 3, 4, 5]
          .map((t) => {
            const nodes = tree.nodes.filter((n) => n.branch === br && n.tier === t);
            const need = tierRequirement(t);
            const have = branchPointsBelow(tree, ranks, br, t);
            return `<div class="tt-tier${have < need ? " gated" : ""}" data-tier="${t}">${have < need ? `<span class="tt-need">${need - have} more</span>` : ""}${nodes.map((n) => talentNodeHtml(n, ranks[n.id] ?? 0, v.unlocked)).join("")}</div>`;
          })
          .join("");
        return `<div class="tt-col" style="--b:${br}"><div class="tt-bn"><b>${esc(tree.branches[br])}</b><small>${spent} pts</small></div>${tiers}</div>`;
      })
      .join("");
    const cost = talentResetCost(p, id);
    return `
      <div class="tt-head">
        <span class="tt-pts"><b>${v.points.free}</b> free · ${v.points.spent} / ${v.points.total} spent</span>
        ${v.points.spent > 0 ? btn(`RETCON ${money("coins", fmtInt(cost))}`, { cls: "ghost small", act: "reset", aria: "Reset talents" }) : ""}
      </div>
      <p class="pg-note">Three arcs, five tiers, one hero who refuses to rest. Higher tiers need points in the arc below.</p>
      <div class="tt-tree">${cols}</div>`;
  };

  const talentNodeHtml = (n: TalentNode, rank: number, unlocked: boolean): string => {
    const c = unlocked ? canAllocate(save.profile, id, n.id, ctx) : { ok: false, block: "locked" as TalentBlock };
    const st = rank >= n.maxRank ? "max" : rank > 0 ? "own" : c.ok ? "can" : c.block === "tier" || c.block === "requires" ? "gate" : "idle";
    const cap = n.tier === 5;
    return `<button class="tn s-${st}${cap ? " cap" : ""}${c.ok ? " can" : ""}" data-nav data-act="tal" data-id="${n.id}" aria-label="${esc(n.name)} ${rank}/${n.maxRank}">
      <span class="tn-ic">${n.icon ? img(n.icon, "px") : `<i>${esc(n.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase())}</i>`}</span>
      <span class="tn-nm">${esc(n.name)}</span>
      <span class="tn-rk">${rank}/${n.maxRank}</span>
    </button>`;
  };

  const talentSheet = (nid: string) => {
    const p = save.profile;
    const n = tree?.nodes.find((x) => x.id === nid) as TalentNode;
    const rank = p.heroes[id]?.talents[nid] ?? 0;
    const c = canAllocate(p, id, nid, ctx);
    let why = "";
    if (!c.ok && c.block) {
      if (c.block === "tier") {
        const need = tierRequirement(n.tier) - branchPointsBelow(tree as TalentTree, p.heroes[id]?.talents ?? {}, n.branch, n.tier);
        why = `Spend ${need} more point${need === 1 ? "" : "s"} in ${esc((tree as TalentTree).branches[n.branch])} first.`;
      } else why = esc(TALENT_BLOCK[c.block]);
    }
    const pips = `<div class="rk-pips">${Array.from({ length: n.maxRank }, (_, i) => `<i class="${i < rank ? "on" : ""}"></i>`).join("")}<span>RANK ${rank} / ${n.maxRank}</span></div>`;
    const html = `${pips}${rank > 0 ? `<div class="fx-now"><small>NOW</small><b>${esc(n.desc(rank))}</b></div>` : ""}${rank < n.maxRank ? `<div class="fx-next"><small>${rank > 0 ? "NEXT RANK" : "EFFECT"}</small><b>${esc(n.desc(rank + 1))}</b></div>` : `<div class="fx-max">${tag("MAXED", "gold")}</div>`}${n.tier === 5 ? `<p class="ks-note">${tag("CAPSTONE", "rainbow")} Changes how the hero plays.</p>` : ""}${why && rank < n.maxRank ? `<p class="why">${why}</p>` : ""}`;
    const foot = [rank < n.maxRank ? btn("+1 RANK", { cls: `gold small${c.ok ? "" : " nope"}`, act: "add", def: c.ok }) : "", rank > 0 ? btn("−1 RANK", { cls: "ghost small", act: "sub" }) : ""].join("");
    return { title: n.name, kicker: `TIER ${n.tier} · ${(tree as TalentTree).branches[n.branch].toUpperCase()}`, html, foot };
  };

  const openTalent = (nid: string) => {
    if (!tree) return;
    app.sfx("uiConfirm");
    sheetNode = nid;
    const s = talentSheet(nid);
    sheet?.close();
    sheet = openSheet(app, { ...s, cls: "tal-sheet", onClose: () => (sheet = null) });
    bindTalentSheet();
  };

  const bindTalentSheet = () => {
    const s = sheet;
    if (!s) return;
    bindActs(s.el, {
      add: (b) => {
        const r = allocateTalent(save.profile, id, sheetNode, ctx);
        if (!r.ok) {
          app.sfx("uiDeny");
          shake(b);
          return;
        }
        app.sfx("talentUp", 1, (r.rank ?? 1) * 2);
        afterTalent();
      },
      sub: (b) => {
        const r = refundTalent(save.profile, id, sheetNode, ctx);
        if (!r.ok) {
          app.sfx("uiDeny");
          shake(b);
          hub.toast("Other talents depend on this one.", { kind: "bad", sub: "Refund the higher tiers first." });
          return;
        }
        app.sfx("uiBack");
        afterTalent();
      },
    });
  };

  const afterTalent = () => {
    hub.changed(false);
    const y = body.scrollTop;
    renderHead();
    renderBody();
    body.scrollTop = y;
    pop(body.querySelector(`.tn[data-id="${CSS.escape(sheetNode)}"]`), 1.25);
    if (sheet) {
      const s = talentSheet(sheetNode);
      sheet.update({ html: s.html, foot: s.foot });
      bindTalentSheet();
    }
  };

  const resetAll = async () => {
    const cost = talentResetCost(save.profile, id);
    const ok = await confirmDialog(app, { title: "Retcon talents?", body: `All of ${esc(hd.name)}'s talent points come back for ${money("coins", fmtInt(cost))}. Regret is free.`, ok: "RETCON", danger: true });
    if (!ok) return;
    const r = resetTalents(save.profile, id);
    if (!r.ok) {
      app.sfx("uiDeny");
      hub.toast(r.reason === "coins" ? "Not enough Star Coins!" : "Nothing to retcon.", { kind: "bad" });
      return;
    }
    app.sfx("reroll");
    hub.changed();
    renderHead();
    renderBody();
  };

  renderHead();
  renderBody();
  return {
    id: "hero",
    el,
    title: hd.name.toUpperCase(),
    layer,
    opaque: true,
    show() {
      renderHead();
      renderBody();
    },
    dispose() {
      sheet?.close();
    },
  };
}

/** The ♡ Favourite counter's "everyone else" count (stable per hero, small and sad). */
function favBase(id: string): number {
  let x = 7;
  for (let i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) >>> 0;
  return 2 + (x % 40);
}
