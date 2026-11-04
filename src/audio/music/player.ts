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
 *
 * Degrade ("budget cuts", songs with `degrade`): setDegrade(x) takes effect on
 * the next bar line. It can swap the arrangement (degrade tiers: a new order
 * starts at that bar), gates `deg`-ranged channels per note, and drives a lo-fi
 * chain on this player's dry bus:
 *   dry -> high-pass -> low-pass (telephone band) -> clean + bitcrush mix -> tape-wow delay -> drop-out gate -> out
 * plus reverb / delay send cuts, flat + jittery per-note detune, and (near 1)
 * skipped notes and short drop-outs. Without a setDegrade call the song's `auto`
 * steps drive it.
 */
import { curve, Voice, type Kit } from "../synth";
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

interface Lofi {
  hp: BiquadFilterNode;
  lp: BiquadFilterNode;
  clean: GainNode;
  crush: GainNode;
  wow: DelayNode;
  wowDepth: GainNode;
  flutDepth: GainNode;
  gate: GainNode;
  revCut: GainNode;
  dlyCut: GainNode;
  lfos: OscillatorNode[];
  nodes: AudioNode[];
}

/** tape-wow delay base (s): the LFO swings the delay time around it */
const WOW_BASE = 0.012;

export class Player {
  /** Notes skipped because the scheduler fell behind (diagnostics). */
  skipped = 0;
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
  /** the arrangement being played (the song's order, or a degrade tier's) */
  private ord: CSection[];
  private loopTo: number;
  private tier = 0;
  /** pending arrangement switch (bar-aligned) */
  private pend: { at: number; tier: number } | null = null;
  /** degrade value changes [time, value] (ascending) and the last value scheduled */
  private degSteps: { t: number; v: number }[] = [];
  private degLast = 0;
  private manual = false;
  private auto: { t: number; v: number }[] = [];
  private ai = 0;
  private lofi: Lofi | null = null;
  private readonly lofiAmt: number;
  private gateNext: number;
  /** deterministic pseudo-random state (note skips, detune jitter, drop-outs) */
  private seed = 0x6d2b79f5;

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
    this.ord = song.order;
    this.loopTo = song.loopTo;
    this.spb = 60 / song.def.bpm;
    this.barSec = this.spb * song.bpb;
    this.secStart = start;
    this.gateNext = start;
    this.lastNow = start;
    const dg = song.def.degrade;
    this.lofiAmt = Math.max(0, Math.min(1, dg?.lofi ?? 1));
    if (dg?.auto) this.auto = dg.auto.map(([bars, v]) => ({ t: start + bars * this.barSec, v })).sort((a, b) => a.t - b.t);
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
    if (dg) {
      this.lofi = this.buildLofi(dests, start);
      this.dry = mk(this.lofi.hp, vol);
      this.rev = mk(this.lofi.revCut, vol);
      this.dly = mk(this.lofi.dlyCut, vol);
    } else {
      this.dry = mk(dests.dry, vol);
      this.rev = mk(dests.rev, vol);
      this.dly = mk(dests.dly, vol);
    }
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

  /** Debug / mix analysis: scale one channel's level (0 = mute). Not used by the game. */
  setChannelGain(id: string, g: number): void {
    const i = this.song.def.channels.findIndex((c) => c.id === id);
    const c = this.chans[i];
    if (c) c.input.gain.value = (this.song.def.channels[i].vol ?? 1) * Math.max(0, g);
  }

  /** Channel ids of this song (debug / mix analysis). */
  get channelIds(): string[] {
    return this.song.def.channels.map((c) => c.id);
  }

  /** Budget cuts 0..1 (songs with `degrade` only): lands on the next bar line; ends auto mode. */
  setDegrade(x: number, now: number): void {
    if (!this.song.def.degrade) return;
    this.manual = true;
    this.applyDegrade(x, this.nextBar(Math.max(now, this.secStart) + 0.2));
  }

  /** The degrade value in effect at time t. */
  degAt(t: number): number {
    const st = this.degSteps;
    for (let i = st.length - 1; i >= 0; i--) if (st[i].t <= t + 1e-4) return st[i].v;
    return 0;
  }

