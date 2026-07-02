#!/usr/bin/env node
// Tripo asset pipeline: text -> low-poly model -> auto-rig -> preset animations.
// Uses curl for HTTP so the sandbox proxy + CA bundle are honored automatically.
//
//   node tools/tripo.mjs balance
//   node tools/tripo.mjs full --name blademaster --prompt "..." --anims idle,walk,run,slash,hurt
//   node tools/tripo.mjs retarget --name blademaster --rig-task <id> --anims jump,fall
//
// Downloads land in public/models/<name>/ with a manifest.json. Model URLs
// expire 5 minutes after task success, so every stage downloads immediately.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.TRIPO_API_KEY;
if (!KEY) { console.error("TRIPO_API_KEY not set"); process.exit(1); }
const API = "https://openapi.tripo3d.ai/v3";

function curlJson(method, url, body = null) {
  const args = ["-sS", "--max-time", "60", "-X", method, url,
    "-H", `Authorization: Bearer ${KEY}`, "-H", "Content-Type: application/json"];
  if (body) args.push("-d", JSON.stringify(body));
  const out = execFileSync("curl", args, { encoding: "utf8" });
  let json;
  try { json = JSON.parse(out); } catch { throw new Error(`Non-JSON from ${url}: ${out.slice(0, 300)}`); }
  return json;
}

function apiPost(path, body) {
  const res = curlJson("POST", API + path, body);
  if (res.code !== 0) throw new Error(`POST ${path} failed: ${JSON.stringify(res).slice(0, 400)}`);
  return res.data;
}

