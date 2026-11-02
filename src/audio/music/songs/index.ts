import type { MusicTrack } from "../../api";
import type { SongDef } from "../song";
import { battle } from "./battle";
import { boss } from "./boss";
import { final } from "./final";
import { gameover } from "./gameover";
import { shop } from "./shop";
import { title } from "./title";
import { victory } from "./victory";

export const SONGS: Record<Exclude<MusicTrack, "none">, SongDef> = { title, battle, boss, final, victory, gameover, shop };
