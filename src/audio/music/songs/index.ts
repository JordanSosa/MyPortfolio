import type { MusicTrack } from "../../api";
import type { SongDef } from "../song";
import { academy } from "./academy";
import { battle } from "./battle";
import { beach } from "./beach";
import { boss } from "./boss";
import { bossAcademy } from "./boss-academy";
import { bossBeach } from "./boss-beach";
import { bossCandy } from "./boss-candy";
import { bossFinale } from "./boss-finale";
import { cancel } from "./cancel";
import { candy } from "./candy";
import { final } from "./final";
import { finale } from "./finale";
import { gacha, gachaMythic } from "./gacha";
import { gameover } from "./gameover";
import { hub } from "./hub";
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
  // Season 2 (docs/EXPANSION.md, docs/content/stages.md): every track is its own composition
  hub,
  gacha,
  gacha_mythic: gachaMythic,
  candy,
  academy,
  beach,
  finale,
  boss_candy: bossCandy,
  boss_academy: bossAcademy,
  boss_beach: bossBeach,
  boss_finale: bossFinale,
  cancel,
};
