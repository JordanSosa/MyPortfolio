/**
 * Satire copy for the hub, the results screen and the run stingers, transcribed
 * verbatim from the content bible: docs/content/satire.md (episode titles §2,
 * "Next time on..." §3, death lines §4, loading tips §7, taglines §8, grade
 * comments §9, Kira Kira Wiki blurbs §10), docs/content/heroes.md §5 (OC bios,
 * typos marked [sic] are intentional) and docs/content/gacha.md §3 / §5.
 * Placeholders: {hero} {stage} {boss} {n} {time} {kills} {weapon}.
 * Keep it in sync with the bible (data only; pickers live in copy.ts).
 */

/** Run-start episode titles by stage id ("" = any stage). Stage titles get weight 2 on their stage. */
export const EPISODE_TITLES: Readonly<Record<string, readonly string[]>> = {
  "": [
    "The Puffs Have a Union Now?!",
    "{hero} Forgets to Eat Breakfast (Again)",
    "The Episode Where Nothing Is Filler (It's All Filler)",
    "A Thousand Plushies and One Very Tired Hero",
    "Training Montage, But It's Just Dashing",
    "Is This the Real Final Battle?! (No)",
    "{hero} and the Mystery of the Missing Reroll",
    "The Power of Friendship Was Inside the Weapons All Along",
    "Recap Episode (We Ran Out of Budget)",
    "{hero} Learns About Tax Brackets",
    "The Hot-Blooded Comeback Nobody Asked For",
    "Everyone Shouts Their Attack Names Louder This Week",
    "An Ominous Cliffhanger (Resolved in Four Seconds)",
    "The Plushies Push Back (Softly)",
    "A Wild Elite Appears! It Has a Rainbow Outline!",
    "{hero} vs. the Spawn Timer",
    "Beach Episo— No, Wrong Stage",
    "The Overdrive Meter Is Almost Full (It's Been Almost Full for Ten Minutes)",
    "Three Rerolls and a Very Dramatic Sigh",
    "The Evolution Card Was in the Chest All Along",
    "Our Hero Picks Up Every Single Gem, Out of Spite",
    "Combo Rank SSS: The Prophecy",
    "The Episode Where the Opening Theme Plays Twice",
    "Unexpected Plot Armor Has Entered the Chat",
    "{hero} Is Definitely Not Lost",
    "Today's Villain: Literally Everyone",
    "Please Look Forward to the Next Episode (After This One)",
    "Dramatic Wind, No Visible Source",
    "The Upgrade Board Has a Board",
    "The Gacha Was Inside You All Along",
    "The Merch Machine Sends Its Regards",
    "A Very Special Episode (It's Not Special)",
    "Our Hero Finally Reads the Fine Print (Episode Cancelled)",
    "{hero}'s Day Off (Interrupted)",
    "Revenge of the Mildly Annoyed Plushies",
    "The Rival Was the Friends We Made Along the Way",
    "Sixty Seconds of Pure Sakuga",
    "This Episode Contains Flashing Lights and Strong Feelings",
    "The Episode Number Is Getting Concerning",
    "{hero} Discovers Coins Exist"
  ],
  "dream_meadow": [
    "King Puff Has Been Working Out",
    "The Teddy That Never Sleeps Also Never Naps",
    "The Moon Is Being Weird Again",
    "Petals Everywhere, Including the Plot",
    "Night Falls on the Meadow (On Schedule)"
  ],
  "candy_kingdom": [
    "The Candy Kingdom Has a Tax on Fun",
    "Gummy Bears: Friend or Foe? (Foe)",
    "The Gingerbread Golem's Housing Crisis",
    "Sugar Rush Hour",
    "The Lollipop Mage Refuses to Explain Its Hat",
    "Everything Here Is Edible (Please Don't)",
    "The Donut Rebellion Rolls Out"
  ],
  "shoujo_academy": [
    "The Transfer Student Is Suspiciously Powerful",
    "Hall Monitors Hate This One Simple Trick (Running)",
    "A Love Letter? For Me?! (It's an Enemy)",
    "The Student Council Has Concerns About Your Attendance",
    "Pop Quiz! Nobody Studied!",
    "The Bishounen Didn't Notice This Episode Either",
    "Cherry Blossoms Fall for the 300th Consecutive Day",
    "Detention Arc"
  ],
  "beach_episode": [
    "The Obligatory Beach Episode (Crabs Only)",
    "Crab-kun's Sideways Ambitions",
    "Seagulls: The True Final Bosses",
    "The Watermelon That Split Up the Party",
    "Kraken-chan Just Wants a Hug",
    "Fireworks Tonight! (Some of Them Are Aimed at You)",
    "A Sandcastle With Commitment Issues"
  ],
  "final_arc": [
    "The Final Arc (Final) (Real) (v2)",
    "Previously on Kira Kira Overdrive: Everything",
    "Truck-kun Is in This Episode and That's Concerning",
    "Our Hero Fights Their Own Shadow (Literally)",
    "Rival-chan Has Been Training Off-Screen",
    "The Plot Holes Are Getting Bigger",
    "The Network Would Like a Word",
    "Budget Cuts: The Episode",
    "Rushed Ending Speedrun",
    "The Animation Error Is Canon Now",
    "A Commercial Break in the Middle of a Fight",
    "Everyone Comes Back for the Finale (Except the Budget)",
    "Renewed for Season 2?!"
  ]
};

/** FILLER EPISODE titles (every 5:00 of endless). */
export const FILLER_TITLES: readonly string[] = [
  "Sports Day (Everyone Trips)",
  "Everyone Goes Shopping",
  "A Day at the Spawn Ring",
  "The Plushies' Side of the Story",
  "Recap of the Recap",
  "Sports Festival (Nobody Wins)",
  "The Episode That Is Just Walking",
  "Christmas Special (In Summer)",
  "Cooking Competition: Omurice Edition",
  "Karaoke Night",
  "Lost in the Fog (There's No Fog)",
  "The Body-Swap Episode (Cancelled)",
  "Clip Show",
  "The Villain's Day Off",
  "A Very Long Staircase",
  "The Gem That Got Away",
  "Ghost Story Night",
  "Rainy Day Indoors (Outdoors)",
  "Everyone Learns a Lesson About Teamwork (Again)",
  "Filler Episode About Filler Episodes"
];

