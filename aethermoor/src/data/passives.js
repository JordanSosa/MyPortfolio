// The shared passive constellation, ~330 nodes, generated deterministically
// from a fixed seed at load — identical for every player, PoE-style: one tree,
// three class entry points, minors -> notables -> rim keystones.

import { Rng } from "../core/rng.js";
import { CLASSES } from "./classes.js";

const SEED = 1337;

// Minor stat packets by flavor. v scales with ring depth.
const MINORS = {
  str: [
    { stat: "str", v: 10, t: "+# to Strength" },
    { stat: "meleeDmgPct", v: 10, t: "#% increased Melee Damage" },
    { stat: "physDmgPct", v: 8, t: "#% increased Physical Damage" },
    { stat: "maxHp", v: 14, t: "+# to maximum Life" },
    { stat: "armorPct", v: 10, t: "#% increased Armor" },
    { stat: "atkSpdPct", v: 4, t: "#% increased Attack Speed" },
    { stat: "aoePct", v: 6, t: "#% increased Area of Effect" },
    { stat: "vit", v: 8, t: "+# to Vitality" },
  ],
  int: [
    { stat: "int", v: 10, t: "+# to Intelligence" },
    { stat: "spellDmgPct", v: 10, t: "#% increased Spell Damage" },
    { stat: "maxMp", v: 16, t: "+# to maximum Mana" },
    { stat: "fireDmgPct", v: 8, t: "#% increased Fire Damage" },
    { stat: "coldDmgPct", v: 8, t: "#% increased Cold Damage" },
    { stat: "lightDmgPct", v: 8, t: "#% increased Lightning Damage" },
    { stat: "mpRegen", v: 1.5, t: "+# Mana Regenerated per second" },
    { stat: "castSpdPct", v: 4, t: "#% increased Cast Speed" },
  ],
  dex: [
    { stat: "dex", v: 10, t: "+# to Dexterity" },
    { stat: "projDmgPct", v: 10, t: "#% increased Projectile Damage" },
    { stat: "critCh", v: 1.5, t: "+#% to Critical Chance" },
    { stat: "critMult", v: 10, t: "+#% to Critical Multiplier" },
    { stat: "atkSpdPct", v: 4, t: "#% increased Attack Speed" },
    { stat: "evasionPct", v: 2, t: "+#% to Evasion" },
    { stat: "moveSpdPct", v: 3, t: "#% increased Movement Speed" },
    { stat: "dex", v: 8, t: "+# to Dexterity" },
  ],
};

