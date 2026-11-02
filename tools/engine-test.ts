/**
 * Engine showcase / stress scene. Served by Vite at /tools/engine-test.html
 *
 *   ?stress=3000     sprite stress test: N wanderers, prints average frame ms to the console
 *   ?n=600           wanderer count for the normal showcase
 *   ?touch=1         force touch controls + mouse joystick on desktop
 *   ?seed=42         deterministic RNG
 *   ?night=1         start at night   ?quality=low|mid|high   ?calm=1 no periodic fx   ?fps=0 hide meter
 *
 * Controls: WASD/arrows move, Space/Shift dash, E ultimate, click/tap = explosion,
 *           L = simulate WebGL context loss, F = toggle FPS, G = cycle grade.
 * window.__et exposes helpers for scripted screenshots (scripts/shot.mjs --eval).
 */
import { C } from "../src/art/palette";
import { lerpColor, rainbow } from "../src/core/color";
import { Input } from "../src/core/input";
import { Loop, substep } from "../src/core/loop";
import { clamp, damp, hash01, springStep, TAU } from "../src/core/math";
import { Rng, urlSeed } from "../src/core/rng";
import { SpatialHash } from "../src/core/spatial";
import { time } from "../src/core/time";
import { FpsMeter } from "../src/debug/fps";
import { createFx, fxDash, fxEnemyDeath, fxExplosion, fxFirework, fxHit, fxLevelUp, P, TrailEmitter } from "../src/fx";
import { animFrame, Flag, GRADES, Layer, QUALITY, Renderer, type QualityTier } from "../src/render";
import { STANDIN_SPRITES } from "./engine-test-art";

const qs = new URLSearchParams(location.search);
const STRESS = Number(qs.get("stress") ?? 0);
const CALM = qs.get("calm") === "1"; // no periodic fx (inspect pixels / ground)
const N = STRESS || Number(qs.get("n") ?? 600);
const tier = (qs.get("quality") as QualityTier) || "high";
const rng = new Rng(urlSeed());

// ?standins=0 shows the raw placeholders for manifest ids that are not drawn yet
const r = new Renderer({ clearColor: 0x6fbf73, quality: QUALITY[tier], extraSprites: qs.get("standins") === "0" ? [] : STANDIN_SPRITES });
const fx = createFx(r, { particles: QUALITY[tier].particles });
const input = new Input();
input.showTouchControls(true);
const fps = new FpsMeter();
fps.show(qs.get("fps") !== "0");
const hint = document.getElementById("hint") as HTMLDivElement;
const A = r.atlas;

// ------------------------------------------------------------------ world data
const ENEMY_IDS = ["en_puff", "en_batbun", "en_boo", "en_shroom", "en_teddy", "en_eyepuff", "en_pumpkin", "en_wisp", "en_spore"];
const ENEMY_COLORS: Record<string, number[]> = {
  en_puff: [C.mint, C.lime, C.green],
  en_batbun: [C.violet, C.lavender, C.pink],
  en_boo: [C.offWhite, C.lavender, C.pinkLight],
  en_shroom: [C.red, C.white, C.pinkLight],
  en_teddy: [0xa6683f, 0xdda574, C.pink],
  en_eyepuff: [C.pink, C.pinkLight, C.white],
  en_pumpkin: [C.orange, C.yellow, C.green],
  en_wisp: [C.blue, C.violet, C.aqua],
  en_spore: [C.red, C.white],
};
const anims = ENEMY_IDS.map((id) => A.anim(id));
const hero = { idle: A.anim("hoshi_idle"), run: A.anim("hoshi_run", 12), hurt: A.handle("hoshi_hurt") };
const hTile = A.info("tile_ground");
const hStar = A.anim("w_star");
const hYarn = A.anim("w_yarn");
const hOrb = A.anim("eb_orb");
const hGem = [A.anim("gem_1"), A.anim("gem_2"), A.anim("gem_3"), A.anim("gem_4")];
const decoIds = ["deco_flower", "deco_grass", "deco_grass", "deco_flower", "deco_rock", "deco_mush", "deco_crystal", "deco_tree", "prop_lantern", "prop_gift"];

