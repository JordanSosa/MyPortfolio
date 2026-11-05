/**
 * Named SCENARIOS: put the game in an exact, repeatable state in well under
 * 2 s, without real-time waiting where a step or hook can do it (lazy chunk).
 *
 *   ?scenario=boss:lady_lunatic:p3&seed=7&step=1        at boot (<html data-kk-scenario="ready">)
 *   await __kk.scenario("results:first-clear", { seed: 3 })
 *   await __kk.scenarios()                               the full list (docs/DEVTOOLS.md §3)
 *
 * Options: seed (default 1), hero (default hoshi), profile (fresh | mid | rich | P0..P7; each
 * scenario has its default), god ("0" = mortal; runs default to invulnerable), account ("0" =
 * practice run). Every scenario runs in the SANDBOX (src/debug/profiles.ts): the player's save
 * is never written.
 *
 * How a moment is reached (the real World, meta builders and App flows; no game logic is forked):
 *  - runs start through App.startRun with the profile's RunConfig (save.runPlan = buildRunConfig);
 *  - a late moment is a WARP: level-ups picked by the bot through the real card generation, a few
 *    chests (evolutions), run time set to the target and the director's timeline cursor moved past
 *    the events before it, then 4 s of muted bot play so the director fills the screen at that phase;
 *  - then the App runs real frames (unmuted: banners, boss bars, music, cut-ins, modals) until the
 *    state is reached. In step mode (?step=1) these frames are __kk.step frames (deterministic, CSS
 *    animations advanced with them); otherwise they are the live animation frames.
 */
import { time } from "../core/time";
import { CFG } from "../game/config";
import { HEROES } from "../game/heroes";
import { BOSSES, STAGES, WEAPONS } from "../game/registry";
import type { TimelineEvent } from "../game/stage";
import type { UpgradeCard } from "../game/types";
import { makeOffer } from "../game/upgrades";
import { guardOf } from "../game/weapons/_orbital";
import type { World } from "../game/world";
import { discover } from "../meta/codex";
import type { App } from "../ui/app";
import type { PageId } from "../ui/hub/hub";
import { save } from "../ui/save";
import { tooSoon } from "../ui/screens/common";
import { Session } from "../ui/session";
import { Bot, simulate } from "./bot";
import { renderOnce, stepFrames, Stepper } from "./dev";
import { applyProfile, buildProfile, sandbox } from "./profiles";

export { snapshot } from "./snapshot";

export interface ScenarioResult {
  name: string;
  ok: boolean;
  /** Wall-clock ms from the call to the state being ready. */
  ms: number;
  /** Where the time went: [step, ms since the start] (warp, frames, waits). */
  marks: [string, number][];
  error?: string;
  screen: string;
  modal: string;
  t: number;
}

export interface ScenarioInfo {
  name: string;
  group: string;
  desc: string;
}

interface Opts {
  seed: number;
  hero: string;
  profile: string | null;
  god: boolean;
  account: boolean;
}

const FPS = 60;
const DT = 1 / FPS;

