// scripts/lint-css.mjs against synthetic trees that reproduce the two global-CSS collisions of Season 2
// (docs/DEVTOOLS.md §1): the gacha card's bare `.cd` moved the DASH button, the Training Arc's bare `.bn`
// sat on the boss name. The same trees with namespaced classes must lint clean.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { lintCss } from "../scripts/lint-css.mjs";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "kk-lint-css-"));
  dirs.push(root);
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), text);
  }
  return root;
}

const BOOT = `import "./ui/styles.css";\nimport "./ui/kit/kit.css";\nimport "./ui/hub/hub.css";\n`;
const KIT = `.btn { padding: 4px; }\n.btn.big { font-size: 2em; }\n`;
const HUB = `.hpage { position: absolute; inset: 0; }\n`;

/** The .cd bug: core/touch.ts toggles a bare "cd" (and styles `.kk-dash.cd`), the gacha sheet styles `.cd` unscoped. */
function cdTree(cls: string, gachaCls: string) {
  return tree({
    "src/main.ts": BOOT,
    "src/ui/styles.css": `.hud { position: absolute; }\n`,
    "src/ui/kit/kit.css": KIT,
    "src/ui/hub/hub.css": HUB,
    "src/core/touch.ts": `const CSS = \`
.kk-dash{position:absolute;right:20px;bottom:40px}
.kk-dash.${cls}{filter:saturate(.45)}
\`;
export function make(): HTMLElement {
  const btn = document.createElement("button");
  btn.className = "kk-dash";
  return btn;
}
export function sync(btn: HTMLElement, ready: boolean) {
  btn.classList.toggle("${cls}", !ready);
}
`,
    "src/ui/hub/gacha.ts": `import "./gacha/gacha.css";\nexport const card = (i: number) => \`<div class="${gachaCls} r-ssr" data-i="\${i}"><div class="cd-in"></div></div>\`;\n`,
    "src/ui/hub/gacha/gacha.css": `.${gachaCls} {\n  position: relative;\n  min-width: 0;\n}\n.${gachaCls}.flip .cd-in { transform: rotateY(180deg); }\n`,
  });
}

/** The .bn bug: the HUD's boss name `.bossbar .bn` (styles.css, hud.ts markup) vs the Training Arc's bare `.bn` node button. */
function bnTree(name: string) {
  return tree({
    "src/main.ts": BOOT,
    "src/ui/styles.css": `.bossbar { position: absolute; top: 8px; }\n.bossbar .${name} { font-weight: 700; }\n`,
    "src/ui/kit/kit.css": KIT,
    "src/ui/hub/hub.css": HUB,
    "src/ui/hud.ts": `export const html = \`<div class="bossbar"><div class="${name}"></div><div class="track"></div></div>\`;\n`,
    "src/ui/hub/board.ts": `import "./board/board.css";\nexport const node = (id: string) => \`<button class="bn" data-id="\${id}"></button>\`;\n`,
    "src/ui/hub/board/board.css": `.bn {\n  position: absolute;\n  width: 2em;\n}\n.bn > * { pointer-events: none; }\n`,
  });
}

describe("lint:css (scripts/lint-css.mjs)", () => {
  test("flags the .cd collision: a hub page's bare .cd reaches the in-run DASH button", () => {
    const r = lintCss({ dir: cdTree("cd", "cd") });
    const cd = r.findings.filter((f) => f.cls === "cd" && f.level === "error");
    expect(cd.map((f) => f.rule).sort()).toEqual(["hub-leak", "shared-bare"]);
    expect(cd.find((f) => f.rule === "hub-leak")?.user).toMatch(/^src\/core\/touch\.ts:\d+$/);
    expect(cd[0].sheet).toBe("src/ui/hub/gacha/gacha.css");
  });

  test("the fix (kk-cd / gc-cd, as shipped in 57cb271) lints clean", () => {
    const r = lintCss({ dir: cdTree("kk-cd", "gc-cd") });
    expect(r.errors).toBe(0);
  });

  test("flags the .bn collision: the board's bare .bn vs the HUD's .bossbar .bn", () => {
    const r = lintCss({ dir: bnTree("bn") });
    const bn = r.findings.filter((f) => f.cls === "bn" && f.level === "error");
    expect(bn.map((f) => f.rule).sort()).toEqual(["hub-leak", "shared-bare"]);
    expect(bn.some((f) => f.user?.startsWith("src/ui/hud.ts"))).toBe(true);
  });

  test("the fix (.bb-name, as shipped) lints clean; the board's short .bn stays a warning", () => {
    const r = lintCss({ dir: bnTree("bb-name") });
    expect(r.errors).toBe(0);
    expect(r.findings.some((f) => f.cls === "bn" && f.rule === "short-name" && f.level === "warning")).toBe(true);
  });

  test("hub page sheets may not style bare elements (they would reach the in-run HUD)", () => {
    const r = lintCss({
      dir: tree({
        "src/main.ts": BOOT,
        "src/ui/styles.css": `.hud { position: absolute; }\n`,
        "src/ui/kit/kit.css": KIT,
        "src/ui/hub/hub.css": HUB,
        "src/ui/hub/wiki.ts": `import "./wiki/wiki.css";\n`,
        "src/ui/hub/wiki/wiki.css": `.wiki-page button { color: red; }\nbutton:hover { color: pink; }\n`,
      }),
    });
    const leak = r.findings.filter((f) => f.rule === "hub-leak");
    expect(leak).toHaveLength(1);
    expect(leak[0].sel).toBe("button:hover");
  });

  test("kit classes refined by a page, reduced-motion overrides and dead rules are not collisions", () => {
    const r = lintCss({
      dir: tree({
        "src/main.ts": BOOT,
        "src/ui/styles.css": `.meta .pp { display: flex; }\n`,
        "src/ui/kit/kit.css": KIT,
        "src/ui/hub/hub.css": `${HUB}@media (prefers-reduced-motion: reduce) {\n  .pp.can { animation: none !important; }\n}\n`,
        "src/ui/hub/plot.ts": `import "./plot/plot.css";\nexport const row = () => \`<div class="pp can"><button class="btn big">GO</button></div>\`;\n`,
        "src/ui/hub/plot/plot.css": `.pp { position: relative; }\n.plot-page .btn { margin: 0; }\n`,
      }),
    });
    expect(r.errors).toBe(0);
  });
});