/** "Next time on Kira Kira Overdrive:" lines. only: "C" clears only, "D" deaths only. */
export const NEXT_TIME: readonly { t: string; only: string }[] = [
  {
    "t": "{hero} learns about tax brackets!",
    "only": ""
  },
  {
    "t": "{hero} finally reads the fine print! (Episode cancelled.)",
    "only": ""
  },
  {
    "t": "The Puffs unionise! Demands include: longer hops!",
    "only": ""
  },
  {
    "t": "A new rival appears! It's the same rival with a new haircut!",
    "only": ""
  },
  {
    "t": "{hero} goes shopping for a stronger relic and leaves with a bent spoon!",
    "only": ""
  },
  {
    "t": "A beach episode! (It's crabs.)",
    "only": ""
  },
  {
    "t": "The Merch Machine gets a software update! (The odds are the same.)",
    "only": ""
  },
  {
    "t": "{hero} tries to dash and simply walks!",
    "only": ""
  },
  {
    "t": "King Puff writes a memoir!",
    "only": ""
  },
  {
    "t": "A heartwarming flashback about a lantern!",
    "only": ""
  },
  {
    "t": "{hero} levels up so hard the XP bar needs a second XP bar!",
    "only": ""
  },
  {
    "t": "The power of friendship versus the power of a really big hammer!",
    "only": ""
  },
  {
    "t": "The narrator gets a day off! (Not really.)",
    "only": ""
  },
  {
    "t": "{hero} gets back up! Probably! We haven't written it yet!",
    "only": "D"
  },
  {
    "t": "The plushies throw a victory party! {hero} is not invited!",
    "only": "D"
  },
  {
    "t": "The credits roll... and roll... and there's a post-credits scene!",
    "only": "C"
  },
  {
    "t": "{hero} is crowned champion of {stage}! The crown is a gift box!",
    "only": "C"
  },
  {
    "t": "A mysterious transfer student arrives! It's you! You transferred!",
    "only": ""
  },
  {
    "t": "Truck-kun is spotted near the school! Everyone, please look both ways!",
    "only": ""
  },
  {
    "t": "Senpai almost notices someone! The suspense!",
    "only": ""
  },
  {
    "t": "Magical Girl #47 gets a name! (Postponed to next season.)",
    "only": ""
  },
  {
    "t": "Isekai-kun overdoes it! Again! Shockingly!",
    "only": ""
  },
  {
    "t": "Kuro's arm finally does something! (It itches.)",
    "only": ""
  },
  {
    "t": "Pudding opens a second café! It's also the first café!",
    "only": ""
  },
  {
    "t": "Aoi's mech learns to climb stairs! (One stair.)",
    "only": ""
  },
  {
    "t": "Akane admits something! (She doesn't.)",
    "only": ""
  },
  {
    "t": "The Gingerbread Golem finds a place to live!",
    "only": ""
  },
  {
    "t": "The Student Council passes a motion against running!",
    "only": ""
  },
  {
    "t": "Kraken-chan finally gets her hug!",
    "only": ""
  },
  {
    "t": "The Firework Dragon's encore gets an encore!",
    "only": ""
  },
  {
    "t": "Cancel-sama watches the ratings! Everyone holds their breath!",
    "only": ""
  },
  {
    "t": "Our hero discovers the reroll button was free all along! (It wasn't.)",
    "only": ""
  },
  {
    "t": "The Training Arc board grows a new ring! So does our hero, emotionally!",
    "only": ""
  },
  {
    "t": "A filler episode so good it becomes canon!",
    "only": ""
  },
  {
    "t": "The gacha gods are watching! They are not impressed!",
    "only": ""
  },
  {
    "t": "{hero} vs. the spawn rate: the rematch!",
    "only": ""
  },
  {
    "t": "The combo counter breaks! Our hero sheds a single tear!",
    "only": ""
  },
  {
    "t": "The secret identity of the narrator! (It's the narrator.)",
    "only": ""
  },
  {
    "t": "An episode with no plushies! (A lie.)",
    "only": ""
  },
  {
    "t": "Shocking twist: the bombs were candy all along!",
    "only": ""
  },
  {
    "t": "Everyone goes camping! The tent is a gift box! The campfire is a Candle Wisp!",
    "only": ""
  },
  {
    "t": "{hero} meets their Shadow Clone! They have a lot in common!",
    "only": ""
  },
  {
    "t": "The Plot Hole gets filled! By a bigger plot hole!",
    "only": ""
  },
  {
    "t": "The animators take a nap! Everything is still frames!",
    "only": ""
  },
  {
    "t": "A heartfelt apology from the Hall Monitor! (For nothing. You were running.)",
    "only": ""
  },
  {
    "t": "The Love Letters finally reach Senpai! He doesn't notice them!",
    "only": ""
  },
  {
    "t": "The episode was a dream! Or was it?! (It was.)",
    "only": "D"
  },
  {
    "t": "Season 2 is confirmed! Season 3 is \"being discussed\"!",
    "only": "C"
  },
  {
    "t": "{hero} buys a kotatsu and refuses to leave it! A two-part special!",
    "only": ""
  },
  {
    "t": "The Bubble Tea Cannon runs out of boba! The longest episode yet!",
    "only": ""
  },
  {
    "t": "{hero} beats the game! Then the game beats {hero}! Then {hero} beats it again!",
    "only": ""
  },
  {
    "t": "An emotional reunion with a chest that was left behind in episode 3!",
    "only": ""
  },
  {
    "t": "The truth about the Episode Number! It's just a counter!",
    "only": ""
  },
  {
    "t": "Our hero respawns at the hub, which is canonically a different dimension!",
    "only": "D"
  },
  {
    "t": "The board gets fully bought! (In 140 hours! Stay tuned!)",
    "only": ""
  }
];

