/**
 * PLAY -> stage -> LOADOUT ("pre-episode"): the stage strip, a hero carousel
 * (lock states + hints), the selected hero's kit, relic slots with an
 * inventory picker (bottom sheet / side panel), the Plot Twist list ("Network
 * Notes") with rank steppers, a heat meter (badges 4 / 8 / 16 / 32) and the
 * reward multiplier, the Filler Arc toggle once the stage is cleared, the
 * "Prepared Protagonist" start-weapon pick when the board grants it, and the
 * sticky START EPISODE bar. Every change goes through src/meta setLoadout (the
 * loadout is repaired and saved); START runs save.runPlan() -> RunConfig.
 */
import type { RelicDef, TwistDef } from "../../game/defs";
import { HEROES } from "../../game/heroes";
import { RELICS, TWISTS, ULTIMATES, WEAPONS } from "../../game/registry";
import { gameContent } from "../../meta/content";
import { heroView } from "../../meta/heroes";
import { setLoadout, type LoadoutChoice } from "../../meta/loadout";
import { ROSTER } from "../../meta/roster";
import { TUNING } from "../../meta/tuning";
import { isUnlocked, unlockStatus } from "../../meta/unlocks";
import { RARITIES } from "../../game/defs";
import { esc, fmtInt, h, img } from "../dom";
import { heatIcon, portrait, RARITY_CLS, rarityBadge, relicIcon, twistIcon } from "../kit/art";
import { badge, bindActs, btn, card, pbar, pop, sectionTitle, shake, tag, type CardOpts } from "../kit/controls";
import { openSheet, type SheetHandle } from "../kit/overlay";
import { save } from "../save";
import { pageLayer, type Hub, type HubPage } from "./hub";
import { clock, ratingMul, relicTile, stageThumb, starPips, toggle } from "./parts";

const MAX_SLOTS = TUNING.relics.maxSlots;
const BADGES = TUNING.payout.heatBadges;

/** Heat of every registered twist at its max rank (the meter's scale). */
function maxHeat(): number {
  let t = 0;
  for (const d of TWISTS.values()) for (let i = 0; i < d.maxRank; i++) t += d.heat[i] ?? 0;
  return Math.max(1, t);
}

