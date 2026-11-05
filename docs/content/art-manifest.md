# Season 2 art manifest

Every NEW sprite id for Season 2, generated from the Season 2 section of
`src/art/manifest.ts` (the source of truth the atlas, the validator and the
game read). Re-generate this file whenever that section changes. Existing ids
are unchanged.

**Contract** (same as the base game, `src/art/manifest.ts` header and DESIGN §5):
- Palette keys from `src/art/palette.ts` only (local `pal` overrides for
  semi-transparent pixels / special glows). Outline `1` (dark plum), never black.
  Hue-shifted ramps: shadows lean purple/blue, highlights warm. Light from top-left.
- Pivots: `feet` → (w/2, h−1) for actors, bosses, props, deco, ground-standing fx;
  `center` → (w/2, h/2) for projectiles, fx, pickups, icons, portraits, tiles, UI.
- Everything faces RIGHT (code mirrors). Leave a 1-px transparent margin when using
  auto-outline.
- Glowing things (bullets, projectiles, crystals, pops) have a bright core; enemy
  bullets must read on every stage's ground (pink frosting, pale stone, sand,
  dark storyboard paper).
- Work in `src/art/wip/` with `npm run sprites -- --wip --filter <id> --scale 6
  --out shots/x.png`, move finished files into `src/art/sprites/`.
- Filter one group: `npm run sprites -- --owner s2-items --scale 4`.

**Reused sprites (no new art):** the Shadow Clone and the Rival (Recolour) twist
enemy use hero `<hero>_run` sprites with a tint; Kuro's ult shadow is
`w_salamander` drawn ×10 in near-black; Isekai Express and Isekai Rush Hour
draw `truck_kun_run` as ghostly trucks; ambient layers reuse `fx_px` /
`fx_spark`; the stage cards on the hub are composed in the DOM from tiles,
deco and enemy sprites.

| Group | Entries | Scope |
| --- | --- | --- |
| `s2-heroes-a` | 23 | Kuro, Pudding, Aoi, Akane (sprites, portraits, ult actors) |
| `s2-heroes-b` | 22 | Senpai, Magical Girl #47, Isekai-kun, Truck-kun (sprites, portraits, ult actors) |
| `s2-stages-a` | 32 | Candy Kingdom + Shoujo Academy (tiles, deco, props, enemies, bullets) |
| `s2-stages-b` | 31 | Beach Episode + The Final Arc (tiles, deco, props, enemies, bullets) |
| `s2-bosses` | 21 | 9 bosses, boss actors, boss bullets |
| `s2-items` | 165 | weapon fx, pops, all 16×16 icons (weapons, evolutions, passives, 61 relics, 15 twists, UI), hub / gacha / board UI art |
| **total** | **294** | |

---

## `s2-heroes-a` (23)

Kuro, Pudding, Aoi, Akane: idle 4 / run 6 / hurt 1 / cast 2 at 24×24, a 64×64 two-expression portrait each, and their ultimate actors. Match the existing three heroes exactly (shared face construction in `chars-util`, 3/4 view facing right, head ≈ 55% of height, outline `1`). Art direction per hero: `heroes.md` §2.

| id | size | frames | pivot | art direction |
| --- | --- | --- | --- | --- |
| `kuro_idle` | 24×24 | 4 | feet | Kuro, chuunibyou 'Lord of the Abyssal Flame': spiky black hair with one crimson streak, crimson visible eye, star-marked eyepatch on the near eye, high-collared tattered black cape (red lining), bandaged right arm with violet rune pixels, navy school jacket, tiny orange salamander on his shoulder - idle loop: breathing bob, hair/accessory sway, a blink on one frame |
| `kuro_run` | 24×24 | 6 | feet | Kuro, chuunibyou 'Lord of the Abyssal Flame': spiky black hair with one crimson streak, crimson visible eye, star-marked eyepatch on the near eye, high-collared tattered black cape (red lining), bandaged right arm with violet rune pixels, navy school jacket, tiny orange salamander on his shoulder - run cycle, bouncy, accessories trail behind |
| `kuro_hurt` | 24×24 | 1 | feet | Kuro, chuunibyou 'Lord of the Abyssal Flame': spiky black hair with one crimson streak, crimson visible eye, star-marked eyepatch on the near eye, high-collared tattered black cape (red lining), bandaged right arm with violet rune pixels, navy school jacket, tiny orange salamander on his shoulder - hurt: eyes squeezed shut ('><'), recoiling |
| `kuro_cast` | 24×24 | 2 | feet | Kuro, chuunibyou 'Lord of the Abyssal Flame': spiky black hair with one crimson streak, crimson visible eye, star-marked eyepatch on the near eye, high-collared tattered black cape (red lining), bandaged right arm with violet rune pixels, navy school jacket, tiny orange salamander on his shoulder - power pose for the ultimate |
| `pudding_idle` | 24×24 | 4 | feet | Pudding, maid cafe ace: honey-blonde twin buns, tall white lace headdress, caramel eyes, black dress with white frilly apron (pink heart pocket), silver tray held level with a wobbling caramel pudding - idle loop: breathing bob, hair/accessory sway, a blink on one frame |
| `pudding_run` | 24×24 | 6 | feet | Pudding, maid cafe ace: honey-blonde twin buns, tall white lace headdress, caramel eyes, black dress with white frilly apron (pink heart pocket), silver tray held level with a wobbling caramel pudding - run cycle, bouncy, accessories trail behind |
| `pudding_hurt` | 24×24 | 1 | feet | Pudding, maid cafe ace: honey-blonde twin buns, tall white lace headdress, caramel eyes, black dress with white frilly apron (pink heart pocket), silver tray held level with a wobbling caramel pudding - hurt: eyes squeezed shut ('><'), recoiling |
| `pudding_cast` | 24×24 | 2 | feet | Pudding, maid cafe ace: honey-blonde twin buns, tall white lace headdress, caramel eyes, black dress with white frilly apron (pink heart pocket), silver tray held level with a wobbling caramel pudding - power pose for the ultimate |
| `aoi_idle` | 24×24 | 4 | feet | Aoi, chibi mech pilot: round white trash-can-shaped mech with blue panels, stubby legs, two chunky arm cannons, caution stripes; a glass dome on top with Aoi inside (blue bob, aviator goggles pushed up) - idle loop: breathing bob, hair/accessory sway, a blink on one frame |
| `aoi_run` | 24×24 | 6 | feet | Aoi, chibi mech pilot: round white trash-can-shaped mech with blue panels, stubby legs, two chunky arm cannons, caution stripes; a glass dome on top with Aoi inside (blue bob, aviator goggles pushed up) - run cycle, bouncy, accessories trail behind |
| `aoi_hurt` | 24×24 | 1 | feet | Aoi, chibi mech pilot: round white trash-can-shaped mech with blue panels, stubby legs, two chunky arm cannons, caution stripes; a glass dome on top with Aoi inside (blue bob, aviator goggles pushed up) - hurt: eyes squeezed shut ('><'), recoiling |
| `aoi_cast` | 24×24 | 2 | feet | Aoi, chibi mech pilot: round white trash-can-shaped mech with blue panels, stubby legs, two chunky arm cannons, caution stripes; a glass dome on top with Aoi inside (blue bob, aviator goggles pushed up) - power pose for the ultimate |
| `akane_idle` | 24×24 | 4 | feet | Akane, tsundere drill princess: two ENORMOUS red-orange spiral drill twin-tails as tall as her body, golden eyes, sharp brows, permanent blush, big red bow, white sailor top with navy collar and red tie, red skirt, white paper harisen fan - idle loop: breathing bob, hair/accessory sway, a blink on one frame |
| `akane_run` | 24×24 | 6 | feet | Akane, tsundere drill princess: two ENORMOUS red-orange spiral drill twin-tails as tall as her body, golden eyes, sharp brows, permanent blush, big red bow, white sailor top with navy collar and red tie, red skirt, white paper harisen fan - run cycle, bouncy, accessories trail behind |
| `akane_hurt` | 24×24 | 1 | feet | Akane, tsundere drill princess: two ENORMOUS red-orange spiral drill twin-tails as tall as her body, golden eyes, sharp brows, permanent blush, big red bow, white sailor top with navy collar and red tie, red skirt, white paper harisen fan - hurt: eyes squeezed shut ('><'), recoiling |
| `akane_cast` | 24×24 | 2 | feet | Akane, tsundere drill princess: two ENORMOUS red-orange spiral drill twin-tails as tall as her body, golden eyes, sharp brows, permanent blush, big red bow, white sailor top with navy collar and red tie, red skirt, white paper harisen fan - power pose for the ultimate |
| `portrait_kuro` | 64×64 | 2 | center | Kuro bust portrait (3/4 facing right): big crimson eye, star-drawn eyepatch, band-aid on the cheek, collar up to the nose, black-violet 'dark sparkles'. f0 = smug smirk, two fingers framing the eye. f1 = shouting, glowing bandaged fist forward, the salamander also shouting |
| `portrait_pudding` | 64×64 | 2 | center | Pudding bust portrait: honey buns + lace headdress, caramel eyes with heart-shaped highlights, frilly collar, 'PUDDING' name badge. f0 = closed-eye service smile, head tilted. f1 = hands making a heart at chin height, mouth open on 'KYUN', eyes shining |
| `portrait_aoi` | 64×64 | 2 | center | Aoi bust portrait in a blue/white pilot suit, goggles on forehead, plaster on the nose, wrench behind the ear. f0 = proud grin + thumbs up. f1 = battle cry, fist forward, goggles pulled down reflecting fire, speed lines |
| `portrait_akane` | 64×64 | 2 | center | Akane bust portrait: the drills frame and overflow the whole 64x64, golden eyes, pointed brows, 3-stroke blush. f0 = arms crossed, looking away, pout, a 'hmph' puff. f1 = harisen swinging at the viewer, mouth wide on 'BAKA', triangle eyes, full blush |
| `ult_flashlight` | 12×12 | 1 | center | Kuro ult reveal: a tiny yellow flashlight on its side pointing right with a short light cone |
| `ult_omurice` | 48×32 | 2 | feet | Pudding ult: a giant plate of omurice (golden omelette dome on rice, white plate). f0 plain, f1 with a red ketchup heart drawn on top + sparkles |
| `ult_robot_fist` | 48×48 | 2 | center | Aoi ult: a giant white-and-blue robot fist seen from above-front, rivets, caution stripes on the wrist. f0 open hand, f1 clenched fist (falls from the sky) |

