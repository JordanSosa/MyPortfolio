/**
 * Account tab: currencies (+/-), UNLOCK ALL, apply a seeded profile (fresh / mid / rich / P0..P7,
 * built by the real meta layer: src/debug/profiles.ts), START OVER, the save string, and the
 * sandbox switch (scenarios turn it on: nothing is written to storage for the rest of the page).
 * Destructive buttons need a second tap within 3 s. Outside the sandbox a profile change is saved
 * like Settings IMPORT (the replaced profile is kept in the backup slot).
 */
import { HEROES } from "../../game/heroes";
import type { App } from "../../ui/app";
import { save } from "../../ui/save";
import { copyText } from "../diag";
import { applyProfile, buildProfile, isSandboxed, PROFILE_KINDS, sandbox, unlockAll } from "../profiles";
import type { ConsoleHost, Tab } from "./console";
import { btn, confirmBtn, el, kv, row, sec, select, toast } from "./ui";

function refreshHub(app: App): void {
  if (app.screen === "hub") app.hub?.refreshTop();
}

export function accountTab(h: ConsoleHost): Tab {
  const app = h.app;
  const root = el("div");
  const mode = el("div", "kkd-note");
  root.append(mode);
  root.append(sec("currencies"));
  const cur = kv();
  root.append(cur.el);
  const add = (k: "coins" | "gems" | "copium", n: number) => () => {
    const c = save.profile.currencies;
    c[k] = Math.max(0, c[k] + n);
    save.save();
    app.hub?.cbar.sync(c, true);
  };
  root.append(row(btn("+1k ★", add("coins", 1000), "sm"), btn("+10k ★", add("coins", 10000), "sm"), btn("+100k ★", add("coins", 100000), "sm")));
  root.append(row(btn("+160 ♦", add("gems", 160), "sm"), btn("+1600 ♦ (x10)", add("gems", 1600), "sm"), btn("+100 copium", add("copium", 100), "sm")));
  root.append(
    row(
      confirmBtn("ZERO ALL", () => {
        const c = save.profile.currencies;
        c.coins = c.gems = c.copium = 0;
        save.save();
        app.hub?.cbar.sync(c, true);
      }),
    ),
  );

  root.append(sec("unlocks"));
  root.append(
    row(
      confirmBtn("UNLOCK ALL", () => {
        const n = unlockAll(save.profile);
        save.save();
        toast(`${n} unlocked`);
        refreshHub(app);
      }),
    ),
  );

  root.append(sec("profile"));
  const kindSel = select(PROFILE_KINDS.map((k) => k), "mid");
  const heroSel = select(HEROES.map((d) => d.id), save.profile.loadout.hero);
  root.append(row(kindSel, heroSel));
  root.append(
    row(
      confirmBtn("APPLY PROFILE", () => {
        const t0 = performance.now();
        const p = buildProfile(kindSel.value, heroSel.value);
        applyProfile(app, p, !isSandboxed());
        toast(`${kindSel.value} applied in ${Math.round(performance.now() - t0)} ms${isSandboxed() ? " (sandbox: not saved)" : " (saved; old one in backup)"}`);
        if (app.screen !== "game") app.goHub(["home"]);
      }),
      confirmBtn("START OVER", () => {
        if (isSandboxed()) applyProfile(app, buildProfile("fresh"));
        else {
          save.reset();
          app.onProfileReplaced();
        }
        toast("fresh profile");
        if (app.screen !== "game") app.goHub(["home"]);
      }),
    ),
  );
  root.append(
    row(
      btn("COPY SAVE STRING", () => {
        void copyText(save.exportString()).then((ok) => toast(ok ? "save string copied" : "copy blocked: Settings > SAVE DATA shows it"));
      }, "sm"),
      confirmBtn("SANDBOX (no writes)", () => {
        sandbox();
        toast("sandbox on: nothing is saved until reload");
      }),
      btn("RELOAD (real save)", () => {
        const u = new URL(location.href);
        for (const k of ["scenario", "step", "profile"]) u.searchParams.delete(k);
        try {
          location.assign(u.toString());
        } catch {
          toast("reload blocked: reload the page by hand");
        }
      }, "sm"),
    ),
  );

  return {
    id: "account",
    label: "Acct",
    el: root,
    update() {
      const p = save.profile;
      mode.innerHTML = isSandboxed() ? '<b class="kkd-bad">SANDBOX</b>: save writes are off for this page (reload for the real save)' : `writes ON · save ${save.origin} rev ${save.rev}${save.writeOk ? "" : ' · <b class="kkd-bad">WRITE FAILING</b>'}`;
      cur.set([
        ["★ coins", Math.floor(p.currencies.coins)],
        ["♦ gems", Math.floor(p.currencies.gems)],
        ["copium", Math.floor(p.currencies.copium)],
        ["runs / clears", `${p.lifetime.runs} / ${p.lifetime.clears}`],
        ["heroes", p.unlocks.heroes.join(" ")],
        ["stages", p.unlocks.stages.length],
        ["board", `${Object.keys(p.board.ranks).length} nodes`],
        ["relics", `${Object.keys(p.relics).length} owned · ${p.loadout.relics.length} equipped`],
      ]);
    },
  };
}