/** TO BE CONTINUED subtitles (generic). */
export const DEATH_LINES: readonly string[] = [
  "Our hero has fallen! ...for now!",
  "The plushies win this round. They're very soft winners.",
  "Is this the end?! (It is the end of this run.)",
  "Our hero will return after these messages!",
  "The episode ends on a cliffhanger! The cliffhanger is you, lying down.",
  "Defeated?! In episode {n}?! The fans are furious!",
  "{hero} needs a training montage. Several, actually.",
  "Plot armor not found. Please purchase more on the Training Arc.",
  "That was a dramatic pose. Unfortunately, it was a lying-down pose.",
  "Survived {time}! That's almost a whole opening theme!"
];

/** Boss-specific death subtitles (by boss display name). */
export const BOSS_DEATH_LINES: Readonly<Record<string, string>> = {
  "King Puff": "Squished by royalty. An honour, technically.",
  "Nightmare Teddy": "Should've checked under the bed.",
  "Lady Lunatic": "The moon was too beautiful. Also too pointy.",
  "Gingerbread Golem": "Crumbled before the golem did.",
  "Sugar Plum Tyrant": "Sugar crash. Yours, not hers.",
  "Student Council President": "Your permanent record now says DEFEATED.",
  "The Bishounen": "He didn't even notice he won.",
  "The Bishounen Who Never Notices You": "He didn't even notice he won.",
  "Kraken-chan": "She hugged too hard.",
  "Firework Dragon": "You were the main event.",
  "Truck-kun": "ISEKAI'D. Please enjoy your next life.",
  "Rival-chan": "She'll never let you forget this. Ever.",
  "Cancel-sama": "Cancelled. (The run. Not the show. Probably.)"
};

export const SPEEDRUN_DEATH = "World record? World record.";

/** Loading / hub tips. */
export const TIPS: readonly string[] = [
  "Tip: Dashing makes you invulnerable. Hall Monitors would like you to stop.",
  "Tip: The Overdrive button glows rainbow when it's ready. It's been ready. Press it.",
  "Tip: Evolutions need a weapon at Lv5 and its partner passive. Love is a recipe.",
  "Tip: Elites have rainbow outlines. Unless the studio changed. Then good luck.",
  "Tip: Chests prioritise evolutions. Chests are better at this game than you.",
  "Tip: Combo ranks multiply XP. Combo ranks do not multiply self-esteem.",
  "Tip: Standing still deploys the Kotatsu. Standing still too long deploys a nap.",
  "Tip: Every run pays out, even a 90-second one. Especially a 90-second one, emotionally.",
  "Tip: The Training Arc board is pannable. So is your future.",
  "Tip: Respeccing talents costs coins. Regret is free.",
  "Tip: Plot Twists add heat. Heat adds rewards. Rewards add more heat. That's the cycle.",
  "Tip: The gacha has pity. The plushies do not.",
  "Tip: Dream Gems are \"definitely not premium currency\". We said \"definitely\".",
  "Tip: Copium is earned from every pull. Please consume responsibly.",
  "Tip: Senpai will not notice you. This is not a bug.",
  "Tip: Magical Girl #47 is a real character. Probably. Check the roster.",
  "Tip: Truck-kun is playable. Truck-kun is always playable. Truck-kun is coming.",
  "Tip: The Bishounen boss never aims at you in phase one. Unless you're in the way. You're always in the way.",
  "Tip: Gingerbread Golem's Cookie Cutter outlines a person. Do not be that person.",
  "Tip: Lollipop Mages heal their friends. Be a bad friend first.",
  "Tip: Watermelons split when defeated. So do some friend groups.",
  "Tip: Seagulls steal pickups. Seagulls cannot be reasoned with.",
  "Tip: Plot Holes eat gems. Kill them and they give the gems back. Plot holes are fair, at least.",
  "Tip: Shadow Clones dash when you dash. Have you considered not dashing?",
  "Tip: Cancel-sama's \"Budget Cuts\" phase halves the resolution. Your skills remain full HD.",
  "Tip: Weapon mastery Limit Breaks your weapon to Lv7. Seven is a very anime number.",
  "Tip: Hero levels give talent points. Talent points give talent. Mostly.",
  "Tip: The \"I have regrets\" button in the gacha does nothing. Much like regret.",
  "Tip: You can export your save in Settings. Your save cannot export you.",
  "Tip: \"Reduce flashing\" tones down every dramatic effect. The drama stays. It's internal now.",
  "Tip: The Filler Arc lets you keep going after a clear. The plot does not.",
  "Tip: Banishing a card removes it from the run. Banishing feelings is not supported.",
  "Tip: Bubble Tea Cannon pearls bounce between enemies. The tapioca is load-bearing.",
  "Tip: Paper Crane Flock cranes get stronger with every kill, until you get hit. Then they're sad.",
  "Tip: The Idol Lightstick waves land on the beat. Bobbing your head is optional but encouraged.",
  "Tip: Kuro's flames are orange. You didn't hear it from us.",
  "Tip: Pudding's tea puddles heal you. Do not drink from the floor in real life.",
  "Tip: Isekai-kun overdoes it every fifth fireball. He is very sorry. He is not sorry.",
  "Tip: The fine print is very long. There is something at the bottom. It's nothing. (It's an achievement.)",
  "Tip: Losing the 50/50 guarantees the next one. The trombone is guaranteed too.",
  "Tip: The episode counter never resets. Neither does the narrator.",
  "Tip: No plushie has ever been harmed. They pop into confetti. That's different."
];