interface Mob {
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  speed: number;
  flash: number;
  sq: { x: number; v: number };
  hp: number;
  face: number;
}
const mobs: Mob[] = [];
function spawnMob(m: Mob | null, nearPlayer: boolean): Mob {
  const a = rng.angle();
  const d = nearPlayer ? rng.range(150, 260) : rng.range(30, STRESS ? 420 : 300);
  const o = m ?? { kind: 0, x: 0, y: 0, vx: 0, vy: 0, phase: 0, speed: 0, flash: 0, sq: { x: 1, v: 0 }, hp: 0, face: 1 };
  o.kind = rng.int(0, ENEMY_IDS.length - 1);
  o.x = player.x + Math.cos(a) * d;
  o.y = player.y + Math.sin(a) * d;
  o.vx = o.vy = 0;
  o.phase = rng.next() * 10;
  o.speed = rng.range(14, 34);
  o.flash = 0;
  o.sq.x = 1;
  o.sq.v = 0;
  o.hp = rng.range(20, 60);
  return o;
}

const player = { x: 0, y: 0, vx: 0, vy: 0, face: 1, dash: 0, dashCd: 0, dx: 1, dy: 0, hurt: 0, sq: { x: 1, v: 0 } };
for (let i = 0; i < N; i++) mobs.push(spawnMob(null, false));

interface Deco {
  h: number;
  x: number;
  y: number;
  glow: boolean;
  flip: number;
}
const decos: Deco[] = [];
for (let i = 0; i < 420; i++) {
  const id = decoIds[rng.int(0, decoIds.length - 1)];
  const info = A.info(id);
  const a = rng.angle();
  const d = Math.sqrt(rng.next()) * 520;
  decos.push({ h: info.first + rng.int(0, info.count - 1), x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d), glow: id === "deco_crystal" || id === "deco_mush" || id === "prop_lantern", flip: rng.chance(0.5) ? -1 : 1 });
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  target: number;
}
const shots: Shot[] = [];
interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}
const bullets: Bullet[] = [];
interface Gem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  tier: number;
  t: number;
}
const gems: Gem[] = [];

const grid = new SpatialHash(32, 4096);
const near: number[] = [];

// ------------------------------------------------------------------ helpers
const tmp = { x: 0, y: 0 };
function explodeScreen(sx: number, sy: number, radius = 30): void {
  r.camera.screenToWorld(sx, sy, tmp);
  explodeWorld(tmp.x, tmp.y, radius);
}
function explodeWorld(x: number, y: number, radius = 30): void {
  fxExplosion(fx, x, y, radius);
  fx.juice.hitstop(55);
  fx.juice.zoomPunch(0.05);
  fx.juice.shake(0.35);
  fx.juice.flash(0xffffff, 0.22, 0.16);
  fx.juice.aberration(2.5);
  const n = grid.query(x, y, radius, near);
  for (let i = 0; i < n; i++) hitMob(near[i], 25 + rng.int(0, 30), rng.chance(0.3), Math.atan2(mobs[near[i]].y - y, mobs[near[i]].x - x), 140);
}
function hitMob(i: number, dmg: number, crit: boolean, ang: number, kb = 40): void {
  const m = mobs[i];
  m.flash = 0.08;
  m.sq.v -= 9;
  m.vx += Math.cos(ang) * kb;
  m.vy += Math.sin(ang) * kb;
  m.hp -= crit ? dmg * 2 : dmg;
  fx.dmg.spawn(m.x, m.y - 14, crit ? dmg * 2 : dmg, crit ? "crit" : "normal");
  fxHit(fx, m.x, m.y - 6, crit ? C.yellow : C.pinkLight, ang);
  if (m.hp <= 0) {
    const id = ENEMY_IDS[m.kind];
    fxEnemyDeath(fx, m.x, m.y, ENEMY_COLORS[id]);
    gems.push({ x: m.x, y: m.y, vx: rng.spread(30), vy: rng.spread(20), z: 0, vz: 90, tier: rng.weightedIndex([70, 20, 8, 2]), t: 0 });
    spawnMob(m, true);
  }
}
function ult(): void {
  fx.juice.slowmo(0.3, 1.6);
  fx.speed.radial(1.4, { intensity: 1 });
  fx.juice.flash(C.pinkLight, 0.5, 0.35);
  fx.juice.bloomSurge(1.2, 1.2);
  fx.juice.shake(0.6);
  fx.juice.shockwave(player.x, player.y - 10, 1.6, 140, 0.9);
  fxLevelUp(fx, player.x, player.y);
  const v = r.camera.view;
  for (let i = 0; i < 10; i++) {
    setTimeout(() => explodeWorld(v.x + rng.range(20, v.w - 20), v.y + rng.range(20, v.h - 20), rng.range(22, 40)), 150 + i * 90);
  }
}
function lightningOnRandom(): void {
  const v = r.camera.view;
  for (let tries = 0; tries < 20; tries++) {
    const i = rng.int(0, mobs.length - 1);
    const m = mobs[i];
    if (!r.camera.inView(m.x, m.y, 0, -10)) continue;
    fx.bolts.fromSky(m.x, m.y - 6, v.h * 0.7, { color: tries & 1 ? C.cyan : C.yellow });
    hitMob(i, 30, rng.chance(0.25), -Math.PI / 2, 10);
    // chain
    const n = grid.query(m.x, m.y, 60, near);
    let last = m;
    for (let k = 0, c = 0; k < n && c < 2; k++) {
      const o = mobs[near[k]];
      if (o === m) continue;
      fx.bolts.strike(last.x, last.y - 6, o.x, o.y - 6, { color: C.aqua, branches: 1, thickness: 1 });
      hitMob(near[k], 15, false, 0, 10);
      last = o;
      c++;
    }
    fx.juice.flash(C.aqua, 0.08, 0.1);
    return;
  }
}

