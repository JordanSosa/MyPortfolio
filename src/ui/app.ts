/**
 * App state machine + main loop.
 *
 *   splash ("tap to start", unlocks audio) -> title (attract-mode game behind)
 *   -> select -> game <-> level-up / chest / pause modals -> game over / victory
 *   -> results -> title.  Dream Shop and Settings hang off the title.
 *
 * One Renderer / Fx / Input for the whole app. The current Session (real run
 * or attract) is stepped with the global `time` (hitstop, slow-mo, pause).
 *
 * Flow rules worth knowing:
 *  - the ultimate cut-in is never covered or interrupted: modals (level-up,
 *    chest) wait until the sim has left its cut-in, a pause request during it
 *    is deferred (`pausePending`), and the overlay always follows the sim;
 *  - a history entry guards every non-title screen, so Android Back / the
 *    edge-swipe gesture pauses or steps back instead of leaving mid-run;
 *  - while a modal or the Results screen is up, the WebGL scene redraws at
 *    most 30x per second (the DOM on top keeps full rate).
 */
import { audio, type MusicTrack, type SfxId } from "../audio";
import { Input } from "../core/input";
import { Loop } from "../core/loop";
import { urlSeed } from "../core/rng";
import { time } from "../core/time";
import { FpsMeter } from "../debug/fps";
import type { DebugParams } from "../debug/params";
import { createFx, type Fx } from "../fx";
import { CFG } from "../game/config";
import { heroDef } from "../game/heroes";
import { AutoQuality, guessTier, isQualityTier, QUALITY, Renderer, type QualityTier } from "../render";
import { showCutin, type CutinHandle } from "./cutin";
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
import { showResults } from "./screens/results";
import { showSelect } from "./screens/select";
import { showShop } from "./screens/shop";
import { openSettings } from "./screens/settings";
import { showSplash } from "./screens/splash";
import { showTitle } from "./screens/title";
import { markBorn } from "./screens/common";
import { Tutorial } from "./tutorial";
import { ScreenWake } from "./wake";
import type { RunSummary } from "../game/world";

export type ScreenId = "splash" | "title" | "select" | "game" | "results" | "shop";

/** Same condition as the compact landscape layouts in styles.css. */
const COMPACT_LANDSCAPE = window.matchMedia("(orientation: landscape) and (max-height: 520px)");
/** Modal / Results: minimum real time between WebGL redraws (s). */
const THROTTLED_DRAW = 1 / 30 - 0.002;
/** The game-over modal opens this long after death (s): Batch-A's knock-down beat runs first. */
const DEATH_MODAL_DELAY = 2.0;
/** Run-start stinger: READY? for this long (sim paused), then GO! (s). */
const INTRO_READY = 0.6;
const INTRO_END = 1.25;

export interface UiScreen {
  el: HTMLElement;
  layer: NavLayer | null;
  close(): void;
  /** Per-frame hook (optional). */
  update?(realDt: number): void;
}

