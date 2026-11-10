# Weapons, evolutions, Limit Breaks, passives

20 weapons (8 existing + 12 new), each with an evolution (40 weapon defs), and 16
passives (8 existing + 8 new). Every weapon is getting a **second evolution** through a
different passive (§8: the pilot, Meowteor Hammer, is in; 19 are designed and packaged). Numbers use the same `WeaponLevel` shape as the
existing files (`dmg, cd, amount, speed, pierce, area, duration, knock` plus
weapon-specific keys) and sit in the same ranges: a Lv1 weapon does roughly
12-25 single-target DPS or 6-15 per-enemy AoE DPS; a Lv5 weapon 2.5-4× that; an
evolution about 2× a Lv5.

Stat scaling is the existing convention (`wstats`): damage × `might`, cooldown ×
`cooldown`, area × `area`, count + `amount`, speed × `projSpeed`, duration ×
`duration`, knockback × `knock`. Per-weapon notes say when a stat does
something special.

---

## 1. Evolution pairs (all 20)

Evolution needs the base weapon at **Lv5** (its last regular level, as today) plus
the passive at any level. Limit Break levels (Lv6/Lv7, §4) are optional extra
cards: taking them before evolving is a choice (see the inheritance rule in §4).

| Base weapon | + Passive | → Evolution | id |
| --- | --- | --- | --- |
| Star Shot | Wish Charm | Galaxy Barrage | `galaxy_barrage` (existing) |
| Petal Slash | Big Ribbon | Sakura Tempest | `sakura_tempest` (existing) |
| Yarn Orbit | Magnet Star | Cosmic Yarn | `cosmic_yarn` (existing) |
| Heart Boomerang | Twin Charm | Love Tornado | `love_tornado` (existing) |
| Thunder Bell | Power Bow | Raijin Drum | `raijin_drum` (existing) |
| Candy Bomb | Lucky Clover | Sugar Nuke | `sugar_nuke` (existing) |
| Bubble Aura | Heart Locket | Ocean Dome | `ocean_dome` (existing) |
| Prism Beam | Swift Shoes | Rainbow Cannon | `rainbow_cannon` (existing) |
| Dark Flame Dragon | Inner Monologue | Unsealed Abyss Dragon | `unsealed_abyss_dragon` |
| Teapot Tempest | Bento Box | Eternal Tea Party | `eternal_tea_party` |
| Micro Missile Swarm | Speed Lines | Al Dente Armageddon | `al_dente_armageddon` |
| Baka Harisen | Friendship Bracelet | Dere Dere Harisen | `dere_dere_harisen` |
| Notice-Me Sparkles | Main Character Aura | Shoujo Filter | `shoujo_filter` |
| Henshin Burst | Plot Armor | Infinite Henshin Loop | `infinite_henshin_loop` |
| Cheat Fireball | Training Montage | Meteor Lv.99999 | `cheat_meteor` |
| Horn of Reincarnation | Swift Shoes | Isekai Rush Hour | `isekai_rush_hour` |
| Bubble Tea Cannon | Big Ribbon | Tapioca Tsunami | `tapioca_tsunami` |
| Paper Crane Flock | Wish Charm | Thousand Crane Wish | `thousand_crane_wish` |
| Idol Lightstick Wave | Twin Charm | Sold-Out Dome Tour | `sold_out_dome_tour` |
| Kotatsu of Sloth | Chibi Charm | Eternal Winter Break | `eternal_winter_break` |

Every new passive drives exactly one evolution; Wish Charm, Big Ribbon, Twin
Charm and Swift Shoes now drive two each. The level-up card "nudge" (weight +3 for
a passive that would evolve an owned weapon) already handles shared passives.

---

## 2. The 12 new weapons

Format per weapon: id · icon · hit colour · fire sfx; card `desc`; behaviour;
the one **twist** that makes it more than a number; the 5-level table
(implement verbatim) with the `upgrades` card texts for Lv2-Lv5; visuals; unlock.

### 2.1 Dark Flame Dragon — `dark_flame_dragon` (Kuro signature)
`icon_dark_flame_dragon` · `C.orange` · sfx `fireball` (vol 0.6, per breath)

**desc:** "A tiny dragon on your shoulder breathes black flames at the nearest enemy. (They're orange.)"