  private rnd(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private tierFor(x: number): number {
    let k = 0;
    this.song.tiers.forEach((t, i) => {
      if (x >= t.at - 1e-6) k = i + 1;
    });
    return k;
  }

  private applyDegrade(x: number, at: number): void {
    x = Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
    if (Math.abs(x - this.degLast) < 1e-4) return;
    this.degLast = x;
    // keep the list short: drop steps superseded before `at`
    while (this.degSteps.length > 1 && this.degSteps[1].t <= at - 2) this.degSteps.shift();
    while (this.degSteps.length && this.degSteps[this.degSteps.length - 1].t >= at - 1e-4) this.degSteps.pop();
    this.degSteps.push({ t: at, v: x });
    const tier = this.tierFor(x);
    if (tier !== (this.pend?.tier ?? this.tier)) this.pend = tier === this.tier ? null : { at, tier };
    this.lofiAt(x * this.lofiAmt, at);
  }

  private buildLofi(dests: MusicDests, start: number): Lofi {
    const ctx = this.kit.ctx;
    const nyq = ctx.sampleRate * 0.45;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 25;
    hp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(18000, nyq);
    lp.Q.value = 0.9;
    const clean = ctx.createGain();
    const crushWs = ctx.createWaveShaper();
    crushWs.curve = curve(this.kit, "lofi");
    const crush = ctx.createGain();
    crush.gain.value = 0;
    const wow = ctx.createDelay(0.05);
    wow.delayTime.value = WOW_BASE;
    const gate = ctx.createGain();
    const revCut = ctx.createGain();
    const dlyCut = ctx.createGain();
    hp.connect(lp);
    lp.connect(clean).connect(wow);
    lp.connect(crushWs).connect(crush).connect(wow);
    wow.connect(gate).connect(dests.dry);
    revCut.connect(dests.rev);
    dlyCut.connect(dests.dly);
    // tape wow (slow) + flutter (fast) modulate the delay time = pitch warble
    const lfos: OscillatorNode[] = [];
    const mod = (rate: number): GainNode => {
      const o = ctx.createOscillator();
      o.frequency.value = rate;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g).connect(wow.delayTime);
      o.start(start);
      lfos.push(o);
      return g;
    };
    const wowDepth = mod(0.55);
    const flutDepth = mod(6.3);
    return { hp, lp, clean, crush, wow, wowDepth, flutDepth, gate, revCut, dlyCut, lfos, nodes: [hp, lp, clean, crushWs, crush, wow, wowDepth, flutDepth, gate, revCut, dlyCut] };
  }

  /** Lo-fi chain targets for amount k (0..1) from time `at`. */
  private lofiAt(k: number, at: number): void {
    const L = this.lofi;
    if (!L) return;
    const nyq = this.kit.ctx.sampleRate * 0.45;
    const set = (p: AudioParam, v: number, tc = 0.03) => {
      p.cancelScheduledValues(at);
      p.setTargetAtTime(v, at, tc);
    };
    set(L.lp.frequency, Math.min(nyq, 18000 * Math.pow(2600 / 18000, Math.pow(k, 0.7))));
    set(L.hp.frequency, 25 + 380 * k * k);
    const cr = k < 0.5 ? 0 : (k - 0.5) * 0.8;
    set(L.crush.gain, cr);
    set(L.clean.gain, 1 - cr * 0.6);
    set(L.wowDepth.gain, 0.0042 * k * k, 0.4);
    set(L.flutDepth.gain, 0.00016 * k, 0.4);
    set(L.revCut.gain, 1 - 0.75 * k, 0.1);
    set(L.dlyCut.gain, 1 - 0.8 * k, 0.1);
  }

