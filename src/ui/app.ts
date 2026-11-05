/**
 * App state machine + main loop.
 *
 *   splash ("tap to start", unlocks audio) -> HUB (Season 2: a page stack over
 *   the live attract game - home, episodes, loadout, Training Arc, heroes, Merch
 *   Machine, wiki; ui/hub/) -> game (episode title card, READY? / GO!) <->
 *   level-up / chest / pause modals -> TO BE CONTINUED / victory -> Episode
 *   Results -> hub (or straight to the Training Arc / a retry). Settings hang
 *   off the hub and the pause menu.
 *
 * Runs started from the hub use the ACCOUNT RunConfig (save.runPlan(): board,
 * hero level, talents, relics, twists ...; the legacy `meta` option is NOT
 * passed, the board already contains the old Dream Shop nodes). Deep links /
 * autoplay keep the debug config (?stage= ...) or the World default + the
 * legacy Dream Shop view. Every finished run is banked exactly once
 * (`bankRun`, save.recordRun -> RunReport) whether it ends on Results or on a
 * game-over RETRY.
 *
 * One Renderer / Fx / Input for the whole app. The current Session (real run
 * or attract) is stepped with the global `time` (hitstop, slow-mo, pause).
 *
 * Flow rules worth knowing:
 *  - the ultimate cut-in is never covered or interrupted: modals (level-up,
 *    chest) wait until the sim has left its cut-in, a pause request during it
 *    is deferred (`pausePending`), and the overlay always follows the sim;
 *  - a history entry guards everything but the hub's home page (and the
 *    splash): Android Back / the edge-swipe gesture closes an overlay, pops a
 *    hub page, pauses or steps back instead of leaving; at home it leaves;
 *  - while an in-run modal is up the WebGL scene redraws at most 30x per
 *    second (the DOM on top keeps full rate); behind an opaque hub page or a
 *    full-screen hub overlay (unlock celebration, Merch Machine pull) the
 *    attract game neither steps nor draws, and the frozen run behind Episode
 *    Results is drawn once (again on resize / WebGL context restore);
 *  - an account run in progress is stashed (save.stashRun: page hidden / left,
 *    every STASH_EVERY s of play, TO BE CONTINUED with a revive left) and the
 *    stash cleared when it banks, so a reload / OS tab kill banks it as DROPPED
 *    at the next boot. Debug URL params (?god ?skip ?speed) make a run a
 *    practice run (never banked, never stashed).
 */
import { audio, type MusicTrack, type SfxId } from "../audio";
import { Input } from "../core/input";
import { Loop } from "../core/loop";
import { urlSeed } from "../core/rng";
import { time } from "../core/time";
import { FpsMeter } from "../debug/fps";
import { PH, prof } from "../debug/perf";
import { debugRunConfig, type DebugParams } from "../debug/params";
import { createFx, type Fx } from "../fx";
import { CFG } from "../game/config";
import { heroDef } from "../game/heroes";
import { AutoQuality, guessTier, isQualityTier, QUALITY, Renderer, type QualityTier } from "../render";
import { showCutin, type CutinHandle } from "./cutin";
import { cutinLine } from "../game/heroes-b";
import { prewarmSprites, setAtlas } from "./dom";
import { MANIFEST } from "../art/manifest";
import { Hud } from "./hud";
import { Nav, type NavLayer } from "./nav";
import { save, type Settings } from "./save";
import { Session } from "./session";
import { openChestModal } from "./screens/chest";
import { openLevelUp } from "./screens/levelup";
import { openGameOver } from "./screens/over";
import { openPause } from "./screens/pause";
import { cashClaimable, showResults } from "./screens/results";
import { openSettings } from "./screens/settings";
import { showSplash } from "./screens/splash";
import { markBorn, secondThumbTaps } from "./screens/common";
import { Tutorial } from "./tutorial";
import { ScreenWake } from "./wake";
import { Hub, type PageId, type PageOpts } from "./hub/hub";
import { setPretintGate } from "./hub/board/glyph";
import { episodeTitle } from "./hub/copy";
import { clearRunToasts, kitTick, overlaysOpen, toast, trophyIcon, type KitHost, type ToastOpts } from "./kit";
import { resumeToasts, suspendToasts } from "./kit/overlay";
import { money } from "./kit/art";
import { showEpisodeCard, type EpisodeCard } from "./stinger";
import { RunNarrator } from "./narrator";
import { PlotToasts } from "./plot-toast";
import { AchievementWatch, claimAllAchievements } from "../meta/achievements/engine";
import { setLoadout } from "../meta/loadout";
import { interruptedNotice, resetBootNotices } from "./hub/celebrate";
import type { RunReport } from "../meta/rewards";
import { fmtInt } from "./dom";
import type { RunConfig } from "../game/run-config";
import type { RunSummary } from "../game/world";

export type ScreenId = "splash" | "hub" | "game" | "results";

/** The run's episode (title card + Episode Results header). */
export interface EpisodeInfo {
  n: number;
  title: string;
}

/** Same condition as the compact landscape layouts in styles.css. */
const COMPACT_LANDSCAPE = window.matchMedia("(orientation: landscape) and (max-height: 520px)");
/** Modal / Results: minimum real time between WebGL redraws (s). */
const THROTTLED_DRAW = 1 / 30 - 0.002;
/** The game-over modal opens this long after death (s): Batch-A's knock-down beat runs first. */
const DEATH_MODAL_DELAY = 2.0;
/** Run-start stinger: READY? for this long (sim paused), then GO! (s). */
const INTRO_READY = 0.6;
const INTRO_END = 1.25;
/** Hub runs: the episode title card holds this long before READY? (s). */
const INTRO_CARD = 1.35;
/** In-run Plot Point check interval (real s; each poll refreshes the live RunStats and evaluates the pending Plot Points). */
const ACH_POLL = 1;
/** An account run's live stats are stashed this often (real s of unpaused play) besides on hide / leave. */
const STASH_EVERY = 15;
/** The sprite prewarm waits this long after a screen change (ms). */
const PREWARM_SETTLE_MS = 1000;
/** Full-screen hub overlays that hide the attract game completely. */
const COVER_OVERLAYS = ".kover.unlock-cele:not(.out), .kover.reveal:not(.out)";