---

## `s2-heroes-b` (22)

Senpai, Magical Girl #47, Isekai-kun, Truck-kun (32×24 side-view truck), their portraits, the status-window ult actor and the C6 trailer. Same rules as group A; Truck-kun's portrait is the truck front-on.

| id | size | frames | pivot | art direction |
| --- | --- | --- | --- | --- |
| `senpai_idle` | 24×24 | 4 | feet | Senpai, sparkly bishounen: tall for a chibi, long side-swept lavender-silver hair over one eye, violet eyes with long lashes, open white blazer with gold buttons, red rose in the breast pocket, 2-3 sparkle pixels built into every frame - idle loop: breathing bob, hair/accessory sway, a blink on one frame |
| `senpai_run` | 24×24 | 6 | feet | Senpai, sparkly bishounen: tall for a chibi, long side-swept lavender-silver hair over one eye, violet eyes with long lashes, open white blazer with gold buttons, red rose in the breast pocket, 2-3 sparkle pixels built into every frame - run cycle, bouncy, accessories trail behind |
| `senpai_hurt` | 24×24 | 1 | feet | Senpai, sparkly bishounen: tall for a chibi, long side-swept lavender-silver hair over one eye, violet eyes with long lashes, open white blazer with gold buttons, red rose in the breast pocket, 2-3 sparkle pixels built into every frame - hurt: eyes squeezed shut ('><'), recoiling |
| `senpai_cast` | 24×24 | 2 | feet | Senpai, sparkly bishounen: tall for a chibi, long side-swept lavender-silver hair over one eye, violet eyes with long lashes, open white blazer with gold buttons, red rose in the breast pocket, 2-3 sparkle pixels built into every frame - power pose for the ultimate |
| `magical_girl_47_idle` | 24×24 | 4 | feet | Magical Girl #47, aggressively generic: shoulder-length LIGHT BLUE hair with one pink heart clip, standard blue eyes, mint-and-white puffy dress, white boots, pink heart wand, a tiny gold badge on the chest; deliberately template-like and symmetrical - idle loop: breathing bob, hair/accessory sway, a blink on one frame |
| `magical_girl_47_run` | 24×24 | 6 | feet | Magical Girl #47, aggressively generic: shoulder-length LIGHT BLUE hair with one pink heart clip, standard blue eyes, mint-and-white puffy dress, white boots, pink heart wand, a tiny gold badge on the chest; deliberately template-like and symmetrical - run cycle, bouncy, accessories trail behind |
| `magical_girl_47_hurt` | 24×24 | 1 | feet | Magical Girl #47, aggressively generic: shoulder-length LIGHT BLUE hair with one pink heart clip, standard blue eyes, mint-and-white puffy dress, white boots, pink heart wand, a tiny gold badge on the chest; deliberately template-like and symmetrical - hurt: eyes squeezed shut ('><'), recoiling |
| `magical_girl_47_cast` | 24×24 | 2 | feet | Magical Girl #47, aggressively generic: shoulder-length LIGHT BLUE hair with one pink heart clip, standard blue eyes, mint-and-white puffy dress, white boots, pink heart wand, a tiny gold badge on the chest; deliberately template-like and symmetrical - power pose for the ultimate |
| `isekai_kun_idle` | 24×24 | 4 | feet | Isekai-kun, beige overpowered protagonist: flat volume-less beige-brown hair, small neutral brown eyes, beige hoodie, grey adventurer cape, sword on his back, a tiny blue status-window icon floating by his head - idle loop: breathing bob, hair/accessory sway, a blink on one frame |
| `isekai_kun_run` | 24×24 | 6 | feet | Isekai-kun, beige overpowered protagonist: flat volume-less beige-brown hair, small neutral brown eyes, beige hoodie, grey adventurer cape, sword on his back, a tiny blue status-window icon floating by his head - run cycle, bouncy, accessories trail behind |
| `isekai_kun_hurt` | 24×24 | 1 | feet | Isekai-kun, beige overpowered protagonist: flat volume-less beige-brown hair, small neutral brown eyes, beige hoodie, grey adventurer cape, sword on his back, a tiny blue status-window icon floating by his head - hurt: eyes squeezed shut ('><'), recoiling |
| `isekai_kun_cast` | 24×24 | 2 | feet | Isekai-kun, beige overpowered protagonist: flat volume-less beige-brown hair, small neutral brown eyes, beige hoodie, grey adventurer cape, sword on his back, a tiny blue status-window icon floating by his head - power pose for the ultimate |
| `truck_kun_idle` | 32×24 | 4 | feet | Truck-kun, the isekai truck (side view, facing right, 32x24): boxy white cab-over delivery truck with a blue racing stripe, anime eyes painted in the windshield, blush sticker, yellow headlights, grey bumper, black wheels, pink winged-heart logo on the cargo box - idle loop: breathing bob, hair/accessory sway, a blink on one frame |
| `truck_kun_run` | 32×24 | 6 | feet | Truck-kun, the isekai truck (side view, facing right, 32x24): boxy white cab-over delivery truck with a blue racing stripe, anime eyes painted in the windshield, blush sticker, yellow headlights, grey bumper, black wheels, pink winged-heart logo on the cargo box - run cycle, bouncy, accessories trail behind |
| `truck_kun_hurt` | 32×24 | 1 | feet | Truck-kun, the isekai truck (side view, facing right, 32x24): boxy white cab-over delivery truck with a blue racing stripe, anime eyes painted in the windshield, blush sticker, yellow headlights, grey bumper, black wheels, pink winged-heart logo on the cargo box - hurt: eyes squeezed shut ('><'), recoiling |
| `truck_kun_cast` | 32×24 | 2 | feet | Truck-kun, the isekai truck (side view, facing right, 32x24): boxy white cab-over delivery truck with a blue racing stripe, anime eyes painted in the windshield, blush sticker, yellow headlights, grey bumper, black wheels, pink winged-heart logo on the cargo box - power pose for the ultimate |
| `portrait_senpai` | 64×64 | 2 | center | Senpai bust portrait, full shoujo: huge lashes, 4-point star eye shines, roses in the corners, screentone dots. f0 = looking AWAY off-camera, serene, wind in hair. f1 = finally looking at the camera, sparkling, gentle smile, rose offered to the viewer |
| `portrait_magical_girl_47` | 64×64 | 2 | center | Magical Girl #47 bust portrait: perfectly average face, heart clip, a 'HELLO my name is' sticker with an illegible scribble, '#47' badge. f0 = hopeful smile with a sweat drop. f1 = wand thrust up, ribbons swirling, mid-shout, one-eye wink |
| `portrait_isekai_kun` | 64×64 | 2 | center | Isekai-kun bust portrait, flatter shading than everyone else on purpose, hoodie strings. f0 = blank 'huh?' face with a tiny '?'. f1 = the SAME blank face plus one sparkle and a sweat drop, a glowing blue status window full of numbers behind him |
| `portrait_truck_kun` | 64×64 | 2 | center | Truck-kun front-on portrait filling the frame: windshield = huge anime eyes with lashes, grille = small smile, headlights = blushing cheeks. f0 = friendly closed-eye '^ ^' smile, sparkle on the mirror. f1 = blazing wide eyes, grille open like a shout, headlight beams, horn lines |
| `ult_status_window` | 64×40 | 1 | center | Isekai-kun ult: a translucent blue game status window (semi-transparent pal), white frame, rows of tiny white 'stat' pixel text and absurdly long digit rows |
| `truck_kun_trailer` | 24×20 | 2 | feet | Truck-kun C6 trailer: a white cargo trailer with the winged-heart logo and two wheels, facing right; f1 = wheels turned |

