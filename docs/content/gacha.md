# The Merch Machine (parody gacha)

EXPANSION §9. Every number here mirrors `src/meta/tuning.ts` (`TUNING.gacha`,
`TUNING.exchange`, `TUNING.rotation`); the economy pass edits the numbers there and
this copy follows. Dream Gems are only earned by playing. There is no real money
and no ads anywhere. The satire is the product.

Music: `gacha` on the Merch Machine screen. SFX ids are from `src/audio/api.ts`.

---

## 1. Banners

Four tabs. The machine itself (`ui_merch_machine`, 64×80×4: a pastel capsule
machine with a heart-shaped coin slot, a crank, glowing capsules inside, and a
small sticker reading "NOT A SLOT MACHINE") idles in the middle of every tab.

| Tab | id | Title | Subtitle | Pool | Feature |
| --- | --- | --- | --- | --- | --- |
| 1 | `permanent` | **Totally Normal Merch** | Permanent Banner | all relics + gacha heroes (SSR/UR) + unlocked gameplay heroes (SR) | none |
| 2 | `hero` | **Featured Hero** | 50% RATE-UP!! | same pool | one SSR/UR gacha hero, rotating |
| 3 | `relic` | **Featured Merch** | LIMITED EDITION (until the next limited edition) | same pool | one SSR/UR/LR relic, rotating |
| 4 | `mythic` | **Truck-kun's Isekai Express** | MYTHIC 0.0069% (nice) | same pool + Truck-kun | Truck-kun (MYTHIC), permanent, cursed |

**Cost:** 160 ♦ per pull, 1,600 ♦ for 10. A 10-pull always holds at least one SR
or better.

**Rates** (all banners): N 52% · R 30% · SR 13.5% · SSR 3.6% · UR 0.75% · LR 0.14%
· **MYTHIC 0.0069%**.

**Pity** (counters per banner type, persistent, visible):
- SSR-or-better: soft pity from pull 74 (+6 percentage points per pull), hard pity
  at 90.
- UR-or-better at 300.
- **Featured 50/50:** when an SSR-or-better drop has the featured item's rarity,
  50% it is the featured item; losing guarantees it on the next drop of that
  rarity (`LOST THE 50/50` toast + sad trombone `gachaLost5050`).
- **MYTHIC spark:** 1,000 pulls (counted across every banner) → pick any MYTHIC
  (Truck-kun or a MYTHIC relic).
- On the Isekai Express a MYTHIC drop is Truck-kun 50% (guaranteed after a loss).
  On other banners a MYTHIC drop is a MYTHIC relic.

**The curse (Isekai Express only, proposed pool rule):** every N result on this
banner is the **Traffic Cone** (an N relic). The banner art shows a single cone
on the road and the caption "It's coming." After 30 cones the cone dupes say
`Another cone. The truck is close.`

### 1.1 Featured Hero rotation (every 3 runs, counted in runs)

Rotation order (cycle index mod 3) and the banner's fake "seasonal" name per
loop (loop = floor(cycle / 3) mod 4):

| Order | Hero | Loop 0 | Loop 1 | Loop 2 | Loop 3 |
| --- | --- | --- | --- | --- | --- |
| 1 | Senpai (SSR) | "Senpai's Rooftop Banner" | "Senpai (Summer Ver.) (Same Outfit)" | "Senpai: Rerun of the Rerun" | "Senpai's Anniversary Banner (Year 0)" |
| 2 | Isekai-kun (UR) | "Isekai-kun's Overpowered Debut" | "Isekai-kun (Did He Overdo It?) Ver." | "Isekai-kun: Back by Popular Demand" | "Isekai-kun's Second Reincarnation" |
| 3 | Magical Girl #47 (SSR) | "Magical Girl #47's Banner (We Think)" | "Magical Girl #48... #47! Sorry!" | "Magical Girl #47: Finally a Banner" | "Magical Girl #47 (Name Pending) Ver." |

Banner header line while active: `BANNER ENDS IN 2 RUNS!!` (counts down 3 → 2 →
1 runs). At 1 run left the line pulses red: `LAST RUN!!! (it comes back in 6
runs)`. Tapping the countdown shows the tooltip *"Banners rotate every 3 runs.
Not real time. We would never pressure you with real time."*

Isekai-kun is UR, so on his banner the 50/50 only happens on UR drops. The
banner says so in big letters: `ISEKAI-KUN IS UR. UR PITY IS 300. WE'RE SORRY.
(WE'RE NOT.)`

### 1.2 Featured Merch rotation

The 20 SSR/UR/LR relics in this fixed order, one per 3-run cycle (looping):