export interface UiScreen {
  el: HTMLElement;
  layer: NavLayer | null;
  close(): void;
  /** Per-frame hook (optional). */
  update?(realDt: number): void;
}

export class App implements KitHost {
  readonly r: Renderer;
  readonly fx: Fx;
  readonly input: Input;
  readonly loop: Loop;
  readonly nav = new Nav();
  readonly ui: HTMLElement;
  readonly hud: Hud;
  readonly fpsMeter: FpsMeter;
  readonly auto: AutoQuality;
  readonly wake = new ScreenWake();
  tier: QualityTier;
  screen: ScreenId = "splash";
  current: UiScreen | null = null;
  modal: UiScreen | null = null;
  modalKind = "";
  /** Sub-panel above the screen/modal (settings). */
  sub: UiScreen | null = null;
  game: Session | null = null;
  attract: Session | null = null;
  /** The hub screen while `screen === "hub"`. */
  hub: Hub | null = null;
  /** Hero picked on the select screen. */
  hero: string;
  private lvIntro = -1;
  private endT = 0;
  private ended = false;
  private lastSummary: RunSummary | null = null;
  /** Report of the last banked run (Episode Results, the hub's "Previously on..."). */
  private report: RunReport | null = null;
  /** The current run was banked already (Results and the game-over RETRY both bank, once). */
  private banked = false;
  /** The current run uses the account loadout (hub PLAY / RETRY of one). */
  private account = false;
  private episode: EpisodeInfo = { n: 1, title: "" };
  private epCard: EpisodeCard | null = null;
  /** Seconds the episode card holds before READY? (0 = no card). */
  private introCardT = 0;
  private introReadyShown = false;
  private achWatch: AchievementWatch | null = null;
  private achT = 0;
  /** In-run satire: the narrator caption strip and the Plot Point toasts (real account runs only). */
  private narr: RunNarrator | null = null;
  private ptoasts: PlotToasts | null = null;
  /** The ultimate cut-in overlay on screen (removed when the sim leaves its cut-in). */
  private cutin: CutinHandle | null = null;
  private unlocked = false;
  /** A pause asked for during the cut-in / run-start stinger: opens as soon as it ends. */
  private pausePending = false;
  /** Skip gameplay edges (dash / ult / pause) on the frame a modal closed: the B / Enter that closed it must not act twice. */
  private skipEdges = false;
  /** Run-start stinger clock (real s; -1 = none) and whether GO! happened. */
  private introT = -1;
  private introGo = false;
  /** Real seconds before AutoQuality samples again (after a screen / modal change). */
  private aqHold = 1;
  /** Real / sim time accumulated since the last WebGL draw (throttled draws). */
  private drawAcc = 0;
  private drawSimAcc = 0;
  private ctxToast = false;
  private tut: Tutorial | null = null;
  private touchShown = false;
  /** history.back() calls of our own still to arrive as popstate events. */
  private selfPops = 0;
  /** Real s of unpaused play since the last run stash. */
  private stashT = 0;
  /** A full-screen hub overlay (unlock celebration, pull) hides the attract game. */
  private overlayCover = false;
  /** The scene behind Results / a covered hub needs one fresh draw (entry, resize, context restore). */
  private redraw = true;
  /** performance.now() of the last screen / modal change (the sprite prewarm waits for things to settle). */
  private changedAt = 0;
  /**
   * Debug step mode (src/debug/dev.ts `__kk.step`): "skip" = this frame does not draw the WebGL scene (it
   * accumulates like a throttled modal frame), "force" = it draws whatever the screen. "auto" = the rules above.
   */
  debugDraw: "auto" | "skip" | "force" = "auto";

  constructor(readonly params: DebugParams) {
    const s = save.data.settings;
    this.tier = params.quality ?? (isQualityTier(s.quality) ? s.quality : guessTier());
    this.r = new Renderer({ parent: document.body, quality: QUALITY[this.tier], clearColor: 0x6fbf73 });
    setAtlas(this.r.atlas);
    this.fx = createFx(this.r, { particles: QUALITY[this.tier].particles });
    // dense late-game fights get very bright: slightly calmer bloom than the engine default
    this.r.bloom = 0.8;
    this.ui = document.getElementById("ui") ?? document.body.appendChild(Object.assign(document.createElement("div"), { id: "ui" }));
    this.input = new Input();
    this.hud = new Hud(this.ui, () => this.pause());
    // (a second thumb can pause while the other one steers: Chromium sends that tap no click)
    const pauseBtn = this.hud.root.querySelector<HTMLElement>(".pause-btn");
    if (pauseBtn) secondThumbTaps(pauseBtn, this.input);
    this.fpsMeter = new FpsMeter();
    this.auto = new AutoQuality(this.tier, (t, q) => {
      this.tier = t;
      this.r.setQuality(q);
      this.fx.ps.setCapacity(q.particles);
      if (this.game) this.game.world.maxEnemies = q.maxEnemies;
    });
    this.hero = params.hero ?? save.data.lastHero ?? "hoshi";
    this.nav.onMove = () => this.sfx("uiMove");
    this.applySettings();
    time.speed = params.speed;

    this.loop = new Loop((dt) => this.frame(dt));
    this.loop.onVisibility = (hidden) => {
      if (hidden) {
        if (this.screen === "game" && !this.modal) this.pause();
        // (also on pagehide / blur: the OS may kill a hidden tab without another event)
        this.stashRun();
        // Suspend audio only when the page is really hidden. A window blur alone (an Android
        // notification, the host app's own UI around an embedded page) leaves the page on screen
        // and often never sends the matching focus event back, which left the game silent for
        // the rest of the session. The pause menu muffles the music meanwhile.
        if (typeof document === "undefined" || document.visibilityState === "hidden") audio.suspend();
      } else {
        if (this.unlocked) audio.resume();
        // the browser drops the wake lock while the page is hidden (a paused run keeps the screen free to sleep)
        if (this.screen === "game" && !this.modal) this.wake.acquire();
      }
    };
    // the scene behind Results / covered hub pages is redrawn only when it can have changed
    window.addEventListener("resize", () => (this.redraw = true));
    // save safety (src/ui/save.ts): another window changed the save, writes failing, a run banked after boot
    save.onExternalChange = () => this.onExternalSave();
    save.onWriteFail = () => this.syncSaveWarn();
    save.onWriteOk = () => this.syncSaveWarn();
    // (the stash check waits for the Web Locks query: the hub may be up already)
    save.onInterrupted = (r) => {
      this.report ??= r;
      if (this.hub) interruptedNotice(this.hub);
    };
    this.report = save.interrupted;
    // any pointer use hides the keyboard focus ring
    window.addEventListener("pointerdown", () => this.nav.pointerUsed(), { capture: true });
    // first gesture anywhere unlocks audio (splash, or deep-linked screens)
    const unlock = () => this.unlockAudio();
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    // Android Back / edge-swipe back: route like Esc instead of leaving the page mid-run
    window.addEventListener("popstate", () => this.onPopState());
    // a controller dropping out mid-run pauses (its held stick / buttons are gone)
    window.addEventListener("gamepaddisconnected", () => {
      if (this.screen === "game" && !this.modal) this.pause();
    });
    this.r.onRestore = () => {
      this.hud.refreshIcons();
      this.redraw = true;
    };
  }

