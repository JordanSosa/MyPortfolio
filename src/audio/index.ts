/**
 * Realtime implementation of the audio contract (src/audio/api.ts).
 *
 * - The AudioContext is created lazily inside unlock() (a user gesture). On iOS
 *   Safari the context is resumed inside the gesture and a 1-sample silent buffer
 *   is played; if the context is still (or again) suspended / "interrupted"
 *   (phone call, Siri, tab switch), the next tap/click/key re-unlocks it.
 * - Every call is safe before unlock (sfx = no-op, music/volumes are remembered)
 *   and when WebAudio is missing entirely (silent fallback). Nothing here throws.
 * - The unlock gesture stays short on a phone CPU: it only creates + resumes the
 *   context and plays the 1-sample kick. The node graph (Engine) is built one
 *   macrotask later, the reverb impulses in later macrotasks still (fxchain
 *   makeReverb: ~0.9 / 1.3 s later, idle slots), the noise buffers on first use
 *   (synth kitFor), and a music() call within FIRST_MUSIC_MS of the unlock starts
 *   (compiles + schedules its song) FIRST_MUSIC_MS after it: past the ~300 ms
 *   screen transition the tap starts (splash -> hub slide-in); its fade-in hides
 *   the wait.
 */
import type { AudioAPI, MusicTrack, SfxId, SfxOpts } from "./api";
import { Engine, MAX_VOICES, MAX_VOICES_LITE } from "./engine";

export type { AudioAPI, MusicTrack, SfxId, SfxOpts } from "./api";

const TICK_MS = 25;
/** The first music after the context was created (the unlock gesture) starts no sooner than this. */
const FIRST_MUSIC_MS = 750;
const GESTURES = ["pointerup", "touchend", "click", "keydown", "mousedown"] as const;

type Ctor = new (opts?: AudioContextOptions) => AudioContext;

class RealtimeAudio implements AudioAPI {
  private ctx: AudioContext | null = null;
  private engine: Engine | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private failed = false;
  /** Phone audio profile (wantLite). */
  private lite = false;
  private lastTick = 0;
  private stress = 0;
  private hooked = false;
  private wantSuspended = false;
  private everRunning = false;
  private vols: { master?: number; music?: number; sfx?: number } = {};
  private track: MusicTrack = "none";
  private intensity = 0;
  private muffled = false;
  /** performance.now() when the context was created; a pending deferred music() call. */
  private createdAt = -1e9;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private musicFade = 1;

  get unlocked(): boolean {
    return this.everRunning;
  }

  /** for the test bench / debug overlay */
  get internals(): { ctx: AudioContext | null; engine: Engine | null } {
    return { ctx: this.ctx, engine: this.engine };
  }

  /** Read-only diagnostics snapshot (see audioStats). */
  stats(): AudioStats {
    const ctx = this.ctx;
    const e = this.engine;
    let drops = 0;
    let started = 0;
    if (e) {
      for (const k in e.budgetDrops) drops += e.budgetDrops[k as SfxId] ?? 0;
      for (const k in e.started) started += e.started[k as SfxId] ?? 0;
    }
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    let voices = 0;
    try {
      voices = e ? e.activeVoices : 0;
    } catch {
      /* ignore */
    }
    return {
      state: this.failed ? "failed" : ctx ? ctx.state : "none",
      sampleRate: ctx ? ctx.sampleRate : 0,
      baseLatency: num(ctx?.baseLatency),
      outputLatency: num((ctx as (AudioContext & { outputLatency?: number }) | null)?.outputLatency),
      // (before the unlock gesture: the profile the context will be created with)
      lite: ctx ? this.lite : wantLite(),
      unlocked: this.everRunning,
      wantSuspended: this.wantSuspended,
      engine: !!e,
      voices,
      maxVoices: this.lite ? MAX_VOICES_LITE : MAX_VOICES,
      stress: this.stress,
      skippedNotes: e ? e.skippedNotes : 0,
      budgetDrops: drops,
      started,
      track: this.track,
      muffled: this.muffled,
      lookahead: e ? e.lookahead : 0,
    };
  }

  unlock(): void {
    if (this.failed) return;
    try {
      if (!this.ctx) this.create();
      if (!this.ctx) return;
      this.kick();
      this.hookGestures();
    } catch (e) {
      console.warn("[audio] unlock failed", e);
    }
  }

