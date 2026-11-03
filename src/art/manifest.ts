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
export type Owner =
  | "chars"
  | "world"
  | "engine"
  // ---- Season 2 art groups (docs/content/art-manifest.md): one art agent per group
  | "s2-heroes-a"
  | "s2-heroes-b"
  | "s2-stages-a"
  | "s2-stages-b"
  | "s2-bosses"
  | "s2-items";
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

// ============================================================================ Season 2 helpers
// (docs/content/art-manifest.md is generated from the Season 2 section below)

/** Season 2 hero sprite set (idle 4 / run 6 / hurt 1 / cast 2), same contract as `hero()` plus owner and size. */
const heroS2 = (n: string, owner: Owner, look: string, w = 24, h = 24): ManifestEntry[] => [
  E(`${n}_idle`, w, h, 4, "feet", owner, `${look} - idle loop: breathing bob, hair/accessory sway, a blink on one frame`),
  E(`${n}_run`, w, h, 6, "feet", owner, `${look} - run cycle, bouncy, accessories trail behind`),
  E(`${n}_hurt`, w, h, 1, "feet", owner, `${look} - hurt: eyes squeezed shut ('><'), recoiling`),
  E(`${n}_cast`, w, h, 2, "feet", owner, `${look} - power pose for the ultimate`),
];

/** Season 2 16x16 icon (weapons, evolutions, passives, relics, twists, UI). */
const iconS2 = (id: string, desc: string): ManifestEntry => E(id, 16, 16, 1, "center", "s2-items", desc);

/** Relic icons: [relic id, art direction]. Every icon has a 1-px rarity glint pixel top-right (docs/content/relics.md). */
const S2_RELIC_ICONS: [string, string][] = [
  // N
  ["bent_spoon", "N: a silver spoon bent 30 degrees, one sparkle"],
  ["knockoff_keychain", "N: a lopsided pink bear keychain with mismatched eyes"],
  ["sticker_sheet", "N: a sticker sheet with half the star stickers missing"],
  ["expired_energy_drink", "N: an energy drink can with a lightning bolt and an 'EXP' stamp"],
  ["empty_capsule", "N: a two-tone gacha capsule, open and empty, one sad sparkle"],
  ["wiki_printout", "N: a printed page with highlighter streaks"],
  ["convention_lanyard", "N: a lanyard with a 'STAFF?' badge"],
  ["used_bandage", "N: a pink cartoon bandage with a heart"],
  ["offbrand_watch", "N: a chunky digital watch reading 88:88"],
  ["region_locked_dvd", "N: a DVD case with a big region-lock symbol"],
  ["chocolate_coin", "N: a gold-foil chocolate coin with one bite missing"],
  ["traffic_cone", "N: an orange traffic cone, white stripe, a tyre mark"],
  // R
  ["acrylic_stand", "R: a clear acrylic stand of a chibi hero with a rainbow edge"],
  ["smudged_poster", "R: a rolled poster with a smudged signature scrawl"],
  ["pencil_case", "R: a pastel pencil case with a cat-face zip"],
  ["pocket_tissues", "R: a pocket tissue pack with a crying face"],
  ["phone_strap", "R: a glowing star phone strap"],
  ["rubber_duck", "R: a yellow rubber duck in a captain's hat"],
  ["cat_ear_headband", "R: a pink headband with cat ears"],
  ["mismatched_chopsticks", "R: one red and one blue chopstick, crossed"],
  ["hype_towel", "R: a towel printed 'SSS', waving"],
  ["fan_club_card", "R: a pink membership card with a holographic heart"],
  ["instant_ramen", "R: a cup noodle with chopsticks and steam"],
  ["battle_playlist", "R: a cassette tape with a skull sticker"],
  ["sparkly_hair_clip", "R: a star hair clip with a sparkle"],
  ["lucky_cat", "R: a white beckoning cat raising a paw, holding a gold coin"],
  // SR
  ["rival_plushie", "SR: a grumpy plush with a headband"],
  ["oversized_sword_keychain", "SR: a keychain sword far bigger than its ring"],
  ["light_novel_vol1", "SR: a thick paperback with a very long title in tiny text"],
  ["theme_song_cd", "SR: a CD single with a sparkly star cover"],
  ["cosplay_wig", "SR: a bright blue wig on a stand"],
  ["festival_goldfish", "SR: a goldfish in a knotted water bag"],
  ["mascot_head", "SR: a big round mascot costume head with a dopey smile"],
  ["pity_keychain", "SR: a keychain with a tiny counter showing 89"],
  ["shonen_headband", "SR: a white headband with a red flame emblem"],
  ["compact_mirror", "SR: a pink heart-shaped compact mirror, open, sparkling"],
  ["mecha_model_kit", "SR: a plastic model-kit sprue with one empty slot"],
  ["magnifying_glass", "SR: a magnifying glass over a '?'"],
  // SSR
  ["protagonist_scarf", "SSR: a long red scarf flowing dramatically"],
  ["transformation_brooch", "SSR: a winged heart brooch"],
  ["abandoned_headband", "SSR: a frayed headband with a scorch mark"],
  ["sakura_snow_globe", "SSR: a snow globe with a tiny sakura tree"],
  ["season_finale_manga", "SSR: a manga volume with a 'FINAL' ribbon"],
  ["wind_machine", "SSR: a little electric fan with speed lines and a billowing cape"],
  ["sentai_badge", "SSR: a star badge with five coloured points"],
  ["isekai_status_card", "SSR: a translucent blue card full of number pixels"],
  ["screentone_sheet", "SSR: a dotted screentone sheet with a star cut out"],
  ["red_string_of_fate", "SSR: a red thread tied in a bow around a pinky finger"],
  // UR
  ["unopened_figure", "UR: a figure in a sealed box with a 'MINT' sticker"],
  ["directors_cut", "UR: a Blu-ray case with a director's chair"],
  ["time_skip_clock", "UR: a clock with an arrow jumping forward"],
  ["hot_blooded_bandana", "UR: a red bandana on fire"],
  ["golden_ticket", "UR: a shining golden ticket with a star"],
  ["sacred_plot_device", "UR: a glowing golden orb with a '?' inside"],
  // LR
  ["original_manuscript", "LR: a thick stack of handwritten pages with coffee rings"],
  ["revival_theme", "LR: a music note on fire"],
  ["last_budget", "LR: a single gold coin on a velvet cushion"],
  ["sakuga_cel", "LR: a transparent animation cel with a dynamic pose sketch"],
  // MYTHIC
  ["infinite_credit_card", "MYTHIC: a black-and-gold card with an infinity sign and glitch sparkles"],
  ["real_friend", "MYTHIC: two hands making a heart, one sparkle"],
  ["final_episode_script", "MYTHIC: a script stamped 'FINAL EP.' with a glowing bookmark"],
];

