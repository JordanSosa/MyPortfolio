/**
 * Hero page (docs/EXPANSION.md §6): a fan-site banner header (portrait - tap
 * for the shouting frame -, sparkly ~*~ name, title + rarity, level + XP bar,
 * constellation stars, free talent points, SET AS ACTIVE with a flourish, the
 * coin LV UP accelerator with a full-screen LEVEL UP! celebration) over three
 * tabs: PROFILE (heroes/profile.ts), TALENTS (heroes/talents.ts) and
 * CONSTELLATION (heroes/cons.ts). Talent ranks pop, tier gates unlock with a
 * flourish and a capstone gets its own splash.
 */
import type { TalentTree } from "../../../game/defs";
import { heroDef } from "../../../game/heroes";
import type { HeroDef } from "../../../game/types";
import { gameContent } from "../../../meta/content";
import { heroLevelUpCost } from "../../../meta/economy";
import { allocateTalent, branchPointsBelow, buyHeroLevel, heroView, refundTalent, resetTalents, talentResetCost, tierRequirement } from "../../../meta/heroes";
import { setLoadout } from "../../../meta/loadout";
import { isGachaHero, ROSTER_BY_ID } from "../../../meta/roster";
import { unlockStatus } from "../../../meta/unlocks";
import { esc, fmtInt, h, hasArt, img } from "../../dom";
import { money, portrait, rarityBadge } from "../../kit/art";
import { bindActs, btn, pbar, pop, shake, TabBar } from "../../kit/controls";
import { confirmDialog, openSheet, type SheetHandle } from "../../kit/overlay";
import { reducedMotion } from "../../kit/ticker";
import { save } from "../../save";
import { fillGlyphs } from "../board/glyph";
import { pageLayer, type Hub, type HubPage, type PageOpts } from "../hub";
import { consCaption, consHtml } from "./cons";
import { capKind, ARC, talentCard, talentIcon, treeHead, treeHtml } from "./talents";
import { capstoneSplash, hop, levelUpSplash, miniCutin, sparkBurst } from "./fx";
import { favBase, heroBand, parseBio, profileHtml } from "./profile";

const hexColors = (hd: HeroDef): string[] => hd.colors.map((c) => `#${c.toString(16).padStart(6, "0")}`);

/** Which tier gates are open, per branch ("0-2" ...). */
function openGates(tree: TalentTree, ranks: Readonly<Record<string, number>>): Set<string> {
  const out = new Set<string>();
  for (let br = 0; br < 3; br++) for (let t = 2; t <= 5; t++) if (branchPointsBelow(tree, ranks, br, t) >= tierRequirement(t)) out.add(`${br}-${t}`);
  return out;
}