  /** Rushed-ending drop-outs: a few short gaps per bar while the lo-fi amount is near 1. */
  private gates(h: number): void {
    const L = this.lofi;
    if (!L) return;
    while (this.gateNext < h + 0.3) {
      const t = this.gateNext;
      this.gateNext += this.barSec;
      if (this.degAt(t) * this.lofiAmt < 0.85) continue;
      const g = L.gate.gain;
      const step = this.spb / 2;
      for (let k = 1; k < 8; k++) {
        if (this.rnd() > 0.1) continue;
        const a = t + k * step;
        const b = a + step * (this.rnd() < 0.5 ? 0.5 : 1);
        g.setValueAtTime(1, a);
        g.linearRampToValueAtTime(0.0, a + 0.006);
        g.setValueAtTime(0.0, b - 0.006);
        g.linearRampToValueAtTime(1, b);
      }
    }
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
    return this.ord[this.oi] ?? null;
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
    while (!this.manual && this.ai < this.auto.length && this.auto[this.ai].t < h + 0.25) {
      const s = this.auto[this.ai++];
      this.applyDegrade(s.v, s.t);
    }
    this.gates(h);
    const chDefs = this.song.def.channels;
    for (let guard = 0; guard < 64; guard++) {
      const sec = this.section();
      if (!sec) {
        this.finished = true;
        this.doneAt = Math.min(this.doneAt, this.secStart);
        return;
      }
      const ev = sec.ev;
      const p = this.pend;
      while (this.ei < ev.length) {
        const e = ev[this.ei];
        const at = this.secStart + e.t * this.spb;
        if (p && at >= p.at - 1e-4) break; // the arrangement switches first
        if (at >= h) return;
        this.ei++;
        if (at < now - 0.03) {
          this.skipped++; // fell behind (stalled thread): skip, never burst
          continue;
        }
        const c = this.chans[e.ch];
        if (c.on ? at < c.since - 1e-4 : at >= c.offAt) continue;
        const dr = chDefs[e.ch].deg;
        if (dr) {
          const x = this.degAt(at);
          if (x < dr[0] - 1e-6 || x >= dr[1] - 1e-6) continue;
        }
        this.play(e.ch, e.m, e.d, at, e.dur * this.spb, e.v, c);
      }
      const end = this.secStart + sec.beats * this.spb;
      if (p && p.at < end - 1e-4) {
        // budget cuts: the new arrangement starts at the switch bar
        if (p.at >= h) return;
        this.pend = null;
        this.tier = p.tier;
        const t = p.tier > 0 ? this.song.tiers[p.tier - 1] : null;
        this.ord = t ? t.order : this.song.order;
        this.loopTo = t ? t.loopTo : this.song.loopTo;
        this.oi = 0;
        this.ei = 0;
        this.secStart = p.at;
        continue;
      }
      if (end >= h) return;
      this.secStart = end;
      this.ei = 0;
      this.oi++;
      if (this.oi >= this.ord.length) {
        if (this.loopTo < 0) {
          this.finished = true;
          this.doneAt = end;
          return;
        }
        this.oi = this.loopTo;
      }
    }
  }

  private play(ch: number, m: number, d: string | undefined, at: number, len: number, vel: number, c: Chan): void {
    const def = this.song.def.channels[ch];
    if (this.lofi && !d) {
      // budget cuts: everything drifts flat and out of tune; near 1 some notes simply don't get animated
      const k = this.degAt(at) * this.lofiAmt;
      if (k > 0) {
        if (k >= 0.85 && this.rnd() < 0.12) return;
        m += -0.3 * k + (this.rnd() - 0.5) * 0.32 * k;
      }
    }
    const v = new Voice(this.kit, c.input, at);
    if (d) DRUM[d as keyof typeof DRUM]?.(v, vel, len);
    else INST[def.inst]?.(v, m, len, vel);
  }

  /** Time (absolute) the current scheduling cursor's section started; for tests. */
  get cursor(): { section: string; start: number } {
    return { section: this.section()?.name ?? "", start: this.secStart };
  }

  dispose(): void {
    if (this.lofi) {
      for (const o of this.lofi.lfos) {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
        o.disconnect();
      }
      for (const n of this.lofi.nodes) n.disconnect();
      this.lofi = null;
    }
    for (const c of this.chans) for (const n of c.nodes) n.disconnect();
    this.dry.disconnect();
    this.rev.disconnect();
    this.dly.disconnect();
    this.chans = [];
    this.finished = true;
  }
}