**Behaviour.** `amount` familiars hover at shoulder offsets (+10, −14) and
(−10, −14) (a third at (0, −20)). Every `cd` s, if an enemy is within 110 px ×
area, each familiar turns to the nearest enemy and breathes a cone for
`duration` s: length `len` × area, half-angle `angle`°, hitting every enemy in
the cone each 0.12 s (slot channel, `hitEvery` 0.12). Each hit applies **Burn**:
`burnDps` damage per second for `burn` s (ticks every 0.5 s, refreshes, does
not stack; burn is the weapon's damage source).

**Twist — "black" flames.** The flames are drawn orange with a 1-px violet
outline (Kuro drew it on). Kuro's talent `kuro_seal_broken` and the evolution
finally make them black.

| Lv | dmg (per tick) | cd | amount | duration | len | angle | burnDps | burn | knock | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 4 | 2.2 | 1 | 0.8 | 56 | 22 | 4 | 2 | 8 | — |
| 2 | 5 | 2.2 | 1 | 0.8 | 64 | 22 | 4 | 2 | 8 | "Damage +1, longer flames" |
| 3 | 5 | 2.2 | 2 | 0.8 | 64 | 22 | 4 | 2 | 8 | "+1 dragon (the sequel)" |
| 4 | 7 | 1.9 | 2 | 0.8 | 64 | 22 | 4 | 3 | 8 | "Damage +2, cooldown −14%, burns last longer" |
| 5 | 9 | 1.9 | 2 | 1.1 | 72 | 28 | 6 | 3 | 10 | "Damage +2, a bigger, longer, hotter breath" |

**Visuals.** `w_salamander` (12×12×4, hover flap) faces its target; the breath is
a stream of `w_dragon_fire` (8×8×4, play-once 0.35 s, additive glow) emitted
30/s along the cone with ±angle jitter. Burning enemies show `w_dragon_fire` f3
at 0.5 scale flickering on their head.

### 2.2 Teapot Tempest — `teapot_tempest` (Pudding signature)
`icon_teapot_tempest` · `C.gold` · sfx `teacup` (per spill)

**desc:** "Teacups orbit you, block enemy shots and spill tea on your path. Brush a puddle: Warm Tea heals you on the move."

**Behaviour.** `amount` cups orbit at r 30 × area, `speed` rad/s; contact
damage `dmg`, per-enemy re-hit `every` s. Every `cd` s a cup tips (f1) and leaves
a **tea puddle**: r `puddleR` × area, lives `life` × duration s, max 6 alive
(oldest dries first). While Pudding moves, the cup nearest her heading tips and
the tea lands **on her path** (80 % of the way from the cup to a point 30 px
ahead of her feet); standing still, the cup nearest the nearest enemy tips where
it is. Enemies in a puddle take `puddleDmg` every 0.5 s and are slowed 15%.

**Warm Tea** (replaces "stand in the puddle"): her feet brushing any puddle
(within its rim + 4 px) warm her up for **3 s** (+0.5 s per Free Refills rank),
refreshed by any puddle, never stacking: `heal` HP/s × `healMul` for as long as
it lasts, in 1 s sips (one number per second). One brush = `heal` × 3 s; walking
keeps it up because the spills land where she is going (measured: > 90 % uptime
walking straight, > 75 % kiting in circles; `tests/orbitals.test.ts`).

**Orbital Guard** (§7): each cup eats the first enemy bullet it touches, breaks,
and reforms its mend time later (`mend` s, scaled by cooldown and extra cups, §7). A broken cup does not tip; with every cup
broken the tea still spills from the best slot, so a volley never cuts off the
healing.

**Twist.** The only signature weapon that heals, and it heals on the move.

| Lv | dmg | cd (spill) | amount | speed | every | puddleR | puddleDmg | life | heal (HP/s) | block / mend | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 8 | 2.5 | 2 | 3.0 | 0.5 | 14 | 6 | 4 | 1.5 | 1 / 2.5 s | — |
| 2 | 8 | 2.5 | 3 | 3.0 | 0.5 | 14 | 6 | 4 | 1.5 | 1 / 2.5 s | "+1 teacup" |
| 3 | 11 | 2.5 | 3 | 3.0 | 0.5 | 16 | 8 | 4 | 2 | 1 / 2.5 s | "Damage +3, hotter, wider puddles, warmer tea" |
| 4 | 11 | 2.0 | 4 | 3.2 | 0.5 | 16 | 8 | 4 | 2 | 1 / 2.5 s | "+1 teacup, spills more often" |
| 5 | 14 | 2.0 | 4 | 3.2 | 0.45 | 20 | 12 | 5 | 3 | 1 / 2.2 s | "Damage +3, bigger, longer puddles, much warmer tea" |

(Season 3 balance pass: heal was 1 / 1 / 1 / 1 / 1.5 HP/s standing in a puddle; puddleDmg was 4 / 4 / 6 / 6 / 8 -
raised so the path spills, which land where she walks instead of on the nearest enemy, keep the crowd damage: gauge
L5 1207 -> 1208.) A Lv5 Teapot on Pudding (healMul 1.15) heals 3.45 HP/s while warm, about 3.1 HP/s on the move
(90 % uptime): most of a mid-game bullet storm's chip damage (Shoujo Academy P4, minute 9.5: 3.9 HP/s taken).

**Visuals.** `w_teacup` (10×10×2: f0 upright with saucer, f1 tipping; scale 0 while broken, popping back in),
puddles `w_tea_puddle` (24×14×3: f0 splash, f1 resting, f2 drying — last 0.5 s) on the ground-decal layer, 2
steam wisps (`fx_puff` tinted white, alpha 0.4) rising per puddle per second. A spill splashes drops at the cup
and where the tea lands. Warm Tea: a soft warm glow on her, amber steam curling off her shoulders and a tiny
tea-coloured heart floating up now and then, fading out over its last 0.6 s (no ring or countdown dots: owner
feedback, the brown-rimmed ring looked silly); warming up from cold pops an amber ring and "warm tea~♡" (at most
every 6 s).

### 2.3 Micro Missile Swarm — `micro_missile_swarm` (Aoi signature)
`icon_micro_missile_swarm` · `C.blue` · sfx `missile` (once per salvo)

**desc:** "A salvo of micro missiles with gloriously tangled trails."

**Behaviour.** Every `cd` s, `amount` missiles launch from the hero's back at
random angles within ±70° of straight up at 0.6 × `speed`, reaching `speed`
over 0.3 s. Each homes on a random enemy in view (distinct while possible) with
turn rate `turn` rad/s plus a sine wobble (±30° at 6 Hz) — the spaghetti. On
contact or after 2.5 s it explodes: r `blast` × area, `dmg`, `knock`.

**Twist.** A missile whose target dies re-acquires the nearest enemy once
("they're stubborn"); the second loss makes it explode on the spot.

| Lv | dmg | cd | amount | speed | turn | blast | knock | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 7 | 1.6 | 4 | 140 | 4 | 12 | 30 | — |
| 2 | 7 | 1.6 | 6 | 140 | 4 | 12 | 30 | "+2 missiles" |
| 3 | 9 | 1.6 | 6 | 140 | 4 | 14 | 30 | "Damage +2, bigger blasts" |
| 4 | 9 | 1.4 | 8 | 150 | 4 | 14 | 32 | "+2 missiles, cooldown −12%" |
| 5 | 12 | 1.4 | 10 | 150 | 5 | 16 | 34 | "Damage +3, +2 missiles, sharper homing" |

`amount` stat: each +1 adds **2** missiles.

**Visuals.** `w_missile` (8×6×2, rotated by velocity, f1 exhaust flicker), new
trail preset `"spaghetti"` (1-px line, white → `#5aa8ff`, 0.5 s, follows the
wobble so trails cross and tangle), `fx_explosion` scaled to the blast.

### 2.4 Baka Harisen — `baka_harisen` (Akane signature)
`icon_baka_harisen` · `C.red` · sfx `fanSmack`

**desc:** "SMACK! A paper fan with enormous knockback. Smacked enemies bonk whatever they fly into."

**Behaviour.** Every `cd` s, a smack in the facing direction: an ellipse
(half extents 20 × 14, × area) centred 16 px ahead; each enemy hit once:
`dmg`, `knock`, and **dazed** for `stun` s (velocity zero; bosses are never
dazed). `amount` 2 adds a backhand 0.2 s later in the opposite direction (each
further amount alternates ±90°). **Ricochet:** an enemy knocked back by the
fan that touches another enemy within 0.4 s deals 40% of the smack damage to it
(once per knocked enemy).

**Twist — MEGA BAKA (Lv5).** Every 5th smack deals ×3 damage and releases a
shockwave ring (r 48 × area) that hits everything for the smack damage; shake
0.3; a 2× `fx_baka` always pops.

`fx_baka` pops: a smack that hits ≥ 1 enemy pops "BAKA!" with 35% chance
(global pop rules in `satire.md`). sfx `baka` with the pop.

| Lv | dmg | cd | amount | area | knock | stun | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 22 | 1.5 | 1 | 1 | 220 | 0.3 | — |
| 2 | 22 | 1.5 | 2 | 1 | 220 | 0.3 | "Backhand: also smacks behind you" |
| 3 | 30 | 1.5 | 2 | 1.2 | 230 | 0.3 | "Damage +8, bigger fan" |
| 4 | 30 | 1.25 | 2 | 1.2 | 230 | 0.5 | "Cooldown −17%, longer daze" |
| 5 | 40 | 1.25 | 2 | 1.4 | 260 | 0.5 | "Damage +10, even bigger fan, every 5th smack is a MEGA BAKA" |

**Visuals.** `w_harisen` (32×24×4, arc opens right, rotated to the facing
direction, play-once 0.18 s), `fx_baka` (24×10×2; f0 red "BAKA!").

### 2.5 Notice-Me Sparkles — `notice_me_sparkles` (Senpai signature)
`icon_notice_me_sparkles` · `C.pinkLight` · sfx `sparkleCharm` (on each charm, rate-limited 1 / 0.3 s)

**desc:** "A sparkle aura that stings a little and charms enemies into fighting each other."

**Behaviour.** Aura r `radius` × area around the hero, ticking every `cd` s:
`dmg` to every enemy inside. Each tick, each non-charmed enemy inside rolls
`charm` (elites half chance, bosses immune) and becomes **Charmed** for
`duration` × duration s: it walks to the nearest non-charmed enemy within 120 px
at 1.2× its speed and deals its own contact damage × 2 every 0.5 s to enemies it
touches (source `notice_me_sparkles`, so kills credit the weapon and mastery);
it never hurts the player; it still takes damage. Up to `max` charmed at once.
When the charm ends the enemy is **Heartbroken**: slowed 30% for 2 s.

**Twist (Lv5).** Heartbroken enemies explode into hearts: r 16, 20 dmg.

| Lv | dmg | cd | radius | charm | duration | max | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 3 | 0.5 | 36 | 0.08 | 3 | 4 | — |
| 2 | 3 | 0.5 | 40 | 0.10 | 3 | 4 | "Wider aura, more charming" |
| 3 | 5 | 0.5 | 40 | 0.10 | 3 | 6 | "Damage +2, up to 6 admirers" |
| 4 | 5 | 0.45 | 40 | 0.11 | 4 | 6 | "Charm lasts longer, ticks faster" |
| 5 | 7 | 0.45 | 48 | 0.14 | 4 | 10 | "Damage +2, bigger aura, up to 10 admirers; heartbreak explodes" |

`amount` stat: +2 max charmed per extra amount.

**Visuals.** 10 `fx_spark` (pink/white) orbit at the aura radius, a faint
`fx_circle` (pink, alpha 0.08). Charmed enemies: `fx_charm_heart` (8×7×2,
beating) above the head and a 25% pink tint; Heartbroken: the heart cracks
(f1) and falls.

### 2.6 Henshin Burst — `henshin_burst` (Magical Girl #47 signature)
`icon_henshin_burst` · `C.mint` · sfx `transform`

**desc:** "Periodically transform: invulnerable for a moment, then a radial burst. Transforms instantly if you're about to be hit."

**Behaviour.** A charge timer of `cd` s. When full: a 0.6 s **henshin**
(`iframe` s, scaled by nothing): the hero is invulnerable and moves at 50%
speed while ribbons spin, then a **burst**: circle r `radius` × area, `dmg`,
`knock`; plus `ribbons` ribbon projectiles fanned evenly (`w_ribbon`, 160 px/s,
pierce 2, `ribbonDmg`, life 0.8 s).

**Twist — Panic Henshin.** If the hero would take damage while the charge is
≥ 80%, the henshin triggers instantly and that hit is negated (emits `block`;
floating text `PANIC HENSHIN!`, rate-limited 1 / 5 s).

| Lv | dmg | cd | radius | iframe | ribbons | ribbonDmg | knock | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 45 | 5.0 | 56 | 0.6 | 0 | 0 | 160 | — |
| 2 | 45 | 5.0 | 56 | 0.6 | 6 | 10 | 160 | "+6 ribbons fly out of the burst" |
| 3 | 60 | 5.0 | 64 | 0.6 | 6 | 10 | 170 | "Damage +15, bigger burst" |
| 4 | 60 | 4.4 | 64 | 0.6 | 8 | 10 | 170 | "Cooldown −12%, +2 ribbons" |
| 5 | 80 | 4.4 | 72 | 0.6 | 8 | 14 | 180 | "Damage +20, the burst heals 5 HP and clears enemy bullets inside it" |

`amount` stat: +2 ribbons per extra amount.

**Visuals.** `fx_henshin` (32×32×6) plays once over the henshin on the hero;
`w_ribbon` (12×12×2) projectiles spin; the burst is `fx_ring_thick` tinted
mint + 12 sparkles.

### 2.7 Cheat Fireball — `cheat_fireball` (Isekai-kun signature)
`icon_cheat_fireball` · `C.orange` · sfx `fireball`

**desc:** "Cheat Skill: Fireball Lv.9999. It's his Lv.1 spell. Every few casts he overdoes it."

**Behaviour.** Every `cd` s, `amount` fireballs fly at the nearest distinct
enemies at `speed`; each explodes on its first hit (or after 180 px): r `blast`
× area, `dmg`, `knock`.

**Twist — "Did I overdo it?"** Every `overdo`-th cast (counter on the weapon)
is overdone: blast radius ×2.5, damage ×3, leaves a burning crater (`fx_crater`
decal, r 20, 2 s, 8 dmg every 0.25 s), shake 0.4, white flash 0.15, and floating
text `Did I overdo it?` (rate-limited 1 / 8 s, never over the hero). Counts
`run.overdos`.

| Lv | dmg | cd | amount | speed | blast | overdo | knock | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 28 | 1.8 | 1 | 110 | 22 | 5 | 90 | — |
| 2 | 34 | 1.8 | 1 | 110 | 24 | 5 | 90 | "Damage +6, bigger boom" |
| 3 | 34 | 1.8 | 2 | 115 | 24 | 5 | 95 | "+1 fireball" |
| 4 | 44 | 1.5 | 2 | 115 | 28 | 5 | 100 | "Damage +10, cooldown −17%, bigger boom" |
| 5 | 52 | 1.5 | 3 | 120 | 28 | 4 | 110 | "Damage +8, +1 fireball, overdoes it every 4th cast" |

**Visuals.** `w_fireball` (14×14×4, flicker loop, rotated by velocity, trail
`"fire"`), `fx_explosion` scaled to blast; overdone: ×2.5 explosion + `fx_crater`
(24×12×3: f0 fresh glow, f1 embers, f2 scorch).

### 2.8 Horn of Reincarnation — `horn_of_reincarnation` (Truck-kun signature)
`icon_horn_of_reincarnation` · `C.yellow` · sfx `honk`

**desc:** "HONK: a shockwave cone ahead. Moving rams enemies, and the ones you finish are sent to another world."

**Behaviour.** Every `cd` s a honk in the facing direction: cone length `len` ×
area, half-angle `angle`°, `dmg`, `knock`, daze 0.3 s. `amount` 2 = a second
honk 0.25 s later at 60% damage ("HONK-HONK"). **Ram:** while the hero moves at
≥ 60% of its move speed, enemies touching a circle r 10 placed 8 px ahead of the
hero's body take `ram` damage (per-enemy re-hit 0.4 s) and are knocked sideways
(120).

**Twist — Isekai'd.** Non-boss enemies killed by the honk or the ram vanish in a
`fx_light_pillar` instead of confetti and drop +1 extra gem with 25% chance.
Counts `run.isekaid`.

| Lv | dmg | cd | amount | len | angle | knock | ram | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 18 | 1.8 | 1 | 64 | 30 | 180 | 12 | — |
| 2 | 18 | 1.8 | 1 | 72 | 30 | 180 | 16 | "Louder honk, harder ram" |
| 3 | 26 | 1.8 | 1 | 72 | 38 | 190 | 16 | "Damage +8, wider honk" |
| 4 | 26 | 1.5 | 1 | 72 | 38 | 190 | 22 | "Cooldown −17%, ram damage +6" |
| 5 | 36 | 1.5 | 2 | 88 | 38 | 200 | 30 | "Damage +10, longer honk, HONK-HONK" |

**Visuals.** `w_honk_wave` (32×32×4, 3 concentric sound arcs opening right,
play-once 0.3 s, scaled to `len`), `fx_honk` (24×10×2, "HONK" lettering pop,
1 / s max), `fx_light_pillar` (16×48×4, rises and fades 0.5 s).

### 2.9 Bubble Tea Cannon — `bubble_tea_cannon` (general)
`icon_bubble_tea_cannon` · `0xdda574` (tan) · sfx `boba`

**desc:** "Fires chewy boba pearls that bounce from enemy to enemy."

**Behaviour.** Every `cd` s, `amount` pearls fly at the nearest enemies at
`speed`. On hit a pearl bounces to the nearest enemy within 80 px it has not hit
yet (if none, it reflects off its own path at a random ±60° and keeps flying);
after `bounce` bounces it pops with a tiny splash.

**Twist — Sticky.** Every hit slows the enemy 20% for 1 s.

| Lv | dmg | cd | amount | speed | bounce | knock | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 12 | 1.3 | 1 | 150 | 3 | 30 | — |
| 2 | 12 | 1.3 | 2 | 150 | 3 | 30 | "+1 pearl" |
| 3 | 16 | 1.3 | 2 | 155 | 4 | 32 | "Damage +4, +1 bounce" |
| 4 | 16 | 1.15 | 3 | 155 | 4 | 32 | "+1 pearl, cooldown −12%" |
| 5 | 21 | 1.15 | 3 | 160 | 6 | 36 | "Damage +5, +2 bounces, pearls split into 2 mini pearls on their last bounce" |

Lv5 mini pearls: 50% damage, 2 bounces, 0.7 scale.

**Visuals.** `w_boba` (8×8×2, glossy dark brown pearl, white shine; spins), hit:
small brown `fx_puff`.

### 2.10 Paper Crane Flock — `paper_crane_flock` (general)
`icon_paper_crane_flock` · `C.white` · sfx `paperCrane` (per dart, rate-limited 1 / 0.15 s)

**desc:** "Origami cranes flutter around you and dart at nearby enemies."

**Behaviour.** `amount` cranes idle in a loose flock (each on its own lazy orbit
r 18-30, bobbing). Each crane independently: when its own `cd` is ready and an
enemy is within `range` × area, it darts at it (`speed`, homing 6 rad/s),
hits (`pierce`), then flies back to the flock.

**Twist — Folded Tighter.** Each kill folds that crane tighter: +5% damage for
that crane, up to +50%. All folds reset when the hero is hurt (the cranes
crumple, f3).

| Lv | dmg | cd | amount | speed | range | pierce | knock | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 11 | 1.2 | 3 | 170 | 100 | 1 | 25 | — |
| 2 | 11 | 1.2 | 4 | 170 | 100 | 1 | 25 | "+1 crane" |
| 3 | 17 | 1.1 | 4 | 180 | 115 | 2 | 25 | "Damage +6, wider patrol, darts pierce 2" |
| 4 | 21 | 0.9 | 5 | 180 | 115 | 2 | 28 | "+1 crane, damage +4, darts more often" |
| 5 | 30 | 0.8 | 6 | 190 | 115 | 3 | 30 | "Damage +9, +1 crane, darts pierce 3" |

(Weapon bench pass, §9: dmg was 9 / 9 / 12 / 12 / 15, cd 1.2 / 1.2 / 1.2 / 1.0 / 1.0, pierce 1 / 1 / 1 / 1 / 2.)

**Visuals.** `w_crane` (12×10×4 flap), rotated by velocity while darting,
flipped to face its drift in the flock, trail `"paper"` (2 white `fx_px` per
0.1 s).

### 2.11 Idol Lightstick Wave — `idol_lightstick_wave` (general)
`icon_idol_lightstick_wave` · `C.cyan` · sfx `lightstick` (per wave)

**desc:** "Lightstick waves pulse out on the beat. The crowd gets louder with your combo rank."

**Behaviour — the beat.** The sim keeps a beat clock from `StageDef.bpm`
(proposed optional field; Dream Meadow 140, Candy 150, Academy 136, Beach 128,
Final Arc 160; the audio agent sequences each stage's battle theme at that BPM
so the waves land on the music). The weapon fires on every `every`-th beat
(effective `every` = max(1, round(`every` × cooldown stat))). A wave is a
crescent `arc`° wide that spawns at the hero and expands to `range` × area over
0.5 s, hitting each enemy once. With `amount` 1 waves alternate left / right
(swaying); with `amount` n ≥ 2, n arcs fire at once, evenly spaced (180° / 120°
/ 90° apart), the set rotating 45° each wave. Every 16 beats a **Chorus**: a
360° ring (range ×1.2, damage ×1.5).

**Twist — the crowd.** +8% damage per combo rank (C = 1 … SSS = 6).

| Lv | dmg | every (beats) | amount | arc | range | knock | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 10 | 4 | 1 | 120 | 80 | 40 | — |
| 2 | 10 | 4 | 2 | 120 | 80 | 40 | "Both sides wave" |
| 3 | 14 | 4 | 2 | 120 | 96 | 42 | "Damage +4, waves reach farther" |
| 4 | 14 | 2 | 2 | 120 | 96 | 42 | "Waves on every 2nd beat" |
| 5 | 18 | 2 | 2 | 150 | 96 | 46 | "Damage +4, wider waves, the Chorus deals double" |

(`cd` in the WeaponLevel = `every` × 60 / 140 for tooling; the sim uses the beat.)

**Visuals.** `w_lightstick_wave` (32×16×4, a crescent of light, frames cycle
pink → cyan → yellow → violet), drawn scaled to the current radius, additive
glow. The weapon's HUD icon pulses on every beat.

### 2.12 Kotatsu of Sloth — `kotatsu_of_sloth` (general)
`icon_kotatsu_of_sloth` · `C.orange` · sfx `snore`

**desc:** "Stand still and a kotatsu appears: a cosy aura that slows and lulls enemies. Stay too long and you get Too Comfy."

**Behaviour.** Standing still (move input < 0.1) for `deploy` s deploys the
kotatsu at the hero's feet (drawn just below the hero). Deployed aura r
`radius` × area: enemies inside are slowed (×`slow`) and take `dmg` every `cd`
s; the hero gains `armor` armor and `regen` HP/s while inside. Moving folds it
(f0): a small travelling aura r 18 that slows 20% and deals nothing.

**Twist — Too Comfy.** After `comfy` s standing still, the hero dozes off:
**every weapon (the kotatsu included) stops dealing damage**, the aura grows ×1.5,
its slow becomes ×0.3, regen ×3, and `fx_zzz` floats over the hero (sfx
`snore`, vol 0.8). Moving wakes up instantly. This is the "Pacifist?" route
(`RunStats.pacifistBest` counts it naturally).

| Lv | dmg | cd | radius | slow | deploy | armor | regen | comfy | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 | 0.5 | 40 | 0.6 | 0.6 | 1 | 0.5 | 5 | — |
| 2 | 7 | 0.5 | 44 | 0.6 | 0.6 | 1 | 1.0 | 5 | "Damage +2, bigger blanket, more regen" |
| 3 | 9 | 0.5 | 44 | 0.5 | 0.6 | 2 | 1.5 | 5 | "Cosier: damage +2, stronger slow, more regen, +1 armor inside" |
| 4 | 15 | 0.5 | 44 | 0.5 | 0.4 | 2 | 2.0 | 5 | "Damage +6, deploys faster, more regen" |
| 5 | 28 | 0.5 | 52 | 0.5 | 0.4 | 3 | 2.5 | 5 | "Damage +13, bigger, +1 armor; enemies inside 3 s fall asleep and take +25% damage" |

(Weapon bench pass, §9: dmg was 4 / 5 / 5 / 7 / 9, regen 0.5 / 0.5 / 1 / 1 / 1, armor 1 / 1 / 1 / 2 / 2.)

`amount` stat: +8% radius per extra amount. Deploy plays sfx `snore` at vol 0.3,
pitch +5 (a yawn).

**Visuals.** `w_kotatsu` (32×24×4: f0 folded quilt bundle, f1-f2 deployed with
steam wobble, f3 Too Comfy with the heater glowing `o/y` under the quilt), faint
`fx_circle` orange aura (alpha 0.07), `fx_zzz` (8×8×3) over sleepy enemies and
the dozing hero.

---

## 3. The 12 new evolutions

One level each (`levels` has one entry), `evolved: true`. Mastery XP from an
evolution goes to its base weapon.

| id | Name | Card desc | levels[0] |
| --- | --- | --- | --- |
| `unsealed_abyss_dragon` | Unsealed Abyss Dragon | "EVOLUTION! The seal breaks: an abyss dragon circles you breathing actually-black flames and passes judgement on the strongest enemy." | `{ dmg: 10, cd: 3, amount: 1, len: 64, angle: 26, orbit: 36, burnDps: 10, burn: 4, jetDmg: 30, jetLen: 160, burstDmg: 25 }` |
| `eternal_tea_party` | Eternal Tea Party | "EVOLUTION! A flying teapot pours a scalding tea moat around you and warm tea on your path; six sturdy cups fling hot droplets and block shots." | `{ dmg: 16, cd: 1.2, amount: 6, speed: 3.4, every: 0.4, moatR: 44, moatW: 10, moatDmg: 10, slow: 0.7, dropDmg: 12, killHeal: 8, petit: 0.02, pour: 2, puddleR: 20, puddleDmg: 8, life: 4, heal: 3.5, block: 2, mend: 1.5 }` |
| `al_dente_armageddon` | Al Dente Armageddon | "EVOLUTION! 24-missile salvos. The trails are now actual spaghetti. The spaghetti is on fire." | `{ dmg: 14, cd: 1.8, amount: 24, speed: 190, turn: 6, blast: 18, knock: 40, sauceDmg: 6, sauceLife: 1.2 }` |
| `dere_dere_harisen` | Dere Dere Harisen | "EVOLUTION! A heart-shaped fan smacks all around you. Smacked enemies become projectiles. '...b-baka ♡'" | `{ dmg: 60, cd: 1.1, amount: 1, radius: 54, knock: 320, stun: 0.5, missile: 0.6, healPer: 1, healMax: 3 }` |
| `shoujo_filter` | Shoujo Filter | "EVOLUTION! Everything near you is drawn in shoujo style. Charmed enemies hit 3× harder; every 6 s, a Kira Kira Moment charms them all." | `{ dmg: 10, cd: 0.4, amount: 1, radius: 64, charm: 0.2, duration: 4, max: 20, charmDmgMul: 3, critBonus: 0.5, kiraEvery: 6, kiraTime: 2 }` |
| `infinite_henshin_loop` | Infinite Henshin Loop | "EVOLUTION! You never stop transforming. Every henshin leaves a Plot Armor shield." | `{ dmg: 70, cd: 2.5, amount: 1, radius: 88, iframe: 0.9, ribbons: 12, ribbonDmg: 18, knock: 200 }` |
| `cheat_meteor` | Meteor Lv.99999 | "EVOLUTION! He trained (once). Meteors fall on the biggest crowd; every third one is... a lot." | `{ dmg: 120, cd: 2.4, amount: 1, blast: 48, overdo: 3, overdoBlast: 110, small: 2, smallDmg: 30, knock: 160 }` |
| `isekai_rush_hour` | Isekai Rush Hour | "EVOLUTION! The honk goes 360° and phantom trucks plough through crowds on a schedule." | `{ dmg: 40, cd: 1.5, amount: 1, radius: 72, knock: 220, ram: 45, truckEvery: 4, truckDmg: 90, truckSpeed: 480, isekai: 0.4 }` |
| `tapioca_tsunami` | Tapioca Tsunami | "EVOLUTION! Giant boba pearls bounce 8 times and shed regular pearls on every bounce." | `{ dmg: 30, cd: 1.6, amount: 2, speed: 160, bounce: 8, shed: 3, shedDmg: 14, shedBounce: 2, knock: 60 }` |
| `thousand_crane_wish` | Thousand Crane Wish | "EVOLUTION! Twelve golden cranes. Every 1,000 crane kills grants a Wish: a full heal and a golden crane storm." | `{ dmg: 36, cd: 0.7, amount: 12, speed: 210, range: 130, pierce: 4, knock: 30, wish: 1000, stormDmg: 200 }` (§9: dmg was 22, pierce 3) |
| `sold_out_dome_tour` | Sold-Out Dome Tour | "EVOLUTION! Spotlight waves on every beat, and every 8 beats the whole screen gets an ENCORE." | `{ dmg: 22, every: 1, amount: 4, arc: 90, range: 110, knock: 50, encore: 8, encoreDmg: 40, rank: 0.12 }` |
| `eternal_winter_break` | Eternal Winter Break | "EVOLUTION! The kotatsu comes with you, pulls in gems, and lobs mikan when you get Too Comfy." | `{ dmg: 24, cd: 0.4, amount: 1, radius: 64, slow: 0.4, armor: 3, regen: 3, comfy: 3, gemPull: 120, mikanEvery: 0.5, mikanDmg: 20 }` (§9: dmg was 14, armor 2, regen 1.5) |

Behaviour details:

- **Unsealed Abyss Dragon** (sfx `fireball`, jet `beamBig`): one `w_abyss_dragon`
  (24×24×4) orbits the hero at r `orbit` (1.6 rad/s), breathing continuously
  outward (cone points along the radial direction), ticks every 0.1 s, burn
  `burnDps` for `burn` s. Every `cd` s, **ABYSSAL LORD'S JUDGEMENT**: a straight
  jet (len `jetLen`, half width 5) at the highest-HP enemy in view, `jetDmg`
  every 0.1 s for 0.5 s. Burning enemies that die explode (r 18, `burstDmg`).
  Flames use `w_abyss_fire` (10×10×4, black-violet with a magenta core).
- **Eternal Tea Party** (sfx `teacup`): `w_teapot_big` (24×20×2, f1 pouring)
  hovers 22 px above the hero. A tea moat: ring band (`SHAPE_RING`) r `moatR` ×
  area, width `moatW`, `moatDmg` every 0.4 s, slow ×`slow`. Six cups orbit at r 30
  (contact `dmg`); every `cd` s each cup flings a `w_tea_drop` (6×6×2) at the
  nearest enemy outside the moat (`dropDmg`). The hero heals 1 HP per `killHeal`
  kills inside the moat (× healMul); kills inside have a `petit` chance to drop
  a petit four (`w_petit_four`, food, heal 5). Every `pour` s × cooldown the
  teapot pours a puddle (r `puddleR` × area, `puddleDmg`, `life` s) on her path
  (at her feet while she stands still): Warm Tea at `heal` HP/s, so evolving never
  costs Pudding her healing. The cups are Orbital Guards that soak `block` 2
  bullets each and mend in `mend` s (scaled, §7); a broken cup does not fling.
- **Al Dente Armageddon** (sfx `missile`): as the base weapon with the evo
  numbers; each missile drops 3 sauce splats (`w_sauce`, 12×8×2 decal, r 8) at
  25/50/75% of its flight; enemies on a splat take `sauceDmg` every 0.3 s for
  `sauceLife` s. Missiles `w_missile_evo` (10×8×2, red meatball tip), trail preset
  `"spaghetti_evo"` (2-px pale-yellow noodle, wavier).
- **Dere Dere Harisen** (sfx `fanSmack`): 360° smack (circle r `radius` × area)
  every `cd` s. Knocked enemies fly as projectiles for 0.5 s: anything they hit
  takes `missile` × smack damage (max 3 victims each). Each smack heals `healPer`
  HP per enemy hit (max `healMax`) × healMul. Pops use `fx_baka` f1 (small pink
  "...baka♡"). Sprite `w_harisen_evo` (48×48×4, heart-shaped fan whirl).
- **Shoujo Filter** (sfx `sparkleCharm`): aura as the base with the evo numbers;
  charmed enemies deal ×`charmDmgMul`; crits landed on charmed enemies by any
  source get +`critBonus` crit multiplier. Every `kiraEvery` s, **KIRA KIRA
  MOMENT**: every non-boss enemy in the aura is charmed for `kiraTime` s (bosses
  are Distracted: their pattern pauses 1.0 s, at most once per 12 s per boss).
  Visual: `fx_rose_big` (16×16×2) at the four diagonal points of the aura,
  slowly rotating; screentone dot ring (`fx_px` lavender); pop `KIRA KIRA♡`.
- **Infinite Henshin Loop** (sfx `transform`): as the base with the evo numbers;
  each henshin grants a shield charge (max 1, lasts until hit), the burst heals 3
  and always clears bullets in its radius. Narration pop at most once per 30 s:
  `That's the 47th transformation this episode.` Ribbons `w_ribbon_evo` (gold).
- **Meteor Lv.99999** (sfx `explosionBig`): every `cd` s a `w_meteor_cheat`
  (24×32×2) falls (`PK_FALL` from 220 px, telegraph circle) on the densest
  cluster: r `blast` × area, `dmg`. Every `overdo`-th meteor: r `overdoBlast`,
  ×3 damage, white flash, shake 0.6, crater r 40 for 3 s, text
  `...did I overdo it again?`. Between meteors, `small` regular fireballs every
  1.2 s (`smallDmg`).
- **Isekai Rush Hour** (sfx `honk`): 360° honk ring r `radius` × area every `cd`
  s. Every `truckEvery` s a phantom truck (`truck_kun_run` ×1.5, tint
  `0xbafff6`, alpha 0.7, speed lines) drives across the view through the densest
  cluster after a 0.4 s lane telegraph: `truckDmg`, pierce ∞, knockback 300
  along the lane. Ram `ram`. Isekai'd extra-gem chance `isekai`.
- **Tapioca Tsunami** (sfx `boba`): giant pearls (`w_boba_big` 14×14×2, r 7 ×
  area) bounce `bounce` times; every bounce sheds `shed` regular pearls
  (`shedDmg`, `shedBounce` bounces).
- **Thousand Crane Wish** (sfx `paperCrane`): golden cranes (`w_crane_gold`).
  The HUD icon shows a counter `742/1000` of crane kills. At `wish` kills: full
  heal, 3 s golden crane storm (60 cranes sweep the view, every enemy in view takes
  `stormDmg` once), banner `WISH GRANTED!`, counter resets.
- **Sold-Out Dome Tour** (sfx `lightstick`): every beat, `amount` arcs 90° apart,
  rotating 45° per beat. Every `encore` beats: **ENCORE!** every enemy in view
  takes `encoreDmg`; ~20 `w_lightstick` (6×14×2, random tints) wave along the
  bottom edge of the view for 1 s. Combo bonus +`rank` per rank.
- **Eternal Winter Break** (sfx `snore`): `w_kotatsu_evo` (40×28×4, mikan bowl
  on top) is always deployed and moves with the hero (while moving: r 48, damage
  ×0.6). Gems within `gemPull` px drift in. Too Comfy after `comfy` s still: r
  ×1.5, damage ×3, and — unlike the base — weapons keep firing; mikan
  (`w_mikan` 8×8×2) are lobbed at random enemies in view every `mikanEvery` s
  (`mikanDmg`, r 12 splash).

---

## 4. Limit Breaks (mastery rank 5 → Lv6, rank 10 → Lv7)

`WeaponDef.limitBreak` entries (contract `LimitBreak`: `dmg` fraction of the
Lv5 damage, `amount`, `area` fraction, `cd` multiplier, `text`). The card
reads `LIMIT BREAK!` with a gold frame; Lv7 cards read `MASTERED!`.

| Weapon | Lv6 | Lv6 card text | Lv7 | Lv7 card text |
| --- | --- | --- | --- | --- |
| star_shot | `{dmg: 0.15, amount: 1}` | "LIMIT BREAK — Idol Stamina: +1 star, +15% damage" | `{dmg: 0.25, amount: 1, cd: 0.9}` | "MASTERED — Sold-Out Show: +1 star, +25% damage, −10% cooldown" |
| petal_slash | `{dmg: 0.2, area: 0.15}` | "LIMIT BREAK — Whetstone: +20% damage, +15% area" | `{dmg: 0.25, cd: 0.85}` | "MASTERED — One Thousand Cuts: +25% damage, −15% cooldown" |
| yarn_orbit | `{amount: 1, dmg: 0.15}` | "LIMIT BREAK — Spare Yarn: +1 ball, +15% damage" | `{area: 0.2, dmg: 0.2}` | "MASTERED — Big Ball Energy: +20% area, +20% damage" |
| heart_boomerang | `{amount: 1, dmg: 0.1}` | "LIMIT BREAK — Second Date: +1 heart, +10% damage" | `{dmg: 0.25, area: 0.15}` | "MASTERED — True Love: +25% damage, +15% area" |
| thunder_bell | `{amount: 1, dmg: 0.15}` | "LIMIT BREAK — Extra Bell: +1 strike, +15% damage" | `{dmg: 0.25, cd: 0.88}` | "MASTERED — Shrine Festival: +25% damage, −12% cooldown" |
| candy_bomb | `{area: 0.2, dmg: 0.15}` | "LIMIT BREAK — Family Size: +20% blast, +15% damage" | `{amount: 1, dmg: 0.2}` | "MASTERED — Trick AND Treat: +1 bomb, +20% damage" |
| bubble_aura | `{area: 0.15, dmg: 0.2}` | "LIMIT BREAK — Extra Foam: +15% area, +20% damage" | `{dmg: 0.3, cd: 0.9}` | "MASTERED — Bath Time: +30% damage, ticks 10% faster" |
| prism_beam | `{amount: 1, dmg: 0.1}` | "LIMIT BREAK — Spare Prism: +1 beam, +10% damage" | `{dmg: 0.3, area: 0.15}` | "MASTERED — Full Spectrum: +30% damage, +15% beam size" |
| dark_flame_dragon | `{dmg: 0.2, area: 0.15}` | "LIMIT BREAK — Seal Weakening: +20% damage, +15% flame size" | `{amount: 1, dmg: 0.2}` | "MASTERED — The Trilogy: +1 dragon, +20% damage" |
| teapot_tempest | `{amount: 1, dmg: 0.15}` | "LIMIT BREAK — Guest Cup: +1 teacup, +15% damage" | `{area: 0.2, cd: 0.85}` | "MASTERED — Bottomless Pot: +20% puddle size, spills 15% faster" |
| micro_missile_swarm | `{amount: 1, dmg: 0.1}` | "LIMIT BREAK — More Pasta: +2 missiles, +10% damage" | `{dmg: 0.25, area: 0.15}` | "MASTERED — Extra Sauce: +25% damage, +15% blast" |
| baka_harisen | `{dmg: 0.25, area: 0.1}` | "LIMIT BREAK — Thicker Paper: +25% damage, +10% fan size" | `{cd: 0.85, dmg: 0.2}` | "MASTERED — Reflex Smack: −15% cooldown, +20% damage" |
| notice_me_sparkles | `{area: 0.15, dmg: 0.2}` | "LIMIT BREAK — Extra Sparkle: +15% aura, +20% damage" | `{dmg: 0.2, cd: 0.88}` | "MASTERED — Unbearable Charisma: +20% damage, ticks 12% faster" |
| henshin_burst | `{dmg: 0.25, area: 0.1}` | "LIMIT BREAK — Season 2 Costume: +25% damage, +10% burst" | `{cd: 0.85, amount: 1}` | "MASTERED — Stock Footage: −15% cooldown, +2 ribbons" |
| cheat_fireball | `{amount: 1, dmg: 0.1}` | "LIMIT BREAK — Dual Cast (Accidentally): +1 fireball, +10% damage" | `{dmg: 0.25, area: 0.2}` | "MASTERED — Lv.10000: +25% damage, +20% blast" |
| horn_of_reincarnation | `{dmg: 0.2, area: 0.15}` | "LIMIT BREAK — Air Horn Upgrade: +20% damage, +15% honk" | `{cd: 0.85, dmg: 0.2}` | "MASTERED — Rush Hour: −15% cooldown, +20% damage" |
| bubble_tea_cannon | `{amount: 1, dmg: 0.1}` | "LIMIT BREAK — Extra Pearls: +1 pearl, +10% damage" | `{dmg: 0.25, cd: 0.9}` | "MASTERED — Brown Sugar: +25% damage, −10% cooldown" |
| paper_crane_flock | `{amount: 1, dmg: 0.1}` | "LIMIT BREAK — Another Fold: +1 crane, +10% damage" | `{amount: 1, dmg: 0.2}` | "MASTERED — Origami Master: +1 crane, +20% damage" |
| idol_lightstick_wave | `{dmg: 0.2, area: 0.15}` | "LIMIT BREAK — Front Row: +20% damage, +15% reach" | `{dmg: 0.3, amount: 1}` | "MASTERED — Stadium Show: +30% damage, +1 wave" |
| kotatsu_of_sloth | `{area: 0.2, dmg: 0.15}` | "LIMIT BREAK — Bigger Blanket: +20% area, +15% damage" | `{dmg: 0.3, cd: 0.85}` | "MASTERED — Professional Napper: +30% damage, ticks 15% faster" |

A Limit Break `amount` converts exactly like the `amount` stat does for that
weapon: Micro Missile Swarm +2 missiles, Notice-Me Sparkles +2 max charmed,
Henshin Burst +2 ribbons, Kotatsu of Sloth +8% radius, Idol Lightstick Wave
+1 arc.

**Inheritance rule (proposed for the sim):** an evolution inherits +15% damage
for each Limit Break level its base weapon had when it evolved (Lv6: +15%,
Lv7: +30%), shown on the evolution card as `+30% (Limit Break)`. So evolving
at Lv5 is faster, waiting for Lv7 is stronger — a real choice.

---

## 5. The 8 new passives (5 levels)

Same shape as `src/game/passives.ts`. `levels` texts are exact. New stat
`hitbox` (multiplier on the player radius, default 1) is required for Chibi
Charm (see README).

| id | Name | Icon art (16×16) | levels text (Lv1..5) | `apply(s, l)` |
| --- | --- | --- | --- | --- |
| `plot_armor` | Plot Armor | a gold shield made of a rolled-up script with a red bookmark ribbon and a star | `Damage taken -${5l}%` | `s.dmgReduction += 0.05 * l` |
| `main_character_aura` | Main Character Aura | a radiant sunburst ring with sparkles around an empty silhouette head | `Crit damage +${15l}%` | `s.critMult += 0.15 * l` |
| `bento_box` | Bento Box | a pink bento box (lid ajar) with onigiri and an octopus sausage | `Regen +${(0.15*l).toFixed(2)}/s, healing +${10l}%` | `s.regen += 0.15 * l; s.healMul += 0.1 * l` |
| `speed_lines` | Speed Lines | three white motion streaks behind a tiny yellow star | `Projectile speed +${12l}%, knockback +${5l}%` | `s.projSpeed += 0.12 * l; s.knock += 0.05 * l` |
| `inner_monologue` | Inner Monologue | a thought bubble with "..." and a small sweat drop | `Duration +${10l}%` | `s.duration += 0.1 * l` |
| `training_montage` | Training Montage | a red headband (hachimaki) wrapped around a dumbbell, sweat drop | `XP +${8l}%` | `s.growth += 0.08 * l` |
| `friendship_bracelet` | Friendship Bracelet | a woven pastel bracelet with a heart bead and a star bead | `Damage +${1.5l}% per different weapon held` | install a `statMods` entry: `s.might += 0.015 * l * distinctWeapons` (an evolution counts as its own weapon; recompute on weapon change) |
| `chibi_charm` | Chibi Charm | a tiny chibi keychain (round head, dot eyes) on a pink ring | `Hitbox -${8l}%, pickup range +${15l}%` | `s.hitbox -= 0.08 * l; s.pickup += 0.15 * l` |

---

## 6. Unlocks and codex hints

New weapons and passives are not in the level-up pool until unlocked
(`RunConfig.weaponPool` / `passivePool`). The codex shows a silhouette with the
hint until then. Counter keys are defined in `achievements.md` §1; each unlock
is granted by the matching achievement listed there.

| Item | Unlock condition | Achievement | Codex hint (shown as "??? — …") |
| --- | --- | --- | --- |
| Dark Flame Dragon | unlock Kuro (survive 6:00 in Dream Meadow) | `kuro_awakens` | "Comes bundled with a certain chuunibyou. Survive 6:00 in Dream Meadow." |
| Teapot Tempest | unlock Pudding (clear Dream Meadow) | `clear_stage_1` | "Served only after Dream Meadow is cleared." |
| Micro Missile Swarm | unlock Aoi (clear Candy Kingdom) | `clear_stage_2` | "A mecha pilot is waiting past the Candy Kingdom." |
| Baka Harisen | unlock Akane (clear Shoujo Academy) | `clear_stage_3` | "Graduate from Shoujo Academy. N-not that she's waiting for you." |
| Notice-Me Sparkles | own Senpai | (gacha) | "Pulled with Senpai. He won't notice you either way." |
| Henshin Burst | own Magical Girl #47 | (gacha) | "Comes with Magical Girl #... #4-something." |
| Cheat Fireball | own Isekai-kun | (gacha) | "Pulled with Isekai-kun. Probably overpowered." |
| Horn of Reincarnation | own Truck-kun | (gacha) | "HONK." |
| Bubble Tea Cannon | 1,000 lifetime Puff kills | `boba_origins` | "Puffs are chewy. Squish a thousand of them." |
| Paper Crane Flock | evolve 600 weapons (lifetime; the economy pass made it the late-game unlock, ~40-60 h for the mid bot) | `evolve_10` | "Fold 600 evolutions. Legend says a thousand folds grant a wish; the other 400 are sold separately." |
| Idol Lightstick Wave | reach SSS rank | `rank_sss` | "The crowd only cheers for SSS." |
| Kotatsu of Sloth | survive 3:00 without dashing | `no_dash` | "Have you tried... not dashing? For three whole minutes?" |
| Plot Armor | take 5,000 damage (lifetime) | `damage_5000` | "Take five thousand damage. Walk it off. Character building." |
| Main Character Aura | reach S rank | `rank_s` | "Reach S rank. Main characters always do." |
| Bento Box | eat 50 food items (lifetime) | `snacks_50` | "Eat fifty snacks. Heroes are growing." |
| Speed Lines | dash 500 times (lifetime) | `dashes_500` | "Dash five hundred times. Feel the lines." |
| Inner Monologue | use Overdrive 25 times (lifetime) | `ults_25` | "Shout twenty-five attack names." |
| Training Montage | reach level 25 in one run | `level_25` | "Reach level 25 in one episode. Cue the montage music." |
| Friendship Bracelet | own 4 heroes | `heroes_4` | "Make four friends. (Heroes count.)" |
| Chibi Charm | 2:00 without taking damage | `no_hit_120` | "Two minutes without a scratch. Be small. Be unhittable." |

The canonical rule list (with the 3 rows that differ from the current
`UNLOCK_RULES`) is in `achievements.md` §1.

Signature weapons enter the general pool once their hero is owned (any hero can
then find them on level-up cards).

---

## 7. Orbital Guard (Season 3 balance pass)

Owner feedback: orbitals felt weak against shooters, and late game is a bullet hell. Every weapon whose bodies
**orbit the hero** now also guards her (`src/game/weapons/_orbital.ts`, shared):

- A body that is up destroys every **enemy bullet** (`world.bullets`) it touches - a pop at the contact point.
  Boss beams, slams, dash lanes and telegraphed blasts are not bullets and are never blocked.
- After `block` bullets it **breaks** with a small explosion in the weapon colour (a white flash, sparkles and
  bits, a quick ring - gone in under half a second): no hits, hidden, for its **mend time**; then it
  **reforms**, simply popping back in (a speck of sparkle, no sound). Nothing marks a broken body or its
  recovery - the slot is empty space until it is back (owner feedback: a cooldown marker was clutter and
  impossible to track in the chaos). A chipped body (block > 1) is whole again after its mend time without a
  hit, and looks the same chipped or not.
- Mend time = `mend` s × (0.5 + 0.5 × **cooldown**) × (bodies / own bodies)^0.5 × (1 + 0.5 per extra guarding
  weapon) - the knobs are `CFG.guard` (`cd`, `amount`, `share`; lab what-if `--set "cfg.guard.amount=1"`):
  - Wish Charm / Polite Bow builds recover faster, at half the stat's rate (the 0.35 floor mends in 0.68×).
  - Bodies from the **Amount** stat (Twin Charm, relics, board) widen the ring but share its guard: a Cosmic
    Yarn with +5 amount has 11 planets that each mend (11/6)^0.5 = 1.35× slower. A weapon's own bodies (level,
    Limit Break, Infinite Yarn's +2, Extra Cups) don't dilute.
  - Pudding holding a Yarn Orbit too: two rings, one recovery (each mends 1.5× slower).
- Only the hero's own weapons guard: **A Real Friend**'s copy of the start weapon orbits the Friend and never
  blocks (the relic "never blocks anything"), and its puddles never heal (one Warm Tea).
- Blocks count in `RunStats.orbitalBlocks` (for a future Plot Point; the balance lab's slice / boss samples
  record them as `blocks`).

**Reviewer pass (why the limits).** With `mend` × cooldown alone, a strong late build multiplied the guard
three ways (P7 bot build: cooldown 0.685, area ×2.09, +5 amount): a P7 Cosmic Yarn ate 95 % of a 15 bullet/s
aimed storm (5 % reached the hero vs 49 % bare), Cosmic Yarn + Eternal Tea Party ate all of it.
With the limits: 15 % (Cosmic Yarn) and 7 % (both) reach her, 31 % / 29 % at 40 bullet/s
(`tests/orbitals.test.ts` keeps both above a floor). Mid-game is untouched within noise: Shoujo Academy P4
(Mochi + Pudding, seeds 1-4) clears 52 % vs 54 % with the uncapped rule (a full n / own dilution: 46 %).

| Weapon | body (radius) | block | mend (s, before the factors above) |
| --- | --- | --- | --- |
| Yarn Orbit | yarn ball (5 × area) | 1 | 2.5 (Lv5: 2.2) |
| Cosmic Yarn | planet (7 × area) | 3 | 1.5 |
| Meowteor Hammer (§8) | spiked ball (8 × area), ring swinging 26-74 px | 1 | 2.2 |
| Teapot Tempest | teacup (5) | 1 | 2.5 (Lv5: 2.2) |
| Eternal Tea Party | teacup (5) | 2 | 1.5 |

Yarn Orbit keeps its 3 s on / 1.3 s off cycle: a ball broken at the end of the on phase is still down (mending)
when the next balls come out. With the guard in, Yarn Orbit / Cosmic Yarn got a small offence bump toward the
weapon median (balance lab gauge, crowd DPS): Yarn Orbit Lv3 dmg 13 -> 14, Lv4 dmg 13 -> 14 and area 1.15 -> 1.2,
Lv5 dmg 16 -> 20 and area 1.2 -> 1.3 (L5 1150 -> 1528, 0.67x -> 0.88x the median); Cosmic Yarn dmg 19 -> 27, area
1 -> 1.15 (2113 -> 3382, 0.51x -> 0.81x the evolution median). Near the median, not the top: they defend too. (The weapon bench pass, §9, raised both again: in real fights - not the gauge - they were 0.26x / 0.45x.)

Weapons checked and left out (no orbiting contact bodies):

- **Dark Flame Dragon** - the familiars sit on fixed shoulder offsets (no orbit, no contact hit: r 0) and the
  weapon is already 2.4x the median; **Unsealed Abyss Dragon**'s single dragon circles to aim its breath, its job
  is the burn and the judgement jet.
- **Paper Crane Flock** - cranes leave the flock to dart at anything in range (most of a bullet-hell fight), so a
  guard would flicker on and off; their identity is Folded Tighter / crumpling when the hero is hurt.
- **Micro Missile Swarm** - missiles fly outward and home; nothing orbits (Aoi's C6 drone is a shooter).

---

## 8. Second evolutions

Owner request: "give every weapon a SECOND evolution through a different passive, so builds have a real
choice". A base weapon now lists its evolutions (`WeaponDef.evolutions`, the first entry = §1's pair, read
through `evolutionsOf()` in `src/game/registry.ts`); the second entry is a **sidegrade**, not an upgrade of
the first: the same evolution budget (crowd DPS on the lab gauge within about 0.8-1.4× its first
evolution), spent on a different play style.

**Rules of the choice** (sim: `src/game/upgrades.ts`, `World.pendingChoices`; tests: `tests/evo2.test.ts`):

- A route is ready when the base weapon is at Lv5 and that route's passive is held (as §1).
- One passive held: level-ups and chests evolve down that route, exactly as before.
- Both passives held: a level-up offers **one card per evolution** (both first in the offer) and the pick
  decides; the other route is gone with the base weapon. A chest never decides for the player: its reward is a
  **ROUTE SPLIT** card and the pick between the evolutions opens in the card picker right after the chest (no
  level is spent on it; no reroll / banish / skip).
- Either evolution uses its base weapon's mastery, `weaponDamage`, talent and Limit Break inheritance
  entries, counts toward the same mastery XP, and is its own codex discovery (the Wiki shows a weapon's
  recipes one by one, each hidden until that evolution has been made once; evolution hints likewise).
- A Real Friend mirrors whichever evolution the start weapon took; Author's Original Manuscript still drafts
  the **first** evolution's passive.

**Design rules:** a different passive from the first evolution; no passive gates more than 3 evolutions
(8 passives gate 3, 8 gate 2: 40 recipes over 16 passives); hero-signature weapons stay in character
(`heroes.md`); the joke is on the trope, never on people or real works (`satire.md`); no cooldown markers
or status rings on the hero; player fx that can land on her fade in the hero focus zone (`Flag.Focus`).

### 8.1 The table

Status: `done` = implemented (the coverage test then checks id, name, base and passive against this row);
`designed` = to do. Package = the work package (§8.3) that owns it.

| Base weapon | File (`src/game/weapons/`) | First evolution (passive) | Second evolution | id | + Passive | Package | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Star Shot | `star-shot.ts` | Galaxy Barrage (Wish Charm) | Critical Constellation | `critical_constellation` | Lucky Clover | A | done |
| Petal Slash | `petal-slash.ts` | Sakura Tempest (Big Ribbon) | Already Cut | `already_cut` | Swift Shoes | A | done |
| Yarn Orbit | `yarn-orbit.ts` | Cosmic Yarn (Magnet Star) | Meowteor Hammer | `meowteor_hammer` | Power Bow | pilot | done |
| Heart Boomerang | `heart-boomerang.ts` | Love Tornado (Twin Charm) | Unrequited Heart | `unrequited_heart` | Heart Locket | A | done |
| Thunder Bell | `thunder-bell.ts` | Raijin Drum (Power Bow) | Group Chat Lightning | `group_chat_lightning` | Friendship Bracelet | A | done |
| Candy Bomb | `candy-bomb.ts` | Sugar Nuke (Lucky Clover) | Konpeito Minefield | `konpeito_minefield` | Chibi Charm | A | done |
| Bubble Aura | `bubble-aura.ts` | Ocean Dome (Heart Locket) | Soap Opera | `soap_opera` | Inner Monologue | B | done |
| Prism Beam | `prism-beam.ts` | Rainbow Cannon (Swift Shoes) | Refraction Overload | `refraction_overload` | Lucky Clover | B | done |
| Dark Flame Dragon | `dark-flame-dragon.ts` | Unsealed Abyss Dragon (Inner Monologue) | Unbandaged Right Arm | `unbandaged_right_arm` | Main Character Aura | C | done |
| Teapot Tempest | `teapot-tempest.ts` | Eternal Tea Party (Bento Box) | Table-Flip Tea Service | `table_flip_service` | Speed Lines | C | done |
| Micro Missile Swarm | `micro-missile-swarm.ts` | Al Dente Armageddon (Speed Lines) | Final Episode Budget Missile | `budget_missile` | Big Ribbon | C | done |
| Baka Harisen | `baka-harisen.ts` | Dere Dere Harisen (Friendship Bracelet) | Tsun Tsun Drill Harisen | `tsun_tsun_drill` | Speed Lines | C | done |
| Notice-Me Sparkles | `notice-me-sparkles.ts` | Shoujo Filter (Main Character Aura) | Who Are You Again? | `who_are_you_again` | Heart Locket | D | done |
| Henshin Burst | `henshin-burst.ts` | Infinite Henshin Loop (Plot Armor) | Skip Intro | `skip_intro` | Wish Charm | D | done |
| Cheat Fireball | `cheat-fireball.ts` | Meteor Lv.99999 (Training Montage) | "Holding Back" Fireball | `holding_back` | Twin Charm | D | done |
| Horn of Reincarnation | `horn-of-reincarnation.ts` | Isekai Rush Hour (Swift Shoes) | Free Delivery | `free_delivery` | Magnet Star | D | done |
| Bubble Tea Cannon | `bubble-tea-cannon.ts` | Tapioca Tsunami (Big Ribbon) | Brown Sugar Railgun | `brown_sugar_railgun` | Power Bow | B | done |
| Paper Crane Flock | `paper-crane-flock.ts` | Thousand Crane Wish (Wish Charm) | Failed Exam Storm | `failed_exam_storm` | Training Montage | B | done |
| Idol Lightstick Wave | `idol-lightstick-wave.ts` | Sold-Out Dome Tour (Twin Charm) | Underground Mosh Pit | `mosh_pit` | Plot Armor | B | done |
| Kotatsu of Sloth | `kotatsu-of-sloth.ts` | Eternal Winter Break (Chibi Charm) | All-You-Can-Eat Nabe | `all_you_can_eat_nabe` | Bento Box | D | done |

Passive load after all 20 (first + second evolutions): Power Bow 3, Wish Charm 3, Big Ribbon 3, Twin Charm 3,
Swift Shoes 3, Lucky Clover 3, Speed Lines 3, Heart Locket 3; Magnet Star 2, Plot Armor 2, Main Character
Aura 2, Bento Box 2, Inner Monologue 2, Training Montage 2, Friendship Bracelet 2, Chibi Charm 2.

### 8.2 The designs

Each entry: card `desc` (the wiki text too), the mechanic, how it plays against the first evolution, and
sprite + fx notes. Numbers are starting points: tune each on the lab gauge against its first evolution
(`npm run balance:lab -- --job '{"kind":"gauge","hero":"hoshi","cp":null,"weapons":[["<id>",1]],"T":6}'`).
Icons are `icon_<id>` (16×16, gold twinkle); world sprites and manifest rows go in the package's
`src/art/sprites/evo2-<package>.ts`, view fx in `src/view/evo2/<package>.ts`. Reuse existing sfx ids.

**Meowteor Hammer** (`meowteor_hammer`, Yarn Orbit + Power Bow; pilot, done). "EVOLUTION! 4 spiked yarn
wrecking balls swing far out and SLAM on every swing. Blocking is somebody else's arc."
`{ dmg: 46, cd: 2.0, amount: 4, area: 1.15, speed: 4.4, knock: 110, every: 0.3, block: 1, mend: 2.2, rIn: 26, rOut: 74, slam: 30, slamDmg: 170 }`
(the sibling pass of §9.1; the pilot shipped `dmg` 28, `cd` 2.6, `knock` 90, `slam` 26, `slamDmg` 90).
Four permanent spiked balls (`w_meowteor`, 16×16×2, body r 8 × area) circle at `speed` rad/s on a ring whose
radius swings `rIn` -> `rOut` -> `rIn` (× area) once per `cd` s (× the cooldown stat); at the far point every
ball that is up SLAMS: a blast r `slam` × area for `slamDmg` (scaled like `dmg`), knock × 1.6, as the
weapon's own source (it is an explosion: blast hooks and Marshmallow toasting apply). **Versus Cosmic
Yarn:** about 1.4× its crowd DPS on the gauge (4,688 vs 3,382) and nearly four times the ground swept, but
no gem pull, slightly less on a single boss (95 vs 104), and the Orbital Guard of the base weapon (`block` 1,
`mend` 2.2, a broken ball does not slam) on a ring that is far from her for half of every swing: Cosmic Yarn
is the safe route, this one hits. Fx: the generic blast plus an orange ring and yarn bits (`src/view/evo2/pilot.ts`,
particles on the fx layers); sfx: `orbitHit` hits, the generic `explosion`.

**Critical Constellation** (`critical_constellation`, Star Shot + Lucky Clover; package A, done). "EVOLUTION! Five
heavy comet stars. Every critical hit draws the next star of the constellation."
`{ dmg: 88, cd: 1.6, amount: 5, speed: 150, pierce: 4, knock: 60, mini: 0.5 }`.
Every `cd` s a volley of `amount` comets (0.07 s apart; `w_comet_star` 16×16×2, r 8, no homing, a slight lead)
flies at the `amount` highest-HP enemies in view, one each (fewer enemies: they share; with a boss in view every
fourth comet - the 1st, the 5th ... - is aimed at the boss: §9.1). The first hit of each
comet always crits; what it pierces afterwards rolls like any hit. A crit of the weapon that kills (bosses
excepted) splits into two mini stars of `mini` × `dmg` (`miniStar`, the weapon's own source, so their crits
draw on; 14 splits a second at most). Hoshi's Star Shot talents and constellations read it as Star Shot (Fan
Chant +1 pierce, Backup Dancers +1 comet a rank, Falling Star, C6; `starInst()`). **Versus Galaxy Barrage**
(a constant spiral stream): burst with long gaps, aimed at whatever has the most HP, scaling with crit and crit
damage instead of cooldown. Gauge 1,532 crowd / 583 boss against 1,335 / 455 (1.15× / 1.28×); in the weapon
bench's real runs 27,281 DPS in the build against 25,458, but 1,082 on the boss against Galaxy Barrage's 2,782
(which the bench flags as far above its tier). Fx (`src/view/evo2/a.ts`): the "comet" trail; every crit is linked
to the previous one (within 0.7 s and 130 px) by a 1-px pale line on a gold bed for 0.45 s, a twinkle on the new star
(`Flag.Focus`, no glow), a small ring on a crit kill; sfx `starShot`.

