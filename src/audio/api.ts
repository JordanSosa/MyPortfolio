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
  // ---- Season 2 (docs/EXPANSION.md). Every id has bespoke synthesis (src/audio/sfx-s2.ts). Usage notes:
  //  payoutTick / starUp / talentUp: pass `pitch` rising line by line / card by card / rank by rank.
  //  gacha pull (gacha.md storyboard): gachaCharge (1.2 s riser) -> gachaMeteor (falls ~0.5 s, lands) ->
  //    gachaReveal / SR / SSR / UR by best rarity. MYTHIC: gachaMythicGlitch + music("none", 0) at impact
  //    (stutter, tape-stop, error "bonk-bonk" by ~0.75 s, then dead air), gachaMythicBoom >= 0.8 s later
  //    (storyboard: 2.3 s; it carries the narrator's scream), then music("gacha_mythic").
  //  gachaLost5050 = the sad trombone (~2.7 s). recordScratch fits the SSR fake-out ("...wait.").
  //  narratorSting = "DUN DUN DUNNN" (~2 s; episode cards, results). nani (vol 0.7) / baka (pitch -3, vol 0.5 for "...baka ♡").
  //  toBeContinued = the freeze-frame riff (~2.9 s; it sits in E over the gameover track's A minor).
  //  honk: gap 0.2 s, so "HONK-HONK" 0.25 s apart plays both. lightstick is unpitched (fires on any stage's beat).
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
  // ---- Season 2 additions from docs/content: cassetteEject = satire.md §4 "DROPPED AFTER EPISODE n" quit;
  //  schoolChime = stages.md `schoolBell` event (an original 7-note campus chime, ~3 s); whistle = Hall Monitor's dash.
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
  // ---- Season 2: hub + gacha + per-stage battle and boss themes ("cancel" = the series-finale boss).
  //  Stage themes run at the StageDef.bpm of docs/content/stages.md (candy 150, academy 136, beach 128, finale 160)
  //  and their boss themes at the same tempo; hub / gacha are not layered (menus never set the intensity).
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
  /** Crossfade to a track (fade seconds, default 1). Same track = no-op. music("none", 0) is a hard cut (shared reverb / delay tails are silenced too). */
  music(track: MusicTrack, fade?: number): void;
  /** Battle intensity 0..1 - adds/removes musical layers (drums, arps, lead). */
  setIntensity(x: number): void;
  /**
   * OPTIONAL (Season 2): series-finale "budget cuts" 0..1 for the current track. Only tracks with a
   * degrade arrangement react (`cancel`): 0 = full production; >= 0.34 "Ratings Drop" (choir, brass and
   * bells laid off, cheaper lead / strings); >= 0.6 "Budget Cuts" (the hub theme as hold music: organ,
   * preset bossa, telephone band, detune); >= 0.9 "Rushed Ending" (hurried, bitcrush, tape wow,
   * drop-outs). The lo-fi processing follows the value continuously, so e.g. Cancel-sama's phases map
   * to 0 / 0.34 / 0.67 / 1. Changes land on the next bar line. Every track change resets it; until the
   * first call after a track change, `cancel` degrades on its own (auto: ~30 s / 54 s / 81 s).
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
