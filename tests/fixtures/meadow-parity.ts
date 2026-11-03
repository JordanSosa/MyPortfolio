// FROZEN REFERENCE (tests only): Dream Meadow run fingerprints produced by the shipped slice BEFORE the
// Season 2 stage / RunConfig refactor (same seeds, same bot). tests/stages.test.ts replays them through the
// stage-driven sim: same seed -> the same run, step for step. If a future balance pass changes Dream Meadow on
// purpose, regenerate these lines with the generator in tests/stages.test.ts (fingerprint()).
export const MEADOW_PARITY: readonly string[] = [
  "hoshi|1|200|200.033|play|1732|13|1425.189|781.053|53|27|56|star_shot:16617,supernova_shower:14631,candy_bomb:6543,heart_boomerang:5772,bubble_aura:1750|wave:swarm@105.03 spawn:king_puff@183.03",
  "rin|2|200|200.033|play|1682|14|-1397.419|454.399|60|41|8|thousand_blossom_cut:32581,star_shot:26493,petal_slash:8004,yarn_orbit:1895|wave:swarm@105.03 spawn:king_puff@183.03",
  "mochi|3|200|200.033|play|2299|19|1300.586|471.437|38|52|14|raijin_drum:86426,nyan_stampede:29267,yarn_orbit:3203,bubble_aura:2278|wave:swarm@105.03 spawn:king_puff@183.03",
  "hoshi|7|700|581.300|victory|21228|42|-30.997|-2155.245|0|405|0|galaxy_barrage:1771020,raijin_drum:1509692,love_tornado:973556,sakura_tempest:99756,supernova_shower:85888,bubble_aura:0|wave:swarm@105.03 spawn:king_puff@183.03 kill:KING PUFF@189.43 wave:encircle@240.03 wave:flood@330.00 spawn:nightmare_teddy@363.00 kill:NIGHTMARE TEDDY@374.03 wave:encircle@420.00 wave:storm@450.00 wave:wisps@495.00 spawn:lady_lunatic@543.00 kill:LADY LUNATIC@581.30",
];