**Already Cut** (`already_cut`, Petal Slash + Swift Shoes; Rin; package A, done). "EVOLUTION! One long cut the
way you face. Nothing happens. Then she sheathes the blade."
`{ dmg: 54, cd: 1.3, amount: 1, area: 1, knock: 40, len: 150, wid: 14, wait: 0.45, moved: 0.5, petals: 3, petalDmg: 14 }`
(§9.1: `dmg` was 62; Sakura Tempest went from `dmg` 28 / `petalDmg` 14 to 33 / 17).
Every `cd` s a line cut `len` × `wid` px (× area) from the hero: no damage on the cut, every enemy on the line
is **marked** (48 at most); `wait` s later (the sheath click) every mark still standing takes `dmg` at once,
+`moved` if Rin has walked more than 6 px since the cut. A mark that dies sheds `petals` petal blades
(`petalDmg`, pierce 3) that fly on down the line. The line follows the way she last moved - with one piece of
aim assist, as Petal Slash has its own: if another line (the nearest enemy's, or one of 12 around the clock)
holds more than twice as many enemies, she turns to that one, so a cut is never spent on air while a horde
chases her (the pure movement aim played badly on a phone: the horde is behind a kiting hero). Extra Amount
fans more cuts ±0.3 rad around the first; Rin's talents: Wide Stance widens it, Petal Storm's blades fly on the
cut, every 3rd draw is a Crescent Moon cut (2.5× as wide, ×1.5) instead of the 360° moon slash. **Versus Sakura
Tempest** (stand in the middle, 360°): one direction, delayed, a whole line at once, nothing behind her. Gauge
2,687 crowd / 66 boss against 2,106 / 77 (1.28× / 0.86×); in the bench's real runs 15,544 DPS in the build / 214
on the boss against 6,051 / 222 and 401 solo kills a minute against 151 (Sakura Tempest is the weak one of the
tier there: a later pass should lift it rather than cut this). Sprites: `w_iai_line` 48×8×3 (a white hairline
in a pink sheath -> pink afterimage -> wisps, stretched along the cut, `Flag.Focus`), `fx_sheath` 12×12×2 glint
on the hero's hip at the click (her own look: no Focus). Fx: a white slit on every marked enemy, flickering
faster as the click comes, then two pink halves flying apart and petals on each delayed hit; a small shake on
a click of 3+ marks; sfx `slash` on the cut, `hitCrit` on the click.

**Unrequited Heart** (`unrequited_heart`, Heart Boomerang + Heart Locket; package A, done). "EVOLUTION! One big
heart picks one enemy and keeps coming back. It will not take the hint."
`{ dmg: 58, cd: 0, amount: 1, area: 1, speed: 320, knock: 14, range: 140, ramp: 0.08, rampMax: 1.2, through: 0.6, heal: 0.5, healCap: 2 }`.
A single large heart (2 with +2 Amount, 3 with +4; `w_heart_big` 16×16×2, r 9 × area) locks onto the
highest-HP enemy within `range` px of the hero (hearts spread over different targets when they can) and
shuttles hero <-> target at `speed` px/s, a leg never shorter than 0.2 s (so about 0.4-0.9 s a round trip). The
pass deals `dmg`, +`ramp` per consecutive pass on that target up to +`rampMax`; whatever stands in the way
takes `through` × `dmg` once per leg. When the target dies, or is left more than 1.35 × `range` behind, it
picks the next and keeps half of the ramp. A catch after a pass heals `heal` HP (× healing) out of a bucket of
`healCap` HP a second; with nobody in range it waits at her shoulder. **Versus Love Tornado** (hearts spiral
out, crowd AoE): the boss and elite killer of the pair. Bench, real runs: 744 on the boss against 452, 3,282 DPS
in the build against 18,084, the same overall power (1.65 vs 1.58 of the tier median). The gauge's immortal
blob flatters it (6,811 crowd / 342 boss against 4,751 / 63): there every leg passes through a dozen enemies.
Fx: the "heartBig" trail, a faint dotted leash from the hero to each heart's target on Layer.FxBelow (it
starts outside her body), `WFX_CATCH` on every catch, the heart fades into her hands as the boomerang does; sfx
`boomerang` on every other throw.

