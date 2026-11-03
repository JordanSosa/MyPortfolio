/**
 * Audio contract (FROZEN - the game calls only this). Implementation lives in
 * src/audio/index.ts (owner: audio). All sound is synthesised at runtime with
 * WebAudio - no audio files.
 */

export type SfxId =
  // UI
  | "uiMove" | "uiConfirm" | "uiBack" | "uiDeny" | "cardFlip" | "cardPick" | "reroll" | "countTick"
  // player
  | "dash" | "playerHurt" | "playerDie" | "heal" | "levelUp" | "evolve" | "revive"
  | "ultReady" | "ultCutin" | "ultBlast" | "voiceBlip"
  // pickups
  | "gem" | "coin" | "magnet" | "chestDrop" | "chestOpen" | "chestReel" | "chestJackpot" | "food" | "powerup"
  // combat
  | "hit" | "hitCrit" | "enemyDie" | "eliteDie" | "bossHit" | "bossDie"
  | "explosion" | "explosionBig" | "thunder" | "enemyShoot" | "telegraph" | "freeze" | "propBreak"
  // weapons
  | "starShot" | "slash" | "boomerang" | "bell" | "candyThrow" | "bubblePop" | "beam" | "beamBig" | "meow" | "orbitHit"
  // events
  | "warning" | "bossRoar" | "comboUp" | "comboBreak" | "rankUp" | "waveIncoming" | "victory" | "gameOver"
  // ---- Season 2 (docs/EXPANSION.md). Added as aliases of similar sounds; the audio agent gives each its own synthesis.
  // hub / meta progression
  | "hubOpen" | "tabSwitch" | "nodeBuy" | "nodeDeny" | "talentUp" | "heroLevelUp" | "masteryUp" | "unlockFanfare"
  | "achievement" | "payoutTick" | "payoutTotal" | "currencyGain" | "equip"
  // gacha
  | "gachaCharge" | "gachaMeteor" | "gachaReveal" | "gachaRevealSR" | "gachaRevealSSR" | "gachaRevealUR"
  | "gachaMythicGlitch" | "gachaMythicBoom" | "gachaDupe" | "gachaLost5050" | "starUp"
  // satire stingers
  | "narratorSting" | "nani" | "baka" | "recordScratch" | "toBeContinued"
  // new weapons / heroes / stages
  | "honk" | "missile" | "fanSmack" | "teacup" | "sparkleCharm" | "transform" | "fireball" | "boba" | "paperCrane"
  | "lightstick" | "snore" | "glitch" | "splash" | "crunch"
  // ---- Season 2 additions from docs/content (satire.md §4 "DROPPED" quit, stages.md schoolBell, enemies.md Hall Monitor)
  | "cassetteEject" | "schoolChime" | "whistle";

export interface SfxOpts {
  /** 0..1 multiplier (default 1) */
  vol?: number;
  /** pitch shift in semitones (default 0). `gem` uses this to climb with combo. */
  pitch?: number;
  /** stereo pan -1..1 (e.g. from screen x) */
  pan?: number;
}

export type MusicTrack =
  | "none" | "title" | "battle" | "boss" | "final" | "victory" | "gameover" | "shop"
  // ---- Season 2: hub + gacha + per-stage battle and boss themes ("cancel" = the series-finale boss)
  | "hub" | "gacha"
  | "candy" | "academy" | "beach" | "finale"
  | "boss_candy" | "boss_academy" | "boss_beach" | "boss_finale" | "cancel"
  /** gacha.md MYTHIC beat 6: a rainbow fanfare intro, then the regular gacha loop */
  | "gacha_mythic";

export interface AudioAPI {
  /** Must be called from a user gesture (first tap/click/key). Safe to call repeatedly. */
  unlock(): void;
  readonly unlocked: boolean;
  /** Fire-and-forget sound. Implementations rate-limit identical sfx (e.g. max ~1 'hit' per 30ms) and cap voices. */
  sfx(id: SfxId, opts?: SfxOpts): void;
  /** Crossfade to a track (fade seconds, default 1). Same track = no-op. */
  music(track: MusicTrack, fade?: number): void;
  /** Battle intensity 0..1 - adds/removes musical layers (drums, arps, lead). */
  setIntensity(x: number): void;
  /**
   * OPTIONAL (Season 2): series-finale "budget cuts" 0..1 for the current track. Only tracks with a
   * degrade arrangement react (`cancel`): 0 = full production, ~0.34 "Ratings Drop" (choir and brass
   * laid off), ~0.67 "Budget Cuts" (hold-music organ, telephone band, detune), 1 "Rushed Ending"
   * (bitcrush, tape wow, drop-outs). Changes land on the next bar line. Every track change resets it;
   * until the first call after a track change, `cancel` degrades on its own over time (auto mode).
   */
  setDegrade?(x: number): void;
  /** Muffle music (low-pass) e.g. while paused or picking an upgrade. */
  setMuffled(on: boolean): void;
  /** Duck music by `amount` (0..1) for `seconds` (big hits, ult cut-in). */
  duck(amount: number, seconds: number): void;
  /** Volumes 0..1 */
  setVolumes(v: { master?: number; music?: number; sfx?: number }): void;
  /** Pause/resume the whole audio context (tab hidden, app paused). */
  suspend(): void;
  resume(): void;
}
