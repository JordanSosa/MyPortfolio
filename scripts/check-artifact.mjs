// Artifact boot check (docs/DEVTOOLS.md §6): the single-file build, wrapped exactly like the published artifact
// (scripts/artifact-page.py: CSP with no fetch / XHR, data: and blob: images and fonts only), booted headless as
// a phone, through the hub and a short run. Fails on any CSP violation, page error, external URL, network
// request that is not data: / blob:, or fetch / XHR at all (the artifact sandbox blocks them: the atlas
// decode via fetch(dataURI) was exactly this bug). ~16 s with the build, ~5 s with --no-build.
//
//   node scripts/check-artifact.mjs [--no-build] [--out shots/artifact] [--json] [--root <checkout>]
//   node scripts/check-artifact.mjs --self-test     plant a fetch("data:...") and an external image: both must be caught
//
// Writes <out>/kira-kira-overdrive.html (the page body to publish), <out>/preview-csp.html, <out>/hub.png,
// <out>/run.png and <out>/report.json.
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, newPage } from "./lib.mjs";
import { launchBrowser } from "./scenes.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
let ROOT = REPO;
/** Single-file page budget (bytes): 2,193,217 when the developer suite landed (+86 KB for the inlined console). */
export const SINGLE_BUDGET = 2_400_000;

/** Runs in the page before any game script: records fetch / XHR / beacon / socket use and CSP violations. */
const SPY = () => {
  const w = window;
  w.__net = [];
  w.__csp = [];
  const rec = (kind, url) => w.__net.push({ kind, url: String(url).slice(0, 120) });
  const f = w.fetch;
  w.fetch = function (input, init) {
    rec("fetch", typeof input === "string" ? input : input?.url ?? input);
    return f.call(this, input, init);
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url, ...rest) {
    rec("xhr", url);
    return open.call(this, m, url, ...rest);
  };
  if (navigator.sendBeacon) {
    const sb = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, d) => (rec("beacon", url), sb(url, d));
  }
  const WS = w.WebSocket;
  w.WebSocket = function (url, p) {
    rec("websocket", url);
    return new WS(url, p);
  };
  document.addEventListener("securitypolicyviolation", (e) => {
    w.__csp.push({ directive: e.violatedDirective, blocked: String(e.blockedURI).slice(0, 120), sample: e.sample, line: e.lineNumber });
    w.__failAt ??= performance.now();
  });
  // (a boot that already broke: the boot wait gives up 3 s later instead of at its 20 s timeout)
  w.addEventListener("error", () => (w.__failAt ??= performance.now()));
  w.addEventListener("unhandledrejection", () => (w.__failAt ??= performance.now()));
};

function sh(cmd, args, label) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`${label} failed (exit ${r.status}):\n${(r.stdout + r.stderr).split("\n").slice(-25).join("\n")}`);
  return { ms: Date.now() - t0, out: r.stdout + r.stderr };
}

