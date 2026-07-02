// Mob species and spawn clusters. Numeric stats are derived in systems/combat
// from level + these multipliers.

export const SPECIES = {
  puffling: {
    id: "puffling", name: "Puffling", lvl: [1, 2], aggressive: false,
    hpMult: 0.8, dmgMult: 0.7, xpMult: 1, speed: 3.2, size: 0.7,
    shape: "puff", color: 0xf7c8dc, accent: 0xf49ac1,
    resists: {}, dropTier: 1,
  },
  boar: {
    id: "boar", name: "Bristleback Boar", lvl: [3, 5], aggressive: false,
    hpMult: 1.2, dmgMult: 1.0, xpMult: 1.1, speed: 4.5, size: 1.0,
    shape: "boar", color: 0x9c6b4b, accent: 0x6e4830,
    resists: { phys: 10 }, dropTier: 1, questDrop: "boar_hide",
  },
  sporeling: {
    id: "sporeling", name: "Sporeling", lvl: [6, 8], aggressive: false,
    hpMult: 0.9, dmgMult: 0.9, xpMult: 1, speed: 2.8, size: 0.8,
    shape: "shroom", color: 0xb7e07d, accent: 0x87b04f,
    resists: { cold: 20 }, dropTier: 2,
  },
  shambler: {
    id: "shambler", name: "Fungal Shambler", lvl: [8, 10], aggressive: true,
    hpMult: 1.6, dmgMult: 1.1, xpMult: 1.3, speed: 2.6, size: 1.35,
    shape: "shroom", color: 0x7d9e5a, accent: 0x4f6e38,
    resists: { cold: 20, phys: 10 }, dropTier: 2,
  },
  gloomwisp: {
    id: "gloomwisp", name: "Gloomwisp", lvl: [10, 12], aggressive: true,
    hpMult: 0.8, dmgMult: 1.3, xpMult: 1.2, speed: 4.2, size: 0.6,
    shape: "wisp", color: 0x9fd7e8, accent: 0x5db9d6, ranged: true, element: "cold",
    resists: { cold: 40, phys: -10 }, dropTier: 2,
  },
  raider: {
    id: "raider", name: "Duskfang Raider", lvl: [13, 15], aggressive: true,
    hpMult: 1.5, dmgMult: 1.3, xpMult: 1.4, speed: 4.8, size: 1.1,
    shape: "humanoid", color: 0x5f5470, accent: 0xb04a5a,
    resists: { phys: 15 }, dropTier: 3,
  },
  mystic: {
    id: "mystic", name: "Duskfang Mystic", lvl: [15, 17], aggressive: true,
    hpMult: 1.1, dmgMult: 1.5, xpMult: 1.5, speed: 3.6, size: 1.05,
    shape: "humanoid", color: 0x4a3f63, accent: 0x8f5cc7, ranged: true, element: "fire",
    resists: { fire: 30 }, dropTier: 3,
  },
  duskfang_add: {
    id: "duskfang_add", name: "Duskfang Whelp", lvl: [18, 18], aggressive: true,
    hpMult: 0.6, dmgMult: 0.9, xpMult: 0.5, speed: 5.2, size: 0.75,
    shape: "humanoid", color: 0x6a5a7a, accent: 0xc06a7a,
    resists: {}, dropTier: 3, noRespawn: true,
  },
  grulmok: {
    id: "grulmok", name: "Grulmok, Duskfang Alpha", lvl: [20, 20], aggressive: true,
    hpMult: 14, dmgMult: 2.2, xpMult: 30, speed: 4.2, size: 2.6,
    shape: "humanoid", color: 0x3d3450, accent: 0xd44a4a, boss: true,
    resists: { phys: 20, fire: 20, cold: 20, light: 20 }, dropTier: 4, respawn: 60,
  },
};

// Spawn clusters: center, radius, count.
export const SPAWN_ZONES = [
  { species: "puffling", x: -18, z: 52, r: 22, count: 9 },
  { species: "puffling", x: 30, z: 68, r: 18, count: 7 },
  { species: "boar", x: 44, z: 26, r: 22, count: 8 },
  { species: "boar", x: -48, z: 30, r: 20, count: 7 },
  { species: "sporeling", x: -74, z: -14, r: 20, count: 8 },
  { species: "sporeling", x: -104, z: -44, r: 18, count: 6 },
  { species: "shambler", x: -88, z: -66, r: 22, count: 6 },
  { species: "gloomwisp", x: -58, z: -96, r: 22, count: 6 },
  { species: "raider", x: 84, z: -52, r: 24, count: 7 },
  { species: "mystic", x: 104, z: -88, r: 20, count: 5 },
  { species: "grulmok", x: 0, z: -142, r: 4, count: 1 },
];

export const MOB_RESPAWN_S = 12;