---

## `s2-stages-a` (32)

Candy Kingdom + Shoujo Academy: ground tile sheets (8 seamless variants each), scattered deco, a tall tree each, two destructible props each, all their enemies and enemy bullets. Layout and colour notes: `stages.md` §1-2; enemy notes: `enemies.md` §1-2.

| id | size | frames | pivot | art direction |
| --- | --- | --- | --- | --- |
| `tile_candy` | 16×16 | 8 | center | Candy Kingdom ground, 8 seamless variants: f0-3 strawberry frosting (soft pink, subtle piped swirls), f4 rainbow sprinkles, f5 chocolate drizzle, f6 sugar sparkle, f7 cookie-crumb path |
| `deco_gumdrop` | 8×8 | 4 | feet | Sugared gumdrops, 4 colour variants as frames (pink, lemon, mint, grape), shine pixel |
| `deco_candy_lolli` | 8×14 | 3 | feet | Small swirl lollipops stuck in the ground, 3 variants (pink, mint, lemon) |
| `deco_candy_cane` | 8×12 | 2 | feet | Red-and-white candy cane, 2 variants (hook left / right) |
| `deco_sugar_cube` | 10×8 | 2 | feet | Sugar-cube 'rocks' with sparkle, 2 variants |
| `deco_cupcake` | 8×10 | 2 | feet | Tiny cupcake with a cherry, faint pink glow; f1 = cherry glint |
| `deco_lollipop_tree` | 32×40 | 2 | feet | Lollipop tree: giant spiral lollipop canopy on a striped candy-cane trunk, sprinkle leaves; f1 = canopy swayed 1px |
| `prop_candy_jar` | 12×16 | 2 | feet | Destructible glass jar of sweets with a cork; f1 glint |
| `prop_pinata` | 16×16 | 2 | feet | Destructible star pinata hanging from a short post; f1 swing |
| `fx_sprinkle` | 4×4 | 4 | center | Ambient sprinkle: a 3-px white sprinkle in 4 rotations (tinted by code) |
| `en_gummy` | 16×16 | 4 | feet | Gummy Bear: chubby translucent pale-jelly bear (tinted by code), round ears, dot eyes + blush; f0-1 hop squash/stretch, f2 airborne, f3 'boing' wide squash |
| `en_candy_corn` | 16×16 | 4 | feet | Candy Corn Soldier: candy-corn cone body (yellow base, orange middle, white tip), stubby legs, toothpick spear, gumdrop helmet; f0-3 march |
| `en_donut` | 16×16 | 4 | feet | Donut Roller: pink-frosted donut on its edge with sprinkles, a face on the frosting, tiny feet; f0-1 waddle, f2-3 rolling (sprinkles rotated) |
| `en_marshmallow` | 24×24 | 4 | feet | Marshmallow Brute: big squishy marshmallow cylinder with tiny arms, sleepy eyes, ':3' mouth; f0-3 heavy squash-walk |
| `en_lollipop_mage` | 16×20 | 4 | feet | Lollipop Mage: small robed figure with a tall swirl-lollipop wizard hat and lollipop staff; f0-1 float, f2 cast (staff up, swirl glows), f3 heal pose (arms wide) |
| `eb_candy` | 8×8 | 2 | center | Enemy bullet: pink-white swirl candy, bright glowing core; pulse |
| `tile_academy` | 16×16 | 8 | center | Shoujo Academy ground, 8 seamless variants: f0-3 pale courtyard stone pavers with soft grout, f4 fallen sakura petals, f5 chalk heart doodle, f6 polish sparkle, f7 terracotta running track with a white lane line |
| `deco_petal_pile` | 8×8 | 4 | feet | Little piles / drifts of sakura petals, 4 variants |
| `deco_hedge` | 12×10 | 2 | feet | Trimmed school hedge, 2 variants |
| `deco_shoe_locker` | 12×16 | 2 | feet | Outdoor shoe locker with little doors (one has a pink letter sticking out), 2 variants |
| `deco_school_sign` | 8×12 | 2 | feet | Small sign on a post: f0 'NO RUNNING' pictogram, f1 an arrow |
| `deco_school_lamp` | 6×16 | 2 | feet | School lamp post with a warm glowing lamp; f1 = glow flicker |
| `deco_sakura_tree` | 32×40 | 2 | feet | Cherry blossom tree: fluffy pink canopy, dark curvy trunk, a few falling petals; f1 = canopy swayed 1px |
| `prop_school_desk` | 14×12 | 1 | feet | Destructible classic school desk with a carved heart |
| `prop_vending` | 12×20 | 2 | feet | Destructible pastel drink vending machine; f1 = light flicker |
| `en_hall_monitor` | 16×16 | 4 | feet | Hall Monitor: stern round student blob with a yellow armband, cap and whistle, slit disapproving eyes; f0-2 brisk walk, f3 whistle (cheeks puffed) |
| `en_love_letter` | 12×10 | 4 | feet | Love Letter: pink envelope with a heart seal flapping its flap like wings, tiny blush; f0-3 flap cycle |
| `en_tsundere_slime` | 16×16 | 4 | feet | Tsundere Slime: red-orange slime with tiny drill twin-tails, angry brows, eyes turned away; f0-1 hop, f2 airborne, f3 blushing flee (face full of blush, sweat drop) |
| `en_transfer_student` | 16×20 | 4 | feet | Transfer Student: tall-ish chibi student, long dark hair over one eye, fluttering scarf, suitcase; f0-1 walk, f2 teleport-out (sparkle dissolve), f3 teleport-in |
| `en_exam_paper` | 12×14 | 4 | feet | Exam Paper: a sheet with a red circled 'F-', dog-eared corner, angry pencil face; f0-3 flutter (sheet bends) |
| `en_council_ninja` | 16×16 | 4 | feet | Student Council Ninja: chibi ninja in navy school uniform, red council armband, face mask, ponytail; f0-1 crouch-run, f2 throw, f3 smoke (half dissolved) |
| `eb_shuriken` | 8×8 | 2 | center | Enemy bullet: 4-point navy-silver shuriken with a white core and bright rim (code spins it) |