// ================================================================ the frame driver
class Ctx {
  /** Resolve pending level-ups / chests between frames (bot picks) so no modal opens unasked. */
  autoResolve = true;
  /** Keep the Overdrive meter just under full between frames (the driving bot never casts unasked). */
  holdUlt = true;
  private readonly bot: Bot;
  constructor(
    readonly app: App,
    readonly o: Opts,
  ) {
    this.bot = new Bot(o.seed ^ 0x5ce);
  }
  get w(): World | null {
    return this.app.game?.world ?? null;
  }
  private get manual(): boolean {
    return this.app.loop.manual;
  }
  private between(): void {
    const w = this.w;
    if (!w) return;
    if (this.holdUlt && !w.ult && w.ultMeter >= CFG.ultMax - 1) w.ultMeter = CFG.ultMax - 1;
    if (!this.autoResolve || this.app.modal) return;
    while (w.pendingLevels > 0) this.bot.resolve(w);
    while (w.pendingChests.length > 0) w.openChest();
  }
  /**
   * The bot steers the hero during the scenario's live frames (kiting, dashing, collecting: a crowd
   * no longer collapses onto a hero standing still). Control returns to the player when it ends.
   */
  drive(): void {
    const g = this.app.game;
    if (g && !g.bot) {
      g.bot = new Bot(this.o.seed ^ 0xd21);
      this.drove = true;
    }
  }
  /** Scenario over: hand the hero back to the player (autoplay runs keep their bot). */
  release(): void {
    if (this.drove && this.app.game && !this.app.params.autoplay) this.app.game.bot = null;
    this.drove = false;
  }
  private drove = false;
  readonly t0 = performance.now();
  readonly marks: [string, number][] = [];
  mark(label: string): void {
    this.marks.push([label, Math.round(performance.now() - this.t0)]);
  }
  /** Advance `n` frames (step mode: synchronously, the last one drawn). */
  async frames(n: number): Promise<void> {
    if (this.manual) {
      stepFrames(this.app, n, DT, true, () => this.between());
      return;
    }
    for (let i = 0; i < n; i++) {
      this.between();
      await nextFrame();
    }
  }
  /**
   * Advance frames until `pred()` (at most `max` frames), then `extra` more. `async`: the state comes
   * from a DOM flow that awaits rAF / timers (dialogs, the gacha summon), so step mode yields to the
   * event loop after every frame instead of running the frames back to back.
   */
  async until(pred: () => boolean, what: string, max = 600, extra = 0, async = false): Promise<void> {
    if (this.manual) {
      let i = 0;
      const st = new Stepper(this.app, DT);
      while (!pred() && i++ < max) {
        this.between();
        st.frame(false);
        if (async) {
          st.finish();
          await yieldFrame();
        }
      }
      st.finish();
      if (!pred()) throw new Error(`timed out waiting for ${what} (${max} frames)`);
      if (extra > 0) await this.frames(extra);
      else renderOnce(this.app);
      return;
    }
    // live frames: a slow device gets the same number of sim seconds, in more wall time
    const end = performance.now() + (max / FPS) * 4000 + 4000;
    while (!pred()) {
      if (performance.now() > end) throw new Error(`timed out waiting for ${what}`);
      this.between();
      await nextFrame();
    }
    if (extra > 0) await this.frames(extra);
  }
  /**
   * Let CSS / DOM transitions finish: `seconds` of step frames in step mode; live, that much wall time
   * (CSS runs on wall-clock time there, and a slow device would otherwise wait for N slow frames).
   */
  async settle(seconds: number): Promise<void> {
    if (this.manual) return this.frames(Math.round(seconds * FPS));
    const end = performance.now() + seconds * 1000;
    while (performance.now() < end) {
      this.between();
      await nextFrame();
    }
  }
  /** `seconds` of wall-clock time with frames running (step mode steps one frame per ~16 ms): for wall-clock UI. */
  async realtime(seconds: number): Promise<void> {
    const end = performance.now() + seconds * 1000;
    while (performance.now() < end) {
      this.between();
      if (this.manual) {
        stepFrames(this.app, 1, DT, false);
        await new Promise((r) => setTimeout(r, 16));
      } else await nextFrame();
    }
    if (this.manual) renderOnce(this.app);
  }
  /** Real-time wait (only for gates that are wall-clock by design: the 300 ms ghost-tap guard). */
  async real(pred: () => boolean, what: string, ms = 3000): Promise<void> {
    const end = performance.now() + ms;
    while (!pred()) {
      if (performance.now() > end) throw new Error(`timed out waiting for ${what}`);
      await new Promise((r) => setTimeout(r, 16));
    }
  }
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
/** Let the event loop run (a rendering opportunity for rAF callbacks, or 50 ms at most). */
const yieldFrame = () =>
  new Promise<void>((r) => {
    const t = setTimeout(r, 50);
    requestAnimationFrame(() => {
      clearTimeout(t);
      setTimeout(r, 0);
    });
  });

// ================================================================ building blocks
function useProfile(c: Ctx, kind: string, hero = c.o.hero): void {
  applyProfile(c.app, buildProfile(c.o.profile ?? kind, hero));
}

/** A deterministic attract game behind the hub (App.startAttract picks a random hero / seed). */
async function stableAttract(c: Ctx, wait = true): Promise<void> {
  const app = c.app;
  app.attract?.dispose();
  app.fx.clear();
  app.attract = new Session(app, { hero: c.o.hero, seed: c.o.seed, attract: true, maxEnemies: 120, viewW: 300, viewH: 400 });
  app.attract.skip(25);
  time.reset();
  const a = () => app.attract?.world;
  // (step mode waits for the warm-up so shots are identical; live frames just let it finish on its own)
  if (wait && app.loop.manual) await c.until(() => !!a() && a()!.t >= 25 && !a()!.muted, "attract warm-up", 900);
}

async function hub(c: Ctx, path: PageId[], kind = "mid", tab?: string, hero?: string): Promise<void> {
  useProfile(c, kind);
  c.mark("profile");
  c.app.goHub(path, { tab, hero });
  c.mark("hub open");
  // (an opaque page hides the attract game, which then neither steps nor draws: nothing to wait for)
  await stableAttract(c, !c.app.hub?.coversScene);
  c.mark("attract ready");
  // the page slide-in (CSS, advanced by the frames in step mode)
  await c.settle(0.5);
}

/** Stage hosting a boss (its timeline event), else the stage whose final boss it is. */
function bossHome(id: string): { stage: string; ev: TimelineEvent | null } {
  for (const st of STAGES.values()) {
    const ev = st.events.find((e) => e.kind === "boss" && e.enemy === id);
    if (ev) return { stage: st.id, ev };
  }
  for (const st of STAGES.values()) if (st.finalBoss === id) return { stage: st.id, ev: null };
  throw new Error(`no stage hosts boss '${id}'`);
}

function stageOf(id: string | undefined): string {
  const s = id ?? "dream_meadow";
  if (!STAGES.has(s)) throw new Error(`unknown stage '${s}' (${[...STAGES.keys()].join(", ")})`);
  return s;
}

/** When the stage's final boss arrives (s). */
function finalAt(stage: string): number {
  const st = STAGES.get(stage)!;
  const ev = st.events.find((e) => e.kind === "boss" && e.enemy === st.finalBoss);
  return ev ? ev.at : st.duration;
}

/** A run with the profile's loadout (save.runPlan -> buildRunConfig), in the sandbox. */
function startRun(c: Ctx, stage: string, hero = c.o.hero): World {
  const app = c.app;
  const plan = save.runPlan({ hero, stage });
  // (measurement liberty, as in tools/checkpoints.ts: the asked stage / hero even when the profile lacks them)
  plan.config.stage = stage;
  app.params.seed = c.o.seed;
  app.startRun(hero, false, plan.config, { account: c.o.account });
  const w = app.game!.world;
  if (c.o.god) (w as unknown as { god: boolean }).god = true;
  c.drive();
  return w;
}

/** A typical level for a moment of a stage (fraction of the way to its final boss). */
function levelAt(stage: string, t: number): number {
  return Math.max(1, Math.round(3 + 27 * Math.min(1, t / finalAt(stage))));
}

/**
 * WARP the run to time `t` (see the header): bot-picked level-ups, chests, timeline cursor, then
 * `settle` s of muted bot play to populate the screen. Fast (a few hundred ms even at 15:00).
 */
function warp(c: Ctx, w: World, t: number, level = levelAt(w.stage.id, t), settle = 4): void {
  const bot = new Bot(c.o.seed ^ 0xa11);
  w.muted = true;
  try {
    let guard = 0;
    while (w.level < level && guard++ < 200) {
      w.addXp(w.xpNext - w.xp + 0.01);
      while (w.pendingLevels > 0) bot.resolve(w);
    }
    // a chest every ~8 levels (evolutions happen in chests)
    for (let k = 0; k < Math.floor(level / 8); k++) {
      w.pendingChests.push({ golden: false });
      w.openChest();
    }
    if (t > w.t) {
      const d = w.director as unknown as { nextEvent?: number; opened?: boolean; events?: TimelineEvent[] };
      if (typeof d.nextEvent !== "number" || !Array.isArray(d.events)) throw new Error("director internals changed: update warp() in src/debug/scenarios.ts");
      d.opened = true;
      w.t = t;
      const i = d.events.findIndex((e) => e.at > t);
      d.nextEvent = i < 0 ? d.events.length : i;
    }
    if (settle > 0) simulate(w, settle, 1 / 30, bot);
    while (w.pendingLevels > 0) bot.resolve(w);
    while (w.pendingChests.length > 0) w.openChest();
  } finally {
    w.muted = false;
  }
  const app = c.app;
  app.r.camera.snapTo(w.player.x, w.player.y - 8);
  const b = w.boss;
  app.hud.bossBar(b && !b.dead && b.def.boss ? b : null, b?.def.boss?.title ?? "");
}

async function runAt(c: Ctx, stage: string, t: number, live = 60): Promise<World> {
  useProfile(c, "mid");
  c.mark("profile");
  const w = startRun(c, stage);
  c.mark("run started");
  warp(c, w, t);
  c.mark("warped");
  await c.frames(live);
  c.mark(`${live} live frames`);
  return w;
}

/** Bring a boss in now (no WARNING), let its entrance play out, optionally set its HP fraction. */
async function bossNow(c: Ctx, w: World, id: string, mul = 0.4, frac = 1): Promise<void> {
  const def = BOSSES.get(id);
  if (!def?.boss) throw new Error(`unknown boss '${id}'`);
  w.muted = true;
  w.director.warnBoss(def, mul);
  w.muted = false;
  if (w.director.warning) w.director.warning.t = 0;
  await c.until(() => !!w.boss && !w.boss.dead && w.boss.def.id === id, `${id} to spawn`, 30);
  c.mark("boss spawned");
  await c.until(() => w.director.introT <= 0, `${id} entrance`, 240, 30);
  c.mark("entrance done");
  if (frac < 1 && w.boss) {
    w.boss.hp = Math.max(1, w.boss.maxHp * frac);
    // (the phase change plays: banner, shockwave, bullet clear)
    await c.frames(90);
  }
}

/** Kill the hero (god off, iframes / plot armor / lethal saves exhausted). */
async function killHero(c: Ctx, w: World): Promise<void> {
  (w as unknown as { god: boolean }).god = false;
  for (let i = 0; i < 12 && w.phase === "play"; i++) {
    w.player.iframes = 0;
    w.player.dashInv = 0;
    w.hurtPlayer(1e6, w.player.x + 10, w.player.y, "debug");
  }
  if (w.phase !== "dead") throw new Error("the hero would not die");
  await c.frames(2);
}

/** Final boss down -> victory (custom endings run their sequence, muted, up to 30 s of sim). */
async function winStage(c: Ctx, w: World): Promise<void> {
  const id = w.stage.finalBoss;
  const def = BOSSES.get(id);
  if (def?.boss) {
    if (!(w.boss && !w.boss.dead && w.boss.def.id === id)) {
      w.muted = true;
      w.director.warnBoss(def, 0.4);
      if (w.director.warning) w.director.warning.t = 0;
      simulate(w, 1 / 30, 1 / 30, new Bot(c.o.seed));
      w.muted = false;
    }
    const b = w.boss;
    if (b && !b.dead) w.killEnemy(b, null, "debug");
  }
  c.mark("final boss down");
  w.muted = true;
  simulate(w, 30, 1 / 30, new Bot(c.o.seed), (x) => (x.phase === "victory" ? false : undefined));
  w.muted = false;
  if (w.phase !== "victory") w.win();
  c.mark("victory");
  await c.frames(2);
}

/**
 * Episode Results in its finished state. (Its beats run on performance.now(), not frame time, so they
 * cannot be stepped: the screen's own "tap the show to skip to the end" gives the deterministic final
 * state; a first clear's unlock cards then play once, on CSS time that the frames advance.)
 */
async function results(c: Ctx): Promise<void> {
  c.app.endRun();
  c.mark("banked");
  await c.until(() => c.app.screen === "results", "Episode Results", 30, 2);
  (c.app.ui.querySelector(".results .er-scroll") as HTMLElement | null)?.click();
  await c.settle(1.25);
  c.mark("results settled");
}

/** Click a DOM control once the ghost-tap guard (300 ms after a screen / dialog change) allows it. */
async function tap(c: Ctx, sel: string): Promise<void> {
  await c.real(() => !!c.app.ui.querySelector(sel), sel);
  await c.real(() => !tooSoon(), "the ghost-tap guard");
  (c.app.ui.querySelector(sel) as HTMLElement).click();
}

interface GachaDebugApi {
  force(r: string): unknown;
  speed(x: number): number;
  step(sec: number, inc?: number): Promise<void>;
}

/**
 * A Merch Machine x10 pull, `at` seconds into its storyboard. The summon runs on wall-clock time
 * (performance.now), not frame time: in step mode the dev build's own hook (`__kkGacha.speed(0)` +
 * `step()`, src/ui/hub/gacha/debug.ts) drives its clock and CSS together, deterministically; live (or
 * in a production build) it simply plays for `at` seconds of real time.
 */
async function gachaPull(c: Ctx, mythic: boolean, at: number): Promise<void> {
  await hub(c, ["home", "gacha"], mythic ? "rich" : "mid", "permanent");
  const g = (window as unknown as { __kkGacha?: GachaDebugApi }).__kkGacha;
  if (mythic) {
    if (g) g.force("MYTHIC");
    else console.warn("[dev] gacha:mythic: the forced MYTHIC needs a dev build (__kkGacha); this is a normal x10 pull");
  }
  const drive = !!g && c.app.loop.manual;
  if (drive) g.speed(0);
  try {
    await tap(c, '[data-act="pull10"]');
    await tap(c, '.mm-choice [data-id="pull"]');
    c.mark("pull confirmed");
    await c.until(() => !!c.app.ui.querySelector(".reveal"), "the summon overlay", 120, 0, true);
    c.mark("summon open");
    if (drive) {
      await g.step(at, 1 / 30);
      renderOnce(c.app);
    } else await c.realtime(at);
    c.mark(`${at} s into the summon`);
  } finally {
    if (drive) g.speed(1);
  }
}

/** Evolutions the evo-hints account has discovered (its Wiki shows their recipes). */
const EVO_KNOWN = ["galaxy_barrage", "cosmic_yarn", "love_tornado", "thousand_crane_wish"];

/**
 * The evolution-hints build (levelup:evo-hints / pause:evo-hints / chest:evo-hints): a mid account that
 * discovered EVO_KNOWN (profile codex, as banking a run does), Hoshi holding Star Shot Lv4 + Wish Charm (its
 * next level makes Galaxy Barrage READY), Yarn Orbit Lv2 (a NEW Magnet Star completes the pair), Heart
 * Boomerang Lv3 (Twin Charm missing), Paper Crane Flock Lv2 (Wish Charm held, levels to go) and Candy Bomb
 * Lv1 (Sugar Nuke not discovered: no hint). Built through the World's own add / level calls.
 */
async function evoBuild(c: Ctx): Promise<World> {
  useProfile(c, "mid");
  for (const id of EVO_KNOWN) discover(save.profile, "weapons", id, false);
  c.mark("profile");
  const w = startRun(c, "dream_meadow");
  w.muted = true;
  const star = w.hasWeapon("star_shot") ?? w.addWeapon("star_shot", 4);
  if (star) w.setWeaponLevel(star, 4);
  for (const [id, lv] of [["yarn_orbit", 2], ["heart_boomerang", 3], ["paper_crane_flock", 2], ["candy_bomb", 1]] as const) w.addWeapon(id, lv);
  w.addPassive("wish_charm", 1);
  w.addPassive("power_bow", 2);
  w.muted = false;
  c.mark("build");
  // (a few live frames only: a bot-picked level-up would change the build)
  await c.frames(20);
  if (w.hasWeapon("star_shot")?.level !== 4 || w.passiveLevel("magnet_star") > 0) throw new Error("the evo-hints build changed during its live frames");
  return w;
}

/** Hand-pick a level-up offer from every card the real generator can make right now (makeOffer over the whole pool). */
function pickOffer(w: World, want: [UpgradeCard["kind"], string][]): void {
  const all = makeOffer(w, 99);
  const cards = want.map(([k, id]) => {
    const card = all.find((x) => x.kind === k && x.id === id);
    if (!card) throw new Error(`the build cannot be offered ${k} '${id}'`);
    return card;
  });
  const o = w as unknown as { currentOffer?: UpgradeCard[] | null };
  if (!("currentOffer" in o)) throw new Error("World internals changed: update pickOffer() in src/debug/scenarios.ts");
  o.currentOffer = cards;
}

/** Orbital Guard scenarios: the hero and weapon (evolved with `evo`) per orbital:<id>. */
const ORBITALS: Record<string, { hero: string; base: string; evo?: string }> = {
  yarn_orbit: { hero: "mochi", base: "yarn_orbit" },
  cosmic_yarn: { hero: "mochi", base: "yarn_orbit", evo: "cosmic_yarn" },
  teapot_tempest: { hero: "pudding", base: "teapot_tempest" },
  eternal_tea_party: { hero: "pudding", base: "teapot_tempest", evo: "eternal_tea_party" },
};

/**
 * The crowd:<hero> build on top of a warp's bot-picked one: the hero's signature weapon at max level and evolved
 * (its evolution passive added when a slot is free), and every other maxed weapon whose passive is held evolved
 * too, as the warp's chests would. Muted: no evolution celebration in the shot.
 */
function evolveBuild(w: World, evolve = true): string[] {
  w.muted = true;
  try {
    const sig = w.hero.weapon;
    const evo = WEAPONS.get(sig)?.evolution;
    // (the warp's chests may have evolved it already)
    if (!(evo && w.hasWeapon(evo.into))) {
      const inst = w.hasWeapon(sig) ?? w.addWeapon(sig, 1);
      if (inst) w.setWeaponLevel(inst, inst.def.levels.length);
      if (inst && evo && evolve) {
        if (w.passiveLevel(evo.with) <= 0) w.addPassive(evo.with, 1);
        w.evolveWeapon(inst);
      }
    }
    if (evolve)
      for (const x of [...w.weapons]) {
        const e = x.def.evolution;
        if (e && x.level >= x.def.levels.length && w.passiveLevel(e.with) > 0 && !w.hasWeapon(e.into)) w.evolveWeapon(x);
      }
  } finally {
    w.muted = false;
  }
  return w.weapons.map((x) => `${x.def.id}${x.def.evolved ? "*" : ""}:${x.level}`);
}

// ================================================================ registry
type Run = (c: Ctx, arg: string) => Promise<void>;
interface Kind {
  group: string;
  desc: string;
  /** Concrete names listed by __kk.scenarios() (the argument after "kind:"). */
  list: () => string[];
  run: Run;
  /** Default god mode for runs of this kind. */
  mortal?: boolean;
}

const heroIds = () => HEROES.map((h) => h.id);
const stageIds = () => [...STAGES.keys()];
const bossIds = () => [...BOSSES.keys()].filter((id) => !!BOSSES.get(id)?.boss);
const PAGES: Record<string, PageId[]> = {
  stages: ["home", "stages"],
  loadout: ["home", "stages", "loadout"],
  board: ["home", "board"],
  heroes: ["home", "heroes"],
  gacha: ["home", "gacha"],
  wiki: ["home", "wiki"],
};

/** hud:<moment> names (the Overdrive gauge of non-touch play). */
const HUD_OD = ["overdrive", "overdrive-ready", "overdrive-pad", "overdrive-tut", "overdrive-swap"];

const KINDS: Record<string, Kind> = {
  hub: {
    group: "hub",
    desc: "hub home with a seeded account: fresh (new save), mid (~8 h, P3), rich (P7 + everything), P0..P7",
    list: () => ["fresh", "mid", "rich"],
    run: (c, a) => hub(c, ["home"], a || "mid"),
  },
  ...Object.fromEntries(
    Object.entries(PAGES).map(([id, path]) => [
      id,
      {
        group: "hub",
        desc: `the ${id} page (mid account; ${id}:<tab> picks a tab)`,
        list: () => [""],
        run: (c: Ctx, a: string) => hub(c, path, "mid", a || undefined),
      } satisfies Kind,
    ]),
  ),
  hero: {
    group: "hub",
    desc: "a hero's page (hero:<id>[:talents])",
    list: () => ["rin:talents"],
    run: (c, a) => {
      const [id, tab] = a.split(":");
      return hub(c, ["home", "heroes", "hero"], "mid", tab || undefined, id || c.o.hero);
    },
  },
  settings: {
    group: "hub",
    desc: "the settings panel over the hub",
    list: () => [""],
    run: async (c) => {
      await hub(c, ["home"], "mid");
      c.app.openSettingsModal();
      await c.settle(0.35);
    },
  },
  run: {
    group: "run",
    desc: "a run moment: early (0:45 Dream Meadow), mid (40 % of the stage), late (just before the final boss); add @<stage>",
    list: () => ["early", "mid", "late", ...stageIds().map((s) => `late@${s}`)],
    run: async (c, a) => {
      const [when, st] = a.split("@");
      const stage = stageOf(st || undefined);
      const fa = finalAt(stage);
      const t = when === "early" ? 45 : when === "mid" ? Math.round(fa * 0.4) : when === "late" ? Math.max(30, fa - 20) : Number(when);
      if (!Number.isFinite(t)) throw new Error(`run:<early|mid|late|seconds>[@stage], got '${a}'`);
      await runAt(c, stage, t);
    },
  },
  stage: {
    group: "run",
    desc: "a stage at 40 % of its run (its enemy mix, ground, grade and music)",
    list: stageIds,
    run: async (c, a) => {
      const stage = stageOf(a || undefined);
      await runAt(c, stage, Math.round(finalAt(stage) * 0.4));
    },
  },
  boss: {
    group: "boss",
    desc: "a boss on screen after its entrance, at its stage and time; boss:<id>:p2 / :p3 = HP 50 % / 20 %, boss:<id>@0.3 = any HP fraction",
    list: () => bossIds().flatMap((id) => [id]),
    run: async (c, a) => {
      const [idp, fracS] = a.split("@");
      const [id, ph] = idp.split(":");
      const home = bossHome(id);
      const PH: Record<string, number> = { p1: 1, p2: 0.5, p3: 0.2, p4: 0.08 };
      const frac = fracS ? Number(fracS) : ph ? (PH[ph] ?? 1) : 1;
      const at = home.ev?.at ?? finalAt(home.stage);
      useProfile(c, "mid");
      const w = startRun(c, home.stage);
      warp(c, w, at);
      await bossNow(c, w, id, home.ev?.spawnMul ?? 0.4, frac);
    },
  },
  ult: {
    group: "run",
    desc: "a hero's ultimate: ult:<hero> = the anime cut-in, ult:<hero>:mid = mid-ult (1 s into the active part)",
    list: () => heroIds().flatMap((h) => [h, `${h}:mid`]),
    run: async (c, a) => {
      const [hero, moment] = a.split(":");
      useProfile(c, "mid", hero);
      const w = startRun(c, "dream_meadow", hero);
      warp(c, w, 100, 12);
      await c.frames(20);
      c.holdUlt = false;
      w.addUlt(CFG.ultMax);
      if (!w.tryUlt()) throw new Error(`${hero}: the ultimate did not start`);
      if (moment === "mid") await c.until(() => !!w.ult && w.ult.phase === "active" && w.ult.t >= 1, "mid-ult", 300);
      else await c.until(() => !!w.ult && w.ult.phase === "cutin" && w.ult.t >= 0.55, "the cut-in", 120);
    },
  },
  hud: {
    group: "run",
    desc: "the HUD's Overdrive gauge (keyboard / mouse / gamepad play; touch shows the OVERDRIVE button instead), 1:40 into Dream Meadow: hud:overdrive = 60 % charged, hud:overdrive-ready = full (the rainbow READY), hud:overdrive-pad = full with the gamepad's B; hud:overdrive-tut = a fresh account's first run, the OVERDRIVE READY bubble pointing at it (at the button on touch); hud:overdrive-swap = a touchscreen laptop: a touch mid-run brings the OVERDRIVE button and hides the gauge, a key brings the gauge back (both asserted; shown 35 % charged)",
    list: () => [...HUD_OD],
    run: async (c, a) => {
      if (!HUD_OD.includes(a)) throw new Error(`hud:<${HUD_OD.join("|")}>, got '${a}'`);
      const tut = a === "overdrive-tut";
      // (tut: no warp, so the meter has never been full and filling it fires the real ultReady -> tutorial bubble)
      useProfile(c, tut ? "fresh" : "mid");
      const w = startRun(c, "dream_meadow");
      if (!tut) warp(c, w, 100, 12);
      if (a === "overdrive-pad") c.app.input.lastDevice = "gamepad";
      await c.frames(30);
      if (a === "overdrive") {
        w.ultMeter = CFG.ultMax * 0.6;
        await c.frames(10);
        return;
      }
      if (a === "overdrive-swap") {
        // through the real Input listeners (window, capture): a touch press + lift, then a key press + release
        const inp = c.app.input;
        const gauge = () => document.querySelector<HTMLElement>(".kk-od")?.hidden === false;
        const x = Math.round(innerWidth * 0.3);
        const y = Math.round(innerHeight * 0.65);
        const at = document.elementFromPoint(x, y) ?? document.body;
        for (const type of ["pointerdown", "pointerup"])
          at.dispatchEvent(new PointerEvent(type, { pointerType: "touch", pointerId: 77, isPrimary: true, clientX: x, clientY: y, bubbles: true }));
        await c.frames(2);
        if (!inp.touchControlsVisible || gauge()) throw new Error("a touch mid-run: the OVERDRIVE button must replace the gauge");
        for (const type of ["keydown", "keyup"] as const) window.dispatchEvent(new KeyboardEvent(type, { code: "KeyW", bubbles: true }));
        w.ultMeter = CFG.ultMax * 0.35;
        await c.frames(10);
        if (inp.touchControlsVisible || !gauge()) throw new Error("a key mid-run: the gauge must replace the OVERDRIVE button");
        return;
      }
      // the driving bot would cast a full meter: the hero stands still (runs are invulnerable by default)
      c.release();
      c.holdUlt = false;
      if (tut) c.app.hud.hideHint();
      w.addUlt(CFG.ultMax);
      // (the READY pop and the bubble's entrance settle)
      await c.frames(40);
      if (!w.ultReady) throw new Error("the Overdrive meter is not full");
    },
  },
  orbital: {
    group: "run",
    desc: "Orbital Guard mid-Shoujo Academy (Mochi / Pudding, the weapon at Lv5 or evolved): orbital:<weapon> = a 16-bullet ring fired at the hero, shown once a body breaks (film it for the reform: orbital:yarn_orbit~150/10); orbital:<weapon>:calm = the same volley in the run's first seconds (the orbital alone on a near-empty screen: judge the break and the empty slot); orbital:<tea weapon>:tea = Warm Tea on the move",
    list: () => [...Object.keys(ORBITALS), "teapot_tempest:tea", "eternal_tea_party:tea"],
    run: async (c, a) => {
      const [id, moment] = a.split(":");
      const o = ORBITALS[id];
      if (!o) throw new Error(`orbital:<${Object.keys(ORBITALS).join("|")}>[:tea|:calm], got '${a}'`);
      useProfile(c, "mid", o.hero);
      const w = startRun(c, "shoujo_academy", o.hero);
      // (level 10: one warp chest, so the base weapon is not evolved behind our back; the tea moment earlier,
      // in a calmer crowd, so the Warm Tea ring at her feet can be judged; calm: no warp, the run's first seconds)
      if (moment === "tea") warp(c, w, 90, 8);
      else if (moment !== "calm") warp(c, w, 200, 10);
      w.muted = true;
      let inst = (o.evo && w.hasWeapon(o.evo)) || w.hasWeapon(o.base) || w.addWeapon(o.base, 5);
      if (!inst) throw new Error(`${o.hero} cannot hold ${o.base}`);
      if (inst.def.id === o.base) {
        w.setWeaponLevel(inst, 5);
        if (o.evo) inst = w.evolveWeapon(inst) ?? inst;
      }
      w.muted = false;
      if (inst.def.id !== (o.evo ?? o.base)) throw new Error(`orbital:${id}: got ${inst.def.id}`);
      const held = inst;
      // (calm: the run's first kills would open a level-up card over the film of the reform)
      if (moment === "calm") w.xpNext = 1e9;
      c.mark("orbital ready");
      await c.frames(30);
      if (moment === "tea") {
        // the bot walks her; spills land on her path: wait for Warm Tea, a little way into it
        await c.until(() => (held.data.warm ?? 0) > 0 && (held.data.warm ?? 0) < (held.data.warmMax ?? 0) - 0.5, "Warm Tea", 900);
        return;
      }
      // a ring volley at her body (the real bullet pool), close in so it meets the orbit
      const g = guardOf(held);
      const b0 = g.breaks;
      const pl = w.player;
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const cx = pl.x;
        const cy = pl.y - CFG.playerCy;
        w.spawnBullet(cx + Math.cos(ang) * 56, cy + Math.sin(ang) * 56, -Math.cos(ang) * 90, -Math.sin(ang) * 90, 5, "eb_orb", 3, 2);
      }
      await c.until(() => g.breaks > b0, "an orbital to break", 120, 6);
      c.mark(`${g.blocks} blocked, ${g.breaks} broke`);
    },
  },
  crowd: {
    group: "run",
    desc: "a hero in a busy run with a full build (the hero-readability check's stress scenes), 2 s of live play: crowd:<hero> = late, a rich account at Shoujo Academy 10:00 (~level 24, bot-picked; the signature weapon evolved plus every maxed weapon whose passive is held); crowd:<hero>:mid = a mid account at 3:20, level 10, the signature weapon at its top level (the moment of the orbital-haze reports: the bloom limiter and the hero beacon only switch on at high glow load); add @<stage> for another stage (77 % / 26 % of the way to its final boss). Film them: crowd:kuro~120/15",
    list: () => heroIds().flatMap((h) => [h, `${h}:mid`]),
    run: async (c, a) => {
      const [spec, st] = a.split("@");
      const [hero, moment] = spec.split(":");
      if (!HEROES.some((h) => h.id === hero) || (moment && moment !== "mid")) throw new Error(`crowd:<${heroIds().join("|")}>[:mid][@stage], got '${a}'`);
      const stage = stageOf(st || "shoujo_academy");
      const mid = moment === "mid";
      useProfile(c, mid ? "mid" : "rich", hero);
      const w = startRun(c, stage, hero);
      if (mid) warp(c, w, Math.round(finalAt(stage) * 0.26), 10);
      else warp(c, w, Math.round(finalAt(stage) * 0.77));
      c.mark(`build ${evolveBuild(w, !mid).join(" ")}`);
      // (the evolutions start firing and the director refills the screen around her)
      await c.frames(120);
    },
  },
  speech: {
    group: "run",
    desc: "enemy speech bubbles on screen (the 4 enemies nearest the hero speak from their stage's pools + one free bubble); speech:<stage>, default Candy Kingdom",
    list: () => [""],
    run: async (c, a) => {
      const stage = stageOf(a || "candy_kingdom");
      const w = await runAt(c, stage, Math.round(finalAt(stage) * 0.3), 20);
      const p = w.player;
      const near = w.enemies.items
        .filter((e) => !e.dead && !e.def.boss)
        .sort((x, y) => (x.x - p.x) ** 2 + (x.y - p.y) ** 2 - ((y.x - p.x) ** 2 + (y.y - p.y) ** 2))
        .slice(0, 4);
      if (!near.length) throw new Error("no enemy on screen to speak");
      for (const e of near) w.bus.emit("enemySay", { enemy: e, text: "", force: true });
      c.app.game?.view.speech.sayAt(p.x, p.y - 40, "It's not like I wanted to be here!", 4);
      // (the bubbles pop in over a few frames)
      await c.frames(24);
    },
  },
  levelup: {
    group: "modal",
    desc: "the level-up card picker (1:00 into Dream Meadow, level 6); levelup:evo-hints = evolution hints (READY star, a pair-completing passive, a missing passive), levelup:evo-four = + a card with an undiscovered recipe (4 cards), levelup:evo-many = the 6-card grid with hints",
    list: () => ["", "evo-hints", "evo-four", "evo-many"],
    run: async (c, a) => {
      if (a === "evo-hints" || a === "evo-four" || a === "evo-many") {
        const w = await evoBuild(c);
        c.autoResolve = false;
        w.addXp(w.xpNext - w.xp + 0.01);
        const cards: [UpgradeCard["kind"], string][] = [
          ["weapon", "star_shot"],
          ["passive", "magnet_star"],
          ["weapon", "heart_boomerang"],
        ];
        if (a === "evo-four") cards.push(["weapon", "candy_bomb"]);
        if (a === "evo-many") cards.push(["weapon", "paper_crane_flock"], ["passive", "twin_charm"], ["weapon", "candy_bomb"]);
        pickOffer(w, cards);
        // (the last card's fly-in ends 0.11 s x its index + 0.72 s after the modal opens)
        await c.until(() => c.app.modalKind === "levelup", "the level-up modal", 120, 30 + cards.length * 10);
        return;
      }
      const w = await runAt(c, "dream_meadow", 60, 20);
      c.autoResolve = false;
      w.addXp(w.xpNext - w.xp + 0.01);
      await c.until(() => c.app.modalKind === "levelup", "the level-up modal", 120, 40);
    },
  },
  chest: {
    group: "modal",
    desc: "a chest opening (chest:golden for the golden one; chest:evo-hints = a golden chest's revealed cards on the evo-hints build)",
    list: () => ["", "golden", "evo-hints"],
    run: async (c, a) => {
      if (a === "evo-hints") {
        const w = await evoBuild(c);
        c.autoResolve = false;
        const k = w.dropPickup("chest", w.player.x, w.player.y + 2, 1, true);
        k.vx = k.vy = 0;
        k.t = 0.35;
        await c.until(() => c.app.modalKind === "chest", "the chest modal", 120);
        // (the reels spin and land on frame time, then flip into the cards)
        await c.until(() => !!c.app.ui.querySelector(".chest-modal.revealed"), "the revealed cards", 400, 40);
        return;
      }
      const w = await runAt(c, "dream_meadow", 200, 20);
      c.autoResolve = false;
      const k = w.dropPickup("chest", w.player.x, w.player.y + 2, 1, a === "golden");
      k.vx = k.vy = 0;
      k.t = 0.35;
      await c.until(() => c.app.modalKind === "chest", "the chest modal", 120, 90);
    },
  },
  pause: {
    group: "modal",
    desc: "the pause menu mid-run (pause:evo-hints = the EVOLUTIONS list of the evo-hints build)",
    list: () => ["", "evo-hints"],
    run: async (c, a) => {
      if (a === "evo-hints") await evoBuild(c);
      else await runAt(c, "dream_meadow", 150, 30);
      c.app.pause();
      await c.until(() => c.app.modalKind === "pause", "the pause menu", 30, 20);
    },
  },
  over: {
    group: "modal",
    desc: "TO BE CONTINUED (over:death) or the victory card (over:victory)",
    list: () => ["death", "victory"],
    mortal: true,
    run: async (c, a) => {
      const w = await runAt(c, "dream_meadow", a === "victory" ? finalAt("dream_meadow") : 240, 20);
      c.autoResolve = false;
      if (a === "victory") await winStage(c, w);
      else await killHero(c, w);
      await c.until(() => c.app.modalKind === "over", "the game-over modal", 900, 60);
    },
  },
  results: {
    group: "results",
    desc: "Episode Results of a real (sandboxed) account run: death, victory (a repeat clear), first-clear (P1 account clears Dream Meadow: unlock cards)",
    list: () => ["death", "victory", "first-clear"],
    mortal: true,
    run: async (c, a) => {
      if (a === "first-clear") useProfile(c, "P1");
      else useProfile(c, "mid");
      const w = startRun(c, "dream_meadow");
      warp(c, w, a === "death" ? 260 : finalAt("dream_meadow"));
      await c.frames(20);
      if (a === "death") await killHero(c, w);
      else await winStage(c, w);
      await results(c);
    },
  },
  "gacha:pull-x10": {
    group: "gacha",
    desc: "a Merch Machine x10 pull, 3.6 s in (cards flipping)",
    list: () => [""],
    run: (c) => gachaPull(c, false, 3.6),
  },
  "gacha:mythic": {
    group: "gacha",
    desc: "a forced MYTHIC x10 pull at the 'the game breaks' moment (dev server: __kkGacha.force)",
    list: () => [""],
    run: (c) => gachaPull(c, true, 3.2),
  },
};

