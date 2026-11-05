/**
 * Training Arc board content (docs/EXPANSION.md §5): 6 themed sectors x 5
 * rings = 120 nodes around the "Episode 1" centre, 10 keystones on the outer
 * ring. Ring sizes per sector are 2 / 3 / 4 / 5 / 6. Costs come from the ring,
 * the node kind and its position (src/meta/board/graph.ts + TUNING.board);
 * layout and edges are generated from this order.
 *
 * Ids are stable save keys: never rename one (a removed id is refunded on load).
 */
import type { NodeEffect, NodeSpec, SectorSpec } from "./types";
import type { RunFlag } from "../../game/run-config";
import type { StatKey } from "./types";

const st = (id: string, name: string, stat: StatKey, per: number, max = 3, flavor = ""): NodeSpec => ({ id, name, kind: "stat", max, fx: [{ t: "stat", stat, per }], flavor });
const fl = (id: string, name: string, flag: RunFlag, per: number, max = 1, flavor = ""): NodeSpec => ({ id, name, kind: "utility", max, fx: [{ t: "flag", flag, per }], flavor });
const ut = (id: string, name: string, fx: NodeEffect[], max = 1, flavor = ""): NodeSpec => ({ id, name, kind: "utility", max, fx, flavor });
const ks = (id: string, name: string, fx: NodeEffect[], flavor: string): NodeSpec => ({ id, name, kind: "keystone", max: 1, fx, flavor });

