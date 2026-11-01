/**
 * PLACEHOLDER no-op implementation of the audio contract.
 * Owner: audio agent replaces the internals (keep the `audio` export + AudioAPI shape).
 */
import type { AudioAPI } from "./api";
export type { AudioAPI, MusicTrack, SfxId, SfxOpts } from "./api";

export const audio: AudioAPI = {
  unlocked: false,
  unlock() {},
  sfx() {},
  music() {},
  setIntensity() {},
  setMuffled() {},
  duck() {},
  setVolumes() {},
  suspend() {},
  resume() {},
};