function resolveKind(name: string): { kind: Kind; key: string; arg: string } {
  if (KINDS[name]) return { kind: KINDS[name], key: name, arg: "" };
  const i = name.indexOf(":");
  const key = i < 0 ? name : name.slice(0, i);
  const k = KINDS[key];
  if (!k) throw new Error(`unknown scenario '${name}' (see __kk.scenarios())`);
  return { kind: k, key, arg: i < 0 ? "" : name.slice(i + 1) };
}

/** Every concrete scenario name (parametric kinds expanded over the registries). */
export function listScenarios(): ScenarioInfo[] {
  const out: ScenarioInfo[] = [];
  for (const [key, k] of Object.entries(KINDS)) for (const a of k.list()) out.push({ name: a ? `${key}:${a}` : key, group: k.group, desc: k.desc });
  return out;
}

let running: Promise<ScenarioResult> | null = null;

/** Run a scenario; resolves once its state is ready (never rejects: see `ok` / `error`). */
export async function runScenario(app: App, name: string, raw: Record<string, unknown> = {}): Promise<ScenarioResult> {
  // (one at a time: a second call waits for the first)
  while (running) await running.catch(() => undefined);
  const t0 = performance.now();
  const job = (async (): Promise<ScenarioResult> => {
    let error: string | undefined;
    let ctx: Ctx | null = null;
    try {
      const { kind, arg } = resolveKind(name.trim());
      const num = Number(raw.seed);
      const flag = (v: unknown, d: boolean) => (v === undefined || v === null || v === "" ? d : !(v === false || v === 0 || v === "0" || v === "false"));
      const o: Opts = {
        seed: Number.isFinite(num) && raw.seed !== undefined && raw.seed !== null && raw.seed !== "" ? num >>> 0 : 1,
        hero: typeof raw.hero === "string" && raw.hero ? raw.hero : "hoshi",
        profile: typeof raw.profile === "string" && raw.profile ? raw.profile : null,
        god: flag(raw.god, !kind.mortal),
        account: flag(raw.account, true),
      };
      sandbox();
      const c = new Ctx(app, o);
      ctx = c;
      try {
        await kind.run(c, arg);
      } finally {
        c.release();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      console.error(`[dev] scenario ${name} failed:`, e);
    }
    const ms = Math.round(performance.now() - t0);
    const res: ScenarioResult = { name, ok: !error, ms, marks: (ctx as Ctx | null)?.marks ?? [], error, screen: app.screen, modal: app.modalKind, t: Math.round((app.game?.world.t ?? 0) * 100) / 100 };
    if (!error) console.info(`[dev] scenario ${name} ready in ${ms} ms`);
    return res;
  })();
  running = job;
  try {
    return await job;
  } finally {
    running = null;
  }
}
