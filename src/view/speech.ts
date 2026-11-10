/**
 * Enemy speech bubbles (docs/content/satire.md §5 rules, §6 pools). SHARED by
 * every stage: the pools of all five stages live here, so a new enemy only
 * needs its id in SPEECH_POOLS to start chatting.
 *
 *   ambient   an enemy entering the view has a 4 % chance to speak (elites
 *             25 %, bosses never: theirs are scripted), one line from its pool
 *   scripted  the sim's `enemySay` event (game/enemies/_say.ts `say(w, e, text)`):
 *             behaviour shouts ("NO RUNNING!", "Toasty!") and boss taunts;
 *             they skip the chance and the per-type cooldown
 *   free      `sayAt(x, y, text, life, ink)`: a line whose speaker is gone (boss death
 *             lines, the crab's "...♡"), anchored in the world, wrapped onto rows of
 *             at most 22 characters, kept out of the bottom third (touch buttons);
 *             every stage's view shares this one bubble set (s45-common.ts Captions
 *             is a thin adapter), so the 3-bubble cap holds across all of them
 *   rules     at most 3 bubbles on screen (an ambient one never overlapping
 *             another), an 8 s cooldown per enemy type
 *             (ambient), none while more than 200 enemies are alive, never
 *             within 40 px of the hero (a scripted bubble slides away from
 *             her instead), none during the ultimate cut-in; 1.4 s each, max
 *             14 characters per line (longer lines wrap onto two)
 *   look      a white rounded bubble with a 1-px plum outline and a tail,
 *             font_main ink in plum; "♡" lines draw the fx_heart sprite;
 *             pops in with a little overshoot and follows its speaker
 *
 * Allocation-free per frame: a fixed bubble pool, a uid-hashed "already
 * rolled" table, lines measured once and cached per distinct string.
 */
