import "@fontsource/lilita-one/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "./style.css";
import * as THREE from "three";
import { buildWorld, PATH } from "./world.js";
import { Ibis, MAX_STAMINA } from "./ibis.js";
import { Person } from "./people.js";
import { Food, BIG_TYPES } from "./food.js";
import { Input } from "./input.js";
import { Sfx } from "./audio.js";

const ROUND = 150; // seconds
const EAT_TIME = 1.3;
const DIG_TIME = 1.0;
const COMBO_WINDOW = 10;
const BIN_RESET = 30;
const RANKS = [
  [0, "Suburban Pigeon", "You mostly ate grass. Respectable, but not ibis behaviour."],
  [120, "Curious Ibis", "A few chips, a few close calls. The park has noticed you."],
  [280, "Bin Chicken", "Picnickers now guard their lunch on sight. Well earned."],
  [480, "Tip Turkey", "You are a menace to every esky on the foreshore."],
  [720, "Lord of the Bins", "Council is drafting a strategy document about you specifically."],
];

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------------
// Renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
$("stage").appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 600);
const world = buildWorld(scene);
const ibis = new Ibis(scene);
const input = new Input();
const sfx = new Sfx();

// ---------------------------------------------------------------------------
// Spots, people and food
const spots = [];
const people = [];
const loose = []; // ground scraps and dropped items not tied to a slot

function makeSpot(seatsDef, slotsDef, kind) {
  const spot = {
    kind,
    people: [],
    slots: slotsDef,
    foods() {
      const out = [];
      for (const s of this.slots) if (s.food && (s.food.state === "served" || s.food.state === "held" || s.food.state === "ground")) out.push(s.food);
      return out;
    },
  };
  spots.push(spot);
  return spot;
}

for (const def of world.spots) {
  const spot = makeSpot(def.seats, def.slots.map((pos) => ({ pos, food: null, respawn: 0 })), def.kind);
  for (const seat of def.seats) {
    const bbq = def.kind === "bbq";
    const p = new Person(scene, {
      pos: seat.pos, facing: seat.facing, pose: seat.pose, spot,
      kind: bbq ? "bbq" : "sitter",
      range: bbq ? 10 : 8, half: bbq ? 0.72 : 0.6, speed: bbq ? 5.7 : 5.2,
    });
    spot.people.push(p);
    people.push(p);
  }
}
for (const [t, dir] of [[0.4, 1], [2.5, -1], [4.4, 1]]) {
  const spot = makeSpot([], [{ hand: true, food: null, respawn: 0 }], "walker");
  const pos = new THREE.Vector3(PATH.rx * Math.cos(t), 0, PATH.rz * Math.sin(t));
  const p = new Person(scene, { pos, facing: 0, pose: "stand", spot, kind: "walker", range: 7, half: 0.55, speed: 5.0, path: { t, dir } });
  spot.people.push(p);
  people.push(p);
}

function serve(spot, slot) {
  const type = spot.kind === "bbq" ? "snag" : BIG_TYPES[Math.floor(Math.random() * BIG_TYPES.length)];
  const f = new Food(type);
  f.spot = spot;
  f.slotRef = slot;
  if (slot.hand) {
    f.place(spot.people[0].hand, new THREE.Vector3(0, -0.12, 0.05), "held");
    f.mesh.scale.multiplyScalar(0.85);
  } else {
    f.place(scene, slot.pos, "served");
  }
  slot.food = f;
}

function resetFood() {
  for (const l of loose) l.dispose();
  loose.length = 0;
  for (const spot of spots) for (const slot of spot.slots) {
    slot.food?.dispose();
    slot.food = null;
    slot.respawn = 0;
    serve(spot, slot);
  }
}

// ---------------------------------------------------------------------------
// Game state
const G = {
  phase: "title", // title | play | paused | over
  time: ROUND,
  score: 0,
  combo: 0,
  comboTimer: 0,
  eaten: 0,
  caughtCount: 0,
  binsTipped: 0,
  eatProg: 0,
  digProg: 0,
  holdLock: false,
  best: readBest(),
  clock: 0,
};

