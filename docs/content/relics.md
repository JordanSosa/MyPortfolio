# Relics ("Merch")

61 relics (EXPANSION §8): N 12 · R 14 · SR 12 · SSR 10 · UR 6 · LR 4 · MYTHIC 3.
Equipped before a run (1 slot, up to 4 from the board; one copy of each relic).
Stars ★0-★6 come from gacha dupes; dupes past ★6 become Copium
(`TUNING.gacha.overflowCopium`). One relic group file per rarity in
`src/game/relics/` (`RelicDef`: `id, name, rarity, icon, flavor, desc(stars),
mods?, install?`).

**Hook** = how it is implemented, using `src/game/hooks.ts`:
`stat` (`mods(s, stars)`), `state` (a `w.statMods` entry reading run state),
`kill`, `hit`, `hurt`, `lethal`, `levelUp`, `dash`, `ult`, `ultEnd`, `pickup`,
`chest`, `bossKill`, `every N s` (`w.every`), `step`, `runStart` (inside
`install`). Relic damage uses channel `CH_RELIC` and source = relic id.

**Values ★0..★6** lists the effect number at each star, in order. `desc(stars)`
prints the card text with that star's number(s). Icons are 16×16
`icon_relic_<id>` (owner `s2-items`), drawn as merch: a 1-px rarity-coloured
glint pixel in the top-right corner (N grey, R blue, SR violet, SSR gold, UR
rainbow, LR crimson-gold, MYTHIC glitch).

---

## N — "Normie" (12): small stats

| id | Name | Hook | Effect | Values ★0..★6 | Icon | Flavour |
| --- | --- | --- | --- | --- | --- | --- |
| `bent_spoon` | Slightly Bent Spoon | stat | +X% might | 3/4/5/6/7/8/9 | a silver spoon bent 30°, one sparkle | "Bent by psychic powers. Or a drawer." |
| `knockoff_keychain` | Knockoff Plushie Keychain | stat | +X max HP | 6/8/10/12/14/16/18 | a lopsided pink bear keychain with mismatched eyes | "The tag says 'Kawai Bare'." |
| `sticker_sheet` | Half-Used Sticker Sheet | stat | +X% area | 3/4/5/6/7/8/9 | a sticker sheet, half the star stickers missing | "The good stickers are gone. They're always gone." |
| `expired_energy_drink` | Expired Energy Drink | stat | +X% move speed | 4/5/6/7/8/9/10 | a can with a lightning bolt and "EXP" stamp | "Best before: last season." |
| `empty_capsule` | Empty Gacha Capsule | stat | +X% luck | 5/6.5/8/9.5/11/12.5/14 | a two-tone capsule, open and empty, one sad sparkle | "It was empty. It's still the luckiest thing you own." |
| `wiki_printout` | Printed-Out Fan Wiki Page | stat | +X% XP | 4/5/6/7/8/9/10 | a printed page with highlighter streaks | "Contains spoilers. Also typos." |
| `convention_lanyard` | Convention Lanyard | stat | +X% pickup range | 8/10/12/14/16/18/20 | a lanyard with a "STAFF?" badge | "Not technically staff. Nobody has asked." |
| `used_bandage` | Slightly Used Bandage | stat | +X HP/s regen | 0.10/0.13/0.16/0.19/0.22/0.25/0.28 | a pink cartoon bandage with a heart | "Used once. On a papercut. It's fine." |
| `offbrand_watch` | Off-Brand Wristwatch | stat | −X% cooldown | 2/2.5/3/3.5/4/4.5/5 | a chunky digital watch reading 88:88 | "Water resistant to a depth of one puddle." |
| `region_locked_dvd` | Region-Locked DVD Box Set | stat | +X% duration | 4/5/6/7/8/9/10 | a DVD case with a big region-lock symbol | "Plays in exactly one country. Not yours." |
| `chocolate_coin` | Chocolate Commemorative Coin | stat | +X% coins | 5/7/9/11/13/15/17 | a gold-foil chocolate coin, one bite missing | "Legal tender in the Candy Kingdom." |
| `traffic_cone` | Traffic Cone | stat | +X armor | 1/1/1/2/2/2/3 | an orange cone with a white stripe and a tyre mark | "Found near a suspicious truck." |

