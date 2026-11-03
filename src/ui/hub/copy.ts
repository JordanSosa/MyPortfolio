/**
 * Line pickers over the satire bible (copy-data.ts): no line repeats within
 * the last 10 picks of the same pool (docs/content/satire.md header), and the
 * placeholders ({hero}, {stage}, {boss}, {n}, {time}, {kills}, {weapon}) are
 * filled in. Plus the hub's own short UI copy (satire.md §8).
 */
import { BOSS_DEATH_LINES, DEATH_LINES, EPISODE_TITLES, GRADE_COMMENTS, NARRATOR, NEXT_TIME, SPEEDRUN_DEATH, TAGLINES, TIPS } from "./copy-data";

const recent = new Map<string, string[]>();

/** Pick from `list` avoiding the last 10 picks of `pool`. */
export function pick(pool: string, list: readonly string[]): string {
  if (!list.length) return "";
  const r = recent.get(pool) ?? [];
  const fresh = list.filter((x) => !r.includes(x));
  const from = fresh.length ? fresh : list;
  const v = from[Math.floor(Math.random() * from.length) % from.length];
  r.push(v);
  if (r.length > 10) r.shift();
  recent.set(pool, r);
  return v;
}

export interface Fill {
  hero?: string;
  stage?: string;
  boss?: string;
  n?: number;
  time?: string;
  kills?: number;
  weapon?: string;
}

/** Fill the bible's placeholders. */
export function fill(s: string, f: Fill): string {
  return s.replace(/\{(hero|stage|boss|n|time|kills|weapon)\}/g, (m, k: keyof Fill) => {
    const v = f[k];
    return v === undefined ? m : typeof v === "number" ? v.toLocaleString("en-US") : v;
  });
}

/** "Episode N: <title>" title for a run start (stage titles weighted x2 on their stage). */
export function episodeTitle(stage: string, f: Fill): string {
  const any = EPISODE_TITLES[""] ?? [];
  const own = EPISODE_TITLES[stage] ?? [];
  return fill(pick("episode", [...any, ...own, ...own]), f);
}

/** "Next time on Kira Kira Overdrive: ..." */
export function nextTimeLine(clear: boolean, f: Fill): string {
  const list = NEXT_TIME.filter((l) => !l.only || l.only === (clear ? "C" : "D")).map((l) => l.t);
  return fill(pick("next", list), f);
}

/** TO BE CONTINUED subtitle: speedrun < 10 s, the killing boss's line, else a generic one. */
export function deathLine(time: number, bossName: string | undefined, f: Fill): string {
  if (time < 10) return SPEEDRUN_DEATH;
  if (bossName) {
    // (registry names and the bible's keys differ in case / length: "CANCEL-SAMA", "Summer Festival Firework Dragon")
    const low = bossName.toLowerCase();
    const key = BOSS_DEATH_LINES[bossName] ? bossName : Object.keys(BOSS_DEATH_LINES).find((k) => k.toLowerCase() === low || low.includes(k.toLowerCase()));
    if (key) return BOSS_DEATH_LINES[key];
  }
  return fill(pick("death", DEATH_LINES), f);
}

export function gradeComment(grade: string): string {
  return pick(`grade:${grade}`, GRADE_COMMENTS[grade] ?? []);
}

export function narratorLine(moment: keyof typeof NARRATOR | string, f: Fill): string {
  return fill(pick(`narr:${moment}`, NARRATOR[moment] ?? []), f);
}

export function tip(): string {
  // (the bible's lines start with "Tip:"; the home footer already labels them TIP)
  return pick("tip", TIPS).replace(/^Tip:\s*/i, "");
}

/** One tagline per boot. */
export const TAGLINE = TAGLINES[Math.floor(Math.random() * TAGLINES.length) % Math.max(1, TAGLINES.length)] ?? "";

/** Hub buttons (satire.md §8). */
export const MENU_SUB = {
  play: "Next Episode!",
  board: "Get stronger. Montage optional.",
  heroes: "The cast (and their bios)",
  gacha: "Totally normal shopping",
  wiki: "Fan-edited. Probably wrong.",
  settings: "Behind-the-scenes",
} as const;

/**
 * The season's five episodes (docs/EXPANSION.md §10) - only for stage cards of
 * stages the content wave has not registered yet ("UNLOCKS AFTER: <name>").
 * Registered stages always use their own StageInfo.
 */
export const SEASON: readonly { order: number; id: string; name: string }[] = [
  { order: 1, id: "dream_meadow", name: "Dream Meadow" },
  { order: 2, id: "candy_kingdom", name: "Candy Kingdom" },
  { order: 3, id: "shoujo_academy", name: "Shoujo Academy" },
  { order: 4, id: "beach_episode", name: "Beach Episode" },
  { order: 5, id: "final_arc", name: "The Final Arc" },
];

/** Satire unlock celebration titles (satire.md §8). */
export const UNLOCK_TITLE: Readonly<Record<string, string>> = {
  hero: "NEW HERO JOINS THE CAST!",
  weapon: "NEW WEAPON UNLOCKED!",
  passive: "NEW PASSIVE UNLOCKED!",
  stage: "NEW STAGE AIRING NOW!",
  twist: "NEW PLOT TWIST!",
  relic: "NEW MERCH!",
};