// Interface handed to people
const ctx = {
  ibis,
  colliders: world.colliders,
  get playing() { return G.phase === "play"; },
  shout(person, text) {
    sfx.oi();
    popup(text, person.root, 2.4, "shout");
  },
  say(person, text) {
    popup(text, person.root, 2.3, "say");
  },
  caught(person) {
    sfx.thump();
    const dx = ibis.pos.x - person.root.position.x, dz = ibis.pos.z - person.root.position.z;
    const d = Math.hypot(dx, dz) || 1;
    ibis.vel.set((dx / d) * 11, 0, (dz / d) * 11);
    ibis.vy = 4;
    ibis.onGround = false;
    ibis.stun = 0.9;
    G.caughtCount++;
    G.combo = 0;
    G.comboTimer = 0;
    if (ibis.carry) {
      const f = ibis.carry;
      ibis.carry = null;
      if (person.spot === f.spot && f.slotRef && !f.slotRef.hand) {
        f.place(scene, f.slotRef.pos, "served");
        popup("Reclaimed!", person.root, 2.3, "say");
      } else if (f.slotRef?.hand && person.spot === f.spot) {
        f.place(person.hand, new THREE.Vector3(0, -0.12, 0.05), "held");
      } else {
        f.place(scene, new THREE.Vector3(ibis.pos.x, 0.06, ibis.pos.z), "ground");
      }
    }
    popup("WHACK!", ibis.root, 2.4, "bad");
    shake = reduceMotion ? 0 : 0.35;
  },
};

function readBest() {
  try { return Number(localStorage.getItem("binchicken.best")) || 0; } catch { return 0; }
}
function writeBest(v) {
  try { localStorage.setItem("binchicken.best", String(v)); } catch { /* storage unavailable */ }
}

// ---------------------------------------------------------------------------
// HUD helpers
const fx = $("fx");
const popups = [];
function popup(text, anchor, height, cls) {
  const el = document.createElement("div");
  el.className = `pop ${cls}`;
  el.textContent = text;
  fx.appendChild(el);
  const pos = anchor.isVector3 ? anchor.clone() : null;
  popups.push({ el, anchor: pos ? null : anchor, pos, height, life: cls === "say" ? 1.8 : 1.3, age: 0 });
}

const indicators = people.map(() => {
  const el = document.createElement("div");
  el.className = "ind";
  fx.appendChild(el);
  return el;
});

const tmpV = new THREE.Vector3();
function toScreen(v, out) {
  tmpV.copy(v).project(camera);
  out.x = (tmpV.x * 0.5 + 0.5) * innerWidth;
  out.y = (-tmpV.y * 0.5 + 0.5) * innerHeight;
  out.visible = tmpV.z < 1 && Math.abs(tmpV.x) < 1.2 && Math.abs(tmpV.y) < 1.2;
  return out;
}

function updateOverlays(dt) {
  const s = {};
  people.forEach((p, i) => {
    const el = indicators[i];
    const show = G.phase === "play" && (p.state === "chase" || p.state === "noticing" || p.alert > 0.08);
    if (!show) { el.style.display = "none"; return; }
    tmpV.set(p.root.position.x, p.pose === "stand" ? 2.35 : 1.9, p.root.position.z);
    toScreen(tmpV, s);
    if (!s.visible) { el.style.display = "none"; return; }
    el.style.display = "block";
    el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    const chasing = p.state === "chase";
    el.textContent = chasing ? "!" : "?";
    el.classList.toggle("alarm", chasing);
    el.classList.toggle("notice", p.state === "noticing");
    el.style.setProperty("--a", Math.min(1, p.alert).toFixed(2));
  });

  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.age += dt;
    if (p.age >= p.life) { p.el.remove(); popups.splice(i, 1); continue; }
    const base = p.anchor ? p.anchor.position : p.pos;
    tmpV.set(base.x, base.y + p.height + p.age * 0.9, base.z);
    toScreen(tmpV, s);
    const half = (p.w ||= p.el.offsetWidth) / 2 + 8;
    const x = Math.min(innerWidth - half, Math.max(half, s.x));
    p.el.style.transform = `translate(${x}px, ${s.y}px) translate(-50%, -50%) scale(${Math.min(1, 0.6 + p.age * 4)})`;
    p.el.style.opacity = String(Math.min(1, (p.life - p.age) * 3));
    p.el.style.display = s.visible ? "block" : "none";
  }
}

