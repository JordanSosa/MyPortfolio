/**
 * Required sprite list. Game code references sprites ONLY by these ids.
 * `npm run sprites` validates that every entry exists with the right size and
 * frame count. Art owners may ADD extra sprites freely, but must not rename or
 * resize the ones listed here.
 *
 * Pivot conventions (ox, oy):
 *   'feet'   -> (w/2, h-1)  actors, bosses, props, deco, chest
 *   'center' -> (w/2, h/2)  projectiles, fx, pickups, icons, portraits, tiles
 * Everything faces RIGHT; code mirrors for left.
 */
export type Owner = "chars" | "world" | "engine";
export type Pivot = "feet" | "center";

export interface ManifestEntry {
  id: string;
  w: number;
  h: number;
  frames: number;
  pivot: Pivot;
  owner: Owner;
  desc: string;
}

const E = (
  id: string,
  w: number,
  h: number,
  frames: number,
  pivot: Pivot,
  owner: Owner,
  desc: string,
): ManifestEntry => ({ id, w, h, frames, pivot, owner, desc });

const hero = (n: string, look: string): ManifestEntry[] => [
  E(`${n}_idle`, 24, 24, 4, "feet", "chars", `${look} - idle loop: breathing bob, hair/ribbon sway, a blink on one frame`),
  E(`${n}_run`, 24, 24, 6, "feet", "chars", `${look} - run cycle, bouncy, hair & accessories trail behind`),
  E(`${n}_hurt`, 24, 24, 1, "feet", "chars", `${look} - hurt: eyes squeezed shut ('><'), recoiling`),
  E(`${n}_cast`, 24, 24, 2, "feet", "chars", `${look} - power pose for the ultimate (weapon raised, sparkle)`),
];

const icon = (id: string, desc: string): ManifestEntry => E(id, 16, 16, 1, "center", "world", desc);