The Traffic Cone is the guaranteed N result on the Truck-kun banner (`gacha.md`).

## R — "Rare" (14): stats with a twist

| id | Name | Hook | Effect | Values ★0..★6 | Icon | Flavour |
| --- | --- | --- | --- | --- | --- | --- |
| `acrylic_stand` | Limited Edition Acrylic Stand | kill | X% chance a kill drops a tiny heart (heals 3) | 2/2.5/3/3.5/4/4.5/5 | a clear acrylic stand of a chibi hero, rainbow edge | "Limited to 1,000,000 copies." |
| `smudged_poster` | Signed Poster (Signature Smudged) | stat | +X% crit chance | 3/3.5/4/4.5/5/5.5/6 | a rolled poster with a smudged scrawl | "Signed by someone. Probably." |
| `pencil_case` | Collector's Edition Pencil Case | stat | +X rerolls | 1/1/1/2/2/2/3 | a pastel pencil case with a cat-face zip | "Mint condition. Never once held a pencil." |
| `pocket_tissues` | Pocket Tissues (For The Finale) | hurt | the first hit every X s deals 50% less damage | 30/28/26/24/22/20/18 | a tissue pack with a crying face | "You'll need these for episode 12." |
| `phone_strap` | Glow-in-the-Dark Phone Strap | stat | +X% projectile speed | 12/15/18/21/24/27/30 | a glowing star phone strap | "Glows for four seconds. Then thinks about it." |
| `rubber_duck` | Rubber Duck (Squeaky) | dash | dashing through enemies squeaks: X damage and a knockback to each | 10/13/16/19/22/25/28 | a yellow duck in a captain's hat | "Squeak. (Translation: move.)" |
| `cat_ear_headband` | Cat-Ear Headband | stat | +X% move speed and +Y% pickup | X 6/7/8/9/10/11/12 · Y 10/12/14/16/18/20/22 | a pink headband with cat ears | "+10 cuteness. Cuteness is not a stat. Yet." |
| `mismatched_chopsticks` | Mismatched Chopsticks | pickup | food heals +X% | 20/25/30/35/40/45/50 | one red, one blue chopstick, crossed | "One from home, one from the café. A love story." |
| `hype_towel` | Hype Towel | stat | combo window +X s (`comboTime`) | 0.2/0.25/0.3/0.35/0.4/0.45/0.5 | a towel printed "SSS", waving | "Wave it. The crowd waves back. The combo stays." |
| `fan_club_card` | Fan Club Membership Card | state | +X% might per combo rank (C = 1 … SSS = 6) | 2/2.4/2.8/3.2/3.6/4/4.4 | a pink card with a holographic heart | "Member #000000004. You're very early." |
| `instant_ramen` | Instant Ramen (Three Minutes Exactly) | every 180 s | heal X% max HP | 20/23/26/29/32/35/38 | a cup noodle with chopsticks and steam | "Ready in three minutes. So is this heal." |
| `battle_playlist` | Boss Battle Playlist | stat | +X% damage vs bosses and elites (`bossDmg`) | 8/10/12/14/16/18/20 | a cassette with a skull sticker | "Track 1: Final Boss Theme (Not the Final Boss)." |
| `sparkly_hair_clip` | Sparkly Hair Clip | stat | −X% dash cooldown | 8/10/12/14/16/18/20 | a star hair clip with a sparkle | "Makes you 8% faster at running away. Science." |
| `lucky_cat` | Waving Lucky Cat | stat + chest | +X% coins, chests +Y% jackpot chance | X 8/9/10/11/12/13/14 · Y 2/2.5/3/3.5/4/4.5/5 | a white beckoning cat with a gold coin | "Waves at customers. Customers wave back. Nobody buys anything." |