**Group Chat Lightning** (`group_chat_lightning`, Thunder Bell + Friendship Bracelet; package A, done).
"EVOLUTION! One bolt, forwarded to everyone. Nobody asked to be added."
`{ dmg: 66, cd: 0.9, amount: 1, hops: 10, perWeapon: 2, reach: 80, hopT: 0.04, seenR: 36, seenMul: 3, knock: 18 }`
(§9.1: was `dmg` 58, `seenR` 30, `seenMul` 2).
Every `cd` s one bolt hits a random enemy in view and is **forwarded**: every `hopT` s it hops to the nearest
enemy within `reach` px (× area) that this chain has not hit, `hops` times + `perWeapon` for every other weapon
held, `dmg` a hop with no falloff. The last enemy of a **full** chain takes the "seen by everyone" blast (r
`seenR` × area, `seenMul` × `dmg`, everything in it); a chain that runs out of enemies just ends. The next bolt
waits for the chain in flight; extra Amount sends more bolts one after the other. **Versus Raijin Drum** (8
huge bolts, AoE blasts, a screen flash): no burst and no flash, steady chains that reward dense packs and a
wide build, next to nothing against a lone boss. Gauge 8,769 crowd / 68 boss against 5,517 / 132 (the gauge's
120-enemy blob completes every chain); in the bench's real runs 7,706 DPS in the build / 78 on the boss against
11,116 / 243, 524 solo kills a minute against 537. Sprite: `fx_ping` 8×8×2, a notification dot popping over
every hop. Fx: its own bolts (dark blue and cyan under a white core, normal blend - the additive `bolts`
renderer vanishes on the pale Shoujo Academy floor; forwards budgeted at 16 a frame), a ring on the blast, no
screen flash, shake 0.05; sfx `thunder` on the bolt, a climbing `countTick` on the hops (70 ms apart at most).