/** Results grade comments. */
export const GRADE_COMMENTS: Readonly<Record<string, readonly string[]>> = {
  "D": [
    "Participation trophy unlocked! (Not really.)",
    "It's a D. D for 'Developing'!",
    "The plushies send their regards.",
    "Every legend starts somewhere. This is the somewhere."
  ],
  "C": [
    "C is for 'Could be worse'!",
    "A respectable filler episode.",
    "The critics called it 'fine'.",
    "Middle of the road. The road is full of plushies."
  ],
  "B": [
    "B for 'Better than C'!",
    "A solid episode! Fans are cautiously optimistic.",
    "Nice! The animators only cried a little.",
    "That had a plot AND explosions!"
  ],
  "A": [
    "A-rank! The narrator is proud of you!",
    "An excellent episode! Clip it!",
    "Fans are calling it 'peak'!",
    "The budget was well spent!"
  ],
  "S": [
    "S-RANK!! Main character behaviour!",
    "Sakuga from start to finish!",
    "This episode will be in the opening montage!",
    "The studio is putting this one on the poster!"
  ],
  "SS": [
    "SS-RANK?! Is that even legal?!",
    "The fans are rioting (positively)!",
    "Flawless! The narrator needs a moment!",
    "This episode has been nominated for awards that don't exist!"
  ]
};

/** Narrator caption lines (satire.md §1): in-run moments (src/ui/narrator.ts), results and hub. */
export const NARRATOR: Readonly<Record<string, readonly string[]>> = {
  "runStart": [
    "Our hero steps into {stage}. The plushies are restless.",
    "Previously on Kira Kira Overdrive: you died. Let's see if that changes.",
    "Episode {n}! Will {hero} finally make it to the end? (Statistically, no.)",
    "Tonight's episode is brought to you by: your own determination.",
    "Last time, our hero learned nothing. This time, they will learn... something.",
    "{hero} has prepared for this moment. {hero} has not prepared for this moment."
  ],
  "firstLevel": [
    "Our hero has grown! Narratively!",
    "Power-up get! The animators are thrilled.",
    "Level up! The montage music swells."
  ],
  "firstEvo": [
    "EVOLUTION! The budget for this episode has been spent.",
    "{weapon} has evolved! Merchandise sales are up 400%!",
    "A glow-up! Somewhere, a toy company rejoices."
  ],
  "bossWarn": [
    "Uh oh. That music means a boss.",
    "This is the part of the episode where the villain arrives.",
    "Brace yourself! Here comes the mid-season antagonist!",
    "The ground shakes. The budget shakes harder."
  ],
  "lowHp": [
    "Is this... the end of our hero?!",
    "Oh no! Not like this! Not before the opening theme!",
    "Our hero is in danger! Quick, someone cue the flashback!"
  ],
  "revive": [
    "AND WE'RE BACK FROM THE BREAK!",
    "Plot armor: activated!",
    "Nobody stays down in this show. It's in the contract."
  ],
  "ult": [
    "Here it comes — the attack name!",
    "Everybody shout it with them!"
  ],
  "finalBoss": [
    "The season finale! Everything has led to this!",
    "This is it! The last boss! (Of this stage!)"
  ],
  "bossDown": [
    "{boss} has been defeated! They'll be back in the movie.",
    "Victory! {boss} will have a redemption arc in season 3.",
    "{boss} is down! The fans are already writing fanfic."
  ],
  "clear": [
    "SERIES FINALE?! No — just the stage finale!",
    "And so, {stage} is saved! Until the sequel!",
    "The credits roll! Don't skip them! (You can skip them.)"
  ],
  "filler": [
    "But wait — the network ordered more episodes!",
    "TO BE CONTINUED... IN THE FILLER ARC!"
  ],
  "unlock": [
    "A new character joins the cast! Ratings are up!",
    "New merchandise has been approved!"
  ],
  "unlockHero": [
    "A new character joins the cast! Ratings are up!",
    "A new face in the opening credits! The fandom is already shipping them."
  ],
  "unlockWeapon": [
    "New merchandise has been approved!",
    "A new weapon! The toy line writes itself.",
    "The prop department has outdone itself. Again."
  ],
  "unlockPassive": [
    "(It's an accessory.)",
    "An accessory! Sold separately. (It's free.)"
  ],
  "unlockRelic": [
    "New merch in the gift shop! Totally optional.",
    "Limited edition! (Unlimited copies available.)"
  ],
  "unlockTwist": [
    "The network has notes. More heat, more rewards.",
    "A plot twist! The writers swear they planned this."
  ],
  "unlockStage": [
    "A new episode is airing! The network is thrilled!",
    "New location! The background artists need a vacation."
  ],
  "unlockMany": [
    "That's a lot of plot for one episode.",
    "The season budget, spent in one go."
  ],
  "run100": [
    "Episode 100! The show has outlived its source material!"
  ]
};

/** Title-screen taglines (one per boot). */
export const TAGLINES: readonly string[] = [
  "Now with 400% more episodes!",
  "Now With Merch!",
  "As seen on a screen near you!",
  "Rated K for Kawaii",
  "The plushies are back (they never left)"
];