// ------------------------------------------------------------------ input extras
let downAt = 0;
let downX = 0;
let downY = 0;
window.addEventListener("pointerdown", (e) => {
  downAt = performance.now();
  downX = e.clientX;
  downY = e.clientY;
});
window.addEventListener("pointerup", (e) => {
  const t = e.target as Element;
  if (t.closest("button")) return;
  if (performance.now() - downAt < 260 && Math.hypot(e.clientX - downX, e.clientY - downY) < 12) explodeScreen(e.clientX, e.clientY, 30);
});
let gradeMode = qs.get("night") === "1" ? 2 : -1;
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyL") r.debugLoseContext(400);
  if (e.code === "KeyF") fps.toggle();
  if (e.code === "KeyG") gradeMode = gradeMode >= 2 ? -1 : gradeMode + 1;
});

// ------------------------------------------------------------------ simulation
let shotTimer = 0;
let boltTimer = 1;
let burstTimer = 0.5;
let bulletTimer = 2;
let dayT = qs.get("night") === "1" ? 0.62 : 0.05;
const trail = new TrailEmitter(fx.ghosts, 0.025, 0.28, 0.7);
let ghostI = 0;

function sim(dt: number): void {
  // player
  const sp = player.dash > 0 ? 300 : 72;
  if (player.dash > 0) {
    player.dash -= dt;
    player.vx = player.dx * sp;
    player.vy = player.dy * sp;
  } else {
    player.vx = damp(player.vx, input.move.x * sp, 18, dt);
    player.vy = damp(player.vy, input.move.y * sp, 18, dt);
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  if (Math.abs(player.vx) > 4) player.face = player.vx > 0 ? 1 : -1;
  player.dashCd = Math.max(0, player.dashCd - dt);
  player.hurt = Math.max(0, player.hurt - dt);
  springStep(player.sq, 1, 320, 16, dt);

  // spatial hash rebuild
  grid.clear();
  for (let i = 0; i < mobs.length; i++) grid.insert(i, mobs[i].x, mobs[i].y, 6);

  // mobs: seek player + separation
  for (let i = 0; i < mobs.length; i++) {
    const m = mobs[i];
    m.phase += dt;
    const dx = player.x - m.x;
    const dy = player.y - m.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    let ax = (dx / d) * m.speed;
    let ay = (dy / d) * m.speed;
    if (d < 40) {
      ax = -ax;
      ay = -ay;
    }
    if (STRESS) {
      // stress mode: wander around the origin so sprites stay spread out (throughput, not overdraw)
      const wa = m.phase * 0.7 + i;
      ax = Math.cos(wa) * m.speed - m.x * 0.05;
      ay = Math.sin(wa * 1.3) * m.speed - m.y * 0.05;
    }
    if (!STRESS || (i & 3) === (time.frame & 3)) {
      const n = grid.query(m.x, m.y, 10, near);
      for (let k = 0; k < n; k++) {
        const o = mobs[near[k]];
        if (o === m) continue;
        const ox = m.x - o.x;
        const oy = m.y - o.y;
        const od = Math.sqrt(ox * ox + oy * oy) || 1;
        ax += (ox / od) * 30;
        ay += (oy / od) * 30;
      }
    }
    m.vx = damp(m.vx, ax, 4, dt);
    m.vy = damp(m.vy, ay, 4, dt);
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (Math.abs(m.vx) > 2) m.face = m.vx > 0 ? 1 : -1;
    m.flash = Math.max(0, m.flash - dt);
    springStep(m.sq, 1, 340, 14, dt);
    if (d > 520 && !STRESS) spawnMob(m, true);
  }

  // shots
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.life -= dt;
    const t = mobs[s.target];
    if (t) {
      const dx = t.x - s.x;
      const dy = t.y - 7 - s.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      s.vx = damp(s.vx, (dx / d) * 170, 6, dt);
      s.vy = damp(s.vy, (dy / d) * 170, 6, dt);
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (fx.ps.count < fx.ps.capacity * 0.8 && rng.chance(0.5)) fx.ps.emit(P.trail, s.x, s.y, 1, NaN, C.paleYellow);
    const hit = grid.nearest(s.x, s.y + 6, 7);
    if (hit >= 0) {
      hitMob(hit, rng.int(8, 14), rng.chance(0.15), Math.atan2(s.vy, s.vx));
      shots.splice(i, 1);
      continue;
    }
    if (s.life <= 0) shots.splice(i, 1);
  }

  // enemy bullets (ring pattern)
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0) bullets.splice(i, 1);
  }

  // gems hop then home
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.t += dt;
    g.vz -= 400 * dt;
    g.z = Math.max(0, g.z + g.vz * dt);
    if (g.z === 0) g.vz = 0;
    const dx = player.x - g.x;
    const dy = player.y - 8 - g.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d < 40 && g.t > 0.3) {
      const s = 60 + g.t * 300;
      g.vx = (dx / d) * s;
      g.vy = (dy / d) * s;
    } else {
      g.vx = damp(g.vx, 0, 4, dt);
      g.vy = damp(g.vy, 0, 4, dt);
    }
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    if (d < 6 || g.t > 12) {
      if (d < 6) fx.ps.emit(P.sparkle, g.x, g.y, 2, NaN, C.aqua);
      gems.splice(i, 1);
    }
  }
}