  get settings(): Settings {
    return save.data.settings;
  }

  start(): void {
    // icons / chest first (hub tiles, cards, level-up), then portraits, then hero idles; only in real idle time on
    // a settled hub (never during a run, a modal, an overlay or a screen change)
    const icons: [string, number][] = [];
    const portraits: [string, number][] = [];
    const idles: [string, number][] = [];
    for (const m of MANIFEST) {
      if (m.id.startsWith("icon_") || m.id === "chest") for (let f = 0; f < m.frames; f++) icons.push([m.id, f]);
      else if (m.id.startsWith("portrait_")) portraits.push([m.id, 0], [m.id, 1]);
      else if (m.id.endsWith("_idle")) for (let f = 0; f < m.frames; f++) idles.push([m.id, f]);
    }
    prewarmSprites([...icons, ...portraits, ...idles], () => this.screen !== "game" && !this.modal && !this.sub && overlaysOpen() === 0 && performance.now() - this.changedAt > PREWARM_SETTLE_MS);
    // (the Training Arc's glyph pretint, started at boot, waits out a run the same way)
    setPretintGate(() => this.screen !== "game");
    this.syncSaveWarn();
    this.startAttract();
    const sc = this.params.screen;
    // deep links: ?screen=hub|title (home) | stages | select / loadout | board / shop | heroes | hero | gacha | wiki | settings
    const deep: Record<string, PageId[]> = {
      hub: ["home"],
      title: ["home"],
      stages: ["home", "stages"],
      select: ["home", "stages", "loadout"],
      loadout: ["home", "stages", "loadout"],
      board: ["home", "board"],
      shop: ["home", "board"],
      heroes: ["home", "heroes"],
      hero: ["home", "heroes", "hero"],
      gacha: ["home", "gacha"],
      wiki: ["home", "wiki"],
    };
    if (this.params.autoplay || sc === "game") this.startRun(this.hero);
    else if (sc && deep[sc]) this.goHub(deep[sc], { hero: this.params.hero ?? undefined, tab: new URLSearchParams(this.params.query).get("tab") ?? undefined });
    else if (sc === "settings") {
      this.goHub();
      this.openSettingsModal();
    } else if (sc === "results") {
      this.startRun(this.hero);
      this.game?.skip(60);
      this.endRun();
    } else this.setScreen("splash", showSplash(this));
    this.loop.start();
  }

  unlockAudio(): void {
    if (this.unlocked || this.params.mute) return;
    this.unlocked = true;
    try {
      audio.unlock();
      this.applySettings();
      this.music(this.screen === "game" && this.game ? this.game.view.stage.music("battle") : this.screen === "hub" ? (this.hub?.top?.music ?? "hub") : "title");
    } catch (e) {
      console.warn("[audio] unlock failed", e);
    }
  }

  sfx(id: SfxId, vol = 1, pitch = 0): void {
    if (this.params.mute) return;
    audio.sfx(id, { vol, pitch });
  }

  music(track: MusicTrack, fade = 1): void {
    if (this.params.mute) return;
    audio.music(track, fade);
  }

  applySettings(): void {
    const s = this.settings;
    if (this.params.mute) audio.setVolumes({ master: 0 });
    else audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
    this.fx.juice.apply({ shake: s.shake, reduceFlashing: s.reduceFlashing });
    this.fx.dmg.enabled = s.damageNumbers;
    if (this.game) this.game.feedback.numbers = s.damageNumbers;
    this.input.haptics = s.haptics;
    this.fpsMeter.show(s.showFps || this.params.fps);
    document.body.classList.toggle("reduce-flash", s.reduceFlashing);
    if (!this.params.quality) {
      this.auto.enabled = s.quality === "auto";
      if (isQualityTier(s.quality) && s.quality !== this.tier) this.auto.set(s.quality);
    } else this.auto.enabled = false;
  }

  // ================================================================ history guard (Android Back)
  /** Nothing to step back to: the hub's home page (or the splash) with no overlay, sheet or settings open. */
  private atRoot(): boolean {
    if (this.sub || overlaysOpen() > 0) return false;
    if (this.screen === "splash") return true;
    return this.screen === "hub" && (this.hub?.depth ?? 1) <= 1;
  }

  /** Arm the Back guard (one same-URL history entry) unless at the root, where it is dropped so Back leaves. */
  syncHistory(): void {
    if (this.atRoot()) this.releaseHistory();
    else this.guardHistory();
  }

  /** KitHost: a sheet / dialog / reveal opened or closed. */
  overlayOpened(): void {
    this.syncHistory();
    this.syncCover();
  }
  overlayClosed(): void {
    this.syncHistory();
    this.syncCover();
  }