**Konpeito Minefield** (`konpeito_minefield`, Candy Bomb + Chibi Charm; package A, done). "EVOLUTION! Scatters
tiny star candies everywhere. They are small. They are armed."
`{ dmg: 54, cd: 0.5, amount: 2, area: 1, radius: 23, knock: 60, duration: 12, max: 28, arm: 0.4, slow: 0.75, slowT: 1, kick: 40, near: 30, far: 90 }`.
Every `cd` s tosses `amount` konpeito to random points `near`-`far` px around the hero, while fewer than `max`
are out (tosses in the air count). A toss lands after `arm` s and is an armed mine for `duration` s (× the
duration stat); it pops when an enemy touches it (5 px + the enemy's radius): everything within `radius` ×
area takes `dmg` and is slowed to `slow` speed for `slowT` s (bosses are not slowed). A mine the moving hero
walks over is kicked `kick` px the way she is going. The pop is the weapon's own small blast, not
`World.explode` (four of the generic fireballs a second, each with a shake and a flash, buried the hero).
**Versus Sugar Nuke** (one giant bomb + bomblets): area denial and kiting, strong while moving through lanes,
weak against whatever does not walk into them. Gauge 2,245 crowd / 88 boss against 5,176 / 53; in the bench's
real runs 7,818 DPS in the build / 153 on the boss against 7,520 / 122, but 313 solo kills a minute against 576
(it cannot clear a wave alone). Sprite: `w_konpeito` 8×8×2, white / grey with a dark rim, in four tints (pink
/ mint / yellow / lavender, saturated: pastel candies vanished on the pale academy floor) at 1.25×. Fx: a
white blink when a mine arms; on the pop a ring and spikes in the mine's tint + candy bits (6 pops dressed a
frame), dust on a kick; sfx `candyThrow` on every other toss, `explosion` at 0.5 vol (90 ms apart at most).

**Soap Opera** (`soap_opera`, Bubble Aura + Inner Monologue; package B, done). "EVOLUTION! You leave a trail of
soap bubbles. Each one traps an enemy in a dramatic misunderstanding."
`{ dmg: 30, cd: 0.4, amount: 1, area: 1, radius: 30, slow: 0.62, knock: 12, every: 12, max: 24, life: 4.5, hold: 2.2, pop: 120, popR: 26, br: 8 }`
(§9.1: was `dmg` 24, `radius` 22, `every` 14, `life` 3.5, `hold` 1.6, `pop` 90).
While she moves, a soap bubble (`w_soap_bubble`, touch r `br`) is left every `every` px where she just was
(`life` s × duration, `max` alive + 2 per extra amount; when full the oldest free one makes way). The first
enemy that touches one is lifted and held inside it (`Enemy.stun` + `z`) for `hold` s × duration (elites
half; a boss is never held: the bubble pops on it and slows it 30 % for the hold time), takes `dmg` every
`cd` s, and when the hold ends the bubble POPS: `pop` (scaled like `dmg`) to the one inside and everybody
within `popR` × area. The standing aura shrinks to r `radius`. **Versus Ocean Dome** (a huge healing dome she
stands in): 1.2× its crowd DPS on the gauge (7,403 vs 6,153; boss 120 vs 119) but only while she keeps
walking, no heal, no dome - standing ground it is a fifth of a typical evolution on the weapon bench
(camp 0.20×). Crowd control drawn by her path: the kiting route. Fx (`src/view/evo2/b.ts`): the bubbles are
generic PK_FREE sprites (they fade over her), a faint wash on the ground for what is left of the aura (no
rim), a ring + droplets on the pop, "?!" at most every 1.4 s; sfx `bubblePop`.