function events(dt: number): void {
  if (STRESS || CALM) return;
  shotTimer -= dt;
  if (shotTimer <= 0) {
    shotTimer = 0.22;
    const t = grid.nearest(player.x, player.y, 160);
    if (t >= 0) {
      const a = Math.atan2(mobs[t].y - player.y, mobs[t].x - player.x) + rng.spread(0.6);
      shots.push({ x: player.x, y: player.y - 10, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: 1.6, target: t });
    }
  }
  boltTimer -= dt;
  if (boltTimer <= 0) {
    boltTimer = 1.4;
    lightningOnRandom();
  }
  burstTimer -= dt;
  if (burstTimer <= 0) {
    burstTimer = 2.2;
    const v = r.camera.view;
    fxFirework(fx, v.x + rng.range(30, v.w - 30), v.y + rng.range(30, v.h * 0.6));
    fx.ps.emit(P.confetti, player.x + rng.spread(60), player.y + rng.spread(40), 14);
  }
  bulletTimer -= dt;
  if (bulletTimer <= 0) {
    bulletTimer = 3.2;
    const m = mobs[rng.int(0, mobs.length - 1)];
    const cx = r.camera.inView(m.x, m.y) ? m.x : player.x + 80;
    const cy = r.camera.inView(m.x, m.y) ? m.y - 8 : player.y - 50;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU;
      bullets.push({ x: cx, y: cy, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 3 });
    }
    fx.juice.shockwave(cx, cy, 0.6, 40);
  }
}