export const SECTORS: readonly SectorSpec[] = [
  {
    id: "power",
    name: "Shounen Power",
    color: "#ff6f91",
    rings: [
      [
        st("might_1", "Shounen Protein Shake", "might", 0.04, 5, "0% protein. 100% believing in yourself."),
        st("crit_1", "Critical Blush", "crit", 0.02, 3, "Your attacks are so cute they hurt. Critically."),
      ],
      [
        st("might_2", "Ankle Weights", "might", 0.04, 3, "Worn for 40 episodes. Removed for one dramatic shot."),
        st("critdmg_1", "Dramatic Close-Up", "critMult", 0.1, 3, "The camera zooms in. The damage number gets bigger. Science."),
        st("area_1", "Bigger Sparkles", "area", 0.04, 3, "Sparkle budget increased by the committee."),
      ],
      [
        st("might_3", "Screaming Louder", "might", 0.05, 3, "Volume is a damage stat. Everyone knows this."),
        ut("amount_1", "Twin-Tail Multishot", [{ t: "stat", stat: "amount", per: 1 }], 1, "Two tails, two shots. The math checks out."),
        st("crit_2", "Lens Flare Crits", "crit", 0.03, 3, "Every crit now comes with a free lens flare."),
        st("knock_1", "Baka Smack Force", "knock", 0.15, 2, "Sends enemies flying into the next episode."),
      ],
      [
        st("might_4", "Power Level: Yes", "might", 0.05, 3, "The scouter just says 'yes'."),
        st("critdmg_2", "Slow-Motion Impact Frame", "critMult", 0.15, 3, "Three seconds of animation budget for one punch."),
        st("area_2", "Widescreen Attacks", "area", 0.05, 3, "Now in 21:9. The enemies were not consulted."),
        ut("amount_2", "Background Clone Army", [{ t: "stat", stat: "amount", per: 1 }], 1, "They're just copy-pasted. Nobody will notice."),
        st("crit_3", "Eye Glint Of Destiny", "crit", 0.03, 3, "*ting*"),
      ],
      [
        st("might_5", "Final Form Pending", "might", 0.06, 3, "Still charging. Please wait 3-5 episodes."),
        st("critdmg_3", "NANI?! Multiplier", "critMult", 0.2, 2, "Enemies are legally required to say it."),
        st("area_3", "IMAX Sparkles", "area", 0.06, 2, "Premium large-format sparkling."),
        st("crit_4", "Main Character Timing", "crit", 0.04, 2, "Crits happen exactly when they look cool."),
        ks("glass_cannon", "Glass Cannon Arc", [{ t: "stat", stat: "might", per: 0.6 }, { t: "statPct", stat: "maxHp", per: -0.4 }], "+60% damage, -40% max HP. Fragile? No. *Aesthetic*."),
        ks("chosen_one", "Chosen One Syndrome", [{ t: "stat", stat: "crit", per: 0.15 }, { t: "stat", stat: "critMult", per: 0.5 }, { t: "stat", stat: "might", per: -0.15 }], "Destiny crits for you. Your normal hits, sadly, are filler."),
      ],
    ],
  },
  {
    id: "guts",
    name: "Plot Armor",
    color: "#6fc3ff",
    rings: [
      [
        st("hp_1", "Extra Episodes Ordered", "maxHp", 8, 5, "The network renewed your health bar."),
        st("regen_1", "Recap Episode", "regen", 0.1, 3, "Heal slowly while the narrator explains what just happened."),
      ],
      [
        st("hp_2", "Bento Box Lunch", "maxHp", 10, 3, "Made with love (and a suspicious amount of octopus sausages)."),
        st("armor_1", "Plot Armor Plating", "armor", 1, 2, "Blocks damage that would be inconvenient for the story."),
        st("heal_1", "Grandma's Onigiri", "healMul", 0.08, 3, "Food heals more. Grandma insists."),
      ],
      [
        st("hp_3", "Second Cour", "maxHp", 12, 3, "Twelve more episodes of being alive."),
        fl("revive_1", "Not Dead, Just Unconscious", "revives", 1, 1, "Revive once per run. It was a fake-out death."),
        st("regen_2", "Hot Spring Break", "regen", 0.15, 3, "A wholesome soak. Strictly for health reasons."),
        st("dr_1", "Thick Plot Armor", "dmgReduction", 0.02, 3, "The script says you take less damage."),
      ],
      [
        st("hp_4", "Season Renewal", "maxHp", 15, 3, "The ratings were good enough. Barely."),
        st("armor_2", "Rival-Proof Uniform", "armor", 1, 2, "Ironed. Starched. Somehow bulletproof."),
        ut("shield_1", "Sparkle Barrier", [{ t: "stat", stat: "shield", per: 1 }], 1, "A shield charge that eats one whole hit, then sparkles back."),
        st("regen_3", "Power Nap", "regen", 0.2, 3, "Five minutes. Just five more minutes."),
        fl("revive_2", "Dramatic Revival", "revives", 1, 1, "A second revive, with an insert song this time."),
      ],
      [
        st("hp_5", "Movie Sequel Budget", "maxHp", 20, 3, "Theatrical release HP."),
        st("armor_3", "Main Character Durability", "armor", 1, 2, "Fell off a building. Is fine."),
        st("dr_2", "Censored Damage", "dmgReduction", 0.03, 3, "Damage is now covered by a tasteful sparkle."),
        st("heal_2", "Love-Powered Healing", "healMul", 0.1, 3, "Heals scale with how much the audience likes you."),
        ks("plot_armor", "Plot Armor", [{ t: "flag", flag: "plotArmor", per: 1 }, { t: "stat", stat: "might", per: -0.1 }], "Once per run, survive a lethal hit. The cost: -10% damage (the plot needs you humble)."),
        ks("tank_arc", "The Protagonist Refuses To Fall", [{ t: "statPct", stat: "maxHp", per: 0.4 }, { t: "stat", stat: "armor", per: 3 }, { t: "stat", stat: "moveSpeed", per: -0.2 }], "+40% max HP, +3 armor, -20% move speed. Walks everywhere. Dramatically."),
      ],
    ],
  },
  {
    id: "speed",
    name: "Speed Lines",
    color: "#ffd166",
    rings: [
      [
        st("move_1", "Running Late For School", "moveSpeed", 0.04, 5, "Toast in mouth. Destiny ahead."),
        st("dashcd_1", "Sakuga Footwork", "dashCd", -0.04, 3, "The animators finally got a budget for your legs."),
      ],
      [
        st("move_2", "Toast-In-Mouth Sprint", "moveSpeed", 0.03, 3, "Crumbs are aerodynamic."),
        st("cd_1", "Fast-Forward Button", "cooldown", -0.02, 3, "Attacks come back faster. So does the next episode."),
        fl("dash_charge_1", "Double Dash", "dashCharges", 1, 1, "Two dashes before the cooldown. Legally distinct from double jump."),
      ],
      [
        st("cd_2", "Skip The Opening", "cooldown", -0.025, 3, "90 seconds saved every episode."),
        st("projspd_1", "Speed Lines Overlay", "projSpeed", 0.06, 3, "Projectiles go faster when the background is stripes."),
        st("move_3", "Tailwind From The Plot", "moveSpeed", 0.03, 3, "The wind always blows toward the next scene."),
        st("dur_1", "Inner Monologue", "duration", 0.05, 3, "Effects last as long as your thoughts. Which is forever."),
      ],
      [
        st("cd_3", "Recap Skipped", "cooldown", -0.03, 3, "You already know what happened."),
        fl("dash_charge_2", "Triple Dash", "dashCharges", 1, 1, "Three dashes. You are basically teleporting now."),
        st("dur_2", "Extended Cut", "duration", 0.06, 3, "Now with 12 extra minutes of effects."),
        st("projspd_2", "Frame-Skip Projectiles", "projSpeed", 0.08, 2, "They skip the frames in between. Budget magic."),
        st("dashcd_2", "Afterimage Technique", "dashCd", -0.05, 3, "Your afterimages do the cooldown for you."),
      ],
      [
        st("cd_4", "Time-Skip Arc", "cooldown", -0.03, 3, "Three years later, your cooldowns are shorter."),
        st("dur_3", "Director's Cut", "duration", 0.08, 2, "Every effect gets its own extended scene."),
        st("move_4", "Transfer Student Hustle", "moveSpeed", 0.04, 3, "New school, new speed."),
        st("projspd_3", "Express Delivery Shots", "projSpeed", 0.1, 2, "Delivered same day. Guaranteed."),
        st("dashcd_3", "Teleport-Adjacent", "dashCd", -0.06, 2, "Not technically teleporting. The lawyers checked."),
        ks("speed_lines", "Speed Lines Everywhere", [{ t: "stat", stat: "moveSpeed", per: 0.3 }, { t: "stat", stat: "cooldown", per: -0.12 }, { t: "stat", stat: "armor", per: -3 }], "+30% move speed, -12% cooldown, -3 armor. Gotta go fast. Do not get hit."),
      ],
    ],
  },
  {
    id: "brain",
    name: "Main Character Brain",
    color: "#b39dff",
    rings: [
      [
        st("reroll_1", "Retcon", "rerolls", 1, 3, "+1 level-up reroll per run. The writers changed their minds."),
        st("growth_1", "Training Montage", "growth", 0.04, 3, "More XP. Upbeat music sold separately."),
      ],
      [
        fl("banish_1", "Cancelled Subplot", "banish", 1, 2, "Banish a card from the pool for the run. Nobody liked that subplot."),
        st("growth_2", "Study Group", "growth", 0.04, 3, "Learning is faster with friends (and snacks)."),
        fl("skip_1", "Skip Intro", "skip", 1, 2, "Skip a level-up for an XP and coin refund."),
      ],
      [
        ut("cards_1", "Choose Your Route", [{ t: "stat", stat: "cards", per: 1 }], 1, "+1 card choice on every level-up. Visual novel energy."),
        st("reroll_2", "Alternate Timeline", "rerolls", 1, 2, "Another reroll from a slightly different universe."),
        ut("weapon_slot", "Inventory DLC", [{ t: "slot", slot: "weapon", per: 1 }], 1, "+1 weapon slot (6 -> 7). Only $0.00!"),
        st("growth_3", "Exam Cram Session", "growth", 0.05, 3, "XP up. Sleep down."),
      ],
      [
        ut("start_level_1", "Prologue Skip", [{ t: "startLevel", per: 2 }], 2, "Start the run 2 levels higher per rank. We skipped the boring part."),
        fl("banish_2", "Writers' Room Veto", "banish", 1, 2, "One more banish. The room has spoken."),
        ut("passive_slot", "Accessory Slot DLC", [{ t: "slot", slot: "passive", per: 1 }], 1, "+1 passive slot (6 -> 7). Accessorise responsibly."),
        ut("head_start", "Prepared Protagonist", [{ t: "startWeapon", level: 2 }], 1, "Your chosen start weapon begins at Lv2. You read the manual."),
        st("growth_4", "Second Playthrough Knowledge", "growth", 0.05, 3, "You've seen this episode before. Literally."),
      ],
      [
        ks("filler_episode", "Filler Episode", [{ t: "stat", stat: "growth", per: 0.5 }, { t: "stat", stat: "might", per: -0.2 }], "+50% XP, -20% damage. Nothing happens, but you learn a lot."),
        ks("friendship", "Power of Friendship", [{ t: "flag", flag: "friendship", per: 0.04 }, { t: "stat", stat: "growth", per: -0.1 }], "+4% damage for each different weapon you hold. -10% XP (friends are distracting)."),
        fl("skip_2", "Skip Recap", "skip", 1, 2, "Even more skipping."),
        st("reroll_3", "Reroll Your Destiny", "rerolls", 1, 2, "Destiny is just a suggestion."),
        st("growth_5", "Light Novel Exposition", "growth", 0.06, 2, "Three pages of explanation per level. Very educational."),
        ut("start_level_2", "In Medias Res", [{ t: "startLevel", per: 3 }], 1, "Start 3 more levels in. The story already started without you."),
      ],
    ],
  },
  {
    id: "fortune",
    name: "Gacha Brain",
    color: "#7ee0b0",
    rings: [
      [
        st("greed_1", "Merch Royalties", "greed", 0.1, 5, "+10% coins. Your face is on a keychain now."),
        st("pickup_1", "Fan Mail Magnet", "pickup", 0.1, 5, "Everything shiny comes to you. Mostly letters."),
      ],
      [
        st("luck_1", "Lucky Item Of The Day", "luck", 0.05, 5, "Today's lucky item: a slightly bent spoon."),
        st("greed_2", "Limited Edition Pricing", "greed", 0.06, 3, "Same item, gold sticker, double price."),
        ut("relic_slot_1", "Shelf Space", [{ t: "slot", slot: "relic", per: 1 }], 1, "+1 relic slot. Finally, somewhere to put the merch."),
      ],
      [
        st("gemfind_1", "Sparkly Gem Eyes", "gemFind", 0.04, 3, "+4% Dream Gems from runs. Your eyes are literally gems."),
        st("luck_2", "Four-Leaf Hair Clip", "luck", 0.04, 3, "Fashionable AND statistically significant."),
        fl("chest_1", "Lootbox Whisperer", "chestLuck", 0.08, 3, "Chests roll extra rewards more often. You speak fluent lootbox."),
        ut("relic_slot_2", "Display Cabinet", [{ t: "slot", slot: "relic", per: 1 }], 1, "+1 relic slot. Glass doors. Dust-free. Respect."),
      ],
      [
        st("greed_3", "Convention Booth", "greed", 0.08, 3, "Stickers of your own face, five coins each. Business is booming."),
        st("gemfind_2", "Gem Sniffing", "gemFind", 0.05, 3, "Don't ask how. Just enjoy the gems."),
        st("pickup_2", "Autograph Line Magnet", "pickup", 0.12, 3, "Everything lines up to come to you."),
        ut("relic_slot_3", "Climate-Controlled Merch Room", [{ t: "slot", slot: "relic", per: 1 }], 1, "+1 relic slot (4 total). Humidity: 45%. Perfection."),
        st("luck_3", "Gacha Prayer Ritual", "luck", 0.05, 3, "Tap the screen in a specific pattern. It definitely works."),
      ],
      [
        ks("merch_tie_in", "Merch Tie-In", [{ t: "stat", stat: "greed", per: 0.5 }, { t: "stat", stat: "gemFind", per: 0.3 }, { t: "stat", stat: "might", per: -0.15 }], "+50% coins, +30% gem find, -15% damage. The show is now a commercial."),
        st("gemfind_3", "Whale Radar", "gemFind", 0.06, 3, "Detects gems from three episodes away."),
        st("greed_4", "Blu-ray Box Set", "greed", 0.1, 3, "Contains one extra episode and a cardboard sleeve."),
        fl("chest_2", "Golden Ticket Energy", "chestLuck", 0.1, 2, "Every chest might be THE chest."),
        st("luck_4", "Ultra Rare Pull Energy", "luck", 0.06, 2, "You can feel it. This next one. Definitely."),
        st("pickup_3", "Hug Range", "pickup", 0.15, 2, "Everything wants a hug. Everything gets one."),
      ],
    ],
  },
  {
    id: "chaos",
    name: "Cursed Production",
    color: "#ff9f43",
    rings: [
      [
        st("curse_1", "Cursed Production", "curse", 0.05, 3, "More enemies, more rewards. The studio is fine. Probably."),
        fl("ultstart_1", "Pre-Hyped", "ultStart", 0.1, 2, "Start runs with Overdrive partly charged."),
      ],
      [
        fl("elite_1", "Rival Of The Week", "eliteRate", 0.25, 2, "More elites per elite event (more chests, too)."),
        st("curse_2", "Network Notes", "curse", 0.05, 3, "The network wants more explosions. And more enemies."),
        fl("ultstart_2", "Opening Theme Hype", "ultStart", 0.1, 2, "The opening song charges you up."),
      ],
      [
        st("curse_3", "Crunch Time", "curse", 0.06, 3, "The animators are tired. The enemies are numerous."),
        fl("elite_2", "Monster Of The Week", "eliteRate", 0.25, 2, "This week's monster brought friends."),
        st("hype_1", "Hype Train", "might", 0.03, 3, "Choo choo. Damage up."),
        fl("ultstart_3", "Overdrive Pre-Order", "ultStart", 0.15, 1, "Pre-ordered Overdrive arrives at run start."),
      ],
      [
        st("curse_4", "Budget Cuts Bonus", "curse", 0.06, 3, "Fewer frames, more enemies."),
        fl("elite_3", "Boss Rush Scheduling", "eliteRate", 0.25, 2, "Elites everywhere. Chests everywhere."),
        st("hype_2", "Hype Train Express", "might", 0.04, 3, "Now with fewer stops."),
        fl("ultstart_4", "Hype Overflow", "ultStart", 0.15, 1, "Your hype meter has a hype meter."),
        st("cursed_luck", "Cursed Luck", "luck", 0.05, 3, "Bad luck for the enemies counts as good luck for you."),
      ],
      [
        ks("sequel_curse", "Curse Of The Sequel", [{ t: "stat", stat: "curse", per: 0.6 }, { t: "stat", stat: "greed", per: 0.3 }, { t: "stat", stat: "growth", per: 0.2 }], "+60% curse (so many enemies), +30% coins, +20% XP. Sequels are bigger. Not better. Bigger."),
        ks("truck_blessing", "Truck-kun's Blessing", [{ t: "flag", flag: "revives", per: 1 }, { t: "stat", stat: "might", per: 0.2 }, { t: "stat", stat: "pickup", per: -0.3 }], "+1 revive, +20% damage, -30% pickup range. You have been isekai'd before. You know the drill."),
        st("curse_5", "Series Finale Pressure", "curse", 0.08, 2, "Everything is on the line. Especially the enemy count."),
        st("hype_3", "Hype Train Bullet", "might", 0.05, 2, "Non-stop to Damage Town."),
        fl("rival_bounty", "Rival Bounty Hunter", "eliteRate", 0.25, 2, "Rivals have a bounty. You are the bounty hunter."),
        fl("ultstart_5", "Final Episode Energy", "ultStart", 0.2, 1, "It's the last episode. Overdrive is basically ready."),
      ],
    ],
  },
];

/** Old Dream Shop upgrade id -> the board node with the same effect per rank (save v1 compat shim). */
export const LEGACY_SHOP_NODES: Readonly<Record<string, string>> = {
  might: "might_1",
  vitality: "hp_1",
  swiftness: "move_1",
  magnetism: "pickup_1",
  greed: "greed_1",
  luck: "luck_1",
  reroll: "reroll_1",
  revive: "revive_1",
};
