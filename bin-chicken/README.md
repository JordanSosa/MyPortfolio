# Bin Chicken

A stealth arcade game for the browser. You're an Australian white ibis in a
harbourside park, and you have 2½ minutes to eat as much picnic food as possible.

**Live:** https://jordansosa.github.io/MyPortfolio/bin-chicken/

## How it plays

- Every picnicker has a **view cone** drawn on the grass. If you loiter near their
  food inside it, their alert meter fills; when it's full, they get up and chase you.
- **Snatch** big items (hot chips, snags, pies, sandwiches) and carry them off.
  You have to stand still to **scoff** them. If you're caught first, you drop the food.
- Steal from behind and the owner takes a moment to notice. Steal in plain
  view and they come straight for you.
- **Raid bins** for scraps. The crash puts everyone nearby on edge.
- **Hide in bushes** to break line of sight and shake off a chaser.
- **Flap** to hop over tables and bins, and hold the flap button to glide.
- Feeds within 10 seconds of each other build a combo multiplier, up to x5.
- Food restocks about 20 seconds after it's eaten. The BBQ dad has the widest,
  most restless cone in the park.

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD / arrows | Drag anywhere on the left half |
| Run | Shift | Push the stick to the edge |
| Snatch / hold to eat / hold to raid bin | E | ✋ |
| Flap / hold to glide | Space | Flap |
| Honk | Q | Honk |
| Pause / mute | Esc / M | Buttons, top right |

## Tech

- Vite + three.js, with no image or audio assets. All models are built from
  primitives with toon shading and inverted-hull outlines. Textures (grass,
  picnic rugs, the kiosk sign) are drawn on canvas at runtime.
- All sounds (honks, crunches, a formant-filtered "OI!", bins crashing,
  harbour ambience) are synthesised with WebAudio.
- Tree canopies and the kiosk fade out whenever they block the camera's view
  of the ibis.
- `window.__binChicken.sim(seconds)` steps the simulation at a fixed 60 Hz
  without rendering. It's used for headless gameplay tests.

```sh
npm install
npm run dev
```

| File | Role |
| --- | --- |
| `src/main.js` | Game loop, rules, scoring, HUD and screens |
| `src/world.js` | Park, harbour, bridge, props, picnic spots, colliders |
| `src/ibis.js` | Player model, movement, flapping and gliding |
| `src/people.js` | Picnickers, walkers and the BBQ dad: view cones, alertness, chasing |
| `src/food.js` | Food types and meshes |
| `src/audio.js` | Synthesised sound effects |
| `src/input.js` | Keyboard and touch input |
| `src/toon.js` | Toon materials, outlines, canvas textures |
