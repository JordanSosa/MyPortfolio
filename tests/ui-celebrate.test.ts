/**
 * QA2 batch B (B9): unlock celebrations are grouped - one kind 3+ times at once is ONE card, a sequence is
 * at most four cards (the last one sums up the rest) - and every kind has its own narrator pool.
 */
import { describe, expect, test } from "vitest";
import { unlockCards } from "../src/ui/hub/celebrate";
import { unlockGroupTitle, unlockNarration } from "../src/ui/hub/copy";
import { NARRATOR, TAGLINES } from "../src/ui/hub/copy-data";
import type { UnlockEvent } from "../src/meta/unlocks";

const ev = (kind: UnlockEvent["kind"], id: string, start = false): UnlockEvent => ({ kind, id, name: id.toUpperCase(), hint: `hint ${id}`, start });

describe("unlockCards", () => {
  test("the first Dream Meadow clear (stage + 6 twists + 2 others) is at most 4 cards, the twists on one", () => {
    const list = [ev("stage", "candy_kingdom"), ...["a", "b", "c", "d", "e", "f"].map((t) => ev("twist", t)), ev("weapon", "w1"), ev("relic", "r1")];
    const cards = unlockCards(list);
    expect(cards.length).toBeLessThanOrEqual(4);
    const tw = cards.find((c) => c.kind === "twist");
    expect(tw?.items.length).toBe(6);
    expect(cards.flatMap((c) => c.items).length).toBe(list.length);
  });

  test("start content is never celebrated; two of a kind stay single cards", () => {
    const cards = unlockCards([ev("hero", "hoshi", true), ev("weapon", "w1"), ev("weapon", "w2")]);
    expect(cards.map((c) => [c.kind, c.items.length])).toEqual([
      ["weapon", 1],
      ["weapon", 1],
    ]);
  });

  test("more than four cards: three shown, the fourth sums up the rest", () => {
    const list = [ev("hero", "h1"), ev("weapon", "w1"), ev("passive", "p1"), ev("relic", "r1"), ev("stage", "s1"), ev("twist", "t1")];
    const cards = unlockCards(list);
    expect(cards.length).toBe(4);
    expect(cards[3].kind).toBe("mixed");
    expect(cards[3].items.map((u) => u.id)).toEqual(["r1", "s1", "t1"]);
  });
});

describe("unlock copy", () => {
  test("every kind has its own narrator pool and a twist never gets the hero line", () => {
    for (const k of ["Hero", "Weapon", "Passive", "Relic", "Twist", "Stage"]) expect(NARRATOR[`unlock${k}`]?.length).toBeGreaterThan(0);
    const heroLine = "A new character joins the cast! Ratings are up!";
    for (let i = 0; i < 20; i++) {
      for (const k of ["twist", "weapon", "relic", "passive", "stage"]) expect(unlockNarration(k, k)).not.toBe(heroLine);
    }
    expect(unlockGroupTitle("twist", 6)).toBe("6 NEW PLOT TWISTS!");
    expect(unlockGroupTitle("mixed", 3)).toBe("3 MORE UNLOCKS!");
  });

  test("no tagline repeats the SEASON 2 badge it sits next to", () => {
    for (const t of TAGLINES) expect(t).not.toMatch(/season\s*2/i);
  });
});