## SR — "Super Rare" (12): event hooks

| id | Name | Hook | Effect | Values ★0..★6 | Icon | Flavour |
| --- | --- | --- | --- | --- | --- | --- |
| `rival_plushie` | Plushie of Your Rival | hit | crits Mark the enemy for 3 s: it takes +X% damage from everything | 10/12/14/16/18/20/22 | a grumpy plush with a headband | "You punch it when you're sad. It's therapeutic." |
| `oversized_sword_keychain` | Oversized Sword Keychain | every X s + hit | the next hit deals +200% damage and pops NANI?! | 8/7.5/7/6.5/6/5.5/5 | a keychain sword far bigger than its ring | "Bigger than the bag it's attached to." |
| `light_novel_vol1` | Light Novel Vol. 1 (Unread) | levelUp | the first X level-ups each run offer +1 card | 8/9/10/11/12/13/14 | a thick paperback, a long title in tiny text | "Full title: 'I Never Read This Book, So Now I Get an Extra Card?!'" |
| `theme_song_cd` | Theme Song CD Single | stat | +X% Overdrive gain (`ultGain`) | 10/13/16/19/22/25/28 | a CD single with a sparkly star cover | "Track 2 is the karaoke version. So is track 3." |
| `cosplay_wig` | Cosplay Wig (Wrong Colour) | runStart | one random stat (might, area, cooldown, move, projectile speed, duration, luck, XP) +X% for the run; a toast names it: "Today's wig: AREA!" | 10/13/16/19/22/25/28 | a bright blue wig on a stand | "It's supposed to be pink. Nobody noticed." |
| `festival_goldfish` | Festival Goldfish (Bagged) | every 15 s | a splash heals X HP and slows enemies within 48 px by 50% for 1 s | 5/6/7/8/9/10/11 | a goldfish in a knotted water bag | "Named Captain. Has been through a lot." |
| `mascot_head` | Mascot Costume Head | hurt | X% chance a hit deals only 1 damage | 20/23/26/29/32/35/38 | a big round mascot head with a dopey smile | "It's very hot in there. Enemies feel bad hitting it." |
| `pity_keychain` | Pity Counter Keychain | chest | each non-jackpot chest adds +X% jackpot chance, until a jackpot | 5/6/7/8/9/10/11 | a keychain with a tiny counter showing 89 | "Soft pity, but for chests." |
| `shonen_headband` | Shonen Headband | state | +X% might while below 50% HP | 10/13/16/19/22/25/28 | a white headband with a red flame emblem | "Smells like effort." |
| `compact_mirror` | Magical Girl Compact Mirror | hurt | the attacker takes X% of the contact damage it dealt | 300/350/400/450/500/550/600 | a pink heart-shaped compact, open, sparkling | "Reflects damage. And your choices." |
| `mecha_model_kit` | Mecha Model Kit (Missing Parts) | stat | +1 amount, but −X% might | 8/7/6/5/4/3/2 | a plastic model sprue with one empty slot | "Part B-14 was never in the box." |
| `magnifying_glass` | Detective's Magnifying Glass | kill (elite) | elites have X% chance to drop an extra chest | 15/20/25/30/35/40/45 | a magnifying glass over a "?" | "The culprit was the chest all along." |

## SSR — "Super Super Rare" (10): mechanics changes