// ------------------------------------------------------------------ drawing
function drawGround(): void {
  const v = r.camera.view;
  const x0 = Math.floor(v.x / 16) - 1;
  const y0 = Math.floor(v.y / 16) - 1;
  const x1 = Math.ceil((v.x + v.w) / 16) + 1;
  const y1 = Math.ceil((v.y + v.h) / 16) + 1;
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) {
      const h = hash01(tx, ty);
      const f = h < 0.84 ? (h * 1000) & 3 : 4 + ((h * 7919) & 3);
      // tiles have a centre pivot (8, 8)
      r.spr(Layer.Ground, hTile.first + (f % hTile.count), tx * 16 + 8, ty * 16 + 8);
    }
}

function draw(): void {
  const t = r.time;
  const b = r.batch;
  drawGround();
  // decor
  for (const d of decos) {
    if (!r.camera.inView(d.x, d.y, 40)) continue;
    r.spr(Layer.Entity, d.h, d.x, d.y, d.flip, 1, 0, 0xffffff, 1, 0, d.glow ? Flag.Glow : 0);
  }
  // mobs
  for (let i = 0; i < mobs.length; i++) {
    const m = mobs[i];
    if (!r.camera.inView(m.x, m.y, 20)) continue;
    const a = anims[m.kind];
    const h = animFrame(a, m.phase);
    const sq = m.sq.x;
    r.shadow(m.x, m.y, 12);
    r.spr(Layer.Entity, h, m.x, m.y, m.face * (2 - sq), sq, 0, 0xffffff, 1, m.flash > 0 ? 1 : 0);
  }
  // player
  const moving = Math.abs(player.vx) + Math.abs(player.vy) > 8;
  const ph = player.hurt > 0 ? hero.hurt : animFrame(moving ? hero.run : hero.idle, t);
  if (player.dash > 0 && trail.tick(time.dt, ph, player.x, player.y, player.face, 1, ghostI++ % 2 ? C.cyan : C.pink, Layer.FxBelow)) {
    /* ghost spawned */
  }
  r.shadow(player.x, player.y, 14);
  r.spr(Layer.Entity, ph, player.x, player.y, player.face * (2 - player.sq.x), player.sq.x);
  // orbiting yarn (additive glow)
  for (let k = 0; k < 3; k++) {
    const a = t * 3 + (k / 3) * TAU;
    r.spr(Layer.Fx, animFrame(hYarn, t), player.x + Math.cos(a) * 28, player.y - 8 + Math.sin(a) * 20, 1, 1, 0, 0xffffff, 1, 0, Flag.Glow);
  }
  // shots
  for (const s of shots) {
    r.spr(Layer.Fx, animFrame(hStar, t * 2), s.x, s.y, 1, 1, t * 8, 0xffffff, 1, 0, Flag.Glow);
    r.glow(s.x, s.y, 9, C.yellow, 0.45);
  }
  // enemy bullets
  for (const bl of bullets) {
    r.spr(Layer.Bullets, animFrame(hOrb, t), bl.x, bl.y, 1, 1, 0, 0xffffff, 1, 0, Flag.Glow);
    r.glow(bl.x, bl.y, 8, C.pink, 0.5, Layer.Bullets);
  }
  // gems
  for (const g of gems) {
    r.shadow(g.x, g.y, 6, 0.6);
    r.spr(Layer.Entity, animFrame(hGem[g.tier], t + g.x * 0.01), g.x, g.y - g.z - 3, 1, 1, 0, 0xffffff, 1, 0, Flag.Glow);
  }
  // in-world text
  const v = r.camera.view;
  r.text.draw("KIRA KIRA OVERDRIVE!", v.x + v.w / 2, v.y + 10, { align: "center", scale: v.w > 320 ? 2 : 1, rainbow: true, wobble: 1, layer: Layer.Overlay, glow: true });
  r.text.draw(`${mobs.length} sprites  x${r.camera.scale.toFixed(2)}`, v.x + v.w / 2, v.y + (v.w > 320 ? 30 : 22), { align: "center", color: C.lavender, layer: Layer.Overlay });
  // HP bar under the player (rect helper)
  r.rect(Layer.Text, player.x - 9, player.y + 3, 18, 3, C.outline, 0.9);
  r.rect(Layer.Text, player.x - 8, player.y + 4, 16 * (0.5 + 0.5 * Math.sin(t)), 1, lerpColor(C.red, C.lime, 0.5 + 0.5 * Math.sin(t)));
  void b;
  void rainbow;
}