  /** KitHost: hub toasts wait while the settings panel is open (they would cover its rows). */
  holdToasts(): boolean {
    return !!this.sub;
  }

  /** A full-screen hub overlay hides the attract game (checked on overlay open / close only). */
  private syncCover(): void {
    const was = this.overlayCover;
    this.overlayCover = !!this.ui.querySelector(COVER_OVERLAYS);
    this.changedAt = performance.now();
    if (was && !this.overlayCover) this.redraw = true;
  }

  private guardHistory(): void {
    try {
      if (!(history.state as { kk?: number } | null)?.kk) history.pushState({ kk: 1 }, "");
    } catch {
      /* sandboxed / file:// pages: no history API */
    }
  }

  private releaseHistory(): void {
    // a release already on its way: history.state only changes when that traversal lands, so a second
    // back() here would step off the page (Back on Results -> goHub released twice)
    if (this.selfPops > 0) return;
    try {
      if ((history.state as { kk?: number } | null)?.kk) {
        this.selfPops++;
        history.back();
      }
    } catch {
      /* ignore */
    }
  }

  private onPopState(): void {
    if (this.selfPops > 0) {
      // our own releaseHistory(): if the player already moved on (home -> a page), re-arm the guard
      this.selfPops--;
      if (!this.atRoot()) this.guardHistory();
      return;
    }
    // (at the root there is no guard entry: Back already left the page)
    if (this.atRoot()) return;
    // route the gesture like Esc / gamepad B, then re-arm the guard if there is still somewhere to go back from
    if (this.sub || overlaysOpen() > 0) this.nav.top?.onBack?.();
    else if (this.screen === "game") {
      if (!this.modal) this.pause();
      else if (this.modalKind === "pause") this.resume();
      // level-up / chest / game over: Back is ignored (a choice is required)
    } else this.nav.top?.onBack?.(); // hub page -> pop; results -> hub
    this.syncHistory();
  }

  // ================================================================ screens
  setScreen(id: ScreenId, scr: UiScreen | null): void {
    if (this.sub) {
      this.nav.remove(this.sub.layer);
      this.sub.close();
      this.sub = null;
    }
    if (this.current) {
      this.nav.remove(this.current.layer);
      this.current.close();
    }
    this.endCutin();
    this.screen = id;
    this.current = scr;
    this.redraw = true;
    this.changedAt = performance.now();
    markBorn();
    if (scr?.layer) this.nav.push(scr.layer);
    this.hud.show(id === "game");
    this.input.showTouchControls(false);
    this.touchShown = false;
    this.aqHold = 1;
    this.hub = scr instanceof Hub ? scr : null;
    this.syncHistory();
  }

  /** Open the hub at `path` (home first; e.g. ["home", "board"] for the results' Upgrade). */
  goHub(path: PageId[] = ["home"], opts: PageOpts = {}): void {
    this.endGame();
    this.wake.release();
    if (!this.attract) this.startAttract();
    clearRunToasts();
    this.setScreen("hub", new Hub(this, path, opts));
  }

  /** Back to the hub home (pause QUIT, results HUB). */
  goTitle(): void {
    this.goHub();
  }

  private startAttract(): void {
    this.attract?.dispose();
    this.fx.clear();
    this.attract = new Session(this, { hero: ["hoshi", "rin", "mochi"][(Math.random() * 3) | 0], seed: (Math.random() * 1e9) >>> 0, attract: true, maxEnemies: 120, viewW: 300, viewH: 400 });
    this.attract.skip(25);
    time.reset();
    time.speed = this.params.speed;
  }

  /**
   * Begin a run with `hero`. `intro` (GO! on the select screen) plays the
   * run-start stinger: READY? with the sim paused, HUD fly-in, GO!.
   */
  startRun(hero: string, intro = false, run?: RunConfig, opts: { account?: boolean } = {}): void {
    // Season 2: the account loadout (src/meta buildRunConfig) arrives as `run` with opts.account; RETRY rebuilds it,
    // debug URLs (?stage= ?relics= ?endless=1 ...) build one, else the World's default (Dream Meadow)
    // (debug params that bend the run - ?god, ?skip, ?speed - make it a practice run: never banked, never stashed)
    this.account = !!opts.account && !!run && !this.params.god && this.params.skip <= 0 && this.params.speed === 1;
    this.runConfig = run ?? debugRunConfig(this.params);
    this.hero = heroDef(hero).id;
    // (a debug run's ?hero= may be locked on this account: only account runs touch the saved loadout)
    if (this.account && save.data.lastHero !== this.hero) {
      save.data.lastHero = this.hero;
      save.save();
    }
    this.endGame();
    this.attract?.dispose();
    this.attract = null;
    this.fx.clear();
    time.reset();
    time.speed = this.params.speed;
    this.r.camera.zoomTo(1, 10);
    this.hud.reset();
    const seed = this.params.seed ?? urlSeed();
    this.game = new Session(this, {
      hero: this.hero,
      seed,
      // an account RunConfig already holds the old Dream Shop ranks (board nodes): never both
      meta: this.account ? undefined : save.data.meta,
      god: this.params.god,
      maxEnemies: QUALITY[this.tier].maxEnemies,
      bot: this.params.autoplay,
      hooks: this.hookset(),
      run: this.runConfig,
    });
    this.ended = false;
    this.banked = false;
    this.stashT = 0;
    this.endT = 0;
    // a window booting while this one plays must leave this run's stash alone (src/ui/save.ts RUN_LOCK)
    if (this.account) save.holdRunLock();
    this.lvIntro = -1;
    this.pausePending = false;
    this.skipEdges = false;
    const w = this.game.world;
    this.episode = { n: save.profile.lifetime.runs + 1, title: episodeTitle(w.stage.id, { hero: w.hero.name, stage: w.stage.name }) };
    this.setScreen("game", null);
    clearRunToasts();
    if (this.params.skip > 0) this.game.skip(this.params.skip);
    this.wake.acquire();
    // first few runs: how to play (move -> dash -> overdrive)
    this.tut = save.data.runs < 3 && !this.params.autoplay ? new Tutorial(this.hud, this.input, this.game.world) : null;
    // in-run Plot Point toasts (real players only)
    this.achWatch = this.account && !this.params.autoplay ? new AchievementWatch(save.profile) : null;
    this.achT = 0;
    this.narr?.dispose();
    this.ptoasts?.dispose();
    this.narr = this.achWatch ? new RunNarrator(this, w, { hero: w.hero.name, stage: w.stage.name, n: this.episode.n }) : null;
    this.ptoasts = this.achWatch ? new PlotToasts(this) : null;
    // hub toasts still on screen (boot notices) step aside for the run
    for (const t of this.ui.querySelectorAll(".ktoasts:not(.inrun) .ktoast")) t.classList.add("out");
    if (intro && !this.params.autoplay && this.params.skip <= 0) this.beginIntro(this.account);
    else {
      this.tut?.start();
      this.narr?.runStart(this.episode.n);
    }
    this.music(this.game.view.stage.music("battle"), 1.5);
    this.sfx("uiConfirm");
  }