const hud = {
  score: $("score"), combo: $("combo"), comboBar: $("combo-bar"), timer: $("timer"),
  prompt: $("prompt"), promptText: $("prompt-text"), hold: $("hold"), pips: [...document.querySelectorAll(".pip")],
  hidden: $("hidden-tag"),
};
let lastScoreShown = -1;
function updateHud() {
  if (G.score !== lastScoreShown) {
    hud.score.textContent = G.score;
    lastScoreShown = G.score;
  }
  const t = Math.max(0, Math.ceil(G.time));
  hud.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  hud.timer.classList.toggle("urgent", G.time <= 15 && G.phase === "play");
  const comboOn = G.combo > 1 && G.comboTimer > 0;
  hud.combo.hidden = !comboOn;
  if (comboOn) {
    hud.combo.firstElementChild.textContent = `x${G.combo} combo`;
    hud.comboBar.style.transform = `scaleX(${G.comboTimer / COMBO_WINDOW})`;
  }
  hud.pips.forEach((el, i) => el.style.setProperty("--f", Math.max(0, Math.min(1, ibis.stamina - i)).toFixed(2)));
  hud.hidden.hidden = !(ibis.hidden && G.phase === "play");
}

function setPrompt(text, prog) {
  if (!text) { hud.prompt.hidden = true; return; }
  hud.prompt.hidden = false;
  hud.promptText.innerHTML = text;
  hud.hold.style.setProperty("--p", (prog || 0).toFixed(3));
  hud.hold.hidden = prog === undefined;
}

const KEY = matchMedia("(pointer: coarse)").matches ? { grab: "Tap ✋" } : { grab: "<kbd>E</kbd>" };

// ---------------------------------------------------------------------------
// Actions
const reach = new THREE.Vector3();
function findTarget() {
  if (ibis.carry || ibis.stun > 0) return null;
  ibis.forward(reach).multiplyScalar(1.05).add(ibis.pos);
  let best = null, bestD = 1.25;
  const consider = (f) => {
    if (!f || (f.state !== "served" && f.state !== "held" && f.state !== "ground")) return;
    const p = f.worldPos();
    const dy = p.y - ibis.pos.y;
    if (dy < -0.6 || dy > 1.7) return;
    const d = Math.hypot(p.x - reach.x, p.z - reach.z);
    if (d < bestD) { bestD = d; best = f; }
  };
  for (const s of spots) for (const sl of s.slots) consider(sl.food);
  for (const f of loose) consider(f);
  return best;
}

function nearBin() {
  if (ibis.carry || !ibis.onGround) return null;
  for (const b of world.bins) {
    if (b.tipped) continue;
    if (Math.hypot(b.x - ibis.pos.x, b.z - ibis.pos.z) < 1.6) return b;
  }
  return null;
}

function grab(f) {
  sfx.peck();
  ibis.peck = 0.2;
  if (!f.def.big) {
    eat(f, false);
    return;
  }
  sfx.grab();
  f.place(ibis.beakSlot, new THREE.Vector3(0, -0.05, 0), "carried");
  f.mesh.rotation.set(0, 0, 0);
  ibis.carry = f;
  popup(`Got the ${f.def.name}!`, ibis.root, 2.6, "good");
  if (f.spot) {
    for (const p of f.spot.people) {
      if (p.state === "chase") continue;
      if (p.sees) p.startChase(ctx);
      else p.notice(p.kind === "walker" ? 0.45 : rand(0.9, 1.6));
    }
  }
}

