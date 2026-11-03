# Weapons, evolutions, Limit Breaks, passives

20 weapons (8 existing + 12 new), each with an evolution (40 weapon defs), and 16
passives (8 existing + 8 new). Numbers use the same `WeaponLevel` shape as the
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

**desc:** "Teacups orbit you and spill tea. Puddles heal you and scald enemies."

**Behaviour.** `amount` cups orbit at r 30 × area, `speed` rad/s; contact
damage `dmg`, per-enemy re-hit `every` s. Every `cd` s the cup at the front of
the orbit tips (f1) and leaves a **tea puddle** where it is: r `puddleR` × area,
lives `life` × duration s, max 6 alive (oldest dries first). Enemies in a puddle
take `puddleDmg` every 0.5 s and are slowed 15%. The player standing in any
puddle heals `heal` HP/s × `healMul` (puddles do not stack).

**Twist.** The only signature weapon that heals: Pudding builds can play
"stand in the tea".

| Lv | dmg | cd (spill) | amount | speed | every | puddleR | puddleDmg | life | heal | upgrade text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 8 | 2.5 | 2 | 3.0 | 0.5 | 14 | 4 | 4 | 1 | — |
| 2 | 8 | 2.5 | 3 | 3.0 | 0.5 | 14 | 4 | 4 | 1 | "+1 teacup" |
| 3 | 11 | 2.5 | 3 | 3.0 | 0.5 | 16 | 6 | 4 | 1 | "Damage +3, hotter, wider puddles" |
| 4 | 11 | 2.0 | 4 | 3.2 | 0.5 | 16 | 6 | 4 | 1 | "+1 teacup, spills more often" |
| 5 | 14 | 2.0 | 4 | 3.2 | 0.45 | 20 | 8 | 5 | 1.5 | "Damage +3, bigger, longer, more healing puddles" |