export async function checkArtifact(args = {}) {
  const T0 = Date.now();
  // --root <dir>: check another checkout (e.g. an old commit exported with `git archive`, node_modules linked)
  ROOT = args.root && args.root !== true ? resolve(args.root) : REPO;
  const out = join(REPO, args.out && args.out !== true ? args.out : "shots/artifact");
  mkdirSync(out, { recursive: true });
  const problems = [];
  const timings = {};
  if (!args["no-build"]) timings.build = sh("npx", ["vite", "build", "--mode", "single", "--logLevel", "error"], "vite build --mode single").ms;
  timings.wrap = sh("python3", [join(REPO, "scripts/artifact-page.py"), out], "scripts/artifact-page.py").ms;
  const pageFile = join(out, "kira-kira-overdrive.html");
  const page = readFileSync(pageFile, "utf8");
  const bytes = statSync(pageFile).size;
  const gz = gzipSync(page, { level: 9 }).length;
  if (bytes > SINGLE_BUDGET) problems.push(`single-file page is ${bytes} B, budget ${SINGLE_BUDGET} B`);
  // static: external URLs anywhere in the page (artifact-page.py checks http(s) hosts too) and data: fetches
  const ext = [...new Set([...page.matchAll(/\b(?:https?:)?\/\/(?!www\.w3\.org)[a-z0-9-]+\.[a-z0-9.-]+\.[a-z]{2,}[^\s"'`)]*/gi)].map((m) => m[0]))].filter((u) => !/^\/\/(?:\s|$)/.test(u)).slice(0, 5);
  if (ext.length) problems.push(`external URLs in the page: ${ext.join(", ")}`);
  const dataFetch = page.match(/fetch\(\s*[`'"]data:/g)?.length ?? 0;
  if (dataFetch) problems.push(`${dataFetch} fetch("data:...") call(s) in the bundle: the artifact CSP blocks them`);

  // serve the CSP-wrapped preview over http (CSP both as the meta tag and as a header)
  const csp = /Content-Security-Policy" content="([^"]+)"/.exec(readFileSync(join(out, "preview-csp.html"), "utf8"))?.[1] ?? "";
  let html = readFileSync(join(out, "preview-csp.html"), "utf8");
  // --self-test: plant the bugs this check exists for; each must be reported
  if (args["self-test"])
    html = html.replace("</body>", `<script>fetch("data:text/plain,atlas").catch(()=>{});</script><img src="https://example.com/x.png" alt=""></body>`);
  const server = createServer((req, res) => {
    if (req.url === "/" || req.url?.startsWith("/?")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": csp });
      res.end(html);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  const report = { ok: false, bytes, gzip: gz, budget: SINGLE_BUDGET, timings, problems, net: [], csp: [], requests: [], errors: [], boot: null, hub: null, run: null };
  try {
    const p = await newPage(browser, { mobile: true });
    await p.addInitScript(SPY);
    const requests = [];
    p.on("request", (r) => {
      const u = r.url();
      if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) requests.push(u.slice(0, 120));
    });
    const t0 = Date.now();
    await p.goto(`${origin}/`, { waitUntil: "load", timeout: 60000 });
    const booted = await p
      .waitForFunction(() => (window.__kk && window.__kk.app && !document.getElementById("boot")) || (window.__failAt != null && performance.now() - window.__failAt > 3000), null, { timeout: Number(args["boot-timeout"] ?? 20000), polling: 50 })
      .then(() => p.evaluate(() => !!(window.__kk && window.__kk.app && !document.getElementById("boot"))))
      .catch(() => false);
    report.boot = { ms: Date.now() - t0, ok: booted };
    if (!booted) {
      problems.push(`the game did not boot (${((Date.now() - t0) / 1000).toFixed(1)} s; still on the boot screen: "${await p.evaluate(() => (document.getElementById("boot")?.textContent ?? "").trim().slice(0, 120)).catch(() => "?")}")`);
      await p.screenshot({ path: join(out, "boot.png") }).catch(() => {});
    } else {
    // a few live frames on the real rAF loop first (boot -> splash / hub), then deterministic steps
    await p.waitForTimeout(600);
    const t1 = Date.now();
    report.hub = await p.evaluate(async () => {
      window.__kk.freeze(true);
      const r = await window.__kk.scenario("hub:mid");
      window.__kk.step(30);
      const s = await window.__kk.snapshot();
      return { ok: r.ok, error: r.error ?? null, ms: r.ms, screen: s.screen, hubPage: s.hubPage };
    });
    report.hub.wallMs = Date.now() - t1;
    await p.screenshot({ path: join(out, "hub.png") });
    const t2 = Date.now();
    report.run = await p.evaluate(async () => {
      const r = await window.__kk.scenario("run:early");
      window.__kk.step(180); // 3 s of play
      const s = await window.__kk.snapshot();
      return { ok: r.ok, error: r.error ?? null, ms: r.ms, screen: s.screen, t: s.run?.t ?? null, enemies: s.run?.enemies.total ?? 0, level: s.run?.level ?? 0, fps: s.perf.fps };
    });
    report.run.wallMs = Date.now() - t2;
    await p.screenshot({ path: join(out, "run.png") });
    // back to the live loop for a moment: real frames must not throw either
    await p.evaluate(() => window.__kk.freeze(false));
    await p.waitForTimeout(800);
    }
    const spy = await p.evaluate(() => ({ net: window.__net, csp: window.__csp }));
    report.net = spy.net;
    report.csp = spy.csp;
    report.requests = requests;
    report.errors = p.__logs.filter((l) => /^\[pageerror\]|^\[error\]|Content Security Policy|Refused to/.test(l)).map((l) => l.slice(0, 240));
  } finally {
    if (!args["keep-open"]) await browser.close().catch(() => {});
    server.close();
  }
  if (report.boot?.ok && !report.hub?.ok) problems.push(`hub scenario failed: ${report.hub?.error}`);
  if (report.boot?.ok && !report.run?.ok) problems.push(`run scenario failed: ${report.run?.error}`);
  else if (report.run?.ok && !(report.run.t > 2 && report.run.screen === "game")) problems.push(`the run did not play (screen ${report.run.screen}, t ${report.run.t})`);
  for (const v of report.csp) problems.push(`CSP violation: ${v.directive} blocked ${v.blocked}${v.sample ? ` (${v.sample})` : ""}`);
  for (const n of report.net) problems.push(`${n.kind}(${n.url}) at runtime: the artifact sandbox blocks network access${n.url.startsWith("data:") ? " (data: URIs too)" : ""}`);
  for (const u of report.requests) problems.push(`network request to ${u}`);
  for (const e of report.errors) problems.push(e);
  if (args["self-test"]) {
    const want = [/CSP violation: connect-src blocked data/, /fetch\(data:/, /network request to https:\/\/example\.com|CSP violation: img-src blocked https:\/\/example\.com/];
    report.selfTest = want.map((re) => ({ expect: String(re), found: problems.some((p) => re.test(p)) }));
    report.ok = report.selfTest.every((t) => t.found);
  } else report.ok = problems.length === 0;
  report.ms = Date.now() - T0;
  report.out = relative(REPO, out);
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 1));
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = parseArgs();
  let r;
  try {
    r = await checkArtifact(args);
  } catch (e) {
    console.log(`check:artifact FAIL: ${e.message}`);
    process.exit(1);
  }
  if (args.json) console.log(JSON.stringify(r, null, 1));
  else {
    const t = r.timings;
    console.log(`page ${r.bytes} B (gzip ${r.gzip} B, budget ${r.budget} B) | build ${t.build != null ? (t.build / 1000).toFixed(1) + " s" : "skipped"} | boot ${r.boot?.ms} ms | hub:mid ${r.hub?.ok ? "ok" : "FAIL"} (${r.hub?.wallMs} ms) | run:early ${r.run?.ok ? "ok" : "FAIL"} (t ${r.run?.t}, ${r.run?.enemies} enemies, ${r.run?.wallMs} ms)`);
    console.log(`CSP violations ${r.csp.length} | fetch/XHR ${r.net.length} | external requests ${r.requests.length} | page errors ${r.errors.length}`);
    if (r.problems.length) console.log(`\nproblems:\n  ${r.problems.join("\n  ")}`);
    if (r.selfTest) for (const t of r.selfTest) console.log(`self-test ${t.found ? "ok  " : "FAIL"} ${t.expect}`);
    console.log(`check:artifact ${r.ok ? "ok" : "FAIL"} in ${(r.ms / 1000).toFixed(1)} s -> ${r.out}/ (kira-kira-overdrive.html = the page to publish)`);
  }
  process.exit(r.ok ? 0 : 1);
}