---

## `s2-stages-b` (31)

Beach Episode + The Final Arc: same as group A. The Final Arc's sketch tiles/deco are deliberately UNFINISHED pencil art (the budget ran out). Notes: `stages.md` §3-4, `enemies.md` §3-4.

| id | size | frames | pivot | art direction |
| --- | --- | --- | --- | --- |
| `tile_beach` | 16×16 | 8 | center | Beach ground, 8 seamless variants: f0-3 warm sand with fine grain, f4 shells, f5 a starfish, f6 wet sand with a sheen line, f7 footprints / raked sand |
| `deco_shell` | 8×8 | 4 | feet | Seashells, 4 variants (scallop, spiral, conch, pink) |
| `deco_beach_grass` | 8×8 | 3 | feet | Dune grass tufts, 3 variants |
| `deco_sand_bucket` | 8×8 | 2 | feet | Toy sand bucket with spade, 2 colours |
| `deco_beach_rock` | 10×8 | 2 | feet | Smooth beach rocks with a barnacle, 2 variants |
| `deco_parasol` | 24×24 | 2 | feet | Striped beach parasol stuck in the sand (red/white, blue/white); f1 = fringe flutter |
| `deco_mini_sandcastle` | 12×10 | 1 | feet | Cute little decorative sandcastle with a flag |
| `deco_palm` | 32×40 | 2 | feet | Palm tree: curved trunk, big fronds, coconuts; f1 = fronds swayed |
| `prop_beachball` | 12×12 | 2 | feet | Destructible striped beach ball; f1 = squash bounce |
| `prop_cooler` | 14×12 | 1 | feet | Destructible blue-and-white cool box |
| `en_crab` | 16×16 | 4 | feet | Crab-kun: round red crab, shiny eye stalks, raised claws, ':3'; f0-1 sideways scuttle, f2 claws up (tell), f3 lunge |
| `en_seagull` | 16×16 | 4 | feet | Seagull: fat white gull, yellow beak, side-eye, wings wide (drawn high, it flies); f0-1 flap, f2 glide, f3 dive (wings tucked) |
| `en_jellyfish` | 16×16 | 4 | feet | Jellyfish: translucent lavender bell with pink spots and a sleepy face, 4 wavy tentacles; f0-2 pulse swim, f3 glow (bright aqua outline) |
| `en_watermelon` | 16×16 | 4 | feet | Watermelon: round striped green melon with a happy face and a sun hat; f0-1 waddle, f2-3 roll |
| `en_watermelon_half` | 12×10 | 2 | feet | Watermelon Half: red flesh with black seeds facing up, green rind, tiny angry face; f0-1 hop |
| `en_sandcastle` | 24×24 | 4 | feet | Sandcastle Golem: sandcastle with two towers as ears, a shell nose, a flag on top, stubby sand legs; f0-2 stomp walk (sand trickles), f3 collapsed sand pile |
| `en_tiny_shark` | 16×12 | 4 | feet | Tiny Shark: chubby baby shark, mostly head, big round eyes, three-tooth smile; f0-1 fin only with sand ripple, f2 surfacing, f3 chomp |
| `eb_seed` | 6×6 | 2 | center | Enemy bullet: black watermelon seed with a pink glow halo |
| `tile_finale` | 16×16 | 8 | center | Final Arc ground, 8 seamless variants: f0-3 dark violet storyboard paper with faint grid lines, f4 cracks leaking light, f5 a film-strip fragment, f6 star glints, f7 UNFINISHED pencil sketch on pale paper |
| `deco_film_reel` | 10×10 | 2 | feet | Film reel lying on the ground, 2 variants |
| `deco_sketch_bush` | 12×10 | 2 | feet | A bush drawn only as lavender pencil lines (uncoloured), 2 variants |
| `deco_storyboard` | 12×16 | 2 | feet | Storyboard panel on a little easel with stick-figure sketches, 2 variants |
| `deco_broken_pillar` | 12×32 | 2 | feet | Broken dramatic stone pillar (violet-grey), 2 variants |
| `deco_glitch_crystal` | 8×12 | 2 | feet | Glitch crystal (cyan/magenta RGB-split edges), faint glow; f1 = pixel shift |
| `deco_sketch_tree` | 32×40 | 2 | feet | Tree drawn as an unfinished pencil sketch (lavender lines, a few scribbled leaves, construction lines); f1 = sway |
| `prop_clapboard` | 14×14 | 1 | feet | Destructible film clapperboard reading 'TAKE 47' |
| `prop_crt_tv` | 14×14 | 2 | feet | Destructible old CRT TV: f0 colour bars, f1 static |
| `en_filler_goon` | 16×16 | 4 | feet | Filler Episode Goon: faceless grey-lavender henchman in a plain jumpsuit, two dot eyes, deliberately low detail; f0-3 identical stiff walk (only legs move) |
| `en_plot_hole` | 24×24 | 4 | feet | Plot Hole: swirling black-violet vortex with white torn-paper edges and one confused eye in the middle; f0-3 swirl arms rotate |
| `en_animation_error` | 16×16 | 4 | feet | Animation Error: a cute character drawn badly on purpose (one big eye, limb on the wrong side, RGB-split edges, missing-texture checker patch); f0-3 random 1-px jitter |
| `en_mini_truck` | 24×16 | 4 | feet | Mini Truck-kun: tiny Truck-kun with angrier eyes and a red stripe; f0-1 drive (wheels), f2 headlights flash, f3 boost (exhaust flame) |