| id | Name | Hook | Effect | Values ★0..★6 | Icon | Flavour |
| --- | --- | --- | --- | --- | --- | --- |
| `protagonist_scarf` | Protagonist's Scarf | lethal | survive X lethal hits per run at 1 HP (`flags.plotArmor`); at ★6 each save also heals 30% | 1/1/1/2/2/2/2 (+heal at ★6) | a long red scarf flowing dramatically | "Never touches the ground. Never washed." |
| `transformation_brooch` | Transformation Brooch | ultEnd | after Overdrive ends: +X% might and +20% move speed for 8 s | 30/35/40/45/50/55/60 | a winged heart brooch | "Batteries not included. Transformation also not included." |
| `abandoned_headband` | Rival's Abandoned Headband | stat + bossKill | +X% damage vs bosses and elites; each boss killed gives +5% might for the rest of the run | 15/17/19/21/23/25/27 | a frayed headband with a scorch mark | "She left it behind. She'll want it back next season." |
| `sakura_snow_globe` | Sakura Snow Globe | every 12 s | a petal storm hits every enemy in view for X × might | 30/34.5/39/43.5/48/52.5/57 | a snow globe with a sakura tree inside | "Shake it. Something, somewhere, gets hurt." |
| `season_finale_manga` | Season Finale Manga | levelUp | every Xth level-up is a SEASON FINALE: pick 2 cards | 10/10/9/9/8/8/7 | a manga volume with a "FINAL" ribbon | "The finale is two chapters long. You get both." |
| `wind_machine` | Dramatic Wind Machine | stat + step | +X% area; enemies within 32 px are gently pushed away (40 px/s) | 15/17/19/21/23/25/27 | a little fan with speed lines and a billowing cape | "For when your hair needs to be in the scene." |
| `sentai_badge` | Sentai Team Badge | ult | when Overdrive starts, a 5-colour explosion goes off behind you: r 80, X × might × ult power | 300/345/390/435/480/525/570 | a star badge with five coloured points | "Requires a team of five. You are the team of five." |
| `isekai_status_card` | Isekai Status Card | levelUp | each level-up gives +X% might for the rest of the run | 0.5/0.6/0.7/0.8/0.9/1.0/1.1 | a translucent blue card full of numbers | "STR 9. INT 9. LUCK 9,999,999." |
| `screentone_sheet` | Sparkle Screentone Sheet | hit (crit) | crits burst into sparkles: r 20, X% of the crit's damage to nearby enemies (each enemy at most every 0.3 s); NANI?! pops twice as likely | 50/58/66/74/82/90/98 | a dotted screentone sheet with a star cut out | "Applied by hand. 400 hours. Worth it." |
| `red_string_of_fate` | Red String of Fate | step + kill | your nearest enemy (a boss on screen first) is tied to you by a red string and takes +X% damage; when it dies the string jumps to the next | 40/45/50/55/60/65/70 | a red thread tied in a bow around a pinky | "Destiny. Or a fishing accident." |

## UR — "Ultra Rare" (6)

| id | Name | Hook | Effect | Values ★0..★6 | Icon | Flavour |
| --- | --- | --- | --- | --- | --- | --- |
| `unopened_figure` | Limited Figure (Box Unopened) | state | +X% might while you have taken no damage this run ("MINT"); after the first hit, +Y% ("OPENED") | X 30/33/36/39/42/45/48 · Y 10/11/12/13/14/15/16 | a figure in a sealed box with a MINT sticker | "The moment you open it, it loses 66% of its value." |
| `directors_cut` | Director's Cut Blu-ray | bossKill | bosses drop 2 golden chests; +X% might per boss killed this run | 5/6/7/8/9/10/11 | a Blu-ray case with a director's chair | "Includes 40 extra minutes of the director watching the footage." |
| `time_skip_clock` | Time-Skip Clock | hurt | when HP drops below 30%: every enemy and bullet freezes for 3 s and you heal 20% ("TWO YEARS LATER..." card); cooldown X s | 90/85/80/75/70/65/60 | a clock with an arrow jumping forward | "Two years later, nothing had changed." |
| `hot_blooded_bandana` | Hot-Blooded Bandana | state | your combo rank XP multiplier also applies to your damage at X% strength (SSS ×2.0 at 50% = +50% might) | 50/58/66/74/82/90/98 | a red bandana on fire | "The louder you shout, the harder you hit." |
| `golden_ticket` | Golden Gacha Ticket | stat + levelUp | +1 card on every level-up; chests offer evolutions at Lv4; ★3 +1 reroll; ★6 +1 more card | cards 1/1/1/1/1/1/2 · rerolls 0/0/0/1/1/1/1 | a shining golden ticket with a star | "Guaranteed SSR!* (*Terms and conditions apply. They're long.)" |
| `sacred_plot_device` | Sacred Plot Device | levelUp | every level-up resets all weapon cooldowns (they fire at once) and grants +X% might for 5 s | 0/3/6/9/12/15/18 | a glowing golden orb with a "?" inside | "Nobody knows what it does. It does whatever the plot needs." |