function eat(f, wasCarried) {
  G.combo = G.comboTimer > 0 ? Math.min(5, G.combo + 1) : 1;
  G.comboTimer = COMBO_WINDOW;
  const pts = f.def.points * G.combo;
  G.score += pts;
  G.eaten += f.def.big ? 1 : 0;
  sfx.crunch();
  sfx.score(G.combo);
  popup(G.combo > 1 ? `+${pts}  x${G.combo}` : `+${pts}`, ibis.root, 2.5, "score");
  if (wasCarried) ibis.carry = null;
  const slot = f.slotRef;
  f.dispose();
  const li = loose.indexOf(f);
  if (li >= 0) loose.splice(li, 1);
  if (slot && slot.food === f) {
    slot.food = null;
    slot.respawn = rand(16, 24);
  }
  hud.score.classList.remove("bump");
  void hud.score.offsetWidth;
  hud.score.classList.add("bump");
}

function tipBin(b) {
  b.tipped = true;
  b.resetIn = BIN_RESET;
  G.binsTipped++;
  sfx.crash();
  shake = reduceMotion ? 0 : 0.25;
  const ry = b.root.rotation.y;
  const dir = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const f = new Food("scrap");
    const pos = new THREE.Vector3(b.x, 0.04, b.z).addScaledVector(dir, rand(1.1, 2.4)).addScaledVector(side, rand(-0.9, 0.9));
    f.place(scene, pos, "ground");
    loose.push(f);
  }
  popup("CRASH!", new THREE.Vector3(b.x, 0, b.z), 1.8, "bad");
  // the noise draws attention
  for (const p of people) {
    const d = Math.hypot(p.root.position.x - b.x, p.root.position.z - b.z);
    if (d < 14 && (p.state === "idle" || p.state === "walk")) p.alert = Math.min(0.95, p.alert + 0.55 * (1 - d / 14) + 0.2);
  }
}

function honk() {
  sfx.honk();
  ibis.honk = 0.45;
  popup("HONK", ibis.root, 2.6, "honk");
  for (const p of people) {
    const d = Math.hypot(p.root.position.x - ibis.pos.x, p.root.position.z - ibis.pos.z);
    if (d < 9 && (p.state === "idle" || p.state === "walk")) p.alert = Math.min(0.95, p.alert + 0.3);
  }
  for (const b of world.bushes) b.wiggle = Math.max(b.wiggle, 0.2);
}

function handleActions(dt) {
  const target = findTarget();
  const bin = target ? null : nearBin();
  const still = ibis.speed < 0.8 && ibis.onGround && ibis.stun <= 0;

  if (input.consume("honk") && ibis.stun <= 0) honk();
  if (input.consume("grab") && target) {
    grab(target);
    G.holdLock = true;
  }
  const holding = input.held("grab") && !G.holdLock;
  if (!input.held("grab")) G.holdLock = false;

  ibis.peck = Math.max(0, ibis.peck - dt);
  if (holding && ibis.carry && still) {
    G.eatProg += dt / EAT_TIME;
    ibis.peck = 0.1;
    if (G.eatProg >= 1) { eat(ibis.carry, true); G.eatProg = 0; G.holdLock = true; }
  } else G.eatProg = 0;

  if (holding && bin && still) {
    G.digProg += dt / DIG_TIME;
    ibis.peck = 0.1;
    if (Math.random() < dt * 8) sfx.peck();
    if (G.digProg >= 1) { tipBin(bin); G.digProg = 0; G.holdLock = true; }
  } else G.digProg = 0;

  if (ibis.stun > 0) setPrompt(null);
  else if (ibis.carry) {
    const name = ibis.carry.def.name;
    setPrompt(still || G.eatProg > 0 ? `Hold ${KEY.grab} to scoff the ${name}` : `Stop somewhere safe, then hold ${KEY.grab} to scoff it`, G.eatProg);
  } else if (target) {
    setPrompt(`${KEY.grab} Snatch the ${target.def.name}`);
  } else if (bin) {
    setPrompt(`Hold ${KEY.grab} to raid the bin`, G.digProg);
  } else setPrompt(null);
}

