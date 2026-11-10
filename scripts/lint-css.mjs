// Global-CSS collision lint (docs/DEVTOOLS.md §6): ~0.7 s, no dependencies.
//
//   node scripts/lint-css.mjs                 lint src/ (exit 1 on errors)
//   node scripts/lint-css.mjs --json          machine-readable report on stdout
//   node scripts/lint-css.mjs --rev <git-rev> lint the tree of a commit instead (git show; e.g. 57cb271^ = the .cd bug)
//   node scripts/lint-css.mjs --dir <path>    lint another source tree (tests use a synthetic fixture)
//   node scripts/lint-css.mjs --verbose       also print warnings in full
//
// Why: every .css file the game imports is bundled into ONE global stylesheet, and TS modules inject more
// (core/touch.ts, screens/levelup.ts). Two bugs reached the owner from that: the gacha card's bare `.cd`
// rule threw the cooling-down DASH button (class "cd", core/touch.ts) to the top-left, and the Training
// Arc's bare `.bn` node-button rule put the boss name over the HUD's HP bar. Rules:
//
//   foreign-bare (error)   class C is styled UNSCOPED (as the first compound of a selector, `.c` / `.c.x` /
//                          `.c:hover`) by sheet X, and a TS file outside X's module uses C (class="c", classList,
//                          className, h()/el(), selectors). That element gets X's rules. (= the .cd bug)
//   shared-bare (error)    C is styled unscoped by sheet X AND styled by another module's sheet Y, which means
//                          C has two meanings (= the .bn bug: board.css `.bn` vs styles.css `.bossbar .bn`).
//                          Library sheets (kit.css, hub.css, styles.css: loaded at boot as the shared kit) may be
//                          refined by others only through a compound/scoped selector, never re-defined bare.
//   hub-leak (error)       a hub page sheet styles a bare element / universal selector (`button {}`, `* {}`,
//                          `img {}`) or a class the in-run HUD uses, without scoping it to the page.
//   short-name (warning)   a class of <= 3 characters styled unscoped outside the shared kit: the next collision.
//
// A module = one stylesheet + the TS that owns it (the files in its folder and its importers); a TS file with
// an embedded sheet owns that sheet. Intentional cross-module use goes in ALLOW below with a reason.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Shared sheets (imported by src/main.ts at boot): their bare classes are the public kit. */
const LIBRARY = new Set(["src/ui/styles.css", "src/ui/kit/kit.css", "src/ui/hub/hub.css"]);
/** In-run HUD / modal modules: a hub page sheet must never reach their classes. */
const HUD_MODULES = [/^src\/core\/touch\.ts$/, /^src\/ui\/hud[\w-]*\.ts$/, /^src\/ui\/cutin\.ts$/, /^src\/ui\/tutorial\.ts$/, /^src\/ui\/screens\/(levelup|chest|pause|over)\.ts$/];
/** Hub page sheets (lazy pages, but bundled into the global CSS all the same). */
const HUB_PAGE = /^src\/ui\/hub\/.+\.css$/;
/** Generic state / size words: a module toggling one of these must never meet another module's unscoped rule for it. */
const GENERIC = new Set(["on", "off", "active", "open", "hidden", "show", "hide", "big", "small", "one", "two", "ten", "new", "hot", "hi", "lo", "dim", "glow", "flip", "in", "out", "done", "ready", "busy", "lock", "locked", "full", "empty", "wide", "long", "mini", "max", "pulse", "spin", "shake", "pop", "sel", "cur", "now", "next", "prev", "left", "right", "top", "bottom", "cd", "bn", "bb", "ok", "bad", "good", "win", "lose", "boss", "star", "gold", "red", "blue"]);
/** Known-intentional cross-module uses: `class@file` -> reason. */
const ALLOW = new Map([
  // (keep this short: prefer renaming to a namespaced class)
]);

// ------------------------------------------------------------------ sources
function args(argv = process.argv.slice(2)) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) o[a.slice(2)] = true;
      else (o[a.slice(2)] = v), i++;
    } else o._.push(a);
  }
  return o;
}