/** Kira Kira Wiki blurbs by display name. */
export const WIKI: Readonly<Record<string, { trope: string; text: string; trivia: string }>> = {
  "Puff": {
    "trope": "The Slime Is Always First",
    "text": "A cheerful mint slime and the first enemy every hero meets. Hops toward you with tremendous enthusiasm and zero strategy.",
    "trivia": "the leaf on its head is decorative; it has asked us to stop asking."
  },
  "Batbun": {
    "trope": "Fodder With Wings",
    "text": "Half bunny, half bat, fully committed to flying straight into your weapons. Swarm events are their idea of a group project.",
    "trivia": "the ears are for steering. They do not steer."
  },
  "Boo": {
    "trope": "The Shy Ghost",
    "text": "Wobbles toward you on a sine wave, blushes, and says \"boo\" quietly. Flickers when nervous, which is always.",
    "trivia": "has never once scared anyone. Keeps trying."
  },
  "Shroomie": {
    "trope": "Splitting Enemy",
    "text": "A grumpy mushroom that splits into two Spores when defeated, out of spite.",
    "trivia": "the spots are not polka dots. Do not call them polka dots."
  },
  "Spore": {
    "trope": "Mini Me",
    "text": "Tiny, fast, furious, and very proud of being a Shroomie's whole legacy.",
    "trivia": "dreams of becoming a Shroomie. Never does."
  },
  "Teddy Brute": {
    "trope": "The Tank",
    "text": "A stitched-up teddy that walks slowly, hits hard and shrugs off knockback. Only wants a hug. Delivers it at speed.",
    "trivia": "the button eye was a gift from Nightmare Teddy."
  },
  "Eyepuff": {
    "trope": "The Floating Eye",
    "text": "A fluffball with one enormous anime eye that keeps its distance and fires glowing orbs.",
    "trivia": "blinks when it's about to shoot. Thinks you haven't noticed."
  },
  "Pumpkin Dasher": {
    "trope": "The Charger",
    "text": "Telegraphs its dash with a shake and a red flash, then commits to it completely. Skids. Every time.",
    "trivia": "has never once turned mid-dash. Considers it cheating."
  },
  "Candle Wisp": {
    "trope": "Kamikaze Mook",
    "text": "A tiny flame that rushes you and explodes. Its blast hurts other plushies too, which it considers a bonus.",
    "trivia": "the wax body is scented. The scent is \"regret\"."
  },
  "Gummy Bear": {
    "trope": "Palette-Swap Squad",
    "text": "Comes in four flavours and one personality: chewy. Boings back toward you after being knocked away.",
    "trivia": "the clear ones are \"mystery flavour\". The mystery is sadness."
  },
  "Candy Corn Soldier": {
    "trope": "Faceless Army (With Faces)",
    "text": "Marches in formation and blocks shots from the front while its squad holds together. Break the formation, break the wall.",
    "trivia": "controversial among the kingdom's citizens. Loyal anyway."
  },
  "Donut Roller": {
    "trope": "The Rolling Hazard",
    "text": "Spins up, then rolls in a straight line, bouncing off the edge of the world once.",
    "trivia": "strawberry frosting. Always strawberry. Don't ask about the chocolate ones."
  },
  "Marshmallow Brute": {
    "trope": "Big Soft Guy",
    "text": "Heavy, slow and squishy. Fire toasts it: faster, angrier, and much easier to defeat.",
    "trivia": "the Toasty form is considered its \"true form\" by fans. It disagrees."
  },
  "Lollipop Mage": {
    "trope": "The Healer Goes First",
    "text": "Shoots curving candy and, every third cast, heals its sugary allies. Priority target.",
    "trivia": "the hat is a lollipop. The staff is a lollipop. The mage is not a lollipop. We think."
  },
  "Hall Monitor": {
    "trope": "Disciplinary Committee",
    "text": "Ignores you until you dash nearby, then blows its whistle and charges.",
    "trivia": "has written 4,000 tardy slips. 3,999 were for Batbuns."
  },
  "Love Letter": {
    "trope": "Confession Scene",
    "text": "Flaps toward you like a tiny paper bird. Sometimes bursts into persistent paper hearts when \"rejected\".",
    "trivia": "every letter is addressed to Senpai. None have arrived."
  },
  "Tsundere Slime": {
    "trope": "Tsundere",
    "text": "Gets hit, flees in embarrassment, then charges back faster (\"B-baka!\").",
    "trivia": "the tiny drills are a tribute. Akane has not commented. Akane is furious."
  },
  "Transfer Student": {
    "trope": "The Mysterious Transfer Student",
    "text": "Never walks in; simply appears next to you with a sparkle and a dramatic scarf. Blinks around at regular intervals.",
    "trivia": "has transferred schools 47 times this season."
  },
  "Exam Paper": {
    "trope": "Test Anxiety",
    "text": "Flutters toward you and, on contact, lowers your grade (and your XP gain).",
    "trivia": "the F- is not a typo. The minus was earned."
  },
  "Student Council Ninja": {
    "trope": "The Council's Shadow Squad",
    "text": "Keeps its distance, throws shuriken, and smoke-bombs behind you if you get close.",
    "trivia": "the ninja club is officially a \"stationery appreciation society\"."
  },
  "Crab-kun": {
    "trope": "The Beach Episode Mascot",
    "text": "Only moves sideways, strafes around you, lunges when lined up and occasionally sidesteps a projectile.",
    "trivia": "the \"-kun\" was self-applied."
  },
  "Seagull": {
    "trope": "Food Thief",
    "text": "Circles, dives, and steals coins and snacks off the ground. Defeat it before it leaves to get them back.",
    "trivia": "has stolen 14,000 fries in its lifetime. There are no fries in this game."
  },
  "Jellyfish": {
    "trope": "Environmental Hazard",
    "text": "Drifts lazily and zaps the area around it every few seconds. When one goes down, nearby jellyfish feel it.",
    "trivia": "has no brain. Still has more strategy than the Batbuns."
  },
  "Watermelon": {
    "trope": "Splits on Death",
    "text": "Rolls at you, then splits into two angry halves that spit seeds.",
    "trivia": "wears a sun hat for sun safety. Respect that."
  },
  "Watermelon Half": {
    "trope": "The Second Phase",
    "text": "Half a melon, full of rage and seeds.",
    "trivia": "does not get along with the other half."
  },
  "Sandcastle Golem": {
    "trope": "It Rebuilds Itself",
    "text": "A tanky castle that rebuilds from its own sand pile unless you stomp the pile or blast it.",
    "trivia": "has a moat. The moat is decorative. The moat is also a puddle."
  },
  "Tiny Shark": {
    "trope": "Fin in the Water (Sand)",
    "text": "Moves as just a fin, invisible to homing weapons, then surfaces with a \"!\" to chomp.",
    "trivia": "is a baby. Is very proud of its three teeth."
  },
  "Shadow Clone": {
    "trope": "Dark Mirror",
    "text": "A dark copy of you with glowing red eyes that dashes whenever you do.",
    "trivia": "has your exact build, minus the personality."
  },
  "Filler Episode Goon": {
    "trope": "Recycled Animation",
    "text": "Interchangeable henchmen who all move on the same frame, and sometimes come back next episode.",
    "trivia": "has no lines in the script. Has asked for one. Was denied."
  },
  "Plot Hole": {
    "trope": "Plot Hole",
    "text": "A swirling tear in the storyboard that pulls you in and eats your gems and projectiles. Fill it to get the gems back.",
    "trivia": "nobody knows how it got there. That's the point."
  },
  "Animation Error": {
    "trope": "Off-Model",
    "text": "A badly drawn enemy that teleports in jerky frame-skips, with a hitbox smaller than its sprite. Leaves dropped frames behind.",
    "trivia": "fans have petitioned to make it canon. It is now canon."
  },
  "Mini Truck-kun": {
    "trope": "Running Gag",
    "text": "Telegraphs a lane, honks, and drives through it, flattening friend and foe alike.",
    "trivia": "Truck-kun's nephew. Learning the family business."
  },
  "Rival (Recolour)": {
    "trope": "Evil Recolour",
    "text": "Another hero with the colours swapped to red, sent by the Shounen Rival twist to \"test your resolve\".",
    "trivia": "the recolour was done in a hurry. You can tell."
  },
  "King Puff": {
    "trope": "The Tutorial Boss",
    "text": "The ruler of the Squish Kingdom: hops, jumps, slams, summons. Wears a crown and a moustache. Both are real.",
    "trivia": "has been the first boss in every season. Considers it seniority."
  },
  "Nightmare Teddy": {
    "trope": "Corrupted Cute Thing",
    "text": "A huge ragged teddy with glowing stitches, charges, claw sweeps and star rings, angrier at half health.",
    "trivia": "has not slept since episode 1. It shows."
  },
  "Lady Lunatic": {
    "trope": "The Elegant Final Boss",
    "text": "Queen of the Endless Night: moon spirals, teleports, and a third phase that dims the whole world.",
    "trivia": "refers to the sunrise as \"the incident\"."
  },
  "Gingerbread Golem": {
    "trope": "Living Construct",
    "text": "A gingerbread giant that stamps gingerbread-man-shaped attacks around you and loses a leg at half health.",
    "trivia": "was supposed to be a house. Has not processed this."
  },
  "Sugar Plum Tyrant": {
    "trope": "The Sugar High Villain",
    "text": "Pirouettes bullets, commands candy armies, and alternates sugar highs with sugar crashes. Strike during the crash.",
    "trivia": "has eaten nine desserts today. It's 10 a.m."
  },
  "Student Council President": {
    "trope": "The Iron-Fisted President",
    "text": "Stamps DENIED, glares lasers through her glasses and enforces School Regulations that change the rules of the fight.",
    "trivia": "Rule 21 is the only kind rule. She wrote it when she was tired."
  },
  "The Bishounen Who Never Notices You": {
    "trope": "Unattainable Senpai",
    "text": "Never aims at you — until his final phase, when he finally notices you and the whole world turns into a shoujo panel.",
    "trivia": "Fan club membership: 9,999. You applied. You were waitlisted."
  },
  "Kraken-chan": {
    "trope": "The Misunderstood Monster",
    "text": "A round, friendly octopus who slams tentacles, sprays ink and floods the arena — all because she wants a hug.",
    "trivia": "finally gets one in her defeat scene. From a crab."
  },
  "Summer Festival Firework Dragon": {
    "trope": "The Festival Finale",
    "text": "A paper-lantern dragon made of fireworks that turns the night sky into a bullet show.",
    "trivia": "has accidentally started the finale early every year."
  },
  "Truck-kun": {
    "trope": "Truck-kun",
    "text": "The legendary isekai truck. Changes lanes, backs up beeping, scatters traffic cones and brings friends at rush hour.",
    "trivia": "is also playable. Do not ask how. It finds a way."
  },
  "Rival-chan": {
    "trope": "The Shounen Rival",
    "text": "Has been your rival since episode 1; you do not remember her. Dashes, beams, a mid-fight training montage and a final beam clash.",
    "trivia": "she remembers every one of your 47 encounters. You remember none."
  },
  "CANCEL-SAMA, the Network Executive": {
    "trope": "Executive Meddling",
    "text": "The series finale boss: a suit with a TV for a head who drops the ratings, cuts the budget and rushes the ending — and the game degrades with every phase.",
    "trivia": "has never watched an episode. Has notes on all of them."
  }
};