**Visuals.** `w_teacup` (10×10×2: f0 upright with saucer, f1 tipping), puddles
`w_tea_puddle` (24×14×3: f0 splash, f1 resting, f2 drying — last 0.5 s) on the
ground-decal layer, 2 steam wisps (`fx_puff` tinted white, alpha 0.4) rising per
puddle per second.

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
| 1 | 9 | 1.2 | 3 | 170 | 100 | 1 | 25 | — |
| 2 | 9 | 1.2 | 4 | 170 | 100 | 1 | 25 | "+1 crane" |
| 3 | 12 | 1.2 | 4 | 180 | 115 | 1 | 25 | "Damage +3, wider patrol" |
| 4 | 12 | 1.0 | 5 | 180 | 115 | 1 | 28 | "+1 crane, darts more often" |
| 5 | 15 | 1.0 | 6 | 190 | 115 | 2 | 30 | "Damage +3, +1 crane, darts pierce 2" |

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
| 1 | 4 | 0.5 | 40 | 0.6 | 0.6 | 1 | 0.5 | 5 | — |
| 2 | 5 | 0.5 | 44 | 0.6 | 0.6 | 1 | 0.5 | 5 | "Damage +1, bigger blanket" |
| 3 | 5 | 0.5 | 44 | 0.5 | 0.6 | 1 | 1.0 | 5 | "Cosier: stronger slow, more regen" |
| 4 | 7 | 0.5 | 44 | 0.5 | 0.4 | 2 | 1.0 | 5 | "Damage +2, deploys faster, +1 armor inside" |
| 5 | 9 | 0.5 | 52 | 0.5 | 0.4 | 2 | 1.0 | 5 | "Damage +2, bigger; enemies inside 3 s fall asleep and take +25% damage" |

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
| `eternal_tea_party` | Eternal Tea Party | "EVOLUTION! A flying teapot pours a scalding tea moat around you while six cups fling hot droplets." | `{ dmg: 16, cd: 1.2, amount: 6, speed: 3.4, every: 0.4, moatR: 44, moatW: 10, moatDmg: 10, slow: 0.7, dropDmg: 12, killHeal: 8, petit: 0.02 }` |
| `al_dente_armageddon` | Al Dente Armageddon | "EVOLUTION! 24-missile salvos. The trails are now actual spaghetti. The spaghetti is on fire." | `{ dmg: 14, cd: 1.8, amount: 24, speed: 190, turn: 6, blast: 18, knock: 40, sauceDmg: 6, sauceLife: 1.2 }` |
| `dere_dere_harisen` | Dere Dere Harisen | "EVOLUTION! A heart-shaped fan smacks all around you. Smacked enemies become projectiles. '...b-baka ♡'" | `{ dmg: 60, cd: 1.1, amount: 1, radius: 54, knock: 320, stun: 0.5, missile: 0.6, healPer: 1, healMax: 3 }` |
| `shoujo_filter` | Shoujo Filter | "EVOLUTION! Everything near you is drawn in shoujo style. Charmed enemies hit 3× harder; every 6 s, a Kira Kira Moment charms them all." | `{ dmg: 10, cd: 0.4, amount: 1, radius: 64, charm: 0.2, duration: 4, max: 20, charmDmgMul: 3, critBonus: 0.5, kiraEvery: 6, kiraTime: 2 }` |
| `infinite_henshin_loop` | Infinite Henshin Loop | "EVOLUTION! You never stop transforming. Every henshin leaves a Plot Armor shield." | `{ dmg: 70, cd: 2.5, amount: 1, radius: 88, iframe: 0.9, ribbons: 12, ribbonDmg: 18, knock: 200 }` |
| `cheat_meteor` | Meteor Lv.99999 | "EVOLUTION! He trained (once). Meteors fall on the biggest crowd; every third one is... a lot." | `{ dmg: 120, cd: 2.4, amount: 1, blast: 48, overdo: 3, overdoBlast: 110, small: 2, smallDmg: 30, knock: 160 }` |
| `isekai_rush_hour` | Isekai Rush Hour | "EVOLUTION! The honk goes 360° and phantom trucks plough through crowds on a schedule." | `{ dmg: 40, cd: 1.5, amount: 1, radius: 72, knock: 220, ram: 45, truckEvery: 4, truckDmg: 90, truckSpeed: 480, isekai: 0.4 }` |
| `tapioca_tsunami` | Tapioca Tsunami | "EVOLUTION! Giant boba pearls bounce 8 times and shed regular pearls on every bounce." | `{ dmg: 30, cd: 1.6, amount: 2, speed: 160, bounce: 8, shed: 3, shedDmg: 14, shedBounce: 2, knock: 60 }` |
| `thousand_crane_wish` | Thousand Crane Wish | "EVOLUTION! Twelve golden cranes. Every 1,000 crane kills grants a Wish: a full heal and a golden crane storm." | `{ dmg: 22, cd: 0.7, amount: 12, speed: 210, range: 130, pierce: 3, knock: 30, wish: 1000, stormDmg: 200 }` |
| `sold_out_dome_tour` | Sold-Out Dome Tour | "EVOLUTION! Spotlight waves on every beat, and every 8 beats the whole screen gets an ENCORE." | `{ dmg: 22, every: 1, amount: 4, arc: 90, range: 110, knock: 50, encore: 8, encoreDmg: 40, rank: 0.12 }` |
| `eternal_winter_break` | Eternal Winter Break | "EVOLUTION! The kotatsu comes with you, pulls in gems, and lobs mikan when you get Too Comfy." | `{ dmg: 14, cd: 0.4, amount: 1, radius: 64, slow: 0.4, armor: 2, regen: 1.5, comfy: 3, gemPull: 120, mikanEvery: 0.5, mikanDmg: 20 }` |

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
  a petit four (`w_petit_four`, food, heal 5).
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
| Paper Crane Flock | evolve 10 weapons (lifetime) | `evolve_10` | "Fold ten evolutions. Origami is just paper evolving." |
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