/** { path -> text } of src/**\/*.{css,ts} from the working tree, another dir, or a git revision. */
function loadTree(opt) {
  const files = new Map();
  const want = (p) => /\.(css|ts)$/.test(p) && !p.endsWith(".d.ts");
  if (opt.rev) {
    const list = execFileSync("git", ["ls-tree", "-r", "--name-only", opt.rev, "--", "src"], { cwd: ROOT, maxBuffer: 64 << 20 }).toString().split("\n");
    for (const p of list) if (p && want(p)) files.set(p, execFileSync("git", ["show", `${opt.rev}:${p}`], { cwd: ROOT, maxBuffer: 64 << 20 }).toString());
    return files;
  }
  const base = opt.dir ? resolve(process.cwd(), opt.dir) : ROOT;
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const rel = relative(base, p).split("\\").join("/");
        if (want(rel)) files.set(rel, readFileSync(p, "utf8"));
      }
    }
  };
  walk(join(base, "src"));
  return files;
}

// ------------------------------------------------------------------ CSS
const lineAt = (text, i) => {
  let n = 1;
  for (let k = 0; k < i && k < text.length; k++) if (text.charCodeAt(k) === 10) n++;
  return n;
};

/** Split at top-level occurrences of `sep` (outside (), [] and strings). */
function splitTop(s, sep) {
  const out = [];
  let depth = 0, q = "", cur = "";
  for (const ch of s) {
    if (q) {
      cur += ch;
      if (ch === q) q = "";
      continue;
    }
    if (ch === '"' || ch === "'") q = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** A complex selector -> compounds (combinators dropped), pseudo-class arguments removed. */
function compounds(sel) {
  const flat = sel.replace(/::?[\w-]+\((?:[^()]|\([^()]*\))*\)/g, "").replace(/\[[^\]]*\]/g, "[a]");
  return flat.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean);
}
const classesOf = (compound) => [...compound.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
const typeOf = (compound) => (/^([a-zA-Z][\w-]*|\*)/.exec(compound) ?? [])[1] ?? "";

/** Rules of one stylesheet: { sel, line, first: compound[0], comps }. */
function parseCss(text, lineBase = 0) {
  const rules = [];
  const src = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  let i = 0;
  const parseBlock = (end, media = "") => {
    while (i < end) {
      const open = src.indexOf("{", i);
      const close = src.indexOf("}", i);
      if (open === -1 || open > end || (close !== -1 && close < open)) {
        i = close === -1 ? end : close + 1;
        return;
      }
      const head = src.slice(i, open).trim();
      const headAt = i + src.slice(i, open).search(/\S/);
      // matching close of this block
      let d = 1, k = open + 1;
      while (k < src.length && d > 0) {
        if (src[k] === "{") d++;
        else if (src[k] === "}") d--;
        k++;
      }
      if (head.startsWith("@")) {
        if (/^@(media|supports|container|layer|document)\b/.test(head)) {
          i = open + 1;
          parseBlock(k - 1, `${media} ${head}`.trim());
        }
        i = k;
        continue;
      }
      const line = lineBase + lineAt(src, headAt);
      for (const sel of splitTop(head, ",")) {
        const s = sel.trim();
        if (!s || /^(from|to|\d+%)$/.test(s)) continue;
        const comps = compounds(s);
        if (comps.length) rules.push({ sel: s, line, comps, media, body: src.slice(open + 1, k - 1) });
      }
      i = k;
    }
  };
  parseBlock(src.length);
  return rules;
}

// ------------------------------------------------------------------ TS: embedded sheets + class usage
/**
 * Template literals and strings of a TS file: [{ kind: "tpl" | "str", text, at, exprs }], `${...}` replaced by
 * \u0001 in `text` (their string literals kept in `exprs`). A small lexer: strings, templates (nested),
 * comments, regex literals (heuristic: after an operator / keyword).
 */
function literals(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  let lastSig = "";
  const regexOk = () => !lastSig || /[(,=:[!&|?{};+\-*%<>~^]$/.test(lastSig) || /\b(return|typeof|case|in|of|delete|void|throw|new)$/.test(lastSig);
  function readString(q) {
    const at = i++;
    let s = "";
    while (i < n && src[i] !== q) {
      if (src[i] === "\\") {
        s += src[i + 1];
        i += 2;
      } else s += src[i++];
    }
    i++;
    out.push({ kind: "str", text: s, at, exprs: [] });
  }
  function readTemplate() {
    const at = i++;
    let s = "";
    const exprs = [];
    while (i < n && src[i] !== "`") {
      if (src[i] === "\\") {
        s += src[i + 1];
        i += 2;
      } else if (src[i] === "$" && src[i + 1] === "{") {
        i += 2;
        const start = out.length;
        readCode("}");
        exprs.push(out.slice(start).map((l) => l.text));
        s += "\u0001";
      } else s += src[i++];
    }
    i++;
    out.push({ kind: "tpl", text: s, at, exprs });
  }
  function readCode(stop) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (stop && c === stop && depth === 0) {
        i++;
        return;
      }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      if (c === '"' || c === "'") {
        readString(c);
        lastSig = "a";
        continue;
      }
      if (c === "`") {
        readTemplate();
        lastSig = "a";
        continue;
      }
      if (c === "/" && src[i + 1] === "/") {
        while (i < n && src[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && src[i + 1] === "*") {
        const e = src.indexOf("*/", i + 2);
        i = e === -1 ? n : e + 2;
        continue;
      }
      if (c === "/" && regexOk()) {
        i++;
        let cls = false;
        while (i < n && src[i] !== "\n") {
          if (src[i] === "\\") i += 2;
          else if (src[i] === "[") (cls = true), i++;
          else if (src[i] === "]") (cls = false), i++;
          else if (src[i] === "/" && !cls) break;
          else i++;
        }
        i++;
        while (/[a-z]/.test(src[i] ?? "")) i++;
        lastSig = "a";
        continue;
      }
      if (!/\s/.test(c)) {
        const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 40));
        if (m) {
          lastSig = m[0];
          i += m[0].length;
          continue;
        }
        lastSig = c;
      }
      i++;
    }
  }
  readCode("");
  return out;
}

const CSS_LIKE = /^\s*(@media|@keyframes|[.#:*a-zA-Z[][^{}<>;]*\{[^{}]*:[^{}]*[;}])/;
const SEL_LIKE = /^\s*[.#][a-zA-Z_][\w-]*([\s.:>#[+~,]|$)/;

/** Class tokens of a class attribute / className value (`\u0001` = an interpolation: partial tokens are skipped). */
const tokens = (v) => v.split(/\s+/).filter((t) => t && !t.includes("\u0001") && /^-?[_a-zA-Z][\w-]*$/.test(t));

function scanTs(file, src) {
  const lits = literals(src);
  const sheets = [];
  const uses = []; // { cls, line, how }
  const add = (cls, at, how) => uses.push({ cls, line: lineAt(src, at), how });
  for (const l of lits) {
    const before = src.slice(Math.max(0, l.at - 60), l.at);
    // embedded stylesheet
    if (l.kind === "tpl" && !l.text.includes("<") && CSS_LIKE.test(l.text) && (l.text.match(/\{/g) ?? []).length >= 1 && /\}\s*$/.test(l.text.replace(/\u0001/g, "x"))) {
      sheets.push({ text: l.text.replace(/\u0001/g, "0"), line: lineAt(src, l.at) - 1, exported: /export\s+const\s+\w+\s*=\s*$/.test(before) });
      continue;
    }
    // class="..." attributes in markup
    for (const m of l.text.matchAll(/\bclass\s*=\s*(["'])([^"']*)\1/g)) {
      for (const t of tokens(m[2])) add(t, l.at, "class=");
      // string literals inside interpolations of this attribute (`class="row${on ? " on" : ""}"`)
      const first = (l.text.slice(0, m.index).match(/\u0001/g) ?? []).length;
      const count = (m[0].match(/\u0001/g) ?? []).length;
      for (let e = first; e < first + count; e++) for (const lit of l.exprs[e] ?? []) for (const t of tokens(lit)) if (t.length < 40) add(t, l.at, "class=${}");
    }
    // classList / className / helpers taking a class string
    if (/classList\.(add|remove|toggle|contains|replace)\(\s*(?:[^()]*,\s*)?$/.test(before) || /\.className\s*(\+?=|===?|!==?)\s*$/.test(before) || /\bclassName\s*:\s*$/.test(before) || /\b(h|el|img)\([^()]*,\s*$/.test(before)) {
      for (const t of tokens(l.text)) add(t, l.at, "classList");
      continue;
    }
    // selectors (querySelector, closest, q(".a .b") ...)
    if (SEL_LIKE.test(l.text) && !l.text.includes("{")) {
      for (const sel of splitTop(l.text.replace(/\u0001/g, "x"), ",")) for (const c of compounds(sel)) for (const k of classesOf(c)) add(k, l.at, "selector");
    }
  }
  return { sheets, uses };
}

// ------------------------------------------------------------------ model
function analyse(files) {
  const sheets = [];
  const importers = new Map(); // css path -> [ts files]
  const usesByFile = new Map();
  for (const [p, text] of files) {
    if (!p.endsWith(".ts")) continue;
    for (const m of text.matchAll(/import\s+["'](\.{1,2}\/[^"']+\.css)["']/g)) {
      const css = posix.normalize(posix.join(posix.dirname(p), m[1]));
      importers.set(css, [...(importers.get(css) ?? []), p]);
    }
    const { sheets: emb, uses } = scanTs(p, text);
    usesByFile.set(p, uses);
    // an embedded sheet belongs to its file; an exported one (console/style.ts) to the file's folder
    emb.forEach((s, k) => sheets.push({ id: emb.length > 1 ? `${p}#${k + 1}` : p, file: p, embedded: true, rules: parseCss(s.text, s.line), scope: s.exported ? [`${posix.dirname(p)}/`] : [p], home: s.exported ? `${posix.dirname(p)}/` : p }));
  }
  const cssFiles = [...files.keys()].filter((p) => p.endsWith(".css"));
  for (const p of cssFiles) {
    const dir = posix.dirname(p);
    const imp = (importers.get(p) ?? []).filter((f) => !f.endsWith("src/main.ts"));
    // a sheet owns its folder when the folder is its own (gacha/gacha.css, kit/kit.css, hub/hub.css, a boot sheet in src/ui),
    // otherwise only its importers (src/ui/stinger.css -> stinger.ts, screens/results.css -> screens/results.ts)
    const ownFolder = LIBRARY.has(p) || cssFiles.filter((q) => posix.dirname(q) === dir).length === 1 && posix.basename(dir) === posix.basename(p, ".css");
    const scope = [...(ownFolder ? [`${dir}/`] : []), ...imp];
    sheets.push({ id: p, file: p, embedded: false, library: LIBRARY.has(p), hubPage: HUB_PAGE.test(p) && !LIBRARY.has(p), rules: parseCss(files.get(p)), scope, home: ownFolder ? `${dir}/` : p });
  }
  const owns = (sheet, file) => sheet.scope.some((s) => (s.endsWith("/") ? file.startsWith(s) : file === s));
  const sheetsOf = (file) => sheets.filter((s) => owns(s, file));
  /** Same family: one sheet's home folder contains the other's (hub/hub.css and hub/wiki/wiki.css), or they share an owner. */
  const family = (a, b) => (a.home.endsWith("/") && b.file.startsWith(a.home)) || (b.home.endsWith("/") && a.file.startsWith(b.home)) || a.scope.some((s) => !s.endsWith("/") && b.scope.includes(s));

  // per rule: the anchor = the only class of its FIRST compound (`.cd`, `.cd:hover`, `div.cd`, `.bn > *`); a rule
  // anchored on C reaches any element with class C (or its descendants) wherever it lives.
  for (const sh of sheets)
    for (const r of sh.rules) {
      const first = classesOf(r.comps[0]);
      r.anchor = first.length === 1 && !/#/.test(r.comps[0]) ? first[0] : null;
      r.tail = r.comps.slice(1).flatMap(classesOf);
      // reduced-motion overrides that only switch animations / transitions off (hub.css does this for other sheets' classes)
      r.motionOnly = /prefers-reduced-motion/.test(r.media) && /^\s*((animation|transition)[\w-]*\s*:[^;]*;?\s*)+$/.test(r.body);
    }
  const styled = new Map(); // class -> Map(sheetId -> rules)
  for (const sh of sheets)
    for (const r of sh.rules)
      if (!r.motionOnly) for (const comp of r.comps)
        for (const k of classesOf(comp)) {
          const m = styled.get(k) ?? (styled.set(k, new Map()), styled.get(k));
          m.set(sh.id, [...(m.get(sh.id) ?? []), r]);
        }

  const libBare = new Set(sheets.filter((x) => x.library).flatMap((x) => x.rules.filter((r) => r.anchor && r.comps.length === 1).map((r) => r.anchor)));
  const findings = [];
  const push = (f) => findings.push(f);
  const hudFile = (f) => HUD_MODULES.some((re) => re.test(f));
  const marks = new Map(); // file -> Set(classes put on elements)
  for (const [file, uses] of usesByFile) marks.set(file, new Set(uses.filter((u) => u.how !== "selector").map((u) => u.cls)));
  const everMarked = new Set([...marks.values()].flatMap((x) => [...x]));
  /** A rule some element can match: every class in it is set by some TS file (else it is dead CSS: `.meta .pp`). */
  const live = (q) => q.comps.every((c) => classesOf(c).every((k) => everMarked.has(k)));

  for (const X of sheets) {
    for (const r of X.rules) {
      // hub page sheets: bare element / universal selectors leak into the whole document (the in-run HUD included)
      if (X.hubPage) {
        const c0 = r.comps[0].replace(/::?[\w-]+/g, "");
        const t = typeOf(r.comps[0]);
        if (t && !/[.#[]/.test(c0) && !["html", "body", ":root"].includes(t))
          push({ rule: "hub-leak", level: "error", cls: t, sheet: X.id, line: r.line, sel: r.sel, msg: `${X.id}:${r.line} \`${r.sel}\` styles every <${t}> in the document (the in-run HUD and modals too): scope it to its page (e.g. \`.my-page ${t}\`)` });
      }
      const k = r.anchor;
      if (!k) continue;
      // `body.reduce-flash .x` / `html.touch .x`: a document state flag, scoped by design
      if (/^(html|body|:root)\b/.test(r.comps[0])) continue;
      if (r.motionOnly) continue;
      const generic = k.length <= 3 || GENERIC.has(k);
      /** The rule styles `.k` itself as a component (k is the only class of the first compound). */
      const anchors = (q) => q.anchor === k;
      // foreign-bare: a TS file outside X puts class k on an element (and has every class the rule's tail needs)
      if (!X.library) {
        for (const [file, set] of marks) {
          if (!set.has(k) || owns(X, file) || ALLOW.has(`${k}@${file}`)) continue;
          if (!r.tail.every((t) => set.has(t))) continue;
          const u = usesByFile.get(file).find((x) => x.cls === k && x.how !== "selector");
          const own = sheetsOf(file).filter((s) => s.id !== X.id && styled.get(k)?.has(s.id));
          const ownRules = own.flatMap((s) => styled.get(k).get(s.id)).filter(live);
          const hud = hudFile(file) && X.hubPage;
          if (ownRules.some(anchors)) {
            push({ rule: "split-definition", level: "warning", cls: k, sheet: X.id, line: r.line, sel: r.sel, user: `${own[0].id}`, msg: `".${k}" (${file}) is defined unscoped in both ${X.id}:${r.line} and ${own.map((s) => s.id).join(", ")}: keep one definition` });
            continue;
          }
          if (!ownRules.length && !generic && !hud) {
            // a module styled by a sibling's sheet (narrator.ts by stinger.css): legal, reported once per pair
            push({ rule: "borrowed", level: "warning", cls: k, sheet: X.id, line: r.line, sel: r.sel, user: file, msg: `${file} uses classes styled only by ${X.id}` });
            continue;
          }
          push({
            rule: hud ? "hub-leak" : "foreign-bare",
            level: "error",
            cls: k,
            sheet: X.id,
            line: r.line,
            sel: r.sel,
            user: `${file}:${u.line}`,
            msg: `class "${k}" set by ${file}:${u.line} (${u.how}) is styled unscoped by ${X.id}:${r.line} \`${r.sel}\`${ownRules.length ? ` while its own ${own.map((s) => s.id).join(", ")} styles it as \`${ownRules[0].sel}\` (two meanings)` : generic ? " (a generic short name)" : ""}${hud ? " - a hub page rule reaching the in-run HUD" : ""}. That element gets the other module's rules: namespace one of the two classes.`,
          });
        }
      }
      // shared-bare: another module's sheet styles k too (only rules that hit k's element itself or generic
      // descendants count: `.c`, `.c:hover`, `.c > *`, `.c img`; `.c .named-child` targets that child by name)
      if (!r.tail.length) {
        for (const [sid, all] of styled.get(k) ?? []) {
          if (sid === X.id) continue;
          const rules = all.filter(live);
          if (!rules.length) continue;
          const Y = sheets.find((s) => s.id === sid);
          if (ALLOW.has(`${k}@${sid}`)) continue;
          if (X.library && Y.library) continue; // the shared kit split over its three boot sheets
          const yBare = rules.find(anchors);
          if (yBare) {
            // the same component defined in two sheets: legal (bundle order decides), but say so
            push({ rule: "split-definition", level: "warning", cls: k, sheet: X.id, line: r.line, sel: r.sel, user: `${sid}:${yBare.line}`, msg: `".${k}" is defined unscoped in both ${X.id}:${r.line} and ${sid}:${yBare.line}: keep one definition` });
            continue;
          }
          if (X.library) continue; // a kit class refined by a page through a compound / scoped selector: what the kit is for
          // Y uses k under another element (`.bossbar .bn`) = its own, different element; or k is a generic word
          const otherRole = rules.some((q) => !classesOf(q.comps[0]).includes(k));
          if (!generic && !otherRole) {
            if (!family(X, Y)) push({ rule: "refinement", level: "warning", cls: k, sheet: X.id, line: r.line, sel: r.sel, user: `${sid}:${rules[0].line}`, msg: `${sid}:${rules[0].line} \`${rules[0].sel}\` refines ".${k}" from ${X.id}:${r.line}` });
            continue;
          }
          if (family(X, Y) && !generic) continue;
          push({
            rule: "shared-bare",
            level: "error",
            cls: k,
            sheet: X.id,
            line: r.line,
            sel: r.sel,
            user: `${sid}:${rules[0].line}`,
            msg: `class "${k}" has two meanings: ${X.id}:${r.line} styles it unscoped (\`${r.sel}\`) and ${sid}:${rules[0].line} styles its own ".${k}" elements (\`${rules[0].sel}\`). Every ".${k}" of either module gets both: namespace one of them.`,
          });
        }
      }
      if (k.length <= 3 && !X.library && !X.embedded && r.comps.length === 1)
        push({ rule: "short-name", level: "warning", cls: k, sheet: X.id, line: r.line, sel: r.sel, msg: `short global class ".${k}" (${X.id}:${r.line} \`${r.sel}\`): the next collision waiting to happen; prefer a prefixed name` });
    }
  }
  // one finding per (rule, class, sheet, user)
  const seen = new Set();
  const uniq = findings.filter((f) => {
    // (a borrowed sheet is reported once per user / sheet pair, every other finding once per class)
    const pair = f.rule === "split-definition" ? [f.sheet, (f.user ?? "").replace(/:\d+$/, "")].sort().join("|") : `${f.sheet}|${f.user ?? ""}`;
    const key = `${f.rule}|${f.rule === "borrowed" ? "" : f.cls}|${pair}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { findings: uniq, stats: { files: files.size, sheets: sheets.length, embedded: sheets.filter((s) => s.embedded).length, rules: sheets.reduce((a, s) => a + s.rules.length, 0), classes: styled.size, uses: [...usesByFile.values()].reduce((a, u) => a + u.length, 0) } };
}

// ------------------------------------------------------------------ main
export function lintCss(opt = {}) {
  const t0 = performance.now();
  const files = loadTree(opt);
  const r = analyse(files);
  return { ...r, ms: Math.round(performance.now() - t0), errors: r.findings.filter((f) => f.level === "error").length, warnings: r.findings.filter((f) => f.level === "warning").length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const opt = args();
  if (opt.help || process.argv.includes("-h")) {
    const head = [];
    for (const l of readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n")) {
      if (!l.startsWith("//")) break;
      head.push(l.replace(/^\/\/ ?/, ""));
    }
    console.log(head.join("\n"));
    process.exit(0);
  }
  const r = lintCss({ rev: typeof opt.rev === "string" ? opt.rev : undefined, dir: typeof opt.dir === "string" ? opt.dir : undefined });
  if (opt.json) {
    console.log(JSON.stringify(r, null, 1));
  } else {
    const errs = r.findings.filter((f) => f.level === "error");
    const warns = r.findings.filter((f) => f.level === "warning");
    for (const f of errs) console.log(`ERROR ${f.rule}: ${f.msg}`);
    if (opt.verbose) for (const f of warns) console.log(`warn  ${f.rule}: ${f.msg}`);
    else if (warns.length) {
      const by = new Map();
      for (const w of warns) by.set(w.rule, [...(by.get(w.rule) ?? []), w]);
      const parts = [...by].map(([rule, ws]) => `${ws.length} ${rule} (${[...new Set(ws.map((w) => "." + w.cls))].slice(0, 6).join(" ")}${ws.length > 6 ? " ..." : ""})`);
      console.log(`warnings: ${parts.join("; ")} | --verbose lists them`);
    }
    console.log(`lint:css ${errs.length ? "FAIL" : "ok"}: ${errs.length} errors, ${warns.length} warnings | ${r.stats.sheets} sheets (${r.stats.embedded} embedded in TS), ${r.stats.rules} selectors, ${r.stats.classes} classes, ${r.stats.uses} class uses in TS | ${r.ms} ms${opt.rev ? ` | rev ${opt.rev}` : ""}`);
  }
  process.exit(r.errors ? 1 : 0);
}