/** Plot Twist icons: [twist id, art direction] (docs/content/stages.md §6). */
const S2_TWIST_ICONS: [string, string][] = [
  ["budget_cuts", "Twist Budget Cuts: a cracked piggy bank"],
  ["filler_overload", "Twist Filler Overload: a stack of film reels"],
  ["rushed_production", "Twist Rushed Production: a clock with speed lines"],
  ["censored", "Twist Censored: a black bar over a heart"],
  ["cliffhanger", "Twist Cliffhanger: a tiny hero hanging from a cliff edge"],
  ["power_creep", "Twist Power Creep: a rising arrow over a crown"],
  ["spoilers", "Twist Spoilers: a speech bubble with a crossed-out '!'"],
  ["dub_version", "Twist Dub Version: a microphone with a '?'"],
  ["mid_season_break", "Twist Mid-Season Break: a calendar with a big X"],
  ["darker_and_edgier", "Twist Darker and Edgier: a cute plush wearing an eyepatch"],
  ["light_novel_title", "Twist Light Novel Title: an open book with a very long title"],
  ["shounen_rival", "Twist Shounen Rival: two clashing fists"],
  ["studio_change", "Twist Studio Change: a paint palette with a '?'"],
  ["sequel_hook", "Twist Sequel Hook: a 'TO BE CONTINUED' arrow"],
  ["simulcast_delay", "Twist Simulcast Delay: a buffering spinner"],
];

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

  // ==========================================================================================
  // ==================================== SEASON 2 ==========================================
  // ==========================================================================================
  // Content bible: docs/content/*.md (art direction per id: docs/content/art-manifest.md).
  // Owner groups split the art work between agents. Missing ids render as placeholders.

  // ---------------------------------------------------------------- s2-heroes-a (kuro, pudding, aoi, akane)
  ...heroS2("kuro", "s2-heroes-a", "Kuro, chuunibyou 'Lord of the Abyssal Flame': spiky black hair with one crimson streak, crimson visible eye, star-marked eyepatch on the near eye, high-collared tattered black cape (red lining), bandaged right arm with violet rune pixels, navy school jacket, tiny orange salamander on his shoulder"),
  ...heroS2("pudding", "s2-heroes-a", "Pudding, maid cafe ace: honey-blonde twin buns, tall white lace headdress, caramel eyes, black dress with white frilly apron (pink heart pocket), silver tray held level with a wobbling caramel pudding"),
  ...heroS2("aoi", "s2-heroes-a", "Aoi, chibi mech pilot: round white trash-can-shaped mech with blue panels, stubby legs, two chunky arm cannons, caution stripes; a glass dome on top with Aoi inside (blue bob, aviator goggles pushed up)"),
  ...heroS2("akane", "s2-heroes-a", "Akane, tsundere drill princess: two ENORMOUS red-orange spiral drill twin-tails as tall as her body, golden eyes, sharp brows, permanent blush, big red bow, white sailor top with navy collar and red tie, red skirt, white paper harisen fan"),
  E("portrait_kuro", 64, 64, 2, "center", "s2-heroes-a", "Kuro bust portrait (3/4 facing right): big crimson eye, star-drawn eyepatch, band-aid on the cheek, collar up to the nose, black-violet 'dark sparkles'. f0 = smug smirk, two fingers framing the eye. f1 = shouting, glowing bandaged fist forward, the salamander also shouting"),
  E("portrait_pudding", 64, 64, 2, "center", "s2-heroes-a", "Pudding bust portrait: honey buns + lace headdress, caramel eyes with heart-shaped highlights, frilly collar, 'PUDDING' name badge. f0 = closed-eye service smile, head tilted. f1 = hands making a heart at chin height, mouth open on 'KYUN', eyes shining"),
  E("portrait_aoi", 64, 64, 2, "center", "s2-heroes-a", "Aoi bust portrait in a blue/white pilot suit, goggles on forehead, plaster on the nose, wrench behind the ear. f0 = proud grin + thumbs up. f1 = battle cry, fist forward, goggles pulled down reflecting fire, speed lines"),
  E("portrait_akane", 64, 64, 2, "center", "s2-heroes-a", "Akane bust portrait: the drills frame and overflow the whole 64x64, golden eyes, pointed brows, 3-stroke blush. f0 = arms crossed, looking away, pout, a 'hmph' puff. f1 = harisen swinging at the viewer, mouth wide on 'BAKA', triangle eyes, full blush"),
  E("ult_flashlight", 12, 12, 1, "center", "s2-heroes-a", "Kuro ult reveal: a tiny yellow flashlight on its side pointing right with a short light cone"),
  E("ult_omurice", 48, 32, 2, "feet", "s2-heroes-a", "Pudding ult: a giant plate of omurice (golden omelette dome on rice, white plate). f0 plain, f1 with a red ketchup heart drawn on top + sparkles"),
  E("ult_robot_fist", 48, 48, 2, "center", "s2-heroes-a", "Aoi ult: a giant white-and-blue robot fist seen from above-front, rivets, caution stripes on the wrist. f0 open hand, f1 clenched fist (falls from the sky)"),

  // ---------------------------------------------------------------- s2-heroes-b (senpai, magical_girl_47, isekai_kun, truck_kun)
  ...heroS2("senpai", "s2-heroes-b", "Senpai, sparkly bishounen: tall for a chibi, long side-swept lavender-silver hair over one eye, violet eyes with long lashes, open white blazer with gold buttons, red rose in the breast pocket, 2-3 sparkle pixels built into every frame"),
  ...heroS2("magical_girl_47", "s2-heroes-b", "Magical Girl #47, aggressively generic: shoulder-length LIGHT BLUE hair with one pink heart clip, standard blue eyes, mint-and-white puffy dress, white boots, pink heart wand, a tiny gold badge on the chest; deliberately template-like and symmetrical"),
  ...heroS2("isekai_kun", "s2-heroes-b", "Isekai-kun, beige overpowered protagonist: flat volume-less beige-brown hair, small neutral brown eyes, beige hoodie, grey adventurer cape, sword on his back, a tiny blue status-window icon floating by his head"),
  ...heroS2("truck_kun", "s2-heroes-b", "Truck-kun, the isekai truck (side view, facing right, 32x24): boxy white cab-over delivery truck with a blue racing stripe, anime eyes painted in the windshield, blush sticker, yellow headlights, grey bumper, black wheels, pink winged-heart logo on the cargo box", 32, 24),
  E("portrait_senpai", 64, 64, 2, "center", "s2-heroes-b", "Senpai bust portrait, full shoujo: huge lashes, 4-point star eye shines, roses in the corners, screentone dots. f0 = looking AWAY off-camera, serene, wind in hair. f1 = finally looking at the camera, sparkling, gentle smile, rose offered to the viewer"),
  E("portrait_magical_girl_47", 64, 64, 2, "center", "s2-heroes-b", "Magical Girl #47 bust portrait: perfectly average face, heart clip, a 'HELLO my name is' sticker with an illegible scribble, '#47' badge. f0 = hopeful smile with a sweat drop. f1 = wand thrust up, ribbons swirling, mid-shout, one-eye wink"),
  E("portrait_isekai_kun", 64, 64, 2, "center", "s2-heroes-b", "Isekai-kun bust portrait, flatter shading than everyone else on purpose, hoodie strings. f0 = blank 'huh?' face with a tiny '?'. f1 = the SAME blank face plus one sparkle and a sweat drop, a glowing blue status window full of numbers behind him"),
  E("portrait_truck_kun", 64, 64, 2, "center", "s2-heroes-b", "Truck-kun front-on portrait filling the frame: windshield = huge anime eyes with lashes, grille = small smile, headlights = blushing cheeks. f0 = friendly closed-eye '^ ^' smile, sparkle on the mirror. f1 = blazing wide eyes, grille open like a shout, headlight beams, horn lines"),
  E("ult_status_window", 64, 40, 1, "center", "s2-heroes-b", "Isekai-kun ult: a translucent blue game status window (semi-transparent pal), white frame, rows of tiny white 'stat' pixel text and absurdly long digit rows"),
  E("truck_kun_trailer", 24, 20, 2, "feet", "s2-heroes-b", "Truck-kun C6 trailer: a white cargo trailer with the winged-heart logo and two wheels, facing right; f1 = wheels turned"),

  // ---------------------------------------------------------------- s2-stages-a: Candy Kingdom
  E("tile_candy", 16, 16, 8, "center", "s2-stages-a", "Candy Kingdom ground, 8 seamless variants: f0-3 strawberry frosting (soft pink, subtle piped swirls), f4 rainbow sprinkles, f5 chocolate drizzle, f6 sugar sparkle, f7 cookie-crumb path"),
  E("deco_gumdrop", 8, 8, 4, "feet", "s2-stages-a", "Sugared gumdrops, 4 colour variants as frames (pink, lemon, mint, grape), shine pixel"),
  E("deco_candy_lolli", 8, 14, 3, "feet", "s2-stages-a", "Small swirl lollipops stuck in the ground, 3 variants (pink, mint, lemon)"),
  E("deco_candy_cane", 8, 12, 2, "feet", "s2-stages-a", "Red-and-white candy cane, 2 variants (hook left / right)"),
  E("deco_sugar_cube", 10, 8, 2, "feet", "s2-stages-a", "Sugar-cube 'rocks' with sparkle, 2 variants"),
  E("deco_cupcake", 8, 10, 2, "feet", "s2-stages-a", "Tiny cupcake with a cherry, faint pink glow; f1 = cherry glint"),
  E("deco_lollipop_tree", 32, 40, 2, "feet", "s2-stages-a", "Lollipop tree: giant spiral lollipop canopy on a striped candy-cane trunk, sprinkle leaves; f1 = canopy swayed 1px"),
  E("prop_candy_jar", 12, 16, 2, "feet", "s2-stages-a", "Destructible glass jar of sweets with a cork; f1 glint"),
  E("prop_pinata", 16, 16, 2, "feet", "s2-stages-a", "Destructible star pinata hanging from a short post; f1 swing"),
  E("fx_sprinkle", 4, 4, 4, "center", "s2-stages-a", "Ambient sprinkle: a 3-px white sprinkle in 4 rotations (tinted by code)"),
  E("en_gummy", 16, 16, 4, "feet", "s2-stages-a", "Gummy Bear: chubby translucent pale-jelly bear (tinted by code), round ears, dot eyes + blush; f0-1 hop squash/stretch, f2 airborne, f3 'boing' wide squash"),
  E("en_candy_corn", 16, 16, 4, "feet", "s2-stages-a", "Candy Corn Soldier: candy-corn cone body (yellow base, orange middle, white tip), stubby legs, toothpick spear, gumdrop helmet; f0-3 march"),
  E("en_donut", 16, 16, 4, "feet", "s2-stages-a", "Donut Roller: pink-frosted donut on its edge with sprinkles, a face on the frosting, tiny feet; f0-1 waddle, f2-3 rolling (sprinkles rotated)"),
  E("en_marshmallow", 24, 24, 4, "feet", "s2-stages-a", "Marshmallow Brute: big squishy marshmallow cylinder with tiny arms, sleepy eyes, ':3' mouth; f0-3 heavy squash-walk"),
  E("en_lollipop_mage", 16, 20, 4, "feet", "s2-stages-a", "Lollipop Mage: small robed figure with a tall swirl-lollipop wizard hat and lollipop staff; f0-1 float, f2 cast (staff up, swirl glows), f3 heal pose (arms wide)"),
  E("eb_candy", 8, 8, 2, "center", "s2-stages-a", "Enemy bullet: pink-white swirl candy, bright glowing core; pulse"),

  // ---------------------------------------------------------------- s2-stages-a: Shoujo Academy
  E("tile_academy", 16, 16, 8, "center", "s2-stages-a", "Shoujo Academy ground, 8 seamless variants: f0-3 pale courtyard stone pavers with soft grout, f4 fallen sakura petals, f5 chalk heart doodle, f6 polish sparkle, f7 terracotta running track with a white lane line"),
  E("deco_petal_pile", 8, 8, 4, "feet", "s2-stages-a", "Little piles / drifts of sakura petals, 4 variants"),
  E("deco_hedge", 12, 10, 2, "feet", "s2-stages-a", "Trimmed school hedge, 2 variants"),
  E("deco_shoe_locker", 12, 16, 2, "feet", "s2-stages-a", "Outdoor shoe locker with little doors (one has a pink letter sticking out), 2 variants"),
  E("deco_school_sign", 8, 12, 2, "feet", "s2-stages-a", "Small sign on a post: f0 'NO RUNNING' pictogram, f1 an arrow"),
  E("deco_school_lamp", 6, 16, 2, "feet", "s2-stages-a", "School lamp post with a warm glowing lamp; f1 = glow flicker"),
  E("deco_sakura_tree", 32, 40, 2, "feet", "s2-stages-a", "Cherry blossom tree: fluffy pink canopy, dark curvy trunk, a few falling petals; f1 = canopy swayed 1px"),
  E("prop_school_desk", 14, 12, 1, "feet", "s2-stages-a", "Destructible classic school desk with a carved heart"),
  E("prop_vending", 12, 20, 2, "feet", "s2-stages-a", "Destructible pastel drink vending machine; f1 = light flicker"),
  E("en_hall_monitor", 16, 16, 4, "feet", "s2-stages-a", "Hall Monitor: stern round student blob with a yellow armband, cap and whistle, slit disapproving eyes; f0-2 brisk walk, f3 whistle (cheeks puffed)"),
  E("en_love_letter", 12, 10, 4, "feet", "s2-stages-a", "Love Letter: pink envelope with a heart seal flapping its flap like wings, tiny blush; f0-3 flap cycle"),
  E("en_tsundere_slime", 16, 16, 4, "feet", "s2-stages-a", "Tsundere Slime: red-orange slime with tiny drill twin-tails, angry brows, eyes turned away; f0-1 hop, f2 airborne, f3 blushing flee (face full of blush, sweat drop)"),
  E("en_transfer_student", 16, 20, 4, "feet", "s2-stages-a", "Transfer Student: tall-ish chibi student, long dark hair over one eye, fluttering scarf, suitcase; f0-1 walk, f2 teleport-out (sparkle dissolve), f3 teleport-in"),
  E("en_exam_paper", 12, 14, 4, "feet", "s2-stages-a", "Exam Paper: a sheet with a red circled 'F-', dog-eared corner, angry pencil face; f0-3 flutter (sheet bends)"),
  E("en_council_ninja", 16, 16, 4, "feet", "s2-stages-a", "Student Council Ninja: chibi ninja in navy school uniform, red council armband, face mask, ponytail; f0-1 crouch-run, f2 throw, f3 smoke (half dissolved)"),
  E("eb_shuriken", 8, 8, 2, "center", "s2-stages-a", "Enemy bullet: 4-point navy-silver shuriken with a white core and bright rim (code spins it)"),

  // ---------------------------------------------------------------- s2-stages-b: Beach Episode
  E("tile_beach", 16, 16, 8, "center", "s2-stages-b", "Beach ground, 8 seamless variants: f0-3 warm sand with fine grain, f4 shells, f5 a starfish, f6 wet sand with a sheen line, f7 footprints / raked sand"),
  E("deco_shell", 8, 8, 4, "feet", "s2-stages-b", "Seashells, 4 variants (scallop, spiral, conch, pink)"),
  E("deco_beach_grass", 8, 8, 3, "feet", "s2-stages-b", "Dune grass tufts, 3 variants"),
  E("deco_sand_bucket", 8, 8, 2, "feet", "s2-stages-b", "Toy sand bucket with spade, 2 colours"),
  E("deco_beach_rock", 10, 8, 2, "feet", "s2-stages-b", "Smooth beach rocks with a barnacle, 2 variants"),
  E("deco_parasol", 24, 24, 2, "feet", "s2-stages-b", "Striped beach parasol stuck in the sand (red/white, blue/white); f1 = fringe flutter"),
  E("deco_mini_sandcastle", 12, 10, 1, "feet", "s2-stages-b", "Cute little decorative sandcastle with a flag"),
  E("deco_palm", 32, 40, 2, "feet", "s2-stages-b", "Palm tree: curved trunk, big fronds, coconuts; f1 = fronds swayed"),
  E("prop_beachball", 12, 12, 2, "feet", "s2-stages-b", "Destructible striped beach ball; f1 = squash bounce"),
  E("prop_cooler", 14, 12, 1, "feet", "s2-stages-b", "Destructible blue-and-white cool box"),
  E("en_crab", 16, 16, 4, "feet", "s2-stages-b", "Crab-kun: round red crab, shiny eye stalks, raised claws, ':3'; f0-1 sideways scuttle, f2 claws up (tell), f3 lunge"),
  E("en_seagull", 16, 16, 4, "feet", "s2-stages-b", "Seagull: fat white gull, yellow beak, side-eye, wings wide (drawn high, it flies); f0-1 flap, f2 glide, f3 dive (wings tucked)"),
  E("en_jellyfish", 16, 16, 4, "feet", "s2-stages-b", "Jellyfish: translucent lavender bell with pink spots and a sleepy face, 4 wavy tentacles; f0-2 pulse swim, f3 glow (bright aqua outline)"),
  E("en_watermelon", 16, 16, 4, "feet", "s2-stages-b", "Watermelon: round striped green melon with a happy face and a sun hat; f0-1 waddle, f2-3 roll"),
  E("en_watermelon_half", 12, 10, 2, "feet", "s2-stages-b", "Watermelon Half: red flesh with black seeds facing up, green rind, tiny angry face; f0-1 hop"),
  E("en_sandcastle", 24, 24, 4, "feet", "s2-stages-b", "Sandcastle Golem: sandcastle with two towers as ears, a shell nose, a flag on top, stubby sand legs; f0-2 stomp walk (sand trickles), f3 collapsed sand pile"),
  E("en_tiny_shark", 16, 12, 4, "feet", "s2-stages-b", "Tiny Shark: chubby baby shark, mostly head, big round eyes, three-tooth smile; f0-1 fin only with sand ripple, f2 surfacing, f3 chomp"),
  E("eb_seed", 6, 6, 2, "center", "s2-stages-b", "Enemy bullet: black watermelon seed with a pink glow halo"),

  // ---------------------------------------------------------------- s2-stages-b: The Final Arc
  E("tile_finale", 16, 16, 8, "center", "s2-stages-b", "Final Arc ground, 8 seamless variants: f0-3 dark violet storyboard paper with faint grid lines, f4 cracks leaking light, f5 a film-strip fragment, f6 star glints, f7 UNFINISHED pencil sketch on pale paper"),
  E("deco_film_reel", 10, 10, 2, "feet", "s2-stages-b", "Film reel lying on the ground, 2 variants"),
  E("deco_sketch_bush", 12, 10, 2, "feet", "s2-stages-b", "A bush drawn only as lavender pencil lines (uncoloured), 2 variants"),
  E("deco_storyboard", 12, 16, 2, "feet", "s2-stages-b", "Storyboard panel on a little easel with stick-figure sketches, 2 variants"),
  E("deco_broken_pillar", 12, 32, 2, "feet", "s2-stages-b", "Broken dramatic stone pillar (violet-grey), 2 variants"),
  E("deco_glitch_crystal", 8, 12, 2, "feet", "s2-stages-b", "Glitch crystal (cyan/magenta RGB-split edges), faint glow; f1 = pixel shift"),
  E("deco_sketch_tree", 32, 40, 2, "feet", "s2-stages-b", "Tree drawn as an unfinished pencil sketch (lavender lines, a few scribbled leaves, construction lines); f1 = sway"),
  E("prop_clapboard", 14, 14, 1, "feet", "s2-stages-b", "Destructible film clapperboard reading 'TAKE 47'"),
  E("prop_crt_tv", 14, 14, 2, "feet", "s2-stages-b", "Destructible old CRT TV: f0 colour bars, f1 static"),
  E("en_filler_goon", 16, 16, 4, "feet", "s2-stages-b", "Filler Episode Goon: faceless grey-lavender henchman in a plain jumpsuit, two dot eyes, deliberately low detail; f0-3 identical stiff walk (only legs move)"),
  E("en_plot_hole", 24, 24, 4, "feet", "s2-stages-b", "Plot Hole: swirling black-violet vortex with white torn-paper edges and one confused eye in the middle; f0-3 swirl arms rotate"),
  E("en_animation_error", 16, 16, 4, "feet", "s2-stages-b", "Animation Error: a cute character drawn badly on purpose (one big eye, limb on the wrong side, RGB-split edges, missing-texture checker patch); f0-3 random 1-px jitter"),
  E("en_mini_truck", 24, 16, 4, "feet", "s2-stages-b", "Mini Truck-kun: tiny Truck-kun with angrier eyes and a red stripe; f0-1 drive (wheels), f2 headlights flash, f3 boost (exhaust flame)"),

  // ---------------------------------------------------------------- s2-bosses
  E("boss_gingerbread", 56, 56, 6, "feet", "s2-bosses", "GINGERBREAD GOLEM: hulking gingerbread man with white icing outlines, 3 gumdrop buttons, icing-drawn angry face, candy-cane club; f0-1 stomp, f2 jump crouch, f3 slam, f4 half-baked (missing leg, crumbs), f5 roar"),
  E("boss_sugarplum", 48, 64, 6, "feet", "s2-bosses", "SUGAR PLUM TYRANT: regal ballerina-tyrant, plum tutu with sugar sparkle, cupcake crown, giant pink hair bun, lollipop scepter, floating; f0-1 float, f2 cast, f3 pirouette blur, f4 laugh, f5 sugar-crashed (slumped, sleepy)"),
  E("boss_president", 48, 56, 6, "feet", "s2-bosses", "STUDENT COUNCIL PRESIDENT: immaculate uniform, long straight navy hair, 'PRESIDENT' armband, glinting rectangular glasses, clipboard + giant rubber stamp; f0-1 idle (glint), f2 accusing point, f3 stamp slam, f4 blazer swish, f5 rage (cracked glasses)"),
  E("boss_bishounen", 48, 64, 6, "feet", "s2-bosses", "THE BISHOUNEN WHO NEVER NOTICES YOU: long white school coat, flowing silver-lavender hair, back turned in 3/4, roses and sparkles in the sprite, phone in hand; f0-1 hair sway, f2 hair flip, f3 phone glow, f4 wind pose, f5 FACING the camera (sparkling, rose offered)"),
  E("boss_kraken", 72, 56, 6, "feet", "s2-bosses", "KRAKEN-CHAN: round chubby cartoon octopus (bath-toy proportions, never humanoid), pink-coral with spots, huge sparkly eyes, blush, white sailor hat, 6 stubby tentacles; f0-1 bob, f2 ink cannon (cheeks puffed), f3 half submerged, f4 rise splash, f5 blush"),
  E("boss_kraken_tentacle", 16, 48, 4, "feet", "s2-bosses", "Kraken-chan tentacle rising from the sand (suckers, pink-coral); f0 tip emerging, f1 fully up, f2 slam, f3 sinking"),
  E("boss_firework_dragon", 72, 48, 6, "feet", "s2-bosses", "SUMMER FESTIVAL FIREWORK DRAGON head: red-and-gold paper festival-lantern dragon, googly lantern eyes, firework-fuse whiskers, sparks; f0-1 slither, f2 inhale, f3 breathe sparks, f4 burst pose, f5 coil"),
  E("boss_firework_body", 16, 16, 2, "center", "s2-bosses", "Firework Dragon body segment: round red paper lantern with gold ribs and a sparkler; f1 sway"),
  E("boss_truck", 72, 48, 6, "feet", "s2-bosses", "TRUCK-KUN (boss): menacing big truck, grimy white, red stripe, glaring headlight eyes with heavy brows, toothy grille, dents, 'REINCARNATION SERVICES' box; f0-1 rumble, f2 headlights flash, f3 charge (tilted), f4 drift (tyre smoke), f5 reverse (reverse light)"),
  E("boss_truck_moustache", 12, 4, 1, "center", "s2-bosses", "Evil alternate-universe Truck-kun moustache overlay (dark curly moustache, drawn under the grille)"),
  E("boss_rival", 48, 56, 6, "feet", "s2-bosses", "RIVAL-CHAN: spiky short red-black hair, headband with long tails, cheek plaster, training gi with a star patch, taped fists, smug grin; f0-1 idle bounce, f2 dash (low), f3 beam cast, f4 frustrated, f5 power-up aura"),
  E("boss_cancel", 64, 72, 8, "feet", "s2-bosses", "CANCEL-SAMA the Network Executive: giant dark suit, red tie, old CRT TV for a head (screen shows his face), huge red 'CANCEL' rubber stamp; f0-1 idle, f2 stamp raised, f3 stamp slam, f4 phone call, f5 laugh ('LOL' screen), f6 glitched (static, RGB split), f7 defeated ('RENEWED' screen, tiny smile)"),
  E("eb_gumdrop", 10, 10, 2, "center", "s2-bosses", "Boss bullet: sugared gumdrop with hot-pink glow, white core; pulse"),
  E("eb_plum", 10, 10, 2, "center", "s2-bosses", "Boss bullet: plum-purple sugar-crystal orb, white core; pulse"),
  E("eb_stamp", 12, 12, 2, "center", "s2-bosses", "Boss bullet: red 'DENIED' stamp mark with a glowing rim"),
  E("eb_rose", 10, 10, 2, "center", "s2-bosses", "Boss bullet: red rose head with a sparkle core"),
  E("eb_ink", 10, 10, 2, "center", "s2-bosses", "Boss bullet: violet ink blob with an aqua glow ring"),
  E("eb_firework", 10, 10, 2, "center", "s2-bosses", "Boss bullet: firework star spark, white core (tinted by code)"),
  E("eb_cone", 10, 10, 2, "center", "s2-bosses", "Boss bullet / hazard: orange traffic cone with a white stripe, glowing outline"),
  E("eb_rival", 10, 10, 2, "center", "s2-bosses", "Boss bullet: red-orange energy star, white core"),
  E("eb_memo", 12, 12, 2, "center", "s2-bosses", "Boss bullet: folded memo sheet with a red X, bright outline"),

  // ---------------------------------------------------------------- s2-items: weapon projectiles / fx
  E("w_salamander", 12, 12, 4, "center", "s2-items", "Dark Flame Dragon familiar: tiny chubby orange salamander with stubby wings, hovering; 4-frame flap"),
  E("w_dragon_fire", 8, 8, 4, "center", "s2-items", "Dark Flame Dragon breath puff: ORANGE flame with a 1-px violet outline (Kuro drew it on); play-once grow -> peak -> wisps"),
  E("w_abyss_dragon", 24, 24, 4, "center", "s2-items", "Unsealed Abyss Dragon: the salamander grown up (still chubby), black-violet with glowing magenta eyes and bigger wings; flap"),
  E("w_abyss_fire", 10, 10, 4, "center", "s2-items", "Abyss flame puff: actually-black-violet flame with a magenta core; play-once"),
  E("w_teacup", 10, 10, 2, "center", "s2-items", "Teapot Tempest teacup with saucer (white, pink rim, amber tea); f0 upright, f1 tipping/spilling"),
  E("w_tea_puddle", 24, 14, 3, "center", "s2-items", "Tea puddle ground decal (amber, glossy rim); f0 splash, f1 resting, f2 drying"),
  E("w_teapot_big", 24, 20, 2, "center", "s2-items", "Eternal Tea Party flying teapot (white porcelain, pink flowers); f0 hover, f1 pouring"),
  E("w_tea_drop", 6, 6, 2, "center", "s2-items", "Hot tea droplet projectile (amber, steam pixel)"),
  E("w_petit_four", 8, 8, 1, "center", "s2-items", "Petit four heal pickup (tiny pink iced cake with a cherry)"),
  E("w_missile", 8, 6, 2, "center", "s2-items", "Micro missile (white body, blue fins, faces right); f1 exhaust flicker"),
  E("w_missile_evo", 10, 8, 2, "center", "s2-items", "Al Dente missile with a red meatball tip; f1 exhaust flicker"),
  E("w_sauce", 12, 8, 2, "center", "s2-items", "Tomato sauce splat ground decal; f1 bubbling"),
  E("w_harisen", 32, 24, 4, "center", "s2-items", "Baka Harisen smack: white folded-paper fan swinging in an arc that opens RIGHT with speed lines; f0 appear, f1 full, f2 fading, f3 wisps"),
  E("w_harisen_evo", 48, 48, 4, "center", "s2-items", "Dere Dere Harisen: heart-shaped pink paper fan whirling 360 degrees with tiny hearts; rotating frames"),
  E("w_ribbon", 12, 12, 2, "center", "s2-items", "Henshin ribbon projectile: pink-mint ribbon loop; f1 twist"),
  E("w_ribbon_evo", 14, 14, 2, "center", "s2-items", "Infinite Henshin Loop ribbon: gold ribbon loop with sparkle; f1 twist"),
  E("w_fireball", 14, 14, 4, "center", "s2-items", "Cheat Fireball: absurdly well-rendered round fireball (white core, yellow, orange, red rim), flicker loop, faces right"),
  E("w_meteor_cheat", 24, 32, 2, "center", "s2-items", "Meteor Lv.99999: falling flaming meteor, head at the bottom, fire tail going up; f1 flicker"),
  E("w_honk_wave", 32, 32, 4, "center", "s2-items", "HONK shockwave: 3 concentric yellow-white sound arcs opening RIGHT; play-once expand"),
  E("w_boba", 8, 8, 2, "center", "s2-items", "Boba pearl: glossy dark brown tapioca pearl with a white shine; f1 shine shifted"),
  E("w_boba_big", 14, 14, 2, "center", "s2-items", "Giant boba pearl (Tapioca Tsunami) with a big shine and a drip; f1 shine shifted"),
  E("w_crane", 12, 10, 4, "center", "s2-items", "Paper crane: white origami crane, faces right; 4-frame flap"),
  E("w_crane_gold", 12, 10, 4, "center", "s2-items", "Golden paper crane (Thousand Crane Wish) with sparkle; 4-frame flap"),
  E("w_lightstick_wave", 32, 16, 4, "center", "s2-items", "Idol lightstick wave: a crescent of light opening RIGHT; frames cycle pink -> cyan -> yellow -> violet"),
  E("w_lightstick", 6, 14, 2, "center", "s2-items", "Crowd lightstick (white, tinted by code) held by a tiny hand; f1 tilted (waving)"),
  E("w_kotatsu", 32, 24, 4, "feet", "s2-items", "Kotatsu: low table with a big fluffy quilt; f0 folded quilt bundle, f1-2 deployed with steam wobble, f3 Too Comfy (heater glowing orange under the quilt)"),
  E("w_kotatsu_evo", 40, 28, 4, "feet", "s2-items", "Eternal Winter Break kotatsu: bigger, plushier quilt with a bowl of mikan on top; f0-2 cosy steam loop, f3 Too Comfy glow"),
  E("w_mikan", 8, 8, 2, "center", "s2-items", "Mikan (mandarin orange) projectile with a leaf; f1 rotated"),
  E("fx_baka", 24, 10, 2, "center", "s2-items", "Pop text: f0 hand-lettered red 'BAKA!' with a white outline and an anger mark; f1 small pink '...baka' with a heart"),
  E("fx_nani", 28, 12, 2, "center", "s2-items", "Pop text: chunky red-and-white 'NANI?!' with shock lines; f1 shaken 1px"),
  E("fx_honk", 24, 10, 2, "center", "s2-items", "Pop text: yellow 'HONK' lettering with sound lines; f1 shaken"),
  E("fx_charm_heart", 8, 7, 2, "center", "s2-items", "Charmed heart over an enemy's head (pink, white shine); f0 beat, f1 cracked (heartbroken)"),
  E("fx_rose_big", 16, 16, 2, "center", "s2-items", "Shoujo rose bloom with sparkles (red/pink); f1 rotated petals"),
  E("fx_henshin", 32, 32, 6, "center", "s2-items", "Henshin transformation burst: ribbons spiralling in, a star flash, ribbons flying out; play-once"),
  E("fx_crater", 24, 12, 3, "center", "s2-items", "Overdone fireball crater decal: f0 fresh glowing orange, f1 embers, f2 dark scorch"),
  E("fx_light_pillar", 16, 48, 4, "feet", "s2-items", "Isekai light pillar: a column of soft white-gold light with sparkles rising from the ground; play-once rise and fade"),
  E("fx_zzz", 8, 8, 3, "center", "s2-items", "Sleepy 'Z' letters (lavender), 3 sizes as frames"),
  E("fx_glitch", 8, 8, 4, "center", "s2-items", "Glitch mote: RGB-split pixel blocks (pink/cyan/lime/white), 4 random arrangements"),

  // ---------------------------------------------------------------- s2-items: weapon / evolution / passive icons
  iconS2("icon_dark_flame_dragon", "Weapon: Dark Flame Dragon - the tiny salamander breathing an orange flame with a violet outline"),
  iconS2("icon_teapot_tempest", "Weapon: Teapot Tempest - a teacup and saucer with a swirl of tea"),
  iconS2("icon_micro_missile_swarm", "Weapon: Micro Missile Swarm - three tiny missiles with tangled spaghetti trails"),
  iconS2("icon_baka_harisen", "Weapon: Baka Harisen - a white paper fan with an anger mark"),
  iconS2("icon_notice_me_sparkles", "Weapon: Notice-Me Sparkles - a pink heart surrounded by sparkles"),
  iconS2("icon_henshin_burst", "Weapon: Henshin Burst - a mint heart wand with ribbons"),
  iconS2("icon_cheat_fireball", "Weapon: Cheat Fireball - a fireball with a tiny 'Lv.9999' tag"),
  iconS2("icon_horn_of_reincarnation", "Weapon: Horn of Reincarnation - a yellow truck horn with sound lines"),
  iconS2("icon_bubble_tea_cannon", "Weapon: Bubble Tea Cannon - a bubble tea cup with a fat straw and boba"),
  iconS2("icon_paper_crane_flock", "Weapon: Paper Crane Flock - two white origami cranes"),
  iconS2("icon_idol_lightstick_wave", "Weapon: Idol Lightstick Wave - a glowing pink lightstick with a music note"),
  iconS2("icon_kotatsu_of_sloth", "Weapon: Kotatsu of Sloth - a kotatsu with a mikan on top and Zzz"),
  iconS2("icon_unsealed_abyss_dragon", "Evolution: Unsealed Abyss Dragon - black-violet dragon head with magenta eyes, ornate frame"),
  iconS2("icon_eternal_tea_party", "Evolution: Eternal Tea Party - a flying teapot pouring, golden sparkles"),
  iconS2("icon_al_dente_armageddon", "Evolution: Al Dente Armageddon - a missile wrapped in spaghetti with a meatball"),
  iconS2("icon_dere_dere_harisen", "Evolution: Dere Dere Harisen - a pink heart-shaped paper fan"),
  iconS2("icon_shoujo_filter", "Evolution: Shoujo Filter - a rose with screentone dots and sparkles"),
  iconS2("icon_infinite_henshin_loop", "Evolution: Infinite Henshin Loop - a gold ribbon in an infinity loop"),
  iconS2("icon_cheat_meteor", "Evolution: Meteor Lv.99999 - a falling meteor with an absurd number tag"),
  iconS2("icon_isekai_rush_hour", "Evolution: Isekai Rush Hour - a ghostly truck with speed lines"),
  iconS2("icon_tapioca_tsunami", "Evolution: Tapioca Tsunami - a giant boba pearl riding a wave of tea"),
  iconS2("icon_thousand_crane_wish", "Evolution: Thousand Crane Wish - a golden crane with a star"),
  iconS2("icon_sold_out_dome_tour", "Evolution: Sold-Out Dome Tour - a dome stage with spotlights"),
  iconS2("icon_eternal_winter_break", "Evolution: Eternal Winter Break - a kotatsu with a snowflake and a mikan bowl"),
  iconS2("icon_plot_armor", "Passive: Plot Armor - a gold shield made of a rolled-up script with a red bookmark and a star"),
  iconS2("icon_main_character_aura", "Passive: Main Character Aura - a radiant sunburst ring with sparkles"),
  iconS2("icon_bento_box", "Passive: Bento Box - a pink bento box with onigiri and an octopus sausage"),
  iconS2("icon_speed_lines", "Passive: Speed Lines - three white motion streaks behind a tiny star"),
  iconS2("icon_inner_monologue", "Passive: Inner Monologue - a thought bubble with '...' and a sweat drop"),
  iconS2("icon_training_montage", "Passive: Training Montage - a red headband wrapped around a dumbbell"),
  iconS2("icon_friendship_bracelet", "Passive: Friendship Bracelet - a woven pastel bracelet with a heart bead and a star bead"),
  iconS2("icon_chibi_charm", "Passive: Chibi Charm - a tiny chibi keychain charm on a pink ring"),

  // ---------------------------------------------------------------- s2-items: relic icons (61) and Plot Twist icons (15)
  ...S2_RELIC_ICONS.map(([id, desc]) => iconS2(`icon_relic_${id}`, `Relic ${desc}`)),
  ...S2_TWIST_ICONS.map(([id, desc]) => iconS2(`icon_twist_${id}`, desc)),

  // ---------------------------------------------------------------- s2-items: hub / meta UI art
  iconS2("icon_dreamgem", "Currency: Dream Gem - pink faceted crystal diamond with a white glint"),
  iconS2("icon_copium", "Currency: Copium - a pastel pink/lavender pill capsule with a sparkle"),
  iconS2("icon_trophy", "UI: Plot Point (achievement) - a small gold trophy with a star"),
  iconS2("icon_codex_unknown", "UI: undiscovered codex entry - a plum silhouette blob with a white '?'"),
  iconS2("icon_heat", "UI: Plot Twist heat - a pink-orange flame with a twisty swirl"),
  E("ui_coin_big", 24, 24, 2, "center", "s2-items", "Hub currency bar: big Star Coin (gold, star emboss); f1 shine sweep"),
  E("ui_gem_big", 24, 24, 2, "center", "s2-items", "Hub currency bar: big Dream Gem (pink crystal); f1 shine sweep"),
  E("ui_copium_big", 24, 24, 2, "center", "s2-items", "Hub currency bar: big Copium capsule; f1 shine sweep"),
  E("ui_gacha_capsule", 32, 32, 6, "center", "s2-items", "Gacha capsule: f0 blue, f1 purple, f2 gold, f3 rainbow, f4 glitch (RGB split), f5 cracked open with light leaking"),
  E("ui_gacha_meteor", 24, 48, 5, "center", "s2-items", "Gacha meteor falling (head at the bottom, long trail up): f0 blue, f1 purple, f2 gold, f3 rainbow, f4 glitch"),
  E("ui_summon_circle", 64, 64, 4, "center", "s2-items", "Summoning circle: pink/gold magic circle with stars and rune ticks; 4 rotation frames"),
  E("ui_rarity_badge", 24, 12, 7, "center", "s2-items", "Rarity badge with lettering: f0 N grey, f1 R blue, f2 SR violet, f3 SSR gold, f4 UR rainbow, f5 LR crimson-gold, f6 MYTHIC glitch"),
  E("ui_card_corner", 8, 8, 7, "center", "s2-items", "Card corner ornament per rarity (N..MYTHIC as frames), mirrored by CSS into 4 corners"),
  E("ui_merch_machine", 64, 80, 4, "center", "s2-items", "The Merch Machine: pastel capsule machine, heart coin slot, crank, glowing capsules inside, 'NOT A SLOT MACHINE' sticker; f0-1 idle glow, f2 crank turning, f3 dispensing"),
  E("ui_mastered", 20, 20, 1, "center", "s2-items", "Gold 'MASTERED' frame drawn around a 16x16 weapon icon (transparent centre, tiny star on top)"),
  E("board_node", 16, 16, 4, "center", "s2-items", "Training Arc board node star: f0 locked (dim), f1 available, f2 affordable (bright, for pulse), f3 owned (gold)"),
  E("board_keystone", 24, 24, 4, "center", "s2-items", "Board keystone: big ornate star with a ribbon banner; f0 locked, f1 available, f2 affordable, f3 owned"),
  E("board_center", 32, 32, 2, "center", "s2-items", "Board centre 'Episode 1' node: clapperboard inside a star; f1 glow"),
  E("board_glyph", 8, 8, 24, "center", "s2-items", "Board node glyphs (white, tinted), frame order: 0 might, 1 max HP, 2 regen, 3 armor, 4 move, 5 cooldown, 6 area, 7 amount, 8 proj speed, 9 duration, 10 pickup, 11 crit, 12 crit dmg, 13 luck, 14 XP, 15 coins, 16 gem find, 17 dash cd, 18 curse, 19 reroll/banish/skip/cards, 20 slot, 21 revive, 22 dash charge, 23 overdrive/chest/elite"),
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