/** OC "DeviantArt profile" bios by hero id (first line = the sparkly name header). */
export const BIOS: Readonly<Record<string, string>> = {
  "hoshi": "~*~☆ HOSHI ☆~*~  ~ my FIRST oc!!! ~\nFull name: Hoshi Kirameki (Kirameki means sparkle!! i looked it up)\nAge: 14\nHeight: 148 cm (163 cm with hair) (171 cm with hair AND star clips)\nLikes: stars, strawberry milk, shouting the name of her attacks, pink, MORE pink\nDislikes: cloudy nights, people who say pink and magenta are the same colour, homework\nPower level: ★★★★★★★★☆☆ (8/10) (10/10 after strawberry milk)\nTheme song: \"Starlight☆Overdrive (Nightcore Remix) (Sped Up)\"\nPersonality: SUPER genki!!! but she also has a dark side (once stayed up until 10:30pm)\nFun fact: her wand is made from a real star (it is not)\nDO NOT STEAL!! DO NOT REPOST!! Hoshi is MY OC!!! fanart ok if u credit me (◕‿◕✿)",
  "rin": "~*~ RIN ~*~  [ shrine maiden ] [ swordswoman ] [ cool ]\nFull name: Rin Kagura\nAge: 16\nHeight: 158 cm (171 cm with ponytail)\nLikes: green tea, a sharp blade, a sharp cup of tea, silence, more silence\nDislikes: being called \"Rin-chan\", dull swords, small talk, LOUD people (Hoshi)\nPower level: \"Sufficient.\"\nTheme song: \"Crimson Blossom Requiem (8-bit Cover) (Extended Mix) (Final) (Final2)\"\nPersonality: cool and mysterious (she practises in the mirror)\nFun fact: her katana has a name but she will not tell you. It's \"Katana-chan.\"\nDO NOT STEAL!!! i will know. Rin will know. ⚔(｀・ω・´)",
  "mochi": "~*~=^.^= MOCHI =^.^=~*~\nFull name: Mochi (just Mochi) (she is a cat girl she doesn't need a last name)\nAge: 13\nHeight: 139 cm (151 cm with ears)\nLikes: naps, boxes, yarn, knocking things off tables while making eye contact\nDislikes: baths, cucumbers (startling), the vacuum, closed doors, open doors\nPower level: nya/10\nTheme song: \"Nyan Nyan Daydream (1 Hour Loop) (Purring Edition)\"\nPersonality: sleepy → ZOOMIES → sleepy (repeat)\nFun fact: has been in exactly one fight with a laser pointer. she lost.\nDO NOT STEAL!! mochi is MY oc and also my cat's name (the cat did not consent) (=^･ω･^=)",
  "kuro": "~*~†† KURO ††~*~  \"Lord of the Abyssal Flame\" (true name: CLASSIFIED) (it's Kuroda Haruki)\nAge: 14\nHeight: 152 cm (164 cm with hair) (159 cm with cape collar) (sealed form)\nLikes: the darkness, black coffee (6 sugars), bandages, his dragon Ragnarok, Scourge of the Seventh Abyss\nDislikes: the sun, his sealed arm acting up during P.E., his mum calling him \"Haru-kun\" in public\nPower level: UNMEASURABLE (the school nurse's scale broke) (it was already broken)\nTheme song: \"Requiem of the Abyssal Flame ~Eternal Darkness Ver.~ (piano cover by me)\"\nPersonality: dark. mysterious. edgy. secretly volunteers at the animal shelter every Sunday\nFun fact: the dragon is a salamander. the flames are orange. do NOT tell him.\nDO NOT STEAL!!! stealing my OC will awaken the seal. you have been WARNED. ( ` ω ´ )",
  "pudding": "~*~♡ PUDDING ♡~*~  ~Head Maid of Café Purin Purin~ (not a real café) (yet)\nAge: 19\nHeight: 155 cm (168 cm with buns and headdress)\nLikes: caramel, a perfectly wobbly custard, saying \"Welcome home!\", polishing spoons until she can see her future\nDislikes: dropped trays, customers who don't say \"moe moe kyun\" back, the dishwasher (it knows what it did)\nPower level: Customer satisfaction 100% (one review said 99%. she remembers.)\nTheme song: \"Welcome Home, Master~♡ (Café BGM Vol. 3) (Extended Lunch Rush Ver.)\"\nPersonality: sweet, patient, terrifyingly efficient\nFun fact: has served omurice to a boss mid-fight. it left a 5-star review.\nDO NOT STEAL!! pudding belongs to me and Café Purin Purin ☆ please tip ur maids (*´▽`*)",
  "aoi": "~*~ AOI ~*~  PILOT CALLSIGN: \"BLUEBERRY\" (she did not choose it)\nAge: 12\nHeight: 131 cm (136 cm with hair) (219 cm in the mech) (the mech counts)\nLikes: giant robots, screwdrivers, juice boxes, shouting the name of every mech part\nDislikes: being told she's too young to pilot (she has a LICENSE) (since Tuesday), stairs (the mech can't)\nPower level: 1 (ONE) GIANT FIST\nTheme song: \"Hot-Blooded Engine ☆ GO! GO! GO! (Instrumental) (Remastered 2009)\"\nPersonality: loud. louder in the mech. the mech has a speaker.\nFun fact: the mech is called \"Unit-Aoi Mk. II\". Mk. I was a cardboard box. she misses it.\nDO NOT STEAL!!! the mech design is 100% ORIGINAL i drew it myself (it's a trash can with legs) (ง •̀_•́)ง",
  "akane": "~*~ AKANE ~*~  (the drills are NATURAL)\nFull name: Akane Tenjouin (of the Tenjouin family) (you've heard of them) (you haven't)\nAge: 16\nHeight: 154 cm (182 cm with drills) (drills sold seperately [sic])\nLikes: tea parties, winning, her drills, NOT you, definitely not you\nDislikes: losing, people touching the drills, admitting things, the word \"cute\"\nPower level: obviously higher than YOURS\nTheme song: \"It's Not Like This Is My Theme Song or Anything!! (Orchestral Ver.)\"\nPersonality: tsundere (she says she isn't) (she is)\nFun fact: the harisen was a birthday gift. she pretends she bought it herself.\nDO NOT STEAL!!! n-not that anyone would WANT to steal her or anything... b-baka!! (｀へ´)",
  "senpai": "~*~✧ SENPAI ✧~*~  [LIMITED SSR] (real name: unknown) (nobody has ever asked)\nAge: 18\nHeight: 178 cm (183 cm with hair) (sparkles not included in the measurement)\nLikes: windy rooftops, roses, gazing meaningfully into the middle distance\nDislikes: noticing things, wilted roses, the camera catching him before the dramatic angle\nPower level: ✧✧✧✧✧ (5 sparkles) (sparkles are the unit)\nTheme song: \"Petals on the Wind ~Rooftop Ver.~ (Slowed + Reverb) (10 Hours)\"\nPersonality: aloof. elegant. has never once looked directly at anyone.\nFun fact: the wind follows him indoors. nobody knows where it comes from.\nDO NOT STEAL!!! senpai is LIMITED do not repost without credit (ﾉ´ヮ`)ﾉ*: ･ﾟ✧",
  "magical_girl_47": "~*~ Magical Girl #47 ~*~  (name pending) (name was also pending last season)\nAge: 15\nHeight: 150 cm (152 cm with hair) (it's very sensible hair)\nLikes: helping!!, plain rice, being included, the colour mint (NOT pink, that's the other one)\nDislikes: roll call, name tags falling off, being called \"uh, you there\"\nPower level: average (perfectly) (+5% to all)\nTheme song: \"Magical ☆ Something ☆ Song (Opening Theme #47) (TV Size)\"\nPersonality: kind, hardworking, slightly see-through in group shots\nFun fact: her catchphrase is \"...\". she's still workshopping it.\nDO NOT STEAL!! please. please someone NOTICE her first. then don't steal. (・_・;)",
  "isekai_kun": "~*~ Isekai-kun ~*~  (Reincarnated Lv.1 → Lv.9999 in 3 days) (he didn't even try)\nAge: 17 (also 17 in his previous life, he checked)\nHeight: 170 cm (170 cm with hair) (his hair has no volume)\nLikes: nothing in particular, plain bread, being surprised by his own power\nDislikes: nothing in particular, attention (he says, while receiving all of it)\nPower level: \"Huh? Is 9,999,999 a lot?\"\nTheme song: \"Ordinary Days in Another World (Chill Mix) (Extended) (He Overdid the Mix)\"\nPersonality: ordinary. very ordinary. painfully, cosmically ordinary.\nFun fact: died once. would not recommend. would recommend the truck.\nDO NOT STEAL!!! he's very relatable and that makes him MINE ( ˘・з・)",
  "truck_kun": "~*~ TRUCK-KUN ~*~  (registered as: Light-Duty Cab-Over Delivery Truck)\nAge: Model Year 2009\nHeight: 2.1 m (2.1 m with hair) (it has no hair)\nLikes: honking, the open road, green lights, sending people to better places\nDislikes: speed bumps, parking tickets, being blamed (it was ALWAYS just doing its job)\nPower level: 4.5 tonnes\nTheme song: \"Express Lane to Another World (Honk Remix) (Hazard Lights Ver.)\"\nPersonality: HONK\nFun fact: has a 100% customer satisfaction rate. none of the customers came back to complain.\nDO NOT STEAL!!!! (it's a truck. you can't. it's 4.5 tonnes. it has an alarm.) ┌(ﾟдﾟ)┘ HONK"
};