| # | Relic | Rarity | Banner name |
| --- | --- | --- | --- |
| 1 | Protagonist's Scarf | SSR | "The Scarf Never Touches the Ground" |
| 2 | Limited Figure (Box Unopened) | UR | "MINT CONDITION EVENT" |
| 3 | Sakura Snow Globe | SSR | "Spring Merch Fair (It's Always Spring)" |
| 4 | Author's Original Manuscript | LR | "The Author's Draft (Signed, Sort Of)" |
| 5 | Transformation Brooch | SSR | "Henshin Accessories Week" |
| 6 | Time-Skip Clock | UR | "Two Years Later Sale" |
| 7 | Red String of Fate | SSR | "Destiny Collection" |
| 8 | Season Finale Manga | SSR | "Season Finale Merch" |
| 9 | Studio's Last Remaining Budget | LR | "Studio Clearance Sale" |
| 10 | Hot-Blooded Bandana | UR | "Hot-Blooded Summer" |
| 11 | Sentai Team Badge | SSR | "Five-Colour Fest" |
| 12 | Dramatic Wind Machine | SSR | "Windy Rooftop Exclusive" |
| 13 | Director's Cut Blu-ray | UR | "Director's Cut Edition" |
| 14 | Isekai Status Card | SSR | "Another World Week" |
| 15 | The Hero's Revival Theme | LR | "Comeback Concert" |
| 16 | Rival's Abandoned Headband | SSR | "Rivalry Week" |
| 17 | Golden Gacha Ticket | UR | "Golden Ticket Gala (Meta)" |
| 18 | Sparkle Screentone Sheet | SSR | "Manga Artist Appreciation Day" |
| 19 | Sacred Plot Device | UR | "Mystery Box Event (It's the Plot)" |
| 20 | Sakuga Animation Cel | LR | "Budget Was Found Event" |

(The current meta code picks a hash-shuffled order; replace it with this list.)

---

## 2. Pull animation storyboard (the big AAA moment)

Times are from the PULL tap. The sim is not running; everything is DOM/CSS +
sprite data URLs, 60 fps on phones (transforms and opacity only). Portrait
first: the circle sits at 40% of the screen height.

| # | Time | Beat | Visual | Audio | Text |
| --- | --- | --- | --- | --- | --- |
| 0 | — | Confirm | bottom sheet over the machine | `uiConfirm` | "Spend 1,600 ♦? (That's 1,600 ♦.)" · buttons **PULL!** / **I have regrets** |
| 1 | 0.00-1.20 s | Summon | screen dims to 70%; `ui_summon_circle` (64×64×4) scales 0 → 1.4 while rotating (2 rad/s); 40 sparkles spiral inward; the machine's crank turns | `gachaCharge` (rising), music ducks 50% | narrator caption (bottom): one random line from §6 |
| 1b | 0.30 s | Skip appears | small button top-right | — | "Skip? …fine." |
| 2 | 1.20-2.20 s | Meteor | `ui_gacha_meteor` (24×48×5) falls on a diagonal into the circle with a long trail; its frame = the pull's **best** rarity: f0 blue (N/R), f1 purple (SR), f2 gold (SSR), f3 rainbow (UR/LR), f4 glitch (MYTHIC) | `gachaMeteor` | — |
| 2b | 1.80 s | Fake-out (SSR+ only, 15%) | a blue meteor flashes and *promotes* to its real colour mid-fall | `recordScratch` then `gachaMeteor` again | "...wait." |
| 3 | 2.20 s | Impact | white flash 0.25, ring shockwave, the capsule `ui_gacha_capsule` (32×32×6, frame = colour) lands with 3 bounces | `explosion` (vol 0.6) | — |
| 4 | 2.40-3.10 s | Capsule | wobbles 3× (0.2 s each), cracks (f5), light beams in the rarity colour leak through the crack | `gachaReveal` | — |
| 5 | 3.10 s+ | Cards | 10-pull: 10 face-down cards fly to a 2×5 grid (landscape 5×2) with rarity-coloured backs (`ui_card_corner` ornaments); they flip one by one every 0.18 s | `cardFlip` per card, `gachaRevealSR` for SR | rarity badge `ui_rarity_badge` on each card |
| 6 | on any SSR+ card | Splash | the flip sequence pauses; a full-screen splash for 2.2 s: radial rays in the rarity colour, the hero portrait (f1) or relic icon (×8, pixelated) slides in on a diagonal band, the rarity title stamps in (scale 3 → 1 with shake), name types in letter by letter, flavour line under it; NEW! or ★ UP! badge | `gachaRevealSSR` (SSR) / `gachaRevealUR` (UR, LR) | rarity title (§3) |
| 7 | MYTHIC only | The game breaks (below) | | | |
| 8 | end | Summary | 10-pull summary grid: all cards with frames, NEW / ★ UP / +Copium badges; a ticker counts "+10 Copium (consolation)"; buttons **Pull ×10 again** / **Back** | `countTick` per ticker step, `payoutTotal` at the end | — |

