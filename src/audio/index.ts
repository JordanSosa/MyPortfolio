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
 *   makeReverb), the noise buffers on first use (synth kitFor), and a music() call
 *   within MUSIC_DEFER_MS of the unlock compiles its song one macrotask later.
 */
import type { AudioAPI, MusicTrack, SfxId, SfxOpts } from "./api";
import { Engine } from "./engine";

export type { AudioAPI, MusicTrack, SfxId, SfxOpts } from "./api";

const TICK_MS = 25;
/** music() this soon after the context was created (the unlock gesture) is deferred one macrotask. */
const MUSIC_DEFER_MS = 50;
const GESTURES = ["pointerup", "touchend", "click", "keydown", "mousedown"] as const;

type Ctor = new (opts?: AudioContextOptions) => AudioContext;

class RealtimeAudio implements AudioAPI {
  private ctx: AudioContext | null = null;
  private engine: Engine | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private failed = false;
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
    let ctx: AudioContext;
    try {
      ctx = new C({ latencyHint: "interactive" });
    } catch {
      ctx = new C();
    }
    this.ctx = ctx;
    this.createdAt = now();
    const onState = () => {
      if (ctx.state === "running") this.everRunning = true;
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
      this.engine = new Engine(ctx);
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
      if (ctx && !this.wantSuspended && ctx.state !== "running") this.kick();
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

  /** Switch the engine to this.track; right after the unlock gesture the song compile waits a macrotask. */
  private startMusic(fade: number): void {
    this.musicFade = fade;
    if (now() - this.createdAt < MUSIC_DEFER_MS) {
      if (!this.musicTimer)
        this.musicTimer = setTimeout(() => {
          this.musicTimer = null;
          this.playTrack(this.musicFade);
        }, 0);
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

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

const impl = new RealtimeAudio();

export const audio: AudioAPI = impl;

/** Debug access (test bench). Not part of the game contract. */
export function audioInternals(): { ctx: AudioContext | null; engine: Engine | null } {
  return impl.internals;
}