/** Merch Machine copy. */
export const LOST_5050: readonly string[] = [
  "LOST THE 50/50. The featured hero waves at you from the banner.",
  "LOST THE 50/50. Have you considered: it builds character?",
  "LOST THE 50/50. Next one's guaranteed. Probably. (Definitely. It's in the code.)",
  "LOST THE 50/50. The trombone player has been waiting all day for this.",
  "LOST THE 50/50. It's okay. Senpai didn't notice you either.",
  "LOST THE 50/50. Statistically, this was a coin flip. Emotionally, it was a betrayal.",
  "LOST THE 50/50. Please hold. Your guarantee is important to us.",
  "LOST THE 50/50. The relic you got instead would like you to know it has feelings.",
  "LOST THE 50/50. Fun fact: the 50/50 is 50/50.",
  "LOST THE 50/50. Truck-kun saw that. Truck-kun is sorry.",
  "LOST THE 50/50. Remember: Copium is a renewable resource.",
  "LOST THE 50/50. This toast will self-destruct in 3... 2... (it won't)."
];
export const WON_5050: readonly string[] = [
  "WON THE 50/50!! Don't tell the others.",
  "WON THE 50/50! The trombone player goes home early."
];
export const SUMMON_CAPTIONS: readonly string[] = [
  "The Merch Machine hums ominously.",
  "Somewhere, a pity counter ticks.",
  "This\nis the one. (Narrator has said this 400 times.)",
  "Ten pulls. Ten dreams. Nine\nN's, probably.",
  "The capsule is warm. That's a good sign. It is not a sign.",
  "Our hero spends gems they earned honestly.",
  "Previously on the Merch Machine:\nan N.",
  "Hold the crank with both hands. It doesn't help. It looks cool.",
  "The crank turns. Destiny\nturns with it. Slightly.",
  "Narrator is not allowed to pull. Narrator is very\njealous."
];
export const RARITY_SUBTITLES: Readonly<Record<string, readonly string[]>> = {
  "N": [
    "It's... merchandise.",
    "Technically an item.",
    "Character building!",
    "Someone has to pull these."
  ],
  "R": [
    "Rarer than N. That's the bar.",
    "A respectable pull.",
    "Mum would be proud. Mildly."
  ],
  "SR": [
    "Super! Rare! (Super Common Actually)",
    "A little sparkle.",
    "The purple meteor remembers you."
  ],
  "SSR": [
    "THE GOLD HAS CHOSEN YOU",
    "This is your main character moment.",
    "Somewhere, a pity counter weeps."
  ],
  "UR": [
    "THE RAINBOW HAS DESCENDED",
    "Scientists Baffled By This Pull",
    "Screenshot this. Now."
  ],
  "LR": [
    "Historians Will Write About This Pull",
    "The Prophecy Was True (There Was a Prophecy?)",
    "Your Ancestors Are Cheering"
  ],
  "MYTHIC": [
    "YOU HAVE BROKEN THE GAME",
    "THIS WAS NOT SUPPOSED TO HAPPEN",
    "The Merch Machine Requires a Moment"
  ]
};
