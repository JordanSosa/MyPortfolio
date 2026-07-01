# Aethermoor — Isle of Brightshore

A browser-based MMO **vertical slice**: the nostalgic feel of *Flyff* (tab-targeting,
skill hotbar, quest chain, grinding cute mobs to cheerful synth music) fused with the
build depth of *Path of Exile* (a ~330-node shared passive tree, drop-only skill
augments, randomized gear affixes across six rarity tiers, and crafting currencies
consumed on gear).

**Read the [Game Design Document](./GDD.md) first** — it defines the vision, systems,
and slice scope; the code implements it.

## Play

- Pick a class (Blademaster / Arcanist / Windrunner), enter Brightshore, take Captain
  Maren's quests, grind toward the Duskfang Alpha.
- **WASD** move · click ground to walk · **Tab**/click to target · **1–6** skills ·
  **R** auto-attack · **Q/E** potions · **Z** vacuum loot
- **B** bag · **C** character · **K** skills & augments · **P** passive constellation ·
  **L** quest log · **H** help · **M** mute
- Crafting: click a currency in your bag, then click a piece of gear.
- Progress autosaves to `localStorage`.

## Tech

Vite + vanilla JS + three.js. Everything is procedural at runtime — terrain, passive
tree, item names, music (WebAudio), SFX — zero binary assets. Single-player, but the
sim/render split is server-shaped: fake adventurers and ambient chat stage the MMO
presence a real websocket layer would replace.

```sh
npm install
npm run dev
```
