/**
 * App state machine + main loop.
 *
 *   splash ("tap to start", unlocks audio) -> title (attract-mode game behind)
 *   -> select -> game <-> level-up / chest / pause modals -> game over / victory
 *   -> results -> title.  Dream Shop and Settings hang off the title.
 *
 * One Renderer / Fx / Input for the whole app. The current Session (real run
 * or attract) is stepped with the global `time` (hitstop, slow-mo, pause).
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
import { AutoQuality, guessTier, QUALITY, Renderer, type QualityTier } from "../render";
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
import type { RunSummary } from "../game/world";

export type ScreenId = "splash" | "title" | "select" | "game" | "results" | "shop";

/** Same condition as the compact landscape layouts in styles.css. */
const COMPACT_LANDSCAPE = window.matchMedia("(orientation: landscape) and (max-height: 520px)");

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
  /** The ultimate cut-in overlay on screen (removed when the sim starts the ult). */
  private cutin: CutinHandle | null = null;
  private unlocked = false;

  constructor(readonly params: DebugParams) {
    const s = save.data.settings;
    this.tier = params.quality ?? (s.quality !== "auto" ? s.quality : guessTier());
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
      } else if (this.unlocked) audio.resume();
    };
    // any pointer use hides the keyboard focus ring
    window.addEventListener("pointerdown", () => this.nav.pointerUsed(), { capture: true });
    // first gesture anywhere unlocks audio (splash, or deep-linked screens)
    const unlock = () => this.unlockAudio();
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
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
      if (s.quality !== "auto" && s.quality !== this.tier) this.auto.set(s.quality);
    } else this.auto.enabled = false;
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
    this.screen = id;
    this.current = scr;
    markBorn();
    if (scr?.layer) this.nav.push(scr.layer);
    this.hud.show(id === "game");
    this.input.showTouchControls(false);
  }

  goTitle(): void {
    this.endGame();
    if (!this.attract) this.startAttract();
    this.setScreen("title", showTitle(this));
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

  /** Begin a run with `hero`. */
  startRun(hero: string): void {
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
    this.setScreen("game", null);
    if (this.params.skip > 0) this.game.skip(this.params.skip);
    // first few runs: how to play
    if (save.data.runs < 3 && !this.params.autoplay) {
      const touch = this.input.lastDevice === "touch";
      this.hud.hint(
        touch
          ? "<b>DRAG ANYWHERE</b> TO MOVE\nATTACKS ARE AUTOMATIC!"
          : this.input.lastDevice === "gamepad"
            ? "<b>STICK</b> MOVE · <b>A</b> DASH · <b>B</b> OVERDRIVE\nATTACKS ARE AUTOMATIC!"
            : "<b>WASD</b> MOVE · <b>SPACE</b> DASH · <b>E</b> OVERDRIVE\nATTACKS ARE AUTOMATIC!",
      );
    }
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
      cutin: (heroId: string, name: string) => {
        this.cutin?.end();
        this.cutin = showCutin(document.body, heroId, heroDef(heroId).portrait, name);
      },
      cutinEnd: () => {
        this.cutin?.end();
        this.cutin = null;
      },
    };
  }

  private endGame(): void {
    if (this.sub) {
      this.nav.remove(this.sub.layer);
      this.sub.close();
      this.sub = null;
    }
    if (this.modal) this.closeModal();
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
    this.input.showTouchControls(false);
    this.setScreen("results", showResults(this, summary));
    this.music(summary.victory ? "victory" : "gameover", 1);
  }

  retry(): void {
    this.startRun(this.hero);
  }

  // ================================================================ modals
  openModal(kind: string, m: UiScreen): void {
    if (this.modal) this.closeModal();
    this.modal = m;
    this.modalKind = kind;
    markBorn();
    if (m.layer) this.nav.push(m.layer);
    time.paused = true;
    this.input.showTouchControls(false);
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
    time.paused = false;
    audio.setMuffled(false);
    this.hud.setModalOpen(false);
  }

  pause(): void {
    if (this.screen !== "game" || !this.game || this.modal || this.game.world.phase !== "play") return;
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
    const m = openSettings(this, () => {
      this.nav.remove(m.layer);
      m.close();
      this.sub = null;
      if (under) under.el.style.visibility = "";
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
    if (this.screen === "game" && g) this.gameFrame(g, dt);
    this.current?.update?.(dt);
    this.modal?.update?.(dt);
    this.sub?.update?.(dt);

    // title: frame the attract hero below the centred menu (the compact landscape layout
    // puts logo + menu side by side, so the hero can stay centred there)
    if (this.attract) {
      const stacked = this.screen === "title" && !COMPACT_LANDSCAPE.matches;
      this.attract.camOffY = stacked ? -0.3 * this.r.camera.view.h : 0;
    }
    // results: the finished run stays on screen, frozen
    const s = this.screen === "game" || this.screen === "results" ? g : this.attract;
    if (s && this.screen !== "results") s.tick(time.dt, dt);
    const r = this.r;
    r.beginFrame(dt);
    if (s) s.draw(r.time, time.dt, dt);
    this.fx.update(time.dt, dt);
    this.fx.draw();
    r.endFrame();
    if (g && this.screen === "game") this.hud.update(g.world, dt);
    const cpu = performance.now() - t0;
    this.fpsMeter.frame(dt, cpu, s && this.fpsMeter.visible ? `en ${s.world.enemyCount} p ${this.fx.ps.count} pr ${s.world.projectiles.count} q ${this.tier}` : "");
    this.auto.sample(dt * 1000);
  }

  private gameFrame(g: Session, dt: number): void {
    const w = g.world;
    const inp = this.input;
    if (!this.modal) {
      if (!this.params.autoplay) {
        w.input.mx = inp.move.x;
        w.input.my = inp.move.y;
        if (inp.pressed("dash")) w.input.dash = true;
        if (inp.pressed("ult")) {
          if (w.ultReady) w.input.ult = true;
          else if (!w.ult && w.phase === "play") {
            inp.deny("ult");
            this.sfx("uiDeny", 0.6);
          }
        }
      }
      if (inp.pressed("pause")) {
        inp.consume("pause");
        this.pause();
      }
    }
    // touch controls + meters
    const playing = w.phase === "play" && !this.modal;
    if (inp.touchControlsWanted !== playing) inp.showTouchControls(playing);
    inp.setUltCharge(w.ultMeter / CFG.ultMax, w.ultReady);
    inp.setDashCharge(w.player.dashMax > 0 ? 1 - w.player.dashCd / w.player.dashMax : 1);

    // level-up flow: hitstop/fx happen on the event; ease time to 0.2x then open the modal
    if (w.phase !== "play" && this.lvIntro >= 0) {
      this.lvIntro = -1;
      time.easeTo(1, 0.2);
    }
    if (!this.modal && w.phase === "play") {
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
      if (w.phase === "dead" && this.endT > 1.4 && !this.modal) {
        this.ended = true;
        this.openModal("over", openGameOver(this, w, false));
        this.music("gameover", 0.8);
      } else if (w.phase === "victory" && this.endT > 7.2 && !this.modal) {
        // after the dawn celebration (view/bestiary-fx.ts: explosions -> flash at 1.7 s -> sunrise + fireworks)
        this.ended = true;
        this.openModal("over", openGameOver(this, w, true));
      }
    }
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