function apiGet(path) {
  const res = curlJson("GET", API + path);
  if (res.code !== 0) throw new Error(`GET ${path} failed: ${JSON.stringify(res).slice(0, 400)}`);
  return res.data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(taskId, label, timeoutS = 900) {
  const start = Date.now();
  let lastProgress = -1;
  for (;;) {
    if ((Date.now() - start) / 1000 > timeoutS) throw new Error(`${label}: timeout after ${timeoutS}s`);
    const t = apiGet(`/tasks/${taskId}`);
    if (t.progress !== lastProgress) {
      lastProgress = t.progress;
      console.log(`  [${label}] ${t.status} ${t.progress ?? 0}%`);
    }
    if (t.status === "success") return t;
    if (["failed", "cancelled", "banned", "expired"].includes(t.status)) {
      throw new Error(`${label}: task ${t.status}: ${JSON.stringify(t).slice(0, 400)}`);
    }
    await sleep(2500);
  }
}

function download(url, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  execFileSync("curl", ["-sS", "--max-time", "300", "-L", url, "-o", dest]);
  const size = readFileSync(dest).length;
  if (size < 1000) throw new Error(`Suspiciously small download (${size}B) -> ${dest}`);
  console.log(`  saved ${dest} (${(size / 1024).toFixed(0)} KB)`);
  return size;
}

function balance() {
  const res = curlJson("GET", "https://api.tripo3d.ai/v2/openapi/user/balance");
  return res.data;
}

function loadManifest(name) {
  const p = join(ROOT, "public/models", name, "manifest.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : { name, tasks: {}, files: {}, anims: {} };
}

function saveManifest(name, m) {
  const p = join(ROOT, "public/models", name, "manifest.json");
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(m, null, 2));
}

// ---- stages ----
async function generate(name, prompt, opts = {}) {
  const m = loadManifest(name);
  console.log(`== generate: ${name}`);
  const payload = {
    prompt,
    model: opts.model || "P1-20260311",   // P series: clean low-poly topology
    face_limit: opts.faceLimit || 4000,
    texture: true,
  };
  const { task_id } = apiPost("/generation/text-to-model", payload);
  console.log(`  task: ${task_id}`);
  const task = await poll(task_id, "gen");
  const dir = join(ROOT, "public/models", name);
  download(task.output.model_url, join(dir, "base.glb"));
  if (task.output.rendered_image_url) download(task.output.rendered_image_url, join(dir, "preview.webp"));
  m.prompt = prompt;
  m.tasks.generate = task_id;
  m.files.base = "base.glb";
  saveManifest(name, m);
  return task_id;
}

async function rig(name, genTaskId, rigType = "biped") {
  const m = loadManifest(name);
  console.log(`== rig-check: ${name}`);
  const { task_id: checkId } = apiPost("/animations/rig-check", { input: genTaskId });
  const check = await poll(checkId, "rig-check");
  console.log(`  riggable: ${JSON.stringify(check.output).slice(0, 200)}`);
  const riggable = check.output?.riggable ?? check.output?.riggable;
  if (riggable === false) throw new Error("Model is not riggable — regenerate with clearer limbs/T-pose.");

  console.log(`== rig: ${name} (${rigType})`);
  const { task_id } = apiPost("/animations/rig", {
    input: genTaskId, model: "rig-v2.0", rig_type: rigType, spec: "mixamo", out_format: "glb",
  });
  const task = await poll(task_id, "rig");
  const dir = join(ROOT, "public/models", name);
  if (task.output?.model_url) download(task.output.model_url, join(dir, "rigged.glb"));
  m.tasks.rigCheck = checkId;
  m.tasks.rig = task_id;
  m.rigType = rigType;
  m.files.rigged = "rigged.glb";
  saveManifest(name, m);
  return task_id;
}

async function retarget(name, rigTaskId, anims) {
  const m = loadManifest(name);
  const dir = join(ROOT, "public/models", name);
  // batches of up to 5 presets per task
  for (let i = 0; i < anims.length; i += 5) {
    const batch = anims.slice(i, i + 5);
    console.log(`== retarget: ${name} [${batch.join(", ")}]`);
    const { task_id } = apiPost("/animations/retarget", {
      input: rigTaskId,
      animations: batch.map((a) => `preset:${a}`),
      out_format: "glb",
      bake_animation: true,
      animate_in_place: true,
    });
    const task = await poll(task_id, `anim:${batch[0]}…`);
    const out = task.output || {};
    // output may be model_urls (map/array) or a single model_url
    if (out.model_urls && typeof out.model_urls === "object") {
      const entries = Array.isArray(out.model_urls)
        ? out.model_urls.map((u, j) => [batch[j] || `anim${i + j}`, u])
        : Object.entries(out.model_urls);
      for (const [key, url] of entries) {
        const preset = String(key).replace(/^preset:/, "");
        const f = `anim_${preset}.glb`;
        download(url, join(dir, f));
        m.anims[preset] = f;
      }
    } else if (out.model_url) {
      const f = batch.length === 1 ? `anim_${batch[0]}.glb` : `anim_batch${i / 5}.glb`;
      download(out.model_url, join(dir, f));
      if (batch.length === 1) m.anims[batch[0]] = f;
      else m.anims[`batch${i / 5}`] = { file: f, presets: batch };
    } else {
      console.log("  ! unexpected output shape:", JSON.stringify(out).slice(0, 400));
    }
    m.tasks[`retarget_${i / 5}`] = task_id;
    saveManifest(name, m);
  }
}

// ---- CLI ----
function arg(flag, dflt = null) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

const cmd = process.argv[2];
const before = balance();
console.log(`balance: ${before.balance} credits`);

try {
  if (cmd === "balance") {
    // printed above
  } else if (cmd === "gen") {
    await generate(arg("--name"), arg("--prompt"), { faceLimit: Number(arg("--faces", "4000")) });
  } else if (cmd === "rig") {
    await rig(arg("--name"), arg("--gen-task") || loadManifest(arg("--name")).tasks.generate, arg("--rig-type", "biped"));
  } else if (cmd === "retarget") {
    const name = arg("--name");
    await retarget(name, arg("--rig-task") || loadManifest(name).tasks.rig, arg("--anims").split(","));
  } else if (cmd === "full") {
    const name = arg("--name");
    const genId = await generate(name, arg("--prompt"), { faceLimit: Number(arg("--faces", "4000")) });
    const rigId = await rig(name, genId, arg("--rig-type", "biped"));
    await retarget(name, rigId, arg("--anims", "idle,walk,slash,hurt").split(","));
  } else {
    console.log("commands: balance | gen | rig | retarget | full");
  }
} finally {
  const after = balance();
  console.log(`balance: ${after.balance} credits (spent ${before.balance - after.balance})`);
}