// ------------------------------------------------------------------ frame
const dayGrades = [GRADES.day, GRADES.dusk, GRADES.night, GRADES.dusk, GRADES.day];
let stressAcc = 0;
let stressFrames = 0;
let stressCpu = 0;
let stressStart = 0;
let stressDone = false;
let lastFrameAt = 0;

const loop = new Loop((dt) => {
  const t0 = performance.now();
  time.update(dt);
  input.update();

  if (input.pressed("dash") && player.dashCd <= 0) {
    const mx = input.moving ? input.move.x : player.face;
    const my = input.moving ? input.move.y : 0;
    const l = Math.hypot(mx, my) || 1;
    player.dx = mx / l;
    player.dy = my / l;
    player.dash = 0.16;
    player.dashCd = 1.2;
    trail.reset();
    fxDash(fx, player.x, player.y, player.dx, player.dy);
    fx.speed.directional(Math.atan2(player.dy, player.dx), 0.3, { color: C.white, intensity: 0.7 });
    input.haptic(15);
  }
  if (input.pressed("ult")) ult();
  input.setDashCharge(1 - player.dashCd / 1.2);
  input.setUltCharge((r.time * 0.15) % 1, (r.time * 0.15) % 1 > 0.8);

  substep(time.dt, 1 / 60, (h) => sim(h));
  events(time.dt);

  // day -> night grade
  if (gradeMode < 0) {
    dayT = (dayT + dt / 40) % 1;
    const p = dayT * 4;
    const i = Math.floor(p);
    r.post.blendGrade(dayGrades[i], dayGrades[i + 1], p - i);
  } else r.post.blendGrade(dayGrades[gradeMode], dayGrades[gradeMode], 0);
  const night = gradeMode >= 0 ? (gradeMode === 2 ? 1 : 0) : clamp(1 - Math.abs(dayT - 0.5) * 4, 0, 1);
  fx.ambient.set({ petals: Math.round(12 * (1 - night)), motes: 12, fireflies: Math.round(20 * night) });

  r.camera.follow(player.x, player.y, player.vx, player.vy, dt);
  r.beginFrame(dt);
  fx.update(time.dt, dt);
  draw();
  fx.draw();
  r.endFrame();

  const cpu = performance.now() - t0;
  fps.frame(dt, cpu, `inst ${r.batch.stats.instances} glow ${r.batch.stats.glow} p ${fx.ps.count} dc ${r.batch.stats.drawCalls}`);
  hint.textContent = `WASD/stick move · Space dash · E ult\nclick/tap boom · G grade · L ctx loss\nscene ${r.sceneW}x${r.sceneH} dpr ${r.dpr.toFixed(2)}`;

  const nowMs = performance.now();
  const realMs = lastFrameAt ? nowMs - lastFrameAt : 16.7;
  lastFrameAt = nowMs;
  if (STRESS && !stressDone) {
    if (!stressStart) stressStart = nowMs;
    const el = (nowMs - stressStart) / 1000;
    if (el > 2) {
      stressAcc += realMs / 1000;
      stressFrames++;
      stressCpu += cpu;
    }
    if (el > 7) {
      stressDone = true;
      const msg = `[stress] sprites=${N} frames=${stressFrames} avgFrame=${((stressAcc * 1000) / stressFrames).toFixed(2)}ms avgCpu=${(stressCpu / stressFrames).toFixed(2)}ms instances=${r.batch.stats.instances}`;
      console.log(msg);
      (window as unknown as { __stress: string }).__stress = msg;
    }
  }
});
loop.start();

// ------------------------------------------------------------------ debug hooks
(window as unknown as Record<string, unknown>).__et = {
  r,
  fx,
  loop,
  input,
  time,
  explode: (sx = innerWidth / 2, sy = innerHeight / 2, radius = 30) => explodeScreen(sx, sy, radius),
  explodeWorld,
  ult,
  bolt: lightningOnRandom,
  hitstop: (ms: number) => fx.juice.hitstop(ms),
  grade: (i: number) => (gradeMode = i),
  lose: () => r.debugLoseContext(400),
  stats: () => ({ ...r.stats, particles: fx.ps.count, numbers: fx.dmg.alive, missing: A.missing.length }),
  move: (x: number, y: number) => {
    player.x = x;
    player.y = y;
    r.camera.snapTo(x, y);
  },
};