  /** RunConfig of the current / last run (undefined = the World default). */
  private runConfig: RunConfig | undefined;

  /** Hub GO: the saved loadout -> RunConfig (repaired, never throws) -> a run with the episode card. */
  startAccountRun(): void {
    const plan = save.runPlan();
    this.startRun(plan.hero, true, plan.config, { account: true });
  }

  private hookset() {
    const hud = this.hud;
    return {
      xpPulse: () => hud.xpPulse(),
      coinPulse: () => hud.coinPulse(),
      comboRank: () => hud.comboRank(),
      comboBreak: (n: number) => hud.comboBreak(n),
      banner: hud.banner.bind(hud),
      bossBar: hud.bossBar.bind(hud),
      ultReady: () => hud.ultReady(),
      cutin: (heroId: string, name: string) => {
        this.cutin?.end();
        const cw = this.game?.world;
        this.cutin = showCutin(document.body, heroId, heroDef(heroId).portrait, name, cw ? cutinLine(cw) : undefined);
      },
      cutinEnd: () => this.endCutin(),
    };
  }

  private endCutin(): void {
    this.cutin?.end();
    this.cutin = null;
  }

  private endGame(): void {
    if (this.sub) {
      this.nav.remove(this.sub.layer);
      this.sub.close();
      this.sub = null;
    }
    if (this.modal) this.closeModal();
    this.endCutin();
    this.endIntro();
    this.tut?.dispose();
    this.tut = null;
    this.achWatch = null;
    this.disposeRunSatire();
    this.pausePending = false;
    if (this.game) {
      // (a run is always banked before it is disposed; a stash left by one that somehow was not means nothing now)
      if (this.account && !this.banked) save.clearStash();
      save.releaseRunLock();
      this.game.dispose();
      this.game = null;
    }
    time.paused = false;
    time.reset();
    audio.setMuffled(false);
    this.r.camera.zoomTo(1, 10);
  }

  /**
   * Bank the current run into the profile (payout, XP, mastery, records,
   * unlocks, Plot Points) exactly once and return its report.
   */
  bankRun(): RunReport | null {
    const g = this.game;
    if (!g) return this.report;
    if (this.banked && this.report) return this.report;
    this.lastSummary = g.world.summary();
    // debug / deep-link runs (every pool open, ?god ...) only preview their payout: the account never sees them
    const report = this.account ? save.recordRun(this.lastSummary) : save.previewRun(this.lastSummary);
    // banked: the stash of this run is spent (the next boot must not bank it again); a practice run never wrote
    // one (and must not clear another window's)
    if (this.account) save.clearStash();
    save.releaseRunLock();
    this.report = report;
    this.banked = true;
    if (this.account) {
      // a first clear opened the next episode: PLAY points at it ("EP. N · Candy Kingdom")
      const next = report.records.firstClear ? report.unlocks.find((u) => u.kind === "stage" && !u.start) : undefined;
      if (next) {
        setLoadout(save.profile, { stage: next.id });
        save.save();
      }
      // keep this origin's storage from being evicted (once, after the first banked run)
      save.requestPersist();
    }
    return report;
  }

  /** Stash the live stats of an account run not banked yet (see src/ui/save.ts). */
  private stashRun(): void {
    const g = this.game;
    if (!g || !this.account || this.banked || this.screen !== "game") return;
    this.stashT = 0;
    save.stashRun(g.world.runStats());
  }

  /** The current / last run is a debug or deep-link run (nothing is banked). */
  get practice(): boolean {
    return !this.account;
  }

  /** End the current run and show the Episode Results (from game over, victory, quit). */
  endRun(): void {
    const g = this.game;
    if (!g) return;
    const report = this.bankRun() as RunReport;
    const summary = this.lastSummary as RunSummary;
    if (this.modal) this.closeModal();
    this.endCutin();
    this.endIntro();
    this.tut?.dispose();
    this.tut = null;
    this.achWatch = null;
    this.disposeRunSatire();
    this.pausePending = false;
    this.wake.release();
    this.input.showTouchControls(false);
    clearRunToasts();
    this.setScreen("results", showResults(this, summary, report, this.episode));
    this.music(summary.victory ? "victory" : "gameover", 1);
  }

  /** Same episode again: an account run re-plans (the profile just gained XP / unlocks), a debug run reuses its config. */
  retry(): void {
    if (this.account) this.startAccountRun();
    else this.startRun(this.hero, false, this.runConfig);
  }

  /**
   * Game over RETRY: bank the run, claim its Plot Point rewards (as leaving Results does), queue its unlocks
   * for the next Results / the hub (they are never lost), say what it paid, go again.
   */
  retryFromGameOver(): void {
    const r = this.bankRun();
    const practice = this.practice;
    let coins = r?.coins.total ?? 0;
    let gems = r?.gems.total ?? 0;
    let queued = 0;
    if (r && !practice) {
      for (const u of r.unlocks)
        if (!u.start) {
          save.pendingUnlocks.push(u);
          queued++;
        }
      const c = cashClaimable(save.profile) ? claimAllAchievements(save.profile) : null;
      if (c?.count) {
        save.save();
        coins += c.coins;
        gems += c.gems;
      }
    }
    this.retry();
    if (r && !practice)
      this.toast(`Episode ${fmtInt(r.episode)} banked!`, {
        kind: "good",
        reward: `${money("coins", `+${fmtInt(coins)}`)}${gems ? money("gems", `+${fmtInt(gems)}`) : ""}`,
        sub: queued ? `${queued} new unlock${queued === 1 ? "" : "s"} waiting on Episode Results!` : undefined,
        inRun: true,
        ms: 2600,
      });
  }

