/**
 * Draws the simulation state through the renderer every frame: meadow, deco,
 * enemies (hit flash, squash, pop-in, elite rainbow aura), the hero (anim
 * state, i-frame blink, dash afterimages, HP bar), projectiles (data-driven
 * visuals + trails), enemy bullets, gems (streak trails), pickups, chests,
 * telegraphs and screen overlays. Reads the world; never mutates it.
 */
import { C } from "../art/palette";
import { lerpColor, rainbow } from "../core/color";
import { clamp, easeOutBack, springStep } from "../core/math";
import { P, TrailEmitter, type Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import { PK_FALL } from "../game/types";
import type { World } from "../game/world";
import { Anims } from "./anims";
import { Ground } from "./ground";
import { WorldTexts } from "./texts";
import { TRAILS } from "./trails";

interface HeroAnims {
  idle: number;
  idleN: number;
  idleFps: number;
  run: number;
  runN: number;
  hurt: number;
  cast: number;
  castN: number;
}

const GEM_COLORS = [C.aqua, C.cyan, C.pink, C.yellow, C.white];
/** 1px outline offsets (elite / boss aura). */
const OUT_X = [1, -1, 0, 0];
const OUT_Y = [0, 0, 1, -1];

export class WorldView {
  readonly anims: Anims;
  readonly ground: Ground;
  readonly texts: WorldTexts;
  private hero!: HeroAnims;
  private heroSq = { x: 1, v: 0 };
  private trail: TrailEmitter;
  private ghostI = 0;
  private hpGhost = 1;
  private hurtFlash = 0;
  private frameN = 0;
  private poseT = 0;
  private hStreak: number;
  private hBeam: number;
  private hFlare: number;
  /** In-world hero HUD (HP bar, dash pip). Off for the title-screen attract mode. */
  heroHud = true;
  /** Extra transient slash lines (Rin ult) drawn by the view. */
  private lines: { x0: number; y0: number; x1: number; y1: number; t: number }[] = [];

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
    private w: World,
  ) {
    this.anims = new Anims(r);
    this.ground = new Ground(r, this.anims);
    this.texts = new WorldTexts(r);
    this.trail = new TrailEmitter(fx.ghosts, 0.024, 0.3, 0.62);
    this.hStreak = r.atlas.handle("fx_streak");
    this.hBeam = r.atlas.handle("fx_beam");
    this.hFlare = r.atlas.handle("fx_flare");
    this.setWorld(w);
  }

  setWorld(w: World): void {
    this.w = w;
    const id = w.hero.sprite;
    const a = this.anims;
    const idle = a.get(`${id}_idle`);
    const run = a.fps(`${id}_run`, 13);
    const cast = a.get(`${id}_cast`);
    this.hero = {
      idle: idle.first,
      idleN: idle.count,
      idleFps: idle.fps || 6,
      run: run.first,
      runN: run.count,
      hurt: a.get(`${id}_hurt`).first,
      cast: cast.first,
      castN: cast.count,
    };
    this.texts.clear();
    this.lines.length = 0;
    this.hpGhost = 1;
  }

  /** Rin ult slash line (from the feedback bridge). */
  addSlashLine(x0: number, y0: number, x1: number, y1: number): void {
    this.lines.push({ x0, y0, x1, y1, t: 0 });
  }

  /** Called when the hero gets hurt (squash + bar flash). */
  heroHurt(): void {
    this.heroSq.v -= 9;
    this.hurtFlash = 1;
  }
  /** Show the hero's cast pose for `seconds` (evolution celebration). */
  pose(seconds: number): void {
    this.poseT = Math.max(this.poseT, seconds);
  }
  heroDash(): void {
    this.heroSq.v += 7;
    this.trail.reset();
  }

  /**
   * @param time  renderer clock (real seconds) for ambient animation
   * @param dt    scaled sim dt this frame (afterimages, springs)
   * @param realDt real dt (texts)
   */
  draw(time: number, dt: number, realDt: number): void {
    const r = this.r;
    const w = this.w;
    this.frameN++;
    this.ground.draw(time, w.player.x, w.player.y);
    this.drawTelegraphs(time);
    this.drawPickups(time);
    this.drawGems(time);
    this.drawEnemies(time);
    this.drawPlayer(time, dt);
    this.drawProjectiles(time);
    this.drawBullets(time);
    this.drawLines(realDt);
    this.texts.update(realDt);
    this.texts.draw(w.player.x, w.player.y);
    // overlays
    if (w.freezeT > 0) {
      const a = Math.min(1, w.freezeT * 2) * 0.16;
      r.fillView(Layer.Overlay, C.lightBlue, a);
    }
    if (w.timeStop) r.fillView(Layer.Overlay, C.lavender, 0.1);
    // ult cut-in: darken scene + bloom in the composite (an overlay sprite would leave the bloom haze on top)
    r.post.dim = w.ult && w.ult.phase === "cutin" ? 0.55 * Math.min(1, w.ult.t * 6) : 0;
  }

  // ---------------------------------------------------------------- enemies
  private drawEnemies(time: number): void {
    const r = this.r;
    const w = this.w;
    const items = w.enemies.items;
    const frozen = w.freezeT > 0 || w.timeStop;
    const cam = r.camera;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = items[i];
      if (e.dead) continue;
      if (!cam.inView(e.x, e.y - e.cy, e.r + 28)) continue;
      const def = e.def;
      const a = this.anims.fps(def.sprite, def.fps ?? 0);
      // hop/flap in sync with the behaviour timer
      let f = Math.floor((e.t + (e.a % 1)) * a.fps) % a.count;
      if (frozen) f = 0;
      else if (def.frame) {
        const o = def.frame(e);
        if (o >= 0) f = o % a.count;
      }
      const h = a.first + f;
      const pop = e.t < 0.22 ? easeOutBack(e.t / 0.22, 2) : 1;
      const sq = clamp(e.sqX, 0.6, 1.5);
      const s = e.scale * pop;
      const sx = e.face * (2 - sq) * s;
      const sy = sq * s;
      const y = e.y - e.z;
      r.shadow(e.x, e.y, def.shadow * e.scale * (1 - Math.min(0.4, e.z / 30)), def.prop ? 0.8 : 1);
      const tint = frozen ? C.lightBlue : 0xffffff;
      const flash = e.flash > 0 ? 1 : 0;
      if (e.elite || def.boss) {
        // pulsing rainbow OUTLINE: four 1px-offset tinted silhouettes just behind the
        // sprite (sort key a hair smaller) so the enemy itself stays fully readable.
        const c = e.elite ? rainbow(time * 0.8 + e.uid * 0.1, 0.7) : C.pink;
        const pulse = 0.6 + 0.4 * Math.sin(time * 6 + e.uid);
        const oa = (def.boss ? 0.45 : 0.95) * pulse * e.alpha;
        r.batch.sortKey = y - 0.01;
        // (no Glow flag: the glow buffer can't see the sprite on top, so glowing copies would
        // bloom over the whole body and wash it out - the soft halo below carries the glow)
        for (let k = 0; k < 4; k++) r.spr(Layer.Entity, h, e.x + OUT_X[k], y + OUT_Y[k], sx, sy, 0, c, oa, 1, 0);
        r.batch.sortKey = NaN;
        if (e.elite) r.glow(e.x, y - e.cy, 10 * e.scale, c, 0.22 * pulse);
      }
      if (def.prop) {
        const glow = def.sprite === "prop_lantern";
        if (glow) r.glow(e.x, e.y - 12, 12, C.orange, 0.35 + 0.1 * Math.sin(time * 5 + e.uid));
        r.spr(Layer.Entity, h, e.x, y, sx, sy, 0, tint, 1, flash, glow ? Flag.Glow : 0);
        continue;
      }
      r.spr(Layer.Entity, h, e.x, y, sx, sy, 0, tint, e.alpha, flash, 0);
    }
  }

  // ---------------------------------------------------------------- player
  private drawPlayer(time: number, dt: number): void {
    const r = this.r;
    const w = this.w;
    const p = w.player;
    const H = this.hero;
    springStep(this.heroSq, 1, 300, 15, Math.min(dt, 1 / 30));
    const u = w.ult;
    let h: number;
    this.poseT = Math.max(0, this.poseT - dt);
    if (p.dead) h = H.hurt;
    else if (u || this.poseT > 0) h = H.cast + (Math.floor(time * 8) % Math.max(1, H.castN));
    else if (p.hurtT > 0) h = H.hurt;
    else if (p.moving || p.dashT > 0) h = H.run + (Math.floor(time * 13) % H.runN);
    else h = H.idle + (Math.floor(time * H.idleFps) % H.idleN);
    const sq = clamp(this.heroSq.x, 0.7, 1.35);
    const face = p.face;
    const sx = face * (2 - sq);
    const sy = sq;
    // dash afterimages (cyan / pink)
    if (p.dashT > 0 && dt > 0) {
      if (this.trail.tick(dt, h, p.x, p.y, sx, sy, this.ghostI & 1 ? C.cyan : C.pink, Layer.FxBelow)) this.ghostI++;
      if (this.frameN % 2 === 0) this.fx.ps.emit(P.dust, p.x, p.y, 1, Math.atan2(-p.dashDY, -p.dashDX));
    }
    let alpha = 1;
    if (p.iframes > 0 && p.dashInv <= 0 && !p.dead) alpha = Math.floor(time * 22) % 2 ? 0.3 : 1;
    r.shadow(p.x, p.y, 14);
    // overdrive ready aura
    if (w.ultReady) {
      const c = rainbow(time * 0.9, 0.6);
      r.glow(p.x, p.y - 10, 18 + 2 * Math.sin(time * 6), c, 0.3);
    }
    r.spr(Layer.Entity, h, p.x, p.y, sx, sy, 0, 0xffffff, alpha, p.hurtT > 0.22 ? 0.85 : 0, 0);

    // HP bar under the hero
    const k = clamp(p.hp / p.maxHp, 0, 1);
    this.hpGhost = this.hpGhost > k ? Math.max(k, this.hpGhost - dt * 0.6) : k;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 4);
    if (!p.dead && this.heroHud) {
      const bw = 20;
      const bx = Math.round(p.x - bw / 2);
      const by = Math.round(p.y + 3);
      r.rect(Layer.Text, bx - 1, by - 1, bw + 2, 4, C.outline, 0.9);
      r.rect(Layer.Text, bx, by, bw * this.hpGhost, 2, C.pinkLight, 0.9);
      const col = k > 0.5 ? lerpColor(C.yellow, C.lime, (k - 0.5) * 2) : lerpColor(C.red, C.yellow, k * 2);
      r.rect(Layer.Text, bx, by, Math.max(k > 0 ? 1 : 0, bw * k), 2, this.hurtFlash > 0.5 ? 0xffffff : col, 1);
      if (k < 0.3) r.rect(Layer.Text, bx, by, bw * k, 2, C.white, 0.35 + 0.35 * Math.sin(time * 14));
    }
    // dash cooldown pip ring (subtle) under the feet when recharging
    if (p.dashCd > 0 && !p.dead && this.heroHud) {
      const f = 1 - p.dashCd / Math.max(0.01, p.dashMax);
      r.rect(Layer.Text, Math.round(p.x - 6), Math.round(p.y + 7), 12 * f, 1, C.aqua, 0.8);
    }
  }

  // ---------------------------------------------------------------- projectiles
  private drawProjectiles(time: number): void {
    const r = this.r;
    const w = this.w;
    const items = w.projectiles.items;
    const ps = this.fx.ps;
    const busy = ps.count > ps.capacity * 0.75;
    const cam = r.camera;
    for (let i = 0; i < w.projectiles.count; i++) {
      const p = items[i];
      if (p.dead || !p.sprite) continue;
      const fall = p.kind === PK_FALL;
      const y = fall ? p.y - p.z : p.y;
      if (!cam.inView(p.x, y, 40)) continue;
      const a = this.anims.fps(p.sprite, p.fps);
      let h: number;
      if (p.anim === 1) h = a.first + Math.min(a.count - 1, Math.floor((p.age / p.life) * a.count));
      else h = a.first + (Math.floor((time + p.uid * 0.137) * a.fps) % a.count);
      let s = p.scale;
      if (p.pop) s *= popScale(p.age, p.life);
      const sx = p.flipX ? -s : s;
      const tr = p.trail ? TRAILS[p.trail] : undefined;
      // shadows / telegraphs
      if (fall) {
        const k = clamp(1 - p.z / 170, 0, 1);
        if (p.telegraph > 0) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 18);
          r.circle(Layer.Decal, p.x, p.y, p.telegraph * (0.4 + 0.6 * k), C.yellow, 0.1 + 0.08 * k);
          r.ring(Layer.Decal, p.x, p.y, p.telegraph * (0.4 + 0.6 * k), C.paleYellow, 0.35 + 0.4 * pulse * k, 0, true);
        }
        if (p.shadow) r.shadow(p.x, p.y, p.shadow * (0.4 + 0.6 * k), 0.4 + 0.5 * k);
      } else if (p.shadow) r.shadow(p.x, p.y + p.z, p.shadow * s, 0.5);
      if (p.entity) r.spr(Layer.Entity, h, p.x, y, sx, s, p.rot, p.tint, p.alpha, 0, p.glow ? Flag.Glow : 0);
      else {
        r.spr(Layer.Fx, h, p.x, y, sx, s, p.rot, p.tint, p.alpha, 0, (p.glow ? Flag.Glow : 0) | Flag.NoSnap);
        if (p.glow && tr && tr.halo > 0) r.glow(p.x, y, tr.halo * s, tr.color, tr.haloAlpha);
      }
      // trails
      if (tr && !busy && (this.frameN + p.uid) % tr.every === 0) {
        ps.emit(tr.def, p.x, y + (tr.yOff ?? 0), tr.n, NaN, tr.colors ? tr.colors[(this.frameN + p.uid) % tr.colors.length] : -1, s);
      }
    }
  }

  private drawLines(realDt: number): void {
    const r = this.r;
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const L = this.lines[i];
      L.t += realDt;
      const life = 0.55;
      if (L.t > life) {
        this.lines.splice(i, 1);
        continue;
      }
      const k = L.t / life;
      // fast draw-in, then a thick flash that thins out
      const draw = Math.min(1, L.t / 0.07);
      const x1 = L.x0 + (L.x1 - L.x0) * draw;
      const y1 = L.y0 + (L.y1 - L.y0) * draw;
      const th = k < 0.2 ? 3 + k * 10 : 5 * (1 - k);
      r.line(Layer.FxAdd, L.x0, L.y0, x1, y1, th + 3, C.pink, 0.55 * (1 - k), Flag.Glow);
      r.line(Layer.FxAdd, L.x0, L.y0, x1, y1, Math.max(1, th), C.white, 1 - k * 0.7, Flag.Glow);
    }
  }

  // ---------------------------------------------------------------- telegraphs
  private drawTelegraphs(time: number): void {
    const r = this.r;
    const w = this.w;
    for (let i = 0; i < w.telegraphs.count; i++) {
      const t = w.telegraphs.items[i];
      if (t.dead) continue;
      const k = clamp(t.age / t.life, 0, 1);
      const pulse = 0.5 + 0.5 * Math.sin(time * 22);
      if (t.shape === 0) {
        r.circle(Layer.Decal, t.x, t.y, t.r, t.color, 0.12 + 0.1 * pulse);
        r.circle(Layer.Decal, t.x, t.y, t.r * k, t.color, 0.28);
        r.ring(Layer.Decal, t.x, t.y, t.r, t.color, 0.6 + 0.4 * pulse, 0, true);
        r.ring(Layer.FxAdd, t.x, t.y, t.r, C.white, 0.25 * pulse, Flag.Add);
      } else {
        r.line(Layer.Decal, t.x, t.y, t.x2, t.y2, t.r * 2, t.color, 0.14 + 0.12 * pulse);
        const mx = t.x + (t.x2 - t.x) * k;
        const my = t.y + (t.y2 - t.y) * k;
        r.line(Layer.Decal, t.x, t.y, mx, my, Math.max(1, t.r * 0.6), t.color, 0.6);
      }
    }
  }

  // ---------------------------------------------------------------- bullets
  private drawBullets(time: number): void {
    const r = this.r;
    const w = this.w;
    for (let i = 0; i < w.bullets.count; i++) {
      const b = w.bullets.items[i];
      if (b.dead) continue;
      const a = this.anims.get(b.sprite);
      const h = a.first + (Math.floor(time * a.fps + i * 0.3) % a.count);
      const col = b.sprite === "eb_moon" ? C.paleYellow : b.sprite === "eb_star" ? C.violet : C.pink;
      r.glow(b.x, b.y, b.r * 3.2, col, 0.55, Layer.Bullets);
      r.spr(Layer.Bullets, h, b.x, b.y, 1, 1, b.sprite === "eb_star" ? time * 6 : 0, 0xffffff, 1, 0, Flag.Glow);
    }
  }

  // ---------------------------------------------------------------- gems
  private drawGems(time: number): void {
    const r = this.r;
    const w = this.w;
    const items = w.gems.items;
    const cam = r.camera;
    const b = r.batch;
    for (let i = 0; i < w.gems.count; i++) {
      const g = items[i];
      if (g.dead) continue;
      if (!cam.inView(g.x, g.y, 16)) continue;
      const id = g.tier === 1 ? "gem_1" : g.tier === 2 ? "gem_2" : g.tier === 3 ? "gem_3" : "gem_4";
      const a = this.anims.get(id);
      const glint = g.tier === 4 ? Math.floor(time * 8) % a.count : (Math.floor(time * 1.3 + i * 0.37) % 5 === 0 ? 1 : 0) % a.count;
      const bob = g.state === 0 && g.z <= 0 ? Math.round(Math.sin(time * 3 + i) * 0.8) : 0;
      const y = g.y - g.z - 2 + bob;
      const col = GEM_COLORS[g.tier - 1] ?? C.aqua;
      if (g.state === 1) {
        // stretched streak trail toward the direction of travel
        const dx = w.player.x - g.x;
        const dy = w.player.y - 6 - g.y;
        const ang = Math.atan2(dy, dx);
        const len = Math.min(26, 4 + g.speed * 0.03);
        b.drawP(Layer.FxAdd, this.hStreak, g.x, y, len / 16, 0.75, ang, col, 0.85, 0, Flag.Add | Flag.Glow | Flag.NoSnap, 16, 2);
      } else r.shadow(g.x, g.y, g.tier >= 3 ? 8 : 5, 0.55);
      if (g.tier === 4) r.glow(g.x, y, 10, rainbow(time * 0.7, 0.6), 0.5);
      r.spr(Layer.Entity, a.first + glint, g.x, y, 1, 1, 0, 0xffffff, 1, 0, Flag.Glow);
    }
  }

  // ---------------------------------------------------------------- pickups
  private drawPickups(time: number): void {
    const r = this.r;
    const w = this.w;
    const b = r.batch;
    const items = w.pickups.items;
    for (let i = 0; i < w.pickups.count; i++) {
      const k = items[i];
      if (k.dead) continue;
      if (!r.camera.inView(k.x, k.y, 30)) continue;
      const bob = k.z <= 0 ? Math.sin(time * 3.2 + i) * 1.2 : 0;
      switch (k.kind) {
        case "coin": {
          const a = this.anims.get("coin");
          const h = a.first + (Math.floor(time * 10 + i) % a.count);
          if (k.state === 1) {
            const ang = Math.atan2(w.player.y - 6 - k.y, w.player.x - k.x);
            b.drawP(Layer.FxAdd, this.hStreak, k.x, k.y - k.z, Math.min(1.4, 0.3 + k.speed * 0.002), 0.7, ang, C.yellow, 0.8, 0, Flag.Add | Flag.Glow | Flag.NoSnap, 16, 2);
          } else r.shadow(k.x, k.y, 6, 0.55);
          r.spr(Layer.Entity, h, k.x, k.y - k.z - 3, 1, 1, 0, 0xffffff, 1, 0, Flag.Glow);
          break;
        }
        case "chest": {
          const a = this.anims.get("chest");
          const gold = k.golden;
          // light beam + glow
          const pulse = 0.6 + 0.4 * Math.sin(time * 4 + i);
          b.drawP(Layer.FxAdd, this.hBeam, k.x, k.y - 2, gold ? 3.2 : 2.2, gold ? 3.4 : 2.4, 0, gold ? C.yellow : C.pinkLight, 0.55 * pulse, 0, Flag.Add | Flag.Glow | Flag.NoSnap, 4, 31);
          r.glow(k.x, k.y - 8, gold ? 22 : 16, gold ? C.yellow : C.pink, 0.4 * pulse);
          r.shadow(k.x, k.y, 18);
          const wob = Math.sin(time * 9) * 0.06;
          r.spr(Layer.Entity, a.first, k.x, k.y - k.z, (1 + wob) * (gold ? 1.25 : 1), (1 - wob) * (gold ? 1.25 : 1), 0, gold ? C.paleYellow : 0xffffff, 1, 0, 0);
          if (Math.floor(time * 3 + i) % 4 === 0) b.drawP(Layer.FxAdd, this.hFlare, k.x + Math.sin(time * 7) * 7, k.y - 14, 0.4, 0.4, time, C.white, 0.8, 0, Flag.Add | Flag.Glow | Flag.NoSnap, 8, 8);
          break;
        }
        default: {
          const id = k.kind === "onigiri" ? "food_onigiri" : k.kind === "cake" ? "food_cake" : k.kind === "magnet" ? "pk_magnet" : k.kind === "bomb" ? "pk_bomb" : "pk_clock";
          const a = this.anims.get(id);
          const h = a.first + (Math.floor(time * 4 + i) % a.count);
          const power = k.kind === "magnet" || k.kind === "bomb" || k.kind === "clock";
          r.shadow(k.x, k.y, 9, 0.6);
          if (power) {
            const c = k.kind === "magnet" ? C.red : k.kind === "bomb" ? C.pink : C.cyan;
            r.glow(k.x, k.y - 7 + bob, 12, c, 0.35 + 0.15 * Math.sin(time * 6));
            r.ring(Layer.FxAdd, k.x, k.y - 7 + bob, 8 + ((time * 10) % 6), c, 0.5 - ((time * 10) % 6) / 12, Flag.Add | Flag.Glow);
          }
          r.spr(Layer.Entity, h, k.x, k.y - k.z - 6 + bob, 1, 1, 0, 0xffffff, 1, 0, power ? Flag.Glow : 0);
        }
      }
    }
  }
}

/** Scale curve for popping orbitals: grow in over 0.15 s, shrink out over the last 0.15 s. */
function popScale(age: number, life: number): number {
  if (age < 0.15) return easeOutBack(age / 0.15, 2.2);
  if (Number.isFinite(life) && life - age < 0.15) return Math.max(0, (life - age) / 0.15);
  return 1;
}
