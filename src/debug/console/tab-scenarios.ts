/**
 * Scenarios tab: every scenario as one button (grouped), with seed / hero / profile options. A
 * tap runs it (sandboxed: the save is never written), shows how long it took, and collapses the
 * console so the state is visible.
 */
import { HEROES } from "../../game/heroes";
import { loadScenarios } from "../dev";
import type { ConsoleHost, Tab } from "./console";
import { btn, el, esc, input, row, select, toast, toggle } from "./ui";

export function scenarioTab(h: ConsoleHost): Tab {
  const app = h.app;
  const root = el("div");
  root.append(el("div", "kkd-note", "Runs in a SANDBOX: your save is never written (reload for the real one). Same seed = same state."));
  const seed = input("1", 56, "numeric");
  const hero = select(HEROES.map((d) => d.id), "hoshi");
  const profile = select([["", "profile: default"], "fresh", "mid", "rich", "P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7"]);
  let collapseAfter = true;
  root.append(row("seed", seed, hero), row(profile, toggle("collapse after", () => collapseAfter, (v) => (collapseAfter = v))));
  const status = el("div", "kkd-note");
  root.append(status);
  const list = el("div");
  root.append(list);
  let built = false;

  const run = async (name: string) => {
    status.innerHTML = `running <b>${esc(name)}</b>…`;
    const m = await loadScenarios();
    const r = await m.runScenario(app, name, { seed: seed.value, hero: hero.value, profile: profile.value || undefined });
    status.innerHTML = r.ok ? `<span class="kkd-ok">✓ ${esc(name)} ready in ${r.ms} ms</span>` : `<span class="kkd-bad">✗ ${esc(name)}: ${esc(r.error ?? "")}</span>`;
    toast(r.ok ? `${name}: ${r.ms} ms` : `${name} failed`);
    if (r.ok && collapseAfter) h.collapse();
  };

  const build = async () => {
    if (built) return;
    built = true;
    const m = await loadScenarios();
    const groups = new Map<string, { name: string; desc: string }[]>();
    for (const s of m.listScenarios()) {
      const g = groups.get(s.group) ?? [];
      g.push(s);
      groups.set(s.group, g);
    }
    for (const [g, items] of groups) {
      list.append(el("div", "kkd-sec", esc(g)));
      const grid = el("div", "kkd-scn");
      for (const s of items) {
        const b = btn(s.name, () => void run(s.name));
        b.title = s.desc;
        grid.append(b);
      }
      list.append(grid);
    }
  };

  return {
    id: "scn",
    label: "Scn",
    el: root,
    show() {
      void build();
    },
  };
}
