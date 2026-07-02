// The slice quest chain. Types: talk | kill | collect | boss.
// giver/receiver: npc ids. reward: gold/xp/items/currency/passive points.

export const QUESTS = [
  {
    id: "q1", name: "Welcome to Brightshore", giver: "maren", turnin: "maren",
    type: "talk", requires: null, minLevel: 1,
    intro: "Another face off the ferry! Welcome to Brightshore, adventurer. The isle's gone strange — Duskfang beasts prowling the old ruins, mushrooms walking. We pay well for able hands. Stay a moment and I'll mark your map.",
    done: "Good. Rest at the fountain, buy a potion from Poppy, and when you're ready — the meadow needs thinning.",
    objective: "Speak with Captain Maren",
    reward: { gold: 50, xp: 30 },
  },
  {
    id: "q2", name: "Puffling Cull", giver: "maren", turnin: "maren",
    type: "kill", target: "puffling", count: 8, requires: "q1", minLevel: 1,
    intro: "Don't let the fluff fool you — the pufflings are eating the meadow bare. Cull eight of them. Consider it your induction.",
    done: "Eight exactly? You counted. I like that. Here — shards. Rub one on a plain bit of gear and see what wakes up.",
    objective: "Cull 8 Pufflings in Sunmeadow",
    reward: { gold: 80, xp: 120, currency: { shard_awakening: 2 } },
  },
  {
    id: "q3", name: "Boar Bristles", giver: "maren", turnin: "maren",
    type: "collect", target: "boar_hide", from: "boar", count: 6, dropChance: 0.65, requires: "q2", minLevel: 2,
    intro: "The Bristlebacks east of the road ruin more fences than winter does. Bring me six hides and Poppy will stitch you something sharp.",
    done: "Thick hides, these. Poppy's already picked out a blade for you. It's the green kind — lucky you.",
    objective: "Collect 6 Bristleback Hides",
    reward: { gold: 120, xp: 260, item: { rarity: "uncommon", slotKind: "weapon" } },
  },
  {
    id: "q4", name: "The Sage's Errand", giver: "maren", turnin: "elowen",
    type: "talk", requires: "q3", minLevel: 3,
    intro: "Elowen — the Skill Sage by the big tree — asked for this parcel from the mainland. Runes, probably. She'll teach you a thing or two about your talents while you're there.",
    done: "Ah, my runes! Let me repay you with advice: your skills can hold Augment Runes — trade-offs, all of them, and that's the fun. And your passive constellation — press P — is where builds are truly born. Take this point. Spend it with intent.",
    objective: "Deliver the parcel to Skill Sage Elowen",
    reward: { gold: 60, xp: 200, passivePoints: 1 },
  },
  {
    id: "q5", name: "Mushroom Menace", giver: "elowen", turnin: "elowen",
    type: "multikill", targets: { sporeling: 10, shambler: 3 }, requires: "q4", minLevel: 5,
    intro: "Gloomroot Forest walks, my friend. Sporelings by the dozen and their big shambling parents. Ten little, three large — thin them before the spores reach town.",
    done: "The air is clearer already. This orb ascends what is merely good toward greatness. And another point for your constellation.",
    objective: "Slay 10 Sporelings and 3 Fungal Shamblers",
    reward: { gold: 200, xp: 600, currency: { orb_ascension: 1 }, passivePoints: 1 },
  },
  {
    id: "q6", name: "Wisp in the Dark", giver: "elowen", turnin: "elowen",
    type: "kill", target: "gloomwisp", count: 6, requires: "q5", minLevel: 8,
    intro: "Deeper in, past the shamblers, cold lights drift where no lantern hangs. Gloomwisps. They bite with frost. Snuff six of them.",
    done: "Cold work. Warm yourself with this — a rune the wisps themselves might have envied. And one more point.",
    objective: "Snuff 6 Gloomwisps in the deep forest",
    reward: { gold: 260, xp: 900, augment: true, passivePoints: 1 },
  },
  {
    id: "q7", name: "Thin the Vanguard", giver: "maren", turnin: "maren",
    type: "kill", target: "raider", count: 5, requires: "q6", minLevel: 11,
    intro: "Now the real trouble. Duskfang Raiders hold the Broken Ruins — the Alpha's vanguard. Five fewer of them and we might sleep through a night. They will NOT die politely.",
    done: "Five raiders down. The garrison's been trying that for a month. This came off a supply cart they robbed — I'd say you've earned it.",
    objective: "Slay 5 Duskfang Raiders at the Broken Ruins",
    reward: { gold: 400, xp: 1600, item: { rarity: "epic" }, passivePoints: 1 },
  },
  {
    id: "q8", name: "The Duskfang Alpha", giver: "maren", turnin: "maren",
    type: "boss", target: "grulmok", count: 1, requires: "q7", minLevel: 14,
    intro: "Grulmok. The Alpha. He dens in the hollow at the isle's dark northern tip. Kill him and the Duskfang break — every raider, every mystic, leaderless. Finish this, and Brightshore will remember your name.",
    done: "By the tide... you actually did it. ALPHASLAYER! Drinks at the fountain tonight! Take this — it washed ashore years ago and no one's been worthy of it. Until now.",
    objective: "Slay Grulmok, the Duskfang Alpha",
    reward: { gold: 1000, xp: 5000, unique: true, title: "Alphaslayer" },
  },
];

export const QUEST_ITEMS = {
  boar_hide: { id: "boar_hide", name: "Bristleback Hide", icon: "🟫", text: "Coarse, warm, and smells exactly how you'd expect. (Quest item)" },
};

export function questById(id) { return QUESTS.find((q) => q.id === id); }