  // ================================================================ run-start stinger
  /** READY? (sim paused) -> GO!; hub runs first show the "EPISODE N" title card. */
  private beginIntro(card = false): void {
    this.introT = 0;
    this.introGo = false;
    this.introReadyShown = false;
    this.introCardT = card ? INTRO_CARD : 0;
    time.paused = true;
    this.game?.view.pose(this.introCardT + 0.9);
    if (card && this.game) {
      this.epCard?.remove();
      this.epCard = showEpisodeCard(this.ui, this.episode.n, this.episode.title, this.game.world.stage.name);
      this.sfx("narratorSting");
    } else this.showReady();
  }

  private showReady(): void {
    this.introReadyShown = true;
    this.epCard?.leave();
    this.hud.intro(true);
    this.sfx("countTick", 0.6, 4);
  }

  private introFrame(dt: number): void {
    this.introT += dt;
    if (!this.introReadyShown && this.introT >= this.introCardT) this.showReady();
    if (!this.introGo && this.introT >= this.introCardT + INTRO_READY) {
      this.introGo = true;
      if (!this.modal) time.paused = false;
      this.hud.introGo();
      this.fx.juice.shake(0.22);
      this.input.markTouchesStale();
      this.sfx("uiConfirm");
      this.tut?.start();
      this.narr?.runStart(this.episode.n);
    }
    if (this.introT >= this.introCardT + INTRO_END) this.endIntro();
  }

  private endIntro(): void {
    this.epCard?.remove();
    this.epCard = null;
    if (this.introT < 0) return;
    if (!this.introGo && !this.modal) time.paused = false;
    this.introT = -1;
    this.introGo = false;
    this.hud.intro(false);
  }

  /** The READY? part of the stinger is running: no input, sim paused. */
  private get introHold(): boolean {
    return this.introT >= 0 && !this.introGo;
  }

  // ================================================================ modals
  openModal(kind: string, m: UiScreen): void {
    if (this.modal) this.closeModal();
    this.hud.blurButtons();
    this.modal = m;
    this.modalKind = kind;
    markBorn();
    // a tap with the other thumb while one holds the stick presses the card / button (Chromium sends it no click)
    secondThumbTaps(m.el, this.input);
    if (m.layer) this.nav.push(m.layer);
    time.paused = true;
    this.input.showTouchControls(false);
    this.touchShown = false;
    this.input.markTouchesStale();
    this.hud.setModalOpen(true);
    this.changedAt = performance.now();
    // pause / level-up / chest muffle the battle music; the game-over / victory jingles stay clear
    if (this.screen === "game" && kind !== "over") audio.setMuffled(true);
    // a paused run lets the screen sleep (closeModal takes the wake lock again)
    if (kind === "pause") this.wake.release();
  }

  closeModal(): void {
    const m = this.modal;
    if (!m) return;
    this.modal = null;
    this.modalKind = "";
    this.nav.remove(m.layer);
    m.close();
    this.hud.blurButtons();
    time.paused = this.introHold;
    audio.setMuffled(false);
    this.hud.setModalOpen(false);
    this.skipEdges = true;
    this.aqHold = 0.5;
    this.changedAt = performance.now();
    if (this.screen === "game") this.wake.acquire();
  }

  pause(): void {
    if (this.screen !== "game" || !this.game || this.modal || this.game.world.phase !== "play") return;
    // never over the cut-in / READY?: open as soon as they end
    if (this.game.world.ult?.phase === "cutin" || this.introHold) {
      this.pausePending = true;
      return;
    }
    this.pausePending = false;
    this.sfx("uiConfirm");
    this.openModal("pause", openPause(this, this.game.world));
  }

  resume(): void {
    if (this.modalKind === "pause") {
      this.closeModal();
      this.sfx("uiBack");
    }
  }

  /** Settings panel on top of whatever is showing (title or pause menu). */
  openSettingsModal(): void {
    if (this.sub) return;
    const under = this.modal ?? this.current;
    if (under) under.el.style.visibility = "hidden";
    this.guardHistory();
    const m = openSettings(this, () => {
      this.nav.remove(m.layer);
      m.close();
      this.sub = null;
      if (under) under.el.style.visibility = "";
      this.syncHistory();
      // an import / reset may have replaced the profile: the hub re-reads it
      this.hub?.refreshTop();
      // hub toasts held while the panel was open
      resumeToasts(this);
    });
    this.sub = m;
    // hub toasts never cover the panel: the ones on screen come back after DONE
    suspendToasts();
    markBorn();
    secondThumbTaps(m.el, this.input);
    if (m.layer) this.nav.push(m.layer);
  }