## LR — "Legendary Rare" (4)

| id | Name | Hook | Effect | Values ★0..★6 | Icon | Flavour |
| --- | --- | --- | --- | --- | --- | --- |
| `original_manuscript` | Author's Original Manuscript | runStart | start with your start weapon at Lv W and its evolution passive at Lv P | W 3/3/4/4/4/4/5 · P 1/1/1/1/2/2/3 | a thick stack of handwritten pages with coffee rings | "The ending was different in the draft. Better, even." |
| `revival_theme` | The Hero's Revival Theme | lethal / revive | +1 revive; reviving refills Overdrive and grants SECOND WIND: +50% might for X s | 6/7/8/9/10/11/12 | a music note on fire | "Plays when you get back up. Also plays in the shower." |
| `last_budget` | Studio's Last Remaining Budget | stat | ultimates deal ×X damage (`ultPower`) and last 50% longer | 2.0/2.1/2.2/2.3/2.4/2.5/2.6 | a single gold coin on a velvet cushion | "We spent it all on the ultimate. No regrets." |
| `sakuga_cel` | Sakuga Animation Cel | every 30 s | SAKUGA MODE for X s: −40% cooldown, +20% move speed, every hit sparkles; a gold border pulses | 5/5.5/6/6.5/7/7.5/8 | a transparent cel with a dynamic pose sketch | "For five seconds, the budget is infinite." |

## MYTHIC (3): absurd, run-defining

| id | Name | Hook | Effect | Values ★0..★6 | Icon | Flavour |
| --- | --- | --- | --- | --- | --- | --- |
| `infinite_credit_card` | Infinite Gacha Credit Card | stat + flags | every level-up offers 6 cards (`cards = 6`) and rerolls are free (`flags.freeRerolls = 1`); +X banishes | 0/1/2/3/4/5/6 | a black-and-gold card with "∞" and glitch sparkles | "No limit. No statement. No consequences. (There are consequences.)" |
| `real_friend` | A Real Friend | runStart | a second copy of your hero fights beside you (details below), dealing X% of your damage | 50/58/66/74/82/90/98 | two hands making a heart, one sparkle | "Not imaginary. We checked. Twice." |
| `final_episode_script` | The Final Episode Script | ultEnd | Overdrive is always ready: the meter refills to full X s after each ultimate ends | 6/5.5/5/4.5/4/3.5/3 | a script stamped "FINAL EP." with a glowing bookmark | "Spoiler: everyone uses their ultimate. Constantly." |

**A Real Friend — behaviour.** The Friend is a non-targetable ally drawn with
your hero's sprites (idle/run/cast), a 1-px pink outline tint and a small
`fx_heart` floating above it. It follows you on a lagged path 24-40 px behind,
never blocks anything, takes no damage. It owns a second instance of your start
weapon at your start weapon's current level (it evolves when yours does), firing
from its own position with damage × (X / 100) (its copy of an orbiting weapon never
blocks bullets and Pudding's copy never heals: one Orbital Guard, one Warm Tea,
docs/content/weapons.md §7). When you cast Overdrive it does
the cast pose and cheers (`FRIEND!` pop); it does not cast an ult. Kills credit
your start weapon (mastery included).

## Copy for the relic card (codex / gacha splash)

- Star row: ★ filled pink per star, empty ☆ grey; ★6 shows `MAX ★ (Further
  copies become Copium. We're sorry. We're not.)`
- Unowned relics in the codex: silhouette + `??? — Available in the Merch Machine.
  Allegedly.`
- Equip toast: `<name> equipped! (+1 to your aesthetic)`