import { C } from "../art/palette";
import { easeOutBack } from "../core/math";
import { Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import type { EnemySayEvent } from "../game/events";
import type { Enemy } from "../game/types";
import type { World } from "../game/world";
import { bossHeadroom } from "../game/bosses/_entrance";

/** Outline-free font for dark ink on the white bubble (font_main's dark outline would blob the letters). */
const INK_FONT = "font_ink";

// ---------------------------------------------------------------- pools (satire.md §6)
export const SPEECH_POOLS: Readonly<Record<string, readonly string[]>> = {
  // Dream Meadow
  puff: ["Boing!", "Squish!", "Hi hi!", "Puff puff", "Bouncy!"],
  batbun: ["Flap flap", "Nom!", "Eep!", "Hop-flap!"],
  boo: ["Boo!", "...boo?", "Spooky!", "Shy...", "Hehe~"],
  shroomie: ["Hmph!", "Grumble", "Spore it!", "Fungi!"],
  spore: ["Mini!", "Me too!", "Wee!"],
  teddy: ["HUG.", "Stomp.", "Fluffy...", "Bear-y mad"],
  eyepuff: ["I see you", "Blink!", "Pew!", "Watching~"],
  pumpkin: ["Charge!", "Hehehe!", "Gourd!", "Vroom!"],
  wisp: ["Tick tick", "Hot hot!", "Boom?", "Fwoosh!"],
  // Candy Kingdom
  gummy_bear: ["Chewy!", "Boing!", "Gummy hug", "Squishy!", "Sticky!"],
  candy_corn: ["Hup! Hup!", "For the Queen!", "Corn-tastic!", "Formation!", "Stay sweet!"],
  donut_roller: ["Roll out!", "Glazed!", "Sprinkle time", "Wheee!"],
  marshmallow_brute: ["Squish.", "Fluff mode", "S'more?", "Toasty!", "Soft... and angry"],
  lollipop_mage: ["Sugar rush!", "Abra-candy-bra!", "Sweet!", "Lick... spell!"],
  // Shoujo Academy
  hall_monitor: ["NO RUNNING!", "Hall pass?", "Tardy!", "Walk!", "Detention!"],
  love_letter: ["Senpai...", "Read me!", "♡", "Notice me!", "Dear you..."],
  tsundere_slime: ["I-it's not like...", "B-baka!", "Hmph!", "Don't look!", "Whatever!"],
  transfer_student: ["I'm new here.", "Mysterious...", "Did we meet?", "Hello again.", "Fate..."],
  exam_paper: ["F-", "Pop quiz!", "Show work", "Pencils down", "Page 2?"],
  council_ninja: ["Nin nin.", "By order!", "Council business", "Poof!", "Rule 7!"],
  // Beach Episode
  crab_kun: ["Snip snip!", "Sideways!", "Pinch!", "Clack clack", "Crabby!"],
  seagull: ["MINE!", "Chips?", "Squawk!", "Yoink!", "MINE MINE"],
  jellyfish: ["Bloop.", "Zzzt!", "Wobble", "Jelly~", "Bzzt bzzt"],
  watermelon: ["Summer!", "Splat!", "Seedy...", "Roll roll!", "Juicy!"],
  watermelon_half: ["Ptoo!", "Half-angry", "Seed!"],
  sandcastle_golem: ["Rebuild.", "Moat!", "Grr... sand", "Fortify!", "Tide's out"],
  tiny_shark: ["Nom?", "Chomp!", "...fin.", "Smol bite", "Fin-tastic"],
  // The Final Arc
  shadow_clone: ["I am you.", "...", "Nice build.", "Same hair.", "Mirror mirror"],
  filler_goon: ["Meanwhile...", "Generic!", "No lines.", "Henchman #4", "Unpaid"],
  plot_hole: ["Wait, what?", "Plot hole!", "Retcon", "Uh...", "Continuity!"],
  animation_error: ["ERR", "Off-model!", "NaN", "404", "Frame?"],
  mini_truck: ["HONK!", "Beep beep", "Next life!", "Vroom!", "Express!"],
  rival_recolour: ["Rematch!", "Not again!", "Next time!", "I'm you but red!"],
};

/** Ambient chance to speak on entering the view (elites / regular). */
const CHANCE = 0.04;
const CHANCE_ELITE = 0.25;
/** Per-enemy-type ambient cooldown (s). */
const TYPE_CD = 8;
const MAX_BUBBLES = 3;
const MAX_ALIVE = 200;
const LIFE = 1.4;
/** Bubble body never within this distance of the hero's body centre. */
const HERO_CLEAR = 40;
const LINE_CHARS = 14;
/** Row width of free-standing lines (sayAt: boss death lines run long). */
const FREE_CHARS = 22;
/** Enemies looked at per frame for "entered the view" (round-robin). */
const SCAN = 48;
const SEEN_SLOTS = 2048;

interface Line {
  /** Display rows (1 or 2) after glyph substitution. */
  rows: string[];
  /** Row widths at scale 1. */
  widths: number[];
  /** Draw the fx_heart sprite instead of text. */
  heart: boolean;
  /** A trailing "♡" (outside font_main): the fx_heart sprite after the last row. */
  tailHeart: boolean;
  /** Bubble body size (px). */
  w: number;
  h: number;
}

interface Bubble {
  on: boolean;
  enemy: Enemy | null;
  uid: number;
  forced: boolean;
  /** A free-standing sayAt line (no speaker): kept out of the bottom third. */
  free: boolean;
  /** Text colour (plum by default). */
  ink: number;
  line: Line | null;
  t: number;
  /** Seconds on screen (LIFE, longer for scripted death lines). */
  life: number;
  /** Last anchor (speaker's head top) and the clamped body centre. */
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** "…" and "♡" are outside font_main: "..." / the heart sprite. */
function sanitize(s: string): string {
  return s.replace(/…/g, "...");
}

/** Wrap at word boundaries into rows of at most `max` characters (free-standing lines). */
function wrapRows(s: string, max: number): string[] {
  const rows: string[] = [];
  let cur = "";
  for (const wd of s.split(" ")) {
    if (cur && cur.length + 1 + wd.length > max) {
      rows.push(cur);
      cur = wd;
    } else cur = cur ? `${cur} ${wd}` : wd;
  }
  if (cur) rows.push(cur);
  return rows.length ? rows : [""];
}

/** Wrap at the space nearest the middle when longer than LINE_CHARS. */
function wrap(s: string): string[] {
  if (s.length <= LINE_CHARS) return [s];
  const mid = s.length / 2;
  let best = -1;
  for (let i = 0; i < s.length; i++) if (s[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  if (best < 0) return [s];
  return [s.slice(0, best), s.slice(best + 1)];
}

export class Speech {
  private w: World | null = null;
  private readonly bubbles: Bubble[] = [];
  private readonly lines = new Map<string, Line>();
  /** Last ambient line time per enemy type (World.t). */
  private readonly typeAt = new Map<string, number>();
  /** Last pool index per enemy type (no immediate repeats). */
  private readonly lastIdx = new Map<string, number>();
  private readonly seen = new Int32Array(SEEN_SLOTS).fill(-1);
  private cursor = 0;
  private readonly hHeart: number;
  /** Sprite heights per def id (head anchor), looked up once. */
  private readonly heights = new Map<string, number>();

  constructor(private readonly r: Renderer) {
    this.hHeart = r.atlas.handle("fx_heart");
    for (let i = 0; i < MAX_BUBBLES; i++) this.bubbles.push({ on: false, enemy: null, uid: -1, forced: false, free: false, ink: C.outline, line: null, t: 0, life: LIFE, ax: 0, ay: 0, bx: 0, by: 0 });
  }

  setWorld(w: World): void {
    this.w = w;
    for (const b of this.bubbles) {
      b.on = false;
      b.enemy = null;
    }
    this.typeAt.clear();
    this.lastIdx.clear();
    this.seen.fill(-1);
    this.cursor = 0;
  }

  /** Subscribes to the sim's `enemySay` (Feedback.bind). Returns the unsubscribers. */
  bind(w: World): (() => void)[] {
    return [w.bus.on("enemySay", (e: EnemySayEvent) => this.onSay(e))];
  }

  private onSay(ev: EnemySayEvent): void {
    const e = ev.enemy;
    if (!e || e.dead) return;
    // (behaviour lines that aren't forced - "Sugar rush!", "I-it's not like..." - share the per-type cooldown)
    const id = e.def.id;
    const w = this.w;
    if (!ev.force && w) {
      const at = this.typeAt.get(id);
      if (at !== undefined && w.t - at < TYPE_CD) return;
    }
    let text = ev.text;
    if (!text) {
      text = this.pickLine(id);
      if (!text) return;
    }
    if (this.open(e, text, ev.force) && !ev.force && w) this.typeAt.set(id, w.t);
  }

  /**
   * A free-standing scripted bubble at a world point (a boss's death line over its last
   * position): replaces the oldest bubble when all are taken, stays `life` s.
   */
  sayAt(x: number, y: number, text: string, life = 2.4, ink: number = C.outline): void {
    if (!this.w) return;
    let slot: Bubble | null = null;
    for (const b of this.bubbles) if (!b.on) slot = slot ?? b;
    if (!slot) for (const b of this.bubbles) if (!slot || b.t > slot.t) slot = b;
    if (!slot) return;
    slot.on = true;
    slot.enemy = null;
    slot.uid = -1;
    slot.forced = true;
    slot.free = true;
    slot.ink = ink;
    slot.line = this.line(text, true);
    slot.t = 0;
    slot.life = life;
    slot.ax = x;
    slot.ay = y;
    this.place(slot);
  }

  /** Drop every free-standing (sayAt) bubble - a stage view's dispose / reset. */
  clearFree(): void {
    for (const b of this.bubbles) if (b.on && b.free) b.on = false;
  }

  /** A pool line for this enemy type (never the same twice in a row), or "". */
  private pickLine(id: string): string {
    const pool = SPEECH_POOLS[id];
    if (!pool || pool.length === 0) return "";
    let i = Math.floor(Math.random() * pool.length);
    const last = this.lastIdx.get(id) ?? -1;
    if (pool.length > 1 && i === last) i = (i + 1) % pool.length;
    this.lastIdx.set(id, i);
    return pool[i];
  }

  /** Measured once per distinct string (and kind: free lines wrap onto more, wider rows). */
  private line(text: string, free = false): Line {
    const key = free ? `\u0001${text}` : text;
    let l = this.lines.get(key);
    if (!l) {
      const heart = text === "♡" || text === "♥";
      const tailHeart = !heart && /[♡♥]$/.test(text);
      const body = sanitize(text.replace(/[♡♥]$/, "")).trim();
      const rows = heart ? [""] : free ? wrapRows(body, FREE_CHARS) : wrap(body);
      const widths = rows.map((s) => this.r.text.measure(s, 1, 0, INK_FONT));
      if (tailHeart) widths[widths.length - 1] += 9;
      const lh = this.r.text.lineHeightOf(INK_FONT) + 2;
      const w = heart ? 13 : Math.max(...widths) + 6;
      const h = heart ? 11 : rows.length * (lh - 1) + 4;
      l = { rows, widths, heart, tailHeart, w: Math.ceil(w), h: Math.ceil(h) };
      this.lines.set(key, l);
    }
    return l;
  }

  private headY(e: Enemy): number {
    let h = this.heights.get(e.def.id);
    if (h === undefined) {
      h = this.r.atlas.info(e.skin || e.def.sprite).h;
      this.heights.set(e.def.id, h);
    }
    return e.y - e.z - h * e.scale - 3;
  }

  /** Start a bubble over `e`. Scripted lines may replace the oldest ambient (then oldest) bubble. */
  private open(e: Enemy, text: string, forced: boolean): boolean {
    const w = this.w;
    if (!w) return false;
    if (w.ult && w.ult.phase === "cutin") return false;
    let slot: Bubble | null = null;
    for (const b of this.bubbles) {
      if (b.on && b.uid === e.uid && b.enemy === e) {
        // the same speaker: a scripted line replaces its own bubble
        if (!forced) return false;
        slot = b;
        break;
      }
    }
    if (!slot) for (const b of this.bubbles) if (!b.on) slot = slot ?? b;
    if (!slot) {
      if (!forced) return false;
      let oldest: Bubble | null = null;
      for (const b of this.bubbles) if (!b.forced && (!oldest || b.t > oldest.t)) oldest = b;
      if (!oldest) for (const b of this.bubbles) if (!oldest || b.t > oldest.t) oldest = b;
      slot = oldest;
    }
    if (!slot) return false;
    const line = this.line(text);
    slot.on = true;
    slot.enemy = e;
    slot.uid = e.uid;
    slot.forced = forced;
    slot.free = false;
    slot.ink = C.outline;
    slot.line = line;
    slot.t = 0;
    slot.life = LIFE;
    slot.ax = e.x;
    slot.ay = this.headY(e);
    // an ambient line never lands on another bubble (two chatty crabs side by side); scripted lines always show
    if ((!this.place(slot) || this.overlapsOther(slot)) && !forced) {
      slot.on = false;
      slot.enemy = null;
      return false;
    }
    return true;
  }

  /** Does `b`'s body (as placed) overlap another bubble on screen? */
  private overlapsOther(b: Bubble): boolean {
    const l = b.line;
    if (!l) return false;
    for (const o of this.bubbles) {
      if (o === b || !o.on || !o.line) continue;
      if (Math.abs(o.bx - b.bx) * 2 < o.line.w + l.w + 4 && Math.abs(o.by - b.by) * 2 < o.line.h + l.h + 4) return true;
    }
    return false;
  }

  /**
   * Body centre from the anchor, kept HERO_CLEAR px from the hero and inside the view.
   * False when an ambient bubble would have to move far (it just doesn't speak).
   */
  private place(b: Bubble): boolean {
    const w = this.w;
    const line = b.line;
    if (!w || !line) return false;
    const p = w.player;
    const hx = p.x;
    const hy = p.y - 9;
    let bx = b.ax;
    let by = b.ay - 3 - line.h / 2;
    let moved = false;
    // distance from the hero to the bubble's rectangle
    const hw = line.w / 2 + 1;
    const hh = line.h / 2 + 1;
    const ddx = Math.max(0, Math.abs(bx - hx) - hw);
    const ddy = Math.max(0, Math.abs(by - hy) - hh);
    if (ddx * ddx + ddy * ddy < HERO_CLEAR * HERO_CLEAR) {
      moved = true;
      // slide away from the hero along hero -> speaker (straight up when they overlap)
      let vx = bx - hx;
      let vy = by - hy;
      const l = Math.sqrt(vx * vx + vy * vy);
      if (l < 1) {
        vx = 0;
        vy = -1;
      } else {
        vx /= l;
        vy /= l;
      }
      const need = HERO_CLEAR + Math.abs(vx) * hw + Math.abs(vy) * hh;
      bx = hx + vx * need;
      by = hy + vy * need;
    }
    // keep inside the view
    const v = this.r.camera.view;
    bx = Math.min(Math.max(bx, v.x + hw + 2), v.x + v.w - hw - 2);
    // (below the top HUD: timer / XP / boss bar; a free-standing line also stays out of the bottom third,
    // where the touch DASH / OVERDRIVE buttons live)
    const bottom = b.free ? v.y + v.h * 0.66 - hh : v.y + v.h - hh - 6;
    by = Math.min(Math.max(by, v.y + bossHeadroom(v.h) * 0.85 + hh), Math.max(bottom, v.y + bossHeadroom(v.h) * 0.85 + hh));
    b.bx = bx;
    b.by = by;
    return !moved;
  }

  /** Ambient chatter: a few enemies per frame are checked for "just entered the view". */
  private scan(): void {
    const w = this.w;
    if (!w || w.phase !== "play") return;
    if (w.enemyCount > MAX_ALIVE) return;
    const n = w.enemies.count;
    if (n === 0) return;
    let free = 0;
    for (const b of this.bubbles) if (!b.on) free++;
    const cam = this.r.camera;
    const items = w.enemies.items;
    const k = Math.min(SCAN, n);
    for (let j = 0; j < k; j++) {
      if (this.cursor >= n) this.cursor = 0;
      const e = items[this.cursor++];
      if (e.dead || e.def.prop || e.def.boss) continue;
      if (!cam.inView(e.x, e.y - e.cy, -6)) continue;
      const slot = e.uid & (SEEN_SLOTS - 1);
      if (this.seen[slot] === e.uid) continue;
      this.seen[slot] = e.uid;
      if (free <= 0) continue;
      const id = e.def.id;
      if (!SPEECH_POOLS[id]) continue;
      if (Math.random() >= (e.elite ? CHANCE_ELITE : CHANCE)) continue;
      const at = this.typeAt.get(id);
      if (at !== undefined && w.t - at < TYPE_CD) continue;
      const text = this.pickLine(id);
      if (text && this.open(e, text, false)) {
        this.typeAt.set(id, w.t);
        free--;
      }
    }
  }

  /** Per frame (WorldView.draw), after the entities. */
  draw(realDt: number): void {
    const w = this.w;
    if (!w) return;
    const cutin = !!(w.ult && w.ult.phase === "cutin");
    if (!cutin) this.scan();
    for (const b of this.bubbles) {
      if (!b.on || !b.line) continue;
      if (!cutin) b.t += realDt;
      const e = b.enemy;
      const alive = !!e && !e.dead && e.uid === b.uid;
      if (alive && e) {
        b.ax = e.x;
        b.ay = this.headY(e);
      } else if (b.uid !== -1 && b.t < b.life - 0.25) b.t = b.life - 0.25; // the speaker is gone: fade out now
      if (b.t >= b.life) {
        b.on = false;
        b.enemy = null;
        continue;
      }
      if (cutin) continue;
      this.place(b);
      this.drawBubble(b);
    }
  }

  private drawBubble(b: Bubble): void {
    const r = this.r;
    const line = b.line!;
    const t = b.t;
    const pop = t < 0.18 ? easeOutBack(t / 0.18, 2.6) : 1;
    const alpha = t > b.life - 0.25 ? Math.max(0, (b.life - t) / 0.25) : 1;
    const bw = Math.max(4, Math.round(line.w * pop));
    const bh = Math.max(3, Math.round(line.h * pop));
    const x = Math.round(b.bx - bw / 2);
    const y = Math.round(b.by - bh / 2);
    const L = Layer.Text;
    const O = C.outline;
    const F = C.white;
    // tail: points from the body toward the speaker's head (clamped under the body)
    const tx = Math.round(Math.min(Math.max(b.ax, x + 3), x + bw - 4));
    const tailDown = b.ay > y + bh;
    // body: rounded rect (1 px corners) + 1 px plum outline
    r.rect(L, x + 1, y, bw - 2, bh, F, alpha);
    r.rect(L, x, y + 1, bw, bh - 2, F, alpha);
    r.rect(L, x + 1, y - 1, bw - 2, 1, O, alpha);
    r.rect(L, x - 1, y + 1, 1, bh - 2, O, alpha);
    r.rect(L, x + bw, y + 1, 1, bh - 2, O, alpha);
    r.rect(L, x, y, 1, 1, O, alpha);
    r.rect(L, x + bw - 1, y, 1, 1, O, alpha);
    r.rect(L, x, y + bh - 1, 1, 1, O, alpha);
    r.rect(L, x + bw - 1, y + bh - 1, 1, 1, O, alpha);
    if (tailDown) {
      // bottom outline with a gap for the tail, then a 3-row tail
      r.rect(L, x + 1, y + bh, tx - 1 - (x + 1), 1, O, alpha);
      r.rect(L, tx + 2, y + bh, x + bw - 1 - (tx + 2), 1, O, alpha);
      r.rect(L, tx - 1, y + bh, 3, 1, F, alpha);
      r.rect(L, tx - 2, y + bh, 1, 1, O, alpha);
      r.rect(L, tx + 2, y + bh, 1, 1, O, alpha);
      r.rect(L, tx, y + bh + 1, 2, 1, F, alpha);
      r.rect(L, tx - 1, y + bh + 1, 1, 1, O, alpha);
      r.rect(L, tx + 2, y + bh + 1, 1, 1, O, alpha);
      r.rect(L, tx + 1, y + bh + 2, 1, 1, F, alpha);
      r.rect(L, tx, y + bh + 2, 1, 1, O, alpha);
      r.rect(L, tx + 2, y + bh + 2, 1, 1, O, alpha);
      r.rect(L, tx + 1, y + bh + 3, 1, 1, O, alpha);
    } else r.rect(L, x + 1, y + bh, bw - 2, 1, O, alpha);
    if (pop < 0.85) return;
    if (line.heart) {
      r.spr(L, this.hHeart, b.bx, b.by + 3, 1, 1, 0, C.pink, alpha, 0, 0);
      return;
    }
    const lh = r.text.lineHeightOf(INK_FONT) + 1;
    const top = Math.round(b.by - (line.rows.length * lh) / 2) + 1;
    for (let i = 0; i < line.rows.length; i++) {
      r.text.drawFast(L, line.rows[i], Math.round(b.bx - line.widths[i] / 2), top + i * lh, 1, b.ink, alpha, 0, 0, 0, INK_FONT);
    }
    if (line.tailHeart) {
      const last = line.rows.length - 1;
      r.spr(L, this.hHeart, Math.round(b.bx + line.widths[last] / 2 - 4), top + last * lh + 4, 1, 1, 0, C.pink, alpha, 0, 0);
    }
  }
}