export const MANIFEST: ManifestEntry[] = [
  // ---------------------------------------------------------------- heroes
  ...hero("hoshi", "Hoshi, star magician: long pink twin-tails with yellow star clips, big cyan eyes, white+pink magical-girl dress with a yellow bow, holds a star-tipped wand"),
  ...hero("rin", "Rin, shrine swordswoman: long black (purple-sheen) ponytail with a big red ribbon, red eyes, white haori top + red hakama, katana at the hip/in hand"),
  ...hero("mochi", "Mochi, neko-girl: short cream/blonde bob with cat ears (pink inner), golden cat eyes, oversized lavender hoodie with paw print, little tail, paw gloves"),
  E("portrait_hoshi", 64, 64, 2, "center", "chars", "Hoshi bust portrait, anime style. f0 = confident wink/smile, f1 = shouting ultimate face (mouth open, determined eyes, sparkles)"),
  E("portrait_rin", 64, 64, 2, "center", "chars", "Rin bust portrait. f0 = cool calm half-smile, f1 = fierce battle cry, eyes glinting"),
  E("portrait_mochi", 64, 64, 2, "center", "chars", "Mochi bust portrait. f0 = cat smile ':3', f1 = excited 'nya!' with fang and sparkly eyes"),

  // ---------------------------------------------------------------- enemies (all 4-frame loops unless noted)
  E("en_puff", 16, 16, 4, "feet", "chars", "Puff: round pastel-mint slime with a tiny leaf on top, dot eyes + blush; hop squash/stretch cycle"),
  E("en_batbun", 16, 16, 4, "feet", "chars", "Batbun: purple bunny-bat, floppy ears, little bat wings; flap cycle (body drawn high in the box, it floats)"),
  E("en_boo", 16, 16, 4, "feet", "chars", "Boo: white-lavender sheet ghost with a wavy tail, shy blush, tongue out; float wobble"),
  E("en_shroom", 16, 16, 4, "feet", "chars", "Shroomie: red-cap white-spot mushroom with stubby feet and a grumpy face; waddle walk"),
  E("en_teddy", 24, 24, 4, "feet", "chars", "Teddy Brute: chunky stitched brown teddy with one button eye and a heart patch; heavy stomp walk"),
  E("en_eyepuff", 16, 16, 4, "feet", "chars", "Eyepuff: floating pink fluffball with ONE huge anime eye (shooter); f0-1 float, f2 blink, f3 charge (eye glows)"),
  E("en_pumpkin", 16, 16, 4, "feet", "chars", "Pumpkin Dasher: jack-o-lantern head with a cute mischievous grin on tiny legs; f0-1 walk, f2-3 dash pose (leaning forward, angry eyes)"),
  E("en_wisp", 12, 12, 4, "feet", "chars", "Candle Wisp: tiny blue-violet flame spirit with a candle-wax body; flicker cycle (it rushes and explodes)"),
  E("en_spore", 10, 10, 2, "feet", "chars", "Spore: tiny baby mushroom (split from Shroomie on death); scuttle"),

  // ---------------------------------------------------------------- bosses
  E("boss_kingpuff", 48, 48, 4, "feet", "chars", "KING PUFF (3:00 boss): giant mint slime with a gold crown, regal moustache, cape; idle squish; f3 = squashed flat (landing)"),
  E("boss_teddy", 56, 56, 4, "feet", "chars", "NIGHTMARE TEDDY (6:00 boss): huge ragged purple teddy, glowing red stitched eyes, exposed cotton, giant claws; f0-1 stomp, f2 wind-up, f3 roar"),
  E("boss_lunatic", 48, 64, 4, "feet", "chars", "LADY LUNATIC (final boss): elegant moon witch, silver-lavender long hair, crescent moon halo, dark navy dress with stars, floating; f0-1 float, f2 cast (arms out), f3 laugh"),

  // ---------------------------------------------------------------- enemy bullets (glowing, readable!)
  E("eb_orb", 8, 8, 2, "center", "chars", "Enemy bullet: hot-pink glowing orb with white core; pulse"),
  E("eb_star", 10, 10, 2, "center", "chars", "Boss bullet: purple 4-point star with white core; pulse"),
  E("eb_moon", 12, 12, 2, "center", "chars", "Final boss bullet: pale yellow crescent with glow; pulse"),

  // ---------------------------------------------------------------- ultimate actors
  E("ult_cat", 16, 16, 4, "feet", "chars", "Stampede cat (Mochi ult): chubby running cat (randomly tinted by code, so draw it in light/white-cream fur), gallop cycle"),

  // ---------------------------------------------------------------- weapons / player projectiles
  E("w_star", 12, 12, 2, "center", "world", "Star Shot: chubby yellow 5-point star with a face-less shine; f1 slightly brighter"),
  E("w_star_evo", 16, 16, 2, "center", "world", "Galaxy Barrage star: pink-violet star with orbiting sparkle, more ornate"),
  E("w_slash", 48, 32, 4, "center", "world", "Petal Slash: crescent sword-arc swoosh (white core -> pink edge) with sakura petals, sweeping across 4 frames (appear, full, fading, wisps). Arc opens to the RIGHT"),
  E("w_tempest", 48, 48, 4, "center", "world", "Sakura Tempest: full 360 degree pink petal whirlwind ring, rotating frames"),
  E("w_yarn", 10, 10, 2, "center", "world", "Yarn Orbit ball: pink yarn ball with a loose thread end"),
  E("w_planet", 14, 14, 2, "center", "world", "Cosmic Yarn: tiny ringed planet (lavender + gold ring)"),
  E("w_heart", 12, 12, 1, "center", "world", "Heart Boomerang: glossy red heart with white shine (spun by code)"),
  E("w_heart_evo", 16, 16, 1, "center", "world", "Love Tornado: big magenta heart with wings"),
  E("w_bell", 12, 12, 2, "center", "world", "Thunder Bell: golden bell with a lightning-bolt emblem (marks where lightning strikes); f1 = swinging"),
  E("w_candy", 10, 10, 2, "center", "world", "Candy Bomb: wrapped round candy-bomb with a lit fuse spark"),
  E("w_candy_evo", 14, 14, 2, "center", "world", "Sugar Nuke: big swirl lollipop bomb"),
  E("w_bubble", 8, 8, 2, "center", "world", "Bubble: translucent cyan bubble with white shine (use semi-transparent pal entries '#rrggbbaa')"),
  E("w_beam_seg", 8, 12, 2, "center", "world", "Prism Beam body segment, tiles horizontally: bright white core, rainbow-ish cyan/pink edges"),
  E("w_beam_tip", 12, 12, 2, "center", "world", "Prism Beam impact tip: starburst flare"),
  E("ult_meteor", 16, 24, 2, "center", "world", "Supernova meteor (Hoshi ult): falling star head at bottom with a long sparkly tail going UP"),
  E("ult_petal", 8, 8, 2, "center", "world", "Big sakura petal for Rin's ult"),
  E("fx_explosion", 32, 32, 7, "center", "world", "Cute explosion: f0 white flash circle, f1-3 expanding orange/yellow fireball with sparkle stars, f4-6 dissipating lavender smoke puffs"),

  // ---------------------------------------------------------------- pickups
  E("gem_1", 7, 7, 2, "center", "world", "XP star-shard tier 1 (cyan crystal, 1xp); f1 = glint"),
  E("gem_2", 8, 8, 2, "center", "world", "XP shard tier 2 (pink crystal); f1 = glint"),
  E("gem_3", 10, 10, 2, "center", "world", "XP shard tier 3 (gold star crystal); f1 = glint"),
  E("gem_4", 12, 12, 4, "center", "world", "XP mega shard (rainbow prism, merged gems); 4-frame colour cycle"),
  E("coin", 8, 8, 4, "center", "world", "Star coin (gold with star emboss), 4-frame spin"),
  E("food_onigiri", 12, 12, 1, "center", "world", "Onigiri rice ball with nori and a cute face (heals)"),
  E("food_cake", 12, 12, 1, "center", "world", "Strawberry shortcake slice (big heal)"),
  E("pk_magnet", 12, 12, 2, "center", "world", "Magnet pickup: red/white horseshoe magnet with sparkle"),
  E("pk_bomb", 12, 12, 2, "center", "world", "Screen-clear bomb pickup: round navy bomb with pink heart and lit fuse"),
  E("pk_clock", 12, 12, 2, "center", "world", "Time-freeze pickup: cute alarm clock (cyan)"),
  E("chest", 18, 16, 3, "feet", "world", "Treasure chest: pink/gold kawaii chest with heart lock. f0 closed, f1 lid cracking (light leaking), f2 open"),

  // ---------------------------------------------------------------- world
  E("tile_ground", 16, 16, 8, "center", "world", "Dreamy meadow ground, 8 seamless variants used as frames: f0-3 plain grass (subtle texture), f4 tiny flowers, f5 clover, f6 sparkle grass, f7 worn path. All must tile seamlessly with each other"),
  E("deco_flower", 8, 8, 6, "feet", "world", "Decorative flowers, 6 variants as frames (daisy, tulip, star-flower, bluebell, pink puff, sunflower bud)"),
  E("deco_grass", 8, 8, 4, "feet", "world", "Grass tufts, 4 variants as frames"),
  E("deco_rock", 10, 8, 2, "feet", "world", "Small rounded pastel rocks, 2 variants"),
  E("deco_mush", 8, 8, 2, "feet", "world", "Tiny glowing mushrooms, 2 variants"),
  E("deco_crystal", 8, 12, 2, "feet", "world", "Dream crystal cluster (violet/cyan), 2 variants"),
  E("deco_tree", 32, 40, 2, "feet", "world", "Cotton-candy tree: fluffy pink/lavender canopy, curly trunk; f1 = canopy swayed 1px"),
  E("prop_lantern", 12, 20, 2, "feet", "world", "Destructible paper lantern on a short post (warm glow); f1 = flame flicker"),
  E("prop_gift", 14, 14, 1, "feet", "world", "Destructible gift box (mint box, pink ribbon)"),

  // ---------------------------------------------------------------- fx (pixel)
  E("fx_spark", 8, 8, 4, "center", "world", "4-point twinkle star: grow -> peak -> shrink -> dot. White core (tinted by code)"),
  E("fx_hit", 16, 16, 4, "center", "world", "Impact burst (white, tinted by code): star-shaped flash expanding and breaking into shards"),
  E("fx_puff", 16, 16, 6, "center", "world", "Dust/smoke puff: soft round lavender-white cloud expanding and fading"),
  E("fx_petal", 6, 6, 2, "center", "world", "Small sakura petal, 2 tumble frames"),
  E("fx_heart", 7, 6, 1, "center", "world", "Tiny heart (white, tinted by code)"),

  // ---------------------------------------------------------------- UI icons (16x16, used on level-up cards & HUD)
  icon("icon_star_shot", "Weapon: Star Shot"),
  icon("icon_petal_slash", "Weapon: Petal Slash"),
  icon("icon_yarn_orbit", "Weapon: Yarn Orbit"),
  icon("icon_heart_boomerang", "Weapon: Heart Boomerang"),
  icon("icon_thunder_bell", "Weapon: Thunder Bell"),
  icon("icon_candy_bomb", "Weapon: Candy Bomb"),
  icon("icon_bubble_aura", "Weapon: Bubble Aura"),
  icon("icon_prism_beam", "Weapon: Prism Beam"),
  icon("icon_galaxy_barrage", "Evolution: Galaxy Barrage (Star Shot + Wish Charm) - ornate, golden frame feel"),
  icon("icon_sakura_tempest", "Evolution: Sakura Tempest (Petal Slash + Big Ribbon)"),
  icon("icon_cosmic_yarn", "Evolution: Cosmic Yarn (Yarn Orbit + Magnet Star)"),
  icon("icon_love_tornado", "Evolution: Love Tornado (Heart Boomerang + Twin Charm)"),
  icon("icon_raijin_drum", "Evolution: Raijin Drum (Thunder Bell + Power Bow)"),
  icon("icon_sugar_nuke", "Evolution: Sugar Nuke (Candy Bomb + Lucky Clover)"),
  icon("icon_ocean_dome", "Evolution: Ocean Dome (Bubble Aura + Heart Locket)"),
  icon("icon_rainbow_cannon", "Evolution: Rainbow Cannon (Prism Beam + Swift Shoes)"),
  icon("icon_power_bow", "Passive: Power Bow (+damage) - a big red ribbon bow"),
  icon("icon_wish_charm", "Passive: Wish Charm (-cooldown) - star charm on a string"),
  icon("icon_big_ribbon", "Passive: Big Ribbon (+area) - giant flowing ribbon"),
  icon("icon_twin_charm", "Passive: Twin Charm (+projectiles) - two linked hearts"),
  icon("icon_swift_shoes", "Passive: Swift Shoes (+move speed) - winged sneakers"),
  icon("icon_magnet_star", "Passive: Magnet Star (+pickup range) - star with magnetic arcs"),
  icon("icon_lucky_clover", "Passive: Lucky Clover (+crit) - four-leaf clover"),
  icon("icon_heart_locket", "Passive: Heart Locket (+max HP, regen) - gold heart locket"),
  icon("icon_coin", "HUD: star coin"),
  icon("icon_skull", "HUD: kill counter - cute round skull with bow"),
  icon("icon_heart", "HUD: health heart"),
  icon("icon_gem", "HUD: xp shard"),
  icon("icon_reroll", "UI: reroll (two circular arrows with sparkle)"),
  icon("icon_chest", "UI: chest"),
  icon("icon_hp_up", "Pickup/upgrade fallback: heal (heart with plus)"),
  icon("icon_gold_up", "Pickup/upgrade fallback: bag of star coins"),

  // ---------------------------------------------------------------- procedural basics (src/art/sprites/basic.ts)
  E("fx_px", 2, 2, 1, "center", "engine", "2x2 white square (particles, lines, rects - scale & tint it)"),
  E("fx_glow", 32, 32, 1, "center", "engine", "Soft white radial glow (additive blend)"),
  E("fx_glow_s", 16, 16, 1, "center", "engine", "Small soft radial glow"),
  E("fx_shadow", 16, 6, 1, "center", "engine", "Ground shadow ellipse (dark plum, semi transparent)"),
  E("fx_ring", 32, 32, 1, "center", "engine", "1px white ring (shockwaves, scale it)"),
  E("fx_ring_thick", 32, 32, 1, "center", "engine", "3px white ring with soft inner edge"),
  E("fx_circle", 32, 32, 1, "center", "engine", "Filled white circle (aura disc, telegraphs)"),
  E("fx_streak", 16, 4, 1, "center", "engine", "Horizontal white streak, fades to transparent on the left (speed lines, trails)"),
];

/** Required fonts. */
export const FONT_MANIFEST = [
  {
    id: "font_main",
    h: 7,
    owner: "world" as Owner,
    desc: "Chunky rounded pixel font, glyph height 7 (outline added automatically). Needs: 0-9 A-Z a-z (lowercase may reuse caps shapes) ! ? + - x % . , : / ' * (draw * as a star) and space",
  },
];
