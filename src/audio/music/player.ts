/**
 * Lookahead music scheduler for one compiled song.
 *
 * The engine calls update(now, horizon) every ~25 ms (or in one go for offline
 * renders); every event whose start falls before `horizon` is created with exact
 * AudioContext times, so timing never depends on the JS timer jitter.
 *
 * Intensity layers: channels with `layer > 0` switch on at the next bar line
 * once the (smoothed) intensity crosses their threshold, and fade out slowly
 * (with hysteresis and a minimum hold) when it drops.
 */
import { Voice, type Kit } from "../synth";
import { DRUM, INST } from "./inst";
import type { CSection, CSong } from "./song";

export interface MusicDests {
  dry: AudioNode;
  rev: AudioNode;
  dly: AudioNode;
}

interface Chan {
  input: GainNode;
  layerGain: GainNode;
  layer: number;
  on: boolean;
  /** notes at or after this time are played while on */
  since: number;
  /** while off, notes before this time still play (fade-out tail) */
  offAt: number;
  holdUntil: number;
  nodes: AudioNode[];
}

const HYST = 0.1;
const HOLD = 6;

export class Player {
  readonly dry: GainNode;
  readonly rev: GainNode;
  readonly dly: GainNode;
  readonly song: CSong;
  private readonly spb: number;
  private readonly barSec: number;
  private chans: Chan[] = [];
  private oi = 0;
  private ei = 0;
  private secStart: number;
  private target = 0;
  private smooth = 0;
  private lastNow: number;
  /** stop scheduling after this time (fade-out) */
  stopAt = Infinity;
  finished = false;
  /** when a non-looping song's last section ends */
  doneAt = Infinity;

  constructor(
    private readonly kit: Kit,
    song: CSong,
    dests: MusicDests,
    start: number,
    fadeIn: number,
    intensity: number,
  ) {
    const ctx = kit.ctx;
    this.song = song;
    this.spb = 60 / song.def.bpm;
    this.barSec = this.spb * song.bpb;
    this.secStart = start;
    this.lastNow = start;
    this.target = this.smooth = intensity;
    const vol = song.def.vol ?? 1;
    const mk = (dest: AudioNode, g: number) => {
      const n = ctx.createGain();
      n.gain.value = 0;
      n.gain.setValueAtTime(0, Math.max(0, start - 0.001));
      if (fadeIn > 0.01) n.gain.linearRampToValueAtTime(g, start + fadeIn);
      else n.gain.setValueAtTime(g, start);
      n.connect(dest);
      return n;
    };
    this.dry = mk(dests.dry, vol);
    this.rev = mk(dests.rev, vol);
    this.dly = mk(dests.dly, vol);
    const layered = !!song.def.layered;
    for (const c of song.def.channels) {
      const input = ctx.createGain();
      input.gain.value = c.vol ?? 1;
      const layerGain = ctx.createGain();
      const layer = layered ? (c.layer ?? 0) : 0;
      const on = layer <= 0 || intensity >= layer;
      layerGain.gain.value = on ? 1 : 0;
      input.connect(layerGain);
      const nodes: AudioNode[] = [input, layerGain];
      let tail: AudioNode = layerGain;
      if (c.pan && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = c.pan;
        tail.connect(p);
        tail = p;
        nodes.push(p);
      }
      tail.connect(this.dry);
      if (c.rev) {
        const s = ctx.createGain();
        s.gain.value = c.rev;
        tail.connect(s).connect(this.rev);
        nodes.push(s);
      }
      if (c.dly) {
        const s = ctx.createGain();
        s.gain.value = c.dly;
        tail.connect(s).connect(this.dly);
        nodes.push(s);
      }
      this.chans.push({ input, layerGain, layer, on, since: -Infinity, offAt: -Infinity, holdUntil: 0, nodes });
    }
  }

  get delaySeconds(): number {
    return (this.song.def.delayBeats ?? 0.75) * this.spb;
  }

  setIntensity(x: number): void {
    this.target = Math.max(0, Math.min(1, x));
  }

  /** Fade everything out over `sec` and stop scheduling afterwards. */
  fadeOut(now: number, sec: number): void {
    const end = now + Math.max(0.02, sec);
    for (const g of [this.dry, this.rev, this.dly]) {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, end);
    }
    this.stopAt = Math.min(this.stopAt, end);
  }

  private section(): CSection | null {
    return this.song.order[this.oi] ?? null;
  }

  private nextBar(t: number): number {
    const k = Math.ceil((t - this.secStart) / this.barSec - 1e-6);
    return this.secStart + k * this.barSec;
  }

  private updateLayers(now: number): void {
    if (!this.song.def.layered) return;
    const dt = Math.max(0, now - this.lastNow);
    this.lastNow = now;
    this.smooth += (this.target - this.smooth) * (1 - Math.exp(-dt / 1.1));
    const x = this.smooth;
    for (const c of this.chans) {
      if (c.layer <= 0) continue;
      if (!c.on && x >= c.layer) {
        // enter on the next bar line after the already-scheduled window
        const at = this.nextBar(now + 0.2);
        c.on = true;
        c.since = at;
        c.holdUntil = at + HOLD;
        const g = c.layerGain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.setTargetAtTime(0, now, 0.05);
        g.setValueAtTime(0, at - 0.004);
        g.linearRampToValueAtTime(1, at + 0.004);
      } else if (c.on && x < c.layer - HYST && now > c.holdUntil) {
        c.on = false;
        c.offAt = now + 2.5;
        const g = c.layerGain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.setTargetAtTime(0, now, 0.55);
      }
    }
  }

  /** Schedule every event starting before `horizon`. */
  update(now: number, horizon: number): void {
    if (this.finished) return;
    this.updateLayers(now);
    const h = Math.min(horizon, this.stopAt);
    for (let guard = 0; guard < 64; guard++) {
      const sec = this.section();
      if (!sec) {
        this.finished = true;
        this.doneAt = Math.min(this.doneAt, this.secStart);
        return;
      }
      const ev = sec.ev;
      while (this.ei < ev.length) {
        const e = ev[this.ei];
        const at = this.secStart + e.t * this.spb;
        if (at >= h) return;
        this.ei++;
        if (at < now - 0.03) continue; // fell behind (stalled thread): skip, never burst
        const c = this.chans[e.ch];
        if (c.on ? at < c.since - 1e-4 : at >= c.offAt) continue;
        this.play(e.ch, e.m, e.d, at, e.dur * this.spb, e.v, c);
      }
      const end = this.secStart + sec.beats * this.spb;
      if (end >= h) return;
      this.secStart = end;
      this.ei = 0;
      this.oi++;
      if (this.oi >= this.song.order.length) {
        if (this.song.loopTo < 0) {
          this.finished = true;
          this.doneAt = end;
          return;
        }
        this.oi = this.song.loopTo;
      }
    }
  }

  private play(ch: number, m: number, d: string | undefined, at: number, len: number, vel: number, c: Chan): void {
    const def = this.song.def.channels[ch];
    const v = new Voice(this.kit, c.input, at);
    if (d) DRUM[d as keyof typeof DRUM]?.(v, vel, len);
    else INST[def.inst]?.(v, m, len, vel);
  }

  /** Time (absolute) the current scheduling cursor's section started; for tests. */
  get cursor(): { section: string; start: number } {
    return { section: this.section()?.name ?? "", start: this.secStart };
  }

  dispose(): void {
    for (const c of this.chans) for (const n of c.nodes) n.disconnect();
    this.dry.disconnect();
    this.rev.disconnect();
    this.dly.disconnect();
    this.chans = [];
    this.finished = true;
  }
}
