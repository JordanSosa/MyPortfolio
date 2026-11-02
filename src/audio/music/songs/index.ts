import type { MusicTrack } from "../../api";
import type { SongDef } from "../song";
import { battle } from "./battle";
import { boss } from "./boss";
import { final } from "./final";
import { gameover } from "./gameover";
import { shop } from "./shop";
import { title } from "./title";
import { victory } from "./victory";

export const SONGS: Record<Exclude<MusicTrack, "none">, SongDef> = {
  title,
  battle,
  boss,
  final,
  victory,
  gameover,
  shop,
  // Season 2 tracks start as stand-ins (docs/EXPANSION.md); the audio agent composes a song for each.
  hub: shop,
  gacha: title,
  candy: battle,
  academy: battle,
  beach: battle,
  finale: battle,
  boss_candy: boss,
  boss_academy: boss,
  boss_beach: boss,
  boss_finale: final,
  cancel: final,
};
