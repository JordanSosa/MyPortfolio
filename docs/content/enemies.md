# Enemies and bosses

22 new enemies (+1 split form) and 9 new bosses for stages 2-5 (EXPANSION §10).
Every enemy reuses an existing AI pattern (`_steer.ts` seek / weave / keepAway,
the Pumpkin dash, the Eyepuff shooter, the Teddy tank, the Wisp fuse, the
director's straight-line mode) plus **one twist**. Stats use the `EnemyDef`
fields. HP below is BASE HP (before `enemyHpScale(t)`, elites, adaptive
toughness and Plot Twists) and already includes the stage's toughness tier
(Candy ×1.3, Academy ×1.6, Beach ×2.0, Final Arc ×2.5 over a Dream Meadow
enemy of the same archetype). Speeds px/s, damage per contact.

Sprites face RIGHT, feet pivot, 4-frame loops at 8 fps unless noted; `frame()`
returns a frame for every behaviour state so special frames never show in the
default loop. Speech bubbles: 2-3 signature lines per enemy here; the full
pools and the bubble rules are in `satire.md` §6.

---

## 1. Candy Kingdom (stage 2)

### Gummy Bear — `gummy_bear`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_gummy` 16×16×4 | 12 | 34 | 6 | 6 | 12 | 1 | 11 | 0 |

- **Archetype:** Puff hop-chase (speed pulses with the hop frames).
- **Twist — Elastic:** knockback on it is halved, and 0.25 s after being knocked
  it *boings* 20 px back toward the player (squash f3).
- **Flavours:** spawned with a random tint (code, `EnemyDef.tint` per instance):
  red `0xff4d6d`, lime `0x94e85e`, lemon `0xffe14d`, blue `0x5aa8ff`; the sprite
  is drawn in pale translucent jelly (`W/w` body, `a`-ish shine) so the tint reads.
  Death colours = [tint, white, pinkLight].
- **Elite:** "King-Size Gummy": on death splits into 3 normal gummies.
- **Bubbles:** "Chewy!", "Boing!", "Gummy hug"
- **Art:** chubby translucent bear, round ears, dot eyes + blush, jelly highlight
  pixel top-left. f0-1 hop squash/stretch, f2 airborne, f3 boing (wide squash).

### Candy Corn Soldier — `candy_corn`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_candy_corn` 16×16×4 | 26 | 30 | 8 | 6 | 13 | 2 | 10 | 0.2 |

- **Archetype:** seek; arrives mostly in formation lines (`swarmLine`).
- **Twist — Shield Wall:** while ≥ 2 other Candy Corn Soldiers are within 20 px,
  it takes 40% less damage from projectiles hitting its front half (hits from
  auras, explosions and the ultimate are unaffected). A tiny wrapper shield
  sprite pixel flashes on blocked hits.
- **Elite:** "Corn-mander": soldiers within 60 px move 20% faster; carries a flag.
- **Bubbles:** "Hup! Hup!", "For the Queen!", "Corn-tastic!"
- **Art:** a candy-corn cone body (yellow base `y/Y`, orange middle `o`, white tip
  `w`) with stubby legs, a tiny toothpick spear and a gumdrop helmet. f0-3 march
  (legs alternate, spear bobs).
- Death colours: [yellow, orange, white].

### Donut Roller — `donut_roller`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_donut` 16×16×4 | 44 | 26 (roll 165) | 11 | 7 | 10 | 3 | 13 | 0.3 |

- **Archetype:** Pumpkin Dasher (aimed-once dash with lane telegraph).
- **Behaviour:** every ~3.5 s: spins in place 0.6 s (telegraph: lane line +
  sprinkles flying off), then rolls at 165 px/s in a straight line for 1.2 s.
- **Twist — Ricochet:** if its roll would leave the camera view it bounces off
  the view edge once (reflects) and keeps rolling for the remaining time.
- **Elite:** "Glazed and Confused": rolls twice in a row (second lane telegraphed
  0.3 s).
- **Bubbles:** "Roll out!", "Glazed!", "Sprinkle time"
- **Art:** pink-frosted donut standing on its edge, sprinkles, a face on the
  frosting, tiny feet. f0-1 waddle, f2-3 rolling (rotated 45° steps of the
  sprinkle pattern; code also spins it).
- Death colours: [pink, pinkLight, offWhite, yellow].

### Marshmallow Brute — `marshmallow_brute`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_marshmallow` 24×24×4 | 120 | 22 | 13 | 10 | 20 | 6 | 21 | 0.6 |

- **Archetype:** Teddy tank (gait-synced stomps, dust ring every other step).
- **Twist — Toasty:** hit by fire (`dark_flame_dragon`, `cheat_fireball`, their
  evolutions, or any `explode()`), it becomes Toasted for the rest of its life:
  tint golden-brown `0xdda574`, +30% speed, takes +50% damage, bubble "Toasty!".
- **Elite:** "S'more Supreme": a chocolate-and-biscuit sandwich; when it dies it
  leaves a chocolate puddle (r 24, 4 s) that slows enemies (not the player).
- **Bubbles:** "Squish.", "Fluff mode", "S'more?"
- **Art:** a big squishy marshmallow cylinder with tiny arms, sleepy eyes, a
  satisfied `:3`. f0-3 heavy squash-walk (top compresses on the step frames).
- Death colours: [white, offWhite, pinkLight].

### Lollipop Mage — `lollipop_mage`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_lollipop_mage` 16×20×4 | 30 | 28 | 8 | 6 | 15 | 3 | 10 | 0 |

- **Archetype:** Eyepuff keep-away shooter (keeps ~90 px, 0.4 s charge tell).
- **Attack:** a swirl candy bullet `eb_candy` (8×8×2) aimed at the player, 70 px/s,
  `turn` 1.2 rad/s (curving), dmg 8; from 6:00 a 3-fan.
- **Twist — Sugar High (healer):** every 3rd cast instead heals every candy enemy
  within 60 px by 10% of its max HP (green `+` sparkles, bubble "Sugar rush!").
  Kill the mages first.
- **Elite:** heals 25% and also grants +20% speed for 3 s.
- **Bubbles:** "Sugar rush!", "Abra-candy-bra!", "Sweet!"
- **Art:** a small robed figure with a wizard hat shaped like a swirl lollipop
  (the tall shape), holding a lollipop staff. f0-1 float/bob, f2 cast (staff
  up, swirl glows), f3 heal pose (arms wide).
- Death colours: [pink, mint, yellow, white].

---

## 2. Shoujo Academy (stage 3)

### Hall Monitor — `hall_monitor`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_hall_monitor` 16×16×4 | 34 | 34 (dash 150) | 9 | 6 | 13 | 2 | 10 | 0.2 |

- **Archetype:** seek + Pumpkin-style dash.
- **Twist — NO RUNNING!:** when the player dashes within 100 px, it blows its
  whistle (0.3 s telegraph: whistle frame f3, lane line, bubble "NO RUNNING!")
  and dashes at the player at 150 px/s for 0.5 s. Punishes dash spam; 3 s
  cooldown per monitor.
- **Elite:** "Prefect": its whistle triggers every Hall Monitor within 120 px.
- **Bubbles:** "NO RUNNING!", "Hall pass?", "Tardy!"
- **Art:** a stern round student blob with a yellow armband, cap, and a whistle;
  slit "disapproving" eyes. f0-2 brisk walk, f3 whistle (cheeks puffed).
- Death colours: [navy, yellow, white].

### Love Letter — `love_letter`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_love_letter` 12×10×4 | 7 | 60 | 4 | 4 | 9 | 1 | 7 | 0 |

- **Archetype:** Batbun weave chase; swarm events fly straight lines.
- **Twist — Persistent Admirer:** on death, 20% chance to burst into 3 paper
  hearts (`fx_heart` tinted pink, enemy bullets r 3, 40 px/s, homing 0.8 rad/s,
  life 3 s, dmg 3). The death pop shows a tiny "REJECTED" stamp (cosmetic).
- **Elite:** "Confession": 3 hearts always, and they are faster (60 px/s).
- **Bubbles:** "Senpai...", "Read me!", "♡"
- **Art:** a pink envelope with a heart seal, flapping its flap like wings, tiny
  blush. f0-3 flap (flap up, mid, down, mid).
- Death colours: [pinkLight, white, pink].

### Tsundere Slime — `tsundere_slime`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_tsundere_slime` 16×16×4 | 26 | 36 | 7 | 6 | 11 | 2 | 12 | 0 |

- **Archetype:** Puff hop-chase.
- **Twist — Mixed Signals:** when hit (non-lethal), it blushes and **flees**
  directly away from the player for 1.5 s (bubble "I-it's not like…"), then
  returns at +40% speed for 2 s (bubble "B-baka!"). 4 s cooldown.
- **Elite:** "Ojou Slime" with a tiny drill: its return dash leaves a trail of 3
  static `eb_orb` (life 1.5 s).
- **Bubbles:** "I-it's not like…", "B-baka!", "Hmph!"
- **Art:** a red-orange slime with tiny drill twin-tails (a nod to Akane),
  turned-away eyes, angry brows. f0-1 hop, f2 airborne, f3 blushing flee (face
  covered in `b`, sweat drop).
- Death colours: [red, orange, pinkLight].

### Transfer Student — `transfer_student`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_transfer_student` 16×20×4 | 48 | 30 | 11 | 6 | 15 | 3 | 10 | 0.1 |

- **Archetype:** seek + teleport.
- **Twist — Mysterious Arrival:** never walks in from the spawn ring: it appears
  36-60 px from the player after a 0.6 s telegraph (sparkle circle r 10 +
  bubble "New student!"), then every 5 s it blinks to a new spot 40 px from the
  player (0.5 s telegraph circle at the destination; it can't be hit while
  blinking, `inv` 0.2 s).
- **Elite:** "Exchange Student": blinks every 3 s and leaves a ring of 6 `eb_orb`
  where it left.
- **Bubbles:** "I'm new here.", "Mysterious…", "Did we meet?"
- **Art:** a tall-ish chibi student with long dark hair over one eye, a scarf
  that flutters even indoors, holding a suitcase. f0-1 walk (scarf waves), f2
  teleport-out (dissolving into sparkles), f3 teleport-in.
- Death colours: [lightBlue, navy, white].

### Exam Paper — `exam_paper`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_exam_paper` 12×14×4 | 16 | 44 | 4 | 5 | 10 | 1 | 8 | 0 |

- **Archetype:** Boo sine-wave approach (flutter).
- **Twist — Failing Grade:** contact also applies **F-**: −5% XP gain for 5 s,
  stacking to 3 (−15%); a small red "F-" icon under the XP bar. Cosmetic grade
  letter pops "F-" on contact.
- **Elite:** "Final Exam": F- stacks to 6 and lasts 8 s.
- **Bubbles:** "F-", "Pop quiz!", "Show work"
- **Art:** a sheet of paper with a red "F-" circled at the top, folded corner
  (dog-ear) flapping, angry little face drawn in pencil. f0-3 flutter (the sheet
  bends).
- Death colours: [white, offWhite, red].

### Student Council Ninja — `council_ninja`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_council_ninja` 16×16×4 | 40 | 50 | 9 | 6 | 12 | 3 | 10 | 0 |

- **Archetype:** Eyepuff keep-away shooter at 70 px.
- **Attack:** a 3-fan of `eb_shuriken` (8×8×2, spinning, 85 px/s, dmg 9) every
  3 s after a 0.4 s tell (hand raised).
- **Twist — Smoke Bomb:** when the player comes within 40 px, it vanishes in
  smoke (`fx_puff`) and reappears 60 px behind the player (relative to the
  player's facing), 4 s cooldown.
- **Elite:** throws 5-fans and its smoke bomb leaves a decoy that explodes
  (r 20, 12 dmg) after 1 s.
- **Bubbles:** "Nin nin.", "By order!", "Council business"
- **Art:** a chibi ninja in a navy school uniform with a red council armband and a
  face mask, ponytail. f0-1 crouch-run, f2 throw, f3 smoke (half dissolved).
- Death colours: [navy, darkViolet, red, white].

---

## 3. Beach Episode (stage 4)

### Crab-kun — `crab_kun`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_crab` 16×16×4 | 48 | 40 | 9 | 7 | 9 | 2 | 13 | 0.4 |

- **Archetype:** strafe (custom): moves only sideways relative to the player,
  circling at ~50 px; when it lines up (angle to player within 15° of its "front"),
  it lunges 30 px with claws open (0.3 s tell: claws raised).
- **Twist — Sidestep:** projectiles aimed at it have a 20% chance to be dodged
  (it scuttles 8 px sideways; the projectile passes; bubble "Sidestep!") — max
  once per second.
- **Elite:** "King Crab": crown, lunges twice.
- **Bubbles:** "Snip snip!", "Sideways!", "Pinch!"
- **Art:** a round red crab with big shiny eyes on stalks, raised claws, `:3`.
  f0-1 scuttle (legs alternate), f2 claws up (tell), f3 lunge.
- Death colours: [red, orange, white].

### Seagull — `seagull`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_seagull` 16×16×4 | 12 | 70 (dive 190) | 7 | 5 | 16 | 1 | 9 | 0 |

- **Archetype:** Batbun weave while circling above (drawn with `z` 10, small
  shadow), then a dive: 0.5 s tell (shadow grows + "!" bubble), straight dive at
  190 px/s through the player's position, then climbs away.
- **Twist — Thief:** a seagull that flies over a resting coin or food pickup
  steals it (the pickup is carried, visible in its beak) and flies off-screen;
  kill it before it leaves the view to get the pickup back + 1 coin. Bubble
  "MINE!".
- **Elite:** steals a whole chest if one is on the ground (and drops it on death).
- **Bubbles:** "MINE!", "Chips?", "Squawk!"
- **Art:** a fat white seagull with a yellow beak, side-eye, wings wide. f0-1
  flap, f2 glide, f3 dive (wings tucked, beak forward).
- Death colours: [white, offWhite, yellow].

### Jellyfish — `jellyfish`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_jellyfish` 16×16×4 | 40 | 20 | 8 | 6 | 14 | 2 | 10 | 0 |

- **Archetype:** Boo sine drift (slow).
- **Twist — Zap Pulse:** every 4 s it glows for 0.5 s (telegraph circle r 28,
  cyan) and emits an electric pulse ring (r 28): 8 damage and slows the player
  30% for 1 s if inside.
- **Chain:** when it dies, other jellyfish within 50 px take 30% of their max HP
  (a lightning line between them, `fx.bolts`) — lightning-weapon catnip.
- **Elite:** pulse r 40, every 3 s.
- **Bubbles:** "Bloop.", "Zzzt!", "Wobble"
- **Art:** a translucent lavender bell with pink spots and a big sleepy face,
  4 wavy tentacles. f0-2 pulse swim (bell squashes), f3 glow (bright `a/w`
  outline).
- Death colours: [lavender, pinkLight, aqua].

### Watermelon — `watermelon` (+ split `watermelon_half`)
| id | sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `watermelon` | `en_watermelon` 16×16×4 | 70 | 22 (roll 140) | 12 | 7 | 11 | 3 | 13 | 0.3 |
| `watermelon_half` | `en_watermelon_half` 12×10×2 | 16 | 34 | 7 | 5 | 7 | 1 | 9 | 0 |

- **Archetype:** Donut-style roll (lane telegraph 0.6 s, 140 px/s, 1.4 s) between
  short waddles; also used in `laneCharge` events.
- **Twist — Split:** on death it splits into 2 `watermelon_half` (hop-chase) that
  spit 3-fans of `eb_seed` (6×6×2, 60 px/s, dmg 5) every 2.5 s ("Seedy…").
  Halves never split again.
- **Elite:** "Prize Melon": splits into 4 halves.
- **Bubbles:** "Summer!", "Splat!", "Seedy…"
- **Art:** a round striped watermelon `E/e/l` with a happy face and a sun hat.
  f0-1 waddle, f2-3 roll. Half: red flesh `r/R` with black `0` seeds facing up,
  tiny angry face; f0-1 hop.
- Death colours: [green, red, lime] / half: [red, green, white].

### Sandcastle Golem — `sandcastle_golem`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_sandcastle` 24×24×4 | 220 | 20 | 15 | 10 | 20 | 7 | 21 | 0.8 |

- **Archetype:** Teddy tank.
- **Twist — Rebuild:** when killed it leaves a sand pile (sprite f3, an inert
  non-targetable decal, 4 s) that rebuilds the golem with 50% HP unless the
  player walks over the pile (stomp, "Moat!" pop) or an explosion / area hit
  touches it. Rebuilds once. XP is dropped only on the final death.
- **Elite:** rebuilds twice.
- **Bubbles:** "Rebuild.", "Moat!", "Grr… sand"
- **Art:** a sandcastle with two towers as "ears", a shell for a nose, flag on
  top, stubby sand legs. f0-2 stomp walk (sand trickles), f3 collapsed pile.
- Death colours: [gold, paleYellow, orange].

### Tiny Shark — `tiny_shark`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_tiny_shark` 16×12×4 | 22 | 62 | 10 | 5 | 8 | 1 | 10 | 0 |

- **Archetype:** seek, with a burrowed state.
- **Twist — Fin Mode:** moves as just a fin cutting through the sand (f0-1);
  while finned, homing and auto-aim ignore it (area damage still hits). At 30 px
  from the player it surfaces (0.4 s tell: "!" + f2) and lunges 24 px (f3), then
  stays surfaced and targetable for 1.2 s before diving again.
- **Elite:** "Great Tiny Shark": surfaces with a ring of 6 `eb_seed` "sand spray".
- **Bubbles:** "Nom?", "Chomp!", "…fin."
- **Art:** a chubby baby shark, mostly head, big round eyes, tiny teeth smile.
  f0-1 fin only (sand ripple around it), f2 surfacing (head pops up), f3 chomp
  (mouth wide).
- Death colours: [lightBlue, blue, white].

---

## 4. The Final Arc (stage 5)

### Shadow Clone — `shadow_clone`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| the current hero's `<hero>_run` (set per instance), tint `0x2d1b45` | 150 | 72 | 14 | 6 | 12 | 5 | 12 | 0.3 |

- **Archetype:** seek at the player's base speed.
- **Twist — Mirror:** when the player dashes, every Shadow Clone on screen dashes
  too (toward the player, 0.16 s at 300 px/s, 0.25 s delayed). Every 2.5 s it
  fires one dark `eb_orb` (tint `0x743fd1`) at the player.
- **Look:** the hero's own run animation, dark-plum tinted, with two red eye
  pixels drawn by the view at the head (offset per hero: 24×24 heroes at
  (14, 8), Truck-kun at (25, 9)) and a violet afterimage trail. Truck-kun's clone
  honks silently.
- **Elite:** "Evil Twin": also copies the player's start weapon at Lv1 as enemy
  bullets (one aimed dark orb per its cooldown).
- **Bubbles:** "I am you.", "…", "Nice build."
- Death colours: [deep, darkViolet, red].

### Filler Episode Goon — `filler_goon`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_filler_goon` 16×16×4 | 70 | 36 | 11 | 6 | 13 | 2 | 11 | 0.1 |

- **Archetype:** seek, spawned in groups of 6 (phase mix weight spawns 1; events
  spawn groups).
- **Twist — Recycled Animation:** every goon on screen plays the *same* frame at
  the same time (global frame clock), and when one dies, 25% chance it
  "reappears next episode": respawns once at the spawn ring at full HP (bubble
  "Meanwhile…").
- **Elite:** "Filler Boss": all goons within 80 px get +20% speed and match its
  facing direction.
- **Bubbles:** "Meanwhile…", "Generic!", "No lines."
- **Art:** a faceless grey-lavender henchman in a plain jumpsuit (the face is
  just two dot eyes), deliberately low-detail. f0-3 identical stiff walk (only
  the legs move — limited animation).
- Death colours: [`0x7a6ea3`, lavender, offWhite].

### Plot Hole — `plot_hole`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_plot_hole` 24×24×4 | 500 | 8 | 0 (core 14) | 12 | 12 | 8 | 0 | 1.0 |

- **Archetype:** stationary hazard (drifts at 8 px/s toward the player).
  `noElite`, no contact damage, never spawned closer than 90 px.
- **Twist — Gravity:** pulls the player within 90 px toward its centre (30 px/s
  at the edge → 60 px/s near the core) and does 14 damage every 0.5 s inside
  r 12. It also eats gems and player projectiles that enter r 12 (they vanish
  with a swirl), storing the gems. Killed: "PLOT HOLE FILLED!" pop and it spits
  every eaten gem back out. Collapses by itself after 20 s (spits the gems too).
- **Bubbles:** "Wait, what?", "Plot hole!", "Retcon"
- **Art:** a swirling black-violet vortex with white "torn paper" edges (like a
  hole in the storyboard) and a single confused eye in the middle. f0-3 rotate
  the swirl arms.
- Death colours: [deep, darkViolet, violet, white].

### Animation Error — `animation_error`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_animation_error` 16×16×4 | 90 | 40 | 12 | 5 | 12 | 3 | 10 | 0 |

- **Archetype:** seek, but with frame-skip movement: instead of moving smoothly
  it teleports 12 px toward the player every 0.25 s (unpredictable but fair).
- **Twist — Off-Model:** its hitbox (r 5) is smaller than its drawn size; every
  ~1.5 s it draws for one frame at ×2 scale or squashed (cosmetic glitch,
  `fx_glitch` blocks around it). On death it leaves 2 "dropped frames": static
  copies (12 HP, no damage, 1.5 s) that soak projectiles.
- **Elite:** "Key Animation Missing": becomes a pure sketch outline; immune to
  knockback.
- **Bubbles:** "ERR", "Off-model!", "NaN"
- **Art:** a cute character drawn badly on purpose — one eye bigger than the
  other, a limb on the wrong side, RGB-split edges (`r`/`c` offset columns),
  a missing-texture checker patch `p/0`. f0-3 jitter (pixels shift by 1 at random).
- Death colours: [pink, cyan, lime, white].

### Mini Truck-kun — `mini_truck`
| sprite | hp | speed | dmg | radius | height | xp | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en_mini_truck` 24×16×4 | 110 | 200 (charge) | 16 | 8 | 10 | 5 | 18 | 0.9 |

- **Archetype:** lane charger (`laneCharge` events and the phase mix). Spawns just
  outside the view, telegraphs a lane line through the player's position (0.8 s,
  headlight flash f2, bubble "HONK!"), then drives straight across at 200 px/s
  and leaves the view; never stops, never turns.
- **Twist — Friendly Fire:** enemies in its lane are also hit (its contact damage)
  and are "isekai'd" if killed (light pillar; no XP for the player). It clears
  lanes for you if you stand right.
- **Elite:** "Semi-Truck": twice as long (scale ×2 on x), lane telegraph 1.0 s.
- **Bubbles:** "HONK!", "Beep beep", "Next life!"
- **Art:** a tiny version of Truck-kun with angrier eyes and a red stripe instead
  of blue. f0-1 idle/drive (wheels), f2 headlights flash, f3 boost (exhaust
  flame).
- Death colours: [white, lightBlue, yellow].

### Twist enemy: Rival (Recolour) — `rival_recolour` (special: `special: true`, `noElite`)

Spawned only by the `shounen_rival` Plot Twist (see `stages.md` §6). Uses a
random *other* hero's `<hero>_run` sprite with a red tint (`EnemyDef.tint`
`0xff4d6d`) and the name card-less title pop "YOUR RIVAL (RECOLOUR) APPEARS!".
HP 60 × run minutes (min 120), speed 80, dmg 16, radius 6, xp 10,
`noElite`. Seeks; every 3 s a telegraphed dash (Pumpkin pattern, 220 px/s).
Death: drops a chest and the bubble "Next time… for sure!".

---

## 5. Bosses

Boss conventions from ARCHITECTURE §4 apply (WeakMap state, pattern cycle,
phase change = `inv` 1.2 s + `clearBullets()` + `bossPhase` banner + shockwave,
patterns only while on screen). HP is absolute (stage toughness is NOT applied
to bosses). Since the Season 2 combat-curve pass boss HP is FIXED (`CFG.bossHpPerLevel = 0`: the old player-level
scaling soaked up account power); the live values are in `docs/ARCHITECTURE.md` §6.3 (raised again by the
verification pass, §6.7, so the average player's first clears land at EXPANSION §2's hours). The design
requirement is the fight length for the mid-skill bot at the milestone account in EXPANSION §2: mid
bosses 45-60 s, finals 75-100 s, Cancel-sama ~150 s over four phases. (The `hp` cells of the boss tables
below are the live, fixed values.)

Enemy bullets: aimed ones use `shoot / fan / ring` from `_bullets.ts` (never
spawned near the player); falling ones use ground shadows as telegraphs. Bullet
damage 13-16 like Dream Meadow; `enemyDmgScale(t)` applies as usual.

### 5.1 Gingerbread Golem — `gingerbread_golem` (Candy Kingdom 6:00)
| sprite | hp | ref Lv | speed | dmg | radius | height | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `boss_gingerbread` 56×56×6 | 90,000 | 34 | 30 | 18 | 18 | 40 | 42 | 0.95 |

Name card: **GINGERBREAD GOLEM** — *Baked With Malice (and Cinnamon)*

**Phase 1 (100-50%)**, cycle: Stomp → Icing Slam → Gumdrop Buttons → Stomp → Cookie Cutter
- **Stomp:** walks toward the player for 2.5 s, crumb dust + tiny shake per step.
- **Icing Slam:** jumps (z up to 26), landing circle r 44 telegraphed 1.0 s at the
  player's position; lands: ring of 14 `eb_gumdrop` (70 px/s, 13 dmg) + shockwave;
  ×1.4 contact damage within 36 px.
- **Gumdrop Buttons:** its 3 coat buttons glow 0.5 s, then fly at the player
  (`eb_gumdrop` at 1.5 scale, 90 px/s, 15 dmg) and bounce once off the view edge.
- **Cookie Cutter:** a gingerbread-man-shaped outline is telegraphed around the
  player for 1.2 s (6 circles: head r 14 above, body r 20, arms r 10 left/right,
  legs r 10 below-left/right, dashed `telegraphCircle`s, colour orange); then the
  shape is stamped: 40 damage if the player is inside any circle. Floating text
  `CUT!`.

**Phase 2 (<50%) "HALF-BAKED!"** — *it's still gooey in the middle*
- One leg crumbles (sprite f4); it moves in King Puff hops (×3 per cycle), each
  landing spits 8 `eb_gumdrop`.
- Icing Slam fires 2 rings 0.25 s apart (second offset half a step).
- Each Cookie Cutter is followed by 8 Gummy Bears (encircle r 70); the Cookie
  Cutter telegraph shortens to 0.9 s.

**Death line:** *"...I was supposed to be... a house..."* — crumbles into cookie
crumbs (confetti [orange, gold, white, pink]).

**Sprite:** a hulking gingerbread man with white icing outlines (`w` piping on
`H/h` dough, `d` shadows), three gumdrop buttons (`p`, `l`, `y`), an icing-drawn
angry face, a candy-cane club. f0-1 stomp, f2 jump crouch, f3 slam, f4 half-baked
(missing leg, crumbs), f5 roar (mouth wide, icing cracks).

### 5.2 Sugar Plum Tyrant — `sugar_plum_tyrant` (Candy Kingdom FINAL 11:00)
| sprite | hp | ref Lv | speed | dmg | radius | height | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `boss_sugarplum` 48×64×6 | 200,000 | 60 | 44 | 18 | 14 | 46 | 30 | 0.95 |

Name card: **SUGAR PLUM TYRANT** — *Her Royal Hyperactivity* · `final: true`

Floats like Lady Lunatic (hover anchor above the player, drift).

**Phase 1 (100-60%) "Royal Recital"**, cycle: Pirouette Spiral → Royal Decree → Sugar Coat → Pirouette Teleport
- **Pirouette Spiral:** spins 3 s, a 4-arm spiral of `eb_plum` (62 px/s, turn 0.6,
  15 dmg, 12 bullets/s total).
- **Royal Decree:** scepter up, banner `BY ROYAL DECREE!`; two `swarmLine`s of 8
  Candy Corn Soldiers from opposite sides.
- **Sugar Coat:** 3 aimed fans of 5 `eb_plum` (75 px/s), 0.5 s apart.
- **Pirouette Teleport:** destination telegraph circle 0.6 s, sparkle burst.

**Phase 2 (<60%) "SUGAR RUSH"** — *she's had nine desserts*
- View: saturation +0.15, colours hotter. She moves 30% faster.
- Spirals become 6-arm. **Grand Jeté:** leaps across the screen on an arc (lane
  telegraph 0.8 s), leaving 14 sugar crystals (static `eb_plum`, life 3 s).

**Phase 3 (<25%) "SUGAR CRASH"** — *what goes up...*
- Alternates **SUGAR HIGH** (5.5 s: rings of 20 `eb_plum` every 0.7 s, alternate
  offsets, 70 px/s) and **SUGAR CRASH** (2.5 s: she slumps to the floor, `fx_zzz`,
  no attacks, takes +50% damage). The crash is the reward for surviving the high.

**Enrage** 12:30: everything 25% faster, red tint.
**Death line:** *"My kingdom... for a glass of water..."* · victory `SUGAR CRASH!`

**Sprite:** a regal ballerina-tyrant: plum-purple tutu `I/i` with sugar sparkle
`w`, a crown shaped like a cupcake, pink hair in a giant bun, a lollipop scepter,
pointed slippers, imperious face. f0-1 float, f2 cast (scepter up), f3 pirouette
(blurred skirt), f4 laugh (hand at mouth), f5 crashed (slumped, sleepy).

### 5.3 Student Council President — `council_president` (Shoujo Academy 7:00)
| sprite | hp | ref Lv | speed | dmg | radius | height | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `boss_president` 48×56×6 | 125,000 | 40 | 40 | 17 | 13 | 40 | 28 | 0.95 |

Name card: **STUDENT COUNCIL PRESIDENT** — *Supreme Authority of Room 2-B (and Every Other Room)*

**Phase 1 (100-50%)**, cycle: Motion Denied → Glasses Glint → Hall Monitor Summon
- **Motion Denied:** 3 aimed fans of 5 `eb_stamp` ("DENIED" stamps, 75 px/s,
  14 dmg).
- **Glasses Glint:** glasses flash (f2), 3 lines telegraphed in a 40° fan for
  0.8 s, then glare beams along them for 0.4 s (20 dmg if within 6 px of a line).
- **Hall Monitor Summon:** whistle; 6 Hall Monitors encircle at r 90.
- **School Regulation** (runs on its own clock): every 20 s a rule card drops in
  under the timer for 10 s; random, never the same twice in a row:
  - `RULE 7: NO RUNNING IN THE HALLS` — each dash costs 8 HP (`-8 DETENTION`).
  - `RULE 12: NO LOITERING` — standing still > 1 s deals 6 damage every 0.5 s.
  - `RULE 3: UNIFORM CHECK` — all enemies +20% speed.
  - `RULE 21: SILENCE IN THE LIBRARY` — enemy bullets −20% speed (a gift; her
    one kind rule).

**Phase 2 (<50%) "EMERGENCY ASSEMBLY"** — *attendance is mandatory*
- Motion Denied fans become rings of 18 stamps; rules every 14 s; summons 4
  Student Council Ninjas instead of monitors.

**Phase 3 (<20%) "COUNCIL DISSOLVED?!"** — *she did not see this coming*
- Glasses crack (f5); 5 glare beams rotating at 0.8 rad/s; stamps in a 2-arm
  spiral.

**Death line:** *"This... will go on your... permanent record..."*

**Sprite:** tall, immaculate uniform, long straight navy hair, red armband
"PRESIDENT", rectangular glasses that glint `w`, a clipboard and a giant rubber
stamp. f0-1 idle (clipboard tap, glasses glint), f2 point (accusing finger), f3
stamp slam, f4 cape-blazer swish, f5 rage (cracked glasses, hair wild).

### 5.4 The Bishounen Who Never Notices You — `bishounen` (Shoujo Academy FINAL 13:00)
| sprite | hp | ref Lv | speed | dmg | radius | height | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `boss_bishounen` 48×64×6 | 230,000 | 70 | 36 | 18 | 13 | 46 | 28 | 0.97 |

Name card: **THE BISHOUNEN WHO NEVER NOTICES YOU** — *Fan Club: 9,999 Members (You Are Not One)* · `final: true`

**Gimmick:** in phases 1-2 he never aims at you: his own attacks target random
points or directions, and his sprite always faces away from the player. You get
hit by collateral sparkle. His fan club, however, notices you.

**Phase 1 (100-60%) "Rooftop Brooding"**
- **Hair Flip:** a fan of 9 `eb_rose` in a random direction (never toward the
  player ±30°), 70 px/s.
- **Rose Rain:** 24 `eb_rose` fall from above over 3 s at random x (ground shadow
  warning 0.6 s each), like a starfall.
- **Fan Club:** two `swarmLine`s of 12 Love Letters that DO target you
  ("they see you as competition").
- **Dramatic Wind:** a wind lane (telegraphed 0.6 s, petals) pushes the player
  60 px over 1 s.

**Phase 2 (<60%) "LOOKING AT HIS PHONE"** — *he's busy*
- Phone glare: a beam sweeps a 120° arc over 1.2 s (telegraph 1.0 s), 22 dmg per
  0.2 s inside. 2-arm rose spirals. Love-letter storms (`batStorm`).

**Phase 3 (<25%) "...HE NOTICED YOU?!"** — *everything sparkles*
- View: full shoujo filter (sparkle screen border, bloom +40%, pink lift), music
  swells (intensity 1). He turns to face you (f5) and finally aims: heart
  formations (16 `eb_rose` arranged in a heart that flies at you, 60 px/s),
  aimed 7-fans, sparkle rings of 20.

**Enrage** 14:30.
**Death line:** *"...Who are you again?"* · victory `CLASS DISMISSED!`

**Sprite:** tall bishounen in a long white school coat, flowing silver-lavender
hair, back turned with a 3/4 profile, roses and sparkles built into the sprite,
a phone in one hand. f0-1 hair sway (back to camera), f2 hair flip, f3 looking at
phone (screen glow `a`), f4 wind-swept pose, f5 FACING the camera (sparkling
eyes, rose offered) — used only in phase 3.

### 5.5 Kraken-chan — `kraken_chan` (Beach Episode 8:00)
| sprite | hp | ref Lv | speed | dmg | radius | height | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `boss_kraken` 72×56×6 (+ `boss_kraken_tentacle` 16×48×4) | 270,000 | 45 | 28 | 18 | 22 | 36 | 52 | 0.98 |

Name card: **KRAKEN-CHAN** — *She Just Wants a Hug (Lethally)*

Kraken-chan is a round, chubby cartoon octopus (bath-toy proportions) with a
sailor hat — never humanoid. Tentacles only slam the sand and wave; they never
grab, wrap or hold the player.

**Phase 1 (100-50%)**, cycle: Tentacle Slam → Ink Spray → Hug Attempt → Tentacle Slam
- **Tentacle Slam:** 3 tentacles (`boss_kraken_tentacle`, rise f0-1, slam f2,
  sink f3) rise at circles telegraphed 0.9 s (r 20) near the player; each slam
  deals 16 and emits a ring of 6 `eb_ink`; the tentacle stays 1.5 s (touching it
  deals 10).
- **Ink Spray:** two fans of 7 `eb_ink` (70 px/s, 14 dmg) and 3 ink puddles at
  telegraphed spots (r 18, 4 s, slow the player 30%).
- **Hug Attempt:** lunges at the player (lane telegraph 0.7 s, 220 px/s), 22 dmg
  on contact with a `HUG!` pop.

**Phase 2 (<50%) "HIGH TIDE"** — *the tide's coming in (it's her)*
- A water band creeps in from all view edges to 40 px deep (slow 30% inside,
  waves drawn by the view) for the rest of the fight.
- **Whirlpool:** 3-arm spiral of `eb_ink` for 2.5 s.
- **Tentacle Ring:** 6 tentacles rise in a ring r 64 around the player with one
  telegraphed gap.

**Death line:** *"Nobody... ever wants... to hug the kraken..."* — during the
death slow-mo a Crab-kun walks up and hugs her (harmless cosmetic `en_crab`),
she blushes: `...♡`.

**Sprite:** big round head-body `p/q` pink-coral with lighter spots, huge
sparkly eyes, blush, a white sailor hat with a navy ribbon, 6 stubby tentacles
along the bottom. f0-1 bob/wiggle, f2 ink cannon (cheeks puffed), f3 submerge
(half under sand), f4 rise (splash), f5 blush (death / hug).

### 5.6 Summer Festival Firework Dragon — `firework_dragon` (Beach Episode FINAL 15:00)
| sprite | hp | ref Lv | speed | dmg | radius | height | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `boss_firework_dragon` 72×48×6 head + 6× `boss_firework_body` 16×16×2 | 430,000 | 78 | 60 | 18 | 18 | 30 | 40 | 1.0 |

Name card: **SUMMER FESTIVAL FIREWORK DRAGON** — *Tonight's Main Event (Do Not Look Directly At)* · `final: true`

Only the head is a hitbox; the 6 body segments follow the head's path (the view
draws them; the sim checks segment contact vs the player: 18 dmg).

**Phase 1 (100-60%) "Opening Ceremony"**
- **Rocket Volley:** 3 rockets (`eb_firework`) shoot up; burst circles telegraphed
  1.0 s (r 28) on the ground; each bursts into a ring of 16 `eb_firework`
  (60 px/s with drag 30 px/s², then they fall) + `TAMAYA!` pop.
- **Dragon Dance:** slithers across the view on a sine path (120 px/s) for 3 s.
- **Sparkler Breath:** two aimed fans of 9 `eb_firework` (80 px/s).

**Phase 2 (<60%) "GRAND FINALE (EARLY)"** — *they fired everything too soon*
- Grade lerps to `night`; a rocket every 0.8 s continuously; dances faster; burst
  colours cycle (view tints).

**Phase 3 (<25%) "ENCORE!!"**
- Every pattern at 70% density at once; finale: 5 rockets burst in a pentagon
  around the player; bullets +15% speed. Flashes respect Reduce flashing.

**Enrage** 16:30.
**Death line:** *"...and that concludes tonight's show. Please exit in an orderly
fashion."* · victory `SUMMER'S OVER!`

**Sprite:** a paper festival-lantern dragon head (red-and-gold, `r/R/y/Y`) with
googly lantern eyes, a firework fuse for whiskers, sparks; body segments are
round paper lanterns with sparklers. f0-1 slither, f2 inhale, f3 breathe
(sparks), f4 burst pose (mouth wide), f5 coil. Body f0-1 sway.

### 5.7 Truck-kun — `truck_kun_boss` (The Final Arc 8:00)
| sprite | hp | ref Lv | speed | dmg | radius | height | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `boss_truck` 72×48×6 | 520,000 | 45 | 60 (charge 320) | 22 | 18 | 26 | 60 | 1.0 |

Name card: **TRUCK-KUN** — *Reincarnation Services, Est. Too Many Protagonists Ago*
If the player IS Truck-kun: **TRUCK-KUN?!** — *The Evil Alternate-Universe One
(It Has a Moustache)*: tint `0xff9a3d`, the view draws `boss_truck_moustache`
under the grille.

**Phase 1 (100-50%)**, cycle: Lane Change ×3 → Reverse Beep → Traffic Cone Scatter
- **Lane Change:** headlights flash (f2); a lane line across the whole view through
  the player (half width 16, 0.8 s); it charges across at 320 px/s and leaves the
  view, re-entering from another side 0.6 s later.
- **Reverse Beep:** backs up toward the player for 4 s (f5); every beep (0.5 s) a
  ring of 10 `eb_cone` (50 px/s).
- **Traffic Cone Scatter:** lobs 8 cones to telegraphed spots (shadows, 0.8 s);
  they land as static hazards (`eb_cone`, life 4 s).

**Phase 2 (<50%) "RUSH HOUR"** — *it brought friends*
- `laneCharge` of 3 Mini Truck-kuns every 6 s; Lane Change ×4 with 0.6 s
  telegraphs; **Horn Blast:** honk shockwave ring r 80 around itself (telegraph
  circle 0.6 s, 20 dmg).

**Death line:** *"...HONK. (Translation: See you in the next world.)"* — it
isekai's itself: a giant `fx_light_pillar`.

**Sprite:** the big version of the hero design but menacing: grimy white, red
racing stripe, headlights as glaring eyes with heavy brows, a grille of teeth,
dents, a "REINCARNATION SERVICES" box. f0-1 idle rumble, f2 headlights flash, f3
charge (tilted forward, dust), f4 drift (angled, tyre smoke), f5 reverse
(reverse light `w` on, beeping lines).

### 5.8 Rival-chan — `rival_chan` (The Final Arc 14:00)
| sprite | hp | ref Lv | speed | dmg | radius | height | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `boss_rival` 48×56×6 | 600,000 | 68 | 70 | 20 | 12 | 40 | 24 | 0.95 |

Name card: **RIVAL-CHAN** — *Your Rival Since Episode 1 (You Don't Remember Her)*

**Phase 1 (100-60%) "REMATCH!"**
- **Dash Slash:** 3 telegraphed dashes (lane 0.5 s each, 360 px/s); each leaves a
  slash line of 8 static `eb_rival` (life 1.2 s).
- **Rival Beam:** charge 0.8 s (line telegraph), then a beam sweeping 60° over
  1 s, 20 dmg per 0.2 s.
- **Star Fans:** 3 aimed fans of 7 `eb_rival` (80 px/s).

**Phase 2 (<60%) "I'VE BEEN TRAINING!"** — *she has a montage now*
- A red-orange flame aura; dashes ×4, beam sweeps 120°, 2-arm spiral rings.
- **Training Montage** (once, at the start of the phase): she does push-ups for
  4 s (no attacks, takes ×2 damage, caption `~ TRAINING MONTAGE ~`, music sting
  `narratorSting`), then fights at +20% speed for the rest of the battle.

**Phase 3 (<25%) "FINAL CLASH"**
- **Final Beam:** charges 2.0 s — a 40-px-wide lane telegraph aimed at the player,
  tracking for the first 1.2 s, then locked — fires for 1.5 s (40 dmg per 0.2 s).
  She takes ×1.5 damage while charging. Dash slashes between beams.

**Death line:** *"Hmph... you've gotten stronger. I'll be back next season!!"* —
she vanishes in a smoke bomb.

**Sprite:** a spiky-haired shounen-rival girl (short red-black hair, headband with
long tails, a scar plaster on the cheek, a training gi with a star patch, fists
taped). Smug grin. f0-1 idle bounce (fists up), f2 dash (low, afterimage), f3
beam cast (both palms forward), f4 frustrated (gritted teeth), f5 power-up
(aura, hair flared, headband tails up).

### 5.9 CANCEL-SAMA, the Network Executive — `cancel_sama` (The Final Arc FINAL 19:00)
| sprite | hp | ref Lv | speed | dmg | radius | height | shadow | knockResist |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `boss_cancel` 64×72×8 | 1,900,000 | 90 | 30 | 22 | 18 | 52 | 44 | 1.0 |

Name card: **CANCEL-SAMA** — *The Network Executive. Your Ratings Are Concerning.* · `final: true`, music `cancel`

A giant suit with an old CRT television for a head (the screen shows his
expression: a frown, a falling graph, static). Holds a huge red rubber stamp.
Not modelled on any real person or company.

The game degrades through his phases. Protected from every degradation: the
player, enemy bullets, gems, the HUD and text. "Reduce flashing" replaces all
degradation with a corner badge naming the phase.

**Phase 1 (100-75%) "PITCH MEETING"**
- **Cancel Stamp:** stamp raised (f2), circle r 48 telegraphed on the player
  1.0 s, slam (f3): 30 dmg + ring of 16 `eb_memo` + a `CANCELLED` stamp decal on
  the ground for 3 s.
- **Spreadsheet:** 5 rows of `eb_memo` slide in from the left edge, then 5
  columns from the top (the grid's gaps are telegraphed as safe cells).
- **Focus Group:** 12 Filler Goons encircle.

**Phase 2 (75-50%) "RATINGS DROP"** — *viewers are leaving*
- View: saturation lerps 1.0 → 0.25 over the phase.
- **Ratings Graph:** a jagged descending line of 20 `eb_memo` spawns across the
  view like a stock chart, holds 0.6 s, then drifts downward at 40 px/s.
- 2 Plot Holes at telegraphed spots; Cancel Stamp ×2.

**Phase 3 (50-25%) "BUDGET CUTS"** — *we couldn't afford the frames*
- View: render scale 0.5 (half resolution) and sprite animation at 6 fps for
  enemies, the boss and deco (the player, bullets and gems keep full rate);
  particles at 50%.
- **Reused Animation:** replays phase-1 patterns mirrored. **Outsourcing:** 8
  Animation Errors. The boss flickers off-model (scale jitter ±10%).

**Phase 4 (25-0%) "RUSHED ENDING"** — *we have 60 seconds left*
- Speed lines on the screen edges permanently. Every 2.5 s a 0.3 s **still frame**:
  enemies and bullets freeze in a dramatic held pose with speed lines (the player
  can still move — a gift). Patterns ×1.3 speed, stamp + grid + graph combined.
  A countdown under the timer, `EPISODE ENDS IN 60`; at 0: `OVERTIME`, bullets
  +25% speed (no instant kill).

**Enrage** 20:30.
**Death line:** *"Fine. FINE. ...Renewed. Don't make me regret this."* — colour
floods back in a wave from his position, the resolution snaps back, the frame
rate returns, banner `RENEWED FOR SEASON 2!!`, fireworks.

**Sprite:** dark suit `2/1` with a red tie `r`, CRT TV head `g/G` with a screen
`a/c` showing a face drawn in `0`, antenna ears, the stamp `R/r` with
"CANCEL" letters `w`. f0-1 idle (screen face blinks), f2 stamp raised, f3 stamp
slam, f4 phone call (cellphone to the TV), f5 laugh (screen shows "LOL"
pixels), f6 glitched (screen static, RGB split), f7 defeated (screen shows
"RENEWED" pixels and a tiny smile).

---

## 6. Bullet sprites (new)

| id | Size × frames | Used by | Look |
| --- | --- | --- | --- |
| `eb_candy` | 8×8×2 | Lollipop Mage | pink-white swirl candy, glowing core |
| `eb_shuriken` | 8×8×2 | Council Ninja | 4-point navy-silver star, white core (code spins it) |
| `eb_seed` | 6×6×2 | Watermelon Half, Tiny Shark elite | black seed with a pink glow halo |
| `eb_gumdrop` | 10×10×2 | Gingerbread Golem | sugared gumdrop, hot-pink glow |
| `eb_plum` | 10×10×2 | Sugar Plum Tyrant | plum-purple sugar-crystal orb, white core |
| `eb_stamp` | 12×12×2 | Council President | red "DENIED" stamp mark, glowing rim |
| `eb_rose` | 10×10×2 | Bishounen | red rose head with sparkle core |
| `eb_ink` | 10×10×2 | Kraken-chan | violet ink blob with an aqua glow ring |
| `eb_firework` | 10×10×2 | Firework Dragon | star spark, white core, colour tinted by code |
| `eb_cone` | 10×10×2 | Truck-kun | orange traffic cone with white stripe, glow |
| `eb_rival` | 10×10×2 | Rival-chan | red-orange energy star, white core |
| `eb_memo` | 12×12×2 | Cancel-sama | folded memo sheet with a red "X", bright outline |

All enemy bullets: bright core, high-contrast rim, drawn on the bullet layer
with glow — readability rules from DESIGN pillar 5.