export class App {
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
  /** Hero picked on the select screen. */
  hero: string;
  private lvIntro = -1;
  private endT = 0;
  private ended = false;
  private lastSummary: RunSummary | null = null;
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
        audio.suspend();
      } else {
        if (this.unlocked) audio.resume();
        // the browser drops the wake lock while the page is hidden
        if (this.screen === "game") this.wake.acquire();
      }
    };
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
    this.r.onRestore = () => this.hud.refreshIcons();
  }

  get settings(): Settings {
    return save.data.settings;
  }

  start(): void {
    // icons / portraits / chest / hero idles used by the DOM UI
    const warm: [string, number][] = [];
    for (const m of MANIFEST) {
      if (m.id.startsWith("icon_") || m.id === "chest") for (let f = 0; f < m.frames; f++) warm.push([m.id, f]);
      else if (m.id.startsWith("portrait_")) warm.push([m.id, 0], [m.id, 1]);
      else if (m.id.endsWith("_idle")) for (let f = 0; f < m.frames; f++) warm.push([m.id, f]);
    }
    prewarmSprites(warm);
    this.startAttract();
    const sc = this.params.screen;
    if (this.params.autoplay || sc === "game") this.startRun(this.hero);
    else if (sc === "title") this.goTitle();
    else if (sc === "select") this.goSelect();
    else if (sc === "shop") this.goShop();
    else if (sc === "settings") {
      this.goTitle();
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
      this.music(this.screen === "game" ? "battle" : this.screen === "shop" ? "shop" : "title");
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
  /** Arm the Back guard: one same-URL history entry while a non-title screen is up. */
  private guardHistory(): void {
    try {
      if (!(history.state as { kk?: number } | null)?.kk) history.pushState({ kk: 1 }, "");
    } catch {
      /* sandboxed / file:// pages: no history API */
    }
  }

  /** Back at the root (title): drop the guard so the next Back leaves the page. */
  private releaseHistory(): void {
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
      // our own releaseHistory(): if the player already moved on (title -> select), re-arm the guard
      this.selfPops--;
      if (this.screen !== "title" && this.screen !== "splash") this.guardHistory();
      return;
    }
    if (this.screen === "title" || this.screen === "splash") {
      // Back on the title leaves the page; it only closes an open settings panel first
      if (this.sub) this.nav.top?.onBack?.();
      return;
    }
    // stay on the page: re-arm the guard, then route the gesture like Esc
    this.guardHistory();
    if (this.sub) {
      this.nav.top?.onBack?.();
      return;
    }
    if (this.screen === "game") {
      if (!this.modal) this.pause();
      else if (this.modalKind === "pause") this.resume();
      // level-up / chest / game over: Back is ignored (a choice is required)
      return;
    }
    // select / shop / results: one step back (to the title)
    this.nav.top?.onBack?.();
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
    markBorn();
    if (scr?.layer) this.nav.push(scr.layer);
    this.hud.show(id === "game");
    this.input.showTouchControls(false);
    this.touchShown = false;
    this.aqHold = 1;
    if (id !== "title" && id !== "splash") this.guardHistory();
  }

  goTitle(): void {
    this.endGame();
    this.wake.release();
    if (!this.attract) this.startAttract();
    this.setScreen("title", showTitle(this));
    this.releaseHistory();
    this.music("title");
  }

  goSelect(): void {
    this.setScreen("select", showSelect(this));
    this.music("title");
  }

  goShop(): void {
    this.setScreen("shop", showShop(this));
    this.music("shop");
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
  startRun(hero: string, intro = false): void {
    this.hero = heroDef(hero).id;
    save.data.lastHero = this.hero;
    save.save();
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
      meta: save.data.meta,
      god: this.params.god,
      maxEnemies: QUALITY[this.tier].maxEnemies,
      bot: this.params.autoplay,
      hooks: this.hookset(),
    });
    this.ended = false;
    this.endT = 0;
    this.lvIntro = -1;
    this.pausePending = false;
    this.skipEdges = false;
    this.setScreen("game", null);
    if (this.params.skip > 0) this.game.skip(this.params.skip);
    this.wake.acquire();
    // first few runs: how to play (move -> dash -> overdrive)
    this.tut = save.data.runs < 3 && !this.params.autoplay ? new Tutorial(this.hud, this.input, this.game.world) : null;
    if (intro && !this.params.autoplay && this.params.skip <= 0) this.beginIntro();
    else this.tut?.start();
    this.music("battle", 1.5);
    this.sfx("uiConfirm");
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
        this.cutin = showCutin(document.body, heroId, heroDef(heroId).portrait, name);
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
    this.pausePending = false;
    if (this.game) {
      this.game.dispose();
      this.game = null;
    }
    time.paused = false;
    time.reset();
    audio.setMuffled(false);
    this.r.camera.zoomTo(1, 10);
  }

  /** End the current run and show results (from game over, victory, quit). */
  endRun(): void {
    const g = this.game;
    if (!g) return;
    this.lastSummary = g.world.summary();
    const summary = this.lastSummary;
    if (this.modal) this.closeModal();
    this.endCutin();
    this.endIntro();
    this.tut?.dispose();
    this.tut = null;
    this.pausePending = false;
    this.wake.release();
    this.input.showTouchControls(false);
    this.setScreen("results", showResults(this, summary));
    this.music(summary.victory ? "victory" : "gameover", 1);
  }

  retry(): void {
    this.startRun(this.hero);
  }

  // ================================================================ run-start stinger
  private beginIntro(): void {
    this.introT = 0;
    this.introGo = false;
    time.paused = true;
    this.game?.view.pose(0.9);
    this.hud.intro(true);
    this.sfx("countTick", 0.6, 4);
  }

  private introFrame(dt: number): void {
    this.introT += dt;
    if (!this.introGo && this.introT >= INTRO_READY) {
      this.introGo = true;
      if (!this.modal) time.paused = false;
      this.hud.introGo();
      this.fx.juice.shake(0.22);
      this.input.markTouchesStale();
      this.sfx("uiConfirm");
      this.tut?.start();
    }
    if (this.introT >= INTRO_END) this.endIntro();
  }

  private endIntro(): void {
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
    if (m.layer) this.nav.push(m.layer);
    time.paused = true;
    this.input.showTouchControls(false);
    this.touchShown = false;
    this.input.markTouchesStale();
    this.hud.setModalOpen(true);
    // pause / level-up / chest muffle the battle music; the game-over / victory jingles stay clear
    if (this.screen === "game" && kind !== "over") audio.setMuffled(true);
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
      if (this.screen === "title") this.releaseHistory();
    });
    this.sub = m;
    markBorn();
    if (m.layer) this.nav.push(m.layer);
  }

  // ================================================================ frame
  private frame(dt: number): void {
    const t0 = performance.now();
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
    this.current?.update?.(dt);
    this.modal?.update?.(dt);
    this.sub?.update?.(dt);

    // menus over the attract game: keep its hero clear of the logo / menu
    if (this.attract) {
      const menu = this.screen === "title" || this.screen === "splash";
      const compact = COMPACT_LANDSCAPE.matches;
      const v = this.r.camera.view;
      // desktop / tablet landscape: logo + portraits on top, the menu (or TAP TO START) stacked in the centre
      // column down to ~85 % height -> the hero runs in the open meadow left of it (22 %, 62 %)
      const wide = !compact && v.w > v.h * 1.2;
      // portrait: below the centred menu (80 % height);
      // compact landscape: title = logo left, menu right -> the hero runs in the gap between them;
      // splash = key art in the middle -> the hero runs on the right
      this.attract.camOffY = menu && !compact ? (wide ? -0.12 : -0.3) * v.h : 0;
      this.attract.camOffX = !menu ? 0 : wide ? 0.28 * v.w : compact ? (this.screen === "title" ? -0.08 : -0.3) * v.w : 0;
    }
    // results: the finished run stays on screen, frozen
    const s = this.screen === "game" || this.screen === "results" ? g : this.attract;
    if (s && this.screen !== "results") s.tick(time.dt, dt);
    const r = this.r;
    // a modal / Results covers the scene: redraw it at most 30x per second (input, HUD and modals stay full rate)
    this.drawAcc += dt;
    this.drawSimAcc += time.dt;
    const throttled = !!this.modal || this.screen === "results";
    if (!throttled || this.drawAcc >= THROTTLED_DRAW) {
      r.beginFrame(this.drawAcc);
      if (s) s.draw(r.time, this.drawSimAcc, this.drawAcc);
      this.fx.update(time.dt, dt);
      this.fx.draw();
      r.endFrame();
      this.drawAcc = this.drawSimAcc = 0;
    } else this.fx.update(time.dt, dt);
    if (g && this.screen === "game") this.hud.update(g.world, dt);
    const cpu = performance.now() - t0;
    this.fpsMeter.frame(dt, cpu, s && this.fpsMeter.visible ? `en ${s.world.enemyCount} p ${this.fx.ps.count} pr ${s.world.projectiles.count} q ${this.tier}` : "");
    // quality: judge only live gameplay / attract frames (not paused, modal, settings or a fresh screen)
    if (this.aqHold > 0) this.aqHold -= dt;
    if (time.paused || this.modal || this.sub || this.aqHold > 0 || this.screen === "results") this.auto.resetWindow();
    else this.auto.sample(dt * 1000, cpu);
  }

  private gameFrame(g: Session, dt: number): void {
    const w = g.world;
    const inp = this.input;
    const cut = w.ult?.phase === "cutin";
    // the overlay follows the sim (also covers muted fast-forwards that never emit ultStart)
    if (this.cutin && !cut) this.endCutin();
    if (this.introT >= 0) this.introFrame(dt);
    const hold = this.introHold;
    const skipEdges = this.skipEdges;
    this.skipEdges = false;
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
    inp.setDashCharge(w.player.dashMax > 0 ? 1 - w.player.dashCd / w.player.dashMax : 1);

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
      } else if (w.phase === "victory" && this.endT > 7.2 && !this.modal) {
        // after the dawn celebration (view/bestiary-fx.ts: explosions -> flash at 1.7 s -> sunrise + fireworks)
        this.ended = true;
        this.openModal("over", openGameOver(this, w, true));
      }
    }
    if (!this.modal && w.phase === "play") this.tut?.frame(dt);
  }

  /** After the game-over revive. */
  revived(): void {
    this.ended = false;
    this.endT = 0;
    const b = this.game?.world.boss;
    this.music(b?.def.boss ? (b.def.boss.music ?? "boss") : "battle", 1);
  }

  /** Flash a small message at the bottom of the screen. */
  toast(msg: string): void {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    this.ui.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }

  get lastRun(): RunSummary | null {
    return this.lastSummary;
  }

  /** UI accent colour for a hero. */
  heroColor(id: string): string {
    const c = heroDef(id).color;
    return `#${c.toString(16).padStart(6, "0")}`;
  }
}