---

## `s2-bosses` (21)

The 9 new bosses (48-72 px, 6-8 frames) plus extra boss actors and every boss bullet. Phase-by-phase frame use: `enemies.md` §5.

| id | size | frames | pivot | art direction |
| --- | --- | --- | --- | --- |
| `boss_gingerbread` | 56×56 | 6 | feet | GINGERBREAD GOLEM: hulking gingerbread man with white icing outlines, 3 gumdrop buttons, icing-drawn angry face, candy-cane club; f0-1 stomp, f2 jump crouch, f3 slam, f4 half-baked (missing leg, crumbs), f5 roar |
| `boss_sugarplum` | 48×64 | 6 | feet | SUGAR PLUM TYRANT: regal ballerina-tyrant, plum tutu with sugar sparkle, cupcake crown, giant pink hair bun, lollipop scepter, floating; f0-1 float, f2 cast, f3 pirouette blur, f4 laugh, f5 sugar-crashed (slumped, sleepy) |
| `boss_president` | 48×56 | 6 | feet | STUDENT COUNCIL PRESIDENT: immaculate uniform, long straight navy hair, 'PRESIDENT' armband, glinting rectangular glasses, clipboard + giant rubber stamp; f0-1 idle (glint), f2 accusing point, f3 stamp slam, f4 blazer swish, f5 rage (cracked glasses) |
| `boss_bishounen` | 48×64 | 6 | feet | THE BISHOUNEN WHO NEVER NOTICES YOU: long white school coat, flowing silver-lavender hair, back turned in 3/4, roses and sparkles in the sprite, phone in hand; f0-1 hair sway, f2 hair flip, f3 phone glow, f4 wind pose, f5 FACING the camera (sparkling, rose offered) |
| `boss_kraken` | 72×56 | 6 | feet | KRAKEN-CHAN: round chubby cartoon octopus (bath-toy proportions, never humanoid), pink-coral with spots, huge sparkly eyes, blush, white sailor hat, 6 stubby tentacles; f0-1 bob, f2 ink cannon (cheeks puffed), f3 half submerged, f4 rise splash, f5 blush |
| `boss_kraken_tentacle` | 16×48 | 4 | feet | Kraken-chan tentacle rising from the sand (suckers, pink-coral); f0 tip emerging, f1 fully up, f2 slam, f3 sinking |
| `boss_firework_dragon` | 72×48 | 6 | feet | SUMMER FESTIVAL FIREWORK DRAGON head: red-and-gold paper festival-lantern dragon, googly lantern eyes, firework-fuse whiskers, sparks; f0-1 slither, f2 inhale, f3 breathe sparks, f4 burst pose, f5 coil |
| `boss_firework_body` | 16×16 | 2 | center | Firework Dragon body segment: round red paper lantern with gold ribs and a sparkler; f1 sway |
| `boss_truck` | 72×48 | 6 | feet | TRUCK-KUN (boss): menacing big truck, grimy white, red stripe, glaring headlight eyes with heavy brows, toothy grille, dents, 'REINCARNATION SERVICES' box; f0-1 rumble, f2 headlights flash, f3 charge (tilted), f4 drift (tyre smoke), f5 reverse (reverse light) |
| `boss_truck_moustache` | 12×4 | 1 | center | Evil alternate-universe Truck-kun moustache overlay (dark curly moustache, drawn under the grille) |
| `boss_rival` | 48×56 | 6 | feet | RIVAL-CHAN: spiky short red-black hair, headband with long tails, cheek plaster, training gi with a star patch, taped fists, smug grin; f0-1 idle bounce, f2 dash (low), f3 beam cast, f4 frustrated, f5 power-up aura |
| `boss_cancel` | 64×72 | 8 | feet | CANCEL-SAMA the Network Executive: giant dark suit, red tie, old CRT TV for a head (screen shows his face), huge red 'CANCEL' rubber stamp; f0-1 idle, f2 stamp raised, f3 stamp slam, f4 phone call, f5 laugh ('LOL' screen), f6 glitched (static, RGB split), f7 defeated ('RENEWED' screen, tiny smile) |
| `eb_gumdrop` | 10×10 | 2 | center | Boss bullet: sugared gumdrop with hot-pink glow, white core; pulse |
| `eb_plum` | 10×10 | 2 | center | Boss bullet: plum-purple sugar-crystal orb, white core; pulse |
| `eb_stamp` | 12×12 | 2 | center | Boss bullet: red 'DENIED' stamp mark with a glowing rim |
| `eb_rose` | 10×10 | 2 | center | Boss bullet: red rose head with a sparkle core |
| `eb_ink` | 10×10 | 2 | center | Boss bullet: violet ink blob with an aqua glow ring |
| `eb_firework` | 10×10 | 2 | center | Boss bullet: firework star spark, white core (tinted by code) |
| `eb_cone` | 10×10 | 2 | center | Boss bullet / hazard: orange traffic cone with a white stripe, glowing outline |
| `eb_rival` | 10×10 | 2 | center | Boss bullet: red-orange energy star, white core |
| `eb_memo` | 12×12 | 2 | center | Boss bullet: folded memo sheet with a red X, bright outline |

---

## `s2-items` (165)

Projectiles / fx for the 12 new weapons and 12 evolutions, pop-text sprites, all new 16×16 icons (12 weapons, 12 evolutions, 8 passives, 61 relics, 15 Plot Twists, 5 UI), and hub/gacha/board UI art. Weapon notes: `weapons.md`; relic icons: `relics.md`; gacha storyboard: `gacha.md` §2.