// ---------------------------------------------------------------------------
// Per-frame world systems
function updateBins(dt) {
  for (const b of world.bins) {
    if (b.tipped) {
      b.resetIn -= dt;
      if (b.resetIn <= 0) b.tipped = false;
    }
    const target = b.tipped ? 1.48 : 0;
    b.angle += (target - b.angle) * Math.min(1, dt * (b.tipped ? 10 : 3));
    b.pivot.rotation.z = -b.angle;
  }
}

function updateBushes(dt) {
  let hidden = false;
  for (const b of world.bushes) {
    const inside = ibis.onGround && Math.hypot(ibis.pos.x - b.x, ibis.pos.z - b.z) < b.r * 0.85;
    if (inside) {
      hidden = true;
      if (!b.occupied) b.wiggle = 0.4;
    }
    b.occupied = inside;
    b.wiggle = Math.max(0, b.wiggle - dt);
    const w = b.wiggle > 0 ? Math.sin(b.wiggle * 40) * b.wiggle * 0.25 : 0;
    b.group.scale.set(1 + w, 1 - w * 0.6, 1 + w);
  }
  ibis.hidden = hidden;
}

function updateFood(dt) {
  for (const spot of spots) {
    const home = spot.people.every((p) => p.state === "idle" || p.state === "walk");
    for (const slot of spot.slots) {
      if (slot.food) continue;
      slot.respawn -= dt;
      if (slot.respawn <= 0 && home) {
        serve(spot, slot);
        if (G.phase === "play") popup("Restocked", spot.people[0].root, 2.3, "say");
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Camera
let shake = 0;
const camPos = new THREE.Vector3(0, 30, 50);
const camLook = new THREE.Vector3();
const camOff = new THREE.Vector3();
function updateCamera(dt) {
  const portrait = innerWidth / innerHeight < 0.9;
  if (G.phase === "title") {
    const t = G.clock * (reduceMotion ? 0.02 : 0.06);
    camPos.set(Math.sin(t) * 46, 30, Math.cos(t) * 40 + 4);
    camera.position.copy(camPos);
    camera.lookAt(0, 0, -2);
    return;
  }
  camOff.set(0, portrait ? 19 : 13.5, portrait ? 15 : 12.5);
  const k = 1 - Math.exp(-5 * dt);
  const target = tmpV.copy(ibis.pos).add(camOff);
  target.y = camOff.y + ibis.pos.y * 0.5;
  camPos.lerp(target, k);
  camLook.lerp(tmpV.set(ibis.pos.x, ibis.pos.y * 0.5 + 0.8, ibis.pos.z - 1), k);
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.5);
  }
  camera.lookAt(camLook);
}

function resize() {
  const portrait = innerWidth / innerHeight < 0.9;
  camera.fov = portrait ? 58 : 45;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener("resize", resize);
resize();

// ---------------------------------------------------------------------------
// Flow
const screens = { title: $("title"), pause: $("pause"), over: $("over") };
function show(name) {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  document.body.dataset.phase = G.phase;
}

function startGame() {
  sfx.init();
  sfx.resume();
  for (const p of popups) p.el.remove();
  popups.length = 0;
  ibis.reset();
  for (const p of people) {
    p.root.position.copy(p.home);
    p.alert = 0;
    if (p.kind === "walker") {
      p.state = "walk";
    } else {
      p.state = "idle";
      p.root.rotation.y = p.homeFacing;
      p.setPose(p.homePose);
    }
  }
  for (const b of world.bins) { b.tipped = false; b.resetIn = 0; }
  resetFood();
  Object.assign(G, { phase: "play", time: ROUND, score: 0, combo: 0, comboTimer: 0, eaten: 0, caughtCount: 0, binsTipped: 0, eatProg: 0, digProg: 0, holdLock: true });
  camPos.copy(ibis.pos).add(new THREE.Vector3(0, 13.5, 12.5));
  camLook.copy(ibis.pos);
  input.clear();
  show(null);
  sfx.whistle();
}

function endGame() {
  G.phase = "over";
  G.time = 0;
  setPrompt(null);
  const newBest = G.score > G.best;
  if (newBest) { G.best = G.score; writeBest(G.score); }
  let rank = RANKS[0];
  for (const r of RANKS) if (G.score >= r[0]) rank = r;
  $("final-score").textContent = G.score;
  $("rank-name").textContent = rank[1];
  $("rank-blurb").textContent = rank[2];
  $("stat-eaten").textContent = G.eaten;
  $("stat-bins").textContent = G.binsTipped;
  $("stat-caught").textContent = G.caughtCount;
  $("best").textContent = newBest ? "New personal best!" : `Personal best: ${G.best}`;
  sfx.whistle();
  setTimeout(() => sfx.fanfare(G.score >= 280), 400);
  show("over");
  $("again").focus();
}

function pause(on) {
  if (on && G.phase === "play") {
    G.phase = "paused";
    sfx.suspend();
    show("pause");
    $("resume").focus();
  } else if (!on && G.phase === "paused") {
    G.phase = "play";
    sfx.resume();
    input.clear();
    show(null);
  }
}

$("start").addEventListener("click", startGame);
$("again").addEventListener("click", startGame);
$("resume").addEventListener("click", () => pause(false));
$("quit").addEventListener("click", () => { G.phase = "title"; show("title"); $("start").focus(); });
$("pause-btn").addEventListener("click", () => pause(G.phase === "play"));
const muteBtn = $("mute-btn");
function toggleMute() {
  sfx.setMuted(!sfx.muted);
  muteBtn.setAttribute("aria-pressed", String(sfx.muted));
  muteBtn.textContent = sfx.muted ? "Sound off" : "Sound on";
}
muteBtn.addEventListener("click", toggleMute);
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });
$("best-title").textContent = G.best ? `Personal best: ${G.best}` : "";

input.bindTouch({
  zone: $("stick-zone"),
  knob: $("knob"),
  buttons: [[$("t-grab"), "grab"], [$("t-flap"), "flap"], [$("t-honk"), "honk"]],
});

// ---------------------------------------------------------------------------
// Loop
const timer = new THREE.Timer();
timer.connect(document);
function step(dt) {
  G.clock += dt;
  input.update();

  if (input.consume("pause")) {
    if (G.phase === "play") pause(true);
    else if (G.phase === "paused") pause(false);
  }
  if (input.consume("mute")) toggleMute();

  if (G.phase === "play") {
    G.time -= dt;
    if (G.time <= 0) endGame();
    if (ibis.update(dt, input, world.colliders, people)) sfx.flap();
    updateBushes(dt);
    handleActions(dt);
    G.comboTimer = Math.max(0, G.comboTimer - dt);
    if (G.comboTimer <= 0 && G.combo > 0) G.combo = 0;
  }
  if (G.phase === "play" || G.phase === "title" || G.phase === "over") {
    if (G.phase !== "play") ibis.animate(dt, false);
    for (const p of people) p.update(dt, ctx);
    updateBins(dt);
    updateFood(dt);
  }

  updateCamera(dt);
  world.update(G.clock, ibis.pos);
  input.endFrame();
}

function frame(now) {
  timer.update(now);
  const dt = Math.min(0.05, timer.getDelta());
  step(dt);
  renderer.render(scene, camera);
  updateOverlays(G.phase === "paused" ? 0 : dt);
  updateHud();
  requestAnimationFrame(frame);
}

resetFood();
show("title");
$("start").focus();
requestAnimationFrame(frame);

// Expose a tiny debug handle for automated smoke tests.
window.__binChicken = {
  G, ibis, people, spots, world, input,
  // advance the simulation without rendering (fixed 60 Hz steps)
  sim(seconds) { for (let t = 0; t < seconds; t += 1 / 60) step(1 / 60); },
};