const NOTABLES = {
  str: [
    { name: "Bladestorm", mods: [{ stat: "meleeDmgPct", v: 25 }, { stat: "atkSpdPct", v: 10 }] },
    { name: "Ironhide", mods: [{ stat: "armorPct", v: 30 }, { stat: "physTakenPct", v: -5 }] },
    { name: "Colossal Frame", mods: [{ stat: "maxHp", v: 40 }, { stat: "str", v: 15 }] },
    { name: "Executioner", mods: [{ stat: "meleeDmgPct", v: 20 }, { stat: "critMult", v: 20 }] },
    { name: "Unbending", mods: [{ stat: "maxHp", v: 30 }, { stat: "hpRegen", v: 4 }] },
    { name: "Wrecking Ball", mods: [{ stat: "aoePct", v: 25 }, { stat: "physDmgPct", v: 15 }] },
    { name: "Bloodletter", mods: [{ stat: "leechPct", v: 1.5 }, { stat: "physDmgPct", v: 15 }] },
    { name: "Warbringer", mods: [{ stat: "dmgPct", v: 15 }, { stat: "str", v: 12 }] },
  ],
  int: [
    { name: "Winterheart", mods: [{ stat: "coldDmgPct", v: 30 }, { stat: "chillDurPct", v: 100 }] },
    { name: "Pyromancer", mods: [{ stat: "fireDmgPct", v: 30 }, { stat: "ignitePct", v: 15 }] },
    { name: "Stormcaller", mods: [{ stat: "lightDmgPct", v: 30 }, { stat: "shockPct", v: 15 }] },
    { name: "Deep Reserves", mods: [{ stat: "maxMp", v: 40 }, { stat: "mpRegen", v: 3 }] },
    { name: "Arcane Potency", mods: [{ stat: "spellDmgPct", v: 25 }, { stat: "castSpdPct", v: 8 }] },
    { name: "Mindshield", mods: [{ stat: "maxMp", v: 30 }, { stat: "fireRes", v: 10 }, { stat: "coldRes", v: 10 }, { stat: "lightRes", v: 10 }] },
    { name: "Cataclysm", mods: [{ stat: "aoePct", v: 25 }, { stat: "spellDmgPct", v: 15 }] },
    { name: "Aetherwise", mods: [{ stat: "int", v: 20 }, { stat: "dmgPct", v: 10 }] },
  ],
  dex: [
    { name: "Arrowsong", mods: [{ stat: "projDmgPct", v: 25 }, { stat: "atkSpdPct", v: 10 }] },
    { name: "Deadly Draw", mods: [{ stat: "critCh", v: 4 }, { stat: "critMult", v: 25 }] },
    { name: "Windstep", mods: [{ stat: "moveSpdPct", v: 8 }, { stat: "evasionPct", v: 5 }] },
    { name: "Serpent's Kiss", mods: [{ stat: "dotDmgPct", v: 30 }, { stat: "projDmgPct", v: 10 }] },
    { name: "Eagle Eye", mods: [{ stat: "critCh", v: 3 }, { stat: "projDmgPct", v: 20 }] },
    { name: "Fleet of Foot", mods: [{ stat: "moveSpdPct", v: 6 }, { stat: "atkSpdPct", v: 8 }] },
    { name: "Ambusher", mods: [{ stat: "dmgPct", v: 15 }, { stat: "critMult", v: 15 }] },
    { name: "Sharpened Instinct", mods: [{ stat: "dex", v: 20 }, { stat: "evasionPct", v: 3 }] },
  ],
};

export const KEYSTONES = [
  { id: "glass_cannon", name: "Glass Cannon", flavor: "dex", desc: "+50% all Damage. -30% maximum Life.", mods: [{ stat: "dmgPct", v: 50 }], special: "glassCannon" },
  { id: "blood_pact", name: "Blood Pact", flavor: "str", desc: "Skills cost Life instead of Mana. +20% skill damage.", mods: [{ stat: "dmgPct", v: 20 }], special: "bloodPact" },
  { id: "stormsoul", name: "Stormsoul", flavor: "int", desc: "All damage you deal is Lightning. +30% Shock chance.", mods: [{ stat: "shockPct", v: 30 }], special: "stormsoul" },
  { id: "juggernaut", name: "Juggernaut", flavor: "str", desc: "You cannot be Chilled or Stunned. +25% Armor, -10% Movement Speed.", mods: [{ stat: "armorPct", v: 25 }, { stat: "moveSpdPct", v: -10 }], special: "juggernaut" },
  { id: "deadeye", name: "Deadeye", flavor: "dex", desc: "Crits deal +100% Crit Multiplier. Non-crits deal 30% less damage.", mods: [{ stat: "critMult", v: 100 }], special: "deadeye" },
  { id: "archmage", name: "Archmage", flavor: "int", desc: "+1 Mana Regen per 10 maximum Mana. Skills cost +30% Mana.", mods: [], special: "archmage" },
  { id: "thornweave", name: "Thornweave", flavor: "str", desc: "Reflect 30% of melee damage taken. -10% Evasion.", mods: [{ stat: "evasionPct", v: -10 }], special: "thornweave" },
  { id: "soulthief", name: "Soulthief", flavor: "int", desc: "2% of hit damage leeched as Life. -15% maximum Life.", mods: [{ stat: "leechPct", v: 2 }], special: "soulthief" },
  { id: "windwalker", name: "Windwalker", flavor: "dex", desc: "+15% Movement Speed, +10% Evasion. -20% Armor.", mods: [{ stat: "moveSpdPct", v: 15 }, { stat: "evasionPct", v: 10 }], special: "windwalker" },
];