  private create(): void {
    if (typeof window === "undefined") {
      this.failed = true; // Node / tests: silent
      return;
    }
    const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
    const C = w.AudioContext ?? w.webkitAudioContext;
    if (!C) {
      this.failed = true;
      return;
    }
    this.lite = wantLite();
    // Phones: half the sample rate (half the synthesis cost; plenty for chiptune on a phone speaker) and
    // bigger buffers ('playback') so a busy frame does not underrun into static. Desktop keeps the full
    // rate and the lowest latency.
    const tries: AudioContextOptions[] = this.lite
      ? [{ latencyHint: "playback", sampleRate: 24000 }, { latencyHint: "playback" }, {}]
      : [{ latencyHint: "interactive" }, {}];
    let ctx: AudioContext | null = null;
    for (const o of tries) {
      try {
        ctx = new C(o);
        break;
      } catch {
        /* try the next, simpler option set */
      }
    }
    if (!ctx) {
      this.failed = true;
      return;
    }
    this.ctx = ctx;
    this.createdAt = now();
    const onState = () => {
      if (ctx.state === "running") {
        this.everRunning = true;
        return;
      }
      // The system suspended or interrupted us (Android audio focus: a notification sound, another
      // app, an output-device switch; iOS: a call). We did not ask for it, the page is visible and
      // the player has interacted (sticky activation), so resume() is allowed without a new gesture:
      // retry shortly instead of staying silent until the next tap.
      if (ctx.state !== "closed" && this.everRunning && !this.wantSuspended && typeof document !== "undefined" && document.visibilityState === "visible") {
        setTimeout(() => {
          if (this.ctx === ctx && ctx.state !== "running" && ctx.state !== "closed" && !this.wantSuspended) ctx.resume().catch(() => {});
        }, 300);
      }
    };
    ctx.addEventListener?.("statechange", onState);
    onState();
    // the node graph is built one macrotask later: the gesture only creates + resumes the context
    // (sfx before that are no-ops, music / volumes are remembered and applied then)
    setTimeout(() => this.build(ctx), 0);
  }

