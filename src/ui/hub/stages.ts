/**
 * PLAY -> stage select ("Choose your episode", docs/content/stages.md §8): the
 * season as a strip of episode cards (vertical on portrait phones, a
 * horizontal "season map" road in landscape). Each card is a fake episode
 * thumbnail composed from the stage's own sprites, with the name, subtitle,
 * blurb, "Ratings xN" (reward multiplier) and the records (best time, clears,
 * best heat, Filler Arc record). Locked cards are "???" silhouettes with
 * "UNLOCKS AFTER: <previous stage> (no spoilers)"; a stage the season plan
 * has but the content wave has not registered yet reads "IN PRODUCTION".
 * Tapping a playable card picks it and opens the loadout.
 */
import type { StageInfo } from "../../game/defs";
import { gameContent, stageByOrder } from "../../meta/content";
import { setLoadout } from "../../meta/loadout";
import { isUnlocked, unlockStatus } from "../../meta/unlocks";
import { esc, h } from "../dom";
import { bindActs, shake } from "../kit/controls";
import { save } from "../save";
import { SEASON } from "./copy";
import { pageLayer, type Hub, type HubPage } from "./hub";
import { stageRecords, stageThumb } from "./parts";

interface Ep {
  order: number;
  id: string;
  name: string;
  info?: StageInfo;
  state: "open" | "locked" | "production";
  hint: string;
}

function episodes(): Ep[] {
  const p = save.profile;
  const ctx = gameContent();
  const maxOrder = Math.max(SEASON.length, ...ctx.stages.map((s) => s.order));
  const out: Ep[] = [];
  for (let o = 1; o <= maxOrder; o++) {
    const info = stageByOrder(o, ctx);
    const plan = SEASON.find((s) => s.order === o);
    const prevInfo = stageByOrder(o - 1, ctx);
    const prevName = prevInfo?.name ?? SEASON.find((s) => s.order === o - 1)?.name ?? "the previous episode";
    if (info) {
      const open = isUnlocked(p, "stage", info.id);
      const st = unlockStatus(p, "stage", info.id, ctx);
      out.push({ order: o, id: info.id, name: info.name, info, state: open ? "open" : "locked", hint: open ? "" : `UNLOCKS AFTER: ${info.requires ? (ctx.stageById.get(info.requires)?.name ?? prevName) : prevName} (no spoilers)${st.rule.hint && !st.rule.hint.startsWith("Clear") ? ` · ${st.rule.hint}` : ""}` });
    } else if (plan) {
      const prevCleared = !!prevInfo && (p.records[prevInfo.id]?.clears ?? 0) > 0;
      out.push({ order: o, id: plan.id, name: plan.name, state: prevCleared ? "production" : "locked", hint: prevCleared ? "This episode is still being animated. It airs in a future update!" : `UNLOCKS AFTER: ${prevName} (no spoilers)` });
    }
  }
  return out;
}

export function stagesPage(hub: Hub): HubPage {
  const app = hub.app;
  const el = h("div", "stages");
  const layer = pageLayer(hub);

  const render = () => {
    const p = save.profile;
    const eps = episodes();
    el.innerHTML = `
      <div class="pg-sub">Choose your episode</div>
      <div class="season-strip kscroll">
        <div class="season-road" aria-hidden="true"></div>
        ${eps.map((e, i) => card(e, i, e.id === p.loadout.stage)).join("")}
      </div>`;
    bindActs(el, {
      ep: (b) => {
        const e = eps.find((x) => x.id === b.dataset.id);
        if (!e) return;
        if (e.state !== "open") {
          app.sfx("uiDeny");
          shake(b);
          hub.toast(e.state === "production" ? "Still in production!" : "No spoilers!", { kind: "bad", sub: e.hint });
          return;
        }
        app.sfx("uiConfirm");
        setLoadout(p, { stage: e.id });
        hub.changed(false);
        hub.open("loadout");
      },
    });
  };

  const card = (e: Ep, i: number, selected: boolean): string => {
    const rec = save.profile.records[e.id];
    const open = e.state === "open";
    const info = e.info;
    const sub = open && info ? esc(info.subtitle) : e.state === "production" ? "IN PRODUCTION" : "???";
    const blurb = open && info ? esc(info.blurb ?? "") : esc(e.hint);
    const name = open ? esc(e.name) : e.state === "production" ? esc(e.name) : "???";
    return `<button class="ep-card ${e.state}${selected && open ? " sel" : ""}" data-nav${selected && open ? " data-nav-default" : ""} data-act="ep" data-id="${esc(e.id)}" style="--i:${i}" aria-label="Episode ${e.order}: ${name}">
      <span class="ep-thumb">${stageThumb(info, !open)}
        <span class="ep-no">EP ${e.order}</span>
        ${open && info ? `<span class="ep-rate">Ratings ×${info.rewardMul.toFixed(1)}</span>` : ""}
        ${open && (rec?.clears ?? 0) > 0 ? `<span class="ep-clear">CLEARED ✓</span>` : ""}
        ${e.state === "production" ? `<span class="ep-prod">NOW IN PRODUCTION</span>` : ""}
      </span>
      <span class="ep-body">
        <b class="ep-name">${name}</b>
        <small class="ep-sub">${sub}</small>
        <span class="ep-blurb">${blurb}</span>
        ${open ? `<span class="ep-recs">${stageRecords(rec, info)}</span>` : `<span class="ep-lock"><i class="lock-i"></i></span>`}
      </span>
    </button>`;
  };

  render();
  return {
    id: "stages",
    el,
    title: "EPISODES",
    layer,
    opaque: true,
    show() {
      render();
      app.nav.refocus(layer);
    },
  };
}