export function loadoutPage(hub: Hub): HubPage {
  const app = hub.app;
  const el = h("div", "loadout");
  const layer = pageLayer(hub);
  let sheet: SheetHandle | null = null;

  const change = (c: LoadoutChoice) => {
    setLoadout(save.profile, c);
    hub.changed(false);
    render();
  };

  const render = () => {
    const p = save.profile;
    const ctx = gameContent();
    const plan = save.runPlan();
    const L = plan.loadout;
    const stage = ctx.stageById.get(L.stage);
    const rec = p.records[L.stage];
    const cleared = (rec?.clears ?? 0) > 0;
    const scroller = el.querySelector(".lo-scroll") as HTMLElement | null;
    const carousel = el.querySelector(".hc-strip") as HTMLElement | null;
    const keepY = scroller?.scrollTop ?? 0;
    const keepX = carousel?.scrollLeft ?? 0;
    const focusKey = layer.focus ? `${layer.focus.dataset.act ?? ""}|${layer.focus.dataset.id ?? ""}|${layer.focus.dataset.i ?? ""}` : "";

    // ---- heroes
    const heroes = HEROES.map((d) => {
      const v = heroView(p, d.id, ctx);
      const on = d.id === L.hero;
      const locked = !v.unlocked;
      return `<button class="hc-card${on ? " on" : ""}${locked ? " locked" : ""}" data-nav data-act="hero" data-id="${d.id}" style="--hc:${app.heroColor(d.id)}" aria-label="${esc(d.name)}${locked ? " (locked)" : ""}">
        <span class="hc-por">${portrait(d.portrait, 0, "pimg", locked)}${locked ? `<i class="lock-i"></i>` : ""}</span>
        <b>${locked ? "???" : esc(d.name)}</b><small>${locked ? "LOCKED" : `LV ${v.level.level}`}</small>
        ${!locked && v.points.free > 0 && ctx.talents.has(d.id) ? badge(v.points.free) : ""}
      </button>`;
    });
    for (const r of ROSTER) {
      if (ctx.heroById.has(r.id)) continue;
      heroes.push(`<button class="hc-card locked soon" data-nav data-act="soon" data-id="${r.id}" aria-label="Coming soon"><span class="hc-por">${portrait("", 0, "pimg", true)}</span><b>???</b><small>SOON</small></button>`);
    }
    const hd = HEROES.find((d) => d.id === L.hero) ?? HEROES[0];
    const hv = heroView(p, hd.id, ctx);
    const wd = WEAPONS.get(hd.weapon);
    const ud = ULTIMATES.get(hd.ult);

    // ---- relics
    const slots: string[] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const id = L.relics[i];
      const def = id ? RELICS.get(id) : undefined;
      if (i >= plan.relicSlots)
        slots.push(`<button class="rslot locked" data-nav data-act="slotlocked" data-i="${i}" aria-label="Locked relic slot"><i class="lock-i"></i><small>TRAINING ARC</small></button>`);
      else if (def) slots.push(`<button class="rslot" data-nav data-act="slot" data-i="${i}" aria-label="${esc(def.name)}">${relicTile(def, p.relics[def.id] ?? 0)}<small>${esc(def.name)}</small></button>`);
      else slots.push(`<button class="rslot empty" data-nav data-act="slot" data-i="${i}" aria-label="Empty relic slot"><span class="plus">+</span><small>EMPTY</small></button>`);
    }
    const equipped = L.relics.map((id) => RELICS.get(id)).filter((d): d is RelicDef => !!d);
    const owned = Object.keys(p.relics).filter((id) => RELICS.has(id)).length;

    // ---- twists
    // unlocked twists first (the "???" teasers for later stages after them)
    const twists = [...TWISTS.values()].sort((a, b) => Number(isUnlocked(p, "twist", b.id)) - Number(isUnlocked(p, "twist", a.id)));
    const heat = plan.heat;
    const mh = maxHeat();
    const coinMul = 1 + heat * TUNING.payout.heatCoinPer;
    const gemMul = 1 + heat * TUNING.payout.heatGemPer;
    const twistRows = twists
      .map((d) => {
        const unlocked = isUnlocked(p, "twist", d.id);
        const r = L.twists[d.id] ?? 0;
        if (!unlocked) {
          const st = unlockStatus(p, "twist", d.id, ctx);
          return `<div class="tw-row locked">${twistIcon(d.id)}<span class="tw-tx"><b>???</b><small>${esc(st.rule.hint || "Locked.")}</small></span><i class="lock-i"></i></div>`;
        }
        return twistRow(d, r, cleared);
      })
      .join("");

    // ---- start weapon (board "Prepared Protagonist")
    const swLevel = plan.board.startWeaponLevel;
    // (the hero's own weapon is the SIGNATURE chip: the World levels it to LV2 instead of adding a copy)
    const startWeapons = swLevel > 0 ? ctx.baseWeapons.filter((w) => isUnlocked(p, "weapon", w.id) && w.id !== hd.weapon) : [];
    const signature = !L.startWeapon || L.startWeapon === hd.weapon;
    const ep = p.lifetime.runs + 1;
    const startWeaponHtml = startWeapons.length
            ? `${sectionTitle("Prepared Protagonist", `<span class="sec-r">starts at LV${swLevel}</span>`)}
               <div class="sw-chips kscroll-x">
                 <button class="chip${signature ? " on" : ""}" data-nav data-act="sw" data-id="">${img(wd?.icon ?? "", "px")} SIGNATURE</button>
                 ${startWeapons.map((w) => `<button class="chip${L.startWeapon === w.id ? " on" : ""}" data-nav data-act="sw" data-id="${w.id}">${img(w.icon, "px")} ${esc(w.name)}</button>`).join("")}
               </div>`
            : "";

    el.innerHTML = `
      <div class="lo-scroll kscroll"><div class="lo-cols"><div class="lo-col a">
        <button class="lo-stage" data-nav data-act="stage" aria-label="Change episode">
          <span class="lo-thumb">${stageThumb(stage)}</span>
          <span class="lo-st"><small>${esc((stage?.name ?? "").toUpperCase())}${stage ? ` · RATINGS ×${ratingMul(stage.rewardMul)}` : ""}</small><b>${esc(stage?.subtitle ?? "")}</b></span>
          <span class="lo-chg">CHANGE</span>
        </button>

        ${sectionTitle("The Cast", `<span class="sec-r">${fmtInt(HEROES.filter((d) => p.unlocks.heroes.includes(d.id)).length)} / ${ROSTER.length}</span>`)}
        <div class="hc-strip kscroll-x">${heroes.join("")}</div>
        <div class="lo-hero" style="--hc:${app.heroColor(hd.id)}">
          <div class="lh-row"><span class="lh-ic">✦</span><span><small>TRAIT</small><b>${esc(hd.trait)}</b></span></div>
          <div class="lh-row">${img(wd?.icon ?? "", "px lh-img")}<span><small>START WEAPON${swLevel > 0 && signature ? ` · LV${swLevel}` : ""}</small><b>${esc(wd?.name ?? hd.weapon)}</b></span></div>
          <div class="lh-row">${portrait(hd.portrait, 1, "lh-img")}<span><small>OVERDRIVE</small><b>${esc(ud?.name ?? hd.ult)}</b></span></div>
          <div class="lh-foot"><span>LV ${hv.level.level} · C${hv.constellation}${ctx.talents.has(hd.id) ? ` · ${hv.points.spent}/${hv.points.total} talent pts` : ""}</span>
            <button class="chip" data-nav data-act="talents" data-id="${hd.id}">TALENTS ▸${hv.points.free > 0 && ctx.talents.has(hd.id) ? badge(hv.points.free) : ""}</button></div>
        </div>
        ${startWeaponHtml}
        </div><div class="lo-col b">

        ${sectionTitle("Merch (Relics)", `<span class="sec-r">${L.relics.length} / ${plan.relicSlots} equipped</span>`)}
        <div class="rslots">${slots.join("")}</div>
        ${
          equipped.length
            ? `<div class="relic-fx">${equipped
                .map((d) => {
                  const st = p.relics[d.id] ?? 0;
                  return card({ art: relicIcon(d.id, d.rarity, "rico"), kicker: `${d.rarity} MERCH`, title: `${esc(d.name)} ${starPips(st)}`, body: esc(d.desc(st)), rarity: RARITY_CLS[d.rarity] as CardOpts["rarity"], cls: "rfx" });
                })
                .join("")}</div>`
            : `<div class="lo-note">${owned ? "Tap a slot to equip merch from your shelf." : "Your merch shelf is empty. The Merch Machine sells hope (and relics)."}</div>`
        }

        ${sectionTitle("Network Notes (Plot Twists)", cleared ? `<span class="sec-r">${heatIcon("hico")} ${heat}</span>` : "")}
        ${
          cleared
            ? `<div class="heat">
                <div class="heat-top">${heatIcon("hico big")}<span class="heat-n"><small>HEAT</small><b>${heat}</b></span>
                  <span class="heat-mul"><span>★ ×${coinMul.toFixed(2)}</span><span>♦ ×${gemMul.toFixed(2)}</span></span></div>
                <div class="heat-bar">${pbar(heat / mh, "", "rainbow")}${BADGES.filter((b) => b <= mh)
                  .map((b) => `<i class="hb${heat >= b ? " on" : ""}${(rec?.bestHeat ?? -1) >= b ? " got" : ""}" style="left:${((b / mh) * 100).toFixed(2)}%"><span>${b}</span></i>`)
                  .join("")}</div>
                <div class="heat-best">Best heat cleared here: <b>${rec && rec.bestHeat >= 0 ? rec.bestHeat : "—"}</b>${rec && rec.bestHeat >= 0 ? "" : " · Badges at 4 / 8 / 16 / 32 pay gems"}</div>
              </div>
              <div class="tw-list">${twistRows}</div>`
            : `<div class="lo-locked"><i class="lock-i"></i><span>Clear <b>${esc(stage?.name ?? "this stage")}</b> to unlock Plot Twists. More heat, more rewards. (No spoilers.)</span></div>`
        }

        ${
          cleared && stage?.endless !== false
            ? `${sectionTitle("Filler Arc")}
               <div class="lo-toggle"><span><b>CONTINUE INTO FILLER ARC</b><small>Keep going after the final boss. ${rec && rec.bestEndless > 0 ? `Record ${clock(rec.bestEndless)}` : "Rewards keep counting!"}</small></span>${toggle(L.endless, "endless", "Continue into the Filler Arc")}</div>`
            : ""
        }

        </div></div>
        <div class="lo-pad"></div>
      </div>
      <div class="lo-go">
        <span class="lo-sum">${portrait(hd.portrait, 0, "lo-mini")}<span><b>${esc(hd.name)}</b><small>${esc(stage?.name ?? "")}${heat ? ` · HEAT ${heat}` : ""}${L.endless ? " · FILLER ARC" : ""}</small></span></span>
        ${btn(`▶ START EPISODE ${fmtInt(ep)}`, { cls: "gold go", act: "go", def: true })}
      </div>`;

    const sc = el.querySelector(".lo-scroll") as HTMLElement;
    sc.scrollTop = keepY;
    const cs = el.querySelector(".hc-strip") as HTMLElement;
    if (keepX) cs.scrollLeft = keepX;
    else (cs.querySelector(".hc-card.on") as HTMLElement | null)?.scrollIntoView?.({ block: "nearest", inline: "center" });

    bindActs(el, {
      stage: () => hub.back(),
      hero: (b) => {
        const id = b.dataset.id as string;
        if (b.classList.contains("locked")) {
          const st = unlockStatus(p, "hero", id, ctx);
          app.sfx("uiDeny");
          shake(b);
          hub.toast("Locked hero", { kind: "bad", sub: `${st.rule.hint}${st.target > 1 ? ` (${fmtInt(st.value)} / ${fmtInt(st.target)})` : ""}` });
          return;
        }
        if (id === L.hero) return;
        app.sfx("cardFlip");
        change({ hero: id });
        pop(el.querySelector(`.hc-card[data-id="${id}"]`));
      },
      soon: (b) => {
        app.sfx("uiDeny");
        shake(b);
        hub.toast("??? — Appears in a later episode.", { kind: "info" });
      },
      talents: (b) => hub.open("hero", { hero: b.dataset.id, tab: "talents" }),
      slot: (b) => openPicker(Number(b.dataset.i)),
      slotlocked: (b) => {
        app.sfx("uiDeny");
        shake(b);
        hub.toast("Relic slot locked", { kind: "bad", sub: "Buy the extra merch slots on the Training Arc." });
      },
      "tw+": (b) => stepTwist(b.dataset.id as string, +1, b),
      "tw-": (b) => stepTwist(b.dataset.id as string, -1, b),
      endless: () => {
        app.sfx("uiMove");
        change({ endless: !L.endless });
      },
      sw: (b) => {
        app.sfx("uiMove");
        change({ startWeapon: b.dataset.id ? (b.dataset.id as string) : null });
      },
      go: () => {
        app.sfx("uiConfirm");
        app.startAccountRun();
      },
    });
    if (focusKey) {
      const [act, id, i] = focusKey.split("|");
      const again = [...el.querySelectorAll<HTMLElement>(`[data-act="${CSS.escape(act)}"]`)].find((x) => (x.dataset.id ?? "") === id && (x.dataset.i ?? "") === i);
      app.nav.refocus(layer, again ?? null);
    }
  };

  const twistRow = (d: TwistDef, r: number, cleared: boolean): string => {
    const on = r > 0;
    const next = d.heat[r] ?? 0;
    const cur = d.heat.slice(0, r).reduce((a, b) => a + b, 0);
    return `<div class="tw-row${on ? " on" : ""}">
      ${twistIcon(d.id)}
      <span class="tw-tx"><b>${esc(d.name)}${d.maxRank > 1 ? ` <small class="tw-rk">${r}/${d.maxRank}</small>` : ""}</b><small>${esc(d.desc(Math.max(1, r)))}</small>${d.note ? `<em>${esc(d.note)}</em>` : ""}</span>
      <span class="tw-heat">${on ? `+${cur}` : next ? `+${next}` : ""}</span>
      <span class="tw-step">
        <button class="ibtn small" data-nav data-act="tw-" data-id="${d.id}" ${!on || !cleared ? "disabled" : ""} aria-label="Lower ${esc(d.name)}">−</button>
        <button class="ibtn small plus" data-nav data-act="tw+" data-id="${d.id}" ${r >= d.maxRank || !cleared ? "disabled" : ""} aria-label="Raise ${esc(d.name)}">+</button>
      </span>
    </div>`;
  };

  const stepTwist = (id: string, dir: number, b: HTMLElement) => {
    const p = save.profile;
    const d = TWISTS.get(id);
    if (!d) return;
    const cur = p.loadout.twists[id] ?? 0;
    const r = Math.max(0, Math.min(d.maxRank, cur + dir));
    if (r === cur) {
      shake(b);
      return;
    }
    app.sfx(dir > 0 ? "uiConfirm" : "uiBack", 0.8, dir > 0 ? r * 2 : 0);
    const tw = { ...p.loadout.twists };
    if (r > 0) tw[id] = r;
    else delete tw[id];
    change({ twists: tw });
  };

  /** Relic inventory picker for slot `i`. */
  const openPicker = (i: number) => {
    app.sfx("uiConfirm");
    const build = () => {
      const p = save.profile;
      const L = p.loadout;
      const cur = L.relics[i];
      const list = Object.keys(p.relics)
        .map((id) => RELICS.get(id))
        .filter((d): d is RelicDef => !!d)
        .sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || (a.name < b.name ? -1 : 1));
      if (!list.length)
        return `<div class="empty-shelf"><div class="es-ic">${portrait("", 0, "pimg", true)}</div><p>Your merch shelf is empty.</p><p class="muted">Relics come from the Merch Machine (and the Copium Exchange).</p>${btn("GO TO MERCH MACHINE", { cls: "violet small", act: "shop" })}</div>`;
      return `<div class="pick-list">${list
        .map((d) => {
          const st = p.relics[d.id] ?? 0;
          const at = L.relics.indexOf(d.id);
          const here = d.id === cur;
          return `<button class="pick-row${here ? " here" : ""}" data-nav data-act="pick" data-id="${d.id}">
            ${relicTile(d, st)}
            <span class="pk-tx"><b>${esc(d.name)} ${rarityBadge(d.rarity)}</b>${starPips(st)}<small>${esc(d.desc(st))}</small><em>${esc(d.flavor)}</em></span>
            <span class="pk-st">${here ? tag("EQUIPPED", "gold") : at >= 0 ? tag(`SLOT ${at + 1}`) : tag("EQUIP", "pink")}</span>
          </button>`;
        })
        .join("")}</div>`;
    };
    const foot = () => (save.profile.loadout.relics[i] ? btn("UNEQUIP", { cls: "ghost small", act: "unequip" }) : "");
    sheet = openSheet(app, { title: "Merch Shelf", kicker: `RELIC SLOT ${i + 1}`, html: build(), foot: foot(), onClose: () => (sheet = null) });
    const bindSheet = () => {
      const s = sheet;
      if (!s) return;
      bindActs(s.el, {
        pick: (b) => {
          const id = b.dataset.id as string;
          const relics = [...save.profile.loadout.relics];
          const from = relics.indexOf(id);
          if (from === i) {
            s.close();
            return;
          }
          if (from >= 0) relics.splice(from, 1);
          if (i < relics.length) relics[i] = id;
          else relics.push(id);
          app.sfx("equip");
          change({ relics: relics.filter((x, k) => relics.indexOf(x) === k) });
          s.close();
          // docs/content/relics.md, relic card copy: "<name> equipped! (+1 to your aesthetic)"
          const def = RELICS.get(id);
          if (def) hub.toast(`${def.name} equipped!`, { kind: "good", sub: "(+1 to your aesthetic)" });
          pop(el.querySelector(`.rslot[data-i="${Math.min(i, save.profile.loadout.relics.length - 1)}"]`));
        },
        unequip: () => {
          const relics = [...save.profile.loadout.relics];
          relics.splice(i, 1);
          app.sfx("uiBack");
          change({ relics });
          s.close();
        },
        shop: () => {
          s.close();
          hub.open("gacha");
        },
      });
    };
    bindSheet();
  };

  render();
  return {
    id: "loadout",
    el,
    title: "LOADOUT",
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