Single pulls use the same beats with one card (no grid).

**MYTHIC sequence** (replaces beats 3-6 for the MYTHIC card; ~5.5 s; even "Skip"
plays a 1.5 s cut of it: *"You can't skip destiny."*):
1. 0.0 s: on impact the screen **cracks** (a CSS/SVG crack overlay spreading
   from the impact point), `gachaMythicGlitch`, the music **cuts** (`music("none", 0)`).
2. 0.4 s: silence. A fake system error window drops in (pixel-OS style, grey):
   ```
   ⚠ KAWAII_OVERFLOW 0xDEADBEEF
   The Merch Machine has stopped responding.
   Cause: too much luck.
   [ Wait ]  [ Close the program ]
   ```
   Both buttons just continue. Auto-continues after 1.6 s.
3. 2.0 s: the window glitches (RGB split, jitter, scanlines) and shatters.
4. 2.3 s: everything explodes into rainbow confetti (200 pieces), `gachaMythicBoom`,
   white flash (fade if Reduce flashing). Narrator caption, screaming:
   `NARRATOR: AAAAAAAAAAAAAAAAAAAAAAA`
5. 3.0 s: the MYTHIC title stamps in over a glitching rainbow band, the item
   (Truck-kun's portrait f1 / the relic icon) slams in, `voiceBlip` ×3.
6. 5.5 s: music resumes with the gacha theme's MYTHIC sting variant. Achievement
   toast "Whale-Sized Luck".

---

## 3. Rarity reveal titles

Shown on the splash (SSR+) and as the card subtitle (N-SR). One title per rarity,
one subtitle picked at random.

| Rarity | Title | Subtitles |
| --- | --- | --- |
| N | **N — NORMIE** | "It's... merchandise." · "Technically an item." · "Character building!" · "Someone has to pull these." |
| R | **R — RARE (ISH)** | "Rarer than N. That's the bar." · "A respectable pull." · "Mum would be proud. Mildly." |
| SR | **SR — SUPER RARE!** | "Super! Rare! (Super Common Actually)" · "A little sparkle." · "The purple meteor remembers you." |
| SSR | **SSR — SUPER SUPER RARE!!** | "THE GOLD HAS CHOSEN YOU" · "This is your main character moment." · "Somewhere, a pity counter weeps." |
| UR | **UR — ULTRA RARE!!!** | "THE RAINBOW HAS DESCENDED" · "Scientists Baffled By This Pull" · "Screenshot this. Now." |
| LR | **LR — LEGENDARY RARE!!!!** | "Historians Will Write About This Pull" · "The Prophecy Was True (There Was a Prophecy?)" · "Your Ancestors Are Cheering" |
| MYTHIC | **MYTHIC — 0.0069% — NICE** | "YOU HAVE BROKEN THE GAME" · "THIS WAS NOT SUPPOSED TO HAPPEN" · "The Merch Machine Requires a Moment" |

Badge colours (`ui_rarity_badge` frames 0-6): N grey `g`, R blue `u`, SR violet
`i`, SSR gold `y/Y`, UR rainbow (frame has a baked rainbow gradient), LR crimson
and gold `R/Y`, MYTHIC glitch (black with RGB-split letters).

---

## 4. The fine print (deliberately far too long)

Opened from a tiny `ⓘ Rates & fine print` link under the PULL buttons. A
scrolling sheet, Silkscreen 9 px, with a scroll bar that gets **smaller** the
further you scroll. All banners show the common block; banner blocks first.

**Permanent banner block**
1. This banner is permanent. Like your commitment to it.
2. "Totally Normal" refers to the merch, not to the odds, the machine, or you.

**Featured Hero block**
1. When an SSR-or-better drop matches the featured hero's rarity, there is a 50% chance it is the featured hero.
2. Losing the 50/50 guarantees the featured hero on the next drop of that rarity. The trombone is free.
3. The featured hero changes every 3 runs. BANNER ENDS SOON!! (It always ends soon. It also always comes back.)
4. Isekai-kun is UR. On his banner, the 50/50 happens on UR drops. Yes, that's rarer. Yes, we know.

**Featured Merch block**
1. When an SSR-or-better drop matches the featured relic's rarity, there is a 50% chance it is the featured relic.
2. Losing the 50/50 guarantees it next time. The relic is not limited. The edition is.

**Isekai Express block**
1. Truck-kun can only be obtained here, or from the 1,000-pull spark. Truck-kun cannot be bought. Truck-kun finds YOU.
2. When a MYTHIC drops here there is a 50% chance it is Truck-kun. Losing that 50/50 guarantees Truck-kun on the next MYTHIC.
3. Every N result on this banner is a Traffic Cone. This is not a bug. This is foreshadowing.
4. Expected MYTHIC drops per 1,600 Dream Gems: 0.00069. Please do not do the math.
5. Side effects of this banner may include hope, despair, hope again, and an urge to look both ways before crossing the street.

**Common block (every banner)**
1. Rates: N 52% · R 30% · SR 13.5% · SSR 3.6% · UR 0.75% · LR 0.14% · MYTHIC 0.0069% (nice). They add up to 99.9969%. The missing 0.0031% is N. It's always N.
2. Rates shown are the rates. Rates not shown are also rates.
3. Soft pity begins at pull 74, at which point the machine starts to feel bad for you.
4. Hard pity: pull 90 is always SSR or better. The machine is legally required to stop laughing at that point.
5. UR pity: pull 300 without a UR or better is a UR or better. We checked with the lawyers twice. They are also plushies.
6. A 10-pull always contains at least one SR or better. The other nine are character building.
7. Pity is kept per banner type and carries across rotations. Pity is the only thing that carries across anything.
8. The MYTHIC spark counts pulls on every banner. After 1,000 pulls you may pick any MYTHIC. This is the only promise we keep.
9. Every pull earns 1 Copium. Copium is not a medical product. Do not inhale Copium. (You will inhale Copium.)
10. Dupes become relic stars or hero constellations, up to ★6 / C6. Past that they become Copium. The circle of life.
11. Gameplay heroes appear in the pool as SR only after you unlock them. You cannot pull a hero you haven't met. That would be weird.
12. Dream Gems have no real-world value. Neither does this banner, emotionally speaking.
13. Money you would have spent in real life: $0. We checked. Twice. We were very surprised.
14. The meteor colour shows the best rarity of the pull. Sometimes a blue meteor becomes gold. This is called "hope" and it is a mechanic.
15. Skipping the animation does not change the result. Watching it does not change the result either. Nothing changes the result.
16. The "I have regrets" button does not refund regrets.
17. Tapping the machine does not improve the odds. We counted. You tapped it 4,000 times.
18. The narrator's screaming during a MYTHIC pull is not a malfunction. The narrator is fine. The narrator is not fine.
19. No plushies were harmed in the making of this banner. Several were sold.
20. By pulling you agree that you read all of this. You did not. Nobody does. That is the joke.
21. If you have read this far: hello. Here is a secret. There is no secret. (Scrolling to the very bottom does unlock the hidden achievement "Read The Fine Print".)

---

## 5. Results copy

### 5.1 LOST THE 50/50 (toast + `gachaLost5050`, one random line)
- "LOST THE 50/50. The featured hero waves at you from the banner."
- "LOST THE 50/50. Have you considered: it builds character?"
- "LOST THE 50/50. Next one's guaranteed. Probably. (Definitely. It's in the code.)"
- "LOST THE 50/50. The trombone player has been waiting all day for this."
- "LOST THE 50/50. It's okay. Senpai didn't notice you either."
- "LOST THE 50/50. Statistically, this was a coin flip. Emotionally, it was a betrayal."
- "LOST THE 50/50. Please hold. Your guarantee is important to us."
- "LOST THE 50/50. The relic you got instead would like you to know it has feelings."
- "LOST THE 50/50. Fun fact: the 50/50 is 50/50."
- "LOST THE 50/50. Truck-kun saw that. Truck-kun is sorry."
- "LOST THE 50/50. Remember: Copium is a renewable resource."
- "LOST THE 50/50. This toast will self-destruct in 3... 2... (it won't)."

Won the 50/50: "WON THE 50/50!! Don't tell the others." · "WON THE 50/50! The trombone player goes home early."

### 5.2 Dupes and star-ups (animated `★ UP!`, `starUp` / `gachaDupe`)
- Relic star-up: `★ UP! <Relic> is now ★3!` subtitle: "The same merch, but more."
- Relic at ★6: `MAX ★! <Relic> is fully upgraded.` subtitle: "Further copies become Copium. We're sorry. We're not."
- Relic overflow: `<Relic> ★MAX → +60 Copium` subtitle: "Inhale deeply."
- Hero constellation: `C2 UNLOCKED — Rerun Banner Edition` + the effect line, the portrait flashes and the hero does the cast pose.
- Hero at C6: `FULLY AWAKENED (FINAL FORM)` subtitle: "Until next season's final form."
- Hero overflow: `<Hero> C6 → +200 Copium` subtitle: "They're flattered. Truly."
- New item: `NEW!` badge; new hero: `NEW HERO! <name> has joined the cast!` then the OC bio card slides up for 2 s.

### 5.3 Narrator captions during the summon (one per pull)
"The Merch Machine hums ominously." · "Somewhere, a pity counter ticks." · "This
is the one. (Narrator has said this 400 times.)" · "Ten pulls. Ten dreams. Nine
N's, probably." · "The capsule is warm. That's a good sign. It is not a sign." ·
"Our hero spends gems they earned honestly." · "Previously on the Merch Machine:
an N." · "Hold the crank with both hands. It doesn't help. It looks cool." · "The crank turns. Destiny
turns with it. Slightly." · "Narrator is not allowed to pull. Narrator is very
jealous."

---

## 6. Copium Exchange

A shop tab next to the banners. Prices in Copium (`TUNING.exchange`). The shop
keeper is the machine's speaker grille making a smile shape.

| Item | Price | Card copy |
| --- | --- | --- |
| **Pull Voucher** (160 ♦ worth of pull) | 120 | "One pull's worth of gems. Exchanged at a rate we call 'generous'." |
| **Pity Insurance** (+10 pity on one banner, never past 89) | 150 | "Skip ten pulls of suffering. Suffering not included." |
| Choose an N relic | 30 | "Every legend starts with a bent spoon." |
| Choose an R relic | 70 | "Slightly rarer cope." |
| Choose an SR relic | 180 | "Purple, on purpose." |
| Choose an SSR relic | 600 | "Gold, without the gacha. Feels illegal." |
| Choose a UR relic | 1,600 | "The rainbow, purchased. The rainbow is disappointed in you." |
| Choose an LR relic | 3,600 | "Legendary, by appointment." |
| Choose an SR hero copy (unlocked gameplay heroes only: +1 constellation) | 400 | "A constellation for your favourite. They noticed." |
| Senpai / Magical Girl #47 (SSR) | 1,400 | "He still won't notice you. But he's yours." / "Her name is... on the receipt." |
| Isekai-kun (UR) | 3,800 | "He's so overpowered he was in the shop by accident." |
| MYTHIC items | — | Greyed out: "MYTHICs cannot be bought. They can only be endured (1,000-pull spark)." |

Buying a copy works exactly like pulling it (dupe → star / constellation →
overflow Copium). Header: `Copium: 1,234 (do not inhale)`.

**Gem Exchange** (a tiny button in the currency bar): `1,000 ★ → 10 ♦` with the
confirm text *"Terrible rate! Truly awful! Do it anyway?"* → **Yes** / **I value
my coins**.

---

## 7. Pity and banner UI copy

- Pity bar under the PULL buttons: `Pity 63 / 90` with a tooltip *"The machine
  starts feeling bad for you at 74."*
- From pull 74: the bar glows pink and reads `SOFT PITY ACTIVE — the machine feels bad for you`.
- At 89: `NEXT PULL: SSR OR BETTER. (The machine has no choice.)`
- UR pity line: `UR pity 211 / 300 (patience is a rarity too)`.
- Guarantee flag (after a lost 50/50): a gold ribbon `GUARANTEED featured on the next <rarity>!`
- Spark meter (all banners): `Spark 412 / 1,000 — at 1,000 you pick any MYTHIC.`
  At 1,000: the meter turns rainbow: `SPARK READY! Choose your destiny.`
  (opens a picker of all MYTHICs; Truck-kun's card honks when tapped).
- Not enough gems: button greyed, text `Need 1,600 ♦ (you have 1,140 ♦). Play
  an episode? It pays!` → **Go Play** / **Okay**.
- History tab (last 100 pulls): rows `#1,204 · SSR · Protagonist's Scarf · ★2 ·
  Featured Merch`, N rows in grey, MYTHIC rows with a glitch shimmer.
- Stats tab: Pulls · Gems "spent" · N streak record · 50/50s won / lost · Copium
  earned · **Money you would have spent IRL: $0 (we checked)** · Most-pulled
  item ("Your most loyal N").
- Welcome gift (v1 migration): a gift box on the machine: `WELCOME TO SEASON 2!
  Here's a free 10-pull. (It's 1,600 ♦. We're not made of gems.)`