export function heroPage(hub: Hub, o: PageOpts): HubPage {
  const app = hub.app;
  const ctx = gameContent();
  const hd = heroDef(o.hero ?? save.profile.loadout.hero);
  const id = hd.id;
  const hc = app.heroColor(id);
  const el = h("div", "hero-pg");
  el.style.setProperty("--hc", hc);
  const layer = pageLayer(hub);
  let tab = o.tab === "talents" || o.tab === "cons" ? o.tab : "profile";
  let sheet: SheetHandle | null = null;
  let sheetNode = "";
  let disposed = false;
  let stampDone = false;
  const tree = ctx.talents.get(id);
  const fxLayer = h("div", "hfx-layer");
  app.ui.appendChild(fxLayer);
  const calm = () => !!app.settings.reduceFlashing;
  const lvKey = `lvs_${id}`;

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

  // ---------------------------------------------------------------- header
  const renderHead = () => {
    const p = save.profile;
    const v = heroView(p, id, ctx);
    const li = v.level;
    const active = p.loadout.hero === id;
    const cost = v.unlocked && !li.maxed ? heroLevelUpCost(v.hp.xp) : 0;
    const st = v.unlocked ? null : unlockStatus(p, "hero", id, ctx);
    const r = ROSTER_BY_ID.get(id);
    const bio = parseBio(id, hd.name);
    const cons = Array.from({ length: 6 }, (_, k) => `<i class="${k < v.constellation ? "on" : ""}">★</i>`).join("");
    const free = tree && v.unlocked ? v.points.free : 0;
    head.innerHTML = `
      <i class="hp-glit" aria-hidden="true"></i>
      <button class="hp-por" data-nav data-act="shout" aria-label="${esc(hd.name)}: tap for the battle cry">${v.unlocked ? portrait(hd.portrait, 0, "pimg") : hasArt(hd.portrait) ? img(hd.portrait, "px pimg sil", 0) : portrait("", 0, "pimg", true)}<i class="hp-ring" aria-hidden="true"></i></button>
      <div class="hp-id">
        <b class="hp-name"><span class="hp-spk">${v.unlocked ? esc(bio.title) : "~*~ ??? ~*~"}</span><i class="hp-tw t1" aria-hidden="true">✦</i><i class="hp-tw t2" aria-hidden="true">✧</i></b>
        <small class="hp-tt">${r ? rarityBadge(r.rarity, "rbadge sm") : ""}<span>${esc(hd.title.toUpperCase())}</span></small>
        ${
          v.unlocked
            ? `<div class="hp-lv"><b class="lvb">LV ${li.level}</b>${pbar(li.maxed ? 1 : li.into / li.need, li.maxed ? "MAX LEVEL" : `${fmtInt(li.into)} / ${fmtInt(li.need)} XP`, "gold")}</div>
               <div class="hp-cons"><small>C${v.constellation}</small><span class="hp-c6">${cons}</span>${tree ? `<button class="hp-pts${free > 0 ? " has" : ""}" data-nav data-act="gotal" aria-label="${free} talent points free"><b>${free}</b> PT${free === 1 ? "" : "S"}</button>` : ""}</div>`
            : `<div class="hp-lockhint"><i class="lock-i"></i><span>${esc(isGachaHero(id) ? "Available in the Merch Machine (allegedly)." : (st?.rule.hint ?? "Appears in a later episode."))}</span></div>${st && st.target > 1 ? pbar(st.value / st.target, `${fmtInt(st.value)} / ${fmtInt(st.target)}`, "violet") : ""}`
        }
        <div class="hp-btns">
          ${v.unlocked ? (active ? `<span class="hp-active">★ ACTIVE</span>` : btn("SET AS ACTIVE", { cls: "gold small", act: "select", def: true })) : isGachaHero(id) ? btn("MERCH MACHINE", { cls: "violet small", act: "gacha" }) : ""}
          ${v.unlocked && !li.maxed ? btn(`LV UP ${money("coins", fmtInt(cost), p.currencies.coins < cost ? "poor" : "")}`, { cls: "ghost small", act: "buylv", aria: "Buy the rest of this level with Star Coins" }) : ""}
        </div>
      </div>
      ${active ? `<span class="hp-star" aria-hidden="true">NOW STARRING</span>` : ""}`;
    bindActs(head, {
      shout: (b) => {
        if (!heroView(save.profile, id, ctx).unlocked) {
          app.sfx("uiDeny");
          shake(b);
          return;
        }
        app.sfx("voiceBlip", 1, 2);
        const im = b.querySelector<HTMLElement>(".pimg");
        if (im) im.outerHTML = portrait(hd.portrait, 1, "pimg");
        hop(b);
        sparkBurst(fxLayer, b, { n: 8, glyphs: "✦!", colors: hexColors(hd), spread: 70 });
        setTimeout(() => {
          const im2 = b.querySelector<HTMLElement>(".pimg");
          if (im2 && !disposed) im2.outerHTML = portrait(hd.portrait, 0, "pimg");
        }, 1200);
      },
      select: (b) => {
        app.sfx("equip");
        setTimeout(() => app.sfx("voiceBlip", 0.9, 4), reducedMotion() ? 0 : 160);
        setLoadout(save.profile, { hero: id });
        hub.changed(false);
        sparkBurst(fxLayer, b, { n: 18, glyphs: "♥✦★♥", colors: [hc, "#ff7ab8", "#ffe14d", "#fff"], spread: 130 });
        renderHead();
        const por = head.querySelector<HTMLElement>(".hp-por");
        if (por) {
          const im = por.querySelector<HTMLElement>(".pimg");
          if (im) im.outerHTML = portrait(hd.portrait, 1, "pimg");
          hop(por);
          setTimeout(() => {
            const im2 = por.querySelector<HTMLElement>(".pimg");
            if (im2 && !disposed) im2.outerHTML = portrait(hd.portrait, 0, "pimg");
          }, 1100);
        }
        head.querySelector(".hp-star")?.classList.add("slam");
        hub.toast(`${hd.name} stars in the next episode!`, { kind: "good", sub: "Casting confirmed. The narrator is thrilled." });
      },
      gotal: () => {
        if (tab === "talents") return;
        tab = "talents";
        tabs.select("talents");
        app.sfx("tabSwitch");
        renderBody();
        body.scrollTop = 0;
      },
      gacha: () => hub.open("gacha"),
      buylv: async (b) => {
        const c = heroLevelUpCost(save.profile.heroes[id]?.xp ?? 0);
        if (save.profile.currencies.coins < c) {
          app.sfx("uiDeny");
          shake(b);
          hub.toast("Not enough Star Coins!", { kind: "bad", sub: "Episodes give hero XP for free, by the way." });
          return;
        }
        const ok = await confirmDialog(app, { title: "Skip the montage?", body: `Buy the rest of this level for ${money("coins", fmtInt(c))}?<br><small>(Playing episodes levels heroes for free.)</small>`, ok: "LEVEL UP", okCls: "gold" });
        if (!ok || disposed) return;
        const from = heroView(save.profile, id, ctx).level.level;
        const r = buyHeroLevel(save.profile, id);
        if (!r.ok) {
          app.sfx("uiDeny");
          return;
        }
        save.profile.flags[lvKey] = r.level;
        hub.changed();
        renderHead();
        if (tab === "talents") renderBody();
        levelUpSplash(app, {
          name: hd.name,
          portraitId: hd.portrait,
          hc,
          colors: hexColors(hd),
          from,
          to: r.level,
          points: tree ? r.level - from : 0,
          calm: calm(),
          done: () => {
            const lv = head.querySelector(".lvb");
            pop(lv, 1.4);
            pop(head.querySelector(".hp-pts"), 1.3);
          },
        });
      },
    });
  };

  // ---------------------------------------------------------------- body
  const renderBody = () => {
    const p = save.profile;
    const v = heroView(p, id, ctx);
    if (tab === "talents") {
      body.innerHTML = tree
        ? `${treeHead(v.points.free, v.points.spent, v.points.total, talentResetCost(p, id))}${treeHtml(p, hd, tree, v.unlocked)}`
        : `<p class="lo-note">${esc(hd.name)}'s talent tree is still being written. (Season 2.5, probably.)</p>`;
    } else if (tab === "cons") body.innerHTML = consHtml(hd, v.constellation, isGachaHero(id));
    else body.innerHTML = profileHtml(hd, v.hp, v.unlocked, !!p.flags[`fav_${id}`], v.level.level);
    body.dataset.tab = tab;
    fillGlyphs(body);
    if (tab === "profile" && v.unlocked && !stampDone) {
      stampDone = true;
      if (!reducedMotion()) setTimeout(() => !disposed && tab === "profile" && app.sfx("fanSmack", 0.45, -4), 520);
    } else if (tab === "profile") body.querySelector(".fan-stamp")?.classList.add("still");
    bindActs(body, {
      fav: (b) => {
        const k = `fav_${id}`;
        const flags = save.profile.flags;
        flags[k] = flags[k] ? 0 : 1;
        save.save();
        app.sfx(flags[k] ? "sparkleCharm" : "uiBack", 0.8);
        b.classList.toggle("on", !!flags[k]);
        b.innerHTML = `${flags[k] ? "♥" : "♡"} Favourite <b>${favBase(id) + (flags[k] ? 1 : 0)}</b>`;
        pop(b, 1.2);
        if (flags[k]) sparkBurst(fxLayer, b, { n: 10, glyphs: "♥", colors: ["#ff7ab8", "#ffb8dc", "#d9468f"], spread: 80 });
      },
      preview: (b) => {
        const card = b.closest<HTMLElement>(".hk-card");
        if (!card) return;
        app.sfx("ultCutin", 0.6);
        miniCutin(card, { band: heroBand(hd), portraitId: hd.portrait, title: (card.querySelector(".hk-body b")?.textContent ?? hd.ult).toUpperCase(), line: hd.cutinLine });
      },
      tal: (b) => openTalent(b.dataset.id as string),
      reset: resetAll,
      gacha: () => hub.open("gacha"),
      star: (b) => {
        const i = Number(b.dataset.i);
        app.sfx("uiMove", 1, i);
        const cap = body.querySelector(".cs-cap");
        if (cap) cap.innerHTML = consCaption(hd, heroView(save.profile, id, ctx).constellation, i);
        for (const s of body.querySelectorAll(".cs-st")) s.classList.toggle("sel", s === b);
        pop(b, 1.3);
      },
    });
  };

  // ---------------------------------------------------------------- talents
  const openTalent = (nid: string) => {
    if (!tree) return;
    app.sfx("uiConfirm");
    sheetNode = nid;
    const c = talentCard(save.profile, hd, tree, nid);
    if (sheet && !sheet.closed) sheet.update(c);
    else sheet = openSheet(app, { ...c, cls: "tal-sheet", onClose: () => (sheet = null) });
    fillGlyphs(sheet.el);
    bindTalentSheet();
  };

  const bindTalentSheet = () => {
    const s = sheet;
    if (!s) return;
    bindActs(s.el, {
      add: (b) => {
        if (!tree) return;
        const before = openGates(tree, save.profile.heroes[id]?.talents ?? {});
        const r = allocateTalent(save.profile, id, sheetNode, ctx);
        if (!r.ok) {
          app.sfx("uiDeny");
          shake(b);
          if (r.block === "points") hub.toast("No free talent points.", { kind: "bad", sub: "Hero levels give one each. Episodes give hero levels." });
          return;
        }
        app.sfx("talentUp", 1, Math.min(8, (r.rank ?? 1) * 2));
        app.input.haptic(14);
        afterTalent(before, true);
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
        afterTalent(null, false);
      },
    });
  };

  const afterTalent = (gatesBefore: Set<string> | null, added: boolean) => {
    if (!tree) return;
    hub.changed(false);
    const y = body.scrollTop;
    renderHead();
    renderBody();
    body.scrollTop = y;
    if (sheet && !sheet.closed) {
      const c = talentCard(save.profile, hd, tree, sheetNode);
      sheet.update({ html: c.html, foot: c.foot });
      fillGlyphs(sheet.el);
      bindTalentSheet();
      if (added) {
        const rk = save.profile.heroes[id]?.talents[sheetNode] ?? 0;
        const pip = sheet.el.querySelectorAll(".rk-pips i")[rk - 1];
        pip?.classList.add("new");
      }
    }
    const nodeEl = body.querySelector<HTMLElement>(`.tn[data-id="${CSS.escape(sheetNode)}"]`);
    const n = tree.nodes.find((x) => x.id === sheetNode);
    if (added && nodeEl && n) {
      pop(nodeEl, 1.18);
      const rank = save.profile.heroes[id]?.talents[sheetNode] ?? 0;
      const pip = nodeEl.querySelectorAll(".tn-pips i")[rank - 1];
      pip?.classList.add("new");
      // the burst comes out of what the player is looking at: the card's newest pip (else the node)
      const shown = sheet && !sheet.closed ? sheet.el.querySelectorAll(".rk-pips i")[rank - 1] : null;
      sparkBurst(fxLayer, shown ?? nodeEl, { n: 10, glyphs: "✦★", colors: [ARC[n.branch], "#fff", "#ffe14d"], spread: 80 });
      pop(nodeEl.closest(".tt-col")?.querySelector(".tt-bn small") ?? null, 1.3);
      // gates that just opened: the lock pops off and the tier wakes up
      const now = openGates(tree, save.profile.heroes[id]?.talents ?? {});
      let k = 0;
      for (const g of now) {
        if (gatesBefore?.has(g)) continue;
        const gEl = body.querySelector<HTMLElement>(`[data-gate="${g}"]`);
        if (!gEl) continue;
        gEl.classList.add("just");
        setTimeout(() => app.sfx("uiConfirm", 0.8, 6), reducedMotion() ? 0 : 220);
        for (const tn of gEl.parentElement?.querySelectorAll<HTMLElement>(".tn") ?? []) tn.classList.add("wake");
        k++;
      }
      if (k) hub.toast("New tier unlocked!", { kind: "good", sub: "The arc continues. The montage music swells." });
      if (n.tier === 5 && rank === 1)
        capstoneSplash(app, {
          hero: hd.name,
          hc,
          colors: hexColors(hd),
          name: n.name,
          desc: n.desc(1),
          kind: capKind(hd, n),
          icon: `<span class="tal-ic big" style="--ac:${ARC[n.branch]}">${talentIcon(hd, n, ARC[n.branch])}</span>`,
          calm: calm(),
        });
    }
  };

  const resetAll = async () => {
    const cost = talentResetCost(save.profile, id);
    const ok = await confirmDialog(app, { title: "Retcon talents?", body: `All of ${esc(hd.name)}'s talent points come back for ${money("coins", fmtInt(cost))}.<br><small>Regret is free.</small>`, ok: "RETCON", danger: true });
    if (!ok || disposed) return;
    const r = resetTalents(save.profile, id);
    if (!r.ok) {
      app.sfx("uiDeny");
      hub.toast(r.reason === "coins" ? "Not enough Star Coins!" : "Nothing to retcon.", { kind: "bad" });
      return;
    }
    app.sfx("cassetteEject");
    setTimeout(() => app.sfx("reroll"), reducedMotion() ? 0 : 200);
    hub.changed();
    renderHead();
    renderBody();
    body.querySelector(".tt-tree")?.classList.add("retcon");
    hub.toast("Talents retconned!", { kind: "good", sub: "As far as anyone remembers, that never happened." });
  };

  /** Levels gained in episodes since this page last showed the hero get their celebration now. */
  const greetLevels = () => {
    const p = save.profile;
    const v = heroView(p, id, ctx);
    if (!v.unlocked) return;
    const seen = p.flags[lvKey] ?? 0;
    const now = v.level.level;
    if (seen === now) return;
    p.flags[lvKey] = now;
    save.save();
    if (seen <= 0 || now < seen) return;
    setTimeout(() => {
      if (disposed || hub.top?.el !== el) return;
      levelUpSplash(app, { name: hd.name, portraitId: hd.portrait, hc, colors: hexColors(hd), from: seen, to: now, points: tree ? now - seen : 0, calm: calm(), done: () => pop(head.querySelector(".hp-pts"), 1.3) });
    }, reducedMotion() ? 0 : 420);
  };

  renderHead();
  renderBody();
  greetLevels();
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
      disposed = true;
      sheet?.close();
      fxLayer.remove();
    },
  };
}