| id | size | frames | pivot | art direction |
| --- | --- | --- | --- | --- |
| `w_salamander` | 12×12 | 4 | center | Dark Flame Dragon familiar: tiny chubby orange salamander with stubby wings, hovering; 4-frame flap |
| `w_dragon_fire` | 8×8 | 4 | center | Dark Flame Dragon breath puff: ORANGE flame with a 1-px violet outline (Kuro drew it on); play-once grow -> peak -> wisps |
| `w_abyss_dragon` | 24×24 | 4 | center | Unsealed Abyss Dragon: the salamander grown up (still chubby), black-violet with glowing magenta eyes and bigger wings; flap |
| `w_abyss_fire` | 10×10 | 4 | center | Abyss flame puff: actually-black-violet flame with a magenta core; play-once |
| `w_teacup` | 10×10 | 2 | center | Teapot Tempest teacup with saucer (white, pink rim, amber tea); f0 upright, f1 tipping/spilling |
| `w_tea_puddle` | 24×14 | 3 | center | Tea puddle ground decal (amber, glossy rim); f0 splash, f1 resting, f2 drying |
| `w_teapot_big` | 24×20 | 2 | center | Eternal Tea Party flying teapot (white porcelain, pink flowers); f0 hover, f1 pouring |
| `w_tea_drop` | 6×6 | 2 | center | Hot tea droplet projectile (amber, steam pixel) |
| `w_petit_four` | 8×8 | 1 | center | Petit four heal pickup (tiny pink iced cake with a cherry) |
| `w_missile` | 8×6 | 2 | center | Micro missile (white body, blue fins, faces right); f1 exhaust flicker |
| `w_missile_evo` | 10×8 | 2 | center | Al Dente missile with a red meatball tip; f1 exhaust flicker |
| `w_sauce` | 12×8 | 2 | center | Tomato sauce splat ground decal; f1 bubbling |
| `w_harisen` | 32×24 | 4 | center | Baka Harisen smack: white folded-paper fan swinging in an arc that opens RIGHT with speed lines; f0 appear, f1 full, f2 fading, f3 wisps |
| `w_harisen_evo` | 48×48 | 4 | center | Dere Dere Harisen: heart-shaped pink paper fan whirling 360 degrees with tiny hearts; rotating frames |
| `w_ribbon` | 12×12 | 2 | center | Henshin ribbon projectile: pink-mint ribbon loop; f1 twist |
| `w_ribbon_evo` | 14×14 | 2 | center | Infinite Henshin Loop ribbon: gold ribbon loop with sparkle; f1 twist |
| `w_fireball` | 14×14 | 4 | center | Cheat Fireball: absurdly well-rendered round fireball (white core, yellow, orange, red rim), flicker loop, faces right |
| `w_meteor_cheat` | 24×32 | 2 | center | Meteor Lv.99999: falling flaming meteor, head at the bottom, fire tail going up; f1 flicker |
| `w_honk_wave` | 32×32 | 4 | center | HONK shockwave: 3 concentric yellow-white sound arcs opening RIGHT; play-once expand |
| `w_boba` | 8×8 | 2 | center | Boba pearl: glossy dark brown tapioca pearl with a white shine; f1 shine shifted |
| `w_boba_big` | 14×14 | 2 | center | Giant boba pearl (Tapioca Tsunami) with a big shine and a drip; f1 shine shifted |
| `w_crane` | 12×10 | 4 | center | Paper crane: white origami crane, faces right; 4-frame flap |
| `w_crane_gold` | 12×10 | 4 | center | Golden paper crane (Thousand Crane Wish) with sparkle; 4-frame flap |
| `w_lightstick_wave` | 32×16 | 4 | center | Idol lightstick wave: a crescent of light opening RIGHT; frames cycle pink -> cyan -> yellow -> violet |
| `w_lightstick` | 6×14 | 2 | center | Crowd lightstick (white, tinted by code) held by a tiny hand; f1 tilted (waving) |
| `w_kotatsu` | 32×24 | 4 | feet | Kotatsu: low table with a big fluffy quilt; f0 folded quilt bundle, f1-2 deployed with steam wobble, f3 Too Comfy (heater glowing orange under the quilt) |
| `w_kotatsu_evo` | 40×28 | 4 | feet | Eternal Winter Break kotatsu: bigger, plushier quilt with a bowl of mikan on top; f0-2 cosy steam loop, f3 Too Comfy glow |
| `w_mikan` | 8×8 | 2 | center | Mikan (mandarin orange) projectile with a leaf; f1 rotated |
| `fx_baka` | 24×10 | 2 | center | Pop text: f0 hand-lettered red 'BAKA!' with a white outline and an anger mark; f1 small pink '...baka' with a heart |
| `fx_nani` | 28×12 | 2 | center | Pop text: chunky red-and-white 'NANI?!' with shock lines; f1 shaken 1px |
| `fx_honk` | 24×10 | 2 | center | Pop text: yellow 'HONK' lettering with sound lines; f1 shaken |
| `fx_charm_heart` | 8×7 | 2 | center | Charmed heart over an enemy's head (pink, white shine); f0 beat, f1 cracked (heartbroken) |
| `fx_rose_big` | 16×16 | 2 | center | Shoujo rose bloom with sparkles (red/pink); f1 rotated petals |
| `fx_henshin` | 32×32 | 6 | center | Henshin transformation burst: ribbons spiralling in, a star flash, ribbons flying out; play-once |
| `fx_crater` | 24×12 | 3 | center | Overdone fireball crater decal: f0 fresh glowing orange, f1 embers, f2 dark scorch |
| `fx_light_pillar` | 16×48 | 4 | feet | Isekai light pillar: a column of soft white-gold light with sparkles rising from the ground; play-once rise and fade |
| `fx_zzz` | 8×8 | 3 | center | Sleepy 'Z' letters (lavender), 3 sizes as frames |
| `fx_glitch` | 8×8 | 4 | center | Glitch mote: RGB-split pixel blocks (pink/cyan/lime/white), 4 random arrangements |
| `icon_dark_flame_dragon` | 16×16 | 1 | center | Weapon: Dark Flame Dragon - the tiny salamander breathing an orange flame with a violet outline |
| `icon_teapot_tempest` | 16×16 | 1 | center | Weapon: Teapot Tempest - a teacup and saucer with a swirl of tea |
| `icon_micro_missile_swarm` | 16×16 | 1 | center | Weapon: Micro Missile Swarm - three tiny missiles with tangled spaghetti trails |
| `icon_baka_harisen` | 16×16 | 1 | center | Weapon: Baka Harisen - a white paper fan with an anger mark |
| `icon_notice_me_sparkles` | 16×16 | 1 | center | Weapon: Notice-Me Sparkles - a pink heart surrounded by sparkles |
| `icon_henshin_burst` | 16×16 | 1 | center | Weapon: Henshin Burst - a mint heart wand with ribbons |
| `icon_cheat_fireball` | 16×16 | 1 | center | Weapon: Cheat Fireball - a fireball with a tiny 'Lv.9999' tag |
| `icon_horn_of_reincarnation` | 16×16 | 1 | center | Weapon: Horn of Reincarnation - a yellow truck horn with sound lines |
| `icon_bubble_tea_cannon` | 16×16 | 1 | center | Weapon: Bubble Tea Cannon - a bubble tea cup with a fat straw and boba |
| `icon_paper_crane_flock` | 16×16 | 1 | center | Weapon: Paper Crane Flock - two white origami cranes |
| `icon_idol_lightstick_wave` | 16×16 | 1 | center | Weapon: Idol Lightstick Wave - a glowing pink lightstick with a music note |
| `icon_kotatsu_of_sloth` | 16×16 | 1 | center | Weapon: Kotatsu of Sloth - a kotatsu with a mikan on top and Zzz |
| `icon_unsealed_abyss_dragon` | 16×16 | 1 | center | Evolution: Unsealed Abyss Dragon - black-violet dragon head with magenta eyes, ornate frame |
| `icon_eternal_tea_party` | 16×16 | 1 | center | Evolution: Eternal Tea Party - a flying teapot pouring, golden sparkles |
| `icon_al_dente_armageddon` | 16×16 | 1 | center | Evolution: Al Dente Armageddon - a missile wrapped in spaghetti with a meatball |
| `icon_dere_dere_harisen` | 16×16 | 1 | center | Evolution: Dere Dere Harisen - a pink heart-shaped paper fan |
| `icon_shoujo_filter` | 16×16 | 1 | center | Evolution: Shoujo Filter - a rose with screentone dots and sparkles |
| `icon_infinite_henshin_loop` | 16×16 | 1 | center | Evolution: Infinite Henshin Loop - a gold ribbon in an infinity loop |
| `icon_cheat_meteor` | 16×16 | 1 | center | Evolution: Meteor Lv.99999 - a falling meteor with an absurd number tag |
| `icon_isekai_rush_hour` | 16×16 | 1 | center | Evolution: Isekai Rush Hour - a ghostly truck with speed lines |
| `icon_tapioca_tsunami` | 16×16 | 1 | center | Evolution: Tapioca Tsunami - a giant boba pearl riding a wave of tea |
| `icon_thousand_crane_wish` | 16×16 | 1 | center | Evolution: Thousand Crane Wish - a golden crane with a star |
| `icon_sold_out_dome_tour` | 16×16 | 1 | center | Evolution: Sold-Out Dome Tour - a dome stage with spotlights |
| `icon_eternal_winter_break` | 16×16 | 1 | center | Evolution: Eternal Winter Break - a kotatsu with a snowflake and a mikan bowl |
| `icon_plot_armor` | 16×16 | 1 | center | Passive: Plot Armor - a gold shield made of a rolled-up script with a red bookmark and a star |
| `icon_main_character_aura` | 16×16 | 1 | center | Passive: Main Character Aura - a radiant sunburst ring with sparkles |
| `icon_bento_box` | 16×16 | 1 | center | Passive: Bento Box - a pink bento box with onigiri and an octopus sausage |
| `icon_speed_lines` | 16×16 | 1 | center | Passive: Speed Lines - three white motion streaks behind a tiny star |
| `icon_inner_monologue` | 16×16 | 1 | center | Passive: Inner Monologue - a thought bubble with '...' and a sweat drop |
| `icon_training_montage` | 16×16 | 1 | center | Passive: Training Montage - a red headband wrapped around a dumbbell |
| `icon_friendship_bracelet` | 16×16 | 1 | center | Passive: Friendship Bracelet - a woven pastel bracelet with a heart bead and a star bead |
| `icon_chibi_charm` | 16×16 | 1 | center | Passive: Chibi Charm - a tiny chibi keychain charm on a pink ring |
| `icon_relic_bent_spoon` | 16×16 | 1 | center | Relic N: a silver spoon bent 30 degrees, one sparkle |
| `icon_relic_knockoff_keychain` | 16×16 | 1 | center | Relic N: a lopsided pink bear keychain with mismatched eyes |
| `icon_relic_sticker_sheet` | 16×16 | 1 | center | Relic N: a sticker sheet with half the star stickers missing |
| `icon_relic_expired_energy_drink` | 16×16 | 1 | center | Relic N: an energy drink can with a lightning bolt and an 'EXP' stamp |
| `icon_relic_empty_capsule` | 16×16 | 1 | center | Relic N: a two-tone gacha capsule, open and empty, one sad sparkle |
| `icon_relic_wiki_printout` | 16×16 | 1 | center | Relic N: a printed page with highlighter streaks |
| `icon_relic_convention_lanyard` | 16×16 | 1 | center | Relic N: a lanyard with a 'STAFF?' badge |
| `icon_relic_used_bandage` | 16×16 | 1 | center | Relic N: a pink cartoon bandage with a heart |
| `icon_relic_offbrand_watch` | 16×16 | 1 | center | Relic N: a chunky digital watch reading 88:88 |
| `icon_relic_region_locked_dvd` | 16×16 | 1 | center | Relic N: a DVD case with a big region-lock symbol |
| `icon_relic_chocolate_coin` | 16×16 | 1 | center | Relic N: a gold-foil chocolate coin with one bite missing |
| `icon_relic_traffic_cone` | 16×16 | 1 | center | Relic N: an orange traffic cone, white stripe, a tyre mark |
| `icon_relic_acrylic_stand` | 16×16 | 1 | center | Relic R: a clear acrylic stand of a chibi hero with a rainbow edge |
| `icon_relic_smudged_poster` | 16×16 | 1 | center | Relic R: a rolled poster with a smudged signature scrawl |
| `icon_relic_pencil_case` | 16×16 | 1 | center | Relic R: a pastel pencil case with a cat-face zip |
| `icon_relic_pocket_tissues` | 16×16 | 1 | center | Relic R: a pocket tissue pack with a crying face |
| `icon_relic_phone_strap` | 16×16 | 1 | center | Relic R: a glowing star phone strap |
| `icon_relic_rubber_duck` | 16×16 | 1 | center | Relic R: a yellow rubber duck in a captain's hat |
| `icon_relic_cat_ear_headband` | 16×16 | 1 | center | Relic R: a pink headband with cat ears |
| `icon_relic_mismatched_chopsticks` | 16×16 | 1 | center | Relic R: one red and one blue chopstick, crossed |
| `icon_relic_hype_towel` | 16×16 | 1 | center | Relic R: a towel printed 'SSS', waving |
| `icon_relic_fan_club_card` | 16×16 | 1 | center | Relic R: a pink membership card with a holographic heart |
| `icon_relic_instant_ramen` | 16×16 | 1 | center | Relic R: a cup noodle with chopsticks and steam |
| `icon_relic_battle_playlist` | 16×16 | 1 | center | Relic R: a cassette tape with a skull sticker |
| `icon_relic_sparkly_hair_clip` | 16×16 | 1 | center | Relic R: a star hair clip with a sparkle |
| `icon_relic_lucky_cat` | 16×16 | 1 | center | Relic R: a white beckoning cat raising a paw, holding a gold coin |
| `icon_relic_rival_plushie` | 16×16 | 1 | center | Relic SR: a grumpy plush with a headband |
| `icon_relic_oversized_sword_keychain` | 16×16 | 1 | center | Relic SR: a keychain sword far bigger than its ring |
| `icon_relic_light_novel_vol1` | 16×16 | 1 | center | Relic SR: a thick paperback with a very long title in tiny text |
| `icon_relic_theme_song_cd` | 16×16 | 1 | center | Relic SR: a CD single with a sparkly star cover |
| `icon_relic_cosplay_wig` | 16×16 | 1 | center | Relic SR: a bright blue wig on a stand |
| `icon_relic_festival_goldfish` | 16×16 | 1 | center | Relic SR: a goldfish in a knotted water bag |
| `icon_relic_mascot_head` | 16×16 | 1 | center | Relic SR: a big round mascot costume head with a dopey smile |
| `icon_relic_pity_keychain` | 16×16 | 1 | center | Relic SR: a keychain with a tiny counter showing 89 |
| `icon_relic_shonen_headband` | 16×16 | 1 | center | Relic SR: a white headband with a red flame emblem |
| `icon_relic_compact_mirror` | 16×16 | 1 | center | Relic SR: a pink heart-shaped compact mirror, open, sparkling |
| `icon_relic_mecha_model_kit` | 16×16 | 1 | center | Relic SR: a plastic model-kit sprue with one empty slot |
| `icon_relic_magnifying_glass` | 16×16 | 1 | center | Relic SR: a magnifying glass over a '?' |
| `icon_relic_protagonist_scarf` | 16×16 | 1 | center | Relic SSR: a long red scarf flowing dramatically |
| `icon_relic_transformation_brooch` | 16×16 | 1 | center | Relic SSR: a winged heart brooch |
| `icon_relic_abandoned_headband` | 16×16 | 1 | center | Relic SSR: a frayed headband with a scorch mark |
| `icon_relic_sakura_snow_globe` | 16×16 | 1 | center | Relic SSR: a snow globe with a tiny sakura tree |
| `icon_relic_season_finale_manga` | 16×16 | 1 | center | Relic SSR: a manga volume with a 'FINAL' ribbon |
| `icon_relic_wind_machine` | 16×16 | 1 | center | Relic SSR: a little electric fan with speed lines and a billowing cape |
| `icon_relic_sentai_badge` | 16×16 | 1 | center | Relic SSR: a star badge with five coloured points |
| `icon_relic_isekai_status_card` | 16×16 | 1 | center | Relic SSR: a translucent blue card full of number pixels |
| `icon_relic_screentone_sheet` | 16×16 | 1 | center | Relic SSR: a dotted screentone sheet with a star cut out |
| `icon_relic_red_string_of_fate` | 16×16 | 1 | center | Relic SSR: a red thread tied in a bow around a pinky finger |
| `icon_relic_unopened_figure` | 16×16 | 1 | center | Relic UR: a figure in a sealed box with a 'MINT' sticker |
| `icon_relic_directors_cut` | 16×16 | 1 | center | Relic UR: a Blu-ray case with a director's chair |
| `icon_relic_time_skip_clock` | 16×16 | 1 | center | Relic UR: a clock with an arrow jumping forward |
| `icon_relic_hot_blooded_bandana` | 16×16 | 1 | center | Relic UR: a red bandana on fire |
| `icon_relic_golden_ticket` | 16×16 | 1 | center | Relic UR: a shining golden ticket with a star |
| `icon_relic_sacred_plot_device` | 16×16 | 1 | center | Relic UR: a glowing golden orb with a '?' inside |
| `icon_relic_original_manuscript` | 16×16 | 1 | center | Relic LR: a thick stack of handwritten pages with coffee rings |
| `icon_relic_revival_theme` | 16×16 | 1 | center | Relic LR: a music note on fire |
| `icon_relic_last_budget` | 16×16 | 1 | center | Relic LR: a single gold coin on a velvet cushion |
| `icon_relic_sakuga_cel` | 16×16 | 1 | center | Relic LR: a transparent animation cel with a dynamic pose sketch |
| `icon_relic_infinite_credit_card` | 16×16 | 1 | center | Relic MYTHIC: a black-and-gold card with an infinity sign and glitch sparkles |
| `icon_relic_real_friend` | 16×16 | 1 | center | Relic MYTHIC: two hands making a heart, one sparkle |
| `icon_relic_final_episode_script` | 16×16 | 1 | center | Relic MYTHIC: a script stamped 'FINAL EP.' with a glowing bookmark |
| `icon_twist_budget_cuts` | 16×16 | 1 | center | Twist Budget Cuts: a cracked piggy bank |
| `icon_twist_filler_overload` | 16×16 | 1 | center | Twist Filler Overload: a stack of film reels |
| `icon_twist_rushed_production` | 16×16 | 1 | center | Twist Rushed Production: a clock with speed lines |
| `icon_twist_censored` | 16×16 | 1 | center | Twist Censored: a black bar over a heart |
| `icon_twist_cliffhanger` | 16×16 | 1 | center | Twist Cliffhanger: a tiny hero hanging from a cliff edge |
| `icon_twist_power_creep` | 16×16 | 1 | center | Twist Power Creep: a rising arrow over a crown |
| `icon_twist_spoilers` | 16×16 | 1 | center | Twist Spoilers: a speech bubble with a crossed-out '!' |
| `icon_twist_dub_version` | 16×16 | 1 | center | Twist Dub Version: a microphone with a '?' |
| `icon_twist_mid_season_break` | 16×16 | 1 | center | Twist Mid-Season Break: a calendar with a big X |
| `icon_twist_darker_and_edgier` | 16×16 | 1 | center | Twist Darker and Edgier: a cute plush wearing an eyepatch |
| `icon_twist_light_novel_title` | 16×16 | 1 | center | Twist Light Novel Title: an open book with a very long title |
| `icon_twist_shounen_rival` | 16×16 | 1 | center | Twist Shounen Rival: two clashing fists |
| `icon_twist_studio_change` | 16×16 | 1 | center | Twist Studio Change: a paint palette with a '?' |
| `icon_twist_sequel_hook` | 16×16 | 1 | center | Twist Sequel Hook: a 'TO BE CONTINUED' arrow |
| `icon_twist_simulcast_delay` | 16×16 | 1 | center | Twist Simulcast Delay: a buffering spinner |
| `icon_dreamgem` | 16×16 | 1 | center | Currency: Dream Gem - pink faceted crystal diamond with a white glint |
| `icon_copium` | 16×16 | 1 | center | Currency: Copium - a pastel pink/lavender pill capsule with a sparkle |
| `icon_trophy` | 16×16 | 1 | center | UI: Plot Point (achievement) - a small gold trophy with a star |
| `icon_codex_unknown` | 16×16 | 1 | center | UI: undiscovered codex entry - a plum silhouette blob with a white '?' |
| `icon_heat` | 16×16 | 1 | center | UI: Plot Twist heat - a pink-orange flame with a twisty swirl |
| `ui_coin_big` | 24×24 | 2 | center | Hub currency bar: big Star Coin (gold, star emboss); f1 shine sweep |
| `ui_gem_big` | 24×24 | 2 | center | Hub currency bar: big Dream Gem (pink crystal); f1 shine sweep |
| `ui_copium_big` | 24×24 | 2 | center | Hub currency bar: big Copium capsule; f1 shine sweep |
| `ui_gacha_capsule` | 32×32 | 6 | center | Gacha capsule: f0 blue, f1 purple, f2 gold, f3 rainbow, f4 glitch (RGB split), f5 cracked open with light leaking |
| `ui_gacha_meteor` | 24×48 | 5 | center | Gacha meteor falling (head at the bottom, long trail up): f0 blue, f1 purple, f2 gold, f3 rainbow, f4 glitch |
| `ui_summon_circle` | 64×64 | 4 | center | Summoning circle: pink/gold magic circle with stars and rune ticks; 4 rotation frames |
| `ui_rarity_badge` | 24×12 | 7 | center | Rarity badge with lettering: f0 N grey, f1 R blue, f2 SR violet, f3 SSR gold, f4 UR rainbow, f5 LR crimson-gold, f6 MYTHIC glitch |
| `ui_card_corner` | 8×8 | 7 | center | Card corner ornament per rarity (N..MYTHIC as frames), mirrored by CSS into 4 corners |
| `ui_merch_machine` | 64×80 | 4 | center | The Merch Machine: pastel capsule machine, heart coin slot, crank, glowing capsules inside, 'NOT A SLOT MACHINE' sticker; f0-1 idle glow, f2 crank turning, f3 dispensing |
| `ui_mastered` | 20×20 | 1 | center | Gold 'MASTERED' frame drawn around a 16x16 weapon icon (transparent centre, tiny star on top) |
| `board_node` | 16×16 | 4 | center | Training Arc board node star: f0 locked (dim), f1 available, f2 affordable (bright, for pulse), f3 owned (gold) |
| `board_keystone` | 24×24 | 4 | center | Board keystone: big ornate star with a ribbon banner; f0 locked, f1 available, f2 affordable, f3 owned |
| `board_center` | 32×32 | 2 | center | Board centre 'Episode 1' node: clapperboard inside a star; f1 glow |
| `board_glyph` | 8×8 | 24 | center | Board node glyphs (white, tinted), frame order: 0 might, 1 max HP, 2 regen, 3 armor, 4 move, 5 cooldown, 6 area, 7 amount, 8 proj speed, 9 duration, 10 pickup, 11 crit, 12 crit dmg, 13 luck, 14 XP, 15 coins, 16 gem find, 17 dash cd, 18 curse, 19 reroll/banish/skip/cards, 20 slot, 21 revive, 22 dash charge, 23 overdrive/chest/elite |