  /** Build the engine (node graph) for the context created in the unlock gesture. */
  private build(ctx: AudioContext): void {
    if (this.ctx !== ctx || this.engine) return;
    try {
      this.engine = new Engine(ctx, { lite: this.lite });
    } catch (e) {
      console.warn("[audio] engine init failed", e);
      this.failed = true;
      this.engine = null;
      try {
        void ctx.close();
      } catch {
        /* ignore */
      }
      this.ctx = null;
      return;
    }
    const eng = this.engine;
    eng.setVolumes({ master: this.vols.master ?? 1, music: this.vols.music ?? 1, sfx: this.vols.sfx ?? 1 });
    eng.setIntensity(this.intensity);
    eng.setMuffled(this.muffled);
    if (this.track !== "none") this.startMusic(0.3);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.engine || ctx.state !== "running") return;
    // Main-thread stress from late timer ticks (the timer asks for TICK_MS; a busy game frame delays it):
    // rise fast, fall slowly, so a crowded fight keeps the sfx budget squeezed until it calms down.
    const t = now();
    const gap = this.lastTick > 0 ? t - this.lastTick : TICK_MS;
    this.lastTick = t;
    const target = Math.max(0, Math.min(1, (gap - 45) / 120));
    this.stress = target > this.stress ? this.stress + (target - this.stress) * 0.5 : this.stress * 0.97;
    this.engine.setStress(this.stress);
    try {
      this.engine.tick(ctx.currentTime);
    } catch (e) {
      console.warn("[audio] tick failed", e);
    }
  }

  /** resume() + the iOS silent-buffer trick; must run inside a gesture to be effective */
  private kick(): void {
    const ctx = this.ctx;
    if (!ctx || this.wantSuspended) return;
    if (ctx.state !== "running") {
      try {
        const p = ctx.resume();
        p?.then(() => {
          if (ctx.state === "running") this.everRunning = true;
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    }
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {
      /* ignore */
    }
  }

  private hookGestures(): void {
    if (this.hooked) return;
    this.hooked = true;
    const retry = () => {
      const ctx = this.ctx;
      if (!ctx) return;
      // A gesture on a visible page means the player is here: clear any stale suspend request
      // (a blur / hide whose matching focus / show event never arrived, common in Android
      // WebViews and embedded frames) and bring the context back.
      if (this.wantSuspended && typeof document !== "undefined" && document.visibilityState === "visible") this.wantSuspended = false;
      if (!this.wantSuspended && ctx.state !== "running") this.kick();
    };
    for (const ev of GESTURES) window.addEventListener(ev, retry, { capture: true, passive: true });
  }

  private get live(): Engine | null {
    const ctx = this.ctx;
    return ctx && this.engine && ctx.state === "running" ? this.engine : null;
  }

  sfx(id: SfxId, opts?: SfxOpts): void {
    const e = this.live;
    if (!e) return;
    try {
      e.sfx(id, opts);
    } catch (err) {
      console.warn("[audio] sfx failed", id, err);
    }
  }

  music(track: MusicTrack, fade = 1): void {
    if (track === this.track) return;
    this.track = track;
    if (this.engine) this.startMusic(fade);
  }

  /** Switch the engine to this.track; right after the unlock gesture the song waits until FIRST_MUSIC_MS. */
  private startMusic(fade: number): void {
    this.musicFade = fade;
    const wait = this.createdAt + FIRST_MUSIC_MS - now();
    if (wait > 0) {
      // (a later music() call inside the wait just changes this.track: the timer plays the latest one)
      if (!this.musicTimer)
        this.musicTimer = setTimeout(() => {
          this.musicTimer = null;
          this.playTrack(this.musicFade);
        }, wait);
      return;
    }
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    this.playTrack(fade);
  }

  private playTrack(fade: number): void {
    try {
      this.engine?.music(this.track, fade);
    } catch (e) {
      console.warn("[audio] music failed", this.track, e);
    }
  }

  setIntensity(x: number): void {
    this.intensity = x;
    this.engine?.setIntensity(x);
  }

  setDegrade(x: number): void {
    try {
      this.engine?.setDegrade(x);
    } catch {
      /* ignore */
    }
  }

  setMuffled(on: boolean): void {
    this.muffled = on;
    try {
      this.engine?.setMuffled(on);
    } catch {
      /* ignore */
    }
  }

  duck(amount: number, seconds: number): void {
    const e = this.live;
    if (!e) return;
    try {
      e.duck(amount, seconds);
    } catch {
      /* ignore */
    }
  }

  setVolumes(v: { master?: number; music?: number; sfx?: number }): void {
    this.vols = { ...this.vols, ...v };
    try {
      this.engine?.setVolumes(v);
    } catch {
      /* ignore */
    }
  }

  suspend(): void {
    this.wantSuspended = true;
    const ctx = this.ctx;
    if (!ctx || ctx.state === "closed") return;
    try {
      ctx.suspend().catch(() => {});
    } catch {
      /* ignore */
    }
  }

  resume(): void {
    this.wantSuspended = false;
    this.kick();
  }
}

/**
 * The phone audio profile: touch-first devices (coarse pointer) or Android / iOS user agents.
 * `?audio=full` / `?audio=lite` override it (testing).
 */
function wantLite(): boolean {
  try {
    const q = new URLSearchParams(location.search).get("audio");
    if (q === "full") return false;
    if (q === "lite") return true;
    if (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) return true;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

const impl = new RealtimeAudio();

export const audio: AudioAPI = impl;

/** Debug access (test bench). Not part of the game contract. */
export function audioInternals(): { ctx: AudioContext | null; engine: Engine | null } {
  return impl.internals;
}

/** Audio diagnostics (dev console, Settings "Copy diagnostics"). Read-only. */
export interface AudioStats {
  /** AudioContext state ("running", "suspended", "interrupted", "closed"), "none" before unlock, "failed" without WebAudio. */
  state: string;
  sampleRate: number;
  /** Seconds (null where the browser does not report it). */
  baseLatency: number | null;
  outputLatency: number | null;
  /** Phone profile (24 kHz, 'playback' latency, fewer voices). */
  lite: boolean;
  unlocked: boolean;
  wantSuspended: boolean;
  engine: boolean;
  voices: number;
  maxVoices: number;
  /** Main-thread stress 0..1 (late scheduler ticks). */
  stress: number;
  /** Music notes skipped because the scheduler fell behind. */
  skippedNotes: number;
  /** Low-priority sfx triggers dropped by the voice budget / voices started (since unlock). */
  budgetDrops: number;
  started: number;
  track: MusicTrack;
  muffled: boolean;
  /** Music scheduling lookahead (s). */
  lookahead: number;
}

/** Read-only audio diagnostics snapshot (never throws, never changes audio state). */
export function audioStats(): AudioStats {
  return impl.stats();
}