function angDist(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function flavorAt(angleDeg, rng) {
  // Nearest class angle wins; near boundaries, mix.
  const entries = Object.values(CLASSES).map((c) => ({
    flavor: c.id === "blademaster" ? "str" : c.id === "arcanist" ? "int" : "dex",
    d: angDist(angleDeg, c.treeAngle),
  })).sort((a, b) => a.d - b.d);
  if (entries[1].d - entries[0].d < 18 && rng.chance(0.5)) return entries[1].flavor;
  return entries[0].flavor;
}

export function buildTree() {
  const rng = new Rng(SEED);
  const nodes = [];
  const edges = [];
  const byRing = [];

  const addNode = (n) => { n.id = nodes.length; nodes.push(n); return n; };
  const link = (a, b) => edges.push([a.id, b.id]);

  // Class starts (auto-allocated, free).
  const starts = {};
  for (const c of Object.values(CLASSES)) {
    const a = (c.treeAngle * Math.PI) / 180;
    starts[c.id] = addNode({
      kind: "start", classStart: c.id, ring: 0,
      x: Math.cos(a) * 62, y: Math.sin(a) * 62,
      name: `${c.name} Origin`, mods: [], desc: "Where your path begins.",
    });
  }

  const RINGS = [
    { r: 116, count: 24 }, { r: 176, count: 36 }, { r: 244, count: 48 },
    { r: 318, count: 60 }, { r: 400, count: 72 }, { r: 488, count: 84 },
  ];

  const notablePool = { str: [...NOTABLES.str], int: [...NOTABLES.int], dex: [...NOTABLES.dex] };
  // Notables reappear on deeper rings with scaled values.
  const takeNotable = (flavor, ringIdx) => {
    if (!notablePool[flavor].length) notablePool[flavor] = NOTABLES[flavor].map((n) => ({ ...n, again: true }));
    const idx = rng.int(0, notablePool[flavor].length - 1);
    const def = notablePool[flavor].splice(idx, 1)[0];
    const scale = 1 + ringIdx * 0.08;
    return {
      name: def.name,
      mods: def.mods.map((m) => ({ stat: m.stat, v: Math.round(m.v * scale * 10) / 10 })),
    };
  };

  RINGS.forEach((ring, ri) => {
    const ringNodes = [];
    for (let i = 0; i < ring.count; i++) {
      const baseAng = (i / ring.count) * 360;
      const ang = baseAng + rng.float(-3.5, 3.5);
      const rad = ring.r + rng.float(-10, 10);
      const a = (ang * Math.PI) / 180;
      const flavor = flavorAt(ang, rng);
      const scale = 1 + ri * 0.06;

      let node;
      const notableEvery = 7;
      if (ri === RINGS.length - 1 && i % Math.floor(ring.count / KEYSTONES.length) === 2 && nodes.filter((n) => n.kind === "keystone").length < KEYSTONES.length) {
        // Keystone slot on the rim — pick the keystone whose flavor best fits here.
        const placed = nodes.filter((n) => n.kind === "keystone").map((n) => n.keystone);
        const candidates = KEYSTONES.filter((k) => !placed.includes(k.id));
        candidates.sort((k1, k2) => (k1.flavor === flavor ? -1 : 0) - (k2.flavor === flavor ? -1 : 0));
        const ks = candidates[0];
        node = addNode({
          kind: "keystone", keystone: ks.id, ring: ri + 1, flavor: ks.flavor,
          x: Math.cos(a) * rad, y: Math.sin(a) * rad,
          name: ks.name, mods: ks.mods, special: ks.special, desc: ks.desc,
        });
      } else if (i % notableEvery === 3) {
        const nt = takeNotable(flavor, ri);
        node = addNode({
          kind: "notable", ring: ri + 1, flavor,
          x: Math.cos(a) * rad, y: Math.sin(a) * rad,
          name: nt.name, mods: nt.mods,
          desc: null,
        });
      } else {
        const pool = MINORS[flavor];
        const pickIdx = rng.int(0, pool.length - 1);
        const m = pool[pickIdx];
        const v = Math.round(m.v * scale * 10) / 10;
        node = addNode({
          kind: "minor", ring: ri + 1, flavor,
          x: Math.cos(a) * rad, y: Math.sin(a) * rad,
          name: m.t.replace("#", String(v)), mods: [{ stat: m.stat, v }],
          desc: null,
        });
      }
      ringNodes.push(node);
    }
    byRing.push(ringNodes);

    // Tangential edges around the ring, with occasional gaps for pathing texture.
    for (let i = 0; i < ringNodes.length; i++) {
      const nxt = ringNodes[(i + 1) % ringNodes.length];
      if (rng.chance(ri === 0 ? 1 : 0.86)) link(ringNodes[i], nxt);
    }
  });

  // Class starts -> nearest 3 nodes on ring 1.
  for (const c of Object.values(CLASSES)) {
    const s = starts[c.id];
    const sorted = byRing[0].slice().sort((a, b) =>
      ((a.x - s.x) ** 2 + (a.y - s.y) ** 2) - ((b.x - s.x) ** 2 + (b.y - s.y) ** 2));
    for (let k = 0; k < 3; k++) link(s, sorted[k]);
  }

  // Radial spokes between rings: each node ~45% chance to link to nearest node
  // on the next outer ring; ensure every outer node has at least one inward path
  // via a second pass.
  for (let ri = 0; ri < byRing.length - 1; ri++) {
    const inner = byRing[ri], outer = byRing[ri + 1];
    const nearest = (n, arr) => arr.reduce((best, o) =>
      ((o.x - n.x) ** 2 + (o.y - n.y) ** 2) < ((best.x - n.x) ** 2 + (best.y - n.y) ** 2) ? o : best);
    for (const n of inner) if (rng.chance(0.45)) link(n, nearest(n, outer));
    // guarantee inward connectivity for outer nodes with no spoke yet
    const linked = new Set(edges.flat());
    for (const o of outer) {
      const hasSpoke = edges.some(([a, b]) =>
        (a === o.id && inner.some((n) => n.id === b)) || (b === o.id && inner.some((n) => n.id === a)));
      if (!hasSpoke && (rng.chance(0.5) || !linked.has(o.id))) link(o, nearest(o, inner));
    }
  }

  // Adjacency map + global connectivity repair (attach stray components).
  const adj = new Map(nodes.map((n) => [n.id, new Set()]));
  for (const [a, b] of edges) { adj.get(a).add(b); adj.get(b).add(a); }

  const seen = new Set();
  const queue = Object.values(starts).map((s) => s.id);
  queue.forEach((id) => seen.add(id));
  while (queue.length) {
    const id = queue.shift();
    for (const nb of adj.get(id)) if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
  }
  for (const n of nodes) {
    if (!seen.has(n.id)) {
      let best = null, bd = Infinity;
      for (const m of nodes) {
        if (!seen.has(m.id)) continue;
        const d = (m.x - n.x) ** 2 + (m.y - n.y) ** 2;
        if (d < bd) { bd = d; best = m; }
      }
      edges.push([n.id, best.id]);
      adj.get(n.id).add(best.id); adj.get(best.id).add(n.id);
      // flood from n
      const q2 = [n.id]; seen.add(n.id);
      while (q2.length) {
        const id = q2.shift();
        for (const nb of adj.get(id)) if (!seen.has(nb)) { seen.add(nb); q2.push(nb); }
      }
    }
  }

  return { nodes, edges, adj, starts };
}

export const TREE = buildTree();