  // ================================================================ frame
  private frame(dt: number): void {
    const t0 = performance.now();
    prof.begin(t0);
    time.update(dt);
    this.input.update();
    this.nav.update(this.input);
    const g = this.game;
    // WebGL context lost mid-run: the canvas is blank, so the run must not go on
    if (this.r.contextLost) {
      if (this.screen === "game" && g && !this.modal && g.world.phase === "play") {
        this.pause();
        if (!this.ctxToast) {
          this.ctxToast = true;
          this.toast("restoring graphics…");
        }
      }
    } else this.ctxToast = false;
    if (this.screen === "game" && g) this.gameFrame(g, dt);
    kitTick(dt);
    this.current?.update?.(dt);
    this.modal?.update?.(dt);
    this.sub?.update?.(dt);

    // menus over the attract game: keep its hero clear of the logo / menu
    if (this.attract) {
      const menu = this.screen === "hub" || this.screen === "splash";
      const compact = COMPACT_LANDSCAPE.matches;
      const v = this.r.camera.view;
      const anchor = this.screen === "hub" ? (this.hub?.camAnchor() ?? null) : null;
      // desktop / tablet landscape: logo + portraits on top, the menu (or TAP TO START) stacked in the centre
      // column down to ~85 % height -> the hero runs in the open meadow left of it (22 %, 62 %)
      const wide = !compact && v.w > v.h * 1.2;
      // portrait: below the centred menu (80 % height);
      // compact landscape: title = logo left, menu right -> the hero runs in the gap between them;
      // splash = key art in the middle -> the hero runs on the right
      if (anchor) {
        // hub pages that leave a window on the game say where (screen fractions)
        this.attract.camOffX = (0.5 - anchor.x) * v.w;
        this.attract.camOffY = (0.5 - anchor.y) * v.h;
      } else {
        this.attract.camOffY = menu && !compact ? (wide ? -0.12 : -0.3) * v.h : 0;
        this.attract.camOffX = !menu ? 0 : wide ? 0.28 * v.w : compact ? (this.screen === "hub" ? -0.08 : -0.3) * v.w : 0;
      }
    }
    // results: the finished run stays on screen, frozen
    const s = this.screen === "game" || this.screen === "results" ? g : this.attract;
    const r = this.r;
    // an opaque hub page / a full-screen hub overlay hides the attract game: it neither steps nor draws
    const hidden = this.screen === "hub" && (!!this.hub?.coversScene || this.overlayCover);
    const skipDraw = this.debugDraw === "skip";
    if (this.debugDraw === "force") this.redraw = true;
    prof.lap(PH.ui);
    if (s && this.screen !== "results" && !hidden) s.tick(time.dt, dt);
    prof.lap(PH.sim);
    this.drawAcc += dt;
    this.drawSimAcc += time.dt;
    if (hidden) {
      // (the scene shows again on the first uncovered frame, drawn fresh: no stale / black frame)
      this.fx.update(time.dt, dt);
      prof.lap(PH.fx);
      this.drawAcc = this.drawSimAcc = 0;
      this.redraw = true;
    } else if (this.screen === "results") {
      // the frozen run behind Episode Results: drawn on entry, then only after a resize / context restore
      if (this.redraw && !r.contextLost && !skipDraw) {
        this.redraw = false;
        r.beginFrame(this.drawAcc);
        if (s) s.draw(r.time, 0, this.drawAcc);
        prof.lap(PH.view);
        this.fx.draw();
        prof.lap(PH.fx);
        r.endFrame();
        prof.lap(PH.gpu);
      }
      this.drawAcc = this.drawSimAcc = 0;
    } else {
      // an in-run modal covers the scene: redraw it at most 30x per second (input, HUD and modals stay full rate)
      const throttled = !!this.modal && !this.redraw;
      if (!skipDraw && (!throttled || this.drawAcc >= THROTTLED_DRAW)) {
        this.redraw = false;
        r.beginFrame(this.drawAcc);
        if (s) s.draw(r.time, this.drawSimAcc, this.drawAcc);
        prof.lap(PH.view);
        this.fx.update(time.dt, dt);
        this.fx.draw();
        prof.lap(PH.fx);
        r.endFrame();
        prof.lap(PH.gpu);
        this.drawAcc = this.drawSimAcc = 0;
      } else {
        this.fx.update(time.dt, dt);
        prof.lap(PH.fx);
      }
    }
    if (g && this.screen === "game") this.hud.update(g.world, dt);
    prof.lap(PH.hud);
    const cpu = performance.now() - t0;
    prof.end(this.loop.rawDt, cpu, s ? s.world.enemyCount : 0, this.fx.ps.count, r.batch.stats.instances);
    this.fpsMeter.frame(dt, cpu, s && this.fpsMeter.visible ? `en ${s.world.enemyCount} p ${this.fx.ps.count} pr ${s.world.projectiles.count} q ${this.tier}` : "");
    // quality: judge only live gameplay / attract frames (not paused, modal, settings or a fresh screen)
    if (this.aqHold > 0) this.aqHold -= dt;
    if (time.paused || this.modal || this.sub || this.aqHold > 0 || this.screen === "results" || hidden) this.auto.resetWindow();
    // (the REAL frame interval: the loop clamps dt to 1/20 s, which would hide a 5 fps phone)
    else this.auto.sample(this.loop.rawDt * 1000, cpu);
  }