**Refraction Overload** (`refraction_overload`, Prism Beam + Lucky Clover; package B, done). "EVOLUTION! One
beam. It hits something, splits in three, and each of those has opinions."
`{ dmg: 36, cd: 1.5, amount: 1, duration: 0.7, area: 1, len: 130, len2: 90, len3: 60, fan: 28, width: 3.5, tick: 0.1, knock: 10, d2: 24, d3: 16 }`
(§9.1: was `dmg` 28, `d2` 18, `d3` 12).
Every `cd` s one `duration` s beam at the nearest enemy (len `len`, +1 root beam per 2 amount, max 3). From
the first enemy it touches it splits into 3 beams fanned ±`fan`° around its own direction (len `len2`,
`d2` a tick); each of those splits once more on its first enemy (9 beams, len `len3`, `d3` a tick). A child
beam grows out of the enemy it split from (it rides that enemy and never hits it), and every beam ends with
the root. A critical hit of any beam adds one extra thin beam from that enemy (at most 40 beams alive).
**Versus Rainbow Cannon** (3 beams sweeping 360° around her): 1.19× its crowd DPS on the gauge (5,559 vs
4,681; boss 98 vs 73), aimed and depth-first - best into a deep pack behind a front line, nothing behind
her, and it scales with crit chance. Sprites: none new. Fx: crisp opaque lines, white-cored cyan -> aqua ->
a rainbow tier, with `Flag.Focus` (no additive haze, no bloom along a beam; the root starts 14 px off her),
a glint at every tip and split; sfx `beam`.

**Unbandaged Right Arm** (`unbandaged_right_arm`, Dark Flame Dragon + Main Character Aura; Kuro; done).
"EVOLUTION! The bandages come off. Mr. Toasty wraps around his right arm. He has been waiting to say this
line."
`{ dmg: 90, cd: 0.9, amount: 1, len: 58, angle: 70, burnDps: 16, burn: 4, critBurn: 0.6, nth: 4, knock: 40 }`.
No familiars: every `cd` s (while anything is within 1.5 × the reach) a flaming claw swipes a cone (length
`len` × area, half-angle `angle`°) where Kuro **faces** (his last move direction: no auto-aim), `dmg` and Burn
(`burnDps` for `burn` s, Kindling / Seal Broken apply); a crit on a burning enemy (the swipes and the burn
ticks they leave) deals +`critBurn` crit damage (`World.dmgTaken`); every `nth` swipe is the named attack:
length × 1.5, a guaranteed crit, a text pop. Extra Amount / Kuro C6 add follow-up swipes 0.18 s apart, the
first behind him. No death bursts, no judgement jet; Eyepatch: Off still fires; a fire source for Marshmallow
toasting. **Versus Unsealed Abyss Dragon** (an orbiting dragon that breathes and judges on its own): 0.70× its
crowd DPS on the gauge (2,389 vs 3,420; the gauge's hero walks a circle, so the cone covers 39 % of the ring),
boss 76 vs 61; on the weapon bench (bot, real stages) power 1.58 vs 1.95, crowd 1.17 vs 1.76, boss 2.15 vs
2.36: the burst is there when he walks into the crowd, nothing covers his back. Sprites: `w_abyss_claw`
40×32×4 (orange flames, the felt-tip violet outline), `fx_bandage` 8×8×2, `icon_unbandaged_right_arm`. Fx
(`src/view/evo2/c.ts`): the claw from the cue `HFX_KURO_CLAW` (`Flag.Focus`, grows out of his arm), flame
puffs, an ember off his hand; the named attack: bandage scraps, one of four lines ("DARK FLAME CLAW!" ...),
a small shake; sfx `slash`, `fireball` on the named one.

**Table-Flip Tea Service** (`table_flip_service`, Teapot Tempest + Speed Lines; Pudding; done). "EVOLUTION!
The customer was rude. Cups and saucers are served at speed. The tea is still warm."
`{ dmg: 18, cd: 0.9, amount: 5, speed: 260, pierce: 6, every: 0.45, spin: 3.6, flingDmg: 40, flingKnock: 160, range: 150, knock: 30, pour: 3, puddleR: 20, puddleDmg: 12, life: 5, heal: 3, block: 1, mend: 2.2 }`.
Five cups orbit at r 30 × √area (contact `dmg` every `every` s, Orbital Guard `block` 1 / `mend` 2.2); every
`cd` s the up cup nearest the nearest enemy (within the orbit + `range`) is **flung** at it as a spinning
saucer (`speed` × projSpeed, `flingDmg`, `flingKnock`): it turns back after `pierce` hits or `range` px
(× √area), hits again on the way home (1.25 × speed) and lands in its own slot. A flung cup does not guard
and is never replaced in the ring. No moat, no kill-heals, no petit fours. Warm Tea stays: a puddle on her
path every `pour` s (the base weapon's Lv5 puddle, `heal` 3 HP/s), Flying Teacup Service / Extra Cups / Tea
Ceremony / Free Refills apply. **Versus Eternal Tea Party** (a moat, six sturdy cups, kill-heals): 1.04× its
crowd DPS on the gauge (2,201 vs 2,125), boss 112 vs 57; bench power 0.67 vs 0.45, damage taken ×0.28 vs
×0.14: ranged knockback offence, half the protection. Sprites: `w_saucer` 12×12×4, `icon_table_flip_service`.
Fx: cups, puddles and Warm Tea by the teacup drawer of `heroes-a-fx.ts` (the same projectile fields; a flung
cup is `p.a` = 4 with the sprite, drawn by the generic drawer), a dotted wake (`TRAILS.saucer`), no marker on
an empty slot; sfx `teacup`.

**Final Episode Budget Missile** (`budget_missile`, Micro Missile Swarm + Big Ribbon; Aoi; done).
"EVOLUTION! The whole animation budget went into one missile. It has a face."
`{ dmg: 120, cd: 3.2, amount: 1, speed: 240, speed0: 90, turn: 2.2, blast: 58, knock: 220, craterR: 36, craterDps: 16, crater: 2, tiny: 4, tinyDmg: 14, tinyBlast: 14, tinySpeed: 150 }`.
Every `cd` s ONE big missile launches from the mech's back (`speed0` -> `speed` px/s over 1.2 s, turn `turn`
rad/s, much sharper the longer it flies) at the densest pack in view (24 sampled enemies, the most
neighbours; a pack right on top of Aoi counts half), stops for nothing on the way and explodes on it: r
`blast` × area (Cluster Warheads apply), `dmg`, `knock`, a big explosion of its own source, and a crater (r
`craterR`, `craterDps` for `crater` s). In the last second before the next launch, and only if the big one
has landed, `tiny` small missiles (the base weapon's, `tinyDmg`; +2 per extra Amount, +1 per Extended
Magazine rank) go out one by one. FULL BURST: every 5th launch is two big ones. The C6 drone fires the small
ones. **Versus Al Dente Armageddon** (24-missile salvos everywhere): 1.73× its crowd DPS on the gauge's
immortal dense crowd, its best case (4,583 vs 2,651), boss 61 vs 180; bench power 1.06 vs 1.02, crowd 1.66
vs 1.07, boss 0.57 vs 1.07: one telegraphed hit that deletes a pack, poor on a single target. (Started at
240 / r 70: 3.8× on the gauge.) Sprites: `w_budget_missile` 24×16×2, `fx_budget_crater` 32×20×2 (`fx_crater`
was taken), `icon_budget_missile`. Fx: a smoke trail (`TRAILS.budget`), a small blinking mark under its
target, the generic big explosion (shake, `coverHero`) plus smoke and a blue ring, the crater decal with
embers; sfx `missile`, `explosionBig`.

**Tsun Tsun Drill Harisen** (`tsun_tsun_drill`, Baka Harisen + Speed Lines; Akane; done). "EVOLUTION! The
fan rolls into a drill. It's not like she is aiming at you. She is, though."
`{ dmg: 30, cd: 0.9, amount: 1, len: 76, width: 12, ticks: 4, thrust: 0.3, knock: 360, missile: 0.6, drag: 0.5 }`.
Every `cd` s a drill thrust at the nearest enemy within `len` (else where she faces; the base weapon's
auto-aim: a 12 px lane aimed by facing alone missed everything on a phone): a capsule `len` × `width` px
(× area) from her middle that ticks `ticks` times over `thrust` s for `dmg` each. Every tick but the last
holds what it hits and winds it `drag` of the way to the tip (bosses and props never, elites less); the last
launches everything along the lane (`knock`) as human missiles (`missile` × `dmg` × `ticks` to up to 3
victims each, Ricochet Bonk applies). No heal, no real daze. Ultimate Denial adds the ±60° lanes, Twin-Tail
Tornado its drill spin every 5th thrust, extra Amount queues further thrusts (behind her, then ±90°); a
BAKA! roll at the tip on a launch that hit. **Versus Dere Dere Harisen** (360° heart smack, heals, stuns):
0.89× its crowd DPS on the gauge (6,467 vs 7,229), boss 144 vs 73; bench power 0.81 vs 0.98, damage taken
×0.45 vs ×0.05: the tsun route, reach and the arsenal's biggest knockback, no sustain. (Started at `dmg`
22 / `cd` 1.0: bench power 0.48.) Sprites: `w_drill_fan` 32×16×4, `icon_tsun_tsun_drill`. Fx: the drill from
the cue `HFX_AKANE_DRILL` (`Flag.Focus`), spiral speed lines down the lane, rays and a ring at the tip on the
launch, `fx_baka` through the usual pop rule; sfx `fanSmack`, `baka`.

