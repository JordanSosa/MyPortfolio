/**
 * The in-run NARRATOR (docs/content/satire.md §1): a caption strip at the
 * bottom of the screen (Pixelify Sans, lavender on plum, 2.4 s, slides in)
 * with a narratorSting, on key moments only:
 *
 *   run start (after the episode card; episode 100 has its own line) · first
 *   level-up · first evolution · boss WARNING (the final boss: "The season
 *   finale!") · boss defeated · HP below 25 % (once) · revive · the first
 *   Overdrive · clear · Filler Arc start
 *
 * Rules: at most one line per 20 s (run start / clear / Filler Arc are the
 * show's big beats and only wait for the strip to be free); never while a boss
 * is mid-fight except its own entrance / defeat lines; a line that comes up
 * under a modal (the first level-up opens the card picker) waits until it
 * closes, stale ones (> 6 s) are dropped. Phones place the strip bottom-left,
 * clear of the DASH / OVERDRIVE column and the hero. World events are read
 * from the sim bus (no sim changes); fast-forwards (`w.muted`) say nothing.
 */
import { BOSSES } from "../game/registry";
import type { World } from "../game/world";
import { esc, h } from "./dom";
import { narratorLine, type Fill } from "./hub/copy";
import { reducedMotion } from "./kit/ticker";

/** Visible time of one caption (s). */
const SHOW = 2.4;
/** Minimum gap between two lines (s, real time). */
const GAP = 20;
/** A queued line older than this is dropped (s). */
const STALE = 6;

type Moment = "runStart" | "run100" | "firstLevel" | "firstEvo" | "bossWarn" | "finalBoss" | "bossDown" | "lowHp" | "revive" | "ult" | "clear" | "filler";
const BIG: ReadonlySet<Moment> = new Set<Moment>(["runStart", "run100", "clear", "filler"]);

export interface NarratorHost {
  readonly ui: HTMLElement;
  sfx(id: "narratorSting", vol?: number, pitch?: number): void;
}

export class RunNarrator {
  private readonly el: HTMLElement;
  private readonly offs: (() => void)[] = [];
  private queue: { text: string; big: boolean; at: number }[] = [];
  private showing = 0;
  private lastAt = -1e9;
  private flags = new Set<Moment>();
  private disposed = false;

  constructor(
    private readonly host: NarratorHost,
    private readonly w: World,
    private readonly fill: Fill,
  ) {
    this.el = h("div", "narr");
    this.el.setAttribute("aria-live", "polite");
    this.el.innerHTML = `<span class="narr-k" aria-hidden="true"><i class="narr-mic"></i>NARRATOR</span><span class="narr-t"></span>`;
    host.ui.appendChild(this.el);
    const bus = w.bus;
    const live = () => !w.muted && w.phase !== "dead";
    this.offs.push(
      bus.on("levelUp", () => {
        if (live()) this.once("firstLevel");
      }),
      bus.on("evolution", (e) => {
        if (live()) this.once("firstEvo", { weapon: e.name });
      }),
      bus.on("bossWarning", (e) => {
        if (!live()) return;
        const final = !!BOSSES.get(e.id)?.boss?.final;
        this.say(final ? "finalBoss" : "bossWarn", { boss: e.title });
      }),
      bus.on("bossKilled", (e) => {
        if (live() && !e.final) this.say("bossDown", { boss: titleCase(e.title) });
      }),
      bus.on("playerHurt", (e) => {
        if (live() && e.maxHp > 0 && e.hp > 0 && e.hp / e.maxHp < 0.25 && !this.bossFighting()) this.once("lowHp");
      }),
      bus.on("playerRevived", () => {
        if (!w.muted) this.say("revive");
      }),
      bus.on("ultCutin", () => {
        if (live()) this.once("ult");
      }),
      bus.on("victory", () => {
        if (!w.muted) this.say("clear");
      }),
      bus.on("fillerArc", () => {
        if (!w.muted) this.say("filler");
      }),
    );
  }

  /** After the episode card: the run-start line (episode 100 gets its own). */
  runStart(episode: number): void {
    this.once(episode === 100 ? "run100" : "runStart");
  }

  private bossFighting(): boolean {
    const b = this.w.boss;
    return !!b && !b.dead;
  }

  private once(m: Moment, f: Fill = {}): void {
    if (this.flags.has(m)) return;
    this.flags.add(m);
    this.say(m, f);
  }

  private say(m: Moment, f: Fill = {}): void {
    if (this.disposed) return;
    const now = performance.now() / 1000;
    const big = BIG.has(m);
    // a boss fight in progress: only its own entrance / defeat lines (never over a pattern's telegraph)
    if (!big && m !== "bossDown" && m !== "bossWarn" && m !== "finalBoss" && m !== "revive" && this.bossFighting()) return;
    if (!big && now - this.lastAt < GAP) return;
    const text = narratorLine(m, { ...this.fill, ...f });
    if (!text) return;
    // big beats replace a waiting small one; otherwise keep one line in the queue at most
    if (big) this.queue = this.queue.filter((q) => q.big);
    if (this.queue.length >= 1 && !big) return;
    this.queue.push({ text, big, at: now });
    if (!big) this.lastAt = now;
  }

  /** Per frame (real dt). `blocked` = a modal / the cut-in / the run-start card is up. */
  frame(dt: number, blocked: boolean): void {
    if (this.disposed) return;
    if (this.showing > 0) {
      // a modal / the cut-in over a caption: tuck it away and hold its clock until the show resumes
      this.el.classList.toggle("hold", blocked);
      if (!blocked) this.showing -= dt;
      if (this.showing <= 0) this.el.classList.remove("on", "hold");
      return;
    }
    if (blocked || !this.queue.length) return;
    const now = performance.now() / 1000;
    this.queue = this.queue.filter((q) => now - q.at < STALE || q.big);
    const next = this.queue.shift();
    if (!next) return;
    (this.el.querySelector(".narr-t") as HTMLElement).innerHTML = esc(next.text);
    this.el.classList.remove("on");
    // (restart the slide-in: a class toggle a frame apart, no forced reflow)
    requestAnimationFrame(() => {
      if (!this.disposed) this.el.classList.add("on");
    });
    this.showing = SHOW + (reducedMotion() ? 0 : 0.35);
    this.lastAt = Math.max(this.lastAt, now);
    this.host.sfx("narratorSting", 0.45);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.el.remove();
  }
}

/** "KING PUFF" -> "King Puff" (boss name cards are upper case). */
function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
}