  private gameFrame(g: Session, dt: number): void {
    const w = g.world;
    const inp = this.input;
    const cut = w.ult?.phase === "cutin";
    // narrator captions / Plot Point toasts wait out modals, the cut-in and the run-start card
    const satireHold = !!this.modal || cut || this.introT >= 0;
    this.narr?.frame(dt, satireHold);
    this.ptoasts?.frame(dt, satireHold || w.phase !== "play");
    // the overlay follows the sim (also covers muted fast-forwards that never emit ultStart)
    if (this.cutin && !cut) this.endCutin();
    if (this.introT >= 0) this.introFrame(dt);
    const hold = this.introHold;
    const skipEdges = this.skipEdges;
    this.skipEdges = false;
    // Esc / START during the episode card, READY? or the cut-in: remembered, the pause opens right after GO / the cut-in
    if ((hold || cut) && !this.modal && inp.pressed("pause")) {
      inp.consume("pause");
      this.pausePending = true;
    }
    if (!this.modal && !hold) {
      if (!this.params.autoplay) {
        w.input.mx = inp.move.x;
        w.input.my = inp.move.y;
        if (!skipEdges) {
          if (inp.pressed("dash")) w.input.dash = true;
          if (inp.pressed("ult")) {
            // a level-up / chest is about to open: the cut-in must not start under it
            const queued = this.lvIntro >= 0 || w.pendingLevels > 0 || w.pendingChests.length > 0;
            if (!queued) {
              if (w.ultReady) w.input.ult = true;
              else if (!w.ult && w.phase === "play") {
                inp.deny("ult");
                this.hud.denyOverdrive();
                this.sfx("uiDeny", 0.6);
                this.tut?.denied();
              }
            }
          }
        }
      }
      if (!skipEdges && inp.pressed("pause")) {
        inp.consume("pause");
        this.pause();
      }
    }
    // touch controls + meters
    const playing = w.phase === "play" && !this.modal && !hold;
    if (inp.touchControlsWanted !== playing) inp.showTouchControls(playing);
    const shown = inp.touchControlsVisible;
    if (shown !== this.touchShown) {
      this.touchShown = shown;
      this.tut?.relayout();
    }
    inp.setUltCharge(w.ultMeter / CFG.ultMax, w.ultReady);
    inp.setDashCharge(w.dashMeter);
    // keyboard / mouse / gamepad: the HUD's Overdrive gauge stands in for the hidden OVERDRIVE button (never both;
    // while the controls are not wanted - a modal, READY? - the device decides, so a phone never flashes it;
    // gone with the button once the run is over: TO BE CONTINUED, the victory card)
    const odOn = w.phase === "play" && (playing ? !shown : inp.lastDevice !== "touch");
    this.hud.overdriveGauge(odOn, inp.lastDevice === "gamepad");

    // a pause asked for during the cut-in / READY? opens right after it
    if (this.pausePending && !this.modal && !cut && !hold) this.pause();

    // level-up flow: hitstop/fx happen on the event; ease time to 0.2x then open the modal
    if (this.lvIntro >= 0 && (w.phase !== "play" || cut)) {
      // (a bot-triggered cut-in mid-intro would otherwise crawl at 0.2x; the intro restarts after it)
      this.lvIntro = -1;
      time.easeTo(1, 0.2);
    }
    if (!this.modal && w.phase === "play" && !cut && !hold) {
      if (w.pendingLevels > 0) {
        if (this.lvIntro < 0) {
          this.lvIntro = 0;
          time.easeTo(0.2, 0.3);
        }
        this.lvIntro += dt;
        if (this.lvIntro >= 0.4) {
          this.lvIntro = -1;
          this.openModal("levelup", openLevelUp(this, w));
        }
      } else if (w.pendingChests.length > 0) {
        this.openModal("chest", openChestModal(this, w));
      }
    }
    // end of run
    if (!this.ended && (w.phase === "dead" || w.phase === "victory")) {
      this.endT += dt;
      if (w.phase === "dead" && this.endT > DEATH_MODAL_DELAY && !this.modal) {
        this.ended = true;
        this.openModal("over", openGameOver(this, w, false));
        this.music("gameover", 0.8);
        // nothing can change this run any more (no revive left): bank it now, so closing the app on the
        // TO BE CONTINUED screen never loses it (Results / RETRY reuse the same report); with a revive
        // offered, stash it (a reload there banks the death)
        if (w.revivesLeft <= 0) this.bankRun();
        else this.stashRun();
      } else if (w.phase === "victory" && this.endT > 7.2 && !this.modal) {
        // after the dawn celebration (view/bestiary-fx.ts: explosions -> flash at 1.7 s -> sunrise + fireworks)
        this.ended = true;
        this.openModal("over", openGameOver(this, w, true));
        this.bankRun();
      }
    }
    if (!this.modal && w.phase === "play") {
      this.tut?.frame(dt);
      this.pollPlotPoints(w, dt);
      if (!time.paused && this.account) {
        this.stashT += dt;
        if (this.stashT >= STASH_EVERY) this.stashRun();
      }
    }
  }

  /** In-run Plot Point toasts: about once a second of play, never under a modal; bottom centre, clear of the hero. */
  private pollPlotPoints(w: Session["world"], dt: number): void {
    const watch = this.achWatch;
    if (!watch || this.introT >= 0) return;
    this.achT += dt;
    if (this.achT < ACH_POLL) return;
    this.achT = 0;
    for (const def of watch.poll(w.runStats())) {
      if (this.ptoasts) this.ptoasts.push(def);
      else {
        this.sfx("achievement", 0.7);
        this.toast(def.name, { kind: "ach", kicker: "PLOT POINT!", icon: trophyIcon("kt-img"), inRun: true });
      }
    }
  }

  private disposeRunSatire(): void {
    this.narr?.dispose();
    this.narr = null;
    this.ptoasts?.dispose();
    this.ptoasts = null;
  }

  /** After the game-over revive. */
  revived(): void {
    this.ended = false;
    this.endT = 0;
    const g = this.game;
    const b = g?.world.boss;
    if (g) this.music(b?.def.boss ? g.view.stage.bossMusic(b) : g.view.stage.music("battle"), 1);
  }

  /** A toast (kit: queued, rate-limited; `inRun` = the bottom strip, clear of the hero). */
  toast(msg: string, o: ToastOpts = {}): void {
    toast(this, msg, o);
  }

  /**
   * Settings START OVER / IMPORT replaced the profile: forget the old profile's last run ("Previously on…"),
   * and let the next home visit run the boot notices for the new one (its unlocks, Plot Points ready).
   */
  onProfileReplaced(): void {
    this.report = null;
    this.lastSummary = null;
    resetBootNotices();
    this.syncSaveWarn();
  }

  /** Another window saved: the hub shows the reloaded profile; mid-run nothing changes (banking applies to it). */
  private onExternalSave(): void {
    if (this.screen !== "hub" || !this.hub) return;
    this.hub.refreshTop();
    this.toast("Your save changed in another window. Reloaded!", { kind: "info", ms: 3200 });
  }

  /** The sticky "can't save" banner (in the hub, under its header) follows save.writeOk; Results has its own line. */
  private syncSaveWarn(): void {
    this.hub?.setSaveWarn(!save.writeOk);
  }

  get lastRun(): RunSummary | null {
    return this.lastSummary;
  }

  /** Report of the last banked run (null before the first one this session). */
  get lastReport(): RunReport | null {
    return this.report;
  }

  get currentEpisode(): EpisodeInfo {
    return this.episode;
  }

  /** UI accent colour for a hero. */
  heroColor(id: string): string {
    const c = heroDef(id).color;
    return `#${c.toString(16).padStart(6, "0")}`;
  }
}