**Who Are You Again?** (`who_are_you_again`, Notice-Me Sparkles + Heart Locket; Senpai). "EVOLUTION! He
looks right at them. Then he asks their name. The heartbreak is area damage." The aura charms as the base
weapon (r `radius` 56, a `sting` 6 every `cd` 0.45 s, `charm` 0.25, `duration` 2.5 s, up to `max` 12
admirers); when a charm ends, or the charmed enemy dies (to anything), it realises it was never noticed: a
heartbreak burst r `burst` 32 × area for `dmg` 40 + `hpShare` 6 % of its max HP (that share capped at
`hpCap` 60; bosses take `dmg` flat), and every other non-boss in the burst rolls the charm at once (a chain
of heartbreak, paced at `rate` 8 bursts a second from a queue, oldest first). Played, as all of Senpai,
purely as admiration. **Versus Shoujo Filter** (long charms, charmed enemies hit 3× harder, the Kira Kira
Moment): short charms that are the ammunition - burst AoE instead of a standing army. Sprite:
`fx_heartbreak` 16×16×3 (a heart cracking). Fx: the crack over the spot and a pink ring, both with
`Flag.Focus` (a plain-blend ring: additive pink turned white on pale floors); text pop "who?" at most once
a second; sfx `sparkleCharm`, `bubblePop` (the charm book's own cues). Bench (in a build, seeds 1-2): crowd
0.79× / boss 1.0× Shoujo Filter, clears its wave faster (12 s vs 21 s); on the ideal-density gauge the
chain runs to 2.2× (20 631 vs 9 200).

**Skip Intro** (`skip_intro`, Henshin Burst + Wish Charm; Magical Girl #47). "EVOLUTION! The transformation
sequence has been skipped. So has the invulnerability." No henshin at all: the burst fires at once every
`cd` 1.25 s (r `radius` 70 × area, `dmg` 40, knock 160, `ribbons` 8 at `ribbonDmg` 12) with **no** i-frames
and no slow walk; the emergency transform (Panic Henshin) is gone, and no henshin is counted. Every
`finEvery` 5th burst is the stock-footage finisher (r × `finArea` 1.4, damage × `finDmg` 2). Quick Change
and Double Henshin still apply; C6 fires the next burst at once. **Versus Infinite Henshin Loop** (a 2.5 s
loop of invulnerability and Plot Armor shields): twice the burst rate and full mobility, none of the
safety. Sprites: none new (`w_ribbon`); `fx_skip` 24×10×1 "SKIP ▶▶" pop. Fx: its own burst cue
(`SKIP_BURST`), a crisp mint ring with `Flag.Focus` and sparks - the base weapon's glow ring + shockwave
kept the screen white at this rate - the pop over her head at most once per 4 s, a pink second ring and
"(stock footage)" on the finisher; sfx `explosion` (quiet, high), `transform` on the finisher only.
Bench: crowd 1.28× / boss 1.19× the Loop in a build (gauge 1.46× / 1.56×), damage taken ×0.65 against the
Loop's ×0.01.

**"Holding Back" Fireball** (`holding_back`, Cheat Fireball + Twin Charm; Isekai-kun). "EVOLUTION! He is
holding back. This is him holding back: a stream of perfectly ordinary fireballs." A stream: one small
fireball every `cd` 0.14 s at the nearest enemy (`speed` 230, blast r `blast` 24 × area, `dmg` 48, knock
20), +1 stream (at the next-nearest enemy) per 2 amount; no "Did I overdo it?" cast. Every `sneeze` 50th
fireball he sneezes: one base-weapon overdo blast (`sneezeDmg` 320, r `sneezeBlast` 90, the crater).
(§9.1: was `dmg` 26, `blast` 15, `sneeze` 100, `sneezeDmg` 156, `sneezeBlast` 70.)
**Versus Meteor Lv.99999** (slow, huge, on the biggest crowd): constant single-target and line pressure, no
screen-clearing hit. Sprites: none new (`w_fireball` at 0.6 scale, no trail). Fx: the small blast is sparks
and a thin ring, not an explosion (no `explosion` event; budget 10 a frame); status-window pop
"MP: 9999/9999" once a run (the font has no ∞), "achoo!" on the sneeze; sfx `fireball` at 0.35 vol,
rate-limited to 8 a second. Bench: boss 1.0× the tier median (gauge boss 1.29× the Meteor), crowd 0.54×
the tier median and 0.23× the Meteor in a build - the Meteor is the bench's outlier (3.7× its tier), so
this pair waits for the sibling pass.

**Free Delivery** (`free_delivery`, Horn of Reincarnation + Magnet Star; Truck-kun). "EVOLUTION! The horn
now pulls. Parcels are delivered to the bumper. The parcels are enemies." The honk is reversed: every `cd`
1.5 s a cone ahead (`len` 110 × area, half-angle `angle` 40°) **pulls** every enemy in it up to `pull` 80 px
toward the drop spot just off the bumper (a `dmg` 32 tug; elites half, bosses and props 0), then
`slamAfter` 0.24 s later the delivery hits everything there (r `slamR` 22) for `slam` 130 and throws it
ahead; a boss the cone reaches is not pulled, so its parcel is delivered where it stands (the same `slam`,
no knock: §9.1); every pickup in the cone is pulled too (food and chests included; gems are left to the magnet). The moving ram stays
(`ram` 45). Its kills are isekai'd with the base weapon's extra-gem chance (`isekai` 0.25), quietly: one
light pillar per delivery instead of one per kill (they all die in one spot, on the truck). No phantom
trucks. **Versus Isekai Rush Hour** (360° honk, scheduled phantom trucks): aimed, greedy and close - he
drives into what he pulled; with Swift Shoes too the player must choose. Sprites: none new; `fx_parcel`
8×8×2 box on pulled enemies. Fx: reversed HONK arcs closing in on the truck (plain blend, `Flag.Focus`),
tape scraps on the delivery, "DELIVERED!" at most once per 8 s; sfx `honk` pitched down, `hitCrit`. Bench:
crowd 1.44× Rush Hour inside a build, but boss 0.45× and alone it clears slowly (gauge crowd 0.3×): it
needs the build around it.

**Brown Sugar Railgun** (`brown_sugar_railgun`, Bubble Tea Cannon + Power Bow; package B, done). "EVOLUTION!
One pearl through one very long straw. It does not bounce. It does not need to."
`{ dmg: 540, cd: 1.05, amount: 1, speed: 520, knock: 70, reach: 440, falloff: 0.08, floor: 0.5, syrup: 2, syrupW: 8, syrupSlow: 0.65, syrupDps: 60 }`
(§9.1: was `dmg` 190, `cd` 1.3, `falloff` 0.12, `floor` 0.4, `syrupW` 6, `syrupDps` 30).
Every `cd` s a single pearl (`w_pearl_rail`) is fired at the nearest enemy and flies `reach` px in a straight
line: pierce ∞, `dmg`, -`falloff` per enemy pierced (never under `floor`). Its line on the ground is a
syrup streak for `syrup` s × duration (half width `syrupW` × area: speed × `syrupSlow`, `syrupDps` scaled
like `dmg`, ticked every 0.25 s). +1 pearl per 2 amount, fanned 6°. **Versus Tapioca Tsunami** (giant pearls
bouncing 8 times, shedding more): 1.23× its crowd DPS on the gauge (2,397 vs 1,942; boss 176 vs 47), lanes
instead of pinball - devastating down a corridor of enemies, little to offer a ring around her (in a real
run the Tsunami's bouncing is worth far more than its gauge: the bench has it 4.9× apart, a question for
the sibling balance pass). Sprites: `w_pearl_rail` 16×8×2, `fx_syrup` 16×8×2 (decal tiles). Fx: a short
straw line behind the pearl, a straw-shaped muzzle flash, tea drops; sfx `boba` + `beam` at 0.3.

**Failed Exam Storm** (`failed_exam_storm`, Paper Crane Flock + Training Montage; package B, done). "EVOLUTION!
The cranes are refolded into paper planes. From failed exams. They never come back, and neither will that
grade."
`{ dmg: 36, cd: 0.16, amount: 3, speed: 300, pierce: 5, knock: 22, spread: 20, back: 44, life: 1.4, xp: 0.01, xpCap: 0.3 }`.
No flock: every `cd` s a paper plane per lane (1 + 1 per 2 amount: 2 lanes as it comes) launches from
`back` px BEHIND the hero in the facing direction (±`spread`°, `pierce`, `life` s: through whatever is
chasing her down that line, past her, on across the screen). No homing, no heal. Every enemy a plane kills
marks its gem up: +`xp` per plane kill so far, capped at +`xpCap` (the passive's joke). **Versus Thousand
Crane Wish** (12 homing cranes around her, a heal on every Wish): 0.63× its crowd DPS on the gauge (2,127
vs 3,365; boss 186 vs 672) but about level with it on the weapon bench (power 1.10 vs 1.17: the planes
reach the whole screen) - a forward barrage aimed by facing. Launching from behind her is what makes it work
while kiting (a first version launched at her feet and killed 16 enemies a minute alone). Sprite:
`w_paper_plane` 12×8×2. Fx: paper bits on hits, scraps and a red grade ("23/100", "F", "SEE ME") on a kill
at most every 2 s, no trails; sfx `paperCrane` at most every 0.3 s.

**Underground Mosh Pit** (`mosh_pit`, Idol Lightstick Wave + Plot Armor; package B, done). "EVOLUTION! The
venue holds forty people. Every beat is a stomp, and every stomp is a shove."
`{ dmg: 46, cd: 0.429, every: 1, amount: 1, range: 78, knock: 110, daze: 0.2, need: 6, stacks: 6, dr: 0.04, grow: 0.06 }`
(§9.1: was `dmg` 40, `range` 70).
On every beat an instant 360° stomp around the hero (r `range` × area, `dmg`, `knock`, a `daze` s stun;
bosses are not dazed). A beat that hits `need`+ enemies adds a stack of Crowd Surf (max `stacks`; all lost
after 2 beats in a row below `need`): +`dr` damage reduction (a live stat modifier, removed on dispose) and
+`grow` stomp radius a stack. No ENCORE, no combo-rank bonus. **Versus Sold-Out Dome Tour** (long 90°
spotlight arcs, a screen-wide ENCORE): 1.13× its crowd DPS on the gauge (8,024 vs 7,130; boss 101 vs 68)
when the crowd is on top of her, but half its reach: on the bench it kills a fifth as much alone and cuts
damage taken by two thirds (taken ×0.34) - the stand-in-the-pit route. Sprites: `fx_stomp` 24×8×2 dust.
Fx: the stomp ring on `Layer.FxBelow` (under her, 0.34 s), dust and a spark per stack along it (particles),
"CROWD SURF!" at full stacks; the HUD beat pulse of `hud-arsenal2.ts` includes the id; sfx `lightstick`
at -7 semitones.

**All-You-Can-Eat Nabe** (`all_you_can_eat_nabe`, Kotatsu of Sloth + Bento Box). "EVOLUTION! The kotatsu
gets a hot pot. Whatever wanders in gets cooked. Whatever gets cooked is dinner." Deploys as the base
weapon (stand still `deploy` 0.4 s; `armor` 2 and `regen` 1 inside), r `radius` 80 × area: enemies inside
are slowed 30 % (`slow` 0.7) and **cooked**: `dmg` 24 (§9.1: was 36) every `cd` 0.3 s, +`cook` 25 % per second they have
stayed inside (max +`cookMax` 200 %); every `snackEvery` 12th enemy that dies inside (to anything) drops a
snack (a mikan, heal `snackHeal` 4 × healing). Moving folds it at once and nothing travels with her (no
folded aura). **Versus Eternal Winter Break** (the kotatsu comes along, pulls gems, lobs mikan): the
stationary route - the strongest standing aura per enemy in the game and the only one that feeds her,
worthless on the move. Sprite: `w_nabe` 24×16×3 (a bubbling pot, steam; drawn beside her on `w_kotatsu`'s
quilt, in front, so it reads). Fx: the cooking floor warms as the pot heats, steam puffs on Layer.Fx
(Focus), a ladle splash on a snack drop; no Too Comfy doze on this route; sfx `snore` (deploy),
`bubblePop`. The lab bench cannot gauge it (its bot never camps: 0 DPS for the base weapon too); a
standing probe (60 s, director on) put an earlier tuning (dmg 24, r 68) at 0.54× Eternal Winter Break's
standing damage, hence the shipped numbers.

### 8.3 Work packages

Four packages of the 19 remaining evolutions, grouped so that no two packages edit the same weapon file,
and by the helper / view family they have to read. Each package owns exactly: its weapon files (the new
`WeaponDef` + the second `evolutions` entry), `src/art/sprites/evo2-<pkg>.ts` (sprites + manifest rows),
`src/view/evo2/<pkg>.ts` (fx module), `tests/evo2-<pkg>.test.ts`, and the Status cell + numbers of its
entries above. The recipe: `docs/ARCHITECTURE.md` §4 "Adding a second evolution".

| Package | Evolutions | Reads (do not restructure) |
| --- | --- | --- |
| **A** (5) | Critical Constellation, Already Cut, Unrequited Heart, Group Chat Lightning, Konpeito Minefield | `src/view/weapon-fx.ts` (bolts, candy, catch cues), `weapons/_fx.ts` |
| **B** (5) | Soap Opera, Refraction Overload, Brown Sugar Railgun, Failed Exam Storm, Underground Mosh Pit | `src/view/weapon-fx.ts` (field, beams), `src/view/arsenal2-fx.ts`, `weapons/_arsenal2.ts`, `src/ui/hud-arsenal2.ts` |
| **C** (4) | Unbandaged Right Arm, Table-Flip Tea Service, Final Episode Budget Missile, Tsun Tsun Drill Harisen | `src/view/heroes-a-fx.ts`, `weapons/_heroes-a.ts`, `weapons/_orbital.ts` |
| **D** (5) | Who Are You Again?, Skip Intro, "Holding Back" Fireball, Free Delivery, All-You-Can-Eat Nabe | `src/view/heroes-b-fx.ts`, `weapons/_charm.ts`, `_hb.ts`, `_truck.ts`; `src/view/arsenal2-fx.ts` (kotatsu) |

---

## 9. Weapon bench pass (Season 3)

The owner approved a "weapon balance check": rank every weapon by measurement instead of by feel
(`npm run balance:lab -- --weapons`, method and limits in docs/DEVTOOLS.md §4.1). Each weapon is benched at Lv1,
Lv5 and as every evolution, alone and inside a reference build, on its signature hero (`*`; general weapons on
Hoshi). `power` / `crowd` / `boss` / `camp` are ratios to the tier's median weapon (1.00 = typical; < 0.6 is
flagged WEAK unless the weapon protects or is a stand-your-ground weapon, > 1.6 STRONG); `taken x` is the damage
the hero takes (net of healing) with the weapon against the same kit without it; the `camp` columns are the same
build played standing ground. Figures in brackets: the value with the numbers from before this pass.

The snapshot below is the bench at the end of this pass (seeds 1-3, mid bot). The 19 second evolutions that
landed during it (§8) are in the table as first measured, **before their own balance pass**: rerun the bench for
today's numbers.

**Lv1** (P2 x Dream Meadow at 1:30, King Puff; kit Lv3)

| # | weapon | hero | power | crowd | boss | taken x | camp | camp taken x | flag |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Cheat Fireball | isekai_kun* | 4.06 | 2.32 | 5.94 | 0.72 | 5.05 | 0.86 | STRONG |
| 2 | Star Shot | hoshi* | 3.11 | 2.21 | 4.11 | 0.58 | 2.84 | 0.80 | STRONG |
| 3 | Notice-Me Sparkles | senpai* | 2.75 | 1.01 | 4.59 | 0.89 | 1.31 | 0.97 | STRONG |
| 4 | Teapot Tempest | pudding* | 2.05 | 1.74 | 2.43 | 0.59 | 1.00 | 1.03 | STRONG |
| 5 | Henshin Burst | magical_girl_47* | 2.05 | 1.36 | 2.80 | 0.74 | 2.29 | 0.74 | STRONG |
| 6 | Thunder Bell | hoshi | 1.98 | 2.90 | 1.13 | 0.96 | 2.43 | 1.12 | STRONG |
| 7 | Micro Missile Swarm | aoi* | 1.95 | 1.24 | 2.73 | 0.93 | 1.20 | 0.80 | STRONG |
| 8 | Dark Flame Dragon | kuro* | 1.44 | 0.97 | 1.96 | 1.01 | 1.00 | 0.97 |  |
| 9 | Idol Lightstick Wave | hoshi | 1.28 | 1.30 | 1.30 | 0.79 | 1.89 | 0.94 |  |
| 10 | Candy Bomb | hoshi | 1.05 | 1.06 | 1.07 | 0.96 | 0.94 | 1.10 |  |
| 11 | Heart Boomerang | hoshi | 0.95 | 1.00 | 0.93 | 0.74 | 0.94 | 1.15 |  |
| 12 | Petal Slash | rin* | 0.81 | 0.91 | 0.73 | 0.89 | 1.12 | 1.03 |  |
| 13 | Prism Beam | hoshi | 0.80 | 0.90 | 0.73 | 0.84 | 0.76 | 0.96 |  |
| 14 | Bubble Tea Cannon | hoshi | 0.78 | 1.02 | 0.57 | 0.87 | 0.81 | 0.95 |  |
| 15 | Yarn Orbit | mochi* | 0.64 (0.41) | 0.76 | 0.54 | 0.76 (0.89) | 0.75 (0.38) | 1.04 (0.98) |  |
| 16 | Paper Crane Flock | hoshi | 0.50 (0.49) | 0.76 | 0.25 | 0.89 (0.93) | 0.30 (0.27) | 0.98 (0.86) | WEAK |
| 17 | Horn of Reincarnation | truck_kun* | 0.43 | 0.59 | 0.28 | 0.40 | 1.20 | 0.95 | SUPPORT |
| 18 | Baka Harisen | akane* | 0.31 | 0.40 | 0.23 | 0.80 | 0.69 | 1.02 |  |
| 19 | Bubble Aura | hoshi | 0.26 (0.27) | 0.43 | 0.11 | 0.66 (0.66) | 0.76 (0.76) | 0.93 (0.93) |  |
| 20 | Kotatsu of Sloth | hoshi | 0.01 (0.01) | 0.01 | 0.00 | 0.96 (0.97) | 0.75 (0.59) | 0.94 (0.84) |  |

**Lv5** (P3 x Candy Kingdom at 5:00, Gingerbread Golem; kit Lv5)

| # | weapon | hero | power | crowd | boss | taken x | camp | camp taken x | flag |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Cheat Fireball | isekai_kun* | 7.39 | 4.21 | 10.31 | 0.46 | 5.35 | 0.44 | STRONG |
| 2 | Notice-Me Sparkles | senpai* | 2.68 | 2.18 | 3.09 | 0.94 | 2.08 | 0.39 | STRONG |
| 3 | Dark Flame Dragon | kuro* | 1.74 | 1.67 | 1.75 | 1.24 | 1.40 | 0.83 | STRONG |
| 4 | Star Shot | hoshi* | 1.37 | 1.15 | 1.54 | 0.79 | 0.54 | 0.86 |  |
| 5 | Prism Beam | hoshi | 1.32 | 1.34 | 1.25 | 1.10 | 1.08 | 0.91 |  |
| 6 | Heart Boomerang | hoshi | 1.28 | 1.26 | 1.25 | 1.06 | 1.04 | 0.85 |  |
| 7 | Thunder Bell | hoshi | 1.19 | 1.46 | 0.88 | 0.95 | 0.72 | 1.11 |  |
| 8 | Idol Lightstick Wave | hoshi | 1.06 | 1.12 | 0.95 | 1.24 | 1.22 | 0.79 |  |
| 9 | Teapot Tempest | pudding* | 1.05 | 1.16 | 0.92 | 0.22 | 0.90 | 0.82 |  |
| 10 | Candy Bomb | hoshi | 1.02 | 1.08 | 0.93 | 1.09 | 0.96 | 0.90 |  |
| 11 | Bubble Tea Cannon | hoshi | 0.98 | 1.08 | 0.85 | 0.63 | 0.43 | 0.84 |  |
| 12 | Henshin Burst | magical_girl_47* | 0.92 | 0.58 | 1.23 | 0.10 | 1.24 | 0.31 |  |
| 13 | Petal Slash | rin* | 0.89 | 0.61 | 1.15 | 0.72 | 1.29 | 0.72 |  |
| 14 | Micro Missile Swarm | aoi* | 0.83 | 0.58 | 1.05 | 0.95 | 0.79 | 0.70 |  |
| 15 | Horn of Reincarnation | truck_kun* | 0.71 | 0.29 | 1.10 | 0.16 | 1.20 | 0.52 |  |
| 16 | Baka Harisen | akane* | 0.53 | 0.38 | 0.65 | 0.15 | 1.09 | 0.61 | SUPPORT |
| 17 | Yarn Orbit | mochi* | 0.50 (0.26) | 0.60 | 0.37 | 0.54 (0.73) | 0.48 (0.31) | 1.05 (0.97) | SUPPORT |
| 18 | Paper Crane Flock | hoshi | 0.49 (0.17) | 0.59 | 0.37 | 1.05 (0.91) | 0.12 (0.04) | 1.01 (1.01) | WEAK |
| 19 | Bubble Aura | hoshi | 0.20 (0.17) | 0.32 | 0.07 | 0.75 (0.71) | 0.67 (0.47) | 0.80 (0.79) |  |
| 20 | Kotatsu of Sloth | hoshi | 0.01 (0.00) | 0.02 | 0.00 | 0.97 (1.02) | 0.64 (0.24) | 0.74 (0.94) |  |

**Evolutions** (P4 x Shoujo Academy at 8:00, Council President; kit evolved)

| # | weapon | hero | power | crowd | boss | taken x | camp | camp taken x | flag |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Galaxy Barrage | hoshi* | 8.52 | 1.87 | 14.73 | 0.36 | 2.37 | 0.70 | STRONG |
| 2 | Meteor Lv.99999 | isekai_kun* | 4.20 | 4.19 | 3.99 | 0.69 | 4.93 | 0.70 | STRONG |
| 3 | Critical Constellation | hoshi* | 3.96 | 1.99 | 5.73 | 0.43 | 2.88 | 0.66 | STRONG |
| 4 | Tapioca Tsunami | hoshi | 3.37 | 2.47 | 4.09 | 0.57 | 2.93 | 0.76 | STRONG |
| 5 | Unsealed Abyss Dragon | kuro* | 2.49 | 1.61 | 3.23 | 0.67 | 1.64 | 0.90 | STRONG |
| 6 | Unrequited Heart | hoshi | 2.29 | 0.52 | 3.94 | 0.62 | 0.41 | 0.93 | STRONG |
| 7 | Love Tornado | hoshi | 2.14 | 1.78 | 2.39 | 0.54 | 2.02 | 1.00 | STRONG |
| 8 | Unbandaged Right Arm | kuro* | 1.99 | 1.01 | 2.87 | 0.43 | 1.88 | 0.84 | STRONG |
| 9 | Who Are You Again? | senpai* | 1.69 | 2.15 | 1.15 | 0.52 | 1.57 | 0.60 | STRONG |
| 10 | Shoujo Filter | senpai* | 1.60 | 1.91 | 1.21 | 0.40 | 1.23 | 0.61 | STRONG |
| 11 | Skip Intro | magical_girl_47* | 1.43 | 1.14 | 1.66 | 0.55 | 1.23 | 1.10 |  |
| 12 | Raijin Drum | hoshi | 1.38 | 1.40 | 1.29 | 1.00 | 1.33 | 0.94 |  |
| 13 | Already Cut | rin* | 1.32 | 1.43 | 1.13 | 0.81 | 1.58 | 0.93 |  |
| 14 | Sold-Out Dome Tour | hoshi | 1.27 | 1.41 | 1.07 | 0.71 | 1.06 | 0.90 |  |
| 15 | Dere Dere Harisen | akane* | 1.22 | 0.68 | 1.69 | 0.05 | 0.70 | 0.16 |  |
| 16 | Al Dente Armageddon | aoi* | 1.21 | 0.93 | 1.42 | 0.87 | 0.86 | 0.86 |  |
| 17 | Final Episode Budget Missile | aoi* | 1.20 | 1.58 | 0.75 | 0.97 | 1.28 | 0.92 |  |
| 18 | Rainbow Cannon | hoshi | 1.12 | 1.33 | 0.86 | 0.75 | 1.40 | 0.78 |  |
| 19 | Tsun Tsun Drill Harisen | akane* | 1.05 | 0.72 | 1.32 | 0.42 | 1.31 | 0.91 |  |
| 20 | Infinite Henshin Loop | magical_girl_47* | 1.02 | 0.74 | 1.26 | 0.01 | 0.87 | 0.01 |  |
| 21 | Failed Exam Storm | hoshi | 0.98 | 1.32 | 0.58 | 0.52 | 1.05 | 0.76 |  |
| 22 | Sugar Nuke | hoshi | 0.94 | 1.19 | 0.65 | 1.16 | 0.83 | 0.88 |  |
| 23 | Sakura Tempest | rin* | 0.89 | 0.55 | 1.18 | 0.58 | 0.71 | 0.76 |  |
| 24 | Thousand Crane Wish | hoshi | 0.88 (0.41) | 0.72 | 0.99 | 0.78 (0.82) | 0.32 (0.19) | 0.88 (0.88) |  |
| 25 | Konpeito Minefield | hoshi | 0.87 | 0.90 | 0.81 | 0.87 | 0.63 | 0.89 |  |
| 26 | "Holding Back" Fireball | isekai_kun* | 0.86 | 0.67 | 1.01 | 0.56 | 1.32 | 0.81 |  |
| 27 | Isekai Rush Hour | truck_kun* | 0.85 | 0.91 | 0.75 | 0.42 | 0.86 | 0.58 |  |
| 28 | Group Chat Lightning | hoshi | 0.80 | 1.15 | 0.41 | 0.95 | 0.80 | 0.99 |  |
| 29 | Brown Sugar Railgun | hoshi | 0.79 | 0.85 | 0.69 | 0.74 | 0.95 | 0.72 |  |
| 30 | Table-Flip Tea Service | pudding* | 0.77 | 0.82 | 0.67 | 0.31 | 0.53 | 0.53 |  |
| 31 | Refraction Overload | hoshi | 0.72 | 0.83 | 0.58 | 0.87 | 0.83 | 0.89 |  |
| 32 | Cosmic Yarn | mochi* | 0.71 (0.53) | 0.58 | 0.81 | 0.49 (0.49) | 0.44 (0.32) | 0.99 (0.92) |  |
| 33 | Soap Opera | hoshi | 0.64 | 0.86 | 0.39 | 0.61 | 0.19 | 0.83 |  |
| 34 | Ocean Dome | hoshi | 0.62 (0.54) | 0.80 | 0.41 | 0.38 (0.46) | 0.75 (0.62) | 0.80 (0.77) |  |
| 35 | Eternal Tea Party | pudding* | 0.57 | 0.53 | 0.59 | 0.14 | 0.37 | 0.39 | SUPPORT |
| 36 | Underground Mosh Pit | hoshi | 0.51 | 0.45 | 0.55 | 0.26 | 0.75 | 0.46 | SUPPORT |
| 37 | Meowteor Hammer | mochi* | 0.45 | 0.49 | 0.37 | 0.76 | 0.25 | 0.99 | WEAK |
| 38 | Free Delivery | truck_kun* | 0.42 | 0.46 | 0.37 | 0.32 | 1.58 | 0.55 | SUPPORT |
| 39 | Eternal Winter Break | hoshi | 0.16 (0.09) | 0.21 | 0.09 | 0.48 (0.62) | 0.70 (0.48) | 0.68 (0.77) | SUPPORT |
| 40 | All-You-Can-Eat Nabe | hoshi | 0.01 | 0.02 | 0.00 | 0.95 | 1.29 | 0.80 |  |

**Siblings** (every evolution of a weapon; power within the evolution tier)

| weapon | Lv5 | evolutions (power) | spread |
| --- | --- | --- | --- |
| Baka Harisen | 0.53 | Dere Dere Harisen 1.22, Tsun Tsun Drill Harisen 1.05 | 1.16x |
| Bubble Aura | 0.20 | Ocean Dome 0.62, Soap Opera 0.64 | 1.03x |
| Bubble Tea Cannon | 0.98 | Tapioca Tsunami 3.37, Brown Sugar Railgun 0.79 | 4.24x (flagged) |
| Candy Bomb | 1.02 | Sugar Nuke 0.94, Konpeito Minefield 0.87 | 1.08x |
| Cheat Fireball | 7.39 | Meteor Lv.99999 4.20, "Holding Back" Fireball 0.86 | 4.88x (flagged) |
| Dark Flame Dragon | 1.74 | Unsealed Abyss Dragon 2.49, Unbandaged Right Arm 1.99 | 1.25x |
| Heart Boomerang | 1.28 | Love Tornado 2.14, Unrequited Heart 2.29 | 1.07x |
| Henshin Burst | 0.92 | Infinite Henshin Loop 1.02, Skip Intro 1.43 | 1.40x |
| Horn of Reincarnation | 0.71 | Isekai Rush Hour 0.85, Free Delivery 0.42 | 2.01x (flagged) |
| Idol Lightstick Wave | 1.06 | Sold-Out Dome Tour 1.27, Underground Mosh Pit 0.51 | 2.49x (flagged) |
| Kotatsu of Sloth | 0.01 | Eternal Winter Break 0.16, All-You-Can-Eat Nabe 0.01 | 13.53x (flagged) |
| Micro Missile Swarm | 0.83 | Al Dente Armageddon 1.21, Final Episode Budget Missile 1.20 | 1.01x |
| Notice-Me Sparkles | 2.68 | Shoujo Filter 1.60, Who Are You Again? 1.69 | 1.06x |
| Paper Crane Flock | 0.49 | Thousand Crane Wish 0.88, Failed Exam Storm 0.98 | 1.11x |
| Petal Slash | 0.89 | Sakura Tempest 0.89, Already Cut 1.32 | 1.49x |
| Prism Beam | 1.32 | Rainbow Cannon 1.12, Refraction Overload 0.72 | 1.55x |
| Star Shot | 1.37 | Galaxy Barrage 8.52, Critical Constellation 3.96 | 2.15x (flagged) |
| Teapot Tempest | 1.05 | Eternal Tea Party 0.57, Table-Flip Tea Service 0.77 | 1.33x |
| Thunder Bell | 1.19 | Raijin Drum 1.38, Group Chat Lightning 0.80 | 1.72x (flagged) |
| Yarn Orbit | 0.50 | Cosmic Yarn 0.71, Meowteor Hammer 0.45 | 1.60x (flagged) |

**Tuned** (EXPANSION §2: fix only what is broken; these were dead weight, 0.0-0.3x the median with little or no
protection to show for it). Level-table numbers only:

| Weapon | Change | Bench before -> after |
| --- | --- | --- |
| Yarn Orbit | dmg 10 / 10 / 14 / 14 / 20 -> 16 / 16 / 23 / 25 / 37 (area - the ball size, so the Orbital Guard of §7 - and the 3 s on / 1.3 s off cycle are unchanged) | Lv1 0.41 -> 0.64, Lv5 0.26 -> 0.50; damage taken with it at Lv5 -27 % -> -46 % (SUPPORT) |
| Cosmic Yarn | dmg 27 -> 38 (a bonk no weaker than the Lv5 ball it replaces) | 0.53 -> 0.71; damage taken -51 % |
| Paper Crane Flock | dmg 9 / 9 / 12 / 12 / 15 -> 11 / 11 / 17 / 21 / 30; cd 1.2 / 1.2 / 1.2 / 1.0 / 1.0 -> 1.2 / 1.2 / 1.1 / 0.9 / 0.8; pierce 1 / 1 / 1 / 1 / 2 -> 1 / 1 / 2 / 2 / 3 | Lv5 0.17 -> 0.49 (still the low end: its darts pick the nearest enemy, and the bot keeps losing the fold streak) |
| Thousand Crane Wish | dmg 22 -> 36, pierce 3 -> 4 | 0.41 -> 0.88 |
| Kotatsu of Sloth | dmg 4 / 5 / 5 / 7 / 9 -> 5 / 7 / 9 / 15 / 28; regen 0.5 / 0.5 / 1 / 1 / 1 -> 0.5 / 1 / 1.5 / 2 / 2.5; armor 1 / 1 / 1 / 2 / 2 -> 1 / 1 / 2 / 2 / 3 | standing ground: Lv1 0.59 -> 0.75, Lv5 0.24 -> 0.64, damage taken at Lv5 -6 % -> -26 % (the bot never stands still: its bot-played row is ~0 by construction) |
| Eternal Winter Break | dmg 14 -> 24, armor 2 -> 3, regen 1.5 -> 3 | standing ground 0.48 -> 0.70; damage taken -38 % -> -52 % (SUPPORT) |
| Bubble Aura | Lv3-5 dmg 9 / 11 / 14 -> 11 / 15 / 21 | Lv5 standing ground 0.47 -> 0.67 (bot-played 0.17 -> 0.20: the bot kites out of a 42 px aura) |
| Ocean Dome | dmg 14 -> 21 (a tick no weaker than the Lv5 aura it replaces) | 0.54 -> 0.62; damage taken -54 % -> -62 % |

An area bump for Yarn Orbit / Cosmic Yarn was tried and dropped: bigger balls eat more bullets, and the late-game
storm floor of §7 (`tests/orbitals.test.ts`) went under 10 %.

Stage clear rates (default lab report on the same tree, the old numbers -> the new ones; Hoshi / Rin / Kuro):
every cell within 6 points - Dream Meadow P2 28 -> 32 %, Candy Kingdom P3 38 -> 35 %, Shoujo Academy P4 54 -> 54 %,
Beach P5 50 -> 51 %, Final Arc P5 29 -> 27 % and P6 54 -> 55 %; the first Dream Meadow clear of the progression
sample 1.82 -> 1.86 h (4 accounts). Mochi alone (`--heroes mochi`, measured before the second evolutions landed, with a
slightly larger Yarn Orbit buff): Dream Meadow P2 36 -> 38 %, Candy Kingdom P3 8 -> 13 %, Beach P5 39 -> 47 %: she
still trails the starters at P2-P3.

**Left alone on purpose** (strong, not broken - the owner decides):

- **Cheat Fireball / Meteor Lv.99999** (4-7x): the overdone cast is ~19 normal casts' worth. Isekai-kun's stage
  clear rates sat with the other heroes' (`--heroes isekai_kun`: 60 / 26 / 47 / 55 / 73 % at the intended cells
  against 61 / 22 / 49 / 46 / 53 % for Hoshi / Rin / Kuro, before the second evolutions landed), so it is his
  identity, not a trivial strategy.
- **Galaxy Barrage** (boss 12-15x: the Council President in ~35 s against ~145 s for the kit alone). Boss HP is
  tuned around Hoshi (85 % of the progression simulator's runs), so cutting it would raise walls everywhere.
- **Tapioca Tsunami** (2.9-3.4x), **Notice-Me Sparkles** (2.7x), **Dark Flame Dragon / Unsealed Abyss Dragon**
  (1.7-2.5x).
- Low but doing their job: **Baka Harisen** (0.3-0.5x, damage taken -85 % at Lv5), **Eternal Tea Party** (0.57x,
  -86 %), **Horn of Reincarnation Lv1** (0.43x, -60 %), **Ocean Dome**.
- **Paper Crane Flock** is still flagged (0.49-0.50x): out of dead-weight range, a gap left for players (fold
  streaks, a Wish Charm build) rather than a number to chase.
- The **second evolutions** (§8): the bench flags 8 sibling gaps (Tapioca Tsunami / Brown Sugar Railgun 4.2x,
  Meteor / "Holding Back" 4.9x, Galaxy Barrage / Critical Constellation 2.2x, Meowteor Hammer 0.45x WEAK ...).
  Their balance pass uses this tool.
